import React, { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing, Smartphone, Check, AlertCircle } from 'lucide-react'
import {
  isPushSupported,
  isIosDevice,
  isStandalonePwa,
  getExistingPushSubscription,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from '../lib/push'

export function NotificationToggle() {
  const [supported, setSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showIosPrompt, setShowIosPrompt] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      if (!isPushSupported()) {
        setSupported(false)
        return
      }
      setSupported(true)

      const sub = await getExistingPushSubscription()
      setIsSubscribed(Boolean(sub && Notification.permission === 'granted'))
    }
    checkStatus()
  }, [])

  const handleToggle = async () => {
    const token = localStorage.getItem('chatze_auth_token') || ''
    setFeedbackMsg(null)

    if (isIosDevice() && !isStandalonePwa()) {
      setShowIosPrompt(true)
      return
    }

    if (Notification.permission === 'denied') {
      setFeedbackMsg({
        type: 'error',
        text: 'Notifications are blocked in your browser settings. Please allow notifications for this site.',
      })
      return
    }

    setLoading(true)
    try {
      if (isSubscribed) {
        const ok = await unsubscribeUserFromPush(token)
        if (ok) {
          setIsSubscribed(false)
          setFeedbackMsg({ type: 'info', text: 'Notifications disabled.' })
        }
      } else {
        const result = await subscribeUserToPush(token)
        if (result.success) {
          setIsSubscribed(true)
          setFeedbackMsg({ type: 'success', text: 'Instant push notifications enabled!' })
        } else {
          setFeedbackMsg({ type: 'error', text: result.error || 'Failed to enable notifications.' })
        }
      }
    } finally {
      setLoading(false)
      setTimeout(() => setFeedbackMsg(null), 4000)
    }
  }

  if (!supported) return null

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          title={isSubscribed ? 'Notifications Active (Click to disable)' : 'Enable Instant Push Notifications'}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-medium transition-all cursor-pointer border ${
            isSubscribed
              ? 'bg-[#00a884]/15 border-[#00a884]/40 text-[#00a884] hover:bg-[#00a884]/25'
              : 'bg-[#202c33] border-[#2a3942] text-[#8696a0] hover:text-[#e9edef] hover:border-[#8696a0]'
          } disabled:opacity-50`}
        >
          {loading ? (
            <div className="w-3 h-3 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          ) : isSubscribed ? (
            <BellRing className="w-3 h-3 text-[#00a884] animate-pulse" />
          ) : (
            <Bell className="w-3 h-3" />
          )}
          <span className="hidden sm:inline">
            {isSubscribed ? 'Push Alerts On' : 'Enable Alerts'}
          </span>
        </button>

        {feedbackMsg && (
          <div
            className={`absolute top-full right-0 mt-2 z-50 px-3 py-2 rounded-xl text-xs shadow-2xl border backdrop-blur-md flex items-center gap-2 whitespace-nowrap animate-in fade-in duration-200 ${
              feedbackMsg.type === 'success'
                ? 'bg-[#111b21] border-[#00a884]/50 text-[#00a884]'
                : feedbackMsg.type === 'error'
                ? 'bg-[#111b21] border-red-500/50 text-red-400'
                : 'bg-[#111b21] border-[#202c33] text-[#e9edef]'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* iOS PWA Installation Helper Modal */}
      {showIosPrompt && (
        <div
          onClick={() => setShowIosPrompt(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full bg-[#111b21] border border-[#202c33] rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#00a884]">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#e9edef]">Enable iPhone Alerts</h3>
                <p className="text-xs text-[#8696a0]">Apple iOS 16.4+ Requirement</p>
              </div>
            </div>

            <p className="text-xs text-[#8696a0] leading-relaxed">
              Apple requires web apps to be added to your Home Screen before lockscreen push notifications can be activated:
            </p>

            <ol className="text-xs text-[#e9edef] space-y-2 bg-[#202c33]/50 p-3 rounded-xl border border-white/5 list-decimal list-inside">
              <li>Tap the <strong>Share</strong> button (box with arrow) at the bottom of Safari.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Open Chatze from your Home Screen and tap <strong>Enable Alerts</strong>!</li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosPrompt(false)}
              className="w-full py-2.5 bg-[#00a884] text-[#111b21] font-bold rounded-xl text-xs hover:bg-[#02906f] transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  )
}
