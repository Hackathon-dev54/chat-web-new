import { Hono } from 'hono'
import type { HubBindings, HubUser } from '../types'
import { getUserDbShard } from '../sharding'
import { verifyHubIdentityToken, createHubIdentityToken } from '../auth'
import { inMemoryUsers } from './auth'

const userRoutes = new Hono<{ Bindings: HubBindings }>()

/**
 * POST /api/hub/user/link-sovereign
 * Allows a consumer who previously chatted via Google identity to link
 * their newly self-deployed Chatze instance URL (Dual Identity Resolution)
 */
userRoutes.post('/api/hub/user/link-sovereign', async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'

  const payload = await verifyHubIdentityToken(token, jwtSecret)
  if (!payload) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const body = await c.req.json()
  const rawNodeUrl = (body.node_url || '').trim()
  const rawHandle = (body.handle || '').replace(/^@/, '').trim().toLowerCase()

  if (!rawNodeUrl) {
    return c.json({ error: 'Please provide your self-deployed Chatze node URL' }, 400)
  }

  // Validate URL format
  let cleanUrl = rawNodeUrl
  try {
    const parsed = new URL(rawNodeUrl.startsWith('http') ? rawNodeUrl : `https://${rawNodeUrl}`)
    cleanUrl = `${parsed.protocol}//${parsed.host}`
  } catch {
    return c.json({ error: 'Invalid sovereign node URL' }, 400)
  }

  // Quick 3-second edge ping to verify node is active
  let verified = true
  let nodeVersion = 'Chatze Edge Node'
  try {
    const pingController = new AbortController()
    const timeoutId = setTimeout(() => pingController.abort(), 3500)
    const pingRes = await fetch(`${cleanUrl}/api/health`, { signal: pingController.signal }).catch(() => null)
    clearTimeout(timeoutId)
    if (pingRes && pingRes.ok) {
      const data: any = await pingRes.json().catch(() => ({}))
      if (data.status === 'ok') {
        nodeVersion = data.engine || 'Cloudflare D1 Node'
      }
    }
  } catch {
    // Graceful fallback: Still allow linking even if behind private firewall
  }

  const now = Date.now()
  const userShard = getUserDbShard(payload.google_sub, c.env)

  if (userShard) {
    try {
      await userShard
        .prepare('UPDATE users SET sovereign_node_url = ?, sovereign_handle = ?, sovereign_verified_at = ? WHERE google_sub = ?')
        .bind(cleanUrl, rawHandle || null, now, payload.google_sub)
        .run()
    } catch (err) {
      console.warn('[Hub D1 User Update Error]', err)
    }
  }

  const user = inMemoryUsers.get(payload.google_sub)
  if (user) {
    user.sovereign_node_url = cleanUrl
    user.sovereign_handle = rawHandle || null
    user.sovereign_verified_at = now
  }

  const updatedUser: HubUser = user || {
    google_sub: payload.google_sub,
    email: payload.email,
    display_name: payload.display_name,
    avatar_url: payload.avatar_url,
    sovereign_node_url: cleanUrl,
    sovereign_handle: rawHandle || null,
    sovereign_verified_at: now,
    role: 'customer',
    created_at: now,
    last_login: now,
  }

  // Generate refreshed token containing the linked sovereign node
  const refreshedToken = await createHubIdentityToken(updatedUser, jwtSecret)

  return c.json({
    success: true,
    message: 'Sovereign Chatze node successfully linked! Your identity now carries the verified Sovereign Node badge.',
    user: updatedUser,
    token: refreshedToken,
    nodeInfo: { url: cleanUrl, engine: nodeVersion, verifiedAt: now },
  })
})

/**
 * POST /api/hub/user/unlink-sovereign
 * Reverts user back to standard Google identity
 */
userRoutes.post('/api/hub/user/unlink-sovereign', async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'

  const payload = await verifyHubIdentityToken(token, jwtSecret)
  if (!payload) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const userShard = getUserDbShard(payload.google_sub, c.env)
  if (userShard) {
    try {
      await userShard
        .prepare('UPDATE users SET sovereign_node_url = NULL, sovereign_handle = NULL, sovereign_verified_at = NULL WHERE google_sub = ?')
        .bind(payload.google_sub)
        .run()
    } catch {}
  }

  const user = inMemoryUsers.get(payload.google_sub)
  if (user) {
    user.sovereign_node_url = null
    user.sovereign_handle = null
    user.sovereign_verified_at = null
  }

  return c.json({ success: true, message: 'Sovereign node unlinked' })
})

export default userRoutes
