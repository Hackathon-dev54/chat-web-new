# Chatze Hub Gateway

**Zero-Knowledge Discovery Directory & Google Auth Bridge for Sovereign Cloudflare Chatze Nodes**

---

## 🌟 What is Chatze Hub?

Chatze Hub is a lightweight, high-performance gateway built for Cloudflare Workers & Cloudflare Pages.
It is designed to be completely independent from self-deployed Chatze instances:

1. **Non-Technical User Passport (Google Sign-In):** Provides ordinary Nepali consumers with an effortless 1-tap Google login to prevent bots and spam, giving them a verified identity badge when inquiring with local shops.
2. **Sovereign Store Directory:** Lists verified merchant Chatze instances across Nepal (Kathmandu, Pokhara, Lalitpur, Biratnagar, etc.) categorized by industry (Handicrafts, Electronics, Clothing, Local Services).
3. **Pure Embed Architecture (Zero Message Relay):**
   * The Hub **NEVER** stores messages, inquiry notes, or active thread pointers.
   * Merchant stores are embedded via their self-hosted Letterbox URLs (`https://<store>.pages.dev/letterbox`).
   * All conversation states (`pending`, `accepted`, `rejected`, `deleted`) live exclusively on the merchant's private Cloudflare D1 database.
4. **10 Sharded Cloudflare D1 Databases ($0/month scale):**
   * `DB_HUB_META` (Shard 0): System config, rate limiting, audit logs.
   * `DB_DIRECTORY` (Shard 1): Registered stores, verification badges, categories, and embed URLs.
   * `DB_USERS_0..7` (Shards 2..9): User profiles sharded by consistent hashing of Google `sub` ID.
5. **Dual-Identity Upgrades:**
   * Non-technical users start with a verified Google profile.
   * If a user later deploys their own sovereign Chatze node, they can link their URL (`https://user.pages.dev`).
   * Merchants can then upgrade them to direct peer-to-peer sovereign friends in 1 click!

---

## 📁 Project Structure

```
chatze-hub/
├── README.md
├── wrangler.toml                    # Cloudflare Workers configuration with 10 D1 sharded bindings
├── package.json                     # Standalone dependencies (Hono, Tailwind, Lucide, etc.)
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite bundler for Hub
├── migrations/                      # SQL migrations for all 10 D1 database shards
│   ├── 0000_meta_schema.sql
│   ├── 0001_directory_schema.sql
│   └── 0002_users_shards_schema.sql
├── src/
│   ├── index.html                   # HTML entry point for the Hub
│   ├── main.tsx                     # React client entry point
│   ├── App.tsx                      # Discovery Directory, Store Cards, Embed Modal, User Settings
│   ├── index.css                    # Tailwind CSS styles
│   ├── server/                      # Cloudflare Worker Edge API
│   │   ├── index.ts                 # Hono worker application entry
│   │   ├── types.ts                 # Shard bindings & schema types
│   │   ├── sharding.ts              # Consistent hashing across DB_USERS_0..7
│   │   ├── auth.ts                  # Google OAuth verification & Hub JWT generation
│   │   ├── routes/
│   │   │   ├── directory.ts         # Public store search, city filters & category exploration
│   │   │   ├── auth.ts              # Google Sign-in & session verification
│   │   │   ├── merchants.ts         # Merchant registration & sovereign node health verification
│   │   │   └── user.ts              # Profile retrieval & sovereign node linking
│   │   └── mockData.ts              # Initial directory seed (Kathmandu Handicrafts, Thamel Books, etc.)
│   └── components/
│       ├── Navbar.tsx               # Hub navigation with Google Sign-In & linked node status
│       ├── DiscoveryDirectory.tsx   # Search, filters, city tags & interactive store grid
│       ├── StoreCard.tsx            # Business card with "Inquire on Hub" and "Open in My Chatze"
│       ├── LetterboxEmbedModal.tsx  # Secure sandboxed iframe with verified identity bridge
│       ├── RegisterStoreModal.tsx   # For merchant owners to list their self-deployed Chatze
│       └── UserProfileModal.tsx     # Google profile & sovereign Chatze link management
```

---

## 🚀 Independent Deployment

To deploy Chatze Hub to a separate Cloudflare account:

```bash
cd chatze-hub
npm install

# 1. Create the 10 D1 databases on Cloudflare:
wrangler d1 create chatze-hub-meta
wrangler d1 create chatze-hub-directory
wrangler d1 create chatze-hub-users-0
wrangler d1 create chatze-hub-users-1
wrangler d1 create chatze-hub-users-2
wrangler d1 create chatze-hub-users-3
wrangler d1 create chatze-hub-users-4
wrangler d1 create chatze-hub-users-5
wrangler d1 create chatze-hub-users-6
wrangler d1 create chatze-hub-users-7

# 2. Run migrations across the shards:
wrangler d1 execute chatze-hub-meta --file=./migrations/0000_meta_schema.sql
wrangler d1 execute chatze-hub-directory --file=./migrations/0001_directory_schema.sql
for i in {0..7}; do
  wrangler d1 execute chatze-hub-users-$i --file=./migrations/0002_users_shards_schema.sql
done

# 3. Deploy worker & static assets to Cloudflare:
npm run deploy
```
