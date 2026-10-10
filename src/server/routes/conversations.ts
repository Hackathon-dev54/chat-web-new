import { Hono } from 'hono'
import { ensureD1Database } from '../db'
import { memoryStore, validateSession } from '../store'
import type { Bindings } from '../types'

const conversationRoutes = new Hono<{ Bindings: Bindings }>()

function resolveOtherUser(row: any, viewer: any, fallbackShopHandle: string, fallbackShopDisplayName: string) {
  const viewerHandle = (viewer?.handle || '').toLowerCase().replace(/^@/, '')
  const viewerId = viewer?.id || ''
  const userBHandle = (row.remote_handle || row.user_b || '').toLowerCase().replace(/^@/, '')
  const userBId = row.user_b || ''

  // Is the viewer the customer / user_b?
  const isCustomerViewer = Boolean(
    viewer &&
    (viewerHandle === userBHandle || (viewerId && viewerId === userBId))
  )

  if (isCustomerViewer) {
    // Other participant is the business merchant / shop
    const merchantUser = row.user_a ? memoryStore.users.get(row.user_a) : null
    const actualHandle = merchantUser?.handle || fallbackShopHandle
    const actualDisplayName = merchantUser?.display_name || fallbackShopDisplayName || `@${actualHandle}`
    return {
      id: row.user_a,
      username: actualHandle,
      displayName: actualDisplayName,
    }
  }

  // Other participant is the customer / remote peer
  const customerUser = row.user_b ? memoryStore.users.get(row.user_b) : null
  const custHandle = customerUser?.handle || row.remote_handle || row.user_b
  const custDisplayName = customerUser?.display_name || (row.remote_handle ? `@${row.remote_handle}` : row.user_b)
  return {
    id: row.user_b,
    username: custHandle,
    displayName: custDisplayName,
  }
}

// Conversations & Contact List (WhatsApp Style, Bidirectionally Resolved)
conversationRoutes.get('/api/conversations', async (c) => {
  const db = c.env?.DB

  if (db) {
    await ensureD1Database(db)
  }

  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  let viewer: any = null
  if (token) {
    viewer = await validateSession(token, db)
  }

  const adminUser = memoryStore.users.get('usr_admin')
  let shopHandle = adminUser?.handle || 'admin'
  let shopDisplayName = memoryStore.config.get('display_name') || 'Chatze Shop'
  let accountType = memoryStore.config.get('account_type') || 'personal'

  if (db) {
    try {
      const aRow: any = await db.prepare("SELECT handle, display_name FROM users WHERE role = 'admin' LIMIT 1").first()
      if (aRow?.handle) shopHandle = aRow.handle
      const sRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'display_name'").first()
      if (sRow?.value) shopDisplayName = sRow.value
      else if (aRow?.display_name) shopDisplayName = aRow.display_name
      const tRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'account_type'").first()
      if (tRow?.value) accountType = tRow.value
    } catch {}
  }

  const viewerHandle = (viewer?.handle || '').toLowerCase().replace(/^@/, '')
  const viewerId = viewer?.id || ''
  const isBusinessOwner = accountType === 'business' && (!viewer || viewer.role === 'admin' || viewer.id === adminUser?.id)

  if (db) {
    try {
      let query = 'SELECT * FROM conversations ORDER BY last_message_at DESC LIMIT 100'
      let params: any[] = []

      // If viewer is a customer, only show conversations they participate in
      if (!isBusinessOwner && (viewerHandle || viewerId)) {
        query = 'SELECT * FROM conversations WHERE user_b = ? OR user_b = ? OR remote_handle = ? ORDER BY last_message_at DESC LIMIT 100'
        params = [viewerId, viewerHandle, viewerHandle]
      }

      const convRows: any = await db.prepare(query).bind(...params).all()
      if (convRows?.results) {
        const mapped = convRows.results.map((row: any) => ({
          id: row.id,
          otherUser: resolveOtherUser(row, viewer, shopHandle, shopDisplayName),
          status: row.status,
          remoteInstanceUrl: row.remote_instance_url || null,
          lastMessage: row.last_message_snippet
            ? {
                content: row.last_message_snippet,
                createdAt: row.last_message_at,
              }
            : null,
        }))
        return c.json({ conversations: mapped })
      }
    } catch (d1Err: any) {
      console.warn('[D1 Conversations Warning]', d1Err?.message)
    }
  }

  const allConvs = Array.from(memoryStore.conversations.values())
  const filtered = !isBusinessOwner && (viewerHandle || viewerId)
    ? allConvs.filter((c) => c.user_b === viewerId || c.user_b === viewerHandle || c.remote_handle === viewerHandle)
    : allConvs

  const convList = filtered
    .sort((a, b) => b.last_message_at - a.last_message_at)
    .map((conv) => ({
      id: conv.id,
      otherUser: resolveOtherUser(conv, viewer, shopHandle, shopDisplayName),
      status: conv.status,
      remoteInstanceUrl: conv.remote_instance_url || null,
      lastMessage: conv.last_message_snippet
        ? {
            content: conv.last_message_snippet,
            createdAt: conv.last_message_at,
          }
        : null,
    }))

  return c.json({ conversations: convList })
})

// Unified Low-Bandwidth Edge Delta-Sync (Single lightweight call for conversations, messages & friendships)
conversationRoutes.get('/api/sync', async (c) => {
  const since = parseInt(c.req.query('since') || '0', 10)
  const conversationId = c.req.query('conversationId') || ''
  const db = c.env?.DB

  if (db) {
    await ensureD1Database(db)
  }

  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  let viewer: any = null
  if (token) {
    viewer = await validateSession(token, db)
  }

  const adminUser = memoryStore.users.get('usr_admin')
  let shopHandle = adminUser?.handle || 'admin'
  let shopDisplayName = memoryStore.config.get('display_name') || 'Chatze Shop'
  let accountType = memoryStore.config.get('account_type') || 'personal'

  if (db) {
    try {
      const aRow: any = await db.prepare("SELECT handle, display_name FROM users WHERE role = 'admin' LIMIT 1").first()
      if (aRow?.handle) shopHandle = aRow.handle
      const sRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'display_name'").first()
      if (sRow?.value) shopDisplayName = sRow.value
      else if (aRow?.display_name) shopDisplayName = aRow.display_name
      const tRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'account_type'").first()
      if (tRow?.value) accountType = tRow.value
    } catch {}
  }

  const viewerHandle = (viewer?.handle || '').toLowerCase().replace(/^@/, '')
  const viewerId = viewer?.id || ''
  const isBusinessOwner = accountType === 'business' && (!viewer || viewer.role === 'admin' || viewer.id === adminUser?.id)

  let newMessages: any[] = []
  let friendships: any[] = []
  let conversations: any[] = []

  if (db) {
    try {
      if (conversationId) {
        let reverseConvId = conversationId
        if (conversationId.startsWith('conv_')) {
          reverseConvId = 'conv_' + shopHandle
        }
        const msgRows: any = await db.prepare(
          'SELECT * FROM messages WHERE (conversation_id = ? OR conversation_id = ?) AND created_at > ? ORDER BY created_at ASC LIMIT 50'
        ).bind(conversationId, reverseConvId, since).all()
        if (msgRows?.results) {
          const seen = new Set<string>()
          newMessages = []
          for (const r of msgRows.results) {
            if (!seen.has(r.id)) {
              seen.add(r.id)
              newMessages.push({
                id: r.id,
                conversationId: r.conversation_id,
                senderId: r.sender_id,
                body: r.content,
                createdAt: new Date(r.created_at).toISOString(),
                readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
              })
            }
          }
        }
      }

      const fRows: any = await db.prepare('SELECT * FROM federation_friendships ORDER BY created_at DESC LIMIT 50').all()
      if (fRows?.results) friendships = fRows.results

      let convQuery = 'SELECT * FROM conversations ORDER BY last_message_at DESC LIMIT 50'
      let convParams: any[] = []
      if (!isBusinessOwner && (viewerHandle || viewerId)) {
        convQuery = 'SELECT * FROM conversations WHERE user_b = ? OR user_b = ? OR remote_handle = ? ORDER BY last_message_at DESC LIMIT 50'
        convParams = [viewerId, viewerHandle, viewerHandle]
      }

      const cRows: any = await db.prepare(convQuery).bind(...convParams).all()
      if (cRows?.results) {
        conversations = cRows.results.map((row: any) => ({
          id: row.id,
          otherUser: resolveOtherUser(row, viewer, shopHandle, shopDisplayName),
          status: row.status,
          remoteInstanceUrl: row.remote_instance_url || null,
          lastMessage: row.last_message_snippet
            ? { content: row.last_message_snippet, createdAt: row.last_message_at }
            : null,
        }))
      }

      return c.json({
        serverTime: Date.now(),
        newMessages,
        friendships,
        conversations,
      })
    } catch (e: any) {
      console.warn('[Sync D1 Warning]', e?.message)
    }
  }

  // In-memory fallback
  const memMsgs = memoryStore.messages
    .filter((m) => (!conversationId || m.conversation_id === conversationId) && m.created_at > since)
    .map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      body: m.content,
      createdAt: new Date(m.created_at).toISOString(),
      readAt: m.read_at ? new Date(m.read_at).toISOString() : null,
    }))

  const memFriendships = Array.from(memoryStore.friendships.values()).sort((a, b) => b.created_at - a.created_at)
  const allMemConvs = Array.from(memoryStore.conversations.values())
  const filteredMemConvs = !isBusinessOwner && (viewerHandle || viewerId)
    ? allMemConvs.filter((c) => c.user_b === viewerId || c.user_b === viewerHandle || c.remote_handle === viewerHandle)
    : allMemConvs

  const memConvs = filteredMemConvs
    .sort((a, b) => b.last_message_at - a.last_message_at)
    .map((conv) => ({
      id: conv.id,
      otherUser: resolveOtherUser(conv, viewer, shopHandle, shopDisplayName),
      status: conv.status,
      remoteInstanceUrl: conv.remote_instance_url || null,
      lastMessage: conv.last_message_snippet
        ? { content: conv.last_message_snippet, createdAt: conv.last_message_at }
        : null,
    }))

  return c.json({
    serverTime: Date.now(),
    newMessages: memMsgs,
    friendships: memFriendships,
    conversations: memConvs,
  })
})

export default conversationRoutes
