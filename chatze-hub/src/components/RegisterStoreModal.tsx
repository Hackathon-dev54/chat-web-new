import React, { useState } from 'react'
import {
  X,
  Store,
  PlusCircle,
  MapPin,
  Tag,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  LogIn,
} from 'lucide-react'
import type { HubMerchant } from '../server/types'

interface RegisterStoreModalProps {
  authToken: string | null
  onClose: () => void
  onStoreRegistered: (newStore: HubMerchant) => void
  onOpenGoogleLogin?: () => void
}

const CITIES = ['Kathmandu', 'Pokhara', 'Lalitpur', 'Bhaktapur', 'Biratnagar', 'Dharan', 'Butwal', 'Nepalgunj', 'Chitwan']
const CATEGORIES = ['Handicrafts', 'Clothing & Gear', 'Food & Groceries', 'Electronics', 'Jewelry & Gems', 'Books & Art', 'Services & Tour']

export function RegisterStoreModal({
  authToken,
  onClose,
  onStoreRegistered,
  onOpenGoogleLogin,
}: RegisterStoreModalProps) {
  const [deployedUrl, setDeployedUrl] = useState('')
  const [handle, setHandle] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [city, setCity] = useState(CITIES[0])
  const [address, setAddress] = useState('')
  const [bio, setBio] = useState('')
  const [embedUrl, setEmbedUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [phone, setPhone] = useState('')
  const [tags, setTags] = useState('')

  const [loading, setLoading] = useState(false)
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [autoDetected, setAutoDetected] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Automatic Store Detection from Deployed URL
  const handleAutoDetect = async () => {
    const cleanUrl = deployedUrl.trim()
    if (!cleanUrl) {
      setError('Please enter your self-deployed Chatze store URL first')
      return
    }

    setAutoDetecting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/hub/merchants/detect?url=${encodeURIComponent(cleanUrl)}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Could not detect store')
      }

      const d = data.detected || {}
      if (d.handle) setHandle(d.handle)
      if (d.business_name) setBusinessName(d.business_name)
      if (d.letterbox_embed_url) setEmbedUrl(d.letterbox_embed_url)
      if (d.bio) setBio(d.bio)
      if (d.logo_url) setLogoUrl(d.logo_url)

      setAutoDetected(true)
      setSuccess('Store automatically detected! Review details below and click List Store.')
    } catch (err: any) {
      setError(err.message || 'Auto-detect error. You can still fill in details manually.')
    } finally {
      setAutoDetecting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!authToken) {
      setError('Please sign in with Google first so your store is securely linked to your account.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const cleanHandle = handle.replace(/^@/, '').trim().toLowerCase()
    let targetEmbed = embedUrl.trim()
    if (!targetEmbed && deployedUrl.trim()) {
      let base = deployedUrl.trim().replace(/\/+$/, '')
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = 'https://' + base
      }
      targetEmbed = `${base}/letterbox`
    }
    if (targetEmbed && !targetEmbed.startsWith('http://') && !targetEmbed.startsWith('https://')) {
      targetEmbed = 'https://' + targetEmbed
    }

    if (!cleanHandle || !businessName.trim() || !targetEmbed) {
      setError('Please fill in Store Handle, Business Name, and Store Embed URL.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/hub/merchants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          handle: cleanHandle,
          business_name: businessName.trim(),
          category,
          city,
          address: address.trim(),
          bio: bio.trim(),
          letterbox_embed_url: targetEmbed,
          logo_url: logoUrl.trim(),
          phone_whatsapp_optional: phone.trim(),
          tags: tags.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register store')
      }

      setSuccess('Your self-deployed store is now published in the Chatze Hub Directory!')
      if (data.merchant) {
        onStoreRegistered(data.merchant)
        setTimeout(() => onClose(), 1000)
      }
    } catch (err: any) {
      setError(err.message || 'Error registering store')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-xl p-6 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8696a0] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#00a884]/15 border border-[#00a884]/30 flex items-center justify-center text-[#00a884]">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">List Self-Deployed Store</h2>
            <p className="text-[#8696a0] text-xs">
              Connect your independent Chatze instance into the Nepal Sovereign Directory
            </p>
          </div>
        </div>

        {!authToken ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#00a884]/15 border border-[#00a884]/30 text-[#00a884] flex items-center justify-center mx-auto">
              <LogIn className="w-6 h-6" />
            </div>
            <h3 className="text-white font-bold text-base">Sign In Required</h3>
            <p className="text-[#8696a0] text-xs max-w-sm mx-auto leading-relaxed">
              Anyone with a self-deployed Chatze store can list it here, but you must sign in with Google first so your store is securely linked to your account.
            </p>
            {onOpenGoogleLogin && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenGoogleLogin()
                }}
                className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold text-xs px-6 py-2.5 rounded-xl inline-flex items-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Quick URL Auto-Detect Box */}
            <div className="bg-[#182229] border border-[#2a3942] rounded-xl p-3 mb-4">
          <label className="block text-xs font-semibold text-white mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Your Self-Deployed Store URL</span>
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://your-store.pages.dev"
              value={deployedUrl}
              onChange={(e) => setDeployedUrl(e.target.value)}
              className="flex-1 bg-[#111b21] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={autoDetecting || !deployedUrl.trim()}
              className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {autoDetecting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Auto-Detect</span>
            </button>
          </div>
          <p className="text-[10px] text-[#8696a0] mt-1.5">
            Enter your Cloudflare Pages or Workers URL. We automatically read the store name, handle, and embed endpoint.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                Store Handle *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[#8696a0] text-xs">@</span>
                <input
                  type="text"
                  placeholder="ramcrafts"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  required
                  className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                Business Name *
              </label>
              <input
                type="text"
                placeholder="Ram Handicrafts & Wood"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#aebac1] flex items-center gap-1 mb-1">
              <LinkIcon className="w-3 h-3 text-[#00a884]" />
              Store Embed URL (Letterbox or Shop) *
            </label>
            <input
              type="text"
              placeholder="https://ram-crafts.pages.dev/letterbox"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              required
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                City / Region *
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#aebac1] mb-1">
              Store Bio / Description
            </label>
            <textarea
              rows={2}
              placeholder="Describe your craft, goods, and location in Nepal..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                Physical Address (Optional)
              </label>
              <input
                type="text"
                placeholder="Thamel, Kathmandu"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                Phone / WhatsApp (Optional)
              </label>
              <input
                type="text"
                placeholder="+977 98..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#202c33] hover:bg-[#2a3942] text-white text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold text-xs px-5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Publishing...' : 'Publish to Chatze Hub'}</span>
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  )
}
