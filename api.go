package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// ===== /api/config =====

type serviceOut struct {
	ID               int64   `json:"id"`
	Name             string  `json:"name"`
	Icon             *string `json:"icon"`
	Href             string  `json:"href"`
	Description      *string `json:"description"`
	MonitorEnabled   bool    `json:"monitor_enabled"`
	GroupID          int64   `json:"group_id"`
	MonitorIntervalS int64   `json:"monitor_interval_s"`
	MonitorRetryMax  int64   `json:"monitor_retry_max"`
	Status           string  `json:"status"`
	LatencyMs        *int64  `json:"latency_ms"`
}

type bookmarkOut struct {
	ID      int64   `json:"id"`
	Name    string  `json:"name"`
	Icon    *string `json:"icon"`
	Href    string  `json:"href"`
	GroupID int64   `json:"group_id"`
}

type groupOut struct {
	ID        int64         `json:"id"`
	Name      string        `json:"name"`
	Style     string        `json:"style"`
	Columns   *int64        `json:"columns"`
	IconsOnly bool          `json:"icons_only"`
	Services  []serviceOut  `json:"services"`
	Bookmarks []bookmarkOut `json:"bookmarks"`
}

// getConfig 面板主页数据。config 携带图标 mtime 版本号，被任何缓存层留住都会
// 让 v 陈旧、覆盖图标后旧 URL 撞 immutable 缓存 → 显式禁缓存。
func (a *app) getConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	var general json.RawMessage // nil → 序列化为 null
	var raw string
	if err := a.db.QueryRow(`SELECT value_json FROM settings WHERE key='general'`).Scan(&raw); err == nil {
		if json.Valid([]byte(raw)) {
			general = json.RawMessage(raw)
		}
	}

	svcGroups, bmGroups := []groupOut{}, []groupOut{}
	rows, err := a.db.Query(
		`SELECT id, name, kind, style, columns, icons_only FROM groups ORDER BY sort`)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var g groupOut
		var kind string
		var columns sql.NullInt64
		var iconsOnly int64
		if err := rows.Scan(&g.ID, &g.Name, &kind, &g.Style, &columns, &iconsOnly); err != nil {
			continue
		}
		if columns.Valid {
			v := columns.Int64
			g.Columns = &v
		}
		g.IconsOnly = iconsOnly != 0
		if kind == "service" {
			g.Services = []serviceOut{}
			sit, err := a.db.Query(`
SELECT id, name, icon, href, description, monitor_enabled, monitor_interval_s, monitor_retry_max
FROM services WHERE group_id=? ORDER BY sort`, g.ID)
			if err == nil {
				for sit.Next() {
					var s serviceOut
					var icon, desc sql.NullString
					var enabled int64
					if err := sit.Scan(&s.ID, &s.Name, &icon, &s.Href, &desc, &enabled,
						&s.MonitorIntervalS, &s.MonitorRetryMax); err != nil {
						continue
					}
					if icon.Valid {
						v := versionedIcon(icon.String)
						s.Icon = &v
					}
					if desc.Valid {
						v := desc.String
						s.Description = &v
					}
					s.MonitorEnabled = enabled != 0
					s.GroupID = g.ID
					st, lat := a.engine.getState(s.ID)
					s.Status, s.LatencyMs = st.String(), lat
					g.Services = append(g.Services, s)
				}
				sit.Close()
			}
			svcGroups = append(svcGroups, g)
		} else {
			g.Bookmarks = []bookmarkOut{}
			bit, err := a.db.Query(
				`SELECT id, name, icon, href FROM bookmarks WHERE group_id=? ORDER BY sort`, g.ID)
			if err == nil {
				for bit.Next() {
					var b bookmarkOut
					var icon sql.NullString
					if err := bit.Scan(&b.ID, &b.Name, &icon, &b.Href); err != nil {
						continue
					}
					if icon.Valid {
						v := versionedIcon(icon.String)
						b.Icon = &v
					}
					b.GroupID = g.ID
					g.Bookmarks = append(g.Bookmarks, b)
				}
				bit.Close()
			}
			bmGroups = append(bmGroups, g)
		}
	}
	writeJSON(w, http.StatusOK, struct {
		General        json.RawMessage `json:"general"`
		ServiceGroups  []groupOut      `json:"service_groups"`
		BookmarkGroups []groupOut      `json:"bookmark_groups"`
	}{general, svcGroups, bmGroups})
}

// ===== 认证与管理 =====

// cookieToken 从 Cookie 头解析会话 token（分号切分后 trim）。
func cookieToken(r *http.Request) string {
	ck := r.Header.Get("Cookie")
	for _, raw := range strings.Split(ck, ";") {
		pair := strings.Trim(raw, " \t")
		name, val, ok := strings.Cut(pair, "=")
		if ok && name == sessionCookie {
			return val
		}
	}
	return ""
}

func (a *app) isAuthed(r *http.Request) bool {
	return sessionValid(a.db, cookieToken(r))
}

func (a *app) postLogin(w http.ResponseWriter, r *http.Request) {
	// 限速兜底：argon2 慢哈希是第一道节流，连续失败达阈值后锁 15 分钟（审计 #7）
	now := timeNowSecs()
	if a.limiter.locked(now) {
		errJSON(w, http.StatusTooManyRequests, "too many failed attempts, retry later")
		return
	}
	body, ok := decodeJSON[struct {
		Password string `json:"password"`
	}](w, r)
	if !ok {
		return
	}
	if body == nil || !verifyPassword(mustGetKv(a.db, "admin_password_hash"), body.Password) {
		if body != nil {
			a.limiter.recordFailure(now)
		}
		unauthorized(w)
		return
	}
	a.limiter.reset()
	token, err := createSession(a.db)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	secure := ""
	if a.cookieSecure {
		secure = "; Secure"
	}
	w.Header().Add("Set-Cookie", fmt.Sprintf("%s=%s; HttpOnly; Path=/; Max-Age=%d; SameSite=Lax%s",
		sessionCookie, token, sessionTTLS, secure))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) postLogout(w http.ResponseWriter, r *http.Request) {
	// 必须先认证：销毁会话的敏感操作不能让匿名请求踢管理员下线（审计 #5）
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	destroySession(a.db)
	w.Header().Add("Set-Cookie",
		sessionCookie+"=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) getAdminSession(w http.ResponseWriter, r *http.Request) {
	// 未登录也返回结构一致的 JSON，前端据此显示登录框
	if !a.isAuthed(r) {
		writeJSON(w, http.StatusOK, map[string]any{"authed": false, "notification": nil})
		return
	}
	type ntfyEcho struct {
		URL      string `json:"url"`
		Topic    string `json:"topic"`
		HasToken bool   `json:"has_token"`
	}
	var out struct {
		Authed       bool      `json:"authed"`
		Notification *ntfyEcho `json:"notification"`
	}
	out.Authed = true
	var raw string
	if err := a.db.QueryRow(
		`SELECT config_json FROM notifications WHERE type='ntfy' LIMIT 1`).Scan(&raw); err == nil {
		var v struct {
			URL   string `json:"url"`
			Topic string `json:"topic"`
			Token string `json:"token"`
		}
		if json.Unmarshal([]byte(raw), &v) == nil {
			out.Notification = &ntfyEcho{URL: v.URL, Topic: v.Topic, HasToken: v.Token != ""}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *app) putPassword(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	body, ok := decodeJSON[struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}](w, r)
	if !ok {
		return
	}
	if body == nil {
		badRequest(w, "invalid json")
		return
	}
	// 先验当前密码：会话被劫持时不能让攻击者顺手改密锁死管理员（审计 #15）
	if !verifyPassword(mustGetKv(a.db, "admin_password_hash"), body.CurrentPassword) {
		unauthorized(w)
		return
	}
	if len(body.NewPassword) < 8 {
		badRequest(w, "password too short (min 8)")
		return
	}
	hash, err := hashPassword(body.NewPassword)
	if err != nil {
		badRequest(w, "hash error")
		return
	}
	if setKvExec(a.db, "admin_password_hash", hash) != nil {
		badRequest(w, "db error")
		return
	}
	// 改密即注销现有会话并清 cookie，强制重新认证
	destroySession(a.db)
	w.Header().Add("Set-Cookie",
		sessionCookie+"=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ----- 站点设置（general：title/description）-----

// 更新 settings.general 的 title/description；其余字段原样保留。
func (a *app) putSettings(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	body, ok := decodeJSON[struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}](w, r)
	if !ok {
		return
	}
	if body == nil {
		badRequest(w, "invalid json")
		return
	}
	if len(body.Title) == 0 || len(body.Title) > 64 {
		badRequest(w, "title required (1-64 chars)")
		return
	}
	if len(body.Description) > 200 {
		badRequest(w, "description too long (max 200)")
		return
	}
	// 读旧值合并；解析失败则从空对象开始
	obj := map[string]any{}
	var raw string
	if err := a.db.QueryRow(`SELECT value_json FROM settings WHERE key='general'`).Scan(&raw); err == nil {
		var v map[string]any
		if json.Unmarshal([]byte(raw), &v) == nil {
			obj = v
		}
	}
	obj["title"] = body.Title
	obj["description"] = body.Description
	out, _ := json.Marshal(obj)
	if _, err := a.db.Exec(
		`INSERT INTO settings(key,value_json) VALUES('general',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json`,
		string(out)); err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ----- 通知（ntfy）配置 -----

func (a *app) putNotification(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	body, ok := decodeJSON[struct {
		URL   string  `json:"url"`
		Topic string  `json:"topic"`
		Token *string `json:"token"`
	}](w, r)
	if !ok {
		return
	}
	if body == nil {
		badRequest(w, "invalid json")
		return
	}
	if body.URL == "" || body.Topic == "" {
		badRequest(w, "url and topic required")
		return
	}
	token := ""
	if body.Token != nil {
		token = *body.Token
	}
	obj, _ := json.Marshal(struct {
		URL   string `json:"url"`
		Topic string `json:"topic"`
		Token string `json:"token"`
	}{body.URL, body.Topic, token})
	a.db.Exec(`DELETE FROM notifications WHERE type='ntfy'`)
	if _, err := a.db.Exec(
		`INSERT INTO notifications(type, config_json) VALUES('ntfy', ?)`, string(obj)); err != nil {
		badRequest(w, "db error")
		return
	}
	// 热刷引擎内的通知配置
	a.engine.setNtfyConfig(loadNtfyConfig(a.db))
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) deleteNotification(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	a.db.Exec(`DELETE FROM notifications WHERE type='ntfy'`)
	a.engine.setNtfyConfig(nil)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// postNotificationTest 用表单当前值真实发一条 ntfy 消息，不必先保存即可验证;
// token 留空时沿用已保存配置的 token（与保存的"留空保持不变"同语义）。
func (a *app) postNotificationTest(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	body, ok := decodeJSON[struct {
		URL   string  `json:"url"`
		Topic string  `json:"topic"`
		Token *string `json:"token"`
	}](w, r)
	if !ok {
		return
	}
	if body == nil {
		badRequest(w, "invalid json")
		return
	}
	if body.URL == "" || body.Topic == "" {
		badRequest(w, "url and topic required")
		return
	}
	saved := loadNtfyConfig(a.db)
	cfg := &ntfyConfig{ServerURL: body.URL, Topic: body.Topic, PriorityUp: 3, PriorityDown: 5}
	if body.Token != nil && *body.Token != "" {
		cfg.Token = *body.Token
	} else if saved != nil {
		cfg.Token = saved.Token
	}
	if err := sendNtfy(cfg, kindTest, "foyer", "收到这条消息说明 ntfy 通知配置有效"); err != nil {
		msg := shortErr(err)
		if errors.Is(err, errNtfyRejected) {
			msg = "ntfy rejected the message (check topic/token)"
		}
		errJSON(w, http.StatusBadGateway, msg)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ----- services / groups / bookmarks CRUD -----

func parseID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil
}

func (a *app) groupKindEq(id int64, expected string) bool {
	var kind string
	err := a.db.QueryRow(`SELECT kind FROM groups WHERE id=?`, id).Scan(&kind)
	return err == nil && kind == expected
}

type serviceIn struct {
	GroupID          int64   `json:"group_id"`
	Name             string  `json:"name"`
	Icon             *string `json:"icon"`
	Href             string  `json:"href"`
	Description      *string `json:"description"`
	MonitorEnabled   *bool   `json:"monitor_enabled"`
	MonitorIntervalS *int64  `json:"monitor_interval_s"`
	MonitorRetryMax  *int64  `json:"monitor_retry_max"`
}

func (b *serviceIn) applyDefaults() {
	if b.MonitorEnabled == nil {
		f := false
		b.MonitorEnabled = &f
	}
	if b.MonitorIntervalS == nil {
		v := int64(300)
		b.MonitorIntervalS = &v
	}
	if b.MonitorRetryMax == nil {
		v := int64(2)
		b.MonitorRetryMax = &v
	}
}

// POST/PUT 共用的入参校验。interval/retry 越界直接 400：这类值参与调度算术。
// href 仅放行 http(s)：链接会被面板页渲染成 <a href>，javascript: 等 schemes
// 会以存储型 XSS 面向所有访客执行。
func (b *serviceIn) validate() string {
	if len(b.Name) == 0 || len(b.Name) > 64 {
		return "name required (1-64 chars)"
	}
	if len(b.Href) == 0 || len(b.Href) > 2048 {
		return "href required (1-2048 chars)"
	}
	if !validHTTPHref(b.Href) {
		return "href must be http(s)"
	}
	if *b.MonitorIntervalS < monitorIntervalMinS || *b.MonitorIntervalS > monitorIntervalMaxS {
		return "monitor_interval_s out of range (30-86400)"
	}
	if *b.MonitorRetryMax < 0 || *b.MonitorRetryMax > monitorRetryMaxLim {
		return "monitor_retry_max out of range (0-10)"
	}
	return ""
}

func validHTTPHref(h string) bool {
	return strings.HasPrefix(h, "http://") || strings.HasPrefix(h, "https://")
}

type bookmarkIn struct {
	GroupID int64   `json:"group_id"`
	Name    string  `json:"name"`
	Icon    *string `json:"icon"`
	Href    *string `json:"href"`
}

func (b *bookmarkIn) validate() string {
	if len(b.Name) == 0 || len(b.Name) > 64 {
		return "name required (1-64 chars)"
	}
	if b.Href == nil || len(*b.Href) == 0 || len(*b.Href) > 2048 {
		return "href required (1-2048 chars)"
	}
	if !validHTTPHref(*b.Href) {
		return "href must be http(s)"
	}
	return ""
}

func (a *app) postService(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	b, ok := decodeJSON[serviceIn](w, r)
	if !ok {
		return
	}
	if b == nil {
		badRequest(w, "invalid json")
		return
	}
	b.applyDefaults()
	if msg := b.validate(); msg != "" {
		badRequest(w, msg)
		return
	}
	if !a.groupKindEq(b.GroupID, "service") {
		badRequest(w, "group must be a service group")
		return
	}
	// RETURNING 取 id：共享连接上 last_insert_rowid 会与并发 INSERT（含监控
	// 心跳写入）竞态串号，单语句内取值无窗口（审计 #10）
	var id int64
	err := a.db.QueryRow(`
INSERT INTO services(group_id,name,icon,href,description,sort,monitor_enabled,monitor_interval_s,monitor_retry_max)
VALUES(?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM services WHERE group_id=?),?,?,?) RETURNING id`,
		b.GroupID, b.Name, b.Icon, b.Href, b.Description, b.GroupID,
		*b.MonitorEnabled, *b.MonitorIntervalS, *b.MonitorRetryMax).Scan(&id)
	if err != nil {
		badRequest(w, "db error")
		return
	}
	a.engine.Sync() // 新服务进入探测
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (a *app) putService(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	id, ok := parseID(r)
	if !ok {
		badRequest(w, "bad id")
		return
	}
	b, ok2 := decodeJSON[serviceIn](w, r)
	if !ok2 {
		return
	}
	if b == nil {
		badRequest(w, "invalid json")
		return
	}
	b.applyDefaults()
	if msg := b.validate(); msg != "" {
		badRequest(w, msg)
		return
	}
	if !a.groupKindEq(b.GroupID, "service") {
		badRequest(w, "group must be a service group")
		return
	}
	if _, err := a.db.Exec(`
UPDATE services SET group_id=?,name=?,icon=?,href=?,description=?,
monitor_enabled=?,monitor_interval_s=?,monitor_retry_max=? WHERE id=?`,
		b.GroupID, b.Name, b.Icon, b.Href, b.Description,
		*b.MonitorEnabled, *b.MonitorIntervalS, *b.MonitorRetryMax, id); err != nil {
		badRequest(w, "db error")
		return
	}
	a.engine.Sync() // 周期/启停变化即时对账
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) deleteService(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	id, ok := parseID(r)
	if !ok {
		badRequest(w, "bad id")
		return
	}
	// 心跳/incident 由外键级联清理
	if _, err := a.db.Exec(`DELETE FROM services WHERE id=?`, id); err != nil {
		badRequest(w, "db error")
		return
	}
	a.engine.Sync() // 停掉该服务的探测循环
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// columns 越界直接 400(坏输入响亮失败,不静默按默认处理)
func validateColumns(c *int64) string {
	if c == nil {
		return ""
	}
	if *c < 1 || *c > 8 {
		return "columns out of range (1-8)"
	}
	return ""
}

func (a *app) postGroup(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	b, ok := decodeJSON[struct {
		Name      string `json:"name"`
		Kind      string `json:"kind"`
		Columns   *int64 `json:"columns"`
		IconsOnly bool   `json:"icons_only"`
	}](w, r)
	if !ok {
		return
	}
	if b == nil {
		badRequest(w, "invalid json")
		return
	}
	if len(b.Name) == 0 || len(b.Name) > 64 {
		badRequest(w, "name required (1-64 chars)")
		return
	}
	if msg := validateColumns(b.Columns); msg != "" {
		badRequest(w, msg)
		return
	}
	if b.Kind == "" {
		b.Kind = "service"
	}
	if b.Kind != "service" && b.Kind != "bookmark" {
		badRequest(w, "kind must be service|bookmark")
		return
	}
	var id int64
	err := a.db.QueryRow(
		`INSERT INTO groups(kind,name,columns,icons_only,sort) VALUES(?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM groups)) RETURNING id`,
		b.Kind, b.Name, b.Columns, b.IconsOnly).Scan(&id)
	if err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (a *app) putGroup(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	id, ok := parseID(r)
	if !ok {
		badRequest(w, "bad id")
		return
	}
	b, ok2 := decodeJSON[struct {
		Name      string `json:"name"`
		Columns   *int64 `json:"columns"`
		IconsOnly bool   `json:"icons_only"`
	}](w, r)
	if !ok2 {
		return
	}
	if b == nil {
		badRequest(w, "invalid json")
		return
	}
	if len(b.Name) == 0 || len(b.Name) > 64 {
		badRequest(w, "name required (1-64 chars)")
		return
	}
	if msg := validateColumns(b.Columns); msg != "" {
		badRequest(w, msg)
		return
	}
	if _, err := a.db.Exec(
		`UPDATE groups SET name=?, columns=?, icons_only=? WHERE id=?`,
		b.Name, b.Columns, b.IconsOnly, id); err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) deleteGroup(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	id, ok := parseID(r)
	if !ok {
		badRequest(w, "bad id")
		return
	}
	// 组内仍有内容时拒绝（409），防误删整组服务
	var cnt int64
	a.db.QueryRow(
		`SELECT (SELECT COUNT(*) FROM services WHERE group_id=?) + (SELECT COUNT(*) FROM bookmarks WHERE group_id=?)`,
		id, id).Scan(&cnt)
	if cnt > 0 {
		errJSON(w, http.StatusConflict, "group not empty")
		return
	}
	if _, err := a.db.Exec(`DELETE FROM groups WHERE id=?`, id); err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) postBookmark(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	b, ok := decodeJSON[bookmarkIn](w, r)
	if !ok {
		return
	}
	if b == nil {
		badRequest(w, "invalid json")
		return
	}
	if msg := b.validate(); msg != "" {
		badRequest(w, msg)
		return
	}
	if !a.groupKindEq(b.GroupID, "bookmark") {
		badRequest(w, "group must be a bookmark group")
		return
	}
	var id int64
	err := a.db.QueryRow(`
INSERT INTO bookmarks(group_id,name,icon,href,sort)
VALUES(?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM bookmarks WHERE group_id=?)) RETURNING id`,
		b.GroupID, b.Name, b.Icon, *b.Href, b.GroupID).Scan(&id)
	if err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": id})
}

func (a *app) putBookmark(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	id, ok := parseID(r)
	if !ok {
		badRequest(w, "bad id")
		return
	}
	b, ok2 := decodeJSON[bookmarkIn](w, r)
	if !ok2 {
		return
	}
	if b == nil {
		badRequest(w, "invalid json")
		return
	}
	if msg := b.validate(); msg != "" {
		badRequest(w, msg)
		return
	}
	if !a.groupKindEq(b.GroupID, "bookmark") {
		badRequest(w, "group must be a bookmark group")
		return
	}
	if _, err := a.db.Exec(
		`UPDATE bookmarks SET group_id=?,name=?,icon=?,href=? WHERE id=?`,
		b.GroupID, b.Name, b.Icon, *b.Href, id); err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *app) deleteBookmark(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	id, ok := parseID(r)
	if !ok {
		badRequest(w, "bad id")
		return
	}
	if _, err := a.db.Exec(`DELETE FROM bookmarks WHERE id=?`, id); err != nil {
		badRequest(w, "db error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// ===== JSON 工具 =====

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=UTF-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func errJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"ok": false, "error": msg})
}

func badRequest(w http.ResponseWriter, msg string) { errJSON(w, http.StatusBadRequest, msg) }

func unauthorized(w http.ResponseWriter) { errJSON(w, http.StatusUnauthorized, "unauthorized") }

// decodeJSON 解析请求体：空体 → (nil, true)；解析失败 → 500(与 Zig 版同口径)，
// 由调用方决定 nil 的语义（login 是 401，其余是 400 "invalid json"）。
func decodeJSON[T any](w http.ResponseWriter, r *http.Request) (*T, bool) {
	var v T
	err := json.NewDecoder(r.Body).Decode(&v)
	if err == nil {
		return &v, true
	}
	if errors.Is(err, io.EOF) {
		return nil, true
	}
	http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	return nil, false
}

// mustGetKv 取 kv 值，缺行返回空串（无哈希时任何密码都验不过）。
func mustGetKv(db *sql.DB, key string) string {
	v, _ := getKv(db, key)
	return v
}

// setKvExec 与 setKv 同 SQL，但回传错误供管理端点映射 "db error"。
func setKvExec(db *sql.DB, key, value string) error {
	_, err := db.Exec(
		`INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, value)
	return err
}
