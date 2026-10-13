-- Shard 0: chatze-hub-meta
-- System configuration, rate limiting, and administrative audit trails

CREATE TABLE IF NOT EXISTS hub_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ip_rate_limits (
  ip_address TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocked_domains (
  domain TEXT PRIMARY KEY,
  reason TEXT,
  blocked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);

-- Initial seed values for Meta Shard
INSERT OR IGNORE INTO hub_config (key, value, updated_at) VALUES 
('system_status', 'operational', 1700000000),
('min_version', '1.0.0', 1700000000),
('featured_city', 'Kathmandu', 1700000000);
