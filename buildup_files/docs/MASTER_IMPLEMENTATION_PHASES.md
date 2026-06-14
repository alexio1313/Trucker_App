# 🚀 AI TRUCK LOGISTICS PLATFORM
## Master Phase-by-Phase Implementation Guide for Claude Code
### References: All 7 Architecture Documents

---

## 📚 REFERENCE DOCUMENTS (Feed ALL to Claude Code)

```
1. AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md     ← Base architecture, DB schemas, AI/ML models
2. NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md          ← Docker, cross-platform, admin panel, LLM
3. IMPLEMENTATION_GUIDE_ALL_QUESTIONS.md           ← Answers, code examples, scaling
4. MASTER_INDEX_SUMMARY.md                        ← Feature checklist, cost, roadmap
5. QUICK_REFERENCE_CHEATSHEET.md                  ← Commands, tech stack, troubleshooting
6. README.md                                      ← Overview, how to use documents
7. FINAL_SUMMARY.txt                              ← Visual summary, investment guide
```

> **INSTRUCTION FOR CLAUDE CODE:** Before starting ANY phase, re-read the relevant
> sections from the reference documents listed above. All code must follow the
> architecture, naming conventions, and patterns defined in those documents.

---

## 🗺️ COMPLETE IMPLEMENTATION ROADMAP

```
PHASE 1  →  PHASE 2  →  PHASE 3  →  PHASE 4  →  PHASE 5  →  PHASE 6  →  PHASE 7
Docker       Monorepo     API Layer    Frontend     AI/ML        Admin        Deploy
(Week 1-2)   (Week 2-3)   (Week 3-6)   (Week 6-10)  (Week 8-12)  (Week 10-14) (Week 12-16)
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 1: LOCAL DOCKER ENVIRONMENT
# Timeline: Week 1–2 | Priority: CRITICAL
# Reference Docs: #2 (NEXT_LEVEL_ARCHITECTURE_V2) + #5 (QUICK_REFERENCE)
# ═══════════════════════════════════════════════════

## PHASE 1 OBJECTIVE
Get all 15 services running locally in Docker so the team can develop and test in an isolated, reproducible environment identical to production.

---

## 1.1 FOLDER STRUCTURE TO CREATE

```
truck-platform/
├── docker-compose.yml              ← 15 services (from NEXT_LEVEL_ARCHITECTURE_V2.md)
├── docker-compose.override.yml     ← Dev overrides (volumes, ports)
├── .env.example                    ← Template with all required variables
├── .env                            ← Local secrets (gitignored)
├── .gitignore
├── scripts/
│   ├── docker-up.sh                ← Start all services
│   ├── docker-down.sh              ← Stop cleanly
│   ├── docker-reset.sh             ← Wipe & restart
│   ├── health-check.sh             ← Verify all services healthy
│   └── seed-db.sh                  ← Seed test data
├── init-scripts/
│   ├── postgres-init.sql           ← DB schemas on first boot
│   ├── mongo-init.js               ← MongoDB collections on first boot
│   └── redis-init.sh               ← Redis keyspace setup
└── monitoring/
    ├── prometheus.yml              ← Scrape configs
    └── grafana/
        └── dashboards/
            └── platform.json       ← Pre-built dashboard
```

---

## 1.2 SERVICES TO CONFIGURE IN docker-compose.yml

Claude Code: implement each service EXACTLY as specified in NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md Section "DOCKER CONTAINERIZATION":

| Service | Image | Port | Health Check | Notes |
|---------|-------|------|-------------|-------|
| postgres | postgres:16-alpine | 5432 | pg_isready | max_connections=300 |
| mongodb | mongo:7.0-alpine | 27017 | mongosh ping | |
| redis | redis:7.2-alpine | 6379 | redis-cli ping | 2GB maxmemory, allkeys-lru |
| rabbitmq | rabbitmq:3.13-management | 5672, 15672 | diagnostics ping | with management UI |
| kafka | confluentinc/cp-kafka:7.5.0 | 9092 | topic list | depends on zookeeper |
| zookeeper | confluentinc/cp-zookeeper:7.5.0 | 2181 | ruok | for Kafka |
| elasticsearch | elasticsearch:8.10.0 | 9200 | curl ping | single-node, 512MB heap |
| ollama | ollama/ollama:latest | 11434 | /api/tags | pull mistral:7b on start |
| api_gateway | custom build | 3000 | /health | entry point for all APIs |
| load_service | custom build | 3001 | /health | load CRUD, matching |
| trucker_service | custom build | 3002 | /health | driver operations |
| pricing_service | custom build | 3003 | /health | AI pricing engine |
| admin_service | custom build | 3004 | /health | admin operations |
| social_service | custom build | 3005 | /health | social media publishing |
| web | custom build | 3010 | / | React web app |
| prometheus | prom/prometheus | 9090 | /-/ready | metrics collection |
| grafana | grafana/grafana | 3020 | /api/health | dashboards |

---

## 1.3 ENVIRONMENT VARIABLES (.env.example)

Claude Code: create `.env.example` with all of these — no secrets in git:

```bash
# Database
DB_PASSWORD=dev_password_change_in_prod
MONGO_PASSWORD=dev_password_change_in_prod

# Auth
JWT_SECRET=dev_secret_change_in_prod_min_32_chars
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d

# External APIs
GOOGLE_MAPS_API_KEY=your_key_here
CLAUDE_API_KEY=your_anthropic_key_here          # Optional, falls back to Ollama
STRIPE_SECRET_KEY=your_stripe_key_here
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# Social Media
FACEBOOK_APP_ID=your_fb_app_id
FACEBOOK_APP_SECRET=your_fb_secret
INSTAGRAM_ACCESS_TOKEN=your_ig_token
TWITTER_API_KEY=your_twitter_key
TWITTER_API_SECRET=your_twitter_secret
LINKEDIN_CLIENT_ID=your_li_client_id
LINKEDIN_CLIENT_SECRET=your_li_secret
WHATSAPP_BUSINESS_TOKEN=your_wa_token

# Monitoring
GRAFANA_PASSWORD=admin
SENTRY_DSN=your_sentry_dsn_optional

# Feature Flags
ENABLE_AI_PRICING=true
ENABLE_FRAUD_DETECTION=true
ENABLE_SOCIAL_PUBLISHING=true
ENABLE_OLLAMA_FALLBACK=true
```

---

## 1.4 DATABASE INITIALIZATION

Claude Code: create `init-scripts/postgres-init.sql` with ALL tables from
`AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md` Section 7 "DATA MODELS":

```sql
-- Core tables to implement:
-- 1. users (merchants, truckers, admins)
-- 2. trucks (vehicle registry)
-- 3. loads (freight orders)
-- 4. load_tracking (GPS time-series)
-- 5. pricing_history
-- 6. sla_tracking
-- 7. toll_charges
-- 8. payments
-- 9. ratings
-- 10. disputes
-- 11. notifications
-- 12. audit_logs
-- 13. social_posts
-- 14. fraud_alerts
-- 15. feature_flags

-- ALL with:
-- ✅ UUID primary keys
-- ✅ created_at / updated_at timestamps
-- ✅ soft delete (deleted_at)
-- ✅ proper indexes (see PHASE 1.5)
-- ✅ foreign key constraints
-- ✅ check constraints for enums
```

---

## 1.5 CRITICAL DATABASE INDEXES

Claude Code: add these indexes at end of postgres-init.sql for 10K+ user performance:

```sql
-- Performance indexes (from IMPLEMENTATION_GUIDE Q6)
CREATE INDEX CONCURRENTLY idx_loads_merchant_id   ON loads(merchant_id) WHERE status != 'cancelled';
CREATE INDEX CONCURRENTLY idx_loads_status_date   ON loads(status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_loads_origin_geo    ON loads USING GIST(origin_location);
CREATE INDEX CONCURRENTLY idx_loads_dest_geo      ON loads USING GIST(dest_location);
CREATE INDEX CONCURRENTLY idx_tracking_load_ts    ON load_tracking(load_id, timestamp DESC);
CREATE INDEX CONCURRENTLY idx_users_email         ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_users_phone         ON users(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY idx_trucks_trucker      ON trucks(trucker_id, status);
CREATE INDEX CONCURRENTLY idx_payments_load       ON payments(load_id, status);
CREATE INDEX CONCURRENTLY idx_fraud_user_ts       ON fraud_alerts(user_id, created_at DESC);
```

---

## 1.6 HEALTH CHECK SCRIPT

Claude Code: create `scripts/health-check.sh`:

```bash
#!/bin/bash
# Verify all 15 services are healthy before development begins
# Print ✅ or ❌ for each service with response time
# Exit code 1 if any service is unhealthy
```

---

## 1.7 PHASE 1 ACCEPTANCE CRITERIA

```
✅ docker-compose up -d starts without errors
✅ All 15 containers show "healthy" in docker-compose ps
✅ http://localhost:3000/health returns 200
✅ http://localhost:3010 loads the web app
✅ http://localhost:3020 loads Grafana (admin/admin)
✅ http://localhost:15672 loads RabbitMQ UI (guest/guest)
✅ PostgreSQL has all 15 tables created
✅ Ollama has mistral:7b pulled and responding
✅ health-check.sh exits 0
✅ seed-db.sh inserts test users, trucks, loads
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 2: MONOREPO PROJECT STRUCTURE
# Timeline: Week 2–3 | Priority: CRITICAL
# Reference Docs: #2 (NEXT_LEVEL), #3 (IMPLEMENTATION_GUIDE Q2)
# ═══════════════════════════════════════════════════

## PHASE 2 OBJECTIVE
Set up the entire repository structure so all platforms (iOS, Android, Web, Admin, Tablet) share maximum code with zero duplication.

---

## 2.1 COMPLETE MONOREPO STRUCTURE

```
truck-platform/                         ← Root workspace
├── package.json                        ← Workspace definition (npm/yarn workspaces)
├── turbo.json                          ← Turborepo pipeline config
├── tsconfig.base.json                  ← Shared TypeScript config
├── .eslintrc.base.js                   ← Shared lint rules
├── .prettierrc                         ← Shared formatting
│
├── packages/                           ← 100% SHARED CODE (no platform deps)
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/                  ← All TypeScript interfaces
│   │   │   │   ├── load.types.ts
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── trucker.types.ts
│   │   │   │   ├── pricing.types.ts
│   │   │   │   ├── tracking.types.ts
│   │   │   │   └── index.ts
│   │   │   ├── constants/              ← API routes, enums, config
│   │   │   │   ├── api.constants.ts
│   │   │   │   ├── load.constants.ts
│   │   │   │   └── index.ts
│   │   │   ├── utils/                  ← Pure utility functions
│   │   │   │   ├── format.utils.ts     ← Currency, distance, time
│   │   │   │   ├── validation.utils.ts ← Input validators
│   │   │   │   ├── geo.utils.ts        ← Distance calc, geofence
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/                     ← All HTTP calls (Axios-based)
│   │   ├── src/
│   │   │   ├── client.ts               ← Axios instance + interceptors
│   │   │   ├── auth.api.ts
│   │   │   ├── loads.api.ts
│   │   │   ├── truckers.api.ts
│   │   │   ├── pricing.api.ts
│   │   │   ├── tracking.api.ts
│   │   │   ├── admin.api.ts
│   │   │   ├── social.api.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── state/                          ← Zustand stores (shared state logic)
│   │   ├── src/
│   │   │   ├── auth.store.ts
│   │   │   ├── loads.store.ts
│   │   │   ├── tracking.store.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui-kit/                         ← Shared design tokens + base components
│       ├── src/
│       │   ├── tokens/                 ← Colors, spacing, typography
│       │   │   └── design-tokens.ts
│       │   ├── components/             ← Platform-agnostic logic components
│       │   │   ├── LoadCard/
│       │   │   ├── TruckerCard/
│       │   │   ├── PriceBreakdown/
│       │   │   ├── ETADisplay/
│       │   │   └── StatusBadge/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── mobile/                         ← React Native (iOS + Android + Tablet)
│   │   ├── ios/                        ← iOS-specific (auto-generated)
│   │   ├── android/                    ← Android-specific (auto-generated)
│   │   ├── src/
│   │   │   ├── navigation/             ← React Navigation setup
│   │   │   │   ├── MerchantNavigator.tsx
│   │   │   │   ├── TruckerNavigator.tsx
│   │   │   │   └── RootNavigator.tsx
│   │   │   ├── screens/
│   │   │   │   ├── Auth/               ← Login, Register, KYC
│   │   │   │   ├── Merchant/           ← Load posting, tracking, history
│   │   │   │   ├── Trucker/            ← Load discovery, GPS, earnings
│   │   │   │   ├── Chat/               ← Real-time messaging
│   │   │   │   └── Shared/             ← Profile, settings, notifications
│   │   │   ├── components/             ← Native UI components
│   │   │   ├── hooks/                  ← React Native specific hooks
│   │   │   └── App.tsx
│   │   ├── app.json                    ← Expo config
│   │   ├── eas.json                    ← EAS build config
│   │   └── package.json
│   │
│   ├── web/                            ← React + Vite (browser)
│   │   ├── src/
│   │   │   ├── pages/                  ← Route-based pages
│   │   │   ├── components/             ← Web-specific UI
│   │   │   ├── hooks/
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── admin/                          ← Next.js 14 App Router (admin panel)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── page.tsx            ← Main dashboard
│   │   │   │   ├── users/
│   │   │   │   ├── loads/
│   │   │   │   ├── disputes/
│   │   │   │   ├── fraud/
│   │   │   │   ├── ai-models/
│   │   │   │   ├── revenue/
│   │   │   │   ├── social/
│   │   │   │   └── settings/
│   │   │   ├── api/                    ← Next.js API routes (proxies)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── layouts/
│   │   │   ├── charts/
│   │   │   ├── tables/
│   │   │   └── forms/
│   │   └── package.json
│   │
│   └── tablet/                         ← React Native Web (tablet-optimized layouts)
│       └── (same structure as mobile, different layouts)
│
└── services/                           ← Backend microservices
    ├── api-gateway/
    ├── load-service/
    ├── trucker-service/
    ├── pricing-service/
    ├── admin-service/
    ├── social-publishing/
    ├── notification-service/
    └── ml-service/
```

---

## 2.2 TURBOREPO PIPELINE (turbo.json)

Claude Code: configure build pipeline so `turbo build` builds everything in correct order:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": { "dependsOn": ["^build"] },
    "lint": {},
    "dev": { "cache": false, "persistent": true }
  }
}
```

---

## 2.3 SHARED TYPESCRIPT TYPES (Critical — Do First)

Claude Code: implement ALL types in `packages/shared/src/types/` before writing any app code:

```typescript
// Key interfaces to implement:

interface User {
  userId: string;           // UUID
  userType: 'merchant' | 'trucker' | 'admin';
  fullName: string;
  email: string;
  phoneNumber: string;
  kycStatus: 'pending' | 'verified' | 'rejected';
  rating: number;           // 1.0 - 5.0
  createdAt: Date;
}

interface Load {
  loadId: string;
  merchantId: string;
  origin: GeoLocation;
  destination: GeoLocation;
  cargo: CargoDetails;
  timeWindow: TimeWindow;
  pricing: PricingDetails;
  status: LoadStatus;
  sla: SLADetails;
}

interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
}

interface PricingDetails {
  agreedPrice: number;
  fuelEstimate: number;
  tollEstimate: number;
  platformCommission: number;
  commissionPercent: number;
  waitingCharges: number;
  netTruckerEarning: number;
}

// + CargoDetails, TimeWindow, SLADetails, TrackingEvent,
//   ChatMessage, Dispute, FraudAlert, SocialPost ...
```

---

## 2.4 PHASE 2 ACCEPTANCE CRITERIA

```
✅ npm install at root installs all workspace packages
✅ turbo build completes without errors
✅ packages/shared compiles to TypeScript with 0 errors
✅ packages/api-client compiles with 0 errors
✅ All shared types exported from packages/shared/src/index.ts
✅ ESLint passes across all packages
✅ Prettier formatting consistent
✅ apps/mobile can import from @truck-platform/shared
✅ apps/web can import from @truck-platform/shared
✅ apps/admin can import from @truck-platform/shared
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 3: BACKEND API LAYER (MICROSERVICES)
# Timeline: Week 3–6 | Priority: CRITICAL
# Reference Docs: #1 (BASE_ARCHITECTURE Sections 4,7,8) + #2 (NEXT_LEVEL)
# ═══════════════════════════════════════════════════

## PHASE 3 OBJECTIVE
Build all backend microservices with full API coverage, authentication, real-time WebSocket, and business logic.

---

## 3.1 SERVICE BUILD ORDER

```
Build in this exact order (each depends on previous):

1. auth-middleware (shared library)     ← JWT validation, RBAC
2. api-gateway                          ← Routes all traffic, rate limiting
3. load-service                         ← Core business logic
4. trucker-service                      ← Driver operations
5. pricing-service                      ← Pricing engine (uses Ollama/Claude)
6. notification-service                 ← Push, SMS, Email
7. payment-service                      ← Stripe integration
8. social-publishing-service            ← AI social publishing
9. admin-service                        ← Admin operations
10. ml-service                          ← Route, ETA, Fraud models
```

---

## 3.2 EACH SERVICE MUST INCLUDE

Claude Code: every microservice MUST implement ALL of the following:

```
services/<service-name>/
├── src/
│   ├── index.ts                ← Express app entry point
│   ├── routes/                 ← Route definitions
│   ├── controllers/            ← Request handlers
│   ├── services/               ← Business logic
│   ├── models/                 ← DB queries (no ORM, use pg directly)
│   ├── middleware/
│   │   ├── auth.middleware.ts  ← JWT verify
│   │   ├── validate.middleware.ts  ← Zod schema validation
│   │   └── rateLimit.middleware.ts
│   ├── events/
│   │   ├── producers/          ← Kafka/RabbitMQ publishers
│   │   └── consumers/          ← Kafka/RabbitMQ subscribers
│   ├── websocket/              ← Socket.io handlers (where applicable)
│   └── utils/
│       ├── logger.ts           ← Winston structured logging
│       ├── cache.ts            ← Redis wrapper
│       └── errors.ts           ← Custom error classes
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile                  ← Multi-stage build
├── package.json
└── tsconfig.json
```

---

## 3.3 API GATEWAY SPECIFICATIONS

Claude Code: implement these exact routes in `services/api-gateway/src/routes/`:

```
Authentication Routes:
POST   /api/auth/register           ← New user (merchant/trucker)
POST   /api/auth/login              ← Returns JWT + refresh token
POST   /api/auth/refresh            ← Refresh JWT
POST   /api/auth/logout             ← Invalidate refresh token
POST   /api/auth/verify-phone       ← OTP via Twilio
POST   /api/auth/kyc/upload         ← KYC document upload
GET    /api/auth/me                 ← Current user profile

Load Routes (Merchants):
POST   /api/loads/create            ← Create new load (full spec from Doc #1 Section 4.1)
GET    /api/loads/active            ← Merchant's active loads
GET    /api/loads/:id               ← Load details
PUT    /api/loads/:id/cancel        ← Cancel with reason
GET    /api/loads/:id/pricing       ← AI pricing breakdown
GET    /api/loads/:id/tracking      ← Real-time location
GET    /api/loads/:id/truckers      ← Matched truckers
POST   /api/loads/:id/destination-confirm ← Confirm delivery ready
POST   /api/loads/block             ← Temporary capacity block
DELETE /api/loads/block/:id         ← Release block

Load Routes (Truckers):
GET    /api/loads/nearby            ← ?lat&lng&radius&capacity
GET    /api/loads/:id/trucker-view  ← Load details with match score
POST   /api/loads/:id/accept        ← Accept load
POST   /api/loads/:id/pickup-start  ← Arrived at pickup
POST   /api/loads/:id/loading-start ← Loading commenced
POST   /api/loads/:id/loading-end   ← Loading complete
POST   /api/loads/:id/transit-start ← Departed
POST   /api/loads/:id/delivery-start ← Arrived at destination
POST   /api/loads/:id/delivery-end  ← Delivered + POD photo

GPS / Tracking:
POST   /api/tracking/update         ← GPS position (every 5s from trucker app)
GET    /api/tracking/:loadId/history ← Full GPS replay
GET    /api/tracking/:loadId/live   ← Current position

Pricing:
GET    /api/pricing/estimate        ← Quick estimate (no auth)
GET    /api/pricing/:loadId/breakdown ← Detailed breakdown
GET    /api/routes/:routeId/tolls   ← Toll gate analysis
GET    /api/routes/:routeId/fuel    ← Fuel optimization

Payments:
POST   /api/payments/initiate       ← Start payment flow
POST   /api/payments/confirm        ← Confirm payment
GET    /api/payments/:loadId        ← Payment status
POST   /api/payments/payout         ← Trucker payout trigger

Chat:
GET    /api/chat/:loadId/messages   ← Message history
POST   /api/chat/:loadId/send       ← Send message (also via WebSocket)

Social Publishing:
POST   /api/social/publish          ← One-click publish to platforms
GET    /api/social/ai-generate      ← Get AI-generated captions/hashtags
GET    /api/social/posts            ← Post history

Admin Routes: (all require admin JWT)
GET    /api/admin/dashboard/metrics ← Real-time KPIs
GET    /api/admin/users             ← All users (paginated, filtered)
GET    /api/admin/users/:id         ← User detail with full history
PUT    /api/admin/users/:id/block   ← Block user
PUT    /api/admin/users/:id/kyc     ← Approve/reject KYC
GET    /api/admin/loads             ← All loads (admin view)
PUT    /api/admin/loads/:id/cancel  ← Force cancel
GET    /api/admin/disputes          ← Dispute queue
PUT    /api/admin/disputes/:id/resolve ← Resolve dispute
GET    /api/admin/fraud-alerts      ← Active fraud alerts
PUT    /api/admin/fraud-alerts/:id  ← Action on alert
GET    /api/admin/revenue           ← Revenue analytics
GET    /api/admin/ai-models         ← ML model status
POST   /api/admin/broadcast         ← Send notification to users
GET    /api/admin/audit-log         ← Admin action history
```

---

## 3.4 WEBSOCKET EVENTS

Claude Code: implement Socket.io server in `services/api-gateway/src/websocket/` with these namespaces:

```typescript
// Namespace: /load-updates
// Auth: JWT via handshake
// Events to emit TO client:
//   load:accepted         → { truckerId, truckerName, eta, location }
//   load:location_update  → { lat, lng, speed, etaMinutes, etaAccuracy }
//   load:status_change    → { status, timestamp, details }
//   load:sla_warning      → { minutesRemaining, chargeIfOverrun }
//   load:sla_overrun      → { minutesOver, chargeAccrued }
//   load:blockade_alert   → { severity, location, waitMins, alternateRoutes[] }
//   load:eta_update       → { newEta, confidence, reason }
//   chat:message          → { senderId, text, timestamp, msgId }
//   chat:typing           → { userId }
//   payment:confirmed     → { amount, timestamp }
//
// Events to RECEIVE from client:
//   join:load             → { loadId }  → join room
//   leave:load            → { loadId }  → leave room
//   trucker:gps           → { lat, lng, speed, heading, accuracy }
//   chat:send             → { loadId, text }
//   chat:typing           → { loadId }
```

---

## 3.5 LOAD SERVICE BUSINESS LOGIC

Claude Code: implement in `services/load-service/src/services/load.service.ts`:

```
createLoad(data):
  1. Validate input (Zod schema)
  2. Geocode origin + destination (Google Maps API)
  3. Call pricing-service for AI estimate
  4. Save to PostgreSQL loads table
  5. Publish 'load.created' event to Kafka
  6. Notify nearby truckers via push notification
  7. Return load with pricing breakdown

acceptLoad(loadId, truckerId):
  1. Verify load is in 'posted' status
  2. Verify trucker is available + verified KYC
  3. Lock load (optimistic locking with version column)
  4. Update status to 'accepted'
  5. Create SLA record (from load's agreed loading/unloading times)
  6. Publish 'load.accepted' to Kafka
  7. Notify merchant via WebSocket + push
  8. Return acceptance confirmation + SLA document

startLoading(loadId, truckerId):
  1. Verify trucker arrived at pickup (geofence check ≤500m)
  2. Record actual_arrival_time
  3. Start SLA timer
  4. Publish 'load.loading_started' to Kafka
  5. Alert merchant: "Loading started"

endLoading(loadId, truckerId, actualLoadingMinutes):
  1. Calculate SLA compliance
  2. If overrun: compute waiting charges (minutes × rate)
  3. Seek merchant approval if overrun > 0
  4. Record in sla_tracking table
  5. Update load status to 'in_transit'
  6. Publish 'load.in_transit' to Kafka
```

---

## 3.6 PRICING SERVICE

Claude Code: implement hybrid AI pricing in `services/pricing-service/src/`:

```typescript
// Dynamic pricing algorithm:
// 1. Calculate base price (distance × rate/km)
// 2. Add fuel surcharge (current fuel price × consumption estimate)
// 3. Add toll charges (from Google Toll API or local DB)
// 4. Apply surge multiplier (demand model: 1.0x – 2.0x)
// 5. Add special cargo premium (hazmat, fragile, temp-controlled)
// 6. Apply merchant loyalty discount (if applicable)
// 7. Add platform commission (5% flat)
// 8. Compute trucker net (gross - commission - estimated costs)

// Surge multiplier logic:
// - Check available trucks in pickup region (Redis cache, 60s TTL)
// - Check active loads in same region
// - Ratio = loads / trucks → multiplier
// - 0-0.5: 0.9x (slow market, discount to attract loads)
// - 0.5-1.0: 1.0x (balanced)
// - 1.0-1.5: 1.15x (busy)
// - 1.5-2.0: 1.35x (very busy)
// - 2.0+: 1.5x (capped at 1.5x, never go above)
```

---

## 3.7 CACHING STRATEGY

Claude Code: implement Redis caching wrapper in each service:

```typescript
// Cache keys and TTLs:
// user:{userId}            → 30 min (user profile)
// load:{loadId}            → 5 min  (load details)
// pricing:{routeHash}      → 1 min  (AI pricing is dynamic)
// route:{originDest}       → 1 hr   (route data rarely changes)
// tolls:{routeId}          → 1 hr   (toll data stable)
// nearby_trucks:{geoHash}  → 30 sec (fast changing for matching)
// demand:{region}          → 60 sec (surge calculation)
// user_session:{token}     → match JWT expiry

// Cache-aside pattern:
// 1. Check Redis first
// 2. If miss → query DB → write to Redis → return
// 3. On update → invalidate Redis key → write to DB
```

---

## 3.8 PHASE 3 ACCEPTANCE CRITERIA

```
✅ All 30+ API endpoints returning correct responses
✅ POST /api/auth/login returns valid JWT
✅ POST /api/loads/create saves to DB and emits Kafka event
✅ GET /api/loads/nearby returns loads within radius
✅ WebSocket /load-updates connects with JWT auth
✅ WebSocket emits location_update when trucker posts GPS
✅ Redis caching working (cache hit rate > 60% in tests)
✅ All routes return proper HTTP status codes
✅ Zod validation rejects malformed input with 400
✅ Rate limiting blocks > 100 req/min with 429
✅ Unit test coverage > 70% on service layer
✅ Integration tests pass for load lifecycle end-to-end
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 4: FRONTEND APPLICATIONS
# Timeline: Week 6–10 | Priority: HIGH
# Reference Docs: #2 (NEXT_LEVEL Section "CROSS-PLATFORM")
# ═══════════════════════════════════════════════════

## PHASE 4 OBJECTIVE
Build the mobile app (iOS/Android/Tablet), web app, and admin dashboard — all using shared business logic from Phase 2 packages.

---

## 4.1 BUILD ORDER WITHIN PHASE 4

```
4A → Auth Screens (shared across mobile + web)
4B → Merchant Flow (mobile-first, then web)
4C → Trucker Flow (mobile-first, then web)
4D → Real-time Tracking Screens
4E → Chat UI
4F → Web App (browser-optimized versions)
4G → Admin Dashboard (see Phase 6 for full admin)
```

---

## 4.2 MOBILE APP — SCREEN LIST

Claude Code: build all screens in `apps/mobile/src/screens/`:

```
Auth Screens:
  SplashScreen              ← App logo, check token → route
  OnboardingScreen          ← First-time user introduction
  UserTypeScreen            ← "I'm a Merchant" / "I'm a Trucker"
  LoginScreen               ← Phone OTP or Email/Password
  OTPVerifyScreen           ← 6-digit OTP input
  RegisterScreen            ← Name, email, password
  KYCUploadScreen           ← Document photo upload (front/back)
  KYCPendingScreen          ← "Under review" waiting state

Merchant Screens:
  MerchantDashboard         ← Active loads, quick stats, quick post
  CreateLoadScreen          ← Multi-step form (origin → dest → cargo → time → review)
  LoadDetailScreen          ← Full load info, tracking map, chat button
  LoadTrackingScreen        ← Real-time map with trucker dot
  LoadHistoryScreen         ← Past loads, searchable, filterable
  PricingBreakdownScreen    ← Detailed cost explanation
  RateLoadScreen            ← 5-star rating + comment after delivery
  MerchantProfileScreen     ← Business details, bank account
  NotificationsScreen

Trucker Screens:
  TruckerDashboard          ← Nearby loads feed, earnings today, active load
  LoadDiscoveryScreen       ← Map view + list view of nearby loads, filters
  LoadDetailTruckerScreen   ← Load info + AI score + toll/fuel breakdown
  ActiveLoadScreen          ← Current job: map, SLA timer, chat, status buttons
  NavigationScreen          ← Turn-by-turn map (Google Maps)
  EarningsScreen            ← Daily/weekly/monthly earnings, payouts
  TruckProfileScreen        ← Vehicle details, insurance, documents
  BlockadeReportScreen      ← Report road issue to platform

Shared Screens:
  ChatScreen                ← Load-specific merchant ↔ trucker chat
  ProfileScreen
  SettingsScreen
  SupportScreen
  NotificationsScreen
```

---

## 4.3 MOBILE NAVIGATION STRUCTURE

```typescript
// apps/mobile/src/navigation/RootNavigator.tsx
// Logic:
// → No token: AuthStack (Login → Register → KYC)
// → Token + userType='merchant': MerchantStack
// → Token + userType='trucker': TruckerStack
// → Token + userType='admin': redirect to admin web

// Tab bars:
// Merchant tabs: Home | My Loads | Track | Chat | Profile
// Trucker tabs:  Find Loads | Active Load | Earnings | Chat | Profile
```

---

## 4.4 REAL-TIME GPS TRACKING SCREEN (Critical)

Claude Code: implement in `apps/mobile/src/screens/Trucker/ActiveLoadScreen.tsx`:

```typescript
// This screen must:
// 1. Start GPS at 5-second intervals when load is 'in_transit'
// 2. Send location to WebSocket (trucker:gps event)
// 3. Show live map with:
//    - Trucker's current position (moving dot)
//    - Route line (Google Maps Directions API)
//    - Destination marker
//    - Next toll gate (upcoming toll info card)
//    - Blockade alert overlay (if active)
// 4. Show SLA timer (countdown to loading/unloading deadline)
// 5. Show estimated fuel remaining + next fuel stop suggestion
// 6. Action buttons: Loading Start | Loading End | In Transit | Delivered
// 7. Emergency button: Report Blockade / Breakdown
// IMPORTANT: Stop GPS and close WebSocket when load is 'delivered' or 'cancelled'
```

---

## 4.5 MERCHANT TRACKING SCREEN (Critical)

Claude Code: implement in `apps/mobile/src/screens/Merchant/LoadTrackingScreen.tsx`:

```typescript
// This screen must:
// 1. Subscribe to WebSocket /load-updates room for loadId
// 2. Show live map with trucker's real-time position
// 3. Show ETA with confidence percentage
// 4. Show load status timeline (Posted → Accepted → Loading → Transit → Delivered)
// 5. Show toll gates passed vs remaining
// 6. Show SLA compliance indicator
// 7. If blockade detected: show alert with alternate route suggestion
// 8. Chat button → navigate to ChatScreen for this load
// 9. Handle offline gracefully: show last known position
```

---

## 4.6 CREATE LOAD SCREEN (Multi-Step Form)

Claude Code: implement as a stepper form — critical for merchant experience:

```
Step 1: Pickup Location
  - Address autocomplete (Google Places)
  - Map pin confirmation
  - Contact person + phone at pickup

Step 2: Delivery Location
  - Same as above
  - Expected destination availability check (call API)

Step 3: Cargo Details
  - Weight (kg), Volume (CBM)
  - Type: General / Fragile / Hazmat / Temperature-Controlled
  - Special requirements text field
  - Photos (optional, max 5)

Step 4: Time Window
  - Pickup date + time range (start - end)
  - Expected delivery date
  - Loading time allowed (minutes)
  - Unloading time allowed (minutes)
  - Waiting charge per minute (default from platform)

Step 5: Pricing Review
  - AI-generated price breakdown
  - Show: fuel, tolls, platform fee, trucker net
  - Show 3 route alternatives with cost comparison
  - Price lock button (locks for 2 hours)
  - Accept & Post button
```

---

## 4.7 WEB APP (apps/web/)

Claude Code: web app is a responsive version of mobile with these additions:

```
Additional web features (not on mobile):
- Side-by-side load list + map view
- Multi-load dashboard (merchants with multiple active loads)
- Advanced filtering + sorting (DataGrid)
- Bulk load operations (post multiple loads)
- CSV export of load history
- Invoice download (PDF)
- Route comparison table view
```

---

## 4.8 TABLET LAYOUT

```typescript
// apps/tablet/ (React Native Web with breakpoint adaptation)
// At width > 768px:
// - Show 2-column layouts (form + map)
// - Expanded dashboard cards
// - Side panel for chat (not full-screen modal)
// - Map takes 60% of screen on tracking view
```

---

## 4.9 PHASE 4 ACCEPTANCE CRITERIA

```
✅ Login → OTP → Register → KYC flow works end-to-end
✅ Merchant can post a load in < 5 minutes via app
✅ Trucker can discover and accept nearby load
✅ Real-time tracking updates every 5 seconds on map
✅ Chat messages deliver in < 500ms
✅ SLA timer counts down correctly
✅ Waiting charge accrues on overrun
✅ Blockade alert appears on trucker AND merchant screen
✅ App works on iPhone 12+ and Android 10+
✅ App works on iPad and Android tablets
✅ Web app fully responsive from 375px to 1920px
✅ All screens handle loading, error, and empty states
✅ Offline mode shows graceful error (not crash)
✅ Push notifications received in foreground + background
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 5: AI & ML FEATURES
# Timeline: Week 8–12 | Priority: HIGH
# Reference Docs: #1 (BASE_ARCHITECTURE Section 5) + #3 (IMPLEMENTATION_GUIDE Q5)
# ═══════════════════════════════════════════════════

## PHASE 5 OBJECTIVE
Implement all AI intelligence: route optimization, ETA prediction, dynamic pricing, real-time blockade detection, fraud detection, and social media content generation.

---

## 5.1 AI SERVICES TO BUILD

```
services/ml-service/
├── src/
│   ├── models/
│   │   ├── eta_predictor.py        ← TensorFlow LSTM + XGBoost ensemble
│   │   ├── route_optimizer.py      ← TravelTime API + custom scoring
│   │   ├── demand_forecaster.py    ← Facebook Prophet
│   │   ├── fraud_detector.py       ← Isolation Forest
│   │   └── price_optimizer.py      ← XGBoost gradient boosting
│   ├── api/
│   │   └── ml_api.py               ← FastAPI endpoints for Node.js to call
│   ├── data/
│   │   └── feature_engineering.py  ← Feature extraction pipeline
│   └── training/
│       ├── train_eta.py
│       ├── train_fraud.py
│       └── evaluate_models.py
├── requirements.txt
└── Dockerfile
```

---

## 5.2 ROUTE OPTIMIZATION MODULE

Claude Code: implement in `services/pricing-service/src/services/route-optimizer.ts`:

```typescript
// Input: { origin: GeoLocation, destination: GeoLocation, truckCapacity: number }
// Output: { routes: Route[], recommended: Route }

// Route scoring algorithm (each alternative route gets a score):
// score = (1/time_factor * 0.35) +
//         (1/fuel_factor * 0.30) +
//         (1/toll_factor * 0.20) +
//         (1/risk_factor * 0.15)
// where each factor is normalized 0-1

// For each route candidate:
// 1. Call TravelTime API for accurate travel time
// 2. Estimate fuel: (distance / truck_mileage) × fuel_price_per_liter
// 3. Enumerate toll gates using toll gate database (seed in DB)
// 4. Score risk: check historical blockade frequency on route
// 5. Rank and return top 3

// Fallback: if TravelTime API fails → Google Directions API
// Fallback: if Google API fails → straight-line distance × 1.3 factor
```

---

## 5.3 ETA PREDICTION MODEL

Claude Code: implement in `services/ml-service/src/models/eta_predictor.py`:

```python
# Feature engineering for ETA:
features = [
  # Static
  'distance_km',
  'route_complexity_score',    # turns, junctions count
  'truck_category',            # 0=light, 1=medium, 2=heavy
  
  # Time-based
  'hour_of_day',
  'day_of_week',
  'is_weekend',
  'is_holiday',
  'month',
  
  # Real-time (fetched at prediction time)
  'current_traffic_index',     # 0-1, from Google Traffic API
  'weather_severity',          # 0-1, from weather API
  'known_blockades_on_route',  # count
  
  # Historical
  'avg_speed_this_route_this_hour',   # from past loads
  'std_speed_this_route',
  'p95_delivery_time_this_route',
]

# Model: XGBoost for point estimate + LSTM for sequence-aware (traffic flow)
# Ensemble: 0.6 * xgboost_prediction + 0.4 * lstm_prediction
# Output: { eta_minutes: int, confidence: float, p95_eta_minutes: int }

# Retrain trigger: daily via cron, using past 30 days of actual delivery data
# Accuracy target: p95 within 15 minutes of actual
```

---

## 5.4 REAL-TIME BLOCKADE DETECTION

Claude Code: implement in `services/load-service/src/services/blockade.service.ts`:

```typescript
// Data sources to monitor (poll every 60s per active route):
// 1. Google Maps Real-time Traffic API (traffic incidents layer)
// 2. User-reported blockades (truckers submit via app)
// 3. OpenStreetMap incidents feed
// 4. Government traffic portal RSS feeds (if available in region)

// Detection pipeline:
// 1. Scan all routes with active loads
// 2. For each blockade detected: compute impact (delay_minutes)
// 3. If delay_minutes > 20: generate alternate route
// 4. Score alternate: saves_time? saves_toll? adds_fuel?
// 5. If alternate is better: emit WebSocket blockade_alert with recommendation
// 6. Update load's ETA
// 7. If delay makes SLA breach certain: notify admin for manual review

// Alert severity:
// LOW   (< 15 min delay): show info, no action required
// MEDIUM (15-45 min):     suggest alternate, trucker decides
// HIGH  (> 45 min):       strongly recommend alternate, notify merchant
// CRITICAL (> 2 hours):   auto-reroute + notify all parties + admin
```

---

## 5.5 FRAUD DETECTION

Claude Code: implement in `services/ml-service/src/models/fraud_detector.py`:

```python
# Real-time fraud scoring on every transaction:
features = [
  'is_new_account',           # < 7 days old
  'unusual_load_price',       # > 3σ from route average
  'multiple_cancellations',   # > 2 in last 7 days
  'ip_country_mismatch',      # IP ≠ registered country
  'device_fingerprint_new',   # never seen this device
  'pickup_location_anomaly',  # far from user's usual locations
  'rapid_accept_cancel',      # accepted and cancelled in < 5 min
  'payment_method_changed',   # changed card within 24h of booking
  'identical_load_copies',    # same load posted 3+ times
  'unusual_hour',             # transactions between 2-5 AM
]

# Model: Isolation Forest (unsupervised, catches new fraud patterns)
# Threshold: score < -0.1 → suspicious (flag for review)
# Threshold: score < -0.3 → block automatically + alert admin

# Actions by risk level:
# score -0.1 to -0.2: FLAG → add to review queue
# score -0.2 to -0.3: HOLD → pause transaction, request verification
# score < -0.3:        BLOCK → deny transaction, alert admin immediately
```

---

## 5.6 SOCIAL MEDIA AI PUBLISHING

Claude Code: implement the hybrid LLM system in `services/social-publishing/src/`:

```typescript
// Content generation hierarchy:
// Hashtags → Ollama (mistral:7b, fast, free, good enough)
// Short captions (< 150 chars) → Ollama with Claude fallback
// Long descriptions (300-500 chars) → Claude API (quality matters)
// Platform adaptation → Claude API (nuance for LinkedIn vs Instagram)

// One-click publish flow:
// 1. Admin/merchant selects load to promote
// 2. System auto-fetches load details
// 3. Generate captions for each selected platform
// 4. Show preview with ability to edit before posting
// 5. Post to all platforms simultaneously
// 6. Record post IDs, URLs, timestamps in social_posts DB table
// 7. Poll analytics after 24h (likes, shares, reach)

// Platform API integrations to implement:
// Facebook  → Graph API v19.0  (posts, pages, reels)
// Instagram → Graph API v19.0  (feed posts, stories)
// Twitter/X → API v2           (tweets)
// LinkedIn  → REST API v2      (company posts, shares)
// WhatsApp  → Business API     (broadcast lists)
```

---

## 5.7 PHASE 5 ACCEPTANCE CRITERIA

```
✅ Route optimizer returns 3 alternatives with scores in < 2s
✅ ETA prediction returns estimate + confidence in < 200ms
✅ ETA accuracy: 85% within 15 minutes on test dataset
✅ Blockade alert fires within 60s of incident creation
✅ Alternate route computed in < 3s after blockade detected
✅ Fraud detector scores each transaction in < 50ms
✅ Fraud model correctly flags 90% of seeded test fraud cases
✅ Social post generation in < 3s (Ollama) or < 8s (Claude)
✅ One-click publish succeeds to at least 3 platforms simultaneously
✅ Ollama fallback to Claude works if Ollama service is down
✅ All ML models retrain automatically via nightly cron job
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 6: ADVANCED ADMIN PANEL
# Timeline: Week 10–14 | Priority: HIGH
# Reference Docs: #2 (NEXT_LEVEL Section "ADVANCED ADMIN") + #3 (Q4)
# ═══════════════════════════════════════════════════

## PHASE 6 OBJECTIVE
Build the enterprise-grade admin dashboard with all 12 feature categories, real-time monitoring, and "beyond imagination" control over every aspect of the platform.

---

## 6.1 ADMIN PANEL PAGES TO BUILD

Claude Code: implement all pages in `apps/admin/app/(dashboard)/`:

```
Dashboard (/)
  - Real-time KPI cards (active loads, GMV, success rate, users)
  - Revenue chart (hourly, last 24h)
  - Delivery success gauge
  - Pending disputes card
  - Active fraud alerts card
  - System status indicators

Users (/users)
  - Filterable, sortable DataGrid (TanStack Table)
  - Columns: ID, Name, Type, KYC, Rating, Loads, Revenue, Status, Violations
  - Row actions: View | Edit | Block | Suspend | Verify KYC | Message | Export
  - Bulk actions: Block selected | Send notification | Export CSV
  - User detail page: full history, GPS heatmap, transaction log, chat snippets

Loads (/loads)
  - All loads with filters (status, date, route, merchant, trucker)
  - Map view showing all active loads simultaneously
  - Load detail: full timeline, GPS replay, chat log, SLA report
  - Actions: Force cancel | Reassign trucker | Override price | Dispute resolution

Disputes (/disputes)
  - Queue sorted by priority (high/medium/low)
  - Dispute detail: load timeline, chat transcript, media evidence
  - Resolution panel: approve/deny refund, adjust charges, message parties
  - AI-suggested resolution with explanation (from Claude API)
  - Escalation to legal team

Fraud Detection (/fraud)
  - Real-time alert stream (WebSocket updates)
  - Risk score visualization
  - Alert detail: flagged transaction, user history, risk factors breakdown
  - Actions: Block user | Hold transaction | Dismiss | Escalate
  - Fraud statistics: alerts/day, false positive rate, blocked amount

AI Models (/ai-models)
  - Deployed models: name, version, accuracy, latency, last retrained
  - Performance charts (accuracy over time, prediction vs actual)
  - A/B test control (split traffic between two model versions)
  - One-click retrain trigger
  - Model decision explainer (why did pricing model suggest X for load Y?)

Revenue (/revenue)
  - GMV by day/week/month
  - Commission earned breakdown
  - Revenue by route, region, cargo type
  - Trucker earnings distribution
  - Merchant spend analysis
  - Surge pricing impact report
  - Export: CSV, PDF, Excel

Notifications (/notifications)
  - Compose broadcast notification (title, body, deep link)
  - Target: All | Merchants | Truckers | Region | Custom segment
  - Schedule: Send now | Pick date/time | Recurring
  - History: sent notifications with open rates
  - Emergency alert mode (bypasses do-not-disturb)

Social Publishing (/social)
  - One-click publish panel (mirrors merchant panel but for all loads)
  - Platform connection status (Facebook, Instagram, Twitter, LinkedIn, WhatsApp)
  - Post history with analytics (reach, engagement, clicks)
  - Scheduled posts queue
  - AI caption generator with edit-before-post

System (/system)
  - Kubernetes pod status (list, restart, scale)
  - Service health (response times, error rates per service)
  - Database: connection pool usage, slow query log
  - Cache: Redis hit rate, eviction rate, memory usage
  - Message queues: Kafka lag, RabbitMQ queue depths
  - Feature flags: toggle features on/off without redeploy
  - Maintenance mode toggle

Audit Log (/audit)
  - Every admin action logged (who, what, when, before/after)
  - Filterable by admin user, action type, date range
  - Export for compliance reporting
  - GDPR: data export request queue, deletion request processing

Settings (/settings)
  - Platform commission rate (currently 5%)
  - Waiting charge rates
  - Surge pricing cap (currently 1.5x)
  - Fraud alert thresholds
  - Social API credentials management
  - Email/SMS templates
  - KYC document requirements
```

---

## 6.2 REAL-TIME ADMIN DASHBOARD (Priority Build)

Claude Code: this is the most visible admin screen — build it first:

```typescript
// apps/admin/app/(dashboard)/page.tsx

// Metrics that update in real-time (WebSocket, 1s interval):
const REALTIME_METRICS = {
  activeLoads: number,
  activeTruckers: number,
  activeMerchants: number,
  gmv24h: number,
  commission24h: number,
  successRate: number,        // % of loads delivered on time
  avgEtaAccuracy: number,     // % within 15 min
  pendingDisputeCount: number,
  highRiskFraudAlerts: number,
  apiResponseTimeP95: number, // ms
  wsConnectionCount: number,
};

// Charts:
// 1. GMV line chart (last 60 data points, 1/minute cadence)
// 2. Active loads bar chart (by route, top 10)
// 3. Success rate gauge (target: > 97%)
// 4. System health grid (green/red per service)

// Action panels:
// - Disputes requiring review (click → go to dispute detail)
// - Fraud alerts requiring action (click → go to alert detail)
// - KYC documents awaiting review
```

---

## 6.3 USER MANAGEMENT — GOD MODE FEATURES

Claude Code: implement these special capabilities:

```typescript
// Power actions in admin user management:

// 1. KYC Verification Override
//    - View uploaded documents (both sides)
//    - Approve / Reject with reason (stored in audit log)
//    - Request re-upload (triggers push notification)

// 2. Rating Adjustment
//    - Admin can adjust merchant or trucker rating
//    - Requires reason (logged in audit)
//    - Triggers notification to user

// 3. Custom Commission Rate
//    - Set per-user commission rate (overrides 5% default)
//    - Useful for enterprise clients (e.g., 3% for high-volume merchants)
//    - Expiry date optional

// 4. Suspension System
//    - Durations: 24h | 72h | 7d | 30d | Permanent
//    - Reason required
//    - User notified with reason and appeal link
//    - Auto-unsuspend when duration expires (cron job)

// 5. Manual Payout Trigger
//    - Admin can trigger immediate payout for a trucker
//    - Useful for dispute resolutions
//    - Logged and requires second admin approval if > ₹50,000

// 6. Data Export (GDPR)
//    - One-click export of all user data as JSON
//    - Automatic email to user when requested
//    - Deletion: hard-delete after 30-day cooling period
```

---

## 6.4 DISPUTE RESOLUTION SYSTEM

Claude Code: implement AI-assisted dispute resolution:

```typescript
// When admin opens a dispute:
// 1. System auto-fetches: load timeline, GPS replay, chat log, photos, SLA report
// 2. AI analyzes (Claude API) and suggests:
//    - Who is likely at fault (merchant / trucker / platform / external)
//    - Suggested resolution amount
//    - Precedent from similar past disputes
//    - Confidence level
// 3. Admin sees AI suggestion + all evidence
// 4. Admin can: accept AI suggestion | modify | create custom resolution
// 5. Resolution actions:
//    - Full refund to merchant
//    - Partial refund to merchant (% configurable)
//    - Additional payment to trucker (waiting charges)
//    - No action (dispute rejected)
//    - Escalate to legal
// 6. All parties notified via push + email
// 7. Resolution stored in disputes table with full audit trail
```

---

## 6.5 PHASE 6 ACCEPTANCE CRITERIA

```
✅ Admin dashboard loads and updates in real-time
✅ User list shows 100+ users without performance issues
✅ Block/unblock user works and reflects immediately in app
✅ KYC approve/reject triggers correct push notification
✅ Dispute list shows with priority ordering
✅ AI dispute suggestion generated in < 5s
✅ Fraud alert appears within 5s of fraud detection
✅ Revenue report loads for any date range in < 3s
✅ Broadcast notification reaches > 95% of target users
✅ Social publish from admin panel posts to all 5 platforms
✅ System page shows real Kubernetes pod status
✅ Feature flag toggle works without redeploy
✅ Audit log records every admin action
✅ All admin routes protected by admin-role JWT check
```

---

---

# ═══════════════════════════════════════════════════
# PHASE 7: DEPLOYMENT, CI/CD & APP STORE
# Timeline: Week 12–16 | Priority: HIGH
# Reference Docs: #2 (NEXT_LEVEL Section "DEPLOYMENT PIPELINE" + "APP STORE")
# ═══════════════════════════════════════════════════

## PHASE 7 OBJECTIVE
Deploy the entire platform to production cloud infrastructure, automate app store publishing, and set up Kubernetes with auto-scaling for 10K+ users.

---

## 7.1 CI/CD PIPELINE (GitHub Actions)

Claude Code: create these workflow files in `.github/workflows/`:

```yaml
# File 1: ci.yml (runs on EVERY push to ANY branch)
# Steps:
#   1. Install dependencies (cached)
#   2. TypeScript compilation check
#   3. ESLint
#   4. Unit tests (Jest)
#   5. Integration tests (against local Docker)
#   6. Build check (turbo build)
# Requirement: Must pass in < 5 minutes

# File 2: deploy-staging.yml (runs on push to 'develop' branch)
# Steps:
#   1. ci.yml steps
#   2. Build Docker images (multi-stage)
#   3. Push to container registry (ECR/GCR)
#   4. Deploy to staging Kubernetes namespace
#   5. Run smoke tests against staging
#   6. Notify Slack: "Staging deployed ✅"

# File 3: deploy-production.yml (runs on push to 'main' branch)
# Steps:
#   1. ci.yml steps
#   2. Build production Docker images
#   3. Push to container registry with semantic version tag
#   4. Apply Kubernetes rolling update (zero-downtime)
#   5. Monitor rollout for 5 minutes (watch error rate)
#   6. Auto-rollback if error rate > 1%
#   7. Run post-deploy smoke tests
#   8. Notify Slack + team email: "Production deployed v2.x.x ✅"

# File 4: mobile-build.yml (runs on tag v*.*.* OR manual trigger)
# Steps:
#   1. Setup Expo + EAS
#   2. Build iOS (EAS build --platform ios)
#   3. Build Android (EAS build --platform android)
#   4. Submit to TestFlight (iOS)
#   5. Submit to Google Play Internal Testing (Android)
#   6. Notify team: "Mobile builds submitted 📱"
```

---

## 7.2 KUBERNETES CONFIGURATION

Claude Code: create all files in `k8s/` folder:

```yaml
# k8s/
# ├── namespaces.yml          ← staging + production namespaces
# ├── configmaps.yml          ← Non-secret config (feature flags, etc.)
# ├── secrets.yml             ← Template only (actual secrets in Vault/AWS Secrets)
# ├── deployments/
# │   ├── api-gateway.yml
# │   ├── load-service.yml
# │   ├── trucker-service.yml
# │   ├── pricing-service.yml
# │   ├── admin-service.yml
# │   ├── social-service.yml
# │   ├── ml-service.yml
# │   └── web.yml
# ├── services/               ← ClusterIP + LoadBalancer definitions
# ├── hpa/                    ← Horizontal Pod Autoscalers (per service)
# └── ingress.yml             ← NGINX ingress with SSL termination

# HPA targets (from IMPLEMENTATION_GUIDE Q6):
# api-gateway:  CPU > 70% → scale, min=3, max=20
# load-service: CPU > 70% → scale, min=2, max=10
# websocket:    connections > 1500 → scale, min=2, max=8
# ml-service:   CPU > 80% → scale, min=2, max=6
```

---

## 7.3 MOBILE APP STORE SETUP

Claude Code: create all config files for Fastlane:

```
apps/mobile/
├── eas.json                    ← EAS build profiles
│                                 (development, preview, production)
├── ios/
│   └── fastlane/
│       ├── Fastfile            ← iOS lanes: beta, production
│       ├── Appfile             ← App identifier, team ID
│       └── api_key.json        ← App Store Connect API key
└── android/
    └── fastlane/
        ├── Fastfile            ← Android lanes: beta, production
        ├── Appfile             ← Package name
        └── api_key.json        ← Google Play service account key

# iOS eas.json profiles:
# development: simulator + physical device, no signing
# preview:     internal distribution, ad-hoc signing
# production:  App Store, distribution certificate

# Required before submission:
# ✅ Privacy Policy URL (required by both stores)
# ✅ Terms of Service URL
# ✅ App screenshots (all required sizes for iOS: 6.5", 5.5", iPad)
# ✅ App preview video (30s, optional but recommended)
# ✅ All permission strings in Info.plist (location, camera, notifications)
# ✅ Android: permission declarations in AndroidManifest.xml
# ✅ Data safety form completed (Google Play)
# ✅ Export compliance (no encryption → select NO)
```

---

## 7.4 PRODUCTION INFRASTRUCTURE

Claude Code: create Terraform configs in `infrastructure/terraform/`:

```hcl
# Minimum production setup (AWS):
# - EKS cluster (3 nodes, t3.medium, auto-scaling to 10)
# - RDS Aurora PostgreSQL (db.r5.large, multi-AZ)
# - ElastiCache Redis (cache.r5.large, cluster mode)
# - MSK Kafka (kafka.m5.large, 3 brokers)
# - S3 buckets (load photos, KYC docs, invoices)
# - CloudFront distribution (web app + static assets)
# - Route 53 (DNS management)
# - ACM (SSL certificates)
# - VPC (private subnets for databases, public for ALB)
# - WAF (basic rules: rate limit, SQL injection, XSS)

# Cost estimate for 10K users:
# EKS: ~$600/month
# RDS: ~$300/month
# ElastiCache: ~$200/month
# MSK: ~$300/month
# S3+CDN: ~$100/month
# Total: ~$1,500/month + data transfer
```

---

## 7.5 MONITORING & ALERTING

Claude Code: configure in `monitoring/`:

```yaml
# Prometheus scrape targets:
# - All microservices (expose /metrics via prom-client)
# - PostgreSQL (postgres_exporter)
# - Redis (redis_exporter)
# - Kubernetes nodes (node_exporter)

# Grafana dashboards to create:
# 1. Platform Overview (KPIs, throughput, error rate)
# 2. Service Performance (per-service latency, RPS, errors)
# 3. Database Health (connections, query times, cache hit rate)
# 4. WebSocket Connections (connections/pod, message rate)
# 5. Business Metrics (loads created, accepted, delivered/hour)
# 6. AI/ML Performance (model predictions, accuracy drift)

# PagerDuty / Slack alerts:
# CRITICAL: Error rate > 1% for 2 min → wake someone up
# CRITICAL: p99 latency > 2s for 5 min → wake someone up
# WARNING:  Error rate > 0.5% for 5 min → Slack alert
# WARNING:  Database connections > 80% → Slack alert
# INFO:     Pod scaled up/down → Slack info
# INFO:     New mobile app version submitted → Slack info
```

---

## 7.6 PHASE 7 ACCEPTANCE CRITERIA

```
✅ GitHub Actions CI passes in < 5 minutes
✅ Push to 'develop' auto-deploys to staging in < 10 minutes
✅ Push to 'main' auto-deploys to production (zero downtime)
✅ Kubernetes rolling update: 0 dropped requests during deploy
✅ HPA scales up within 60s when CPU > 70%
✅ iOS app submitted to TestFlight successfully
✅ Android app submitted to Google Play Internal Testing
✅ Production domain (https://app.truckplatform.com) live with SSL
✅ Grafana dashboard shows all services green
✅ Load test: 1,000 concurrent users, p95 < 100ms, error rate < 0.1%
✅ Load test: 5,000 concurrent users, p95 < 200ms, error rate < 0.5%
✅ Rollback completes in < 60s if triggered
✅ Alerts firing correctly in Slack for simulated errors
✅ All secrets stored in AWS Secrets Manager (not in code or env files)
```

---

---

# ═══════════════════════════════════════════════════
# CROSS-CUTTING CONCERNS
# (Apply throughout ALL phases)
# ═══════════════════════════════════════════════════

## ERROR HANDLING STANDARD

Claude Code: use this error format consistently across ALL services:

```typescript
// Standard error response format:
interface APIError {
  success: false;
  error: {
    code: string;         // e.g., 'LOAD_NOT_FOUND', 'INSUFFICIENT_CAPACITY'
    message: string;      // Human-readable message
    details?: any;        // Additional context (validation errors, etc.)
    requestId: string;    // Trace ID for debugging
    timestamp: string;    // ISO 8601
  }
}

// Error codes to define:
// AUTH_INVALID_TOKEN, AUTH_EXPIRED, AUTH_FORBIDDEN
// USER_NOT_FOUND, USER_SUSPENDED, USER_KYC_PENDING
// LOAD_NOT_FOUND, LOAD_ALREADY_ACCEPTED, LOAD_CANCELLED
// TRUCK_UNAVAILABLE, TRUCK_CAPACITY_EXCEEDED
// PAYMENT_FAILED, PAYMENT_INSUFFICIENT_BALANCE
// VALIDATION_ERROR, RATE_LIMIT_EXCEEDED, SERVER_ERROR
```

---

## LOGGING STANDARD

```typescript
// All services use Winston with this format:
{
  timestamp: "2026-06-12T10:15:32.456Z",
  level: "info|warn|error",
  service: "load-service",
  requestId: "req_abc123",   // Trace ID propagated via headers
  userId: "usr_xyz",          // If authenticated
  message: "Load accepted",
  data: {                     // Context-specific data
    loadId: "LD_001234",
    truckerId: "TR_89456"
  }
}

// Log levels:
// ERROR: Something broke, needs immediate attention
// WARN: Something unexpected but handled
// INFO: Normal business events (load created, accepted, delivered)
// DEBUG: Detailed debugging (only in development)
```

---

## SECURITY REQUIREMENTS

Apply to every API endpoint in every service:

```
Authentication:
✅ JWT validation on every protected route
✅ Refresh token rotation (new refresh token on each use)
✅ Token blacklist in Redis (for logout)
✅ RBAC: merchant/trucker/admin roles strictly enforced

Input Validation:
✅ Zod schema on every POST/PUT body
✅ SQL injection prevention (parameterized queries only, no string concat)
✅ XSS prevention (sanitize all HTML output)
✅ File upload validation (type + size limits for KYC/photos)

Rate Limiting:
✅ Anonymous: 10 req/min
✅ Authenticated user: 100 req/min
✅ Admin: 500 req/min
✅ GPS updates (trucker): 60 req/min (every 5s)

Data Encryption:
✅ All DB passwords, API keys in environment variables (never hardcoded)
✅ Sensitive fields encrypted at rest (AES-256: bank account, PAN, GST)
✅ HTTPS everywhere (TLS 1.3 minimum)
✅ KYC document URLs are signed S3 URLs (expire in 1 hour)
```

---

## PERFORMANCE TARGETS

```
API Response Times:
✅ P50 < 50ms
✅ P95 < 200ms
✅ P99 < 500ms
✅ No endpoint > 2s under normal load

Database Query Times:
✅ All queries < 100ms
✅ No query > 500ms (add index or optimize if exceeded)
✅ Connection pool: never > 80% utilized

WebSocket:
✅ Message delivery < 200ms
✅ 2,000 concurrent connections per pod
✅ Auto-scale when > 1,500 connections

Mobile App:
✅ App launch (cold start) < 3s
✅ Screen transition < 300ms
✅ GPS update sent < 1s after location change
✅ Map re-center < 500ms after location update
```

---

## TESTING STRATEGY

```
Unit Tests (Jest):
- Every service function: happy path + edge cases
- Target: 70% line coverage minimum
- Run in: < 2 minutes

Integration Tests:
- API endpoints: full request/response including DB
- WebSocket: connect → subscribe → receive events
- Run in: < 10 minutes

E2E Tests (Detox for mobile, Playwright for web):
- Full user journey: register → post load → accept → deliver → rate
- Run against staging environment
- Run on: every PR to main

Load Tests (k6):
- 100 concurrent users: baseline
- 1,000 concurrent users: performance gate
- 5,000 concurrent users: scale test (must pass before app store launch)
```

---

---

# ═══════════════════════════════════════════════════
# HOW TO PROMPT CLAUDE CODE FOR EACH PHASE
# ═══════════════════════════════════════════════════

## PHASE 1 STARTER PROMPT

```
I'm starting Phase 1 of the AI Truck Logistics Platform.
Reference documents: AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md,
NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md, IMPLEMENTATION_GUIDE_ALL_QUESTIONS.md

Task: Set up the complete Docker environment.

Please:
1. Create the complete docker-compose.yml with all 15 services
   (exact service list is in NEXT_LEVEL_ARCHITECTURE_V2.md Section "DOCKER CONTAINERIZATION")
2. Create .env.example with all required variables
3. Create init-scripts/postgres-init.sql with all database tables
   (schemas in AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md Section 7)
4. Create scripts/docker-up.sh and scripts/health-check.sh
5. Create monitoring/prometheus.yml

Use multi-stage Docker builds, health checks on all services,
and the exact image versions specified in the architecture docs.
```

---

## PHASE 2 STARTER PROMPT

```
Phase 1 Docker environment is complete. Starting Phase 2: Monorepo structure.
Reference: NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md Section "CROSS-PLATFORM STRATEGY"

Task: Set up the complete monorepo with Turborepo.

Please:
1. Create root package.json with npm workspaces
2. Create turbo.json with build pipeline
3. Create packages/shared/ with all TypeScript interfaces
   (types based on database schemas from AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md)
4. Create packages/api-client/ with Axios setup and all API methods
5. Create packages/state/ with Zustand stores
6. Set up apps/ folder structure for mobile, web, admin, tablet
7. Configure shared ESLint + TypeScript settings

All types must be exhaustive — every field from the database schemas
should have a corresponding TypeScript interface.
```

---

## PHASE 3 STARTER PROMPT

```
Monorepo structure is ready. Starting Phase 3: Backend API layer.
Reference: AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md Sections 4, 7, 8

Task: Build the microservices, starting with load-service.

Please build services/load-service/ with:
1. Express server with health endpoint
2. All load routes from Section 8 (createLoad, acceptLoad, etc.)
3. PostgreSQL queries for loads table (no ORM, use pg directly)
4. Redis caching with TTLs as specified
5. Kafka event publishing for load lifecycle events
6. Socket.io events for real-time updates
7. Zod validation schemas for all inputs
8. JWT middleware for protected routes
9. Unit tests for the service layer
10. Dockerfile with multi-stage build

Follow the business logic rules specified in MASTER_IMPLEMENTATION_PHASES.md
Section 3.5 for load service methods.
```

---

## PHASE 4 STARTER PROMPT

```
All backend services are running. Starting Phase 4: Frontend applications.
Reference: NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md Section "CROSS-PLATFORM STRATEGY"

Task: Build the React Native mobile app — starting with auth flow.

Please build apps/mobile/src/screens/Auth/ with:
1. SplashScreen (check token → route to auth or app)
2. UserTypeScreen (merchant / trucker choice)
3. LoginScreen (phone OTP flow)
4. OTPVerifyScreen (6-digit input with auto-submit)
5. RegisterScreen
6. KYCUploadScreen (camera + gallery, front/back of ID)

Use:
- React Navigation for routing
- Zustand (from packages/state/) for state
- API client (from packages/api-client/) for calls
- Proper loading states, error handling, and validation
- Native look: no web-style inputs, use proper RN components
```

---

## PHASE 5 STARTER PROMPT

```
Frontend apps are functional. Starting Phase 5: AI features.
Reference: AI_TRUCK_LOGISTICS_PLATFORM_ARCHITECTURE.md Section 5

Task: Build the route optimization and ETA prediction.

Please:
1. Implement route optimizer in services/pricing-service/src/services/route-optimizer.ts
   - TravelTime API integration
   - Toll gate enumeration from DB
   - Route scoring algorithm (see MASTER_IMPLEMENTATION_PHASES.md Section 5.2)
   - Return top 3 routes with scores, costs, risk

2. Implement ETA predictor in services/ml-service/src/models/eta_predictor.py
   - Feature engineering pipeline (see MASTER_IMPLEMENTATION_PHASES.md Section 5.3)
   - XGBoost model training script
   - FastAPI endpoint for Node.js to call
   - Include confidence interval in output

3. Set up nightly retraining cron job
```

---

## PHASE 6 STARTER PROMPT

```
AI features implemented. Starting Phase 6: Admin panel.
Reference: NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md Section "ADVANCED ADMIN PANEL"
           IMPLEMENTATION_GUIDE_ALL_QUESTIONS.md Section Q4

Task: Build the admin dashboard, starting with the real-time overview.

Please build apps/admin/app/(dashboard)/page.tsx with:
1. Real-time KPI cards (active loads, GMV, success rate, users)
   - WebSocket connection to /ws/admin/metrics
   - Cards update every 1 second
2. Revenue line chart (last 60 minutes, 1-minute buckets)
3. Delivery success gauge (target line at 97%)
4. Pending disputes card with count + "Resolve" button
5. Active fraud alerts card with severity breakdown
6. System status grid (green/red for each microservice)

Use:
- Next.js 14 App Router
- shadcn/ui components
- Recharts for charts
- TanStack Query for data fetching
- Socket.io client for real-time updates
```

---

## PHASE 7 STARTER PROMPT

```
All features complete. Starting Phase 7: Deployment & app store.
Reference: NEXT_LEVEL_PLATFORM_ARCHITECTURE_V2.md Section "DEPLOYMENT PIPELINE"

Task: Set up CI/CD and Kubernetes deployment.

Please create:
1. .github/workflows/ci.yml (lint, test, build on every push)
2. .github/workflows/deploy-staging.yml (push to develop → staging)
3. .github/workflows/deploy-production.yml (push to main → prod, zero-downtime)
4. k8s/deployments/api-gateway.yml with HPA configuration
5. k8s/deployments/load-service.yml with HPA configuration
6. k8s/ingress.yml with SSL termination

Kubernetes requirements:
- Rolling update strategy (maxSurge=1, maxUnavailable=0)
- Resource requests and limits defined
- Liveness and readiness probes
- HPA targets from MASTER_IMPLEMENTATION_PHASES.md Section 7.2

Then create ios/fastlane/Fastfile and android/fastlane/Fastfile
for automated app store submission.
```

---

---

# ═══════════════════════════════════════════════════
# IMPLEMENTATION CHECKLIST BY PHASE
# (Use to track progress)
# ═══════════════════════════════════════════════════

## PHASE 1 CHECKLIST — Docker Environment
```
[ ] docker-compose.yml (15 services)
[ ] .env.example (all variables)
[ ] init-scripts/postgres-init.sql (15 tables + indexes)
[ ] init-scripts/mongo-init.js
[ ] scripts/docker-up.sh
[ ] scripts/health-check.sh
[ ] scripts/seed-db.sh
[ ] monitoring/prometheus.yml
[ ] monitoring/grafana/dashboards/platform.json
[ ] All 15 containers healthy
[ ] Seed data inserted
```

## PHASE 2 CHECKLIST — Monorepo
```
[ ] Root package.json (workspaces)
[ ] turbo.json
[ ] packages/shared (types, utils, constants)
[ ] packages/api-client (all API calls)
[ ] packages/state (Zustand stores)
[ ] packages/ui-kit (design tokens, base components)
[ ] apps/mobile scaffolded
[ ] apps/web scaffolded
[ ] apps/admin scaffolded
[ ] apps/tablet scaffolded
[ ] services/ folder structure
[ ] Shared build passes
[ ] ESLint passes
```

## PHASE 3 CHECKLIST — Backend API
```
[ ] auth routes (register, login, OTP, KYC)
[ ] api-gateway (routing, auth middleware, rate limiting)
[ ] load-service (all load lifecycle endpoints)
[ ] trucker-service (discovery, acceptance, GPS)
[ ] pricing-service (AI pricing, route analysis, tolls, fuel)
[ ] notification-service (push, SMS, email)
[ ] payment-service (Stripe integration, payouts)
[ ] social-publishing-service (multi-platform)
[ ] admin-service (all admin endpoints)
[ ] WebSocket server (all events)
[ ] Kafka producers/consumers
[ ] Redis caching
[ ] All unit tests passing
[ ] All integration tests passing
```

## PHASE 4 CHECKLIST — Frontend
```
[ ] Auth screens (splash, type, login, OTP, register, KYC)
[ ] Merchant screens (dashboard, create load, tracking, history)
[ ] Trucker screens (dashboard, discovery, active load, earnings)
[ ] Chat screen (real-time messaging)
[ ] Shared screens (profile, settings, notifications)
[ ] Real-time GPS tracking screen
[ ] Create Load multi-step form
[ ] React web app
[ ] Admin dashboard (basic)
[ ] Tablet-optimized layouts
```

## PHASE 5 CHECKLIST — AI Features
```
[ ] Route optimizer (TravelTime API + scoring)
[ ] Toll gate calculator
[ ] Fuel optimizer
[ ] ETA predictor (XGBoost + LSTM)
[ ] Demand forecaster
[ ] Fraud detector (Isolation Forest)
[ ] Blockade detection (real-time monitoring)
[ ] Social content generator (Ollama + Claude hybrid)
[ ] One-click social publishing
[ ] Nightly model retraining cron
```

## PHASE 6 CHECKLIST — Admin Panel
```
[ ] Real-time dashboard (KPIs, charts, alerts)
[ ] User management (full CRUD, KYC, block/suspend)
[ ] Load management (all loads view, GPS replay)
[ ] Dispute resolution (AI-assisted, full actions)
[ ] Fraud detection dashboard
[ ] AI model management
[ ] Revenue analytics
[ ] Notification center (broadcast)
[ ] Social publishing admin
[ ] System health (Kubernetes, DBs, queues)
[ ] Audit log
[ ] Settings page
```

## PHASE 7 CHECKLIST — Deployment
```
[ ] GitHub Actions: ci.yml
[ ] GitHub Actions: deploy-staging.yml
[ ] GitHub Actions: deploy-production.yml
[ ] GitHub Actions: mobile-build.yml
[ ] Kubernetes: all deployments
[ ] Kubernetes: all HPAs
[ ] Kubernetes: ingress + SSL
[ ] Terraform: production AWS infrastructure
[ ] Fastlane: iOS configuration
[ ] Fastlane: Android configuration
[ ] iOS app submitted to TestFlight
[ ] Android app submitted to Google Play
[ ] Production monitoring active
[ ] Alerts configured
[ ] Load test: 5,000 users passing
```

---

---

# ═══════════════════════════════════════════════════
# TECHNICAL DEBT PREVENTION RULES
# ═══════════════════════════════════════════════════

Claude Code must follow these rules throughout ALL phases:

```
1. NO raw SQL strings — use parameterized queries always
   ✅ pool.query('SELECT * FROM loads WHERE id = $1', [loadId])
   ❌ pool.query('SELECT * FROM loads WHERE id = ' + loadId)

2. NO console.log in production code — use logger.info/warn/error
   ✅ logger.info('Load created', { loadId, merchantId })
   ❌ console.log('Load created:', loadId)

3. NO hardcoded configuration — use process.env only
   ✅ const apiKey = process.env.GOOGLE_MAPS_API_KEY
   ❌ const apiKey = 'AIzaSyXXXXXXX'

4. NO unhandled promise rejections — always try/catch async
   ✅ try { await createLoad(data) } catch(e) { logger.error(e); throw e }
   ❌ createLoad(data)  // fire and forget

5. NO God-functions — each function does ONE thing, max 30 lines
   ✅ separate: validateLoad() | saveLoad() | notifyTruckers()
   ❌ one big createLoadAndNotifyAndPriceAndSave() function

6. NO frontend data fetching outside of api-client package
   ✅ import { loadsApi } from '@truck-platform/api-client'
   ❌ axios.get('http://localhost:3000/loads') inside a component

7. NO direct DB access from frontend — always through API
8. NO JWT secret or API key in any source file or config file
9. NO any TypeScript type — always define proper interfaces
10. NO skipping tests for "just this one feature" — every feature needs tests
```

---

## FINAL NOTE TO CLAUDE CODE

When implementing this platform:

1. **Read ALL 7 reference documents** before starting each phase
2. **Ask if something is unclear** rather than assuming
3. **Follow the folder structure** exactly as specified
4. **Use the technology versions** specified (not newer/older)
5. **Implement acceptance criteria** as your definition of done
6. **Write tests first** when given the option
7. **Document non-obvious code** with inline comments
8. **Never sacrifice correctness for speed** — this is production code

The platform must be ready for real truckers and merchants in production.
Build it like lives and livelihoods depend on it — because they will.

---

**Document:** MASTER_IMPLEMENTATION_PHASES.md  
**Version:** 1.0  
**Total Phases:** 7  
**Estimated Duration:** 16 weeks (4 months)  
**References:** All 7 architecture documents  
**Target:** Production-ready platform for 10,000+ concurrent users  
