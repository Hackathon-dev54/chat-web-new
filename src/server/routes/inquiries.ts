import { Hono } from 'hono'
import { ensureD1Database } from '../db'
import { memoryStore, broadcastAllStreams, validateSession } from '../store'
import { extractRootDomain } from '../domain'
import { sendPushNotification } from '../webpush'
import type { Bindings, MemInquiry, MemConversation, MemMessage, MemFriendship } from '../types'

const inquiryRoutes = new Hono<{ Bindings: Bindings }>()

// ============================================================================
// The Static Letterbox: 1-Card Customer Inquiry Drop API
// ============================================================================

// Customer drops 1 note into the shop's Letterbox (Zero-Flood Guarantee & Zero Invocations on Receiver)
inquiryRoutes.post('/api/inquiries', async (c) => {
  try {
    const db = c.env?.DB
    if (db) {
      await ensureD1Database(db)
    }

    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    let authedUser: any = null
    if (token) {
      authedUser = await validateSession(token, db)
    }

    const body = await c.req.json()
    const { shopHandle, senderName, senderHandle, senderUserId, senderOriginUrl, content, contactPhone, category } = body

    const cleanContent = (content || '').trim()
    if (!cleanContent) {
      return c.json({ error: 'Inquiry note content cannot be empty' }, 400)
    }

    if (cleanContent.length > 500) {
      return c.json({ error: 'Inquiry note cannot exceed 500 characters' }, 400)
    }

    let formattedContent = cleanContent
    if (category && category.trim()) {
      formattedContent = `[${category.trim()}] ${formattedContent}`
    }
    if (contactPhone && contactPhone.trim()) {
      formattedContent = `${formattedContent} • 📞 ${contactPhone.trim()}`
    }

    // Authenticated identity binding: Customer must have a Chatze account to drop a note
    if (!authedUser) {
      return c.json({
        error: 'You must be signed in to your Chatze account to drop an inquiry note. This prevents spam and ensures you securely receive replies from the shop owner in your Letterbox.',
        code: 'AUTH_REQUIRED',
      }, 401)
    }

    const cleanSenderUserId = authedUser.id
    const cleanSenderName = (authedUser.display_name || senderName || 'Customer').trim()
    const cleanSenderHandle = (authedUser.handle || '').replace(/^@/, '').trim().toLowerCase()

    const origin = senderOriginUrl || c.req.header('origin') || c.req.header('referer') || 'direct-client'
    const rootDomain = extractRootDomain(origin)
    const now = Date.now()

    // Gate 1: Check if root domain is blacklisted
    let isBlocked = memoryStore.blockedDomains.has(rootDomain)
    if (db && !isBlocked) {
      try {
        const bRow: any = await db.prepare("SELECT root_domain FROM blocked_domains WHERE root_domain = ? LIMIT 1").bind(rootDomain).first()
        if (bRow) isBlocked = true
      } catch {}
    }
    if (isBlocked) {
      return c.json({ error: 'Submissions from your origin domain are blocked by this shop.' }, 403)
    }

    // Gate 2: Check if shop is in business mode and letterbox is enabled
    let letterboxEnabled = memoryStore.config.get('inquiry_letterbox_enabled') !== 'false'
    let accountType = memoryStore.config.get('account_type') || 'personal'
    if (db) {
      try {
        const lRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'inquiry_letterbox_enabled'").first()
        if (lRow) letterboxEnabled = lRow.value === 'true'
        const aRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'account_type'").first()
        if (aRow) accountType = aRow.value
      } catch {}
    }

    if (accountType !== 'business') {
      return c.json({ error: 'This account is currently in Personal mode. Customer inquiries are reserved for Business accounts.' }, 403)
    }

    if (!letterboxEnabled) {
      return c.json({ error: 'The shop owner has temporarily closed customer inquiries.' }, 403)
    }

    // Gate 3: The 1-Card Gate (Strict Deduplication per User / Handle / Domain)
    let alreadyHasPending = false
    for (const [, inq] of memoryStore.inquiries) {
      if (inq.status === 'pending') {
        const matchHandle = inq.sender_handle === cleanSenderHandle
        const matchUser = cleanSenderUserId && inq.sender_user_id === cleanSenderUserId
        const matchDomain = !cleanSenderUserId && inq.sender_root_domain === rootDomain
        if (matchHandle || matchUser || matchDomain) {
          alreadyHasPending = true
          break
        }
      }
    }
    if (db && !alreadyHasPending) {
      try {
        const existingRow: any = await db.prepare(
          "SELECT id FROM static_inquiries WHERE (sender_handle = ? OR (sender_user_id IS NOT NULL AND sender_user_id = ?) OR (? IS NULL AND sender_root_domain = ?)) AND status = 'pending' LIMIT 1"
        ).bind(cleanSenderHandle, cleanSenderUserId || '', cleanSenderUserId, rootDomain).first()
        if (existingRow) alreadyHasPending = true
      } catch {}
    }

    if (alreadyHasPending) {
      return c.json({
        error: 'You have already dropped a note for this shop. Please wait for the owner to reply before sending another.',
        code: 'CARD_ALREADY_PENDING',
      }, 429)
    }

    // Gate 4: Queue Capacity Check (Max 20 pending inquiries per shop)
    let pendingCount = 0
    if (db) {
      try {
        const countRow: any = await db.prepare("SELECT COUNT(*) as count FROM static_inquiries WHERE status = 'pending'").first()
        if (countRow?.count !== undefined) pendingCount = countRow.count
      } catch {}
    } else {
      pendingCount = Array.from(memoryStore.inquiries.values()).filter(i => i.status === 'pending').length
    }

    if (pendingCount >= 20) {
      return c.json({
        error: "The shop's inquiry letterbox is currently full (20 notes max). Please try again shortly.",
        code: 'LETTERBOX_FULL',
      }, 429)
    }

    // Gate 5: Store the 1-Card Note (Bound to real account if authenticated)
    const inquiryId = 'inq_' + Math.random().toString(36).slice(2, 9)
    const inquiryRecord: MemInquiry = {
      id: inquiryId,
      sender_handle: cleanSenderHandle,
      sender_name: cleanSenderName,
      sender_user_id: cleanSenderUserId || undefined,
      sender_root_domain: rootDomain,
      sender_origin_url: origin,
      category: category ? category.trim() : undefined,
      content: formattedContent,
      status: 'pending',
      created_at: now,
    }

    memoryStore.inquiries.set(inquiryId, inquiryRecord)

    if (db) {
      try {
        await db.prepare(
          'INSERT INTO static_inquiries (id, sender_handle, sender_name, sender_user_id, sender_root_domain, sender_origin_url, category, content, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "pending", ?)'
        ).bind(inquiryId, cleanSenderHandle, cleanSenderName, cleanSenderUserId, rootDomain, origin, category?.trim() || null, formattedContent, now).run()
      } catch (d1Err: any) {
        console.warn('[D1 Inquiry Insert Warning]', d1Err?.message)
      }
    }

    // Broadcast event & Push notification to shop owner (0 compute invocations on receiver)
    await broadcastAllStreams('new_customer_inquiry', inquiryRecord, c.env)

    try {
      await sendPushNotification(c.env, null, {
        title: `📩 Customer Note: ${cleanSenderName}`,
        body: cleanContent,
        conversationId: 'inquiries',
        url: '/?tab=inquiries',
      })
    } catch {}

    return c.json({
      success: true,
      inquiryId,
      senderHandle: cleanSenderHandle,
      senderName: cleanSenderName,
      senderUserId: cleanSenderUserId,
      message: 'Your inquiry note has been safely placed in the shop letterbox!',
    }, 201)
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to submit inquiry' }, 400)
  }
})

// Inquiries list: Business owner gets shop's inbox; Private customer gets their sent notes
inquiryRoutes.get('/api/inquiries', async (c) => {
  const db = c.env?.DB
  if (db) {
    await ensureD1Database(db)
  }

  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  let authedUser: any = null
  if (token) {
    authedUser = await validateSession(token, db)
  }

  const queryHandle = c.req.query('handle')?.replace(/^@/, '').toLowerCase()
  const queryUserId = c.req.query('userId')
  const effectiveHandle = authedUser?.handle || queryHandle || null
  const effectiveUserId = authedUser?.id || queryUserId || null

  let accountType = memoryStore.config.get('account_type') || 'personal'
  if (db) {
    try {
      const aRow: any = await db.prepare("SELECT value FROM system_config WHERE key = 'account_type'").first()
      if (aRow) accountType = aRow.value
    } catch {}
  }

  const isBusinessOwner = accountType === 'business' && (!authedUser || authedUser.role === 'admin')
  let list: any[] = []

  if (db) {
    try {
      if (isBusinessOwner) {
        const { results } = await db.prepare('SELECT * FROM static_inquiries ORDER BY created_at DESC LIMIT 50').all()
        if (Array.isArray(results)) list = results
      } else if (effectiveHandle || effectiveUserId) {
        const { results } = await db.prepare(
          'SELECT * FROM static_inquiries WHERE sender_handle = ? OR sender_user_id = ? ORDER BY created_at DESC LIMIT 50'
        ).bind(effectiveHandle || '', effectiveUserId || '').all()
        if (Array.isArray(results)) list = results
      }
    } catch (e: any) {
      console.warn('[D1 Inquiries Fetch Warning]', e?.message)
    }
  }

  if (list.length === 0) {
    const all = Array.from(memoryStore.inquiries.values()).sort((a, b) => b.created_at - a.created_at)
    if (isBusinessOwner) {
      list = all
    } else if (effectiveHandle || effectiveUserId) {
      list = all.filter((i) => i.sender_handle === effectiveHandle || (effectiveUserId && i.sender_user_id === effectiveUserId))
    }
  }

  const pendingCount = list.filter((i) => i.status === 'pending').length

  return c.json({
    inquiries: list,
    pendingCount,
    isBusinessOwner,
  })
})

// Shop owner replies / accepts inquiry (Dual-Channel Workflow: 'letterbox' or 'active' friend)
inquiryRoutes.post('/api/inquiries/reply', async (c) => {
  try {
    const { inquiryId, asFriend } = await c.req.json()
    if (!inquiryId) return c.json({ error: 'Inquiry ID required' }, 400)

    const db = c.env?.DB
    const now = Date.now()

    let inquiry = memoryStore.inquiries.get(inquiryId)
    if (!inquiry && db) {
      try {
        await ensureD1Database(db)
        const row: any = await db.prepare('SELECT * FROM static_inquiries WHERE id = ? LIMIT 1').bind(inquiryId).first()
        if (row) inquiry = row
      } catch {}
    }

    if (!inquiry) {
      return c.json({ error: 'Inquiry note not found' }, 404)
    }

    // Mark inquiry accepted
    inquiry.status = 'accepted'
    const conversationId = 'conv_' + inquiry.sender_handle
    const messageId = 'msg_' + Math.random().toString(36).slice(2, 9)
    const convStatus = asFriend ? 'active' : 'letterbox'

    // Dynamically resolve merchant user details from session or database
    const authHeader = c.req.header('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    let merchantUser: any = null
    if (token) {
      merchantUser = await validateSession(token, db)
    }

    let merchantId = merchantUser?.id
    let merchantHandle = merchantUser?.handle
    if (!merchantId) {
      const anyAdmin = Array.from(memoryStore.users.values()).find((u) => u.role === 'admin') || Array.from(memoryStore.users.values())[0]
      if (anyAdmin) {
        merchantId = anyAdmin.id
        merchantHandle = anyAdmin.handle
      }
    }
    if (!merchantId && db) {
      try {
        const aRow: any = await db.prepare("SELECT id, handle FROM users ORDER BY created_at ASC LIMIT 1").first()
        if (aRow) {
          merchantId = aRow.id
          merchantHandle = aRow.handle
        }
      } catch {}
    }
    merchantId = merchantId || 'usr_merchant'
    merchantHandle = merchantHandle || 'merchant'

    // Create conversation record
    const convRecord: MemConversation = {
      id: conversationId,
      user_a: merchantId,
      user_b: inquiry.sender_user_id || inquiry.sender_handle,
      remote_handle: inquiry.sender_handle,
      remote_instance_url: inquiry.sender_origin_url,
      last_message_snippet: inquiry.content,
      last_message_at: now,
      status: convStatus,
    }
    memoryStore.conversations.set(conversationId, convRecord)

    // Store inquiry note content as the opening message
    const msgRecord: MemMessage = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: inquiry.sender_user_id || inquiry.sender_handle,
      content: inquiry.content,
      created_at: now,
      read_at: now,
    }
    memoryStore.messages.push(msgRecord)

    // If asFriend was chosen, also create friendship record (promoting customer to peer friend)
    let friendshipRecord: MemFriendship | null = null
    if (asFriend) {
      const friendshipId = 'fr_priv_' + Math.random().toString(36).slice(2, 9)
      friendshipRecord = {
        id: friendshipId,
        local_user_id: merchantId,
        remote_handle: inquiry.sender_handle,
        remote_instance_url: inquiry.sender_origin_url,
        status: 'active',
        direction: 'outgoing',
        created_at: now,
      }
      memoryStore.friendships.set(friendshipId, friendshipRecord)
    }

    if (db) {
      try {
        await db.prepare("UPDATE static_inquiries SET status = 'accepted' WHERE id = ?").bind(inquiryId).run()
        await db.prepare('INSERT OR REPLACE INTO conversations (id, user_a, user_b, remote_handle, remote_instance_url, last_message_snippet, last_message_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(convRecord.id, convRecord.user_a, convRecord.user_b, convRecord.remote_handle, convRecord.remote_instance_url, convRecord.last_message_snippet, now, convStatus).run()
        await db.prepare('INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, content, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(msgRecord.id, msgRecord.conversation_id, msgRecord.sender_id, msgRecord.content, now, now).run()
        if (friendshipRecord) {
          await db.prepare('INSERT OR REPLACE INTO federation_friendships (id, local_user_id, remote_handle, remote_instance_url, status, direction, created_at) VALUES (?, ?, ?, ?, "active", "outgoing", ?)')
            .bind(friendshipRecord.id, merchantId, inquiry.sender_handle, inquiry.sender_origin_url, now).run()
        }
      } catch (d1Err: any) {
        console.warn('[D1 Reply Convert Warning]', d1Err?.message)
      }
    }

    // Broadcast SSE updates to both business owner and customer in real-time
    await broadcastAllStreams('conversation_updated', convRecord, c.env)
    await broadcastAllStreams('inquiry_status_updated', { inquiryId, status: 'accepted', conversationId }, c.env)
    await broadcastAllStreams('new_message', {
      id: messageId,
      conversationId: conversationId,
      senderId: inquiry.sender_handle,
      senderHandle: inquiry.sender_handle,
      recipientHandle: merchantHandle,
      body: inquiry.content,
      createdAt: new Date(now).toISOString(),
    }, c.env)

    return c.json({
      success: true,
      conversationId,
      status: convStatus,
      message: asFriend
        ? 'Inquiry accepted and customer added as Private Friend!'
        : 'Inquiry accepted as Letterbox Customer Chat!',
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// Business owner accepts inquiry AND adds the customer as a private trusted friend
inquiryRoutes.post('/api/inquiries/add-friend', async (c) => {
  try {
    const { inquiryId } = await c.req.json()
    if (!inquiryId) return c.json({ error: 'Inquiry ID required' }, 400)

    const db = c.env?.DB
    const now = Date.now()

    let inquiry = memoryStore.inquiries.get(inquiryId)
    if (!inquiry && db) {
      try {
        await ensureD1Database(db)
        const row: any = await db.prepare('SELECT * FROM static_inquiries WHERE id = ? LIMIT 1').bind(inquiryId).first()
        if (row) inquiry = row
      } catch {}
    }

    if (!inquiry) {
      return c.json({ error: 'Inquiry note not found' }, 404)
    }

    if (inquiry) inquiry.status = 'accepted'
    const conversationId = 'conv_' + inquiry.sender_handle
    const friendshipId = 'fr_priv_' + Math.random().toString(36).slice(2, 9)
    const messageId = 'msg_' + Math.random().toString(36).slice(2, 9)

    // Create mutual active friendship record
    const friendshipRecord: MemFriendship = {
      id: friendshipId,
      local_user_id: 'usr_admin',
      remote_handle: inquiry.sender_handle,
      remote_instance_url: inquiry.sender_origin_url,
      status: 'active',
      direction: 'outgoing',
      created_at: now,
    }
    memoryStore.friendships.set(friendshipId, friendshipRecord)

    // Create active conversation
    const convRecord: MemConversation = {
      id: conversationId,
      user_a: 'usr_admin',
      user_b: inquiry.sender_handle,
      remote_handle: inquiry.sender_handle,
      remote_instance_url: inquiry.sender_origin_url,
      last_message_snippet: `Added as private friend: ${inquiry.content}`,
      last_message_at: now,
      status: 'active',
    }
    memoryStore.conversations.set(conversationId, convRecord)

    const msgRecord: MemMessage = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: inquiry.sender_handle,
      content: inquiry.content,
      created_at: now,
      read_at: now,
    }
    memoryStore.messages.push(msgRecord)

    if (db) {
      try {
        await db.prepare("UPDATE static_inquiries SET status = 'accepted' WHERE id = ?").bind(inquiryId).run()
        await db.prepare('INSERT OR REPLACE INTO federation_friendships (id, local_user_id, remote_handle, remote_instance_url, status, direction, created_at) VALUES (?, ?, ?, ?, "active", "outgoing", ?)')
          .bind(friendshipId, 'usr_admin', inquiry.sender_handle, inquiry.sender_origin_url, now).run()
        await db.prepare('INSERT OR REPLACE INTO conversations (id, user_a, user_b, remote_handle, remote_instance_url, last_message_snippet, last_message_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, "active")')
          .bind(convRecord.id, convRecord.user_a, convRecord.user_b, convRecord.remote_handle, convRecord.remote_instance_url, convRecord.last_message_snippet, now).run()
        await db.prepare('INSERT OR REPLACE INTO messages (id, conversation_id, sender_id, content, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(msgRecord.id, msgRecord.conversation_id, msgRecord.sender_id, msgRecord.content, now, now).run()
      } catch (d1Err: any) {
        console.warn('[D1 Add Friend Warning]', d1Err?.message)
      }
    }

    await broadcastAllStreams('conversation_updated', convRecord, c.env)
    await broadcastAllStreams('inquiry_status_updated', { inquiryId, status: 'accepted' }, c.env)

    return c.json({
      success: true,
      conversationId,
      friendship: friendshipRecord,
      message: 'Customer added as private friend! Conversation unlocked.',
    })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// Shop owner dismisses inquiry (Optionally blacklists root domain)
inquiryRoutes.post('/api/inquiries/dismiss', async (c) => {
  try {
    const { inquiryId, blockDomain } = await c.req.json()
    if (!inquiryId) return c.json({ error: 'Inquiry ID required' }, 400)

    const db = c.env?.DB
    const now = Date.now()

    let inquiry = memoryStore.inquiries.get(inquiryId)
    if (!inquiry && db) {
      try {
        await ensureD1Database(db)
        const row: any = await db.prepare('SELECT * FROM static_inquiries WHERE id = ? LIMIT 1').bind(inquiryId).first()
        if (row) inquiry = row
      } catch {}
    }

    if (inquiry) inquiry.status = 'dismissed'

    if (db) {
      try {
        await ensureD1Database(db)
        await db.prepare("UPDATE static_inquiries SET status = 'dismissed' WHERE id = ?").bind(inquiryId).run()
      } catch {}
    }

    if (blockDomain && inquiry?.sender_root_domain) {
      const rootDomain = inquiry.sender_root_domain
      memoryStore.blockedDomains.set(rootDomain, { root_domain: rootDomain, reason: `Blocked after dismissing inquiry`, blocked_at: now })
      if (db) {
        try {
          await db.prepare("INSERT OR REPLACE INTO blocked_domains (root_domain, reason, blocked_at) VALUES (?, ?, ?)")
            .bind(rootDomain, `Blocked after dismissing inquiry`, now).run()
        } catch {}
      }
    }

    await broadcastAllStreams('inquiry_status_updated', { inquiryId, status: 'dismissed' }, c.env)

    return c.json({ success: true, dismissed: true, domainBlocked: Boolean(blockDomain) })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default inquiryRoutes
