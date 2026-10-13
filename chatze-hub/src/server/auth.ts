import type { HubBindings, IdentityTokenPayload, HubUser } from './types'

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) {
    s += '='
  }
  return atob(s)
}

/**
 * Creates an HMAC-SHA256 signature using the Web Crypto API (supported globally in Cloudflare Workers and browser)
 */
async function createHmacSha256(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const binary = String.fromCharCode(...new Uint8Array(signature))
  return base64UrlEncode(binary)
}

/**
 * Signs a verifiable Hub Identity Token to pass to merchant Letterboxes
 */
export async function createHubIdentityToken(user: HubUser, secret: string = 'chatze-hub-default-secret'): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload: IdentityTokenPayload = {
    google_sub: user.google_sub,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    sovereign_node_url: user.sovereign_node_url,
    sovereign_handle: user.sovereign_handle,
    iss: 'chatze-hub-gateway',
    iat: now,
    exp: now + 86400 * 7, // 7 days expiration
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const dataToSign = `${encodedHeader}.${encodedPayload}`
  const signature = await createHmacSha256(dataToSign, secret)

  return `${dataToSign}.${signature}`
}

/**
 * Verifies a Hub Identity Token
 */
export async function verifyHubIdentityToken(token: string, secret: string = 'chatze-hub-default-secret'): Promise<IdentityTokenPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerB64, payloadB64, signature] = parts
    const dataToSign = `${headerB64}.${payloadB64}`
    const expectedSig = await createHmacSha256(dataToSign, secret)

    if (signature !== expectedSig) {
      return null
    }

    const payload: IdentityTokenPayload = JSON.parse(base64UrlDecode(payloadB64))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
