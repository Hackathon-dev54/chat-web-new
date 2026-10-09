# System Design: Zero-Invocations Letterbox & Dual-Channel Customer Inquiries

## 1. Executive Overview

The **Chatze Letterbox System** provides an asynchronous, zero-flood, spam-proof communication channel between customers (private accounts) and businesses (merchants and shops). It is engineered to solve two critical problems in decentralized and federated messaging:

1. **Server Resource Protection & Zero Invocations on Receiver**: Preventing untrusted customers or bots from triggering expensive backend compute, edge function executions, or recursive API invocations on the business's server infrastructure.
2. **Clean Separation of Identity & Chat Queues**: Keeping private social contacts ("Friends") strictly isolated from transactional inquiries ("Customer Letterbox"), while empowering business owners to seamlessly convert a verified customer inquiry into a trusted peer friend when desired.

---

## 2. Core Architectural Principles

### 2.1 The Passive Receiver Guarantee (Zero Compute Waste)
- **Sender Executes the Write**: When a customer (e.g. Suraj Singh) drops a letterbox inquiry or sends a message in an accepted inquiry chat, **only the customer’s request** performs a database write.
- **Business Edge is 100% Passive**: The business instance does not run background workers, cloud functions, cron tasks, or webhooks upon incoming customer messages. The merchant’s client receives the update through passive Server-Sent Events (SSE) or fetches it upon opening the app.
- **No Invocation Loops**: A customer sending 1 or 20 messages never forces the merchant's Cloudflare Worker / server to spin up isolated compute or burn billing quotas.

### 2.2 Authenticated Customer Identity (No Lost Messages)
- **Logged-in First**: If a user is logged in (e.g., `usr_suraj` / `@suraj_singh`), their inquiry is permanently bound to their verified cryptographic handle and user ID.
- **Deterministic Return Route**: When the business owner accepts the inquiry and replies, the response routes directly back to `@suraj_singh`. Messages never vanish into an anonymous guest void.
- **Graceful Unauthenticated Support**: If an unauthenticated visitor drops a note from the web portfolio, the card captures their contact phone/handle and generates a device-anchored local token so they can retrieve replies upon returning to the browser.

---

## 3. Dual-Channel Workflows: Step-by-Step

### Scenario A: Business Accepts as "Letterbox Customer Chat"
This is the default recommended workflow for normal commercial inquiries.

```
[Customer (Suraj Singh)]                                    [Business (Merchant)]
          |                                                           |
          |--- Drops 1-Card Inquiry (/api/inquiries) ---------------->|
          |    (Bound to @suraj_singh, 500 chars max)                 |
          |                                                           | [Stores in Pending Letterbox]
          |                                                           | [Shows in Merchant's "Letterbox" tab]
          |                                                           |
          |                                                           | Merchant reviews card & clicks:
          |                                                           | "Accept as Letterbox"
          |                                                           |
          |<-- SSE / Sync: Conversation Created (status: 'letterbox')-|
          |                                                           |
[Suraj's "Letterbox" Tab]                                   [Merchant's "Letterbox" Tab]
- Chat unlocked with Shop                                    - Chat unlocked with Customer
- Tagged with [Letterbox / Customer]                         - Tagged with [Letterbox / Customer]
- Friends list remains 100% clean                            - Friends list remains 100% clean
- 2-way messaging active                                     - 2-way messaging active
```

### Scenario B: Business Accepts as "Friend"
Used when the merchant knows the customer personally, wants to establish a permanent peer relationship, or collaborate.

```
[Customer (Suraj Singh)]                                    [Business (Merchant)]
          |                                                           |
          |--- Drops 1-Card Inquiry (/api/inquiries) ---------------->|
          |                                                           |
          |                                                           | Merchant clicks:
          |                                                           | "Accept as Friend"
          |                                                           |
          |<-- SSE / Sync: Friendship Activated + Conv ('active') ----|
          |                                                           |
[Suraj's "Friends" Tab]                                     [Merchant's "Friends" Tab]
- Promoted to Trusted Friend                                 - Added to Private Friends List
- Full peer federation features                              - Full peer federation features
- No longer in customer letterbox queue                      - Letterbox queue remains clean
```

---

## 4. Anti-Spam & Rate Limiting Pipeline (The 1-Card Gate)

To guarantee zero server exhaustion, incoming letterbox submissions must pass through five rigorous sequential gates before touching persistent storage:

```
[Incoming POST /api/inquiries]
               |
               v
    [1. Origin & Domain Blocklist Check]  ---> If blocked: Reject 403 Forbidden
               |
               v
    [2. Business Mode & Letterbox Enabled] ---> If private mode or toggle off: Reject 403
               |
               v
    [3. The 1-Card Deduplication Gate]     ---> If sender has pending note: Reject 429
               |                                (CARD_ALREADY_PENDING)
               v
    [4. Shop Queue Capacity (Max 20)]      ---> If >= 20 pending notes: Reject 429
               |                                (LETTERBOX_FULL)
               v
    [5. Content & Payload Sanitization]    ---> Max 500 characters, plain text,
               |                                category tag validation
               v
    [Persist to D1 / Memory & Push Event]
```

1. **Gate 1: Domain Blacklist Check**: Compares the sender's origin against the merchant's D1 `blocked_domains` table. Instant discard if blacklisted.
2. **Gate 2: Account Mode Verification**: Checks `account_type === 'business'` and `inquiry_letterbox_enabled === true`.
3. **Gate 3: 1-Card Deduplication**: A single user handle or root domain cannot drop multiple pending inquiries. They must wait for the merchant to accept or dismiss the previous one.
4. **Gate 4: Capacity Cap**: Enforces a strict maximum of 20 pending inquiries per shop to prevent queue ballooning.
5. **Gate 5: Strict Payload Limits**: Payload body is capped at 500 characters. No executable scripts or large media uploads permitted at the drop gate.

---

## 5. Data Models & State Architecture

### 5.1 Static Inquiries Table (`static_inquiries`)
```sql
CREATE TABLE IF NOT EXISTS static_inquiries (
  id TEXT PRIMARY KEY,
  sender_handle TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_user_id TEXT,             -- Optional: Bound to real logged-in user ID
  sender_root_domain TEXT NOT NULL,
  sender_origin_url TEXT,
  category TEXT,                   -- Price & Stock, Delivery, Wholesale, General
  content TEXT NOT NULL,           -- Max 500 chars
  status TEXT DEFAULT 'pending',   -- 'pending' | 'accepted' | 'dismissed'
  created_at INTEGER NOT NULL
);
```

### 5.2 Conversations Status Flag (`conversations`)
A single `conversations` table manages both peer-to-peer friend chats and customer letterbox chats via the `status` enum:
- `status = 'active'`: Regular mutual friend / connected contact conversation. Displayed under the **Friends** tab and **All** tab.
- `status = 'letterbox'`: Customer inquiry conversation. Displayed under the **Letterbox** tab. Strictly isolated from personal friends.
- `status = 'pending'`: Unaccepted inbound federated connection request.

### 5.3 Frontend Tab Classification Matrix

| Tab Filter | Includes Conditions | Excludes |
| :--- | :--- | :--- |
| **All** | All active conversations (`status === 'active'` and `status === 'letterbox'`) | Pending connection requests |
| **Friends** | Conversations where `status === 'active'` and contact is in `friendships` | Any conversation with `status === 'letterbox'` |
| **Letterbox** | Conversations where `status === 'letterbox'` + Pending incoming inquiry cards | Mutual friends (`status === 'active'`) |
| **Unread** | Any conversation where `unreadCount > 0` | Fully read threads |

---

## 6. Zero-Invocations Server Cost Comparison

| Metric | Traditional Chatbot / Webhook Approach | Chatze Letterbox Architecture |
| :--- | :--- | :--- |
| **Customer Send Cost** | Wakes up backend server, triggers worker script, calls webhook | 1 direct D1/store write from customer request |
| **Business Compute Cost** | 1 full invocation per message received | **0 invocations** (Passive client-side SSE stream) |
| **Receiver Resource Usage** | High memory & CPU; vulnerable to denial-of-wallet | **Zero compute cost** on receiver |
| **Spam Susceptibility** | High (infinite message streaming) | Zero (Strict 1-Card gate until business accepts) |
| **Federation Interop** | Closed garden or complex OAuth | Open domain federation via cryptographic handles |

---

## 7. Implementation Roadmap & Verification

1. **System Design Documentation**: Complete specification committed to `SYSTEM_DESIGN_LETTERBOX.md`.
2. **Customer Identity Binding**: Enhance `CustomerInquiryPage.tsx` and `/api/inquiries` to detect existing session tokens (`chatze_auth_token`) and bind `sender_user_id` and verified `currentUser.handle`.
3. **Dual Acceptance Endpoints**: Ensure `/api/inquiries/reply` fully sets conversation status to `letterbox` (or `active` for friend acceptance), updating both participants' IndexedDB stores.
4. **Clean UI Tab Segmentation**: Ensure both private accounts and business accounts have an intuitive, dedicated **Letterbox** tab where inquiries and customer threads live cleanly without polluting personal friends lists.
