import React, { useState, useEffect, useRef } from 'react'
import { X, ShieldCheck, RefreshCw, Lock, AlertCircle } from 'lucide-react'
import type { HubUser } from '../server/types'

interface GoogleAuthModalProps {
  onClose: () => void
  onSuccess: (user: HubUser, token: string) => void
}

declare global {
  interface Window {
    google?: any
  }
}

// Safely decode a Google JWT ID Token payload in browser
function decodeGoogleJwtPayload(jwtToken: string) {
  try {
    const base64Url = jwtToken.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    console.warn('Failed to parse JWT payload', e)
    return null
  }
}

export function GoogleAuthModal({ onClose, onSuccess }: GoogleAuthModalProps) {
  // Reads Google Client ID directly from environment (.env)
  const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gisLoaded, setGisLoaded] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)

  // Dynamically load official Google Identity Services SDK
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGisLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      setGisLoaded(true)
    }
    script.onerror = () => {
      setError('Unable to load Google Identity Services. Please check your internet connection.')
    }
    document.head.appendChild(script)
  }, [])

  // Handle Google Credential Response from Google Identity Services
  const handleGoogleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      setError('No credential received from Google.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const payload = decodeGoogleJwtPayload(response.credential)
      const gSub = payload?.sub || ''
      const gEmail = payload?.email || ''
      const gName = payload?.name || gEmail.split('@')[0] || 'Google User'
      const gAvatar = payload?.picture || ''

      const res = await fetch('/api/hub/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          google_sub: gSub,
          email: gEmail,
          display_name: gName,
          avatar_url: gAvatar,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate with Google')
      }

      if (data.user && data.token) {
        onSuccess(data.user, data.token)
        onClose()
      }
    } catch (err: any) {
      setError(err.message || 'Google Authentication error')
    } finally {
      setLoading(false)
    }
  }

  // Initialize Google Identity Services when GIS is ready & Client ID is configured
  useEffect(() => {
    if (!gisLoaded || !clientId || !window.google?.accounts?.id) return

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      })

      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
        })
      }

      // Trigger standard One Tap prompt if supported
      try {
        window.google.accounts.id.prompt(() => {})
      } catch {}
    } catch (err) {
      console.warn('Error initializing Google Accounts ID', err)
    }
  }, [gisLoaded, clientId])

  const triggerGooglePrompt = () => {
    if (!clientId) {
      setError('Google Client ID is not configured in .env. Please set VITE_GOOGLE_CLIENT_ID.')
      return
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed()) {
            console.log('One Tap was not displayed, reason:', notification.getNotDisplayedReason())
          }
        })
      } catch (err) {
        console.warn('Failed to prompt GIS', err)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8696a0] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Google G Logo Badge */}
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-7 h-7" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        </div>

        <h2 className="text-white font-bold text-lg mb-1">Sign in with Google</h2>
        <p className="text-[#8696a0] text-xs leading-relaxed mb-6">
          Connect to explore sovereign stores across Nepal or register your self-deployed Chatze store.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Real Google Button Container */}
        <div className="flex flex-col items-center justify-center min-h-[56px] my-2">
          {clientId ? (
            <div className="w-full flex justify-center">
              <div ref={googleButtonRef} className="flex justify-center" />
            </div>
          ) : (
            <div className="p-3 bg-[#182229] border border-[#2a3942] rounded-xl text-xs text-[#8696a0] text-left">
              <p className="text-white font-medium mb-1">Google OAuth Client ID Required</p>
              <p className="text-[11px] text-[#8696a0]">
                Add <code className="text-[#00a884] font-mono">VITE_GOOGLE_CLIENT_ID</code> in your <code className="text-white font-mono">.env</code> file to enable official Google Sign-In.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#00a884] mt-3">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Verifying Google account...</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#222e35] mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#8696a0]">
          <Lock className="w-3 h-3 text-[#00a884]" />
          <span>Zero passwords stored. Sovereign identity verification.</span>
        </div>
      </div>
    </div>
  )
}
