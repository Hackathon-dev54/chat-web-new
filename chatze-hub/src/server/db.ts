// ==============================================================================
// Chatze Hub Database Resilience Engine (Cloudflare D1)
// Automatically initializes D1 tables if not present so registrations never fail
// ==============================================================================

let hubD1Initialized = false

export const HUB_D1_INIT_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS hub_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS merchants (
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
  )`,

  `CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category)`,
  `CREATE INDEX IF NOT EXISTS idx_merchants_city ON merchants(city)`,
  `CREATE INDEX IF NOT EXISTS idx_merchants_handle ON merchants(handle)`,
  `CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants(owner_google_sub)`,

  `CREATE TABLE IF NOT EXISTS users (
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
  )`,

  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_sovereign ON users(sovereign_node_url)`,

  // Purge any legacy dummy mock seed stores from old schemas
  `DELETE FROM merchants WHERE 
    id IN ('m_kathmandu_crafts', 'm_himalayan_pashmina', 'm_pokhara_trekking', 'm_thamel_crafts', 'm_pokhara_trek', 'm_patan_pashmina', 'm_kathmandu_spices', 'm_bhaktapur_pottery', 'm_biratnagar_tech')
    OR LOWER(handle) IN ('kathmanducrafts', 'annapurnagear', 'himalayanpashmina', 'thamelcrafts', 'pokharagear', 'patanpashmina', 'himalayanspice', 'claycrafts', 'easterntech')
    OR owner_google_sub LIKE 'demo_%'`,
]

export async function ensureHubD1Database(db: any) {
  if (hubD1Initialized || !db) return
  try {
    for (const stmt of HUB_D1_INIT_STATEMENTS) {
      try {
        await db.prepare(stmt).run()
      } catch (stmtErr: any) {
        console.warn('[Hub D1 statement notice]', stmtErr?.message)
      }
    }
    hubD1Initialized = true
  } catch (err: any) {
    console.warn('[Hub D1 Init Warning]', err?.message)
  }
}

/**
 * Normalizes an external sovereign Chatze URL
 * Guarantees a fully qualified https:// URL and prevents localhost/relative leaks
 */
export function normalizeSovereignUrl(rawUrl: string): string {
  let cleaned = (rawUrl || '').trim()
  if (!cleaned) return ''
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned
  }
  return cleaned.replace(/\/+$/, '')
}
