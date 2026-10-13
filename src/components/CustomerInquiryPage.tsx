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
  Compass,
  ShieldAlert,
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
  hubListed?: boolean
  hubNodeId?: string
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
  const [senderEmail, setSenderEmail] = useState('')
  const [sovereignNode, setSovereignNode] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [existingInquiry, setExistingInquiry] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [copiedShare, setCopiedShare] = useState(false)

  // Redirect state for direct browser visits (must go through Chatze Hub)
  const [redirectCountdown, setRedirectCountdown] = useState(3)

  // Embedding context detection
  const isIframe = typeof window !== 'undefined' && window.self !== window.top
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isChatzeHubEmbed = urlParams?.get('embed') === 'chatze_hub'

  // The official Hub target URL for redirection
  const hubRedirectUrl = `/hub?shop=${encodeURIComponent(shopHandle)}&target=letterbox`

  // 1. Direct browser visit redirection countdown
  useEffect(() => {
    if (!isIframe) {
      const timer = setInterval(() => {
        setRedirectCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            if (typeof window !== 'undefined') {
              window.location.href = hubRedirectUrl
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isIframe, hubRedirectUrl])

  // 2. Load shop profile & detect existing auth session
  useEffect(() => {
    async function loadData() {
      let resolvedUser: any = currentUser

      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            setProfile(data.profile)
          }
        }

        // Check URL query params passed from Chatze Hub embed
        const hubUserName = urlParams?.get('hub_user_name')
        const hubUserEmail = urlParams?.get('hub_user_email')
        const hubSovereignNode = urlParams?.get('hub_sovereign_node')
        const hubSovereignHandle = urlParams?.get('hub_sovereign_handle')
        const hubToken = urlParams?.get('hub_token')

        if (hubUserName && !resolvedUser) {
          const hubAuthedUser = {
            id: `usr_hub_${(hubUserEmail || hubUserName).replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            handle: hubSovereignHandle || (hubUserEmail ? hubUserEmail.split('@')[0] : 'google_user'),
            display_name: hubUserName,
            email: hubUserEmail || undefined,
            sovereign_node_url: hubSovereignNode || undefined,
            is_hub_user: true,
          }
          resolvedUser = hubAuthedUser
          setAuthedUser(hubAuthedUser)
          setSenderName(hubUserName)
          if (hubUserEmail) setSenderEmail(hubUserEmail)
          if (hubSovereignNode) setSovereignNode(hubSovereignNode)
          setSenderContact(hubSovereignHandle ? `@${hubSovereignHandle}` : (hubUserEmail || `@${hubUserName.toLowerCase().replace(/\s+/g, '_')}`))
        }

        const token = localStorage.getItem('chatze_auth_token') || hubToken
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
      const url = `${window.location.origin}/hub?shop=${encodeURIComponent(shopHandle)}`
      navigator.clipboard.writeText(url)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2500)
    }
  }

  const handleTriggerHubLogin = () => {
    if (typeof window !== 'undefined' && window.parent) {
      // Send cross-origin safe postMessage to Chatze Hub parent modal
      window.parent.postMessage({ type: 'CHATZE_REQUEST_GOOGLE_LOGIN', shop: shopHandle }, '*')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteContent.trim()) return

    if (!authedUser && !senderName.trim()) {
      handleTriggerHubLogin()
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const token = localStorage.getItem('chatze_auth_token') || urlParams?.get('hub_token')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shopHandle,
          senderName: authedUser?.display_name || senderName,
          senderHandle: authedUser?.handle || 'google_user',
          senderUserId: authedUser?.id,
          senderEmail: authedUser?.email || senderEmail,
          contactPhone: senderContact.startsWith('@') ? '' : senderContact,
          category: selectedCategory,
          content: noteContent.trim(),
          senderOriginUrl: sovereignNode || window.location.origin,
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
          handleTriggerHubLogin()
        }
        setErrorMessage(data.error || 'Failed to submit inquiry')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while submitting note')
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================================================
  // SCENARIO 1: DIRECT BROWSER VISIT -> AUTO-REDIRECT TO CHATZE HUB
  // ==========================================================================
  if (!isIframe) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-[#e9edef] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#00a884]/30">
        <div className="max-w-md w-full bg-[#111b21] border border-[#222e35] rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-[#00a884]/15 border border-[#00a884]/30 flex items-center justify-center mx-auto text-[#00a884] shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00a884]/10 border border-[#00a884]/30 text-[#00a884] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Spam-Shielded Letterbox</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Redirecting to Chatze Hub...
            </h1>
            <p className="text-xs text-[#8696a0] leading-relaxed">
              Direct browser access to this Letterbox is protected. To safeguard merchants from automated spam, customer inquiries require verified Google identity on <strong>Chatze Hub</strong>.
            </p>
          </div>

          <div className="p-4 bg-[#182229] border border-[#222e35] rounded-2xl space-y-2 text-left text-xs">
            <div className="flex items-center justify-between text-[#8696a0]">
              <span>Target Shop:</span>
              <strong className="text-white font-mono">@{shopHandle}</strong>
            </div>
            <div className="flex items-center justify-between text-[#8696a0]">
              <span>Redirecting in:</span>
              <span className="text-[#00a884] font-bold font-mono">{redirectCountdown}s</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <a
              href={hubRedirectUrl}
              className="w-full py-3 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Chatze Hub Now</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="text-[11px] text-[#8696a0]">
              1-Tap Google Sign-In • Zero Message Bloat • Instant Inquiry
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // SCENARIO 2: EMBEDDED IN UNAUTHORIZED EXTERNAL 3RD-PARTY IFRAME
  // ==========================================================================
  if (isIframe && !isChatzeHubEmbed) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-[#e9edef] flex flex-col items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-[#111b21] border border-rose-500/30 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Embedding Restricted</h2>
          <p className="text-xs text-[#8696a0] leading-relaxed">
            This sovereign Letterbox only permits embedding inside the official <strong>Chatze Hub</strong> application to protect customer and merchant privacy.
          </p>
          <a
            href={hubRedirectUrl}
            target="_top"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00a884] text-[#111b21] rounded-xl font-bold text-xs hover:bg-[#02906f]"
          >
            <span>Open in Chatze Hub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex flex-col items-center justify-center text-[#8696a0] gap-3 font-sans">
        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium tracking-wide">Connecting to Sovereign Letterbox...</p>
      </div>
    )
  }

  // ==========================================================================
  // SCENARIO 3: MERCHANT HAS NOT LISTED THIS LETTERBOX ON CHATZE HUB (404)
  // ==========================================================================
  const isShopUnlisted = profile && profile.hubListed === false
  if (isShopUnlisted) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-[#e9edef] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#00a884]/30">
        <div className="max-w-md w-full bg-[#111b21] border border-[#222e35] rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              404 • Unlisted Node
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Letterbox Not Listed on Chatze Hub
            </h1>
            <p className="text-xs text-[#8696a0] leading-relaxed">
              The merchant (<strong>@{shopHandle}</strong>) has not published or verified this Letterbox in the Chatze Hub directory. Direct customer inquiries are currently disabled.
            </p>
          </div>

          <div className="p-4 bg-[#182229] border border-[#222e35] rounded-2xl text-xs text-[#8696a0] space-y-2 text-left">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Compass className="w-4 h-4 text-[#00a884]" />
              <span>Looking for active stores?</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Explore thousands of verified local Nepali handicraft makers, apparel stores, and eateries active on Chatze Hub.
            </p>
          </div>

          <a
            href="/hub"
            target="_top"
            className="w-full py-3 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Browse Verified Shops on Chatze Hub</span>
          </a>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // SCENARIO 4: AUTHORIZED CHATZE HUB EMBED (CUSTOMER INQUIRY CARD)
  // ==========================================================================
  const tagsList = profile?.catalogTags
    ? profile.catalogTags.split(',').map((t) => t.trim()).filter(Boolean)
    : ['Authentic Products', 'Inside Valley Delivery', 'Nationwide Courier', 'Fast Response']

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] flex flex-col justify-between font-sans selection:bg-[#00a884]/30">
      {/* Top Header Banner */}
      <header className="border-b border-[#202c33] bg-[#111b21] sticky top-0 z-20">
        <div className="max-w-4xl w-full mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] font-black text-xs">
              CZ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs tracking-wide text-[#e9edef]">
                  {profile?.displayName || 'Chatze Sovereign Store'}
                </span>
                <span className="text-[10px] bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Hub Verified
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Share store link"
              className="px-2.5 py-1 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3 h-3 text-[#00a884]" />
                  <span className="text-[#00a884] text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[11px]">Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl w-full mx-auto px-4 py-4 flex-1 space-y-4">
        {/* Merchant Info Card */}
        <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-4 sm:p-5 space-y-3 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {profile?.displayName || 'Sovereign Merchant'}
                </h1>
                <span className="text-xs text-[#8696a0] font-mono">@{profile?.handle || shopHandle}</span>
              </div>
              <p className="text-xs text-[#8696a0] leading-relaxed">
                {profile?.bio || 'Welcome to our official sovereign storefront. Drop an inquiry note below for quick assistance.'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#182229] border border-[#2a3942] flex items-center justify-center text-[#00a884] flex-shrink-0">
              <Store className="w-6 h-6" />
            </div>
          </div>

          {/* Quick Store Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-[#202c33] text-[11px] text-[#8696a0]">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#00a884]" />
              <span className="truncate">{profile?.businessLocation || 'Kathmandu, Nepal'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#00a884]" />
              <span className="truncate">{profile?.businessHours || 'Open Regular Hours'}</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
              <Truck className="w-3.5 h-3.5 text-[#00a884]" />
              <span className="truncate">{profile?.deliveryInfo || 'Valley & Nationwide'}</span>
            </div>
          </div>

          {/* Catalog Tags */}
          {tagsList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tagsList.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-[#182229] border border-[#222e35] text-[10px] text-[#8696a0]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* GOOGLE SIGN-IN REQUIREMENT CHECK */}
        {!authedUser && !senderName ? (
          <div className="bg-[#111b21] border border-amber-500/30 rounded-2xl p-6 text-center space-y-4 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-white">Google Sign-In Required on Chatze Hub</h2>
              <p className="text-xs text-[#8696a0] max-w-md mx-auto leading-relaxed">
                To prevent automated spam and guarantee customer authenticity, inquiries require a verified Google identity. Sign in with Google on Chatze Hub to unlock the 1-Card inquiry box.
              </p>
            </div>
            <button
              onClick={handleTriggerHubLogin}
              className="px-6 py-2.5 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-xl text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In with Google on Chatze Hub</span>
            </button>
          </div>
        ) : submitted || existingInquiry ? (
          /* SUBMITTED CONFIRMATION CARD */
          <div className="bg-[#111b21] border border-[#00a884]/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center mx-auto text-[#00a884]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Inquiry Note Safely Placed in Letterbox!</h2>
              <p className="text-xs text-[#8696a0] max-w-md mx-auto">
                Your 1-card note is recorded directly in <strong>{profile?.displayName}</strong>'s edge database. You will be notified once the owner reviews and accepts your request.
              </p>
            </div>

            <div className="p-3 bg-[#182229] border border-[#222e35] rounded-xl text-left text-xs space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between text-[11px] text-[#8696a0]">
                <span>Status:</span>
                <span className="font-semibold text-amber-400 uppercase tracking-wider">
                  {existingInquiry?.status === 'accepted' ? 'Accepted (Chat Open)' : 'Pending Review'}
                </span>
              </div>
              <p className="p-2.5 bg-[#0b141a] rounded-lg text-[#e9edef] text-xs border border-[#222e35] font-sans leading-relaxed">
                "{existingInquiry?.content || noteContent}"
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-[11px] text-[#8696a0] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00a884]" />
                1-Card Protection Active (Zero Flooding)
              </span>
            </div>
          </div>
        ) : (
          /* 1-CARD INQUIRY COMPOSITION BOX */
          <div className="bg-[#111b21] border border-[#202c33] rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg">
            {/* Identity Badge Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#202c33] flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#8696a0]">
                <ShieldCheck className="w-4 h-4 text-[#00a884]" />
                <span>
                  Inquiring as: <strong className="text-white">{senderName || authedUser?.display_name}</strong>
                </span>
                {senderEmail && (
                  <span className="text-[10px] text-[#8696a0] font-mono">({senderEmail})</span>
                )}
              </div>
              {sovereignNode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/30 text-[10px]">
                  <Sparkles className="w-3 h-3" />
                  Sovereign Node Linked
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#aebac1] mb-1.5">
                  Select Topic
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {INQUIRY_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.label)}
                      className={`p-2 rounded-xl text-xs font-medium text-left transition-all border cursor-pointer ${
                        selectedCategory === cat.label
                          ? 'bg-[#00a884]/15 border-[#00a884] text-white shadow-sm'
                          : 'bg-[#182229] border-[#222e35] text-[#8696a0] hover:text-white hover:border-[#2a3942]'
                      }`}
                    >
                      <div className="font-semibold truncate">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Inquiry Note Content */}
              <div>
                <label className="block text-xs font-semibold text-[#aebac1] mb-1 flex items-center justify-between">
                  <span>Your Note to {profile?.displayName || 'Merchant'} *</span>
                  <span className="text-[10px] text-[#8696a0]">{noteContent.length}/500 chars</span>
                </label>
                <textarea
                  rows={4}
                  required
                  maxLength={500}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Ask about pricing, current stock, color options, or delivery timelines to your city..."
                  className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-xl p-3 text-xs text-white placeholder-[#8696a0] focus:outline-none leading-relaxed resize-none"
                />
              </div>

              {/* Optional Contact Phone */}
              <div>
                <label className="block text-xs font-semibold text-[#aebac1] mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Contact Phone / WhatsApp (Optional)</span>
                </label>
                <input
                  type="text"
                  value={senderContact.startsWith('@') ? '' : senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  placeholder="e.g. 9801234567 (for courier coordination)"
                  className="w-full bg-[#182229] border border-[#2a3942] focus:border-[#00a884] rounded-xl px-3 py-2 text-xs text-white placeholder-[#8696a0] focus:outline-none"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting || !noteContent.trim()}
                className="w-full py-3 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Placing Note in Letterbox...' : 'Drop 1-Card Inquiry Note'}</span>
              </button>

              <p className="text-[11px] text-[#8696a0] text-center">
                🛡️ Direct Cloudflare D1 Delivery • Zero Middleman Message Storage • Anti-Bot Shielded
              </p>
            </form>
          </div>
        )}
      </main>

      {/* Clean Bottom Footer */}
      <footer className="p-3 border-t border-[#202c33] bg-[#111b21]/60 text-center text-[11px] text-[#8696a0]">
        Powered by <strong className="text-white">Chatze Sovereign Letterbox</strong> • Cloudflare Edge Architecture 🇳🇵
      </footer>
    </div>
  )
}

export default CustomerInquiryPage
