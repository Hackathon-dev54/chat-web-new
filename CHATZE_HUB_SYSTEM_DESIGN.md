# Chatze Hub Gateway: Cloudflare D1 Sharded Architecture & Product Specification
**Centralized Discovery & Auth Bridge for Sovereign Cloudflare Chatze Nodes**

---

## 1. Overview & Core Mission

The **Chatze Hub** is the central bridge and discovery directory that:
1. Gives non-technical Nepali consumers a **1-tap Google Sign-In** experience (anti-bot, spam-shielded identity).
2. Catalogs self-deployed merchant Chatze nodes across Nepal (e.g., Kathmandu Handicrafts, Pokhara Footwear).
3. Provides an anti-bot, anti-spam firewall for merchants.
4. Operates with **Zero Chat Message Storage** and **Zero Thread Pointer Tracking** on the Hub server.
5. Uses Cloudflare Workers + **10 Sharded Free Cloudflare D1 Databases** (with an easy future migration path to Cloudflare R2 object storage).
6. **Gracefully handles Dual Identity**: Allows non-technical Google users to later link their own self-deployed Chatze nodes without conflict or identity confusion.

---

## 2. Cloudflare D1 Sharding Architecture (10 Databases)

Cloudflare D1's free tier provides 10 databases per Cloudflare account (each up to 500 MB storage, 5 million reads/day, 100k writes/day). By sharding across 10 databases, the Hub gets **5 GB of structured storage and 50 million reads/day for $0/month**.

### Shard Allocation:
* **`DB_HUB_META` (Shard 0):** System configuration, rate limiters, admin logs, blocked instances.
* **`DB_DIRECTORY` (Shard 1):** Verified business directory, shop profiles, categories, location (Kathmandu, Pokhara, etc.), search tags, and self-hosted `letterbox_embed_url`.
* **`DB_USERS_0` to `DB_USERS_7` (Shards 2 to 9):** User profile records (`google_sub`, name, email, avatar, and optional `sovereign_node_url`).

### Sharding Formula (Consistent Hashing):
```ts
export function getCustomerDbShard(googleSubOrId: string, env: Env) {
  // Hash the Google user ID (e.g. FNV-1a hash mod 8)
  const hash = fnv1a(googleSubOrId);
  const shardIndex = Math.abs(hash) % 8; // 0..7
  const shardBindings = [
    env.DB_USERS_0,
    env.DB_USERS_1,
    env.DB_USERS_2,
    env.DB_USERS_3,
    env.DB_USERS_4,
    env.DB_USERS_5,
    env.DB_USERS_6,
    env.DB_USERS_7,
  ];
  return shardBindings[shardIndex];
}
```

---

## 3. Database Schemas (Minimal & Zero-Message)

### Shard 1: `DB_DIRECTORY` (Directory of Registered Stores & Embed URLs)
```sql
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,                       -- e.g. "m_ram_crafts"
  handle TEXT UNIQUE NOT NULL,               -- e.g. "@ramcrafts"
  business_name TEXT NOT NULL,               -- "Kathmandu Wood & Crafts"
  category TEXT NOT NULL,                    -- "Handicrafts", "Clothing", "Food"
  city TEXT NOT NULL,                        -- "Kathmandu", "Pokhara", "Lalitpur"
  bio TEXT,
  logo_url TEXT,
  phone_whatsapp_optional TEXT,
  
  -- The Merchant's Self-Deployed Letterbox URL
  letterbox_embed_url TEXT NOT NULL,         -- e.g. "https://ram-crafts.pages.dev/letterbox"
  owner_google_sub TEXT,                     -- If registered by a Google-authenticated merchant
  
  verification_status TEXT DEFAULT 'active', -- 'active', 'featured', 'flagged'
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_merchants_category ON merchants(category);
CREATE INDEX idx_merchants_city ON merchants(city);
CREATE INDEX idx_merchants_handle ON merchants(handle);
```

### Shards 2–9: `DB_USERS_0..7` (User Identity & Optional Sovereign Node Link)
```sql
CREATE TABLE users (
  google_sub TEXT PRIMARY KEY,               -- Google Unique Subject ID
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  
  -- Sovereign Node Link (if customer later self-hosts Chatze)
  sovereign_node_url TEXT,                   -- NULL if non-tech, or "https://bikash.pages.dev"
  sovereign_verified_at INTEGER,             -- Timestamp when Hub pinged node-info
  
  created_at INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);
```

> **CRITICAL ARCHITECTURAL LAW:**
> **The Hub does NOT store thread pointers, message logs, or request statuses (`pending` | `accepted`)!**
> All request statuses, pending vs. accepted flows, inquiry queues, and chat histories are **natively built into each merchant's self-deployed Chatze instance**. 
> The Hub is strictly the **identity provider + discovery directory**.

---

## 4. Resolving the Dual Identity Conflict

### The Challenge:
What happens when a non-technical customer who previously chatted via their Google profile on the Hub decides after 6 months to **self-deploy their own Chatze instance** on Cloudflare?
* Identity 1: Google Account on the Hub (`name`, `email`, `avatar`).
* Identity 2: Self-Deployed Chatze Node (`https://bikash.pages.dev` + cryptographic keys).

### The Solution: "Unified Identity with Dual Capability"

```
                       [ USER ON CHATZE HUB ]
                                 |
              Has Google Account: "Bikash (bikash@gmail.com)"
                                 |
              [ Settings -> Link Sovereign Chatze Node ]
                 Pastes: https://bikash.pages.dev
                                 |
             Hub verifies node with a 1-second ping
                                 |
                                 v
        +-------------------------------------------------+
        |           UPGRADED IDENTITY PROFILE             |
        |                                                 |
        | - Public Passport: Bikash (Verified Google)     |
        | - Sovereign Badge: 🛡️ https://bikash.pages.dev   |
        +-------------------------------------------------+
```

### How the User Chats in Each Scenario:

#### Scenario A: Casual Shopping Inquiry (Default)
* When inquiring with a new shop on the Hub, the user chats as **Bikash (Verified Google)**.
* **Why?** Protects the user's private sovereign node from unwanted public spam.
* The merchant's Letterbox interface displays:
  > **From:** Bikash `(Verified Google)`  
  > 🛡️ *Linked Sovereign Node:* `https://bikash.pages.dev`

#### Scenario B: One-Click Promotion to "Sovereign Friend"
Because the merchant's Letterbox sees that Bikash has a linked sovereign node:
* The merchant's interface shows an **`[ Add as Sovereign Friend ]`** button.
* If clicked, both sovereign nodes exchange private invite codes directly.
* The conversation seamlessly shifts into a **pure node-to-node direct encrypted chat** between:
  `https://bikash.pages.dev` $\longleftrightarrow$ `https://ram-crafts.pages.dev`
* Completely bypasses the Hub!

#### Scenario C: Direct Browsing from the User's Own Chatze Node
On every store card in the Discovery Directory, the user sees two options:
1. **`[ Inquire on Hub ]`**: Opens the embedded Letterbox in the browser.
2. **`[ Open in My Chatze ]`**: Deep-links directly to the user's self-deployed node (`https://bikash.pages.dev/inquire?store=https://ram-crafts.pages.dev`).

---

## 5. Pure Embed & Identity Flow

```
                                  [ CHATZE HUB ]
                                         |
                       Customer signs in with Google
                 (Spam protected; Hub stores basic profile)
                                         |
                       Customer browses Discovery Directory
                     Clicks store: "Kathmandu Wood Crafts"
                                         |
                                         v
               +---------------------------------------------------+
               |               EMBEDDED LETTERBOX                  |
               |                                                   |
               |  Hub embeds: https://ram-crafts.pages.dev/letterbox
               |                                                   |
               |  Hub passes verified Google Profile Token:        |
               |  { name: "Bikash", email: "...", avatar: "...",   |
               |    sovereign_node: "https://bikash.pages.dev" }   |
               +---------------------------------------------------+
                                         |
                                         | (Customer types inquiry & sends)
                                         v
                     +---------------------------------------+
                     |        MERCHANT'S CLOUDFLARE D1       |
                     |                                       |
                     |  1. Letterbox records inquiry         |
                     |  2. Displays "Bikash" as verified     |
                     |  3. Status = 'pending'                |
                     |  4. Merchant accepts -> Regular chat  |
                     +---------------------------------------+
```

### Why this is 100x cleaner:
1. **Zero Hub Storage Overhead:** The Hub never tracks pending, accepted, rejected, or deleted chats.
2. **Zero Dual-State Bugs:** The merchant node is the single source of truth for the conversation.
3. **Zero Legal Liability on Hub:** The Hub never holds, relays, or logs customer inquiries or business messages.
4. **Self-Contained Merchant Logic:** The merchant node enforces its own rate limits, auto-replies, and business hours.

---

## 6. Security Architecture & Threat Model

1. **Anti-Spam & Bot Shield:** Non-technical users cannot send inquiries without Google Sign-In. Malicious bots are stopped at the Hub boundary.
2. **Zero-Trust Token Passing:** The Hub signs identity tokens with an Ed25519/HMAC key. Merchant nodes verify the signature before displaying the user as verified.
3. **Isolation & Sandboxing:** Embedded Letterboxes run in secure sandboxed iframes or clean JSON message bridges, preventing cross-origin script injection.
4. **Storage Bloat Protection:** Customer browsers cache recent store handles in local storage/IndexedDB for instant access without burdening the Hub D1 database.

---

## 7. Migration Strategy to Cloudflare R2 (Future Scale)

When the directory scales to hundreds of thousands of stores and users:
1. Store logos, product catalogs, and user avatars bypass D1 and stream directly to **Cloudflare R2**.
2. R2 provides **zero egress fees**, guaranteeing $0 bandwidth bills across Nepal.

---

## 8. Rogue Node Verification & Embed Security Model (Defending Against Malicious Forks)

### The Threat:
Because Chatze is a free, open-source, self-deployable repository:
1. Anyone can fork Chatze and modify the code (e.g. inject phishing forms, add fake login popups, or alter behavior).
2. Anyone could attempt to submit an arbitrary, malicious web app URL to the Chatze Hub directory claiming to be a legitimate merchant Letterbox.

---

### The 4-Tier Security Verification Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIER 1: IFRAME HARDENING                     │
│  sandbox="allow-scripts allow-forms allow-same-origin"          │
│  Strictly blocks: top-navigation, modals, popups, auto-downloads│
└─────────────────────────────────┬───────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              TIER 2: BACKEND NODE HANDSHAKE (PROTOCOL CHECK)    │
│  Hub probes: GET https://node/.well-known/chatze-node.json      │
│  - Verifies Letterbox v1 API compliance                         │
│  - Challenge-Response: Node must sign a random cryptographic    │
│    nonce using its ed25519 node key                             │
└─────────────────────────────────┬───────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│          TIER 3: "VERIFIED OFFICIAL BUILD" BADGE (SRI HASH)     │
│  - Compare client build hash against official GitHub Release    │
│  - Clean Build -> 🛡️ Verified Official Build                    │
│  - Custom Fork -> ⚠️ Community Fork (User Warning Banner)       │
└─────────────────────────────────┬───────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│             TIER 4: ZERO-TRUST IDENTITY & REPUTATION            │
│  - Hub only passes signed public JWT (Name + Google Sub)        │
│  - Never pass credentials, access tokens, or parent DOM access  │
│  - Instant delisting & domain blocklist in Hub Shard DB         │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Breakdown:

#### 1. Tier 1: Browser-Level Iframe Sandboxing (Client-Side Defense)
Modern browsers enforce strict Same-Origin Policy (SOP). Inside the Hub's `LetterboxEmbedModal.tsx`, we enforce:
```html
<iframe
  src={merchant.letterbox_url}
  sandbox="allow-scripts allow-forms allow-same-origin"
  loading="lazy"
  title={merchant.business_name}
/>
```
* **Strictly Blocked by Sandboxing:**
  * ❌ **No `allow-top-navigation`:** The embedded store CANNOT hijack, redirect, or change the parent Hub tab.
  * ❌ **No `allow-modals`:** The embedded store CANNOT spam `alert()`, `confirm()`, or modal overlays over the Hub.
  * ❌ **No `allow-popups-to-escape-sandbox`:** Cannot open uncontained popup windows.
  * ❌ **No Silent Auto-Downloads:** Browsers block drive-by file downloads from sandboxed iframes.
* **Unforgeable Origin Address Bar:** The parent Hub renders a locked, uneditable header above the iframe:
  `🔒 Connected to: https://kathmanducrafts.workers.dev` so the customer always sees the exact host origin.

#### 2. Tier 2: Cryptographic Node Handshake (`/.well-known/chatze-node.json`)
When a merchant registers their URL on Chatze Hub, the Hub backend performs an automated cryptographic handshake:
1. Hub sends an outbound HTTP request to `https://merchant-node.workers.dev/.well-known/chatze-node.json`.
2. The node must return valid JSON declaring protocol compliance:
   ```json
   {
     "protocol": "chatze-letterbox-v1",
     "version": "1.0.0",
     "node_id": "node_7a9c2f...",
     "public_key": "MCowBQYDK2VwAyEA...",
     "owner_name": "Patan Handicrafts"
   }
   ```
3. **Challenge-Response:** Hub sends a random challenge string (`nonce_xyz`). The node must sign it using its private key and return the signature. If a regular website or fake clone is entered, the handshake fails and registration is rejected.

#### 3. Tier 3: "Verified Official Build" vs "Custom Community Fork" Badges
To balance open-source freedom with user safety:
* **🛡️ Verified Official Build:** Chatze GitHub releases publish official asset build hashes (`release-hashes.json`). When a node's assets match the official build, the Hub awards a verified green badge.
* **⚠️ Custom Community Fork:** If the merchant edited the client code or customized their frontend, the Hub flags it as a community fork with an informational warning:
  > *"Note: This store is running a custom modified version of Chatze. Messages remain isolated to their node."*

#### 4. Tier 4: Zero-Trust Identity Flow & Instant Delisting
* **Zero Credential Exposure:** Hub never passes Google passwords, refresh tokens, or session secrets to the iframe. Only a signed JWT containing public claims (`name`, `google_sub`, `timestamp`) is shared.
* **Link Shield:** Any external URLs sent by a merchant require an explicit safety warning before opening.
* **Administrative Delisting:** Reported or compromised nodes can be instantly banned and purged from the Hub's Shard 1 directory database.

