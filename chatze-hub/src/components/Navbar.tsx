import React, { useState } from 'react'
import {
  Store,
  ShieldCheck,
  LogIn,
  LogOut,
  User,
  PlusCircle,
  Sparkles,
  Server,
  Download,
} from 'lucide-react'
import type { HubUser } from '../server/types'

interface NavbarProps {
  currentUser: HubUser | null
  onOpenGoogleLogin: () => void
  onOpenRegisterStore: () => void
  onOpenUserProfile: () => void
  onLogout: () => void
}

export function Navbar({
  currentUser,
  onOpenGoogleLogin,
  onOpenRegisterStore,
  onOpenUserProfile,
  onLogout,
}: NavbarProps) {
  return (
    <header className="bg-[#111b21] border-b border-[#222e35] sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00a884] to-[#005c4b] flex items-center justify-center text-white shadow-md">
            <Store className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-base tracking-tight">
                Chatze Hub
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00a884]/15 border border-[#00a884]/40 text-[#00a884] font-semibold">
                NEPAL
              </span>
            </div>
            <p className="text-[#8696a0] text-[11px] hidden sm:block">
              Sovereign Store Directory & Zero-Middleman Gateway
            </p>
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Download Zip Button */}
          <a
            href="/chatze-hub.zip"
            download="chatze-hub.zip"
            className="flex items-center gap-1.5 text-xs text-[#8696a0] hover:text-white bg-[#182229] hover:bg-[#202c33] border border-[#2a3942] px-3 py-1.5 rounded-xl transition-colors font-medium cursor-pointer"
            title="Download full Chatze Hub codebase as .zip"
          >
            <Download className="w-3.5 h-3.5 text-[#00a884]" />
            <span className="hidden sm:inline">Download Hub Zip</span>
          </a>

          {/* List Your Store Button */}
          <button
            onClick={onOpenRegisterStore}
            className="hidden md:flex items-center gap-1.5 text-xs text-[#00a884] hover:text-[#25d366] bg-[#182229] hover:bg-[#202c33] border border-[#00a884]/30 px-3 py-1.5 rounded-xl transition-colors font-medium cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>List Self-Deployed Store</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2">
              {/* User Identity Chip */}
              <button
                onClick={onOpenUserProfile}
                className="flex items-center gap-2 bg-[#202c33] hover:bg-[#2a3942] border border-[#2a3942] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#111b21] overflow-hidden flex items-center justify-center">
                  {currentUser.avatar_url ? (
                    <img
                      src={currentUser.avatar_url}
                      alt={currentUser.display_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-3.5 h-3.5 text-[#00a884]" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-none flex items-center gap-1">
                    {currentUser.display_name}
                    {currentUser.sovereign_node_url && (
                      <span title="Sovereign Node Linked" className="text-[#00a884]">
                        🛡️
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[#8696a0] mt-0.5">
                    {currentUser.sovereign_node_url ? 'Sovereign Linked' : 'Google Verified'}
                  </p>
                </div>
              </button>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-2 text-[#8696a0] hover:text-red-400 hover:bg-[#202c33] rounded-xl transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenGoogleLogin}
              className="bg-[#00a884] hover:bg-[#02906f] text-[#111b21] font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Google Sign-In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
