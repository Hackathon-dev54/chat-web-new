import { Hono } from 'hono'
import type { HubBindings, HubMerchant } from '../types'
import { verifyHubIdentityToken } from '../auth'
import { inMemoryMerchants } from './directory'
import { verifyNodeChallengeSignature, generateChallengeNonce } from '../crypto'

const merchantRoutes = new Hono<{ Bindings: HubBindings }>()

/**
 * POST /api/hub/merchants/register
 * Allows any business owner with a self-deployed Chatze instance
 * to list or sync their store into the public Chatze Hub directory.
 * Performs Tier 2 Cryptographic Challenge-Response verification.
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
  const cleanEmbedUrl = (letterbox_embed_url || '').trim()

  if (!cleanHandle || !cleanName || !cleanEmbedUrl) {
    return c.json({ error: 'Handle, Business Name, and Letterbox Embed URL are required' }, 400)
  }

  // Validate handle format
  if (!/^[a-z0-9_-]{3,30}$/.test(cleanHandle)) {
    return c.json({ error: 'Store handle must be 3-30 letters/numbers/hyphens' }, 400)
  }

  // Determine origin for cryptographic challenge
  let nodeOrigin = ''
  try {
    const urlObj = new URL(cleanEmbedUrl.startsWith('http') ? cleanEmbedUrl : `https://${cleanEmbedUrl}`)
    nodeOrigin = urlObj.origin
  } catch {
    // Relative or invalid origin
  }

  let verifiedTier: 'tier1_origin' | 'tier2_crypto' = 'tier1_origin'
  let exportedPublicKey: string | undefined

  // Tier 2 Security: Cryptographic Challenge-Response Handshake
  if (nodeOrigin && (nodeOrigin.startsWith('http://') || nodeOrigin.startsWith('https://'))) {
    try {
      const probeController = new AbortController()
      const timeoutId = setTimeout(() => probeController.abort(), 4000)

      // 1. Fetch node info
      const infoRes = await fetch(`${nodeOrigin}/.well-known/chatze-node.json`, {
        signal: probeController.signal,
      }).catch(() => null)

      if (infoRes && infoRes.ok) {
        const infoData: any = await infoRes.json().catch(() => ({}))
        if (infoData.public_key && infoData.protocol === 'chatze-letterbox-v1') {
          exportedPublicKey = infoData.public_key

          // 2. Issue random challenge nonce
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
              // 3. Cryptographically verify signature using SubtleCrypto
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
      console.warn('[Tier 2 Node Challenge Handshake Failed, fallback to Tier 1]', err)
    }
  }

  const db = c.env?.DB_DIRECTORY
  const now = Date.now()
  const newId = `m_${cleanHandle}_${now}`

  // Check if store already exists -> allow update/sync
  let existingIndex = inMemoryMerchants.findIndex((m) => m.handle.toLowerCase() === cleanHandle)
  let existingId = existingIndex >= 0 ? inMemoryMerchants[existingIndex].id : newId

  if (db) {
    try {
      const row: any = await db.prepare('SELECT id, owner_google_sub FROM merchants WHERE LOWER(handle) = ? LIMIT 1').bind(cleanHandle).first()
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

  if (existingIndex >= 0) {
    inMemoryMerchants[existingIndex] = merchantRecord
  } else {
    inMemoryMerchants.unshift(merchantRecord)
  }

  return c.json({
    success: true,
    message: verifiedTier === 'tier2_crypto'
      ? 'Store verified with Tier 2 Cryptographic Signature and published to Chatze Hub!'
      : 'Store registered and published to Chatze Hub with Tier 1 Sandboxed Origin!',
    merchant: merchantRecord,
    verified_tier: verifiedTier,
  })
})

export default merchantRoutes
