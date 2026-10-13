export interface HubBindings {
  DB_HUB_META?: any
  DB_DIRECTORY?: any
  DB_USERS_0?: any
  DB_USERS_1?: any
  DB_USERS_2?: any
  DB_USERS_3?: any
  DB_USERS_4?: any
  DB_USERS_5?: any
  DB_USERS_6?: any
  DB_USERS_7?: any
  
  ENVIRONMENT?: string
  HUB_NAME?: string
  GOOGLE_CLIENT_ID?: string
  JWT_SECRET?: string
  ASSETS?: any
}

export interface HubMerchant {
  id: string
  handle: string
  business_name: string
  category: string
  city: string
  address?: string
  bio?: string
  logo_url?: string
  banner_url?: string
  phone_whatsapp_optional?: string
  tags?: string
  letterbox_embed_url: string
  owner_google_sub?: string
  verification_status: 'verified' | 'featured' | 'unverified' | 'flagged'
  verified_tier?: 'tier1_origin' | 'tier2_crypto'
  public_key?: string
  view_count?: number
  inquiry_clicks?: number
  created_at: number
  updated_at: number
}

export interface HubUser {
  google_sub: string
  email: string
  display_name: string
  avatar_url?: string
  sovereign_node_url?: string | null
  sovereign_handle?: string | null
  sovereign_verified_at?: number | null
  role: 'customer' | 'merchant' | 'admin'
  created_at: number
  last_login: number
}

export interface IdentityTokenPayload {
  google_sub: string
  email: string
  display_name: string
  avatar_url?: string
  sovereign_node_url?: string | null
  sovereign_handle?: string | null
  iss: string
  exp: number
  iat: number
}
