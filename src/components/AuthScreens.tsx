import React, { useState } from 'react'
import { MessageSquare, Lock, ArrowRight, UserPlus, LogIn, ShieldCheck, User } from 'lucide-react'

export function AuthScreens({ onLoginSuccess }: { onLoginSuccess: (user: any, token?: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase()
    if (!cleanUsername) {
      setError('Please enter a username')
      setLoading(false)
      return
    }

    try {
      if (mode === 'signin') {
        const res = await fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername, password }),
        })
        const data = await res.json()
        if (res.ok && data.user) {
          onLoginSuccess(data.user, data.token)
        } else {
          setError(data.error || 'Incorrect username or password')
        }
      } else {
        // Register new account
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUsername,
            displayName: displayName.trim() || cleanUsername,
            password,
          }),
        })
        const data = await res.json()
        if (res.ok && data.user) {
          onLoginSuccess(data.user, data.token)
        } else {
          setError(data.error || 'Registration failed')
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4 font-sans select-none">
      <div className="max-w-md w-full bg-[#111b21] border border-[#202c33] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884] mb-1">
            <MessageSquare className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-[#e9edef] tracking-tight">
            Chatze Nepal
          </h1>
          <p className="text-xs text-[#8696a0]">
            Independent private edge messaging & customer letterbox
          </p>
        </div>

        {/* Tab switch: Sign In vs Create Account */}
        <div className="flex bg-[#0b141a] p-1 rounded-xl border border-[#202c33] text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setError('')
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'signin' ? 'bg-[#202c33] text-[#00a884]' : 'text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError('')
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'register' ? 'bg-[#202c33] text-[#00a884]' : 'text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8696a0]">Your Full Name</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-[#8696a0]">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Suraj Singh"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#202c33] border border-[#222e35] rounded-xl text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8696a0]">Username / Handle</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-[#8696a0] text-sm font-mono">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'register' ? 'suraj_singh' : 'your_handle'}
                className="w-full pl-8 pr-3.5 py-2.5 bg-[#202c33] border border-[#222e35] rounded-xl text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8696a0]">Password</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-[#8696a0]">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-[#202c33] border border-[#222e35] rounded-xl text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#02906f] disabled:opacity-50 text-[#111b21] font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00a884]/20 cursor-pointer"
          >
            {loading ? (
              'Processing...'
            ) : mode === 'signin' ? (
              <>
                <span>Sign In to Chatze</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Create My Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="p-3 bg-[#0b141a]/80 border border-[#202c33] rounded-xl text-[11px] text-[#8696a0] space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-[#e9edef]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Independent & Private for Nepal</span>
          </div>
          <p className="leading-relaxed">
            No central cloud telemetry. Self-deployable, peer-to-peer federated, and anti-spam protected.
          </p>
        </div>
      </div>
    </div>
  )
}
