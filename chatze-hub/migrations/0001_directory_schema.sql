-- Shard 1: chatze-hub-directory
-- Public Directory of Verified Sovereign Stores and Embed URLs

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,                       -- e.g. "m_ram_crafts"
  handle TEXT UNIQUE NOT NULL,               -- e.g. "@ramcrafts"
  business_name TEXT NOT NULL,               -- e.g. "Kathmandu Wood & Crafts"
  category TEXT NOT NULL,                    -- "Handicrafts", "Clothing", "Electronics", "Food"
  city TEXT NOT NULL,                        -- "Kathmandu", "Pokhara", "Lalitpur", "Biratnagar", etc.
  address TEXT,                              -- Physical market or street address (e.g. "Thamel, Kathmandu")
  bio TEXT,                                  -- Short store overview
  logo_url TEXT,                             -- Store avatar / photo
  banner_url TEXT,                           -- Store header banner
  phone_whatsapp_optional TEXT,              -- Direct phone / WhatsApp if merchant offers it
  tags TEXT,                                 -- JSON string or comma-separated tags e.g. "woodcarving,pashmina,gifts"
  
  -- The Merchant's Self-Deployed Letterbox URL (Embedded directly in iframe)
  letterbox_embed_url TEXT NOT NULL,         -- e.g. "https://ram-crafts.pages.dev/letterbox"
  owner_google_sub TEXT,                     -- Google sub ID of owner who claimed this store
  
  verification_status TEXT DEFAULT 'verified',-- 'verified', 'featured', 'unverified', 'flagged'
  verified_tier TEXT DEFAULT 'tier1_origin',  -- 'tier1_origin' (sandboxed origin) or 'tier2_crypto' (cryptographic signature)
  public_key TEXT,                            -- Exported ECDSA P-256 public key of sovereign node
  view_count INTEGER DEFAULT 0,
  inquiry_clicks INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category);
CREATE INDEX IF NOT EXISTS idx_merchants_city ON merchants(city);
CREATE INDEX IF NOT EXISTS idx_merchants_handle ON merchants(handle);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(verification_status);
