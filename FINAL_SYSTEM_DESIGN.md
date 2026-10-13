# Chatze: Final System Architecture & Protocol Specification
**The Sovereign, Hybrid Federated Communication Platform for Nepal**

---

## 1. Executive Summary & Core Philosophy

Chatze solves the fundamental dilemma of decentralized messaging:
* **The Decentralization Paradox:** Pure decentralized/federated platforms (Matrix, Nostr, Mastodon) fail for normal consumers because asking a Nepali shopper to deploy a GitHub repo or manage cryptographic private keys just to ask a shop *"Dai, size 42 chha?"* creates insurmountable friction.
* **The Centralized Monopoly Problem:** Centralized platforms (WhatsApp Business, Facebook Messenger) trap business data, sell user metadata, charge steep messaging fees, and create vulnerability to account bans.

### The Chatze Hybrid Model:
1. **Zero-Friction Gateway (`chatze.np`):** Non-technical consumers access all registered shops across Nepal with **1-Tap Google Sign-In**. Zero setup, zero keys, zero server knowledge.
2. **Sovereign Edge Nodes (Self-Hosted on Cloudflare):** Businesses and tech-savvy users deploy their own node with 1 click to Cloudflare Pages + D1 for **$0/month forever**. They own 100% of their customer records, chat history, and inventory queries.
3. **Strict Two-Tier Communication Firewall:**
   * **Tier 1 (Letterbox):** Transactional, commercial, and casual inquiries. Default for everyone. Kept completely separate from personal life. Auto-deletable post-sale.
   * **Tier 2 (Friends):** Sacred, peer-to-peer personal circle. Strictly requires both parties to have self-hosted nodes and exchange a private one-time cryptographic invite code.

---

## 2. High-Level Ecosystem Architecture

```
+===================================================================================+
|                                CHATZE ECOSYSTEM                                    |
+===================================================================================+

    [ NON-TECHNICAL CONSUMER ]                     [ CASUAL VISITOR / INSTAGRAM ]
          | (1-Tap Google Auth)                           | (Click link in bio)
          v                                               v
+-----------------------------------------------------------------------------------+
|                            CHATZE GATEWAY / DIRECTORY                             |
|                           (e.g., https://chatze.np)                              |
|                                                                                   |
|  * Google OAuth Verification & Anti-Bot Shield (reCAPTCHA / Signed Session)      |
|  * Verified Nepal Merchant Directory & Search (Handles: @ram_crafts, etc.)        |
|  * Unified Customer Letterbox UI (Read/Reply to all shops in 1 place)             |
|  * Zero Message Storage on Server:                                                |
|      - Live Pull-on-Demand from Merchant D1                                       |
|      - Local Device Cache via Phone IndexedDB                                     |
|  * Server-to-Server HMAC Relayer (Completely eliminates CORS & iframe issues)     |
+-----------------------------------------------------------------------------------+
                   |                                       |
                   | Server-to-Server Signed               | Server-to-Server Signed
                   | HMAC-SHA256 Payload                   | HMAC-SHA256 Payload
                   v                                       v
+--------------------------------------+  +--------------------------------------+
|  MERCHANT A: SOVEREIGN EDGE NODE     |  |  MERCHANT B: SOVEREIGN EDGE NODE     |
|     (e.g., ram-crafts.pages.dev)     |  |     (e.g., ktm-boots.pages.dev)      |
|                                      |  |                                      |
|  * Cloudflare Pages + Worker + D1    |  |  * Cloudflare Pages + Worker + D1    |
|  * Private D1 Database (Owns data)   |  |  * Private D1 Database (Owns data)   |
|  * Letterbox Receiver Engine         |  |  * Letterbox Receiver Engine         |
|  * Merchant Dashboard (Web / PWA)    |  |  * Merchant Dashboard (Web / PWA)    |
|  * Auto-delete / Post-Sale retention |  |  * Auto-delete / Post-Sale retention |
+--------------------------------------+  +--------------------------------------+
                   ^
                   | Direct Node-to-Node Federation (Bypasses Gateway)
                   | Verified via One-Time Invite Code (CHATZE-XXX-YYY)
                   v
+-----------------------------------------------------------------------------------+
|                       TIER 2: PEER-TO-PEER SOVEREIGN FRIEND                       |
|                     (e.g., suraj-personal.pages.dev - Self-Hosted)                |
|                                                                                   |
|  * Direct Instance-to-Instance API Sync                                           |
|  * End-to-End Encrypted Personal Chat & Calls                                     |
|  * Zero Gateway Intermediary                                                      |
+-----------------------------------------------------------------------------------+
```

---

## 3. The Two-Tier Channel Specification

### Tier 1: Letterbox (Inquiries & Commerce)
* **Target Audience:** Anyone (Google Sign-In Gateway users + Self-Hosted users).
* **Primary Use Case:** Product queries, stock checks, pricing, reservations, support.
* **Separation Rule:** Lives strictly inside the **Letterbox tab**. Never appears in the user's or merchant's private Friends list.
* **Data Retention & Lifecycle:**
  * **Configurable Quotas:** Merchant sets rules (e.g., auto-archive 7 days after sale, delete messages after 30 days, or max 100 messages per inquiry).
  * **Owner Closure:** Merchant can click `[Mark as Resolved / Sale Completed]`, which closes the thread.
  * **Customer Record:** Customer can retain their local receipt in their device's IndexedDB even if the merchant cleans up their Cloudflare D1 table.

### Tier 2: Friends (High-Trust Sovereign Peer Circle)
* **Target Audience:** Strictly users who have **Self-Deployed Nodes** on both ends.
* **Primary Use Case:** Family, close friends, long-term business partners.
* **Access Control:** Requires exchanging a **One-Time Cryptographic Invite Code** (e.g. `CHATZE-842-194`).
* **Zero Cold Spam:** A stranger or advertiser can **never** add someone as a Friend directly. They can only submit a Letterbox inquiry.

### The Promotion Protocol (Letterbox -> Friend)
```
[ Customer & Merchant chat in Letterbox ]
                 |
                 v
   Merchant clicks "Promote to Friend"
                 |
        +--------+--------+
        |                 |
[ If Customer on Gateway ] [ If Customer has Self-Deployed Node ]
        |                              |
        v                              v
Prompt in UI:                   Merchant instance generates 6-digit
"Suraj is on Gateway.           One-Time Secret Code (valid 15 mins).
To establish private E2EE              |
Friend link, Suraj must                v
deploy their free Node."        Suraj enters code into his node settings.
                                       |
                                       v
                               Thread permanently migrates from
                               Letterbox into the Sovereign Friends Tab!
```

---

## 4. Cross-Origin, CORS & Security Architecture

### Why iframes and direct browser calls fail:
1. **CORS Restrictions:** Browser security blocks `chatze.np` client-side JavaScript from fetching `ram-crafts.pages.dev`.
2. **Cookie & Storage Sandboxing:** Safari and iOS aggressively block third-party cookies and local storage inside embedded iframes.
3. **Mobile Layout Degradation:** Virtual keyboards in Android/iOS break iframe scrolling and viewport resizing.

### The Solution: Server-to-Server Signed Gateway Bridge
All client communication from `chatze.np` communicates with the Gateway's backend API, which initiates authenticated server-to-server HTTP calls to the merchant's Cloudflare Worker.

```
[ Customer Browser ]
       |
       | 1. HTTPS POST /api/gateway/letterbox/send (Same-origin to chatze.np)
       |    Session: Verified Google JWT Token
       v
[ Chatze Gateway Node (Edge / Cloudflare / Node) ]
       |
       | 2. Computes HMAC-SHA256 signature using Merchant Shared Secret:
       |    Signature = HMAC_SHA256(merchant_secret, timestamp + body)
       |    Server-to-Server HTTPS POST -> https://ram-crafts.pages.dev/api/letterbox/inbound
       |    Headers:
       |      X-Chatze-Signature: <HMAC_HEX>
       |      X-Chatze-Timestamp: <EPOCH_MS>
       |      X-Chatze-Customer-Id: <GOOGLE_UID>
       v
[ Merchant Node (Cloudflare Worker + D1) ]
       |
       | 3. Verifies HMAC signature against environment secret:
       |    - If invalid or timestamp expired (>300s): Reject 403 Forbidden.
       |    - If valid: Insert into D1 `letterbox_inquiries` table.
```

### Security Guarantees:
* **Anti-Bypass:** Merchant nodes reject any incoming request that lacks a valid Gateway HMAC signature or a registered Peer signature. Direct internet bots scraping the URL get an instant `403 Forbidden`.
* **Zero Gateway Storage Cost:** The Gateway operates statelessly. It simply relays verified packets. The storage burden is decentralized across the merchants' D1 databases.

---

## 5. Storage & Privacy Architecture

### The Problem:
If the central Gateway stores every chat message, the platform operator will eventually face massive server and database bills as thousands of Nepali shops generate millions of images and messages.

### The Chatze Solution: "Zero-Gateway-Storage + On-Demand Pull"
| Layer | Storage Medium | What is Stored | Cost |
| :--- | :--- | :--- | :--- |
| **Chatze Gateway** | Minimal KV / Cloud SQL / D1 | Google User Auth Profile (Email, Name, Avatar, Registered Instance URL) | ~$0 (Tiny records) |
| **Merchant Node** | Cloudflare D1 (Free Tier) | Actual customer messages, timestamps, sale status, inventory notes | $0 (Free 5M reads / 100k writes daily) |
| **Customer Phone** | Browser IndexedDB | Local cached copy of conversations, offline message cache (with LRU pruning) | $0 (Stored on device) |

### Pull-on-Demand Flow:
1. Customer logs into `chatze.np` with Google.
2. Customer selects "Kathmandu Handcrafts" from their recent letterbox list.
3. Gateway calls `ram-crafts.pages.dev/api/letterbox/history?customer_id=google_98124` using the server-to-server signed token.
4. Merchant's D1 returns the current thread.
5. If the merchant auto-deleted the chat (e.g. after sale), the response returns `{ status: "resolved_archived" }`.
6. Customer's phone checks local IndexedDB:
   * If local copy exists: "Sale Completed — Thread Archived by Shop (Viewing local receipt)".
   * Thread remains read-only.

---

## 6. The Dual-Citizen Protocol (Customer -> Sovereign Node Upgrade)

### The Problem:
What happens if a user starts as a non-technical Google customer today, but 6 months later deploys their own sovereign Chatze node (`suraj-node.pages.dev`)?

### The Non-Conflicting Migration Flow:
1. **Link Identity:** Inside `suraj-node.pages.dev` settings, Suraj clicks **"Link Gateway Identity"** and signs in with `suraj@gmail.com`.
2. **Gateway Pointer Update:**
   * Gateway updates Suraj's routing record:
     ```json
     {
       "google_email": "suraj@gmail.com",
       "self_hosted_node_url": "https://suraj-node.pages.dev",
       "routing_mode": "direct_federation"
     }
     ```
3. **Seamless Transition:**
   * From that point forward, whenever any shop replies to `suraj@gmail.com`, the Gateway automatically redirects the payload to `https://suraj-node.pages.dev/api/federation/v1/inbox`.
   * Suraj can now use his own self-hosted Chatze PWA on his home screen for all notifications!

---

## 7. Merchant Post-Sale Lifecycle & Retention Controls

Merchants have complete autonomy over their Cloudflare D1 storage. Chatze provides built-in retention triggers:

1. **Auto-Cleanup Rules:**
   * `Archive on Sale`: When merchant marks "Product Delivered / Deal Closed", messages are purged from active D1 tables after 48 hours.
   * `Inactivity Expiry`: Inquiries with no replies for 14 days automatically close.
   * `Message Limits`: Max 50 messages per Letterbox thread before requiring an explicit extension or quote confirmation.
2. **Export to PDF/JSON:**
   * One-click invoice or chat export for bookkeeping before deleting.

---

## 8. Deep Security Analysis: Threat Modeling & Answers

### Threat 1: "Will storing chats in customer's IndexedDB bloat their phone?"
* **Why IndexedDB text does not bloat phones:**
  * 1,000 text messages take roughly **~150 Kilobytes** (less than a single photo!).
  * Even with 100 active merchant letterbox conversations, the total data stored is under **15 MB**.
* **Chatze Automatic Pruning (LRU Policy):**
  * IndexedDB stores messages in an active ring buffer with an **LRU (Least Recently Used) cache**.
  * Any inactive thread older than 30 days has its raw message history cleared locally, keeping only a **1-line summary receipt** (e.g. *"Kathmandu Handcrafts: Order #401 completed on Oct 12, Total Rs 1,450"*).
  * If the customer opens that thread again, Chatze Gateway fetches the messages on demand from the merchant node (if still preserved).

### Threat 2: "What if the merchant deletes chat history? Does the customer lose their proof of payment/order?"
* **Cryptographic Deal Receipt (Dual-Signed Settlement Hash):**
  * When a customer and merchant agree on a price/order, Chatze generates a **Deal Receipt** containing:
    `{ order_id, amount_npr, items, timestamp, merchant_pubkey, customer_google_sub }`
  * This receipt is cryptographically hashed (SHA-256) and signed.
  * The receipt is **pinned permanently in the customer's IndexedDB** and can be exported as an image/PDF.
  * Even if the merchant wipes their entire Cloudflare D1 database 10 minutes later, the customer holds immutable cryptographic proof of what was ordered and agreed upon!

### Threat 3: "What if a merchant forks Chatze, modifies the code into a malicious hacking app, and connects it to our Gateway Hub?"
**"Can a rogue merchant trigger auto-downloads, execute viruses, or inject malicious code onto the customer's phone?"**
* **The answer is NO, because of how Chatze renders letterbox threads:**
  1. **NO Iframes from Merchant URLs:** 
     * The customer NEVER loads the merchant's external website (`https://rogue-hacker-shop.pages.dev`) directly inside the browser or inside an iframe.
     * The customer stays 100% on `https://chatze.np`.
  2. **Strict Data-Only JSON Contract:**
     * The Gateway only exchanges raw **JSON strings** with the merchant node (`{ sender: "merchant", text: "Hello", timestamp: 123456 }`).
     * No HTML, no `<script>` tags, no iframes, and no JavaScript executables are ever accepted from a merchant node.
  3. **Strict Content Sanitization & CSP:**
     * All incoming text from merchant nodes is parsed through a strict HTML sanitizer (DOMPurify / React JSX escaping). Any `<script>`, `onload=`, `href="javascript:..."` is completely stripped.
  4. **No Auto-Downloads & Safe Link Shields:**
     * Chatze disables browser file auto-downloads.
     * If a merchant sends an external URL (`http://free-iphone-download.com`), Chatze renders an explicit **External Link Interstitial Warning Modal**:
       > *"Warning: You are leaving Chatze. This link leads to an external website: [link]. Never install unknown APKs or files."*

### Threat 4: "What if the customer is a hacker and sends malicious payloads / SQL injections to the merchant's Cloudflare node?"
* **Why the merchant's Cloudflare D1 is protected:**
  1. **Cloudflare D1 Parameterized Queries:**
     * In the standard Chatze merchant worker, all database writes use D1 Prepared Statements:
       `env.DB.prepare('INSERT INTO letterbox_messages (thread_id, sender, content) VALUES (?, ?, ?)').bind(threadId, sender, cleanContent).run()`
     * SQL injection is mathematically impossible because input is treated purely as parameter values, never concatenated as executable SQL strings.
  2. **HMAC Signature Check & Google Auth Gate:**
     * A malicious attacker cannot flood a merchant's node directly with bot requests.
     * Every payload arriving at the merchant node must carry an HMAC header `X-Chatze-Signature` signed by the Chatze Gateway. If the request was not routed through Google-authenticated sessions on the Gateway, the merchant node's Cloudflare Worker drops the HTTP request immediately with `401 Unauthorized`.
  3. **Payload Size & Rate Limits:**
     * Cloudflare Workers reject any payload larger than 64KB on letterbox endpoints.
     * Cloudflare WAF + IP rate limiting protects the merchant worker from DDoS.

---

## 9. Summary Table: Architectural Decisions & Rationale

| Challenge | Flawed / Naive Way | Chatze Architecture | Result |
| :--- | :--- | :--- | :--- |
| **Customer Login** | Force customer to create an account on merchant's Cloudflare site | 1-Tap Google Sign-In on central Gateway (`chatze.np`) | Zero friction; 100% familiar to non-tech Nepali users |
| **Bot & Spam Attacks** | Public open webhook URLs | Gateway verifies Google session + signs payload with HMAC-SHA256 | Bots cannot call merchant nodes directly; 0 spam |
| **Hosting Costs** | Central server stores all chat history & files | Zero Gateway Message Storage; data stays in merchant's free Cloudflare D1 | Gateway operator bills remain ~$0 |
| **UI Embedding** | Clunky iframes with Safari third-party cookie blocks | Server-to-Server Signed API Bridge | Fast native UI, perfect mobile keyboard handling |
| **Social Spam** | Strangers messaging private profiles | Letterbox isolation: Inquiries stay separate from personal Friends | Friends list remains 100% clean and sacred |
| **Upgrade Path** | Locked into proprietary database | Identity Linking allows upgrading from Google user to Sovereign Node | Zero data lock-in; empowers users |
| **Phone Bloat** | Unchecked caching of years of chat | LRU Ring Buffer + Cryptographic Deal Receipts | Text takes <15MB; receipt preserved even if merchant deletes |
| **Rogue Merchant / Virus** | Loading merchant URL inside an iframe | Gateway exchanges raw sanitized JSON only; No iframes; Link Shield | Rogue merchant cannot inject scripts or auto-download files |

---

## 10. Rogue Node Verification & Embed Security Architecture (Custom Forks & Zero-Trust Iframe Defense)

### 10.1 The Threat Vector
Because Chatze is a public, open-source repository designed to be self-hosted on Cloudflare Pages and Workers:
1. **Malicious Forks:** An attacker could fork Chatze, inject malicious scripts, phishing modals, or malicious link spam, and deploy it to `https://evil-shop.workers.dev`.
2. **Directory Poisoning:** An attacker could attempt to register an arbitrary non-Chatze website into the Hub directory claiming to be a legitimate store.

---

### 10.2 The 4-Tier Security Verification Model

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

### 10.3 Defense in Depth Breakdown

#### Tier 1: Client-Side Iframe Sandboxing (Browser SOP Protection)
When rendering a store's Letterbox within Chatze Hub:
* **Sandbox Flags Enforced:**
  `sandbox="allow-scripts allow-forms allow-same-origin"`
* **Omissions & Protections:**
  * **No `allow-top-navigation`:** Prevents malicious redirects or tab hijacking.
  * **No `allow-modals`:** Prevents alert/confirm dialog spam.
  * **No `allow-popups-to-escape-sandbox`:** Prevents uncontained popup windows.
  * **Same-Origin Isolation:** The iframe has zero access to Chatze Hub cookies, localStorage, session tokens, or parent DOM.
* **Persistent Origin Bar:** Chatze Hub renders a locked address bar displaying the exact target origin (`🔒 Connected to: https://kathmanducrafts.workers.dev`).

#### Tier 2: Cryptographic Node Handshake (`/.well-known/chatze-node.json`)
Before any store URL is accepted by Chatze Hub:
1. Hub backend sends an automated probe to:
   `https://node-domain/.well-known/chatze-node.json`
2. The endpoint must declare protocol compliance:
   ```json
   {
     "protocol": "chatze-letterbox-v1",
     "version": "1.0.0",
     "node_id": "node_7a9c2f...",
     "public_key": "MCowBQYDK2VwAyEA...",
     "owner_name": "Patan Handicrafts"
   }
   ```
3. **Cryptographic Challenge-Response:** Hub generates a random nonce (`nonce_abc123`). The node Worker signs it with its Ed25519 private key. Hub validates the signature against the node's public key. Non-Chatze and arbitrary URLs fail this test and are rejected immediately.

#### Tier 3: Subresource Integrity (SRI) & Build Verification
* Official releases published to GitHub generate cryptographic asset hashes (`release-hashes.json`).
* **🛡️ Verified Official Build:** Awarded when client-side assets match the official build digest.
* **⚠️ Custom Community Fork:** Allowed for open-source extensibility, but flagged with an informative caution banner to customers.

#### Tier 4: Zero-Trust Identity Flow & Administrative Moderation
* **Zero Credential Sharing:** The Hub never passes passwords, OAuth refresh tokens, or session tokens to the node. Only signed public claims (`display_name`, `google_sub`, `timestamp`) are passed.
* **Link Shield & Interstitial Modal:** All outbound URLs rendered from merchant messages pass through a safe link interstitial warning modal.
* **Instant Delisting:** Hub admins can delist or block any reported malicious domain in Shard 1 (`DB_DIRECTORY`) with immediate global propagation.

