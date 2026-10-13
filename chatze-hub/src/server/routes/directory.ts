import { Hono } from 'hono'
import type { HubBindings, HubMerchant } from '../types'
import { SEED_MERCHANTS } from '../mockData'

const directoryRoutes = new Hono<{ Bindings: HubBindings }>()

// In-memory fallback if D1 is not connected yet during local dev
let inMemoryMerchants: HubMerchant[] = [...SEED_MERCHANTS]

/**
 * GET /api/hub/directory
 * List and search sovereign stores across Nepal
 * Query params: ?search=...&city=...&category=...&limit=...
 */
directoryRoutes.get('/api/hub/directory', async (c) => {
  const db = c.env?.DB_DIRECTORY
  const query = c.req.query('search')?.trim().toLowerCase() || ''
  const city = c.req.query('city')?.trim() || ''
  const category = c.req.query('category')?.trim() || ''

  if (db) {
    try {
      let sql = 'SELECT * FROM merchants WHERE verification_status != "flagged"'
      const params: any[] = []

      if (city && city !== 'All') {
        sql += ' AND city = ?'
        params.push(city)
      }

      if (category && category !== 'All') {
        sql += ' AND category = ?'
        params.push(category)
      }

      if (query) {
        sql += ' AND (LOWER(business_name) LIKE ? OR LOWER(handle) LIKE ? OR LOWER(bio) LIKE ? OR LOWER(tags) LIKE ?)'
        const pattern = `%${query}%`
        params.push(pattern, pattern, pattern, pattern)
      }

      sql += ' ORDER BY verification_status = "featured" DESC, view_count DESC LIMIT 50'
      const rows = await db.prepare(sql).bind(...params).all()
      if (rows.results && rows.results.length > 0) {
        return c.json({ merchants: rows.results, total: rows.results.length })
      }
    } catch (err) {
      console.warn('[Hub D1 Directory Query Error, using fallback]', err)
    }
  }

  // Fallback to memory / seed merchants
  let filtered = inMemoryMerchants.filter((m) => m.verification_status !== 'flagged')
  if (city && city !== 'All') {
    filtered = filtered.filter((m) => m.city.toLowerCase() === city.toLowerCase())
  }
  if (category && category !== 'All') {
    filtered = filtered.filter((m) => m.category.toLowerCase() === category.toLowerCase())
  }
  if (query) {
    filtered = filtered.filter(
      (m) =>
        m.business_name.toLowerCase().includes(query) ||
        m.handle.toLowerCase().includes(query) ||
        (m.bio && m.bio.toLowerCase().includes(query)) ||
        (m.tags && m.tags.toLowerCase().includes(query))
    )
  }

  return c.json({ merchants: filtered, total: filtered.length })
})

/**
 * GET /api/hub/directory/:handle
 * Retrieve full sovereign store profile & embed URL
 */
directoryRoutes.get('/api/hub/directory/:handle', async (c) => {
  const handle = c.req.param('handle').replace(/^@/, '').toLowerCase()
  const db = c.env?.DB_DIRECTORY

  if (db) {
    try {
      const row = await db.prepare('SELECT * FROM merchants WHERE LOWER(handle) = ? LIMIT 1').bind(handle).first()
      if (row) {
        // Increment view count asynchronously
        db.prepare('UPDATE merchants SET view_count = view_count + 1 WHERE id = ?').bind(row.id).run().catch(() => {})
        return c.json({ merchant: row })
      }
    } catch (err) {
      console.warn('[Hub D1 Single Merchant Error]', err)
    }
  }

  const found = inMemoryMerchants.find((m) => m.handle.toLowerCase() === handle)
  if (found) {
    found.view_count = (found.view_count || 0) + 1
    return c.json({ merchant: found })
  }

  return c.json({ error: 'Store not found in Chatze Hub directory' }, 404)
})

/**
 * POST /api/hub/directory/:handle/track-click
 * Track inquiry button click without storing personal user messages
 */
directoryRoutes.post('/api/hub/directory/:handle/track-click', async (c) => {
  const handle = c.req.param('handle').replace(/^@/, '').toLowerCase()
  const db = c.env?.DB_DIRECTORY
  if (db) {
    db.prepare('UPDATE merchants SET inquiry_clicks = inquiry_clicks + 1 WHERE LOWER(handle) = ?').bind(handle).run().catch(() => {})
  }
  const found = inMemoryMerchants.find((m) => m.handle.toLowerCase() === handle)
  if (found) {
    found.inquiry_clicks = (found.inquiry_clicks || 0) + 1
  }
  return c.json({ success: true })
})

export default directoryRoutes
export { inMemoryMerchants }
