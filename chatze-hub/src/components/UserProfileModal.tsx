import React, { useState, useEffect } from 'react'
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Store,
  Sparkles,
  User,
  Trash2,
  RefreshCw,
  Eye,
  MessageSquare,
} from 'lucide-react'
import type { HubUser, HubMerchant } from '../server/types'

interface UserProfileModalProps {
  user: HubUser
  authToken: string | null
  onClose: () => void
  onUpdateUser: (updated: HubUser) => void
  onOpenStoreEmbed?: (merchant: HubMerchant) => void
  onStoreUpdated?: () => void
}

export function UserProfileModal({
  user,
  authToken,
  onClose,
  onUpdateUser,
  onOpenStoreEmbed,
  onStoreUpdated,
}: UserProfileModalProps) {
  const [myStore, setMyStore] = useState<HubMerchant | null>(null)
  const [loadingStore, setLoadingStore] = useState(true)

  // Quick link store form state
  const [storeUrlInput, setStoreUrlInput] = useState('')
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [detectedData, setDetectedData] = useState<any>(null)
  const [savingStore, setSavingStore] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch the user's currently registered store (if any)
  const fetchMyStore = async () => {
    if (!authToken) {
      setLoadingStore(false)
      return
    }
    setLoadingStore(true)
    try {
      const res = await fetch('/api/hub/merchants/my-store', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMyStore(data.store || null)
      }
    } catch (err) {
      console.warn('Failed to fetch my store', err)
    } finally {
      setLoadingStore(false)
    }
  }

  useEffect(() => {
    fetchMyStore()
  }, [user.google_sub, authToken])

  // Automatically detect store details from the self-deployed URL
  const handleAutoDetect = async () => {
    const cleanUrl = storeUrlInput.trim()
    if (!cleanUrl) {
      setError('Please enter your self-deployed Chatze store URL first')
      return
    }

    setAutoDetecting(true)
    setError('')
    setSuccess('')
    setDetectedData(null)

    try {
      const res = await fetch(`/api/hub/merchants/detect?url=${encodeURIComponent(cleanUrl)}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach or detect store')
      }

      setDetectedData(data.detected)
      setSuccess('Store automatically detected! Ready to connect to Chatze Hub.')
    } catch (err: any) {
      setError(err.message || 'Failed to auto-detect store')
    } finally {
      setAutoDetecting(false)
    }
  }

  // Publish / Register the detected store
  const handleSaveStore = async () => {
    if (!detectedData && !storeUrlInput.trim()) return

    setSavingStore(true)
    setError('')
    setSuccess('')

    let cleanUrl = storeUrlInput.trim()
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl
    }
    let targetEmbed = detectedData?.letterbox_embed_url || `${cleanUrl.replace(/\/+$/, '')}/letterbox`
    if (!targetEmbed.startsWith('http://') && !targetEmbed.startsWith('https://')) {
      targetEmbed = 'https://' + targetEmbed
    }
    const targetHandle = detectedData?.handle || 'store'
    const targetName = detectedData?.business_name || 'My Sovereign Store'

    try {
      const res = await fetch('/api/hub/merchants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          handle: targetHandle,
          business_name: targetName,
          category: 'Handicrafts',
          city: 'Kathmandu',
          bio: detectedData?.bio || 'Sovereign Chatze merchant store',
          letterbox_embed_url: targetEmbed,
          logo_url: detectedData?.logo_url || user.avatar_url,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register store')
      }

      setSuccess('Your self-deployed Chatze store is now live in the Hub Directory!')
      setMyStore(data.merchant)
      setDetectedData(null)
      setStoreUrlInput('')

      onUpdateUser({
        ...user,
        sovereign_node_url: cleanUrl,
        sovereign_handle: targetHandle,
        sovereign_verified_at: Date.now(),
      })
      onStoreUpdated?.()
    } catch (err: any) {
      setError(err.message || 'Error connecting store')
    } finally {
      setSavingStore(false)
    }
  }

  // Unlink store
  const handleUnlinkStore = async () => {
    if (!confirm('Are you sure you want to remove your store from the Chatze Hub directory?')) {
      return
    }

    setSavingStore(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/hub/merchants/my-store', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove store')
      }

      setMyStore(null)
      setSuccess('Store removed from the Hub directory.')
      onUpdateUser({
        ...user,
        sovereign_node_url: null,
        sovereign_handle: null,
        sovereign_verified_at: null,
      })
      onStoreUpdated?.()
    } catch (err: any) {
      setError(err.message || 'Error removing store')
    } finally {
      setSavingStore(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative my-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8696a0] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* User Identity Header */}
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-[#222e35]">
          <div className="w-14 h-14 rounded-2xl bg-[#202c33] border border-[#2a3942] overflow-hidden flex items-center justify-center flex-shrink-0 shadow-md">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-7 h-7 text-[#00a884]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-base truncate">{user.display_name}</h2>
            <p className="text-[#8696a0] text-xs font-mono truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#182229] border border-[#00a884]/40 text-[#00a884]">
                <ShieldCheck className="w-3 h-3" />
                Google Verified Identity
              </span>
              {myStore && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#00a884]/15 border border-[#00a884]/30 text-[#00a884]">
                  <Store className="w-3 h-3" />
                  Merchant Store Listed
                </span>
              )}
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

        {/* SECTION: FOR MERCHANTS WITH A REGISTERED STORE */}
        {loadingStore ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#8696a0]">
            <RefreshCw className="w-4 h-4 animate-spin text-[#00a884]" />
            <span>Loading store status...</span>
          </div>
        ) : myStore ? (
          <div className="space-y-4">
            <div className="bg-[#182229] border border-[#222e35] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#00a884]" />
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider">
                    My Registered Sovereign Store
                  </h3>
                </div>
                <span className="text-[10px] bg-emerald-500/15 text-[#00a884] border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                  Active in Hub
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8696a0]">Business Name:</span>
                  <span className="text-white font-medium">{myStore.business_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8696a0]">Store Handle:</span>
                  <span className="text-[#00a884] font-mono">@{myStore.handle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8696a0]">Embed Endpoint:</span>
                  <a
                    href={myStore.letterbox_embed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00a884] font-mono hover:underline flex items-center gap-1 truncate max-w-[220px]"
                  >
                    <span className="truncate">{myStore.letterbox_embed_url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>

                <div className="pt-2 mt-2 border-t border-[#222e35] grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#111b21] p-2 rounded-lg border border-[#222e35]">
                    <div className="text-[10px] text-[#8696a0] flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3 text-[#00a884]" /> Views
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">{myStore.view_count || 0}</div>
                  </div>
                  <div className="bg-[#111b21] p-2 rounded-lg border border-[#222e35]">
                    <div className="text-[10px] text-[#8696a0] flex items-center justify-center gap-1">
                      <MessageSquare className="w-3 h-3 text-[#00a884]" /> Inquiries
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">{myStore.inquiry_clicks || 0}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {onOpenStoreEmbed && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenStoreEmbed(myStore)
                      onClose()
                    }}
                    className="flex-1 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Embed</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleUnlinkStore}
                  disabled={savingStore}
                  className="bg-[#202c33] hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/30 text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Remove from directory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Unlist Store</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* SECTION: FOR CONSUMERS OR MERCHANTS WHO HAVEN'T LINKED THEIR STORE YET */
          <div className="bg-[#182229] border border-[#222e35] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-4 h-4 text-[#00a884]" />
              <h3 className="text-white font-semibold text-xs uppercase tracking-wider">
                Are You a Business Owner in Nepal?
              </h3>
            </div>
            <p className="text-[#8696a0] text-xs leading-relaxed mb-4">
              If you have already self-deployed your Chatze store on Cloudflare Pages or Workers, paste your deployed URL below. We will automatically detect your store and embed it in the Hub directory.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#aebac1] mb-1">
                  Self-Deployed Store URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://your-store.pages.dev"
                    value={storeUrlInput}
                    onChange={(e) => {
                      setStoreUrlInput(e.target.value)
                      setDetectedData(null)
                    }}
                    className="flex-1 bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={autoDetecting || !storeUrlInput.trim()}
                    className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-semibold text-xs px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {autoDetecting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{autoDetecting ? 'Detecting...' : 'Auto-Detect'}</span>
                  </button>
                </div>
              </div>

              {detectedData && (
                <div className="p-3 bg-[#111b21] border border-[#00a884]/40 rounded-xl space-y-2 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between text-[#00a884] font-semibold text-[11px]">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Store Automatically Detected
                    </span>
                    <span className="font-mono text-[10px]">@{detectedData.handle}</span>
                  </div>
                  <div className="text-white font-medium">{detectedData.business_name}</div>
                  {detectedData.bio && (
                    <div className="text-[#8696a0] text-[11px] line-clamp-2">{detectedData.bio}</div>
                  )}
                  <div className="text-[10px] text-[#8696a0] font-mono truncate">
                    Embed URL: {detectedData.letterbox_embed_url}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveStore}
                    disabled={savingStore}
                    className="w-full bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                  >
                    <Store className="w-4 h-4" />
                    <span>{savingStore ? 'Connecting...' : 'Add My Store to Chatze Hub'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#202c33] hover:bg-[#2a3942] text-white text-xs px-5 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
