package main

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// Zig std (owasp_2id) 生成参数——兼容性的锚点
const zigGeneratedPHC = "$argon2id$v=19$m=19456,t=2,p=1$ed0e7GV0tNQpnXGzODHAtxYRqryQUfihnC7uLN59lp8$SNCENpnpfZH34FVEpLwOKvEHrNOTA2mK+XyfGOAbGEY"

func TestParsePHCZigFormat(t *testing.T) {
	p, err := parsePHC(zigGeneratedPHC)
	if err != nil {
		t.Fatalf("parse zig-generated hash: %v", err)
	}
	if p.memory != 19456 || p.time != 2 || p.threads != 1 {
		t.Fatalf("params = m%d,t%d,p%d, want m19456,t2,p1", p.memory, p.time, p.threads)
	}
	if len(p.salt) != 32 || len(p.hash) != 32 {
		t.Fatalf("salt/hash len = %d/%d, want 32/32", len(p.salt), len(p.hash))
	}
}

func TestPasswordRoundtrip(t *testing.T) {
	hash, err := hashPassword("correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("unexpected prefix: %s", hash[:40])
	}
	if !verifyPassword(hash, "correct horse battery staple") {
		t.Fatal("verify with right password failed")
	}
	if verifyPassword(hash, "wrong password") {
		t.Fatal("verify with wrong password passed")
	}
	if verifyPassword("garbage", "x") {
		t.Fatal("garbage phc verified")
	}
}

func TestGeneratePasswordShape(t *testing.T) {
	pw := generatePassword()
	if len(pw) != 24 { // 18 字节 → base64url 无填充 24 字符
		t.Fatalf("len=%d want 24", len(pw))
	}
}

func TestLoginLimiter(t *testing.T) {
	var l loginLimiter
	t0 := int64(1_000_000)
	if l.locked(t0) {
		t.Fatal("fresh limiter locked")
	}
	for i := 0; i < int(limiterFailMax)-1; i++ {
		l.recordFailure(t0)
	}
	if l.locked(t0) { // 满 fail_max 次之前不锁
		t.Fatal("locked before max failures")
	}
	l.recordFailure(t0) // 第 fail_max 次：锁定
	if !l.locked(t0+1) || !l.locked(t0+limiterLockS-1) {
		t.Fatal("should be locked")
	}
	if l.locked(t0 + limiterLockS) { // 到期释放
		t.Fatal("should unlock after lock_s")
	}
	l.recordFailure(t0 + limiterLockS)
	l.reset() // 成功登录清零
	for i := 0; i < int(limiterFailMax)-1; i++ {
		l.recordFailure(t0 + limiterLockS + 10)
	}
	if l.locked(t0 + limiterLockS + 11) {
		t.Fatal("reset failed")
	}
}

func TestValidIconName(t *testing.T) {
	ok := []string{"freshrss.png", "a-b_C.9"}
	bad := []string{"", "../etc/passwd", "..", ".hidden", "a/b.png", `a\b.png`, "with space.png",
		strings.Repeat("x", 65)}
	for _, s := range ok {
		if !validIconName(s) {
			t.Errorf("validIconName(%q) = false, want true", s)
		}
	}
	for _, s := range bad {
		if validIconName(s) {
			t.Errorf("validIconName(%q) = true, want false", s)
		}
	}
}

func TestLooksLikeImage(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		want bool
	}{
		{"png", []byte{0x89, 'P', 'N', 'G', 0, 0, 0, 0}, true},
		{"gif", append([]byte("GIF89a"), make([]byte, 10)...), true},
		{"jpeg", []byte{0xff, 0xd8, 0xff, 0xe0}, true},
		{"ico", []byte{0, 0, 1, 0, 4}, true},
		{"webp", append([]byte("RIFF\x00\x00\x00\x00WEBP"), make([]byte, 8)...), true},
		{"bmp", append([]byte("BM"), make([]byte, 20)...), true},
		{"svg", []byte("  \n<?xml?><svg xmlns="), true},
		{"html", []byte("<html><body>not an image</body></html>"), false},
		{"empty", nil, false},
	}
	for _, c := range cases {
		if got := looksLikeImage(c.data); got != c.want {
			t.Errorf("looksLikeImage(%s) = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestShortErr(t *testing.T) {
	cases := map[string]string{
		`Get "https://x.cc": dial tcp: lookup x.cc: no such host`:                                    "UnknownHostName",
		`Get "http://x": dial tcp 127.0.0.1:80: connect: connection refused`:                         "ConnectionRefused",
		`Get "http://x": context deadline exceeded (Client.Timeout exceeded while awaiting headers)`: "Timeout",
		`Get "http://x": read: connection reset by peer`:                                             "ConnectionResetByPeer",
		`Get "http://x": tls: failed to verify certificate`:                                          "TlsInitializationFailed",
		`something odd`: "RequestFailed",
	}
	for in, want := range cases {
		if got := shortErr(errString(in)); got != want {
			t.Errorf("shortErr(%q) = %s, want %s", in, got, want)
		}
	}
}

type errString string

func (e errString) Error() string { return string(e) }

func TestVersionedIcon(t *testing.T) {
	t.Chdir(t.TempDir())
	os.MkdirAll("data/icons", 0o755)
	os.WriteFile("data/icons/foo.png", []byte("x"), 0o644)
	st, _ := os.Stat(filepath.Join("data", "icons", "foo.png"))
	want := "/icons/foo.png?v=" + strconv.FormatInt(st.ModTime().UnixNano(), 10)
	if got := versionedIcon("/icons/foo.png?v=1"); got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	if got := versionedIcon("/icons/missing.png"); got != "/icons/missing.png" {
		t.Fatalf("missing icon should pass through, got %q", got)
	}
	if got := versionedIcon("https://x.cc/i.png?v=1"); got != "https://x.cc/i.png?v=1" {
		t.Fatalf("non-icon url should pass through, got %q", got)
	}
}
