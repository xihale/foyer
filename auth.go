package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/argon2"
)

// 认证：首启随机密码 + argon2id PHC 存储 + 单用户会话 cookie。
// - 随机密码只在首次生成时打印一次到日志，之后库里只有哈希
// - 会话 token 存 kv 表（单管理员，重启后仍有效）
// - token 比较走 timing-safe，防时序侧信道

const (
	sessionCookie = "foyer_session"
	sessionTTLS   = int64(7 * 24 * 3600)
	// 与 Zig std owasp_2id 完全一致的参数，保证两版哈希互验
	argon2Time    = uint32(2)
	argon2Memory  = uint32(19 * 1024) // KiB
	argon2Threads = uint8(1)
	argon2SaltLen = 32
	argon2KeyLen  = uint32(32)
)

func getKv(db *sql.DB, key string) (string, bool) {
	var v string
	err := db.QueryRow(`SELECT value FROM kv WHERE key = ?`, key).Scan(&v)
	if err != nil {
		return "", false
	}
	return v, true
}

func setKv(db *sql.DB, key, value string) {
	db.Exec(`INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, value)
}

// generatePassword 生成 18 字节熵的 URL 安全随机密码（base64url 无填充，24 字符）。
func generatePassword() string {
	raw := make([]byte, 18)
	if _, err := rand.Read(raw); err != nil {
		panic(err) // crypto/rand 失败属不可恢复环境问题
	}
	return base64.RawURLEncoding.EncodeToString(raw)
}

// hashPassword 产出 PHC 串：$argon2id$v=19$m=19456,t=2,p=1$<b64 salt>$<b64 hash>
// PHC 规范要求标准字母表、无填充——与 Zig std 的 strHash 逐字节同格式。
func hashPassword(password string) (string, error) {
	salt := make([]byte, argon2SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, argon2Time, argon2Memory, argon2Threads, argon2KeyLen)
	b64 := base64.StdEncoding.WithPadding(base64.NoPadding)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		0x13, argon2Memory, argon2Time, argon2Threads,
		b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// verifyPassword 校验 PHC 串（兼容 Zig 版生成的哈希）。
func verifyPassword(phc, password string) bool {
	p, err := parsePHC(phc)
	if err != nil {
		return false
	}
	key := argon2.IDKey([]byte(password), p.salt, p.time, p.memory, p.threads, uint32(len(p.hash)))
	return subtle.ConstantTimeCompare(key, p.hash) == 1
}

type phcParams struct {
	salt, hash   []byte
	time, memory uint32
	threads      uint8
}

func parsePHC(s string) (phcParams, error) {
	parts := strings.Split(s, "$")
	// ["", "argon2id", "v=19", "m=19456,t=2,p=1", "<salt>", "<hash>"]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return phcParams{}, fmt.Errorf("bad phc")
	}
	b64 := base64.StdEncoding.WithPadding(base64.NoPadding)
	var p phcParams
	for _, kv := range strings.Split(parts[3], ",") {
		k, v, ok := strings.Cut(kv, "=")
		if !ok {
			return phcParams{}, fmt.Errorf("bad phc param")
		}
		var n uint64
		var err error
		switch k {
		case "m", "t", "p":
			if _, err = fmt.Sscanf(v, "%d", &n); err != nil {
				return phcParams{}, err
			}
		}
		switch k {
		case "m":
			p.memory = uint32(n)
		case "t":
			p.time = uint32(n)
		case "p":
			p.threads = uint8(n)
		}
	}
	var err error
	if p.salt, err = b64.DecodeString(parts[4]); err != nil {
		return phcParams{}, err
	}
	if p.hash, err = b64.DecodeString(parts[5]); err != nil {
		return phcParams{}, err
	}
	return p, nil
}

// ensureAdmin 首启初始化：kv 无 admin_password_hash 时生成随机密码、哈希入库、打印一次。
func ensureAdmin(db *sql.DB) {
	if _, ok := getKv(db, "admin_password_hash"); ok {
		return
	}
	password := generatePassword()
	hash, err := hashPassword(password)
	if err != nil {
		return
	}
	setKv(db, "admin_password_hash", hash)
	fmt.Printf(`
==============================================
 foyer 初始管理员密码（仅显示这一次，请妥善保存）：

     %s

 登录后可在管理页修改。重启不会再次显示。
==============================================
`, password)
}

// createSession 生成 32 字节随机 token（hex 64），连同过期时间写入 kv。
func createSession(db *sql.DB) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := hex.EncodeToString(raw)
	setKv(db, "session_token", token)
	setKv(db, "session_expires", fmt.Sprintf("%d", time.Now().Unix()+sessionTTLS))
	return token, nil
}

// destroySession 注销会话。
func destroySession(db *sql.DB) {
	db.Exec(`DELETE FROM kv WHERE key IN ('session_token','session_expires')`)
}

// sessionValid timing-safe 校验请求携带的会话 token 与有效期（token 固定 64 hex 字符）。
func sessionValid(db *sql.DB, cookieToken string) bool {
	if len(cookieToken) != 64 {
		return false
	}
	stored, ok := getKv(db, "session_token")
	if !ok || len(stored) != 64 {
		return false
	}
	if subtle.ConstantTimeCompare([]byte(cookieToken), []byte(stored)) != 1 {
		return false
	}
	expStr, ok := getKv(db, "session_expires")
	if !ok {
		return false
	}
	var expires int64
	if _, err := fmt.Sscanf(expStr, "%d", &expires); err != nil {
		return false
	}
	return time.Now().Unix() < expires
}

// loginLimiter 登录失败限速：连续 failMax 次失败后锁定 lockS 秒。
// argon2 慢哈希是第一道节流，这里是第二道封顶（审计 #7）。
type loginLimiter struct {
	fails       atomic.Uint32
	lockedUntil atomic.Int64 // unix sec，0=未锁
}

const (
	limiterFailMax = uint32(10)
	limiterLockS   = int64(15 * 60)
)

func (l *loginLimiter) locked(now int64) bool { return now < l.lockedUntil.Load() }

func (l *loginLimiter) recordFailure(now int64) {
	if n := l.fails.Add(1); n >= limiterFailMax {
		l.fails.Store(0)
		l.lockedUntil.Store(now + limiterLockS)
	}
}

func (l *loginLimiter) reset() { l.fails.Store(0) }
