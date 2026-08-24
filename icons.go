package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// 图标：运行时磁盘存储（data/icons/），上传/favicon 抓取/删除走 API。

const iconMaxBytes = 2 << 20 // 2 MiB

// validIconName 拒目录穿越与隐藏文件：非空、≤64、首字符非 '.'、限 [A-Za-z0-9._-]。
func validIconName(name string) bool {
	if name == "" || len(name) > 64 || name[0] == '.' {
		return false
	}
	for i := 0; i < len(name); i++ {
		c := name[i]
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' ||
			c == '.' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}

// looksLikeImage 认魔数、拒 HTML 错误页。
func looksLikeImage(data []byte) bool {
	if len(data) >= 4 && string(data[:4]) == "\x89PNG" {
		return true
	}
	if len(data) >= 4 && string(data[:4]) == "GIF8" {
		return true
	}
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return true
	}
	if len(data) >= 4 && data[0] == 0 && data[1] == 0 && data[2] == 1 && data[3] == 0 { // ICO
		return true
	}
	if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return true
	}
	if len(data) > 14 && data[0] == 'B' && data[1] == 'M' { // BMP
		return true
	}
	// SVG 是文本：前 512 字节内出现 <svg 即认
	scan := data
	if len(scan) > 512 {
		scan = scan[:512]
	}
	return strings.Contains(string(scan), "<svg")
}

var iconCtypes = map[string]string{
	".svg":  "image/svg+xml",
	".png":  "image/png",
	".ico":  "image/x-icon",
	".webp": "image/webp",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".gif":  "image/gif",
	".bmp":  "image/bmp",
}

func iconCtype(name string) string {
	if ct, ok := iconCtypes[path.Ext(name)]; ok {
		return ct
	}
	return "application/octet-stream"
}

// serveDiskIcon GET/HEAD /icons/<name>：ETag "size-mtime_ns"，带 ?v= 才长缓存。
// CSP 收紧：用户可控 SVG 的缓解。
func (a *app) serveDiskIcon(w http.ResponseWriter, r *http.Request, name string) {
	if !validIconName(name) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	fp := filepath.Join("data", "icons", name)
	st, err := os.Stat(fp)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	etag := fmt.Sprintf(`"%d-%d"`, st.Size(), st.ModTime().UnixNano())
	w.Header().Set("Etag", etag)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy",
		"default-src 'none'; style-src 'unsafe-inline'; img-src data:")
	if inm := r.Header.Get("If-None-Match"); inm == "*" || strings.Contains(inm, etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	if st.Size() > iconMaxBytes {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	data, err := os.ReadFile(fp)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if r.URL.Query().Has("v") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	w.Header().Set("Content-Type", iconCtype(name))
	w.Write(data)
}

// versionedIcon /api/config 用：/icons/ 前缀且名字合法时追加 ?v=<mtime_ns>，其余原样。
func versionedIcon(icon string) string {
	if !strings.HasPrefix(icon, "/icons/") {
		return icon
	}
	name := strings.TrimPrefix(icon, "/icons/")
	if i := strings.IndexByte(name, '?'); i >= 0 {
		name = name[:i]
	}
	if !validIconName(name) {
		return icon
	}
	st, err := os.Stat(filepath.Join("data", "icons", name))
	if err != nil {
		return icon
	}
	return "/icons/" + name + "?v=" + fmt.Sprintf("%d", st.ModTime().UnixNano())
}

// postIcon multipart 上传：file 必填、name 可选（无扩展名时继承 file 的扩展名）。
func (a *app) postIcon(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	// 与 Zig 版同口径：4 MiB 体、8 个 part，超出按解析失败 400
	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		badRequest(w, "invalid multipart form")
		return
	}
	var fileData []byte
	var fileName, customName string
	parts := 0
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil || parts >= 8 {
			badRequest(w, "invalid multipart form")
			return
		}
		parts++
		if part.FormName() == "file" {
			// 2 MiB + 1 哨兵：恰好 2 MiB 的读满后过下面的 > 校验报 400
			data, err := io.ReadAll(io.LimitReader(part, iconMaxBytes+1))
			if err != nil {
				badRequest(w, "invalid multipart form")
				return
			}
			fileData = data
			fileName = filepath.ToSlash(filepath.Base(part.FileName()))
		} else if part.FormName() == "name" {
			data, _ := io.ReadAll(io.LimitReader(part, 256))
			customName = strings.TrimSpace(string(data))
		} else {
			io.Copy(io.Discard, part)
		}
		part.Close()
	}
	if fileData == nil {
		badRequest(w, "file required")
		return
	}
	if len(fileData) == 0 {
		badRequest(w, "empty file")
		return
	}
	if len(fileData) > iconMaxBytes {
		badRequest(w, "icon too large (max 2 MiB)")
		return
	}
	if !looksLikeImage(fileData) {
		badRequest(w, "not a recognized image format")
		return
	}
	name := customName
	if name == "" {
		name = fileName
	} else if !strings.Contains(name, ".") {
		// 自定义名无扩展名且原文件名扩展合法 → 继承
		ext := path.Ext(fileName)
		if len(ext) > 1 {
			name += ext
		}
	}
	if !validIconName(name) {
		badRequest(w, "invalid name (a-z 0-9 . _ -)")
		return
	}
	if err := os.WriteFile(filepath.Join("data", "icons", name), fileData, 0o644); err != nil {
		badRequest(w, "write failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name})
}

// postIconFetch 服务端代抓 favicon。
func (a *app) postIconFetch(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	var in struct {
		URL  *string `json:"url"`
		Name *string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		badRequest(w, "invalid json")
		return
	}
	if in.URL == nil || in.Name == nil || *in.URL == "" || *in.Name == "" {
		badRequest(w, "url and name required")
		return
	}
	rawURL, name := *in.URL, *in.Name
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		badRequest(w, "url must be http(s)")
		return
	}
	// name 无扩展名 → 借 URL path 末段扩展（2-8 位字母数字），否则默认 .png
	if !strings.Contains(name, ".") {
		u := rawURL
		if i := strings.IndexByte(u, '?'); i >= 0 {
			u = u[:i]
		}
		ext := strings.ToLower(path.Ext(u))
		if len(ext) < 2 || len(ext) > 8 || !isAlnum(ext[1:]) {
			ext = ".png"
		}
		name += ext
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		badRequest(w, "download failed: "+shortErr(err))
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		badRequest(w, fmt.Sprintf("download failed: HTTP %d", resp.StatusCode))
		return
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, iconMaxBytes+1))
	if err != nil {
		badRequest(w, "download failed: "+shortErr(err))
		return
	}
	if len(data) == 0 {
		badRequest(w, "empty response")
		return
	}
	if len(data) > iconMaxBytes {
		badRequest(w, "icon too large (max 2 MiB)")
		return
	}
	if !looksLikeImage(data) {
		badRequest(w, "not a recognized image format")
		return
	}
	if !validIconName(name) {
		badRequest(w, "invalid name (a-z 0-9 . _ -)")
		return
	}
	if err := os.WriteFile(filepath.Join("data", "icons", name), data, 0o644); err != nil {
		badRequest(w, "write failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": name})
}

func (a *app) deleteIcon(w http.ResponseWriter, r *http.Request) {
	if !a.isAuthed(r) {
		unauthorized(w)
		return
	}
	name := r.PathValue("name")
	if !validIconName(name) {
		badRequest(w, "invalid name (a-z 0-9 . _ -)")
		return
	}
	err := os.Remove(filepath.Join("data", "icons", name))
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	case os.IsNotExist(err):
		errJSON(w, http.StatusNotFound, "icon not found")
	default:
		badRequest(w, "delete failed")
	}
}

func isAlnum(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9') {
			return false
		}
	}
	return len(s) > 0
}
