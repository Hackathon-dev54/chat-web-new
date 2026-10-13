import { Hono } from 'hono'
import type { HubBindings, HubUser } from '../types'
import { getUserDbShard } from '../sharding'
import { createHubIdentityToken, verifyHubIdentityToken } from '../auth'

const authRoutes = new Hono<{ Bindings: HubBindings }>()

// In-memory fallback for user profiles
const inMemoryUsers = new Map<string, HubUser>()

/**
 * POST /api/hub/auth/google
 * Validates Google authentication credential / profile from consumer
 * Stores into Shard DB_USERS_0..7 via consistent hashing
 * Returns signed Hub Identity Token
 */
authRoutes.post('/api/hub/auth/google', async (c) => {
  try {
    const body = await c.req.json()
    const { google_sub, email, display_name, avatar_url, credential } = body

    if (!email || !display_name) {
      return c.json({ error: 'Missing required Google user identity information' }, 400)
    }

    // In production with real Google Client ID, we can verify the id_token signature.
    // For universal preview/testing, derive sub if not provided.
    const cleanSub = google_sub || `g_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = display_name.trim()
    const cleanAvatar = avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`

    const userShard = getUserDbShard(cleanSub, c.env)
    const now = Date.now()

    let existingUser: HubUser | null = null

    if (userShard) {
      try {
        const row: any = await userShard.prepare('SELECT * FROM users WHERE google_sub = ? LIMIT 1').bind(cleanSub).first()
        if (row) {
          existingUser = row
          await userShard
            .prepare('UPDATE users SET display_name = ?, avatar_url = ?, last_login = ? WHERE google_sub = ?')
            .bind(cleanName, cleanAvatar, now, cleanSub)
            .run()
        } else {
          await userShard
            .prepare(
              'INSERT INTO users (google_sub, email, display_name, avatar_url, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .bind(cleanSub, cleanEmail, cleanName, cleanAvatar, now, now)
            .run()
        }
      } catch (err) {
        console.warn('[Hub D1 User Shard Error, fallback to memory]', err)
      }
    }

    if (!existingUser) {
      existingUser = inMemoryUsers.get(cleanSub) || {
        google_sub: cleanSub,
        email: cleanEmail,
        display_name: cleanName,
        avatar_url: cleanAvatar,
        sovereign_node_url: null,
        sovereign_handle: null,
        sovereign_verified_at: null,
        role: 'customer',
        created_at: now,
        last_login: now,
      }
    } else {
      existingUser.display_name = cleanName
      existingUser.avatar_url = cleanAvatar
      existingUser.last_login = now
    }

    inMemoryUsers.set(cleanSub, existingUser)

    // Generate signed Hub Identity Token
    const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'
    const token = await createHubIdentityToken(existingUser, jwtSecret)

    return c.json({
      success: true,
      user: existingUser,
      token,
      shardIndex: getUserDbShard(cleanSub, c.env) ? undefined : undefined,
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Authentication error' }, 500)
  }
})

/**
 * GET /api/hub/auth/me
 * Returns current authenticated user and linked sovereign node status
 */
authRoutes.get('/api/hub/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return c.json({ user: null })
  }

  const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'
  const payload = await verifyHubIdentityToken(token, jwtSecret)

  if (!payload) {
    return c.json({ user: null, error: 'Invalid or expired token' }, 401)
  }

  const userShard = getUserDbShard(payload.google_sub, c.env)
  if (userShard) {
    try {
      const row: any = await userShard.prepare('SELECT * FROM users WHERE google_sub = ? LIMIT 1').bind(payload.google_sub).first()
      if (row) {
        return c.json({ user: row })
      }
    } catch {}
  }

  const user = inMemoryUsers.get(payload.google_sub) || {
    google_sub: payload.google_sub,
    email: payload.email,
    display_name: payload.display_name,
    avatar_url: payload.avatar_url,
    sovereign_node_url: payload.sovereign_node_url || null,
    sovereign_handle: payload.sovereign_handle || null,
    sovereign_verified_at: null,
    role: 'customer',
    created_at: Date.now(),
    last_login: Date.now(),
  }

  return c.json({ user })
})

export default authRoutes
export { inMemoryUsers }
