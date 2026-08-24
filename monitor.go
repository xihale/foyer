package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// 监控引擎：每个启用的服务一个常驻探测 goroutine（ticker 驱动），
// 外加一个内务 goroutine（SSE ping / 心跳清理 / 兜底对账）。
// 服务增删改通过 engine.Sync() 对账，无需重启进程。
// 心跳/事故落库是唯一事实源；内存态（status/latency）重启后回 unknown。

const (
	monitorIntervalMinS = int64(30)
	monitorIntervalMaxS = int64(86400)
	monitorRetryMaxLim  = int64(10)
	maxProbes           = 16               // 全局在飞探测上限
	probeTimeout        = 10 * time.Second // 单次 HTTP 探测超时
	retryGap            = 5 * time.Second  // 失败重试间隔
)

type monitorStatus int8

const (
	statusUnknown monitorStatus = iota
	statusUp
	statusDown
)

func (s monitorStatus) String() string {
	switch s {
	case statusUp:
		return "up"
	case statusDown:
		return "down"
	}
	return "unknown"
}

type monitorState struct {
	status      monitorStatus
	latencyMs   *int64
	lastChecked int64 // unix millis
}

// sub SSE 订阅者：有界队列（chan 缓冲 32），满则丢帧不阻塞广播方。
type sub struct {
	ch chan []byte
}

// probeLoop 单个服务的常驻探测循环句柄。
type probeLoop struct {
	interval time.Duration
	cancel   context.CancelFunc
}

type engine struct {
	db   *sql.DB
	ntfy atomic.Pointer[ntfyConfig]

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	syncMu  sync.Mutex           // 串行化 Sync/stop，避免 wg.Add 与 Wait 竞态
	loopsMu sync.Mutex           // 保护 loops
	loops   map[int64]*probeLoop // service_id → 探测循环

	statesMu sync.RWMutex
	states   map[int64]monitorState

	subsMu sync.Mutex
	subs   map[*sub]struct{}

	sem chan struct{}
}

var probeClient = &http.Client{
	Timeout:   probeTimeout,
	Transport: &http.Transport{DisableKeepAlives: true},
}

func newEngine(db *sql.DB) *engine {
	e := &engine{
		db:     db,
		loops:  make(map[int64]*probeLoop),
		states: make(map[int64]monitorState),
		subs:   make(map[*sub]struct{}),
		sem:    make(chan struct{}, maxProbes),
	}
	e.ctx, e.cancel = context.WithCancel(context.Background())
	e.ntfy.Store(loadNtfyConfig(db))
	return e
}

func (e *engine) start() {
	e.wg.Add(1)
	go e.housekeeping()
	e.Sync()
}

func (e *engine) setNtfyConfig(cfg *ntfyConfig) { e.ntfy.Store(cfg) }

// stop 幂等：先与 Sync 互斥地 cancel（杜绝新 goroutine 再入 wg），
// 等在飞探测收尾（≤2s），最后摘除并关闭所有订阅者。
func (e *engine) stop() {
	e.syncMu.Lock()
	e.cancel()
	e.syncMu.Unlock()
	done := make(chan struct{})
	go func() { e.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
	}
	e.subsMu.Lock()
	for s := range e.subs {
		delete(e.subs, s)
		close(s.ch)
	}
	e.subsMu.Unlock()
}

// housekeeping 内务循环：SSE 保活、心跳滚动清理、兜底对账。
func (e *engine) housekeeping() {
	defer e.wg.Done()
	ping := time.NewTicker(30 * time.Second)
	defer ping.Stop()
	purge := time.NewTicker(24 * time.Hour)
	defer purge.Stop()
	resync := time.NewTicker(time.Minute)
	defer resync.Stop()
	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ping.C:
			// 保活帧：兼作死连接探测与代理防空闲掐线
			e.broadcast([]byte(": ping\n\n"))
		case <-purge.C:
			cutoff := time.Now().Add(-45 * 24 * time.Hour).UnixMilli()
			if _, err := e.db.Exec(`DELETE FROM heartbeats WHERE ts < ?`, cutoff); err != nil {
				log.Printf("monitor: purge heartbeats: %v", err)
			}
		case <-resync.C:
			e.Sync() // 兜底：handler 漏通知或直接改库也能收敛
		}
	}
}

// Sync 把在跑的探测循环与 DB 对账：
// 新启用的启动循环（错峰后立即首查）、周期变更的重启（立即复查）、
// 停用/删除的取消并清内存态。幂等，服务 CRUD 后调用。
func (e *engine) Sync() {
	e.syncMu.Lock()
	defer e.syncMu.Unlock()
	if e.ctx.Err() != nil {
		return // 已停机，不再往 wg 里加东西
	}

	enabled := make(map[int64]time.Duration)
	rows, err := e.db.Query(`SELECT id, monitor_interval_s FROM services WHERE monitor_enabled=1`)
	if err != nil {
		return // 读库失败：维持现状，等下次对账
	}
	for rows.Next() {
		var id, sec int64
		if err := rows.Scan(&id, &sec); err == nil {
			enabled[id] = clampInterval(sec)
		}
	}
	rows.Close()

	e.loopsMu.Lock()
	for id, interval := range enabled {
		l, ok := e.loops[id]
		if ok && l.interval == interval {
			continue
		}
		if ok {
			l.cancel() // 周期变了：重启该服务的循环
		}
		ctx, cancel := context.WithCancel(e.ctx)
		e.loops[id] = &probeLoop{interval: interval, cancel: cancel}
		e.wg.Add(1)
		go e.probeLoop(ctx, id, interval, !ok) // 新面孔错峰首查
	}
	var removed []int64
	for id, l := range e.loops {
		if _, ok := enabled[id]; !ok {
			l.cancel()
			delete(e.loops, id)
			removed = append(removed, id)
		}
	}
	e.loopsMu.Unlock()
	if len(removed) > 0 {
		e.statesMu.Lock()
		for _, id := range removed {
			delete(e.states, id) // 前端回到 unknown
		}
		e.statesMu.Unlock()
	}
}

// probeLoop 单服务探测循环：可选错峰 → 立即首查 → 按 ticker 周期检查。
// ticker 错过的 tick 会合并，不会积压。
func (e *engine) probeLoop(ctx context.Context, id int64, interval time.Duration, stagger bool) {
	defer e.wg.Done()
	if stagger {
		// 新面孔错峰首查，避免进程重启时全体同时开打（id%10)*2s ∈ [0,18s]
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Duration(id%10) * 2 * time.Second):
		}
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	e.check(ctx, id)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			e.check(ctx, id)
		}
	}
}

// check 跑一轮完整探测（含重试）。全局并发由 sem 兜底，
// 抢不到就等——ticker 的下一个 tick 天然形成退避。
func (e *engine) check(ctx context.Context, id int64) {
	select {
	case <-ctx.Done():
		return
	case e.sem <- struct{}{}:
	}
	defer func() { <-e.sem }()

	// href/name/retry 每轮现读：编辑服务即时生效，无需动循环
	var href, name string
	var retryMax int64
	if err := e.db.QueryRow(
		`SELECT href, name, monitor_retry_max FROM services WHERE id=?`, id,
	).Scan(&href, &name, &retryMax); err != nil {
		return // 已被删除
	}
	attempts := 1 + int(clampRange(retryMax, 0, monitorRetryMaxLim))

	var (
		up      bool
		latency *int64
		msg     string
		startMs int64
	)
	for i := 0; i < attempts; i++ {
		start := time.Now()
		startMs = start.UnixMilli()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, href, nil)
		if err != nil {
			up, latency, msg = false, nil, "RequestFailed"
		} else {
			resp, err := probeClient.Do(req)
			d := time.Since(start).Milliseconds()
			switch {
			case err != nil:
				up, latency, msg = false, nil, shortErr(err)
			default:
				resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode <= 399 {
					up, latency, msg = true, &d, fmt.Sprintf("HTTP %d", resp.StatusCode)
				} else {
					up, latency, msg = false, &d, fmt.Sprintf("HTTP %d", resp.StatusCode)
				}
			}
		}
		if up || i == attempts-1 {
			break
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(retryGap):
		}
	}
	e.finishCheck(id, name, up, latency, startMs, msg)
}

// finishCheck 落心跳、维护事故与内存态、翻转时推送通知并广播 SSE 帧。
func (e *engine) finishCheck(id int64, name string, up bool, latency *int64, tsMs int64, msg string) {
	now := time.Now().UnixMilli()

	newSt := statusDown
	if up {
		newSt = statusUp
	}
	e.statesMu.Lock()
	prev := e.states[id].status
	e.states[id] = monitorState{status: newSt, latencyMs: latency, lastChecked: tsMs}
	e.statesMu.Unlock()

	var lat any
	if latency != nil {
		lat = *latency
	}
	if _, err := e.db.Exec(
		`INSERT INTO heartbeats(service_id, ts, status, latency_ms, message) VALUES(?,?,?,?,?)`,
		id, tsMs, boolToInt(up), lat, msg,
	); err != nil {
		log.Printf("monitor: insert heartbeat: %v", err)
	}

	flippedDown := prev == statusUp && !up
	recovered := false
	if flippedDown {
		if _, err := e.db.Exec(
			`INSERT INTO incidents(service_id, started_at, message) VALUES(?,?,?)`, id, tsMs, msg,
		); err != nil {
			log.Printf("monitor: insert incident: %v", err)
		}
	} else if up {
		res, err := e.db.Exec(
			`UPDATE incidents SET ended_at=? WHERE service_id=? AND ended_at IS NULL`, now, id)
		if err == nil {
			if n, _ := res.RowsAffected(); n > 0 {
				recovered = true
			}
		}
	}

	// 仅翻转才推：down（prio 5）/真正闭合事故的 up（prio 3）；unknown→down 不推
	if cfg := e.ntfy.Load(); cfg != nil && (flippedDown || recovered) {
		kind := kindUp
		if flippedDown {
			kind = kindDown
		}
		go func() { _ = sendNtfy(cfg, kind, name, name+": "+msg) }()
	}

	frame, _ := json.Marshal(struct {
		Type      string `json:"type"`
		ServiceID int64  `json:"service_id"`
		Up        bool   `json:"up"`
		LatencyMs *int64 `json:"latency_ms"`
	}{"status", id, up, latency})
	e.broadcast(append([]byte("data: "), append(frame, '\n', '\n')...))
}

// ===== SSE 订阅 =====

func (e *engine) subscribe() *sub {
	s := &sub{ch: make(chan []byte, 32)}
	e.subsMu.Lock()
	e.subs[s] = struct{}{}
	e.subsMu.Unlock()
	return s
}

func (e *engine) unsubscribe(s *sub) {
	e.subsMu.Lock()
	if _, ok := e.subs[s]; ok {
		delete(e.subs, s)
		close(s.ch)
	}
	e.subsMu.Unlock()
}

func (e *engine) broadcast(frame []byte) {
	e.subsMu.Lock()
	defer e.subsMu.Unlock()
	for s := range e.subs {
		select {
		case s.ch <- frame:
		default: // 慢订阅者丢帧
		}
	}
}

func (e *engine) getState(id int64) (monitorStatus, *int64) {
	e.statesMu.RLock()
	defer e.statesMu.RUnlock()
	st, ok := e.states[id]
	if !ok {
		return statusUnknown, nil
	}
	return st.status, st.latencyMs
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func clampInterval(sec int64) time.Duration {
	return time.Duration(clampRange(sec, monitorIntervalMinS, monitorIntervalMaxS)) * time.Second
}

func clampRange(v, lo, hi int64) int64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// shortErr 把探测错误折叠成短码——状态页公开可见，
// 不能透出原始错误里的内网地址；短码与前端 errors.ts 词条对齐。
func shortErr(err error) string {
	s := err.Error()
	switch {
	case strings.Contains(s, "context deadline exceeded") || strings.Contains(s, "Client.Timeout"):
		return "Timeout"
	case strings.Contains(s, "connection refused"):
		return "ConnectionRefused"
	case strings.Contains(s, "no such host") || strings.Contains(s, "lookup "):
		return "UnknownHostName"
	case strings.Contains(s, "connection reset"):
		return "ConnectionResetByPeer"
	case strings.Contains(s, "i/o timeout"):
		return "ConnectionTimedOut"
	case strings.Contains(s, "TLS"), strings.Contains(s, "certificate"), strings.Contains(s, "x509"):
		return "TlsInitializationFailed"
	case strings.Contains(s, "EOF"):
		return "EndOfStream"
	}
	return "RequestFailed"
}
