// Official Deployed Chatze Hub Gateway URL
export const CHATZE_HUB_URL =
  (import.meta as any).env?.VITE_CHATZE_HUB_URL || 'https://chatze-hub.ucouses.workers.dev'

export function getHubStoreUrl(handle?: string) {
  if (!handle) return CHATZE_HUB_URL
  return `${CHATZE_HUB_URL}/?shop=${encodeURIComponent(handle)}`
}
