import React, { useState } from 'react'
import {
  X,
  Store,
  PlusCircle,
  MapPin,
  Tag,
  Phone,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import type { HubMerchant } from '../server/types'

interface RegisterStoreModalProps {
  authToken: string | null
  onClose: () => void
  onStoreRegistered: (newStore: HubMerchant) => void
}

const CITIES = ['Kathmandu', 'Pokhara', 'Lalitpur', 'Bhaktapur', 'Biratnagar', 'Dharan', 'Butwal', 'Nepalgunj', 'Chitwan']
const CATEGORIES = ['Handicrafts', 'Clothing & Gear', 'Food & Groceries', 'Electronics', 'Jewelry & Gems', 'Books & Art', 'Services & Tour']

export function RegisterStoreModal({
  authToken,
  onClose,
  onStoreRegistered,
}: RegisterStoreModalProps) {
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
  const [probing, setProbing] = useState(false)
  const [nodeVerified, setNodeVerified] = useState<boolean | null>(null)
  const [nodeProtocol, setNodeProtocol] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const probeNode = async (urlToProbe: string) => {
    if (!urlToProbe.trim()) return
    setProbing(true)
    setNodeVerified(null)
    setError('')
    try {
      const baseUrl = urlToProbe.startsWith('http')
        ? new URL(urlToProbe).origin
        : `${window.location.origin}`
      
      const res = await fetch(`${baseUrl}/.well-known/chatze-node.json`)
      if (res.ok) {
        const data = await res.json()
        if (data.protocol === 'chatze-letterbox-v1') {
          setNodeVerified(true)
          setNodeProtocol(data.protocol)
          if (!handle && data.handle) setHandle(data.handle)
          if (!businessName && data.owner_name) setBusinessName(data.owner_name)
        } else {
          setNodeVerified(false)
        }
      } else {
        setNodeVerified(false)
      }
    } catch {
      setNodeVerified(false)
    } finally {
      setProbing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const cleanHandle = handle.replace(/^@/, '').trim().toLowerCase()
    if (!cleanHandle || !businessName.trim() || !embedUrl.trim()) {
      setError('Please fill in Store Handle, Business Name, and Letterbox Embed URL.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/hub/merchants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          handle: cleanHandle,
          business_name: businessName.trim(),
          category,
          city,
          address: address.trim(),
          bio: bio.trim(),
          letterbox_embed_url: embedUrl.trim(),
          logo_url: logoUrl.trim(),
          phone_whatsapp_optional: phone.trim(),
          tags: tags.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register store')
      }

      setSuccess('Your sovereign store is now listed in the Chatze Hub Directory!')
      if (data.merchant) {
        onStoreRegistered(data.merchant)
        setTimeout(() => onClose(), 1200)
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
          className="absolute top-4 right-4 text-[#8696a0] hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#00a884]/10 border border-[#00a884]/30 flex items-center justify-center text-[#00a884]">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Register Self-Deployed Store</h2>
            <p className="text-[#8696a0] text-xs">
              List your independent Chatze Letterbox in the Nepal Discovery Directory
            </p>
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#aebac1] flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-[#00a884]" />
                Self-Deployed Letterbox URL *
              </label>
              {embedUrl.trim() && (
                <button
                  type="button"
                  onClick={() => probeNode(embedUrl)}
                  disabled={probing}
                  className="text-[10px] text-[#00a884] hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{probing ? 'Probing...' : 'Verify Node Protocol'}</span>
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="https://ram-crafts.pages.dev/letterbox or /shop?shop=ramcrafts"
              value={embedUrl}
              onChange={(e) => {
                setEmbedUrl(e.target.value)
                setNodeVerified(null)
              }}
              required
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none font-mono"
            />
            {nodeVerified === true && (
              <div className="mt-1.5 p-2 bg-[#00a884]/10 border border-[#00a884]/30 rounded-lg text-[11px] text-[#00a884] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Tier 2 Cryptographic Handshake Verified ({nodeProtocol}) • Official Build Badge Granted</span>
              </div>
            )}
            {nodeVerified === false && (
              <div className="mt-1.5 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Custom Community Fork detected or node endpoint unreachable. Store will be registered with Community Fork warning.</span>
              </div>
            )}
            <p className="text-[10px] text-[#8696a0] mt-1">
              This is the URL embedded when users click "Inquire on Hub". Direct browser visits automatically redirect to Chatze Hub.
            </p>
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
              placeholder="Tell customers about your products, quality, and location..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#aebac1] mb-1">
                Physical Market Address (Optional)
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
                placeholder="+977-9800000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#aebac1] mb-1">
              Logo / Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-lg px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
            />
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
              className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-semibold text-xs px-5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Registering...' : 'List Store in Hub'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
