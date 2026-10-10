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
  LogIn,
  UserPlus,
  X,
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

  // In-page quick authentication modal state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authDisplayName, setAuthDisplayName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

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

  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    const cleanHandle = authUsername.replace(/^@/, '').trim().toLowerCase()
    if (!cleanHandle) {
      setAuthError('Please enter a username')
      setAuthLoading(false)
      return
    }

    try {
      const endpoint = authMode === 'signin' ? '/api/auth/sign-in' : '/api/auth/register'
      const payload = authMode === 'signin'
        ? { username: cleanHandle, password: authPassword }
        : { username: cleanHandle, displayName: authDisplayName.trim() || cleanHandle, password: authPassword }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok && data.user) {
        if (data.token) {
          localStorage.setItem('chatze_auth_token', data.token)
        }
        setAuthedUser(data.user)
        setSenderName(data.user.display_name)
        setSenderContact(`@${data.user.handle}`)
        setShowAuthModal(false)

        // Check if this newly signed in user has an existing inquiry
        try {
          const inqRes = await fetch('/api/inquiries', {
            headers: data.token ? { Authorization: `Bearer ${data.token}` } : {},
          })
          if (inqRes.ok) {
            const inqData = await inqRes.json()
            if (inqData.inquiries && inqData.inquiries.length > 0) {
              const myNote = inqData.inquiries.find(
                (i: any) =>
                  i.status === 'pending' ||
                  i.sender_handle === data.user.handle ||
                  i.sender_user_id === data.user.id
              )
              if (myNote) {
                setExistingInquiry(myNote)
                setSubmitted(true)
              }
            }
          }
        } catch {}
      } else {
        setAuthError(data.error || 'Authentication failed')
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Network error')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return

    if (!authedUser) {
      setAuthMode('signin')
      setShowAuthModal(true)
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const token = localStorage.getItem('chatze_auth_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shopHandle,
          senderName: authedUser.display_name,
          senderHandle: authedUser.handle,
          senderUserId: authedUser.id,
          contactPhone: senderContact.startsWith('@') ? '' : senderContact,
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
        if (data.code === 'AUTH_REQUIRED') {
          setShowAuthModal(true)
        }
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
                  <Copy className="w-3.5 h-3.5" />
                  <span>Share Shop</span>
                </>
              )}
            </button>

            {authedUser ? (
              <button
                onClick={handleNavigateToLetterbox}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>My Messages</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('signin')
                  setShowAuthModal(true)
                }}
                className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] border border-[#00a884]/40 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-[#8696a0]">Loading Shop Profile & Letterbox...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Merchant Profile & Catalog Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00a884] to-[#00725a] flex items-center justify-center font-extrabold text-xl text-[#111b21] shadow-lg shrink-0">
                    {(profile?.displayName || 'Chatze').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-[#e9edef] truncate leading-tight">
                      {profile?.displayName || 'Chatze Verified Shop'}
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs text-[#8696a0] mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-[#00a884]"></span>
                      <span className="font-mono">@{profile?.handle || shopHandle}</span>
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">
                      {profile?.businessCategory || 'Nepal Merchant Hub'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#8696a0] leading-relaxed bg-[#0b141a] p-3 rounded-xl border border-[#202c33]/70">
                  {profile?.bio ||
                    'Welcome to our official business storefront on Chatze. Use our zero-spam letterbox below to inquire about products, pricing, bulk orders, or valley delivery.'}
                </p>

                {/* Shop Highlights */}
                <div className="space-y-2.5 text-xs text-[#8696a0]">
                  {profile?.businessLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#00a884] shrink-0" />
                      <span className="text-[#e9edef]">{profile.businessLocation}</span>
                    </div>
                  )}
                  {profile?.businessPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#00a884] shrink-0" />
                      <a href={`tel:${profile.businessPhone}`} className="text-[#00a884] hover:underline font-semibold">
                        {profile.businessPhone}
                      </a>
                    </div>
                  )}
                  {profile?.deliveryInfo && (
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#00a884] shrink-0" />
                      <span className="text-[#e9edef]">{profile.deliveryInfo}</span>
                    </div>
                  )}
                </div>

                {/* Catalog & Tags Badges */}
                <div className="space-y-2 pt-1 border-t border-[#202c33]">
                  <span className="text-[10px] font-bold text-[#8696a0] uppercase tracking-wider block">
                    Product & Service Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[#202c33] border border-[#222e35] text-[11px] text-[#e9edef] flex items-center gap-1 font-medium"
                      >
                        <Tag className="w-3 h-3 text-[#00a884]" />
                        <span>{tag}</span>
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
                  /* Account Required Banner (Guarantees Customer Receives Replies) */
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-300">
                          Account Login Required
                        </p>
                        <p className="text-[11px] text-[#8696a0] leading-relaxed">
                          To protect shops from spam and guarantee that you receive the owner’s real-time replies in your Letterbox, you must be logged in to Chatze.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signin')
                          setShowAuthModal(true)
                        }}
                        className="px-3.5 py-1.5 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-lg text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register')
                          setShowAuthModal(true)
                        }}
                        className="px-3.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] font-semibold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-[#00a884]" />
                        <span>Create Account</span>
                      </button>
                    </div>
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
                          : `Your note has been securely delivered to ${profile?.displayName || 'the shop owner'}. Verified identity: @${authedUser?.handle || 'customer'}.`}
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

                    {/* Sender Contact Optional Phone */}
                    <div>
                      <label className="font-semibold text-xs text-[#8696a0] block mb-1">
                        Optional Contact Phone (For direct callback)
                      </label>
                      <input
                        type="text"
                        value={senderContact.startsWith('@') ? '' : senderContact}
                        onChange={(e) => setSenderContact(e.target.value)}
                        placeholder="e.g. 98XXXXXXXX"
                        className="w-full px-3.5 py-2.5 bg-[#0b141a] border border-[#202c33] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0]/50 focus:outline-none focus:border-[#00a884] transition-all"
                      />
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
                    {authedUser ? (
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
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('signin')
                          setShowAuthModal(true)
                        }}
                        className="w-full py-3 px-4 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Sign In / Create Account to Drop Note</span>
                      </button>
                    )}
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

      {/* Quick In-Page Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111b21] border border-[#202c33] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#00a884]/20 text-[#00a884]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#e9edef]">
                  {authMode === 'signin' ? 'Sign In to Chatze' : 'Create Chatze Account'}
                </h3>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[#8696a0] leading-relaxed">
              Your Chatze account links your inquiries so the merchant’s reply safely lands in your Letterbox.
            </p>

            {/* Mode switch */}
            <div className="flex bg-[#0b141a] p-1 rounded-xl border border-[#202c33] text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin')
                  setAuthError('')
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  authMode === 'signin' ? 'bg-[#202c33] text-[#00a884]' : 'text-[#8696a0]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register')
                  setAuthError('')
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  authMode === 'register' ? 'bg-[#202c33] text-[#00a884]' : 'text-[#8696a0]'
                }`}
              >
                Create Account
              </button>
            </div>

            {authError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleQuickAuth} className="space-y-3">
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#8696a0]">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    placeholder="e.g. Suraj Singh"
                    className="w-full px-3 py-2 bg-[#202c33] border border-[#222e35] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#8696a0]">Username / Handle</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-[#8696a0] text-xs font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder={authMode === 'register' ? 'suraj_singh' : 'your_handle'}
                    className="w-full pl-7 pr-3 py-2 bg-[#202c33] border border-[#222e35] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#8696a0]">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-[#202c33] border border-[#222e35] rounded-xl text-xs text-[#e9edef] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading || !authUsername.trim() || !authPassword}
                className="w-full py-2.5 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {authLoading ? 'Verifying...' : authMode === 'signin' ? 'Sign In' : 'Create Account & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-4 border-t border-[#202c33] bg-[#111b21]/40 text-center text-xs text-[#8696a0]">
        Powered by <strong className="text-[#e9edef]">Chatze</strong> • Nepal's First Edge Chat Architecture 🇳🇵
      </footer>
    </div>
  )
}

export default CustomerInquiryPage
