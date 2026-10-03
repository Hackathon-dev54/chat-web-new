// ============================================================================
// Edge-Native Web Push Engine (RFC 8291 & RFC 8292) using Pure WebCrypto
// 100% Cloudflare Workers Compatible (Zero Node.js Dependencies)
// ============================================================================

// Default P-256 VAPID Keypair (Can be overridden via env.VAPID_PUBLIC_KEY & env.VAPID_PRIVATE_KEY)
export const DEFAULT_VAPID_PUBLIC_KEY =
  'BFVoI06UUuNBUx-lbgmrz4EOJjwtFcqxVekEeQnx6RvfdfI3MkosCXFnVBaE0PXCh7AchejioiOvbpDv9hzEwXI'
export const DEFAULT_VAPID_PRIVATE_KEY =
  'lFdSjHfGp66CX0HN1bPu0VuWgunIs_sqrZ0sppdijwk'
export const DEFAULT_VAPID_SUBJECT = 'mailto:notifications@chatze.local'

export interface PushSubscriptionRecord {
  id: string
  userHandle: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
  createdAt: number
}

// In-memory fallback if D1 is not bound
export const memoryPushSubscriptions = new Map<string, PushSubscriptionRecord>()

// Helper: base64url to Uint8Array
export function base64UrlToBytes(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Helper: Uint8Array to base64url
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Helper: Concatenate Uint8Arrays
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, curr) => acc + curr.byteLength, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.byteLength
  }
  return result
}

// Helper: HMAC-SHA-256
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, data))
}

// Helper: HKDF Extract
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return await hmacSha256(salt, ikm)
}

// Helper: HKDF Expand
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  let output: any = new Uint8Array(0)
  let t: any = new Uint8Array(0)
  let counter = 1
  while (output.length < length) {
    t = await hmacSha256(prk, concatBytes(t, info, new Uint8Array([counter])))
    output = concatBytes(output, t)
    counter++
  }
  return output.slice(0, length)
}

// Generate RFC 8292 VAPID Authorization JWT
export async function createVapidJwt(
  endpointOrigin: string,
  env?: any
): Promise<string> {
  const pubB64 = env?.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY
  const privB64 = env?.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY
  const subject = env?.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT

  const rawPub = base64UrlToBytes(pubB64)
  const x = bytesToBase64Url(rawPub.subarray(1, 33))
  const y = bytesToBase64Url(rawPub.subarray(33, 65))

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: privB64 },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const headerJson = JSON.stringify({ alg: 'ES256', typ: 'JWT' })
  const payloadJson = JSON.stringify({
    aud: endpointOrigin,
    exp: Math.floor(Date.now() / 1000) + 43200, // 12 hours
    sub: subject,
  })

  const headerB64 = bytesToBase64Url(new TextEncoder().encode(headerJson))
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(payloadJson))
  const unsignedToken = `${headerB64}.${payloadB64}`

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  )

  const sigB64 = bytesToBase64Url(new Uint8Array(sig))
  return `${unsignedToken}.${sigB64}`
}

// Encrypt payload according to RFC 8291 (Content-Encoding: aes128gcm)
export async function encryptPayloadAes128Gcm(
  clientP256dh: string,
  clientAuth: string,
  payloadText: string
): Promise<Uint8Array> {
  const clientPubRaw = base64UrlToBytes(clientP256dh)
  const authSecret = base64UrlToBytes(clientAuth)

  // 1. Generate ephemeral ECDH keypair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  )

  // 2. Derive shared ECDH secret
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPubRaw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientKey },
      serverKeyPair.privateKey,
      256
    )
  )

  // 3. RFC 8291 Key derivation
  const keyInfo = concatBytes(
    new TextEncoder().encode('WebPush: info\0'),
    clientPubRaw,
    serverPubRaw
  )
  const prkKey = await hkdfExtract(authSecret, sharedSecret)
  const ikm = await hkdfExpand(prkKey, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const prk = await hkdfExtract(salt, ikm)

  const cek = await hkdfExpand(
    prk,
    new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    16
  )
  const nonce = await hkdfExpand(
    prk,
    new TextEncoder().encode('Content-Encoding: nonce\0'),
    12
  )

  // 4. Encrypt payload with single-record delimiter (0x02)
  const payloadBytes = new TextEncoder().encode(payloadText)
  const recordWithDelimiter = concatBytes(payloadBytes, new Uint8Array([2]))

  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    'AES-GCM',
    false,
    ['encrypt']
  )

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      aesKey,
      recordWithDelimiter
    )
  )

  // 5. Binary format: salt (16) || rs (4) || idlen (1) || key (65) || ciphertext
  const rs = new Uint8Array([0, 0, 16, 0]) // 4096 in big-endian
  const idlen = new Uint8Array([serverPubRaw.length])

  return concatBytes(salt, rs, idlen, serverPubRaw, ciphertext)
}

// Send Web Push notification to a single subscription
export async function sendSingleWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: any,
  env?: any
): Promise<{ success: boolean; status: number }> {
  try {
    const endpointUrl = new URL(sub.endpoint)
    const jwt = await createVapidJwt(endpointUrl.origin, env)
    const vapidPublic = env?.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY

    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload)
    const encryptedBody = await encryptPayloadAes128Gcm(
      sub.p256dh,
      sub.auth,
      payloadString
    )

    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
        Authorization: `vapid t=${jwt}, k=${vapidPublic}`,
      },
      body: encryptedBody,
    })

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
    }
  } catch (err: any) {
    console.warn('[WebPush Dispatch Warning]', err?.message)
    return { success: false, status: 500 }
  }
}

// Dispatch push notifications to all registered devices of a user handle
export async function dispatchUserPushNotifications(
  env: any,
  targetHandle: string,
  payload: { title: string; body: string; conversationId?: string; url?: string }
): Promise<void> {
  const cleanHandle = (targetHandle || '').replace(/^@/, '').trim().toLowerCase()
  if (!cleanHandle) return

  let subscriptions: PushSubscriptionRecord[] = []

  const db = env?.DB
  if (db) {
    try {
      const rows: any = await db
        .prepare('SELECT * FROM push_subscriptions WHERE user_handle = ?')
        .bind(cleanHandle)
        .all()
      if (rows && rows.results) {
        subscriptions = rows.results.map((r: any) => ({
          id: r.id,
          userHandle: r.user_handle,
          endpoint: r.endpoint,
          p256dh: r.p256dh,
          auth: r.auth,
          userAgent: r.user_agent,
          createdAt: r.created_at,
        }))
      }
    } catch (d1Err: any) {
      console.warn('[D1 Push Fetch Warning]', d1Err?.message)
    }
  }

  // Fallback to memoryStore subscriptions
  if (subscriptions.length === 0) {
    for (const [, sub] of memoryPushSubscriptions) {
      if (sub.userHandle === cleanHandle) {
        subscriptions.push(sub)
      }
    }
  }

  if (subscriptions.length === 0) {
    return
  }

  // Dispatch concurrently
  await Promise.all(
    subscriptions.map(async (sub) => {
      const res = await sendSingleWebPush(sub, payload, env)

      // Auto-prune dead/expired subscriptions (HTTP 410 Gone or 404 Not Found)
      if (res.status === 410 || res.status === 404) {
        memoryPushSubscriptions.delete(sub.id)
        if (db) {
          try {
            await db
              .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
              .bind(sub.endpoint)
              .run()
          } catch {}
        }
      }
    })
  )
}
