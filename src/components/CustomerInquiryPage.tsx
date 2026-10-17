import React, { useState, useEffect, useRef } from 'react'
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
  Copy,
  Check,
  BadgeCheck,
  ExternalLink,
  LogIn,
  ShieldAlert,
  CheckCheck,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  X,
  RefreshCw,
} from 'lucide-react'
import { CHATZE_HUB_URL } from '../lib/hubConfig'

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

interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderHandle?: string
  recipientHandle?: string
  body: string
  createdAt: string
  readAt?: string | null
  status?: 'sending' | 'sent'
}

const INQUIRY_CATEGORIES = [
  { id: 'price_stock', label: '🏷️ Price & Stock', hint: 'Ask about sizing, color or pricing' },
  { id: 'delivery', label: '🚚 Delivery & Location', hint: 'Delivery time to your city or valley' },
  { id: 'wholesale', label: '📦 Wholesale / Bulk', hint: 'Special pricing for bulk orders' },
  { id: 'general', label: '❓ General Question', hint: 'Custom inquiry or general request' },
]

const QUICK_PROMPTS = [
  '📦 Can you confirm current stock and available colors?',
  '🚚 What is the delivery time and cost to Kathmandu?',
  '💳 Please share your payment QR code (eSewa / Fonepay)',
  '📍 What is your physical store address?',
]

// Synthesize pleasant gentle notification chime via Web Audio API (Zero external assets needed)
function playGentleChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08) // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.28)
  } catch {}
}

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

  // Live Chat state once inquiry is accepted
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const [isNoteExpanded, setIsNoteExpanded] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Redirect state for direct browser visits (must go through Chatze Hub unless explicitly opened with embed param)
  const [redirectCountdown, setRedirectCountdown] = useState(3)

  // Embedding context detection
  const isIframe = typeof window !== 'undefined' && window.self !== window.top
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isChatzeHubEmbed = urlParams?.get('embed') === 'chatze_hub'

  // The official deployed Chatze Hub gateway target URL for redirection
  const hubRedirectUrl = `${CHATZE_HUB_URL}/?shop=${encodeURIComponent(shopHandle)}&target=letterbox`

  // Scroll to bottom of messages container
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      })
    }
  }

  // 1. Direct browser visit redirection countdown (only when completely outside Hub embed context)
  useEffect(() => {
    if (!isIframe && !isChatzeHubEmbed) {
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
  }, [isIframe, isChatzeHubEmbed, hubRedirectUrl])

  // 2. Load shop profile & detect existing auth session & existing inquiries
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
          const generatedHandle =
            hubSovereignHandle ||
            (hubUserEmail ? hubUserEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') : null) ||
            hubUserName.toLowerCase().replace(/[^a-z0-9_]/g, '_')

          const hubAuthedUser = {
            id: `usr_hub_${(hubUserEmail || hubUserName).replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
            handle: generatedHandle,
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
          setSenderContact(hubSovereignHandle ? `@${hubSovereignHandle}` : (hubUserEmail || `@${generatedHandle}`))
        }

        const localToken = localStorage.getItem('chatze_auth_token') || hubToken
        if (!resolvedUser && localToken) {
          try {
            const sRes = await fetch('/api/auth/session', {
              headers: { Authorization: `Bearer ${localToken}` },
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

        // Customer handle & identity resolution
        const storedInquiryId = localStorage.getItem(`chatze_inq_id_${shopHandle}`) || localStorage.getItem(`chatze_inquiry_id_${shopHandle}`)
        const storedHandle = localStorage.getItem(`chatze_inq_handle_${shopHandle}`)
        const storedUserId = localStorage.getItem(`chatze_inq_user_${shopHandle}`)

        const effectiveCustomerHandle =
          resolvedUser?.handle ||
          hubSovereignHandle ||
          (hubUserEmail ? hubUserEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') : null) ||
          storedHandle ||
          ''

        const effectiveCustomerUserId = resolvedUser?.id || storedUserId || ''

        // Check if this user already has an inquiry for this shop
        const inqQueryParams = new URLSearchParams()
        if (effectiveCustomerHandle) inqQueryParams.set('handle', effectiveCustomerHandle)
        if (effectiveCustomerUserId) inqQueryParams.set('userId', effectiveCustomerUserId)
        if (storedInquiryId) inqQueryParams.set('inquiryId', storedInquiryId)

        const authHeader: Record<string, string> = localToken ? { Authorization: `Bearer ${localToken}` } : {}
        const inqRes = await fetch(`/api/inquiries?${inqQueryParams.toString()}`, { headers: authHeader })

        if (inqRes.ok) {
          const inqData = await inqRes.json()
          if (inqData.inquiries && inqData.inquiries.length > 0) {
            // Find user's active inquiry
            const myNote =
              inqData.inquiries.find((i: any) => i.id === storedInquiryId) ||
              inqData.inquiries.find(
                (i: any) =>
                  i.sender_handle === effectiveCustomerHandle ||
                  (effectiveCustomerUserId && i.sender_user_id === effectiveCustomerUserId)
              ) ||
              inqData.inquiries[0]

            if (myNote) {
              setExistingInquiry(myNote)
              setSubmitted(true)

              // Check conversation messages
              const convId = myNote.conversation_id || `conv_${myNote.sender_handle}`
              loadConversationMessages(convId)
            } else if (effectiveCustomerHandle) {
              // Also check if any existing messages are waiting for this customer
              loadConversationMessages(`conv_${effectiveCustomerHandle}`)
            }
          } else if (effectiveCustomerHandle) {
            loadConversationMessages(`conv_${effectiveCustomerHandle}`)
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

  // Helper to fetch conversation messages and auto-unlock live chat if messages exist
  const loadConversationMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/messaging?conversationId=${encodeURIComponent(convId)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              ...m,
              status: 'sent',
            }))
          )
          setSubmitted(true)
          setExistingInquiry((prev: any) => ({
            ...(prev || {
              id: convId,
              category: 'Customer Inquiry',
              content: data.messages[0]?.body || 'Inquiry conversation',
              created_at: Date.now(),
            }),
            status: 'accepted',
            conversation_id: convId,
          }))
          setTimeout(() => scrollToBottom('instant'), 50)
          return data.messages
        }
      }
    } catch (e) {
      console.warn('Failed to fetch messages', e)
    }
    return []
  }

  // 3. Real-Time SSE Stream Connection for instant inquiry status updates and live messages
  useEffect(() => {
    const customerHandle =
      authedUser?.handle ||
      existingInquiry?.sender_handle ||
      urlParams?.get('hub_sovereign_handle') ||
      (urlParams?.get('hub_user_email') ? urlParams.get('hub_user_email')!.split('@')[0] : 'guest')

    const customerUserId = authedUser?.id || existingInquiry?.sender_user_id || `usr_${customerHandle}`
    const activeConvId = existingInquiry?.conversation_id || `conv_${customerHandle}`

    let es: EventSource | null = null

    try {
      es = new EventSource(`/api/stream?userId=${encodeURIComponent(customerUserId)}`)

      // Inquiry status updated event (Merchant clicked Accept or Add Friend)
      es.addEventListener('inquiry_status_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data)
          const targetConv = payload.conversationId || activeConvId
          const isMatch =
            !existingInquiry ||
            payload.inquiryId === existingInquiry.id ||
            payload.conversationId === activeConvId ||
            (payload.customerHandle && payload.customerHandle.toLowerCase() === customerHandle.toLowerCase())

          if (isMatch) {
            setExistingInquiry((prev: any) => ({
              ...(prev || {
                id: targetConv,
                sender_handle: customerHandle,
                category: 'Customer Inquiry',
                content: 'Inquiry note',
                created_at: Date.now(),
              }),
              status: payload.status,
              conversation_id: targetConv,
            }))
            setSubmitted(true)

            if (payload.status === 'accepted') {
              loadConversationMessages(targetConv)
              if (soundEnabled) playGentleChime()
            }
          }
        } catch (err) {
          console.warn('SSE inquiry_status_updated parse error', err)
        }
      })

      // New message received event: Automatically unlocks live chatbox
      es.addEventListener('new_message', (e: MessageEvent) => {
        try {
          const incoming = JSON.parse(e.data)
          const targetConv = existingInquiry?.conversation_id || activeConvId
          const cleanSender = (incoming.senderHandle || incoming.senderId || '').replace(/^@/, '').toLowerCase()

          // Check if message belongs to this customer's conversation
          if (
            incoming.conversationId === targetConv ||
            incoming.conversationId === `conv_${customerHandle}` ||
            incoming.recipientHandle === customerHandle ||
            cleanSender === customerHandle.toLowerCase()
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id || (m.body === incoming.body && m.status === 'sending'))) {
                return prev.map((m) =>
                  m.id === incoming.id || (m.body === incoming.body && m.status === 'sending')
                    ? { ...incoming, status: 'sent' }
                    : m
                )
              }
              return [...prev, { ...incoming, status: 'sent' }]
            })

            // Instantly transition to live chatbox mode!
            setExistingInquiry((prev: any) => ({
              ...(prev || {
                id: incoming.conversationId || targetConv,
                sender_handle: customerHandle,
                category: 'Customer Chat',
                content: incoming.body,
                created_at: Date.now(),
              }),
              status: 'accepted',
              conversation_id: incoming.conversationId || targetConv,
            }))
            setSubmitted(true)

            // Play notification sound if message is from the merchant
            if (cleanSender !== customerHandle.toLowerCase()) {
              if (soundEnabled) playGentleChime()
            }

            setTimeout(() => scrollToBottom('smooth'), 50)
          }
        } catch (err) {
          console.warn('SSE new_message parse error', err)
        }
      })
    } catch (err) {
      console.warn('SSE initialization failed', err)
    }

    return () => {
      if (es) {
        es.close()
      }
    }
  }, [existingInquiry?.id, existingInquiry?.conversation_id, authedUser?.handle, soundEnabled])

  // 4. On-demand sync helper (Zero background invocations, pure event-driven SSE architecture)
  const syncInquiryAndMessages = async () => {
    const customerHandle =
      authedUser?.handle ||
      existingInquiry?.sender_handle ||
      urlParams?.get('hub_sovereign_handle') ||
      (urlParams?.get('hub_user_email') ? urlParams.get('hub_user_email')!.split('@')[0] : '')

    const customerUserId = authedUser?.id || existingInquiry?.sender_user_id || ''
    const storedInqId = existingInquiry?.id || localStorage.getItem(`chatze_inq_id_${shopHandle}`) || ''
    const convId = existingInquiry?.conversation_id || (customerHandle ? `conv_${customerHandle}` : '')

    if (convId) {
      await loadConversationMessages(convId)
    }

    if (customerHandle || customerUserId || storedInqId) {
      try {
        const inqQueryParams = new URLSearchParams()
        if (customerHandle) inqQueryParams.set('handle', customerHandle)
        if (customerUserId) inqQueryParams.set('userId', customerUserId)
        if (storedInqId) inqQueryParams.set('inquiryId', storedInqId)

        const res = await fetch(`/api/inquiries?${inqQueryParams.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (data.inquiries && data.inquiries.length > 0) {
            const matched = data.inquiries.find((i: any) => i.id === storedInqId) || data.inquiries[0]
            if (matched) {
              setExistingInquiry(matched)
              if (matched.status === 'accepted') {
                const cId = matched.conversation_id || `conv_${matched.sender_handle}`
                loadConversationMessages(cId)
              }
            }
          }
        }
      } catch {}
    }
  }

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${CHATZE_HUB_URL}/?shop=${encodeURIComponent(shopHandle)}`
      navigator.clipboard.writeText(url)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2500)
    }
  }

  const handleTriggerHubLogin = () => {
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ type: 'CHATZE_REQUEST_GOOGLE_LOGIN', shop: shopHandle }, '*')
    }
  }

  // Submit initial 1-card inquiry note
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

    const cleanHandle =
      authedUser?.handle ||
      (authedUser?.email ? authedUser.email.split('@')[0] : null) ||
      (senderEmail ? senderEmail.split('@')[0] : null) ||
      senderName.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      'google_user'

    const cleanUserId = authedUser?.id || `usr_hub_${cleanHandle}`

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shopHandle: profile?.handle || shopHandle,
          senderName: authedUser?.display_name || senderName,
          senderHandle: cleanHandle,
          senderUserId: cleanUserId,
          senderEmail: authedUser?.email || senderEmail,
          contactPhone: senderContact.startsWith('@') ? '' : senderContact,
          category: selectedCategory,
          content: noteContent.trim(),
          senderOriginUrl: sovereignNode || window.location.origin,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const inqObj = {
          id: data.inquiryId,
          sender_handle: cleanHandle,
          sender_name: authedUser?.display_name || senderName,
          sender_user_id: cleanUserId,
          content: `[${selectedCategory}] ${noteContent.trim()}`,
          category: selectedCategory,
          status: 'pending',
          conversation_id: `conv_${cleanHandle}`,
          created_at: Date.now(),
        }

        setSubmitted(true)
        setExistingInquiry(inqObj)

        // Persist IDs in localStorage
        localStorage.setItem(`chatze_inq_id_${shopHandle}`, data.inquiryId)
        localStorage.setItem(`chatze_inq_handle_${shopHandle}`, cleanHandle)
        localStorage.setItem(`chatze_inq_user_${shopHandle}`, cleanUserId)
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

  // Send a message inside the live Letterbox chat
  const handleSendChatMessage = async (e?: React.FormEvent, customBody?: string) => {
    if (e) e.preventDefault()
    const textToSend = customBody || chatInput.trim()
    if (!textToSend || isSendingChat) return

    const customerHandle =
      authedUser?.handle ||
      existingInquiry?.sender_handle ||
      (urlParams?.get('hub_user_email') ? urlParams.get('hub_user_email')!.split('@')[0] : 'customer')

    const customerUserId = authedUser?.id || existingInquiry?.sender_user_id || `usr_${customerHandle}`
    const conversationId = existingInquiry?.conversation_id || `conv_${customerHandle}`
    const targetShopHandle = profile?.handle || shopHandle

    const tempId = 'temp_' + Math.random().toString(36).slice(2, 9)
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId,
      senderId: customerUserId,
      senderHandle: customerHandle,
      recipientHandle: targetShopHandle,
      body: textToSend,
      createdAt: new Date().toISOString(),
      status: 'sending',
    }

    setMessages((prev) => [...prev, optimisticMsg])
    if (!customBody) setChatInput('')
    scrollToBottom('smooth')
    setIsSendingChat(true)

    try {
      const res = await fetch('/api/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          body: textToSend,
          senderId: customerUserId,
          myHandle: customerHandle,
          remoteHandle: targetShopHandle,
          tempId,
        }),
      })

      const data = await res.json()
      if (res.ok && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...data.message, status: 'sent' } : m))
        )
      }
    } catch (err) {
      console.warn('Failed to send message', err)
    } finally {
      setIsSendingChat(false)
    }
  }

  // Handle image upload from customer
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const base64Data = reader.result as string
      try {
        const uploadRes = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: base64Data,
            contentType: file.type || 'image/jpeg',
          }),
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          if (uploadData.url) {
            handleSendChatMessage(undefined, `![Customer Attachment](${uploadData.url})`)
            return
          }
        }
      } catch {}
      // Fallback: send as markdown inline
      handleSendChatMessage(undefined, `![Customer Image](${base64Data})`)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ==========================================================================
  // SCENARIO 1: DIRECT BROWSER VISIT -> AUTO-REDIRECT TO CHATZE HUB
  // ==========================================================================
  if (!isIframe && !isChatzeHubEmbed) {
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex flex-col items-center justify-center text-[#8696a0] gap-3 font-sans">
        <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium tracking-wide">Connecting to Sovereign Letterbox...</p>
      </div>
    )
  }

  // Unlisted Node Check
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
              The merchant (<strong>@{shopHandle}</strong>) has not published this Letterbox in the Chatze Hub directory. Customer inquiries are currently disabled.
            </p>
          </div>
          <a
            href={CHATZE_HUB_URL}
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

  const tagsList = profile?.catalogTags
    ? profile.catalogTags.split(',').map((t) => t.trim()).filter(Boolean)
    : ['Authentic Products', 'Inside Valley Delivery', 'Nationwide Courier', 'Fast Response']

  const isChatOpen =
    existingInquiry?.status === 'accepted' ||
    messages.length > 0 ||
    (existingInquiry && existingInquiry.status !== 'pending' && existingInquiry.status !== 'dismissed')

  const isPendingReview = (existingInquiry?.status === 'pending' || submitted) && !isChatOpen && messages.length === 0

  // Helper to parse message for image markdown ![alt](url)
  const parseMessage = (text: string) => {
    const imgRegex = /!\[(.*?)\]\((.*?)\)/
    const match = text.match(imgRegex)
    if (match) {
      return {
        isImage: true,
        alt: match[1],
        url: match[2],
        caption: text.replace(imgRegex, '').trim(),
      }
    }
    return { isImage: false, text }
  }

  const customerHandle =
    authedUser?.handle ||
    existingInquiry?.sender_handle ||
    (urlParams?.get('hub_user_email') ? urlParams.get('hub_user_email')!.split('@')[0] : 'customer')

  return (
    <div className="h-screen w-full bg-[#0b141a] text-[#e9edef] flex flex-col font-sans selection:bg-[#00a884]/30 overflow-hidden">
      {/* Top Header Banner */}
      <header className="border-b border-[#202c33] bg-[#111b21] flex-shrink-0 z-20">
        <div className="max-w-4xl w-full mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884] font-bold text-xs flex-shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs sm:text-sm tracking-wide text-[#e9edef] truncate">
                  {profile?.displayName || 'Chatze Sovereign Store'}
                </span>
                <span className="text-[10px] bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 flex-shrink-0">
                  <BadgeCheck className="w-3 h-3" /> Hub Verified
                </span>
              </div>
              <p className="text-[11px] text-[#8696a0] flex items-center gap-2 truncate">
                <span>@{profile?.handle || shopHandle}</span>
                <span>•</span>
                <span className="text-[#00a884] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                  {isChatOpen ? 'Live Chat Unlocked' : 'Letterbox Active'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {isChatOpen && (
              <button
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? 'Mute incoming chimes' : 'Unmute chimes'}
                className="p-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] text-xs rounded-lg transition-colors cursor-pointer"
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#00a884]" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleCopyLink}
              title="Share store link"
              className="px-2.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#00a884]" />
                  <span className="text-[#00a884] text-[11px] hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto overflow-hidden">
        {/* ==================================================================== */}
        {/* 1. GOOGLE SIGN-IN REQUIREMENT CHECK */}
        {/* ==================================================================== */}
        {!authedUser && !senderName ? (
          <div className="p-4 sm:p-6 flex-1 flex items-center justify-center overflow-y-auto">
            <div className="max-w-md w-full bg-[#111b21] border border-amber-500/30 rounded-3xl p-6 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-white">Google Sign-In Required on Chatze Hub</h2>
                <p className="text-xs text-[#8696a0] leading-relaxed">
                  To protect merchants from spam and guarantee authentic customer inquiries, notes require a verified Google identity. Sign in with Google on Chatze Hub to unlock this Letterbox.
                </p>
              </div>
              <button
                onClick={handleTriggerHubLogin}
                className="w-full py-3 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-bold rounded-xl text-xs transition-all shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google on Chatze Hub</span>
              </button>
            </div>
          </div>
        ) : isChatOpen ? (
          /* ==================================================================== */
          /* 2. LIVE CHAT INTERFACE (WHEN INQUIRY ACCEPTED BY SELF-HOSTED CHATZE) */
          /* ==================================================================== */
          <div className="flex-1 flex flex-col min-h-0 bg-[#0b141a]">
            {/* Pinned Original Inquiry Header (Collapsible) */}
            <div className="bg-[#182229] border-b border-[#222e35] px-3 py-2 flex-shrink-0">
              <div className="flex items-center justify-between text-xs text-[#8696a0]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse flex-shrink-0" />
                  <span className="font-semibold text-white truncate text-[11px] sm:text-xs">
                    Inquiry Accepted: {existingInquiry?.category || 'Customer Inquiry'}
                  </span>
                  <span className="text-[10px] bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 px-2 py-0.5 rounded-full font-bold hidden sm:inline">
                    Chat Open
                  </span>
                </div>
                <button
                  onClick={() => setIsNoteExpanded((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] text-[#00a884] hover:underline cursor-pointer flex-shrink-0 ml-2"
                >
                  <span>{isNoteExpanded ? 'Hide Note' : 'View Note'}</span>
                  {isNoteExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {isNoteExpanded && (
                <div className="mt-2 p-2.5 bg-[#111b21] rounded-xl border border-[#2a3942] text-xs text-[#e9edef] space-y-1 animate-fadeIn">
                  <div className="flex items-center justify-between text-[10px] text-[#8696a0]">
                    <span>From: @{customerHandle}</span>
                    <span>{existingInquiry?.created_at ? new Date(existingInquiry.created_at).toLocaleString() : ''}</span>
                  </div>
                  <p className="font-sans leading-relaxed text-[11px]">
                    "{existingInquiry?.content}"
                  </p>
                </div>
              )}
            </div>

            {/* Messages Scroll Area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-0 bg-[#0b141a]"
            >
              {/* Top welcome bubble */}
              <div className="flex justify-center my-2">
                <div className="bg-[#182229] border border-[#222e35] text-[#8696a0] text-[10px] sm:text-[11px] px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Sovereign Letterbox Chat • Messages stored on merchant's Cloudflare D1</span>
                </div>
              </div>

              {messages.length === 0 && (
                <div className="py-8 text-center space-y-2 text-[#8696a0]">
                  <div className="w-10 h-10 rounded-full bg-[#182229] border border-[#222e35] flex items-center justify-center mx-auto text-[#00a884]">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <p className="text-xs">Chat is live! Send a message or question below.</p>
                </div>
              )}

              {messages.map((msg) => {
                const cleanSender = (msg.senderHandle || msg.senderId || '').replace(/^@/, '').trim().toLowerCase()
                const isMe =
                  cleanSender === customerHandle.toLowerCase() ||
                  msg.senderId === authedUser?.id ||
                  cleanSender === 'customer' ||
                  cleanSender === (authedUser?.handle || '').toLowerCase()

                const parsed = parseMessage(msg.body)

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl ${
                        parsed.isImage ? 'p-1.5' : 'px-3.5 py-2'
                      } text-xs sm:text-sm shadow-md transition-all ${
                        isMe
                          ? 'bg-[#005c4b] text-[#e9edef] rounded-br-none'
                          : 'bg-[#202c33] text-[#e9edef] rounded-bl-none border border-[#2a3942]'
                      }`}
                    >
                      {/* Sender label for merchant */}
                      {!isMe && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-[#00a884] mb-1">
                          <Store className="w-3 h-3" />
                          <span>{profile?.displayName || 'Merchant'}</span>
                        </div>
                      )}

                      {/* Image Message Rendering */}
                      {parsed.isImage && parsed.url ? (
                        <div className="space-y-1.5">
                          <div
                            onClick={() => setLightboxUrl(parsed.url!)}
                            className="relative rounded-xl overflow-hidden cursor-pointer bg-[#111b21] max-h-[300px] flex items-center justify-center border border-white/5"
                          >
                            <img
                              src={parsed.url}
                              alt={parsed.alt || 'Shared Image'}
                              className="w-full h-auto object-cover max-h-[300px]"
                            />
                          </div>
                          {parsed.caption && (
                            <p className="text-xs leading-relaxed px-1 break-words">{parsed.caption}</p>
                          )}
                        </div>
                      ) : (
                        <p className="break-words leading-relaxed text-xs sm:text-sm">{msg.body}</p>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#8696a0]">
                        <span>
                          {msg.createdAt
                            ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                        {isMe &&
                          (msg.status === 'sending' ? (
                            <Clock className="w-3 h-3 animate-spin text-[#8696a0]" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                          ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Action Prompt Chips */}
            <div className="px-3 py-1.5 bg-[#111b21] border-t border-[#202c33] flex items-center gap-1.5 overflow-x-auto flex-shrink-0 scrollbar-none">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChatMessage(undefined, prompt)}
                  className="px-2.5 py-1 bg-[#182229] hover:bg-[#202c33] border border-[#2a3942] rounded-full text-[11px] text-[#8696a0] hover:text-white whitespace-nowrap transition-colors cursor-pointer flex-shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSendChatMessage}
              className="p-2 sm:p-3 bg-[#202c33] border-t border-[#2a3942] flex items-center gap-2 flex-shrink-0"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach photo or slip"
                className="p-2 text-[#8696a0] hover:text-white hover:bg-[#2a3942] rounded-xl transition-colors cursor-pointer flex-shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message to shop owner..."
                className="flex-1 bg-[#2a3942] border border-[#374248] focus:border-[#00a884] rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-[#8696a0] focus:outline-none"
              />

              <button
                type="submit"
                disabled={!chatInput.trim() || isSendingChat}
                className="p-2 sm:px-3 sm:py-2 bg-[#00a884] hover:bg-[#02906f] disabled:opacity-40 text-[#111b21] font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer flex-shrink-0"
              >
                <Send className="w-4 h-4" />
                <span className="text-xs font-bold hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        ) : isPendingReview || submitted ? (
          /* ==================================================================== */
          /* 3. PENDING REVIEW STATUS (WAITING FOR MERCHANT TO ACCEPT)            */
          /* ==================================================================== */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
            <div className="max-w-lg w-full bg-[#111b21] border border-[#00a884]/40 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl text-center animate-fadeIn">
              <div className="relative w-16 h-16 rounded-3xl bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center mx-auto text-[#00a884] shadow-inner">
                <Clock className="w-8 h-8" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a884] opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#00a884]" />
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00a884] bg-[#00a884]/10 border border-[#00a884]/30 px-3 py-1 rounded-full">
                  Status: Pending Review
                </span>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Inquiry Note Placed in Letterbox!
                </h2>
                <p className="text-xs text-[#8696a0] max-w-sm mx-auto leading-relaxed">
                  Your note is recorded directly on <strong>{profile?.displayName || 'Merchant'}</strong>'s edge node. As soon as the merchant accepts, this window will automatically unlock into live chat!
                </p>
              </div>

              {/* Inquiry Note Card Preview */}
              <div className="p-3.5 bg-[#182229] border border-[#222e35] rounded-2xl text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between text-[11px] text-[#8696a0]">
                  <span className="font-semibold text-[#00a884]">{existingInquiry?.category || selectedCategory}</span>
                  <span className="flex items-center gap-1 text-[10px]">
                    <Clock className="w-3 h-3" />
                    <span>Awaiting Merchant</span>
                  </span>
                </div>
                <p className="p-3 bg-[#0b141a] rounded-xl text-[#e9edef] text-xs border border-[#222e35] font-sans leading-relaxed break-words">
                  "{existingInquiry?.content || noteContent}"
                </p>
              </div>

              {/* Instant Check / Open Live Chat Button */}
              <button
                type="button"
                onClick={syncInquiryAndMessages}
                className="w-full py-2.5 bg-[#182229] hover:bg-[#202c33] border border-[#00a884]/40 text-[#00a884] hover:text-[#25d366] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Check for Merchant Reply / Open Chat</span>
              </button>

              <div className="pt-2 border-t border-[#222e35] flex items-center justify-center gap-2 text-[11px] text-[#8696a0]">
                <ShieldCheck className="w-4 h-4 text-[#00a884]" />
                <span>Direct Edge SSE Active • Auto-unlocks when merchant replies</span>
              </div>
            </div>
          </div>
        ) : (
          /* ==================================================================== */
          /* 4. INITIAL 1-CARD INQUIRY FORM (FIRST TIME CUSTOMER COMPOSITION)    */
          /* ==================================================================== */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#202c33] text-[11px] text-[#8696a0]">
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

            {/* 1-CARD INQUIRY COMPOSITION BOX */}
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
          </div>
        )}
      </main>

      {/* Image Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn cursor-pointer"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 bg-[#202c33] text-white rounded-full hover:bg-[#2a3942]"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* Clean Bottom Footer */}
      <footer className="p-2 sm:p-2.5 border-t border-[#202c33] bg-[#111b21]/90 flex-shrink-0 text-center text-[11px] text-[#8696a0]">
        Powered by <strong className="text-white">Chatze Sovereign Letterbox</strong> • Cloudflare Edge Architecture 🇳🇵
      </footer>
    </div>
  )
}

export default CustomerInquiryPage
