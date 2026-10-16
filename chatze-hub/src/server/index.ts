import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HubBindings } from './types'

import directoryRoutes from './routes/directory'
import authRoutes from './routes/auth'
import userRoutes from './routes/user'
import merchantRoutes from './routes/merchants'
import { ensureHubD1Database } from './db'

const app = new Hono<{ Bindings: HubBindings }>()

// Global Cross-Origin policy for Hub API
app.use('*', cors())

// Ensure D1 database tables exist automatically
app.use('/api/*', async (c, next) => {
  const db = c.env?.DB || c.env?.DB_DIRECTORY
  if (db) {
    try {
      await ensureHubD1Database(db)
    } catch {}
  }
  await next()
})

// System Error Handler
app.onError((err, c) => {
  console.error('[Chatze Hub Edge Error]', err)
  return c.json({ error: err.message || 'Hub gateway error', timestamp: Date.now() }, 500)
})

// Hub Health & Discovery Ping
app.get('/api/hub/health', (c) => {
  const isUnified = Boolean(c.env?.DB)
  return c.json({
    status: 'ok',
    gateway: 'Chatze Hub (Nepal)',
    architecture: isUnified ? 'Cloudflare D1 Unified Database (Zero-Config)' : 'Cloudflare D1 10-Database Sharding',
    messageRelay: 'Disabled (Zero Storage)',
    timestamp: Date.now(),
  })
})

// Mount Hub Sub-Routes
app.route('/', directoryRoutes)
app.route('/', authRoutes)
app.route('/', userRoutes)
app.route('/', merchantRoutes)

// Fallback to static assets when deployed on Cloudflare Workers Assets / Pages
app.all('*', async (c) => {
  // 1. Cloudflare Workers Static Assets / Pages fetch
  if (c.env?.ASSETS) {
    try {
      const assetResponse = await c.env.ASSETS.fetch(c.req.raw)
      if (assetResponse.status !== 404) {
        return assetResponse
      }
    } catch (e) {
      console.warn('[Assets Fetch Error]', e)
    }
  }

  // 2. Graceful edge status card if root route is visited before frontend is built
  if (c.req.path === '/' || c.req.path === '/index.html') {
    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Chatze Hub Gateway — Sovereign Nepal Edge</title>
  <style>
    body { background: #0b141a; color: #e9edef; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
    .card { background: #111b21; border: 1px solid #222e35; border-radius: 16px; padding: 36px 28px; max-width: 540px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; background: rgba(0, 168, 132, 0.15); color: #00a884; font-size: 0.82rem; font-weight: 600; margin-bottom: 20px; border: 1px solid rgba(0, 168, 132, 0.3); }
    h1 { color: #f0f2f5; font-size: 1.5rem; margin: 0 0 10px; font-weight: 700; }
    p { color: #8696a0; line-height: 1.6; font-size: 0.95rem; margin: 0 0 20px; }
    .code-box { background: #0b141a; border: 1px solid #202c33; padding: 14px 16px; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.88rem; color: #25d366; text-align: left; margin: 18px 0; overflow-x: auto; }
    .links { display: flex; justify-content: center; gap: 20px; margin-top: 24px; font-size: 0.88rem; }
    .links a { color: #00a884; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🇳🇵 Active Sovereign Edge</div>
    <h1>Chatze Hub Edge is Online</h1>
    <p>Your Cloudflare Worker edge API and D1 Database are live! To deploy the full interactive React dashboard and Nepal Discovery Directory, run:</p>
    <div class="code-box">
      npm run build<br/>
      npm run deploy
    </div>
    <div class="links">
      <a href="/api/hub/health">API Health Check</a>
      <a href="/api/directory">Directory API</a>
    </div>
  </div>
</body>
</html>`)
  }

  return c.json({ error: 'Asset not found on Hub edge', path: c.req.path }, 404)
})

export default app
