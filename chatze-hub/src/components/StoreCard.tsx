import React, { useState } from 'react'
import {
  Store,
  MapPin,
  ExternalLink,
  MessageSquare,
  Sparkles,
  BadgeCheck,
  ChevronRight,
  ShieldCheck,
  Globe,
} from 'lucide-react'
import type { HubMerchant, HubUser } from '../server/types'

interface StoreCardProps {
  merchant: HubMerchant
  currentUser: HubUser | null
  onInquire: (merchant: HubMerchant) => void
  onOpenInMyChatze: (merchant: HubMerchant) => void
}

export function StoreCard({
  merchant,
  currentUser,
  onInquire,
  onOpenInMyChatze,
}: StoreCardProps) {
  const [imgError, setImgError] = useState(false)

  const isFeatured = merchant.verification_status === 'featured'

  return (
    <div className="bg-[#111b21] border border-[#222e35] hover:border-[#00a884]/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-lg hover:shadow-xl group relative overflow-hidden">
      {isFeatured && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-amber-600 text-black text-[10px] font-bold tracking-wider uppercase px-3 py-0.5 rounded-bl-lg flex items-center gap-1 shadow-sm">
          <Sparkles className="w-3 h-3 fill-current" />
          Featured Store
        </div>
      )}

      <div>
        {/* Top Header: Logo & Titles */}
        <div className="flex items-start gap-3.5 mb-3">
          <div className="w-13 h-13 rounded-xl bg-[#202c33] border border-[#2a3942] overflow-hidden flex-shrink-0 flex items-center justify-center relative">
            {merchant.logo_url && !imgError ? (
              <img
                src={merchant.logo_url}
                alt={merchant.business_name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <Store className="w-6 h-6 text-[#00a884]" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-white font-semibold text-base leading-snug group-hover:text-[#00a884] transition-colors truncate">
                {merchant.business_name}
              </h3>
              <BadgeCheck className="w-4 h-4 text-[#00a884] flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[#8696a0] text-xs font-mono">@{merchant.handle}</span>
              {merchant.verified_tier === 'tier2_crypto' ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Tier 2 Crypto Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#202c33] border border-[#2a3942] text-[#8696a0]">
                  <Globe className="w-2.5 h-2.5" />
                  Verified Node
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Location & Category Badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#182229] border border-[#222e35] text-[#00a884]">
            <MapPin className="w-3 h-3" />
            {merchant.city}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#182229] border border-[#222e35] text-[#aebac1]">
            {merchant.category}
          </span>
          {merchant.view_count !== undefined && merchant.view_count > 0 && (
            <span className="text-[10px] text-[#8696a0] ml-auto">
              {merchant.view_count} views
            </span>
          )}
        </div>

        {/* Bio / Description */}
        {merchant.bio && (
          <p className="text-[#aebac1] text-xs leading-relaxed line-clamp-2 mb-3">
            {merchant.bio}
          </p>
        )}

        {/* Address text */}
        {merchant.address && (
          <p className="text-[#8696a0] text-[11px] truncate mb-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" />
            {merchant.address}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-[#202c33] flex flex-col gap-2">
        {/* Primary Action: Inquire on Hub via Embedded Letterbox */}
        <button
          onClick={() => onInquire(merchant)}
          className="w-full bg-[#00a884] hover:bg-[#02906f] active:scale-[0.98] text-[#111b21] font-semibold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 fill-current" />
          <span>Inquire on Hub (Letterbox)</span>
          <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />
        </button>

        {/* Secondary Sovereign Action: Open in User's own Chatze Node (Deep-link) */}
        {currentUser?.sovereign_node_url ? (
          <button
            onClick={() => onOpenInMyChatze(merchant)}
            className="w-full bg-[#202c33] hover:bg-[#2a3942] active:scale-[0.98] text-[#00a884] hover:text-[#25d366] font-medium text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#00a884]/30 cursor-pointer"
            title={`Connect directly from your node: ${currentUser.sovereign_node_url}`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Open in My Chatze Node</span>
            <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
          </button>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-[#8696a0] px-1 pt-0.5">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-[#00a884]" />
              Sovereign Cloudflare Node
            </span>
            <span className="text-[#00a884] font-mono">100% Zero-Middleman</span>
          </div>
        )}
      </div>
    </div>
  )
}
