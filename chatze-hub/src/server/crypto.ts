/**
 * Cryptographic verification utilities for Chatze Hub Gateway
 * Uses standard Web Crypto API (SubtleCrypto) supported on Cloudflare Workers and browser
 */

/**
 * Verifies an ECDSA P-256 SHA-256 signature from a self-deployed Chatze sovereign node
 * @param publicKeyBase64 Base64 encoded JSON Web Key (JWK) exported from node
 * @param nonce The raw challenge nonce string sent by the Hub
 * @param signatureBase64 Base64 encoded signature returned by the node
 */
export async function verifyNodeChallengeSignature(
  publicKeyBase64: string,
  nonce: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    if (!publicKeyBase64 || !nonce || !signatureBase64) return false

    // Decode public key JWK
    const jwkString = atob(publicKeyBase64)
    const pubJwk = JSON.parse(jwkString)

    // Import the public key
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      pubJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )

    // Decode signature bytes
    const sigBinary = atob(signatureBase64)
    const sigBytes = new Uint8Array(sigBinary.length)
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i)
    }

    // Encode nonce bytes
    const nonceBytes = new TextEncoder().encode(nonce)

    // Verify ECDSA signature
    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sigBytes,
      nonceBytes
    )

    return isValid
  } catch (err) {
    console.warn('[Hub Crypto Node Verification Error]', err)
    return false
  }
}

/**
 * Generate a cryptographically random challenge nonce
 */
export function generateChallengeNonce(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
