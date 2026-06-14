# AI Truck Logistics Platform — Changelog

All sessions with Claude Code (claude-sonnet-4-6). Ordered newest-first per section.

---

## 2026-06-14 — Bug Fixes: White Screen & Cache

### Root Cause Found & Fixed: React White Screen
**File:** `apps/web/src/pages/trucker/DashboardPage.tsx`
- **Bug:** PostgreSQL `NUMERIC` columns (e.g. `rating`, `commissionRate`) are serialised as strings (`"5.00"`) in JSON. The dashboard called `user?.rating?.toFixed(1)` on the string — `String.prototype.toFixed` does not exist → `TypeError: T.toFixed is not a function` → React unmounts entire tree → white screen with no visible error.
- **Fix:** Changed to `parseFloat(String(profile?.rating ?? user?.rating)).toFixed(1)` with null guard.
- Line 223: `{profile?.rating?.toFixed(1) ?? user?.rating?.toFixed(1) ?? '–'}` → safe `parseFloat()` wrapper.
- Line 352 (backhaul distances): `load.distance_km?.toFixed(0)` → `Number(load.distance_km ?? 0).toFixed(0)`.

**File:** `apps/web/src/pages/trucker/LoadsPage.tsx`
- Fixed all `?.toFixed()` calls on `distance_km`, `pickup_dist_km`, `dropoff_to_home_km`, `detour_km` fields — all arrive as strings from the load service.
- Pattern applied: `someVar?.toFixed(n)` → `Number(someVar ?? 0).toFixed(n)`.

### Zustand Auth Session Invalidation
**File:** `packages/state/src/auth.store.ts`
- Changed persist storage key from `'auth-storage'` to `'auth-storage-v2'`.
- **Why:** After Docker restart, browsers had stale localStorage sessions from the old bundle. Old sessions caused `RootRedirect` to send users directly to `/trucker/dashboard` (which crashed) instead of `/login`. Changing the key causes all browsers to ignore old persisted data and start fresh.

### nginx: Cache-Busting & New Routes
**File:** `apps/web/nginx.conf`
- Added `Cache-Control: no-cache, no-store, must-revalidate` + `Pragma: no-cache` + `Expires: 0` to the HTML `location /` block.
- Added `Cache-Control: public, immutable; expires 1y` to asset files (`.js`, `.css`, fonts, images) — safe because Vite uses content hashes in filenames.
- Added `location = /clear-cache` route: serves an inline HTML page that clears `localStorage` + `sessionStorage` and redirects to `/login`. Used to recover browsers stuck on a stale bundle.
- **Why:** nginx cached `api_gateway` container IP at startup. After container restarts the IP changed → stale IP → 502. Fixed with `resolver 127.0.0.11 valid=10s ipv6=off; set $api_host api_gateway;` to force DNS re-resolution every 10s.

### Docker: Rebuilt Web Image Workflow
**File:** `scripts/docker-up-v6.sh`
- Removed old bundle-patching steps (steps 6 & 7 from v5) that patched the running container's JS file. Replaced with a proper Docker build that bakes all fixes into the image.
- Build command: `docker build -f apps/web/Dockerfile -t truck_web_rebuilt .`
- Starts `truck_web` container from `truck_web_rebuilt` image on port 3010.

---

## 2026-06-13 — Features: Journey, i18n, Simulation, Mobile

### Journey Management System (Full End-to-End)
**File:** `apps/web/src/pages/trucker/JourneyPage.tsx`
- Leaflet map with pickup (green) + drop (red) markers, OSRM route polyline.
- Step progress bar: Accepted → Loading Cargo → In Transit → Delivered.
- "Start Journey" button (sets load to `in_transit`, creates `journey_log` DB row).
- "Log Fuel Stop" form (liters, cost, station name).
- "Mark Delivered" button (closes journey, updates stats).
- Toll estimate: `Math.round(km/65)` booths × ₹295/booth (NHAI NH heavy truck rate).
- Fuel estimate: `km/4` litres × ₹93/L diesel.
- Overpass API integration for nearby fuel stations.

**File:** `apps/web/src/pages/trucker/DashboardPage.tsx` (journey additions)
- Added "Active Load" banner fetching from `/api/v1/truckers/my/active-load`.
- "View Journey →" button linking to `/trucker/journey`.
- Backhaul suggestion widget: fetches return-trip loads near GPS location.
- Weather widget: Open-Meteo API with WMO weather codes + driving advisories.
- Document expiry alerts: insurance/permit/fitness with days-remaining badges.

**File:** `apps/web/src/components/Layout.tsx`
- Added "My Journey 🚛" nav item to trucker sidebar.
- Added `LanguageSelector` component in sidebar footer (trucker portal only).

**File:** `apps/web/src/App.tsx`
- Added `/trucker/journey` route → `JourneyPage`.
- Wrapped all routes in `<I18nProvider>`.
- Fixed `ProtectedRoute` and `RootRedirect` to handle `admin` userType: redirects to `http://192.168.8.101:3011/admin` (prevents infinite loop on merchant routes).
- `RootRedirect` returns `null` after setting `window.location.href` to prevent React errors.

**File:** `apps/web/src/pages/auth/LoginPage.tsx`
- Post-login redirect checks `userType` from store: admin → port 3011, trucker → `/trucker/dashboard`, merchant → `/dashboard`.

### Internationalisation (i18n) — 9 Languages
**Files:** `apps/web/src/i18n/translations.ts`, `useI18n.ts`, `I18nProvider.tsx`
- 9 languages: English, Hindi, Punjabi, Gujarati, Marathi, Tamil, Telugu, Kannada, Bengali.
- ~100 keys each covering all trucker UI strings.
- `useI18n()` hook + `I18nContext` with `localStorage` persistence (`app_lang` key).
- `LangCode` and `TKey` union types for type-safe translation access.

**File:** `apps/web/src/components/LanguageSelector.tsx`
- Globe icon dropdown showing native script names (हिन्दी, ਪੰਜਾਬੀ, etc.).
- CSS-only hover reveal (no state needed).

### Backend Journey Routes (Hot-Patched)
**File:** `scripts/trucker-routes-patch.js` (deployed to `truck_trucker_service:/app/dist/`)
- `GET  /api/v1/truckers/my/active-load` — returns active load + journey log + fuel stops.
- `POST /api/v1/truckers/my/journey/start` — sets load `in_transit`, creates `journey_logs` row.
- `POST /api/v1/truckers/my/journey/fuel-stop` — inserts `fuel_stops` row, updates journey totals.
- `POST /api/v1/truckers/my/journey/deliver` — sets load `delivered`, closes `journey_logs` row.
- `GET  /api/v1/truckers/my/journey/stats` — lifetime km/trips/fuel/earnings aggregate.
- `GET  /api/v1/truckers/my/begin-loading` — gate: trucker must have `accepted` load to start loading.
- Tables auto-created on first request: `journey_logs`, `fuel_stops`.
- User identified via `req.headers['x-user-id']` (not `req.user`).

### Admin Simulation Page
**File:** `apps/admin/src/app/admin/simulation/page.tsx`
- 4 control panels: seed truckers, seed loads, set GPS, view live status.
- Seeds 3 truckers (Bangalore/Delhi/Mumbai) + 3 merchants with verified KYC.
- Seeds 6 loads per city with real Indian routes, distances, and freight prices.
- Fixed UUIDs: truckers `f1000000-...-0001/2/3`, merchants `f2000000-...-0001/2/3`.
- Password for sim accounts: `Admin@123` (PBKDF2 hash, no bcrypt).

**File:** `scripts/deploy_simulation.sh`
- One-command deploy to any server: `bash deploy_simulation.sh <ip> <user>`.

### Admin Live Fleet Map
**File:** `apps/admin/src/app/admin/live-map/page.tsx`
- Leaflet + MarkerCluster CDN, live trucker positions from `/api/v1/truckers/live-positions`.
- Click a trucker marker → shows OSRM route polyline (dashed, status-coloured) + ETA panel.
- Status colours: `on_load`/`in_transit` → orange, `available` → green, `offline` → grey.

### Admin Loads Page Fix
**File:** `apps/admin/src/app/admin/loads/page.tsx`
- Calls load service directly at `http://192.168.8.101:3001/api/v1/loads/search`.
- Added inline Dispute button with type dropdown (waiting_charge/damage/late_delivery/etc).

### Admin Users Page — Staff Creation
**File:** `apps/admin/src/app/admin/users/page.tsx`
- "Create Staff User" modal → `POST /api/v1/admin/staff-users`.
- Bypasses KYC. Roles: admin/developer/tester/qa.
- Uses `crypto.pbkdf2Sync` (no bcrypt dependency needed).

### Trucker Portal — Loads Page: My Loads Tab + Disputes
**File:** `apps/web/src/pages/trucker/LoadsPage.tsx`
- Added 4th tab "My Loads" showing trucker's load history.
- "Raise Dispute" button per load: type dropdown + description text → `POST /api/v1/admin/disputes`.

### Backend: Live Positions Endpoint
**File:** `scripts/trucker-routes-patch.js` (updated)
- Added `GET /api/v1/truckers/live-positions` → JOINs `users + trucks + loads`, returns all trucker GPS positions with load status.

### Backend: ML Service Phase 1 LLM Router
**File:** `services/ml-service/src/ai/phase1-router.ts`
- 15 task types (social.hashtags, eta.plain_language, admin.dispute_suggestion, etc.).
- FAST path → Ollama mistral:7b, QUALITY → llama3.1:8b, COMPLEX → Claude Haiku.
- Hot-patched to `truck_ml_service` via `POST /api/ai/generate`.

### Backend: Disputes Endpoint
**Patched:** `truck_admin_service:/app/dist/app.js`
- `POST /api/v1/admin/disputes` — creates dispute row. Fetches merchant/trucker UUIDs from loads table. Validates `dispute_type` against DB CHECK constraint.

---

## 2026-06-12-13 — Admin Panel Enhancements & Social Features

### Admin Panel Rebuilt with Sign-Out
**Image:** `truck_admin_panel_new`
- Rebuilt Next.js 14 standalone image.
- Added Sign Out button to `AdminLayout` sidebar footer: clears localStorage, redirects to port 3010 login.
- **Docker build fix:** `npm workspaces` installs React in `apps/admin/node_modules` but Next.js at `/app/node_modules/next` can't find it. Fix: `RUN cp -r /app/apps/admin/node_modules/react /app/node_modules/react`.
- Standalone output: `server.js` at `/app/apps/admin/server.js` — `WORKDIR` must be `/app/apps/admin` before `CMD`.

### Merchant Social Post Creation
**File:** `apps/web/src/pages/merchant/SocialPage.tsx`
- Platform selector (Instagram/LinkedIn/Twitter/Facebook) with character limits.
- Manual caption mode and AI-assisted mode (caption generation via ML service).
- Posts enter `pending_approval` state → admin reviews in `/admin/social`.

### Social Post Approval Workflow
**File:** `apps/admin/src/app/admin/social/page.tsx`
- Admin sees pending posts with platform + merchant info.
- Approve → `published`, Reject (with reason modal) → `rejected`.
- Real data from `truck_social_service` (was previously hardcoded fake numbers).

### Admin: Merchant Approval Workflow
**File:** `apps/admin/src/app/admin/merchants/page.tsx`
- Tab with pending merchant registrations.
- KYC approve/reject with reason modal → updates merchant status.

### Admin: API Status & Integration Monitor
**File:** `apps/admin/src/app/admin/api-status/page.tsx`
- 9 service health checks (all microservices) + external integrations table.
- Auto-refreshes every 30s.

---

## 2026-06-12 — Core Platform Build (Phases 1–7)

### Infrastructure (18 Docker Containers)
- **Databases:** PostgreSQL 16 + PostGIS, MongoDB 7, Redis 7, Elasticsearch 8.
- **Messaging:** Apache Kafka + Zookeeper, RabbitMQ.
- **Services (ports 3000–3008):** api_gateway, load_service, trucker_service, pricing_service, admin_service, social_service, ml_service, notification_service, payment_service.
- **Frontends:** truck_web (port 3010, Vite + React 18 + TailwindCSS), truck_admin_panel (port 3011, Next.js 14 standalone).

**File:** `docker-compose.yml` — full 18-service compose definition.
**File:** `scripts/docker-up-v6.sh` — startup script with all runtime patches.

### Vite Monorepo Build (apps/web)
**File:** `apps/web/vite.config.ts`
- Resolve aliases for `@truck-platform/shared`, `@truck-platform/api-client`, `@truck-platform/state` directly from TypeScript source (`../../packages/*/src`) — no dist/ compilation needed.

**File:** `apps/web/Dockerfile`
- Multi-stage: `deps` (npm install) → `build` (vite build) → `runner` (nginx:1.27-alpine).
- `ARG VITE_API_URL=/api/v1` baked at build time.

### API Client Package
**File:** `packages/api-client/src/axios.instance.ts`
- `baseURL = '/api/v1'`, Bearer token injection, auto-refresh on 401.
- `configureApiClient()` called in `apps/web/src/main.tsx` with Zustand store callbacks.

**File:** `packages/api-client/src/api/truckers.api.ts`
- `getProfile()`, `getEarningsSummary(period)`, `getLoadHistory(params)`, `updateAvailability(status)`.

### Runtime Patches Applied on Every Start
All patches in `scripts/` are applied by `docker-up-v6.sh` via `docker cp` on every boot:

| Patch file | Container | Bug fixed |
|---|---|---|
| `proxy.routes.patch.js` | truck_api_gateway | Login hang: `express.json()` consumed body; Express stripped `/api/v1` prefix. Fixed via `req.originalUrl` + body re-injection. |
| `auth.service.patch.js` | truck_trucker_service | White screen after login: DB returns `snake_case`, React expects `camelCase`. Fixed via `toUser()` mapper. |
| `trucker-routes-patch.js` | truck_trucker_service | Missing endpoints: profile, trucks, earnings, history, journey, bank, KYC, document-alerts, live-positions, backhaul. |
| `mongo.patch.js` | truck_social_service | MongoDB URI: password `TruckPlatform@2024!Mongo` contains `@`; standard URI parser splits on first `@`. Fixed by splitting on last `@`. |
| `admin-kyc.routes.patch.js` | truck_admin_service | Column `kyc_doc_front_key` does not exist → correct column is `kyc_doc_front_url`. |
| `admin-analytics.routes.patch.js` | truck_admin_service | Column `platform_commission` not in payments; status `captured` → `completed`. |
| `admin-feature-flags.routes.patch.js` | truck_admin_service | Column `flag_name` does not exist → correct columns are `flag_key`/`flag_value`. |
| `admin-app.patch.js` | truck_admin_service | `audit_logs` used `user_id` → correct column is `admin_id`. |
| `admin-users.routes.patch.js` | truck_admin_service | `audit_log` INSERT wrong columns; removed broken S3 signed URL code. |

### Database Schema Key Points
- `disputes` table: `raised_by`/`raised_against` = UUID FK to `users`; `dispute_type` CHECK constraint; `description` column (not `reason`); `load_id` = varchar(50) FK to `loads`.
- `journey_logs` table: `load_id`, `trucker_id`, `started_at`, `completed_at`, `total_km`, `total_fuel_litres`, `total_toll_cost`.
- `fuel_stops` table: FK to `journey_logs`, `fuel_liters`, `fuel_cost`, `station_name`, `logged_at`.

### Mobile App (Expo 51 / React Native 0.74)
**File:** `apps/mobile/app/(trucker)/tracking.tsx`
- MapView with current position (🚛) + destination (📍) markers.
- OSRM route polyline with straight-line fallback.
- Speed badge overlay (km/h), 4 metric cards: distance/ETA/toll estimate/fuel estimate.
- Route advisory: NH guidance, FASTag reminder, rest-stop rules.
- Start/Stop Navigation + Confirm Pickup/Delivery actions.

**File:** `apps/mobile/app/(trucker)/loads.tsx`
- Fixed `load.origin` → `load.origin.city`; pricing/cargo nested field access.

**File:** `apps/mobile/app/(trucker)/dashboard.tsx`
- Changed `loadsApi.getMerchantLoads` → `truckersApi.getLoadHistory({status:'in_transit', pageSize:1})`.

**File:** `apps/mobile/app/(trucker)/profile.tsx`
- Fixed `updateAvailability({isAvailable:bool})` → `updateAvailability('available'|'offline')`.

**APK:** `app-debug.apk` (173 MB) at `f:\AI_BOT\AI Trucker App\app-debug.apk`
- Built with `expo export:embed` + `./gradlew assembleDebug`.
- Points to `http://192.168.8.101:3000/api/v1`.

---

## Test Credentials

| Role | Phone | Password |
|---|---|---|
| Merchant | +919880001001 | TruckQA@2024 |
| Trucker | +919770001001 | TruckQA@2024 |
| Admin | +919000000001 | TruckQA@2024 |
| Sim Trucker BLR | +919860001001 | Admin@123 |
| Sim Trucker DEL | +919860001002 | Admin@123 |
| Sim Trucker MUM | +919860001003 | Admin@123 |

## Access URLs

| Service | URL |
|---|---|
| Web App (Merchant + Trucker) | http://192.168.8.101:3010 |
| Admin Panel | http://192.168.8.101:3011/admin |
| API Gateway | http://192.168.8.101:3000 |
| Clear browser cache | http://192.168.8.101:3010/clear-cache |

## QA Results

- Initial QA: 36/36 tests passing (run `qa_final.js` inside `truck_api_gateway` container).
- Full regression (2026-06-13): 38/38 tests passing (run `node /tmp/qa_full_regression.js` on server).
