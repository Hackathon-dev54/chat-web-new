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

## 🔑 Environment Variables & Google OAuth Configuration

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Target | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Frontend (`.env`) | Google OAuth 2.0 Web Client ID rendered by Google Identity Services |
| `GOOGLE_CLIENT_ID` | Cloudflare Worker (`wrangler.toml` / secret) | Edge-side verification of Google ID token claims |
| `JWT_SECRET` | Cloudflare Worker (`wrangler.toml` / secret) | Signs the Hub Identity Token passed to merchant Letterboxes |

### How to obtain Google Web Client ID:
1. Visit [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create **OAuth Client ID** → **Web Application**.
3. Under **Authorized JavaScript Origins**, add:
   - `http://localhost:3001` (local development)
   - `https://<your-hub-name>.pages.dev` (Cloudflare Pages/Worker origin)
4. Add the Client ID to `chatze-hub/.env`:
   ```bash
   VITE_GOOGLE_CLIENT_ID="your-id.apps.googleusercontent.com"
   ```

*Note: If `VITE_GOOGLE_CLIENT_ID` is not yet configured, Chatze Hub gracefully activates **Developer Demo Mode** with 1-tap testing profiles so you are never blocked during testing!*

---

## 🚀 Automated Zero-Touch Deployment (No Manual Copy-Pasting!)

You **do not need to copy-paste any database IDs into `wrangler.toml` manually**. The included setup automation script does everything for you in a single command.

### Option A: 1-Click Zero-Config Deployment (Recommended)
This creates the D1 database on your Cloudflare account, auto-populates `wrangler.toml`, applies all SQL migrations, seeds initial stores, and deploys to Cloudflare Workers:

```bash
cd chatze-hub
npm install

# 1. Log in to Cloudflare (one-time):
npx wrangler login

# 2. Run the automated setup and deploy in 1 single command:
npm run deploy:auto
```

That's it! Everything is automatically provisioned, migrated, and deployed.

---

### Option B: Step-by-Step Setup
If you want to review the setup before deploying:

```bash
cd chatze-hub
npm install

# Auto-creates D1 database, seeds schema, and updates wrangler.toml:
npm run setup

# Build frontend and deploy to Cloudflare:
npm run build
npm run deploy
```

---

### Option C: 10-Database Sharded Cluster Mode
If you prefer the enterprise-scale 10-database sharding architecture:

```bash
# Automatically creates all 10 D1 databases, updates wrangler.toml, and runs migrations:
npm run setup:sharded

# Deploy:
npm run build
npm run deploy
```
*Zero manual editing of `wrangler.toml` required in any mode!*
