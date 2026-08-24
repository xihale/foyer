package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// ntfy 通知：配置存 notifications 表（type='ntfy'），引擎翻转时推送。

type ntfyConfig struct {
	ServerURL    string `json:"url"`
	Topic        string `json:"topic"`
	Token        string `json:"token"`
	PriorityUp   int64  `json:"priority_up"`
	PriorityDown int64  `json:"priority_down"`
}

// notifyClient 推送专用：10s 超时（Zig 版 fetch 无超时，靠内核 TCP 兜底——这里是顺手修复）。
var notifyClient = &http.Client{Timeout: 10 * time.Second}

// loadNtfyConfig 从库读配置；无行返回 nil。priority_up/down 可缺省（3/5）。
func loadNtfyConfig(db *sql.DB) *ntfyConfig {
	var raw string
	err := db.QueryRow(`SELECT config_json FROM notifications WHERE type = 'ntfy' LIMIT 1`).Scan(&raw)
	if err != nil {
		return nil
	}
	cfg := &ntfyConfig{PriorityUp: 3, PriorityDown: 5}
	if err := json.Unmarshal([]byte(raw), cfg); err != nil {
		return nil
	}
	return cfg
}

type eventKind int

const (
	kindUp eventKind = iota
	kindDown
	kindTest
)

var kindLabel = map[eventKind]string{kindUp: "UP", kindDown: "DOWN", kindTest: "TEST"}

// sendNtfy POST {url}/{topic}，标题 X-Title，优先级 X-Priority，token 时带 Bearer。
// 非 2xx → errNtfyRejected（前端有对应文案）。
var errNtfyRejected = fmt.Errorf("ntfy rejected the message")

func sendNtfy(cfg *ntfyConfig, kind eventKind, serviceName, detail string) error {
	prio := int64(3)
	switch kind {
	case kindUp:
		prio = cfg.PriorityUp
	case kindDown:
		prio = cfg.PriorityDown
	}
	req, err := http.NewRequest(http.MethodPost, cfg.ServerURL+"/"+cfg.Topic,
		bytes.NewReader([]byte(detail)))
	if err != nil {
		return err
	}
	req.Header.Set("X-Title", kindLabel[kind]+" · "+serviceName)
	req.Header.Set("X-Priority", strconv.FormatInt(prio, 10))
	if cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	resp, err := notifyClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return errNtfyRejected
	}
	return nil
}
