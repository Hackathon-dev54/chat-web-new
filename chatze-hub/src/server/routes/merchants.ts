import { Hono } from 'hono'
import type { HubBindings, HubMerchant } from '../types'
import { verifyHubIdentityToken } from '../auth'
import { inMemoryMerchants } from './directory'
import { verifyNodeChallengeSignature, generateChallengeNonce } from '../crypto'
import { getUserDbShard } from '../sharding'
import { inMemoryUsers } from './auth'
import { ensureHubD1Database, normalizeSovereignUrl } from '../db'

const merchantRoutes = new Hono<{ Bindings: HubBindings }>()

/**
 * GET /api/hub/merchants/detect
 * Automatically inspects a self-deployed Chatze store URL to detect
 * node protocol, store metadata, handle, title, bio, and embed endpoint.
 */
merchantRoutes.get('/api/hub/merchants/detect', async (c) => {
  const targetUrl = c.req.query('url')?.trim() || ''
  if (!targetUrl) {
    return c.json({ error: 'Please provide a valid store URL' }, 400)
  }

  let fullUrl: URL
  try {
    fullUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`)
  } catch {
    return c.json({ error: 'Invalid URL format' }, 400)
  }

  const origin = fullUrl.origin
  let detectedInfo: {
    handle?: string
    business_name?: string
    bio?: string
    logo_url?: string
    letterbox_embed_url: string
    protocol?: string
    isOfficialChatze: boolean
    public_key?: string
  } = {
    letterbox_embed_url: `${origin}/letterbox`,
    isOfficialChatze: false,
  }

  try {
    const probeController = new AbortController()
    const timeoutId = setTimeout(() => probeController.abort(), 4000)

    // 1. Try Chatze Node JSON manifest
    try {
      const wellKnownRes = await fetch(`${origin}/.well-known/chatze-node.json`, {
        signal: probeController.signal,
      })
      if (wellKnownRes.ok) {
        const nodeJson: any = await wellKnownRes.json().catch(() => null)
        if (nodeJson) {
          detectedInfo.isOfficialChatze = true
          detectedInfo.protocol = nodeJson.protocol || 'chatze-letterbox-v1'
          if (nodeJson.handle) detectedInfo.handle = nodeJson.handle.replace(/^@/, '')
          if (nodeJson.business_name || nodeJson.owner_name) {
            detectedInfo.business_name = nodeJson.business_name || nodeJson.owner_name
          }
          if (nodeJson.bio) detectedInfo.bio = nodeJson.bio
          if (nodeJson.logo_url) detectedInfo.logo_url = nodeJson.logo_url
          if (nodeJson.public_key) detectedInfo.public_key = nodeJson.public_key
          if (nodeJson.letterbox_url) detectedInfo.letterbox_embed_url = nodeJson.letterbox_url
        }
      }
    } catch {}

    // 2. Try Chatze setup status API if not found
    if (!detectedInfo.business_name) {
      try {
        const setupRes = await fetch(`${origin}/api/setup/status`, {
          signal: probeController.signal,
        })
        if (setupRes.ok) {
          const setupJson: any = await setupRes.json().catch(() => null)
          if (setupJson) {
            detectedInfo.isOfficialChatze = true
            if (setupJson.displayName) detectedInfo.business_name = setupJson.displayName
          }
        }
      } catch {}
    }

    // 3. Fallback: Parse HTML title & meta tags
    if (!detectedInfo.business_name || !detectedInfo.bio) {
      try {
        const htmlRes = await fetch(origin, {
          signal: probeController.signal,
          headers: { 'User-Agent': 'Chatze-Hub-Bot/1.0' },
        })
        if (htmlRes.ok) {
          const htmlText = await htmlRes.text()
          const titleMatch = htmlText.match(/<title>([^<]*)<\/title>/i)
          if (titleMatch && titleMatch[1] && !detectedInfo.business_name) {
            const rawTitle = titleMatch[1].replace(/—.*$/, '').replace(/\|.*$/, '').trim()
            if (rawTitle && rawTitle.toLowerCase() !== 'chatze') {
              detectedInfo.business_name = rawTitle
            }
          }
          const descMatch = htmlText.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
          if (descMatch && descMatch[1] && !detectedInfo.bio) {
            detectedInfo.bio = descMatch[1].trim()
          }
        }
      } catch {}
    }

    clearTimeout(timeoutId)
  } catch (probeErr) {
    console.warn('[Store Auto-Detect Probe Error]', probeErr)
  }

  // Generate fallback handle from domain host if not detected
  if (!detectedInfo.handle) {
    const hostParts = fullUrl.hostname.split('.')
    const subdomain = hostParts[0].toLowerCase().replace(/[^a-z0-9]/g, '')
    detectedInfo.handle = subdomain && subdomain !== 'www' ? subdomain : 'store'
  }

  if (!detectedInfo.business_name) {
    detectedInfo.business_name = detectedInfo.handle
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return c.json({
    success: true,
    detected: detectedInfo,
  })
})

/**
 * GET /api/hub/merchants/my-store
 * Fetches the currently authenticated user's registered store (if any)
 */
merchantRoutes.get('/api/hub/merchants/my-store', async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'

  if (!token) {
    return c.json({ store: null })
  }

  const payload = await verifyHubIdentityToken(token, jwtSecret)
  if (!payload) {
    return c.json({ store: null, error: 'Unauthorized' }, 401)
  }

  const db = c.env?.DB_DIRECTORY || c.env?.DB
  if (db) {
    try {
      const row = await db.prepare(
        'SELECT * FROM merchants WHERE owner_google_sub = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(payload.google_sub).first()
      if (row) {
        return c.json({ store: row })
      }
    } catch (err) {
      console.warn('[Hub D1 My Store Query Error]', err)
    }
  }

  const memoryStore = inMemoryMerchants.find((m) => m.owner_google_sub === payload.google_sub)
  return c.json({ store: memoryStore || null })
})

/**
 * DELETE /api/hub/merchants/my-store
 * Unlists the authenticated user's store
 */
merchantRoutes.delete('/api/hub/merchants/my-store', async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const payload = await verifyHubIdentityToken(token, jwtSecret)
  if (!payload) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const db = c.env?.DB_DIRECTORY || c.env?.DB
  if (db) {
    try {
      await db.prepare('DELETE FROM merchants WHERE owner_google_sub = ?').bind(payload.google_sub).run()
    } catch (err) {
      console.warn('[Hub D1 Store Delete Error]', err)
    }
  }

  const index = inMemoryMerchants.findIndex((m) => m.owner_google_sub === payload.google_sub)
  if (index >= 0) {
    inMemoryMerchants.splice(index, 1)
  }

  return c.json({ success: true, message: 'Store removed from Hub directory' })
})

/**
 * POST /api/hub/merchants/register
 * Allows any business owner with a self-deployed Chatze instance
 * to list or sync their store into the public Chatze Hub directory.
 */
merchantRoutes.post('/api/hub/merchants/register', async (c) => {
  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const jwtSecret = c.env?.JWT_SECRET || 'chatze-hub-default-secret'

  let ownerSub: string | undefined
  if (token) {
    const payload = await verifyHubIdentityToken(token, jwtSecret)
    if (payload) {
      ownerSub = payload.google_sub
    }
  }

  if (!ownerSub) {
    return c.json({ error: 'Please sign in with Google to register or connect your store' }, 401)
  }

  const body = await c.req.json()
  const {
    handle,
    business_name,
    category,
    city,
    address,
    bio,
    logo_url,
    banner_url,
    phone_whatsapp_optional,
    tags,
    letterbox_embed_url,
  } = body

  const cleanHandle = (handle || '').replace(/^@/, '').trim().toLowerCase()
  const cleanName = (business_name || '').trim()
  const cleanCategory = (category || 'General').trim()
  const cleanCity = (city || 'Kathmandu').trim()
  const cleanEmbedUrl = normalizeSovereignUrl(letterbox_embed_url || '')

  if (!cleanHandle || !cleanName || !cleanEmbedUrl) {
    return c.json({ error: 'Handle, Business Name, and a valid Sovereign Store URL are required' }, 400)
  }

  // Validate handle format
  if (!/^[a-z0-9_-]{3,30}$/.test(cleanHandle)) {
    return c.json({ error: 'Store handle must be 3-30 letters/numbers/hyphens' }, 400)
  }

  // Determine origin for cryptographic verification
  let nodeOrigin = ''
  try {
    const urlObj = new URL(cleanEmbedUrl)
    nodeOrigin = urlObj.origin
  } catch {
    // Relative or custom url
  }

  let verifiedTier: 'tier1_origin' | 'tier2_crypto' = 'tier1_origin'
  let exportedPublicKey: string | undefined

  // Tier 2 Security: Cryptographic Challenge-Response Handshake
  if (nodeOrigin && (nodeOrigin.startsWith('http://') || nodeOrigin.startsWith('https://'))) {
    try {
      const probeController = new AbortController()
      const timeoutId = setTimeout(() => probeController.abort(), 4000)

      const infoRes = await fetch(`${nodeOrigin}/.well-known/chatze-node.json`, {
        signal: probeController.signal,
      }).catch(() => null)

      if (infoRes && infoRes.ok) {
        const infoData: any = await infoRes.json().catch(() => ({}))
        if (infoData.public_key && infoData.protocol === 'chatze-letterbox-v1') {
          exportedPublicKey = infoData.public_key

          const challengeNonce = generateChallengeNonce()
          const challengeRes = await fetch(`${nodeOrigin}/.well-known/chatze-node/challenge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nonce: challengeNonce }),
            signal: probeController.signal,
          }).catch(() => null)

          if (challengeRes && challengeRes.ok) {
            const challengeData: any = await challengeRes.json().catch(() => ({}))
            if (challengeData.signature) {
              const isValid = await verifyNodeChallengeSignature(
                infoData.public_key,
                challengeNonce,
                challengeData.signature
              )
              if (isValid) {
                verifiedTier = 'tier2_crypto'
              }
            }
          }
        }
      }
      clearTimeout(timeoutId)
    } catch (err) {
      console.warn('[Tier 2 Node Challenge Handshake Notice, using Tier 1]', err)
    }
  }

  const db = c.env?.DB_DIRECTORY || c.env?.DB
  if (db) {
    try {
      await ensureHubD1Database(db)
    } catch {}
  }
  const now = Date.now()
  const newId = `m_${cleanHandle}_${now}`

  let existingIndex = inMemoryMerchants.findIndex((m) => m.handle.toLowerCase() === cleanHandle || m.owner_google_sub === ownerSub)
  let existingId = existingIndex >= 0 ? inMemoryMerchants[existingIndex].id : newId

  if (db) {
    try {
      const row: any = await db.prepare(
        'SELECT id, owner_google_sub FROM merchants WHERE LOWER(handle) = ? OR owner_google_sub = ? LIMIT 1'
      ).bind(cleanHandle, ownerSub).first()
      if (row) {
        existingId = row.id
      }
    } catch {}
  }

  const merchantRecord: HubMerchant = {
    id: existingId,
    handle: cleanHandle,
    business_name: cleanName,
    category: cleanCategory,
    city: cleanCity,
    address: (address || '').trim() || undefined,
    bio: (bio || '').trim() || undefined,
    logo_url: (logo_url || '').trim() || undefined,
    banner_url: (banner_url || '').trim() || undefined,
    phone_whatsapp_optional: (phone_whatsapp_optional || '').trim() || undefined,
    tags: (tags || '').trim() || undefined,
    letterbox_embed_url: cleanEmbedUrl,
    owner_google_sub: ownerSub,
    verification_status: 'verified',
    verified_tier: verifiedTier,
    public_key: exportedPublicKey,
    view_count: existingIndex >= 0 ? (inMemoryMerchants[existingIndex].view_count || 0) : 0,
    inquiry_clicks: existingIndex >= 0 ? (inMemoryMerchants[existingIndex].inquiry_clicks || 0) : 0,
    created_at: existingIndex >= 0 ? inMemoryMerchants[existingIndex].created_at : now,
    updated_at: now,
  }

  if (db) {
    try {
      await db
        .prepare(`
          INSERT INTO merchants (
            id, handle, business_name, category, city, address, bio, logo_url, banner_url,
            phone_whatsapp_optional, tags, letterbox_embed_url, owner_google_sub,
            verification_status, view_count, inquiry_clicks, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
          ON CONFLICT(handle) DO UPDATE SET
            business_name = excluded.business_name,
            category = excluded.category,
            city = excluded.city,
            address = excluded.address,
            bio = excluded.bio,
            logo_url = excluded.logo_url,
            banner_url = excluded.banner_url,
            phone_whatsapp_optional = excluded.phone_whatsapp_optional,
            tags = excluded.tags,
            letterbox_embed_url = excluded.letterbox_embed_url,
            owner_google_sub = excluded.owner_google_sub,
            updated_at = excluded.updated_at
        `)
        .bind(
          merchantRecord.id,
          merchantRecord.handle,
          merchantRecord.business_name,
          merchantRecord.category,
          merchantRecord.city,
          merchantRecord.address || null,
          merchantRecord.bio || null,
          merchantRecord.logo_url || null,
          merchantRecord.banner_url || null,
          merchantRecord.phone_whatsapp_optional || null,
          merchantRecord.tags || null,
          merchantRecord.letterbox_embed_url,
          merchantRecord.owner_google_sub || null,
          merchantRecord.verification_status,
          merchantRecord.created_at,
          now
        )
        .run()
    } catch (err) {
      console.warn('[Hub D1 Merchant Upsert Error]', err)
    }
  }

  // Also update user's profile with sovereign node details
  if (ownerSub) {
    const userShard = getUserDbShard(ownerSub, c.env)
    if (userShard) {
      try {
        await userShard.prepare(
          'UPDATE users SET sovereign_node_url = ?, sovereign_handle = ?, sovereign_verified_at = ? WHERE google_sub = ?'
        ).bind(nodeOrigin || cleanEmbedUrl, cleanHandle, now, ownerSub).run()
      } catch {}
    }
    const memUser = inMemoryUsers.get(ownerSub)
    if (memUser) {
      memUser.sovereign_node_url = nodeOrigin || cleanEmbedUrl
      memUser.sovereign_handle = cleanHandle
      memUser.sovereign_verified_at = now
    }
  }

  if (existingIndex >= 0) {
    inMemoryMerchants[existingIndex] = merchantRecord
  } else {
    inMemoryMerchants.unshift(merchantRecord)
  }

  return c.json({
    success: true,
    message: verifiedTier === 'tier2_crypto'
      ? 'Store verified with Tier 2 Cryptographic Signature and published to Chatze Hub!'
      : 'Store registered and published to Chatze Hub!',
    merchant: merchantRecord,
    verified_tier: verifiedTier,
  })
})

export default merchantRoutes
