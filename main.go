package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"
)

//go:embed frontend/dist
var distFS embed.FS

// wwwEntry 嵌入的静态文件：ETag = sha256 前 16 字节 hex（带引号的强验证器）。
type wwwEntry struct {
	ctype string
	etag  string
	data  []byte
}

var wwwTable = map[string]wwwEntry{}

func init() {
	fs.WalkDir(distFS, "frontend/dist", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel := strings.TrimPrefix(p, "frontend/dist/")
		// 与 Zig 版 build.zig 同规则：跳过生成器产物与运行时 icons/
		if strings.HasSuffix(rel, ".www.zig") || strings.HasPrefix(rel, "icons/") {
			return nil
		}
		data, err := distFS.ReadFile(p)
		if err != nil {
			return nil
		}
		sum := sha256.Sum256(data)
		wwwTable[rel] = wwwEntry{
			ctype: wwwCtype(rel),
			etag:  `"` + hex.EncodeToString(sum[:16]) + `"`,
			data:  data,
		}
		return nil
	})
}

func wwwCtype(name string) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".html":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".json":
		return "application/json"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".ico":
		return "image/x-icon"
	case ".webp":
		return "image/webp"
	case ".woff2":
		return "font/woff2"
	case ".xml":
		return "application/xml"
	case ".txt":
		return "text/plain; charset=utf-8"
	}
	return "application/octet-stream"
}

type app struct {
	db           *sql.DB
	engine       *engine
	apiOnly      bool
	cookieSecure bool
	limiter      loginLimiter
}

func (a *app) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// serveEntry 嵌入文件：assets/* 与 build/*（Qwik 哈希产物）内容可永久缓存，其余协商缓存。
// code 通常为 200；404 页复用同一管线但跳过 304 协商（错误响应没有新鲜的语义）。
func serveEntry(w http.ResponseWriter, r *http.Request, e wwwEntry, rel string, code int) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if strings.HasPrefix(rel, "assets/") || strings.HasPrefix(rel, "build/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	w.Header().Set("Etag", e.etag)
	// If-None-Match 可能为列表或 *，子串匹配足够
	if inm := r.Header.Get("If-None-Match"); code == http.StatusOK &&
		(inm == "*" || strings.Contains(inm, e.etag)) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", e.ctype)
	w.WriteHeader(code)
	w.Write(e.data)
}

// notFound 兜底 handler——静态文件阶梯，顺序与 Zig 版 App.notFound 一致：
// 405 → api 404 JSON → icons 磁盘 → api_only → 精确命中 → 无扩展名试 .html
// → 未命中回预渲染 404 页(带 404 状态码)。
func (a *app) notFound(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	p := r.URL.Path
	if p == "" || p == "/" {
		p = "/index.html"
	}
	rel := strings.TrimPrefix(p, "/")
	if strings.HasPrefix(rel, "api/") {
		errJSON(w, http.StatusNotFound, "not found")
		return
	}
	if strings.HasPrefix(rel, "icons/") {
		a.serveDiskIcon(w, r, rel[len("icons/"):])
		return
	}
	if a.apiOnly {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if e, ok := wwwTable[rel]; ok {
		serveEntry(w, r, e, rel, http.StatusOK)
		return
	}
	// 干净链接回退：/status → status.html 或 status/index.html（Qwik SSG 产物布局）
	if !strings.Contains(rel, ".") {
		if e, ok := wwwTable[rel+".html"]; ok {
			serveEntry(w, r, e, rel+".html", http.StatusOK)
			return
		}
		if e, ok := wwwTable[rel+"/index.html"]; ok {
			serveEntry(w, r, e, rel+"/index.html", http.StatusOK)
			return
		}
	}
	// 未命中即真 404：回预渲染的错误页，而不是假装是首页（旧 SPA 兜底已弃）
	if e, ok := wwwTable["404/index.html"]; ok {
		serveEntry(w, r, e, "404/index.html", http.StatusNotFound)
		return
	}
	http.Error(w, "not found", http.StatusNotFound)
}

// getEvents SSE 实时事件流。payload 已是完整帧（"data: {...}\n\n"），
// 内务循环每 30s 推 ": ping" 保活帧——兼作死连接探测与代理防空闲掐线。
func (a *app) getEvents(w http.ResponseWriter, r *http.Request) {
	s := a.engine.subscribe()
	defer a.engine.unsubscribe(s)

	w.Header().Set("Content-Type", "text/event-stream; charset=UTF-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	rc := http.NewResponseController(w)
	for {
		select {
		case <-r.Context().Done():
			return
		case frame, ok := <-s.ch:
			if !ok {
				return
			}
			if _, err := w.Write(frame); err != nil {
				return
			}
			if err := rc.Flush(); err != nil {
				return
			}
		}
	}
}

func (a *app) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("GET /api/config", a.getConfig)
	mux.HandleFunc("GET /api/events", a.getEvents)
	mux.HandleFunc("GET /api/system", a.getSystem)
	mux.HandleFunc("GET /api/status", a.getStatus)

	// 认证与管理（/admin 用）
	mux.HandleFunc("POST /api/login", a.postLogin)
	mux.HandleFunc("POST /api/logout", a.postLogout)
	mux.HandleFunc("GET /api/admin/session", a.getAdminSession)
	mux.HandleFunc("PUT /api/admin/password", a.putPassword)
	mux.HandleFunc("PUT /api/admin/settings", a.putSettings)
	mux.HandleFunc("PUT /api/admin/notification", a.putNotification)
	mux.HandleFunc("POST /api/admin/notification/test", a.postNotificationTest)
	mux.HandleFunc("DELETE /api/admin/notification", a.deleteNotification)
	mux.HandleFunc("POST /api/admin/services", a.postService)
	mux.HandleFunc("PUT /api/admin/services/{id}", a.putService)
	mux.HandleFunc("DELETE /api/admin/services/{id}", a.deleteService)
	mux.HandleFunc("POST /api/admin/groups", a.postGroup)
	mux.HandleFunc("PUT /api/admin/groups/{id}", a.putGroup)
	mux.HandleFunc("DELETE /api/admin/groups/{id}", a.deleteGroup)
	mux.HandleFunc("POST /api/admin/bookmarks", a.postBookmark)
	mux.HandleFunc("PUT /api/admin/bookmarks/{id}", a.putBookmark)
	mux.HandleFunc("DELETE /api/admin/bookmarks/{id}", a.deleteBookmark)
	mux.HandleFunc("POST /api/admin/icons", a.postIcon)
	mux.HandleFunc("POST /api/admin/icons/fetch", a.postIconFetch)
	mux.HandleFunc("DELETE /api/admin/icons/{name}", a.deleteIcon)

	mux.HandleFunc("/", a.notFound)
	return mux
}

func timeNowSecs() int64   { return time.Now().Unix() }
func timeNowMillis() int64 { return time.Now().UnixMilli() }

func main() {
	db, err := openDB()
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	ensureAdmin(db)

	eng := newEngine(db)
	eng.start()

	apiOnly := false
	if v, ok := os.LookupEnv("FOYER_DEV"); ok {
		apiOnly = !(v == "0" || v == "false")
	}
	a := &app{
		db:           db,
		engine:       eng,
		apiOnly:      apiOnly,
		cookieSecure: !apiOnly, // 生产经 Caddy TLS 访问 → Secure
	}

	// 默认只绑回环：公网入口一律走前置 Caddy，杜绝 http://IP:3002 明文直达。
	// 容器内需要 0.0.0.0 供端口映射时设 FOYER_BIND=all（确认有防火墙/反代兜底）。
	host := "127.0.0.1"
	if v := os.Getenv("FOYER_BIND"); v == "all" || v == "0.0.0.0" {
		host = "0.0.0.0"
	}
	port := "3002"
	if v := os.Getenv("FOYER_PORT"); v != "" {
		port = v // 并行实例/灰度用
	}
	srv := &http.Server{Addr: host + ":" + port, Handler: a.routes()}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		eng.stop() // 先停引擎（SSE 退订、等在飞探测），Shutdown 才能真正收尾
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	if apiOnly {
		fmt.Println("foyer api_only mode（页面走 vite :5173）")
	}
	fmt.Println("foyer listening on http://" + srv.Addr)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen %s: %v（是否已有 foyer 实例在运行?）", srv.Addr, err)
	}
}
