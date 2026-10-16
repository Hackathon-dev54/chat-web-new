import React, { useState, useEffect } from 'react'
import { Navbar } from './components/Navbar'
import { DiscoveryDirectory } from './components/DiscoveryDirectory'
import { LetterboxEmbedModal } from './components/LetterboxEmbedModal'
import { GoogleAuthModal } from './components/GoogleAuthModal'
import { RegisterStoreModal } from './components/RegisterStoreModal'
import { UserProfileModal } from './components/UserProfileModal'
import type { HubMerchant, HubUser } from './server/types'

export function App() {
  const [currentUser, setCurrentUser] = useState<HubUser | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [activeEmbedMerchant, setActiveEmbedMerchant] = useState<HubMerchant | null>(null)

  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Initialize session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('chatze_hub_token')
    if (token) {
      setAuthToken(token)
      fetch('/api/hub/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setCurrentUser(data.user)
          } else {
            localStorage.removeItem('chatze_hub_token')
            setAuthToken(null)
          }
        })
        .catch(() => {
          localStorage.removeItem('chatze_hub_token')
          setAuthToken(null)
        })
    }
  }, [])

  const handleLoginSuccess = (user: HubUser, token: string) => {
    localStorage.setItem('chatze_hub_token', token)
    setCurrentUser(user)
    setAuthToken(token)
  }

  const handleLogout = () => {
    localStorage.removeItem('chatze_hub_token')
    setCurrentUser(null)
    setAuthToken(null)
  }

  const handleInquire = (merchant: HubMerchant) => {
    // If not logged in, prompt Google Sign-In first for anti-spam protection
    if (!currentUser) {
      setShowGoogleModal(true)
      return
    }

    // Track inquiry click on Hub
    fetch(`/api/hub/directory/${merchant.handle}/track-click`, { method: 'POST' }).catch(() => {})
    setActiveEmbedMerchant(merchant)
  }

  const handleOpenInMyChatze = (merchant: HubMerchant) => {
    if (!currentUser?.sovereign_node_url) return
    let targetStoreUrl = (merchant.letterbox_embed_url || '').trim()
    if (!targetStoreUrl.startsWith('http://') && !targetStoreUrl.startsWith('https://')) {
      targetStoreUrl = `https://${targetStoreUrl}`
    }
    
    // Deep-link directly into user's own sovereign Chatze instance
    const deepLink = `${currentUser.sovereign_node_url.replace(/\/+$/, '')}/inquire?store=${encodeURIComponent(targetStoreUrl)}`
    window.open(deepLink, '_blank')
  }

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] flex flex-col font-sans selection:bg-[#00a884] selection:text-[#111b21]">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        onOpenGoogleLogin={() => setShowGoogleModal(true)}
        onOpenRegisterStore={() => setShowRegisterModal(true)}
        onOpenUserProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Discovery Directory */}
      <main className="flex-1">
        <DiscoveryDirectory
          key={refreshTrigger}
          refreshTrigger={refreshTrigger}
          currentUser={currentUser}
          onInquire={handleInquire}
          onOpenInMyChatze={handleOpenInMyChatze}
          onOpenRegisterStore={() => {
            if (!currentUser) {
              setShowGoogleModal(true)
            } else {
              setShowRegisterModal(true)
            }
          }}
          onOpenGoogleLogin={() => setShowGoogleModal(true)}
        />
      </main>

      {/* Footer */}
      <footer className="bg-[#111b21] border-t border-[#222e35] py-6 px-4 text-center text-xs text-[#8696a0]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} <strong>Chatze Hub Gateway</strong> — Empowering Sovereign Commerce across Nepal
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Cloudflare D1 Sovereign Database</span>
            <span>•</span>
            <span>Zero Message Storage</span>
            <span>•</span>
            <span>Pure Sovereign Nodes</span>
          </div>
        </div>
      </footer>

      {/* Google Auth Modal */}
      {showGoogleModal && (
        <GoogleAuthModal
          onClose={() => setShowGoogleModal(false)}
          onSuccess={handleLoginSuccess}
        />
      )}

      {/* Store Registration Modal */}
      {showRegisterModal && (
        <RegisterStoreModal
          authToken={authToken}
          onClose={() => setShowRegisterModal(false)}
          onStoreRegistered={(newStore) => {
            setRefreshTrigger((prev) => prev + 1)
          }}
          onOpenGoogleLogin={() => setShowGoogleModal(true)}
        />
      )}

      {/* User / Merchant Profile Modal */}
      {showProfileModal && currentUser && (
        <UserProfileModal
          user={currentUser}
          authToken={authToken}
          onClose={() => setShowProfileModal(false)}
          onUpdateUser={(updated) => setCurrentUser(updated)}
          onOpenStoreEmbed={(merchant) => setActiveEmbedMerchant(merchant)}
          onStoreUpdated={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* Letterbox Live Embed Modal */}
      {activeEmbedMerchant && (
        <LetterboxEmbedModal
          merchant={activeEmbedMerchant}
          currentUser={currentUser}
          authToken={authToken}
          onClose={() => setActiveEmbedMerchant(null)}
          onOpenGoogleLogin={() => setShowGoogleModal(true)}
          onOpenInNewTab={(targetUrl) => {
            let url = (targetUrl || activeEmbedMerchant.letterbox_embed_url || '').trim()
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = `https://${url}`
            }
            window.open(url, '_blank')
          }}
        />
      )}
    </div>
  )
}

export default App
