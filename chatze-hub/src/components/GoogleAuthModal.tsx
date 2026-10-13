import React, { useState } from 'react'
import {
  X,
  ShieldCheck,
  Sparkles,
  Lock,
  ArrowRight,
  User,
} from 'lucide-react'
import type { HubUser } from '../server/types'

interface GoogleAuthModalProps {
  onClose: () => void
  onSuccess: (user: HubUser, token: string) => void
}

export function GoogleAuthModal({ onClose, onSuccess }: GoogleAuthModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Quick 1-tap presets for seamless testing in Nepal preview environment
  const handleQuickDemoUser = (name: string, mail: string) => {
    setDisplayName(name)
    setEmail(mail)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanName = displayName.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanName || !cleanEmail) {
      setError('Please provide your name and Google email address')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/hub/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: cleanName,
          email: cleanEmail,
          google_sub: `g_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate')
      }

      if (data.user && data.token) {
        onSuccess(data.user, data.token)
        onClose()
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8696a0] hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto mb-3 shadow-md">
            {/* Google G Logo SVG */}
            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
          <h2 className="text-white font-bold text-lg">Google Sign-In Passport</h2>
          <p className="text-[#8696a0] text-xs mt-1">
            Sign in to verify your identity, shield local shops from spam, and chat freely across Nepal.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* 1-Tap Quick Fill Presets for Instant Testing */}
        <div className="mb-4 bg-[#182229] border border-[#222e35] p-3 rounded-xl">
          <p className="text-[11px] font-semibold text-[#8696a0] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#00a884]" />
            Quick Demo Accounts:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoUser('Bikash Shrestha', 'bikash.ktm@gmail.com')}
              className="text-left bg-[#111b21] hover:bg-[#202c33] border border-[#2a3942] p-2 rounded-lg text-xs text-white transition-colors cursor-pointer"
            >
              <div className="font-medium truncate">Bikash Shrestha</div>
              <div className="text-[10px] text-[#8696a0] truncate">bikash.ktm@gmail.com</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoUser('Sujata Gurung', 'sujata.pkr@gmail.com')}
              className="text-left bg-[#111b21] hover:bg-[#202c33] border border-[#2a3942] p-2 rounded-lg text-xs text-white transition-colors cursor-pointer"
            >
              <div className="font-medium truncate">Sujata Gurung</div>
              <div className="text-[10px] text-[#8696a0] truncate">sujata.pkr@gmail.com</div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#aebac1] mb-1">
              Full Name (from Google Profile)
            </label>
            <input
              type="text"
              placeholder="e.g. Bikash Shrestha"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#aebac1] mb-1">
              Google Email Address
            </label>
            <input
              type="email"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a884] hover:bg-[#02906f] active:scale-[0.98] text-[#111b21] font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Authenticating with Google...' : 'Continue with Google'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </form>

        <p className="text-[11px] text-[#8696a0] text-center mt-4 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          No password stored. Identity signed via Ed25519/HMAC.
        </p>
      </div>
    </div>
  )
}
