-- ==============================================================================
-- Chatze Hub Unified Database Schema (Cloudflare D1)
-- Zero-Config Single Database Mode: Houses Config, Public Directory & Users
-- ==============================================================================

-- 1. System Config & Rate Limiting
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

-- 2. Public Directory of Verified Sovereign Stores
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  handle TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  bio TEXT,
  logo_url TEXT,
  banner_url TEXT,
  phone_whatsapp_optional TEXT,
  tags TEXT,
  letterbox_embed_url TEXT NOT NULL,
  owner_google_sub TEXT,
  verification_status TEXT DEFAULT 'verified',
  verified_tier TEXT DEFAULT 'tier1_origin',
  public_key TEXT,
  view_count INTEGER DEFAULT 0,
  inquiry_clicks INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_city ON merchants(city);
CREATE INDEX IF NOT EXISTS idx_merchants_handle ON merchants(handle);
CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants(owner_google_sub);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(verification_status);

-- 3. Consumer User Profiles (Google OAuth Identity)
CREATE TABLE IF NOT EXISTS users (
  google_sub TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  sovereign_node_url TEXT,
  sovereign_handle TEXT,
  sovereign_verified_at INTEGER,
  role TEXT DEFAULT 'customer',
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_sovereign ON users(sovereign_node_url);

-- System Config
INSERT OR IGNORE INTO hub_config (key, value, updated_at) VALUES 
('system_status', 'operational', 1700000000),
('min_version', '1.0.0', 1700000000),
('featured_city', 'Kathmandu', 1700000000);

-- Purge any previous dummy seed merchants from existing database deployments
DELETE FROM merchants WHERE id IN ('m_kathmandu_crafts', 'm_himalayan_pashmina', 'm_pokhara_trekking') OR owner_google_sub LIKE 'demo_%';
