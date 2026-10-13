import React, { useState, useEffect } from 'react'
import {
  X,
  ShieldCheck,
  ExternalLink,
  Store,
  BadgeCheck,
  AlertCircle,
  Maximize2,
  Lock,
  Sparkles,
  LogIn,
  ShieldAlert,
} from 'lucide-react'
import type { HubMerchant, HubUser } from '../server/types'

interface LetterboxEmbedModalProps {
  merchant: HubMerchant
  currentUser: HubUser | null
  authToken: string | null
  onClose: () => void
  onOpenInNewTab: () => void
  onOpenGoogleLogin?: () => void
}

export function LetterboxEmbedModal({
  merchant,
  currentUser,
  authToken,
  onClose,
  onOpenInNewTab,
  onOpenGoogleLogin,
}: LetterboxEmbedModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false)

  // Listen for login request from child Letterbox iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'CHATZE_REQUEST_GOOGLE_LOGIN') {
        if (onOpenGoogleLogin) {
          onOpenGoogleLogin()
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenGoogleLogin])

  // Construct target embed URL: passes verified Google identity parameters safely via query string
  const buildEmbedUrl = () => {
    let rawUrl = merchant.letterbox_embed_url || `/shop?shop=${merchant.handle}`
    
    // Resolve relative vs absolute
    const baseUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `${window.location.origin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`

    try {
      const url = new URL(baseUrl)
      url.searchParams.set('embed', 'chatze_hub')
      
      if (currentUser) {
        url.searchParams.set('hub_user_name', currentUser.display_name)
        url.searchParams.set('hub_user_email', currentUser.email)
        if (currentUser.sovereign_node_url) {
          url.searchParams.set('hub_sovereign_node', currentUser.sovereign_node_url)
        }
        if (currentUser.sovereign_handle) {
          url.searchParams.set('hub_sovereign_handle', currentUser.sovereign_handle)
        }
      }
      if (authToken) {
        url.searchParams.set('hub_token', authToken)
      }
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  const embedUrl = buildEmbedUrl()

  let nodeOrigin = 'Sovereign Edge Node'
  try {
    const u = new URL(merchant.letterbox_embed_url.startsWith('http') ? merchant.letterbox_embed_url : `${window.location.origin}/${merchant.letterbox_embed_url}`)
    nodeOrigin = u.origin
  } catch {}

  const isOfficialBuild = merchant.verification_status !== 'flagged'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
        {/* Modal Header */}
        <div className="bg-[#202c33] px-4 py-3 border-b border-[#2a3942] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#111b21] border border-[#2a3942] flex items-center justify-center overflow-hidden flex-shrink-0">
              {merchant.logo_url ? (
                <img
                  src={merchant.logo_url}
                  alt={merchant.business_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-5 h-5 text-[#00a884]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-white font-semibold text-sm sm:text-base truncate">
                  {merchant.business_name}
                </h2>
                <BadgeCheck className="w-4 h-4 text-[#00a884] flex-shrink-0" />
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#111b21] border border-[#2a3942] text-[#8696a0]">
                  @{merchant.handle}
                </span>
                {isOfficialBuild ? (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-[#00a884]/15 border border-[#00a884]/30 text-[#00a884] px-2 py-0.5 rounded-full font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Official Build
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                    <ShieldAlert className="w-3 h-3" />
                    Community Fork
                  </span>
                )}
              </div>
              <p className="text-[#8696a0] text-xs flex items-center gap-2 mt-0.5 truncate">
                <span>📍 {merchant.city}</span>
                <span>•</span>
                <span className="text-[#00a884] flex items-center gap-1 font-mono text-[11px]">
                  <Lock className="w-3 h-3" />
                  {nodeOrigin}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={onOpenInNewTab}
              className="p-2 text-[#8696a0] hover:text-white hover:bg-[#2a3942] rounded-lg transition-colors cursor-pointer"
              title="Open link in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[#8696a0] hover:text-white hover:bg-[#2a3942] rounded-lg transition-colors cursor-pointer"
              title="Close Letterbox modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Verified User Identity Banner Passed to Letterbox */}
        <div className="bg-[#182229] px-4 py-2 border-b border-[#222e35] flex items-center justify-between text-xs text-[#8696a0] flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00a884]" />
            <span>
              Connected as:{' '}
              <strong className="text-white">
                {currentUser ? currentUser.display_name : 'Guest Visitor'}
              </strong>
            </span>
            {currentUser?.sovereign_node_url && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/30 text-[10px]">
                <Sparkles className="w-3 h-3" />
                Sovereign Node Linked
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!currentUser && onOpenGoogleLogin && (
              <button
                onClick={onOpenGoogleLogin}
                className="px-2.5 py-1 bg-[#00a884] hover:bg-[#02906f] text-[#111b21] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
              >
                <LogIn className="w-3 h-3" />
                <span>Sign in with Google</span>
              </button>
            )}
            <span className="text-[11px] text-[#8696a0] hidden sm:inline">
              Messages store on merchant's Cloudflare D1 (Zero Hub Relay)
            </span>
          </div>
        </div>

        {/* Embedded Iframe Container (Strict Tier 1 Sandboxing) */}
        <div className="flex-1 relative bg-[#0b141a]">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#8696a0]">
              <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Connecting to {merchant.business_name}'s Letterbox...</p>
            </div>
          )}

          <iframe
            src={embedUrl}
            title={`${merchant.business_name} Letterbox`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-forms allow-same-origin"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>

        {/* Footer Disclaimer */}
        <div className="bg-[#111b21] px-4 py-2 border-t border-[#222e35] text-[11px] text-[#8696a0] flex items-center justify-between flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Strict Origin Sandboxing Active (No Parent Hijack, Modals, or Auto-Downloads)</span>
          </span>
          <span className="text-[10px] text-[#8696a0] font-mono">
            Origin: {nodeOrigin}
          </span>
        </div>
      </div>
    </div>
  )
}
