-- Shards 2 to 9: chatze-hub-users-0 through chatze-hub-users-7
-- Sharded user accounts using consistent hashing on google_sub

CREATE TABLE IF NOT EXISTS users (
  google_sub TEXT PRIMARY KEY,               -- Google Unique Subject ID (e.g. "109823472918237")
  email TEXT UNIQUE NOT NULL,                -- User's verified Google email
  display_name TEXT NOT NULL,                -- Full name from Google
  avatar_url TEXT,                           -- Profile picture from Google
  
  -- Sovereign Node Link (if consumer later self-deploys their own Chatze instance)
  sovereign_node_url TEXT,                   -- e.g. "https://bikash.pages.dev"
  sovereign_handle TEXT,                     -- e.g. "@bikash"
  sovereign_verified_at INTEGER,             -- Timestamp when Hub pinged sovereign node health
  
  role TEXT DEFAULT 'customer',              -- 'customer', 'merchant', 'admin'
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_sovereign ON users(sovereign_node_url);
