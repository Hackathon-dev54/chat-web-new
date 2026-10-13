import { Hono } from 'hono'
import { cors } from 'hono/cors'

import type { Bindings } from './types'
import authRoutes from './routes/auth'
import conversationRoutes from './routes/conversations'
import federationRoutes from './routes/federation'
import messagingRoutes from './routes/messaging'
import mediaRoutes from './routes/media'
import pushRoutes from './routes/push'
import streamRoutes from './routes/stream'
import profileRoutes from './routes/profile'
import inquiryRoutes from './routes/inquiries'
import hubApp from '../../chatze-hub/src/server/index'

import { ensureServerKeyPair, signPayload, getExportedPublicKeyBase64 } from './crypto'
import { memoryStore } from './store'
import { ensureD1Database } from './db'

export { RealtimeBroadcaster } from './durable-object'
export { emitUserEvent, broadcastAllStreams } from './store'

const app = new Hono<{ Bindings: Bindings }>()

// Global Cross-Origin Middleware
app.use('*', cors())

// Global safety error handler: NEVER return plain text 500
app.onError((err, c) => {
  console.error('[Hono Edge Error]', err)
  return c.json({ error: err.message || 'Server error', timestamp: Date.now() }, 500)
})

// System Health Check
app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    engine: 'hono-cloudflare-workers',
    edgeNode: 'Kathmandu (KTM) PoP',
    federation: 'enabled',
  })
)

// Tier 2 Security: Cryptographic Node Discovery Handshake Endpoint
app.get('/.well-known/chatze-node.json', async (c) => {
  const db = c.env?.DB
  if (db) {
    try {
      await ensureD1Database(db)
    } catch {}
  }

  await ensureServerKeyPair(db)

  let handle = memoryStore.users.get('usr_admin')?.handle || 'admin'
  let displayName = memoryStore.config.get('display_name') || 'Chatze User'
  let accountType = memoryStore.config.get('account_type') || 'personal'
  let hubListed = memoryStore.config.get('hub_listed') !== 'false'

  if (db) {
    try {
      const uRow: any = await db.prepare("SELECT handle, display_name FROM users WHERE role = 'admin' LIMIT 1").first()
      if (uRow) {
        handle = uRow.handle
        displayName = uRow.display_name || displayName
      }
      const cfgRow: any = await db.prepare("SELECT key, value FROM system_config WHERE key IN ('account_type', 'hub_listed')").all()
      if (cfgRow?.results) {
        for (const row of cfgRow.results as any[]) {
          if (row.key === 'account_type') accountType = row.value
          if (row.key === 'hub_listed') hubListed = row.value === 'true'
        }
      }
    } catch {}
  }

  const origin = new URL(c.req.url).origin

  return c.json({
    protocol: 'chatze-letterbox-v1',
    version: '1.0.0',
    node_id: `node_${handle}`,
    public_key: getExportedPublicKeyBase64(),
    algorithm: 'ECDSA-P256-SHA256',
    owner_name: displayName,
    handle,
    account_type: accountType,
    hub_listed: hubListed,
    letterbox_embed_url: `${origin}/letterbox?shop=${handle}`,
    build_hash: 'chatze-official-v1.0.0',
    timestamp: Date.now(),
  })
})

// Tier 2 Security: Cryptographic Challenge-Response Endpoint
app.post('/.well-known/chatze-node/challenge', async (c) => {
  try {
    const { nonce } = await c.req.json()
    if (!nonce || typeof nonce !== 'string') {
      return c.json({ error: 'Valid challenge nonce required' }, 400)
    }
    await ensureServerKeyPair(c.env?.DB)
    const signature = await signPayload(nonce)
    const handle = memoryStore.users.get('usr_admin')?.handle || 'admin'

    return c.json({
      protocol: 'chatze-letterbox-v1',
      nonce,
      signature,
      public_key: getExportedPublicKeyBase64(),
      node_id: `node_${handle}`,
      verified: true,
      timestamp: Date.now(),
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Challenge signing failed' }, 500)
  }
})

// Mount Modular Routes
app.route('/', authRoutes)
app.route('/', conversationRoutes)
app.route('/', federationRoutes)
app.route('/', messagingRoutes)
app.route('/', mediaRoutes)
app.route('/', pushRoutes)
app.route('/', streamRoutes)
app.route('/', profileRoutes)
app.route('/', inquiryRoutes)
app.route('/', hubApp)

// Fallback to static assets in production on Cloudflare Workers
app.all('*', async (c) => {
  if (c.env?.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw)
    const url = new URL(c.req.url)
    if (url.pathname.startsWith('/assets/')) {
      const headers = new Headers(res.headers)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      })
    }
    return res
  }
  return c.notFound()
})

export default app
