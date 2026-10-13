import React, { useState } from 'react'
import {
  X,
  ShieldCheck,
  Globe,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Unlink,
  Server,
  Sparkles,
  User,
} from 'lucide-react'
import type { HubUser } from '../server/types'

interface UserProfileModalProps {
  user: HubUser
  authToken: string | null
  onClose: () => void
  onUpdateUser: (updated: HubUser) => void
}

export function UserProfileModal({
  user,
  authToken,
  onClose,
  onUpdateUser,
}: UserProfileModalProps) {
  const [nodeUrl, setNodeUrl] = useState(user.sovereign_node_url || '')
  const [handle, setHandle] = useState(user.sovereign_handle || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLinkNode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/hub/user/link-sovereign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          node_url: nodeUrl.trim(),
          handle: handle.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link sovereign node')
      }

      setSuccess('Sovereign Chatze Node successfully linked!')
      if (data.user) {
        onUpdateUser(data.user)
      }
    } catch (err: any) {
      setError(err.message || 'Error linking node')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlinkNode = async () => {
    if (!confirm('Are you sure you want to unlink your Sovereign node? You will return to standard Google identity.')) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/hub/user/unlink-sovereign', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to unlink node')
      }

      setSuccess('Sovereign node unlinked successfully.')
      onUpdateUser({
        ...user,
        sovereign_node_url: null,
        sovereign_handle: null,
        sovereign_verified_at: null,
      })
      setNodeUrl('')
      setHandle('')
    } catch (err: any) {
      setError(err.message || 'Error unlinking node')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8696a0] hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#202c33] border border-[#2a3942] overflow-hidden flex items-center justify-center flex-shrink-0">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-7 h-7 text-[#00a884]" />
            )}
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">{user.display_name}</h2>
            <p className="text-[#8696a0] text-xs font-mono">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#182229] border border-[#00a884]/30 text-[#00a884]">
                <ShieldCheck className="w-3 h-3" />
                Verified Google Identity
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Sovereign Node Section (Dual Identity) */}
        <div className="bg-[#182229] border border-[#222e35] rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#00a884]" />
              <h3 className="text-white font-semibold text-xs uppercase tracking-wider">
                Sovereign Node Link (Self-Deployed Chatze)
              </h3>
            </div>
            {user.sovereign_node_url && (
              <span className="text-[10px] bg-emerald-500/20 text-[#00a884] border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                Active Node
              </span>
            )}
          </div>

          <p className="text-[#8696a0] text-xs leading-relaxed mb-4">
            If you have self-deployed your own Chatze node on Cloudflare Pages, link your URL here.
            Merchants will be able to promote you to a <strong>Sovereign Friend</strong> for direct, middleman-free, encrypted chats!
          </p>

          {user.sovereign_node_url ? (
            <div className="space-y-3">
              <div className="bg-[#111b21] p-3 rounded-lg border border-[#2a3942]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8696a0]">Node Address:</span>
                  <a
                    href={user.sovereign_node_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00a884] text-xs font-mono hover:underline flex items-center gap-1"
                  >
                    {user.sovereign_node_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {user.sovereign_handle && (
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#222e35]">
                    <span className="text-xs text-[#8696a0]">Sovereign Handle:</span>
                    <span className="text-white text-xs font-mono">@{user.sovereign_handle}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleUnlinkNode}
                disabled={loading}
                className="w-full bg-[#202c33] hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/30 text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Unlink Sovereign Node</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleLinkNode} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#aebac1] mb-1">
                  Sovereign Chatze Node URL
                </label>
                <input
                  type="url"
                  placeholder="https://yourname.pages.dev"
                  value={nodeUrl}
                  onChange={(e) => setNodeUrl(e.target.value)}
                  required
                  className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#aebac1] mb-1">
                  Node Handle (Optional)
                </label>
                <input
                  type="text"
                  placeholder="bikash"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>{loading ? 'Verifying Node...' : 'Link Sovereign Node'}</span>
              </button>
            </form>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#202c33] hover:bg-[#2a3942] text-white text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
