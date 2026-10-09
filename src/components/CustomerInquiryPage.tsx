import React, { useState, useEffect } from 'react'
import {
  Store,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  MapPin,
  MessageSquare,
  Phone,
  Truck,
  Tag,
  Share2,
  Copy,
  Check,
  BadgeCheck,
  User,
  ExternalLink,
} from 'lucide-react'

interface ShopProfile {
  displayName: string
  handle: string
  accountType: string
  bio: string
  businessCategory: string
  businessPhone?: string
  businessLocation?: string
  businessHours?: string
  deliveryInfo?: string
  catalogTags?: string
  inquiryLetterboxEnabled: boolean
}

interface CustomerInquiryPageProps {
  shopHandle?: string
  currentUser?: { id: string; handle: string; display_name: string; role?: string } | null
  onSwitchToOwnerLogin: () => void
  onGoToApp?: () => void
}

const INQUIRY_CATEGORIES = [
  { id: 'price_stock', label: '🏷️ Price & Stock', hint: 'Ask about sizing, color or pricing' },
  { id: 'delivery', label: '🚚 Delivery & Location', hint: 'Delivery time to your city or valley' },
  { id: 'wholesale', label: '📦 Wholesale / Bulk', hint: 'Special pricing for bulk orders' },
  { id: 'general', label: '❓ General Question', hint: 'Custom inquiry or general request' },
]

export function CustomerInquiryPage({
  shopHandle = 'admin',
  currentUser = null,
  onSwitchToOwnerLogin,
  onGoToApp,
}: CustomerInquiryPageProps) {
  const [profile, setProfile] = useState<ShopProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authedUser, setAuthedUser] = useState<any>(currentUser)
  const [selectedCategory, setSelectedCategory] = useState('🏷️ Price & Stock')
  const [senderName, setSenderName] = useState(currentUser?.display_name || '')
  const [senderContact, setSenderContact] = useState(currentUser?.handle ? `@${currentUser.handle}` : '')
  const [noteContent, setNoteContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingInquiry, setExistingInquiry] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [copiedShare, setCopiedShare] = useState(false)

  // 1. Load shop profile & detect existing auth session
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile(data.profile)
          }
        }

        // If currentUser was not passed directly, verify stored token
        const token = localStorage.getItem('chatze_auth_token')
        let resolvedUser = currentUser
        if (!resolvedUser && token) {
          try {
            const sRes = await fetch('/api/auth/session', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (sRes.ok) {
              const sData = await sRes.json()
              if (sData.user) {
                resolvedUser = sData.user
                setAuthedUser(sData.user)
                if (!senderName) setSenderName(sData.user.display_name)
                if (!senderContact) setSenderContact(`@${sData.user.handle}`)
              }
            }
          } catch {}
        }

        // Check if this user already has an active or pending inquiry for this shop
        const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const inqRes = await fetch('/api/inquiries', { headers: authHeader })
        if (inqRes.ok) {
          const inqData = await inqRes.json()
          if (inqData.inquiries && inqData.inquiries.length > 0) {
            const myNote = inqData.inquiries.find(
              (i: any) =>
                i.status === 'pending' ||
                (resolvedUser && (i.sender_handle === resolvedUser.handle || i.sender_user_id === resolvedUser.id))
            )
            if (myNote) {
              setExistingInquiry(myNote)
              if (myNote.status === 'pending' || myNote.status === 'accepted') {
                setSubmitted(true)
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load shop or inquiry data', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [shopHandle, currentUser])

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = window.location.href
      navigator.clipboard.writeText(url)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2500)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return

    const effectiveName = (senderName.trim() || authedUser?.display_name || '').trim()
    if (!effectiveName) {
      setErrorMessage('Please provide your name or sign in to your Chatze account.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const token = localStorage.getItem('chatze_auth_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const cleanContact = senderContact.trim()
      const effectiveHandle = authedUser?.handle || cleanContact.replace(/^@/, '') || effectiveName.toLowerCase().replace(/\s+/g, '_')

      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shopHandle,
          senderName: effectiveName,
          senderHandle: effectiveHandle,
          senderUserId: authedUser?.id || null,
          contactPhone: cleanContact.startsWith('@') ? '' : cleanContact,
          category: selectedCategory,
          content: noteContent.trim(),
          senderOriginUrl: window.location.origin,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSubmitted(true)
        setExistingInquiry({
          id: data.inquiryId,
          content: noteContent.trim(),
          category: selectedCategory,
          status: 'pending',
          created_at: Date.now(),
        })
        localStorage.setItem(`chatze_inq_${shopHandle}`, 'true')
      } else {
        setErrorMessage(data.error || 'Failed to submit inquiry')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while submitting note')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNavigateToLetterbox = () => {
    if (onGoToApp) {
      onGoToApp()
      return
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/?tab=letterbox'
    }
  }

  const tagsList = profile?.catalogTags
    ? profile.catalogTags.split(',').map((t) => t.trim()).filter(Boolean)
    : ['Authentic Products', 'Inside Valley Delivery', 'Nationwide Courier', 'Fast Response']

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] flex flex-col justify-between font-sans selection:bg-[#00a884]/30">
      {/* Top Navigation Header */}
      <header className="border-b border-[#202c33] bg-[#111b21]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] font-black text-xs shadow-sm">
              CZ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wide text-[#e9edef]">Chatze Nepal</span>
                <span className="text-[10px] bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Verified Shop
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Share portfolio link"
              className="px-2.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00a884]" />
                  <span className="text-[#00a884]">Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {authedUser ? (
              <button
                onClick={handleNavigateToLetterbox}
                className="text-xs font-semibold text-[#00a884] hover:bg-[#00a884]/10 transition-colors flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#00a884]/30 cursor-pointer"
              >
                <span>My Letterbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onSwitchToOwnerLogin}
                className="text-xs font-semibold text-[#8696a0] hover:text-[#00a884] transition-colors flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-[#202c33]/50 cursor-pointer"
              >
                <span>Account Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body: Portfolio Showcase & Letterbox */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="py-24 text-center text-xs text-[#8696a0] space-y-3">
            <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="font-medium tracking-wide">Connecting to Edge Cloud...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Business Portfolio Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                {/* Avatar & Title */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00a884]/30 via-purple-500/20 to-[#00a884]/10 border-2 border-[#00a884]/40 flex items-center justify-center font-black text-xl text-[#00a884] shadow-lg shrink-0">
                    {(profile?.displayName || 'Chatze Shop').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h1 className="text-lg font-extrabold text-[#e9edef] leading-tight">
                        {profile?.displayName || 'Chatze Business'}
                      </h1>
                      <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0" />
                    </div>
                    <div className="text-xs text-[#00a884] font-medium mt-0.5">
                      @{profile?.handle || shopHandle}
                    </div>
                    <div className="inline-block mt-2 px-2.5 py-0.5 bg-[#202c33] rounded-full text-[11px] text-[#8696a0] font-medium border border-[#2a3942]">
                      {profile?.businessCategory || 'Store & Services'}
                    </div>
                  </div>
                </div>

                {/* About Bio */}
                <div className="p-3.5 bg-[#0b141a] rounded-xl border border-[#202c33] text-xs text-[#e9edef]/90 leading-relaxed font-sans">
                  {profile?.bio ||
                    'Welcome to our official Chatze business portfolio! Drop your customer inquiry, size queries, or wholesale requirements in our Letterbox below. We reply swiftly!'}
                </div>

                {/* Business Highlights Metadata */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2.5 text-[#8696a0]">
                    <MapPin className="w-4 h-4 text-[#00a884] shrink-0" />
                    <span>Location: <strong className="text-[#e9edef]">{profile?.businessLocation || 'Kathmandu, Nepal'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2.5 text-[#8696a0]">
                    <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Hours: <strong className="text-[#e9edef]">{profile?.businessHours || 'Sun - Fri: 10:00 AM - 7:00 PM'}</strong></span>
                  </div>

                  <div className="flex items-center gap-2.5 text-[#8696a0]">
                    <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Delivery: <strong className="text-[#e9edef]">{profile?.deliveryInfo || 'All Nepal Courier & Inside Valley'}</strong></span>
                  </div>

                  {profile?.businessPhone && (
                    <div className="flex items-center gap-2.5 text-[#8696a0] pt-1">
                      <Phone className="w-4 h-4 text-[#00a884] shrink-0" />
                      <span>Direct Contact: <a href={`tel:${profile.businessPhone}`} className="text-[#00a884] font-bold hover:underline">{profile.businessPhone}</a></span>
                    </div>
                  )}
                </div>

                {/* Specialties & Tags */}
                <div className="space-y-2 pt-2 border-t border-[#202c33]/70">
                  <span className="text-[11px] font-bold text-[#8696a0] uppercase tracking-wider block">
                    Specialties & Services
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2.5 py-1 bg-[#202c33]/80 border border-[#2a3942] rounded-lg text-[#e9edef] flex items-center gap-1 font-medium"
                      >
                        <Tag className="w-3 h-3 text-[#00a884]" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Trust & Guarantee Badges */}
                <div className="p-3 bg-gradient-to-r from-[#00a884]/10 to-purple-500/10 border border-[#00a884]/20 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#00a884]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Fast Customer Response</span>
                  </div>
                  <p className="text-[11px] text-[#8696a0] leading-snug">
                    Customer inquiries trigger instant push notifications directly to the owner's phone. No bot spam, no lost messages.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Letterbox Inquiry Card */}
            <div className="lg:col-span-7">
              <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-5 sm:p-7 shadow-2xl space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-[#e9edef] flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#00a884]" />
                      Customer Inquiry Letterbox
                    </h2>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                      1-Card Anti-Spam Gate
                    </span>
                  </div>
                  <p className="text-xs text-[#8696a0] mt-1 leading-relaxed">
                    Ask about price, stock availability, custom orders, or delivery location. Zero spam, directly delivered!
                  </p>
                </div>

                {/* Authenticated Customer Identity Card (Suraj Singh / Verified Customer) */}
                {authedUser ? (
                  <div className="p-3.5 bg-gradient-to-r from-[#00a884]/15 via-[#111b21] to-purple-950/20 border border-[#00a884]/40 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#00a884]/20 border border-[#00a884]/50 flex items-center justify-center font-bold text-xs text-[#00a884] shrink-0">
                        {authedUser.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#e9edef] flex items-center gap-1.5 truncate">
                          <span className="truncate">{authedUser.display_name}</span>
                          <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                            @{authedUser.handle}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#8696a0] mt-0.5 truncate">
                          Verified Account • Replies route directly to your Letterbox
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleNavigateToLetterbox}
                      className="text-[11px] font-bold text-[#00a884] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <span>My Chats</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-[#0b141a] border border-[#202c33] rounded-xl flex items-center justify-between text-xs text-[#8696a0]">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#8696a0]" />
                      <span>Submitting as guest visitor</span>
                    </div>
                    <button
                      type="button"
                      onClick={onSwitchToOwnerLogin}
                      className="text-[#00a884] font-semibold hover:underline cursor-pointer"
                    >
                      Sign In to Chatze
                    </button>
                  </div>
                )}

                {submitted ? (
                  <div className="p-6 bg-gradient-to-b from-[#00a884]/15 to-[#111b21] border border-[#00a884]/40 rounded-2xl space-y-4 text-center animate-fade-in">
                    <div className="w-14 h-14 bg-[#00a884]/20 border border-[#00a884]/40 rounded-full flex items-center justify-center mx-auto text-[#00a884]">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-base text-[#e9edef]">
                        {existingInquiry?.status === 'accepted'
                          ? 'Inquiry Accepted by Shop! 💬'
                          : 'Inquiry Placed in Letterbox! 📬'}
                      </h3>
                      <p className="text-xs text-[#8696a0] max-w-md mx-auto leading-relaxed">
                        {existingInquiry?.status === 'accepted'
                          ? `The shop owner accepted your note! You can now chat in 2-way real-time without losing messages.`
                          : `Your note has been securely delivered to ${profile?.displayName || 'the shop owner'}. Verified identity: @${authedUser?.handle || senderContact || 'customer'}.`}
                      </p>
                    </div>

                    {existingInquiry && (
                      <div className="p-3.5 bg-[#0b141a] rounded-xl border border-[#202c33] max-w-sm mx-auto text-left space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-purple-400">
                            {existingInquiry.category || selectedCategory}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              existingInquiry.status === 'accepted'
                                ? 'bg-[#00a884]/20 text-[#00a884]'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {existingInquiry.status === 'accepted' ? 'Accepted' : 'Pending Review'}
                          </span>
                        </div>
                        <p className="text-[#e9edef] text-[11px] italic bg-[#111b21] p-2 rounded border border-[#202c33]">
                          "{existingInquiry.content || noteContent}"
                        </p>
                        <div className="text-[#8696a0] text-[10px] flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-purple-400" />
                          <span>Owner receives alerts instantly on mobile.</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                      <button
                        onClick={handleNavigateToLetterbox}
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00a884]/20 cursor-pointer transition-all"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Go to My Letterbox</span>
                      </button>

                      <button
                        onClick={() => {
                          localStorage.removeItem(`chatze_inq_${shopHandle}`)
                          setSubmitted(false)
                          setExistingInquiry(null)
                          setNoteContent('')
                        }}
                        className="text-xs font-semibold text-[#8696a0] hover:text-[#e9edef] cursor-pointer py-2 px-3"
                      >
                        Drop another note
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4.5">
                    {/* Inquiry Category Pills */}
                    <div className="space-y-1.5">
                      <label className="font-bold text-xs text-[#8696a0] block">
                        What is your inquiry about?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {INQUIRY_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.label)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              selectedCategory === cat.label
                                ? 'bg-[#00a884]/20 border-[#00a884] text-[#e9edef]'
                                : 'bg-[#0b141a] border-[#202c33] text-[#8696a0] hover:border-[#2a3942] hover:text-[#e9edef]'
                            }`}
                          >
                            <span className="font-bold text-xs block">{cat.label}</span>
                            <span className="text-[10px] text-[#8696a0] block mt-0.5 truncate">{cat.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sender Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-xs text-[#8696a0] block mb-1">
                          Your Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="e.g. Suraj Singh"
                          required
                          className="w-full px-3.5 py-2.5 bg-[#0b141a] border border-[#202c33] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0]/50 focus:outline-none focus:border-[#00a884] transition-all"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-xs text-[#8696a0] block mb-1">
                          Handle / Phone / Email <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={senderContact}
                          onChange={(e) => setSenderContact(e.target.value)}
                          placeholder="e.g. @suraj_singh or 9841XXXXXX"
                          required
                          className="w-full px-3.5 py-2.5 bg-[#0b141a] border border-[#202c33] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0]/50 focus:outline-none focus:border-[#00a884] transition-all"
                        />
                      </div>
                    </div>

                    {/* Message Details */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-xs text-[#8696a0]">
                          Your Message / Question <span className="text-rose-400">*</span>
                        </label>
                        <span className="text-[10px] text-[#8696a0]">
                          {noteContent.length}/500 chars
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder={`e.g. Namaste! I am interested in size L jacket. Do you have it in stock, and do you deliver to Pokhara?`}
                        required
                        maxLength={500}
                        className="w-full px-3.5 py-2.5 bg-[#0b141a] border border-[#202c33] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0]/50 focus:outline-none focus:border-[#00a884] resize-none leading-relaxed transition-all"
                      />
                    </div>

                    {errorMessage && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting || !noteContent.trim()}
                      className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00a884]/20 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#111b21] border-t-transparent rounded-full animate-spin"></div>
                          <span>Dropping Note in Letterbox...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Customer Note (Drop in Box)</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Anti-Spam Security Guarantee Footer */}
                <div className="pt-3 border-t border-[#202c33]/70 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#8696a0] gap-2">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Protected by Cloudflare Edge & Anti-Spam Shield</span>
                  </span>
                  <span className="text-[#8696a0]/80">
                    1-Card Limit: Zero Invocations & Zero Spam
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-[#202c33] bg-[#111b21]/40 text-center text-xs text-[#8696a0]">
        Powered by <strong className="text-[#e9edef]">Chatze</strong> • Nepal's First Edge Chat Architecture 🇳🇵
      </footer>
    </div>
  )
}

export default CustomerInquiryPage
