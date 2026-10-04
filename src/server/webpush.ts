import { buildPushPayload } from '@block65/webcrypto-web-push'

// Permanent zero-setup fallback VAPID keypair (Pure WebCrypto P-256 verified)
// Can be overridden anytime via Cloudflare Worker environment variables:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT
export const DEFAULT_VAPID_PUBLIC_KEY = 'BAV9SIwwOf2vhDMwhjs0H9To0hiJvc-BDRl1E3ZxV4p35Ykdw74vCo_Bpp1GfRAEnG2oQyD8vqH_dVywN0QHXZM'
export const DEFAULT_VAPID_PRIVATE_KEY = 'FzqTh8OqvMz91eyBVnx6jEiY_EX_OIMThvrL4ulp4pQ'
export const DEFAULT_VAPID_SUBJECT = 'mailto:support@chatze.app'

export interface PushNotificationPayload {
  title: string
  body: string
  url?: string
  conversationId?: string
}

export interface StoredSubscription {
  id: string
  user_handle: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string
  created_at: number
}

export interface PushDeliveryResult {
  endpoint: string
  status: number
  ok: boolean
  error?: string
}

export interface PushDispatchSummary {
  dispatched: number
  successful: number
  results: PushDeliveryResult[]
}

// In-memory fallback for subscriptions when running locally without D1
export const memoryPushSubscriptions = new Map<string, StoredSubscription>()

export function getVapidKeys(env?: any) {
  return {
    publicKey: env?.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY,
    privateKey: env?.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY,
    subject: env?.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT,
  }
}

/**
 * Dispatch background push notification to registered devices.
 * If targetHandle is provided, attempts to target that user first.
 * If no device matches that specific handle (or targetHandle is empty/null),
 * it targets all active devices registered to this instance so alerts are NEVER dropped.
 */
export async function sendPushNotification(
  env: any,
  targetHandle: string | null | undefined,
  notification: PushNotificationPayload
): Promise<PushDispatchSummary> {
  const cleanTarget = (targetHandle || '').replace(/^@/, '').trim().toLowerCase()
  const vapid = getVapidKeys(env)
  const subscriptions: StoredSubscription[] = []
  const db = env?.DB

  // 1. Fetch from D1 if available
  if (db) {
    try {
      await db
        .prepare(
          'CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_handle TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at INTEGER NOT NULL)'
        )
        .run()

      if (cleanTarget && cleanTarget !== 'all') {
        const { results } = await db
          .prepare('SELECT id, user_handle, endpoint, p256dh, auth, user_agent, created_at FROM push_subscriptions WHERE user_handle = ?')
          .bind(cleanTarget)
          .all()
        if (Array.isArray(results) && results.length > 0) {
          subscriptions.push(...(results as StoredSubscription[]))
        }
      }

      // If no devices found for specific handle (e.g. handle mismatch or inbound federation message),
      // fetch all subscriptions on this personal instance
      if (subscriptions.length === 0) {
        const { results } = await db
          .prepare('SELECT id, user_handle, endpoint, p256dh, auth, user_agent, created_at FROM push_subscriptions')
          .all()
        if (Array.isArray(results)) {
          subscriptions.push(...(results as StoredSubscription[]))
        }
      }
    } catch (e: any) {
      console.warn('[Push Query D1 Warning]', e?.message)
    }
  }

  // 2. Fetch from in-memory fallback
  if (subscriptions.length === 0) {
    for (const sub of memoryPushSubscriptions.values()) {
      if (!cleanTarget || sub.user_handle === cleanTarget || memoryPushSubscriptions.size <= 5) {
        subscriptions.push(sub)
      }
    }
  }

  if (subscriptions.length === 0) {
    console.log('[WebPush] No registered push subscriptions found to dispatch.')
    return { dispatched: 0, successful: 0, results: [] }
  }

  // 3. Dispatch to all matched endpoints in parallel
  const payloadJson = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url || '/',
    conversationId: notification.conversationId,
  })

  const results: PushDeliveryResult[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const payload = await buildPushPayload(
          { data: payloadJson },
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
            expirationTime: null,
          },
          vapid
        )

        const headers: Record<string, string> = {
          ...payload.headers,
        }

        // RFC 8030 High Urgency for instant Android FCM wake & delivery
        headers['Urgency'] = 'high'
        headers['urgency'] = 'high'
        headers['TTL'] = '86400'
        headers['ttl'] = '86400'

        // Apple APNs Web Push Requirements for iOS Safari:
        // 'apns-push-type: alert' and 'apns-priority: 10' are mandatory for immediate lock-screen wake
        if (sub.endpoint.includes('push.apple.com')) {
          headers['apns-push-type'] = 'alert'
          headers['apns-priority'] = '10'
          headers['apns-expiration'] = '0'
        }

        const res = await fetch(sub.endpoint, {
          method: payload.method,
          headers,
          body: payload.body as any,
        })

        const resText = !res.ok ? await res.text().catch(() => '') : ''
        console.log(`[WebPush Gateway] Status=${res.status} Endpoint=${sub.endpoint.slice(0, 45)} details=${resText}`)

        results.push({
          endpoint: sub.endpoint,
          status: res.status,
          ok: res.ok,
          error: !res.ok ? resText || `HTTP ${res.status}` : undefined,
        })

        // Auto-cleanup stale or expired tokens
        if (res.status === 410 || res.status === 404) {
          memoryPushSubscriptions.delete(sub.endpoint)
          if (db) {
            try {
              await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
            } catch {}
          }
        }
      } catch (err: any) {
        console.warn(`[Push Delivery Failed for ${sub.endpoint.slice(0, 30)}...]`, err?.message)
        results.push({
          endpoint: sub.endpoint,
          status: 0,
          ok: false,
          error: err?.message || 'Network error',
        })
      }
    })
  )

  const successful = results.filter((r) => r.ok).length
  return {
    dispatched: subscriptions.length,
    successful,
    results,
  }
}
