package main

import (
	"database/sql"
	_ "embed"
	"fmt"
	"os"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

// openDB 打开 data/foyer.db 并应用 schema。
// PRAGMA 经 DSN 下发：modernc 对池内每个连接都生效（synchronous/foreign_keys 是连接级的）。
func openDB() (*sql.DB, error) {
	if err := os.MkdirAll("data", 0o755); err != nil {
		return nil, err
	}
	// 图标运行时存储：不进二进制，由上传/后台下载落盘
	if err := os.MkdirAll("data/icons", 0o755); err != nil {
		return nil, err
	}
	dsn := "file:data/foyer.db" +
		"?_pragma=journal_mode(WAL)" +
		"&_pragma=synchronous(NORMAL)" +
		"&_pragma=foreign_keys(1)" +
		"&_pragma=busy_timeout(5000)" +
		"&_pragma=cache_size(-512)" // 每连接 512KiB 页缓存（缺省 2MB），读负载无感
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// 连接数不设上限：getConfig/getStatus 是嵌套查询（外层 rows 未关时循环内再发
	// 查询），池子必须允许 ≥2 并发连接，设 1 会自锁死——已在线上验证过这个教训
	// 心跳这类高频小写在 WAL+NORMAL 下显著降同步开销；schema 全部 IF NOT EXISTS 可幂等执行
	if _, err := db.Exec(schemaSQL); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return db, nil
}
