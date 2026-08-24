CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('service','bookmark')),
  name       TEXT NOT NULL,
  style      TEXT DEFAULT 'grid',
  columns    INTEGER DEFAULT 4,
  icons_only INTEGER NOT NULL DEFAULT 0,
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id                 INTEGER PRIMARY KEY,
  group_id           INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  icon               TEXT,
  href               TEXT NOT NULL,
  description        TEXT,
  sort               INTEGER NOT NULL DEFAULT 0,
  monitor_enabled    INTEGER NOT NULL DEFAULT 0,
  monitor_interval_s INTEGER NOT NULL DEFAULT 300,
  monitor_retry_max  INTEGER NOT NULL DEFAULT 2
);
CREATE INDEX IF NOT EXISTS idx_services_group ON services(group_id, sort);

CREATE TABLE IF NOT EXISTS bookmarks (
  id       INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  icon     TEXT,
  href     TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_group ON bookmarks(group_id, sort);

CREATE TABLE IF NOT EXISTS heartbeats (
  id         INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  ts         INTEGER NOT NULL,
  status     INTEGER NOT NULL,
  latency_ms INTEGER,
  message    TEXT
);
CREATE INDEX IF NOT EXISTS idx_hb_service_ts ON heartbeats(service_id, ts);
-- 滚动清理 DELETE ... WHERE ts < ? 走的时间索引（service_id 打头的索引用不上）
CREATE INDEX IF NOT EXISTS idx_hb_ts ON heartbeats(ts);

CREATE TABLE IF NOT EXISTS incidents (
  id         INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,
  message    TEXT
);
CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service_id, started_at);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_default  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
