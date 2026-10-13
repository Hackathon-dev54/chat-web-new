import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { HubBindings } from './types'

import directoryRoutes from './routes/directory'
import authRoutes from './routes/auth'
import userRoutes from './routes/user'
import merchantRoutes from './routes/merchants'

const app = new Hono<{ Bindings: HubBindings }>()

// Global Cross-Origin policy for Hub API
app.use('*', cors())

// System Error Handler
app.onError((err, c) => {
  console.error('[Chatze Hub Edge Error]', err)
  return c.json({ error: err.message || 'Hub gateway error', timestamp: Date.now() }, 500)
})

// Hub Health & Discovery Ping
app.get('/api/hub/health', (c) => {
  return c.json({
    status: 'ok',
    gateway: 'Chatze Hub (Nepal)',
    architecture: 'Cloudflare D1 10-Database Sharding',
    messageRelay: 'Disabled (Zero Storage)',
    timestamp: Date.now(),
  })
})

// Mount Hub Sub-Routes
app.route('/', directoryRoutes)
app.route('/', authRoutes)
app.route('/', userRoutes)
app.route('/', merchantRoutes)

// Fallback to static assets when deployed on Cloudflare Pages / Workers Sites
app.all('*', async (c) => {
  if (c.env?.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw)
  }
  return c.json({ error: 'Asset not found on Hub edge' }, 404)
})

export default app
