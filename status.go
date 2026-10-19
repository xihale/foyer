package main

import (
	"database/sql"
	"math"
	"net/http"
)

// 公开状态页:每监控服务的当前状态、24h 在线率、心跳柱状图、最近 incident。
// ?window=24h(默认,48 桶×30min) 或 7d(56 桶×3h)。

type lastIncident struct {
	StartedAt int64  `json:"started_at"`
	Message   string `json:"message"`
}

type statusBar struct {
	T     int64  `json:"t"`
	Total int64  `json:"total"`
	Ups   int64  `json:"ups"`
	AvgMs *int64 `json:"avg_ms"`
}

type statusRow struct {
	ID           int64         `json:"id"`
	Name         string        `json:"name"`
	Status       string        `json:"status"`
	LatencyMs    *int64        `json:"latency_ms"`
	Uptime24h    *float64      `json:"uptime_24h"`
	LastIncident *lastIncident `json:"last_incident"`
	Bars         []statusBar   `json:"bars"`
}

func (a *app) getStatus(w http.ResponseWriter, r *http.Request) {
	nowMs := timeNowMillis()
	sinceMs := nowMs - 24*3600*1000

	slots, slotMs, windowMs := int64(48), int64(30*60*1000), int64(24*3600*1000)
	if r.URL.Query().Get("window") == "7d" {
		slots, slotMs, windowMs = 56, 3*3600*1000, 7*24*3600*1000
	}
	// 桶边界对齐到 slot_ms 的整数倍,末桶包含当前时刻
	lastSlot := floorDiv(nowMs, slotMs)
	firstSlot := lastSlot - (slots - 1)

	rows, err := a.db.Query(`
SELECT s.id, s.name,
  (SELECT COUNT(*) FROM heartbeats h WHERE h.service_id=s.id AND h.ts>?) AS total,
  (SELECT COUNT(*) FROM heartbeats h WHERE h.service_id=s.id AND h.ts>? AND h.status=1) AS ups,
  (SELECT started_at FROM incidents i WHERE i.service_id=s.id ORDER BY started_at DESC LIMIT 1),
  (SELECT message FROM incidents i WHERE i.service_id=s.id ORDER BY started_at DESC LIMIT 1)
FROM services s JOIN groups g ON g.id = s.group_id WHERE s.monitor_enabled=1 ORDER BY g.sort, s.sort, s.id`, sinceMs, sinceMs)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	list := []statusRow{}
	for rows.Next() {
		var sid int64
		var name string
		var total, ups int64
		var startedAt sql.NullInt64
		var message sql.NullString
		if err := rows.Scan(&sid, &name, &total, &ups, &startedAt, &message); err != nil {
			continue
		}
		st, latency := a.engine.getState(sid)
		row := statusRow{
			ID:        sid,
			Name:      name,
			Status:    st.String(),
			LatencyMs: latency,
			Bars:      make([]statusBar, slots),
		}
		if total > 0 {
			v := float64(ups) / float64(total) * 100.0
			row.Uptime24h = &v
		}
		if startedAt.Valid {
			row.LastIncident = &lastIncident{StartedAt: startedAt.Int64, Message: message.String}
		}
		// 柱状图:默认全空(total=0),查询结果按桶序号回填
		for i := int64(0); i < slots; i++ {
			row.Bars[i] = statusBar{T: (firstSlot + i) * slotMs}
		}
		bars, err := a.db.Query(`
SELECT ts / ? AS slot, COUNT(*), SUM(status),
  AVG(CASE WHEN status=1 THEN latency_ms END) AS avg_ms
FROM heartbeats WHERE service_id=? AND ts>=?
GROUP BY slot`, slotMs, sid, nowMs-windowMs)
		if err == nil {
			for bars.Next() {
				var slot, cnt, sum int64
				var avg sql.NullFloat64
				if err := bars.Scan(&slot, &cnt, &sum, &avg); err != nil {
					continue
				}
				idx := slot - firstSlot
				if idx < 0 || idx >= slots {
					continue
				}
				b := statusBar{T: (firstSlot + idx) * slotMs, Total: cnt, Ups: sum}
				if avg.Valid {
					v := int64(math.Round(avg.Float64))
					b.AvgMs = &v
				}
				row.Bars[idx] = b
			}
			bars.Close()
		}
		list = append(list, row)
	}
	writeJSON(w, http.StatusOK, map[string]any{"services": list})
}

// floorDiv:Go 与 SQLite 的整数除法都是向零截断;now_ms 恒正,语义一致。
func floorDiv(a, b int64) int64 { return a / b }
