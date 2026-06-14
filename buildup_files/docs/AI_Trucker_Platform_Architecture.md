# AI Trucker Platform — Detailed Architecture Document

## Table of Contents
1. [System Overview](#system-overview)
2. [Infrastructure & Deployment](#infrastructure--deployment)
3. [Microservices Catalogue](#microservices-catalogue)
4. [Data Layer](#data-layer)
5. [AI / ML Services](#ai--ml-services)
6. [API Gateway & Routing](#api-gateway--routing)
7. [Frontend Applications](#frontend-applications)
8. [Security Architecture](#security-architecture)
9. [End-to-End Data Flows](#end-to-end-data-flows)
10. [Inter-Service Communication](#inter-service-communication)

---

## System Overview

The AI Trucker Platform is a multi-tenant, microservices-based freight logistics system built on Docker, Node.js, and PostgreSQL. It connects **Merchants** (who post loads) with **Truckers** (who accept and transport them), governed by an **Admin** panel and enriched by several AI/ML services.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Ubuntu Server 22.04  (192.168.8.101)                 │
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                  │
│  │  truck_web    │  │truck_admin_   │  │  truck_mobile │                  │
│  │  (Next.js)   │  │panel (Next.js)│  │  (React Native│                  │
│  │  Port 3010   │  │  Port 3011    │  │  Expo)        │                  │
│  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘                  │
│         │                  │                   │                           │
│         └──────────────────┼───────────────────┘                           │
│                            │ HTTPS                                          │
│                    ┌───────▼────────┐                                       │
│                    │ truck_api_     │                                       │
│                    │ gateway        │                                       │
│                    │ (Express proxy)│                                       │
│                    │ Port 3000      │                                       │
│                    └───────┬────────┘                                       │
│          ┌─────────────────┼──────────────────────────────┐                │
│          │                 │                              │                │
│   ┌──────▼──────┐  ┌───────▼──────┐  ┌────────────────┐  │                │
│   │truck_trucker│  │truck_merchant│  │ truck_admin_   │  │                │
│   │_service     │  │_service      │  │ service        │  │                │
│   │Port 3001    │  │Port 3002     │  │ Port 3003      │  │                │
│   └──────┬──────┘  └──────┬───────┘  └────────┬───────┘  │                │
│          │                │                   │           │                │
│   ┌──────▼──────┐  ┌───────▼───────────────────▼───────┐  │                │
│   │truck_social │  │         PostgreSQL DB              │  │                │
│   │_publishing  │  │         Port 5432                  │  │                │
│   │Port 3006    │  └────────────────────────────────────┘  │                │
│   └──────┬──────┘                                          │                │
│          │          ┌────────────────────────────────────┐  │                │
│   ┌──────▼──────┐   │         MongoDB                   │  │                │
│   │ truck_ml_   │   │         Port 27017                │  │                │
│   │ analytics   │   └────────────────────────────────────┘  │                │
│   │ Port 3007   │                                           │                │
│   └──────┬──────┘   ┌────────────────────────────────────┐  │                │
│          │           │         Redis Cache                │  │                │
│   ┌──────▼──────┐   │         Port 6379                  │  │                │
│   │ truck_      │   └────────────────────────────────────┘  │                │
│   │ notification│                                           │                │
│   │ Port 3008   │                                           │                │
│   └─────────────┘                                           │                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure & Deployment

### Host Server
- **OS:** Ubuntu 22.04 LTS
- **IP:** 192.168.8.101
- **Container Runtime:** Docker with Docker Compose
- **All services run as named Docker containers** prefixed with `truck_`

### Docker Compose Stack
| Container Name             | Role                             | Port  |
|----------------------------|----------------------------------|-------|
| `truck_api_gateway`        | Central reverse proxy / router   | 3000  |
| `truck_trucker_service`    | Trucker-facing REST API          | 3001  |
| `truck_merchant_service`   | Merchant-facing REST API         | 3002  |
| `truck_admin_service`      | Admin REST API                   | 3003  |
| `truck_social_service`     | Social media AI publisher        | 3006  |
| `truck_ml_analytics`       | ML / demand forecasting          | 3007  |
| `truck_notification`       | Push / SMS / email notifications | 3008  |
| `truck_web`                | Trucker & Merchant web portal    | 3010  |
| `truck_admin_panel`        | Admin web panel                  | 3011  |
| `truck_postgres`           | Primary relational database      | 5432  |
| `truck_mongodb`            | Document store (social, ML)      | 27017 |
| `truck_redis`              | Session cache, rate-limiting     | 6379  |

### Internal Network
All containers share a private Docker bridge network (`truck_network`). Services communicate by container name (e.g., `http://truck_trucker_service:3001`). Only the API gateway port (3000) and the two frontend ports (3010, 3011) are exposed to the host network.

---

## Microservices Catalogue

### 1. API Gateway (`truck_api_gateway` — Port 3000)
**Technology:** Express.js + `http-proxy-middleware`

**Responsibilities:**
- Single entry point for all API calls from the frontend
- Routes `/api/v1/truckers/**` → Trucker Service
- Routes `/api/v1/loads/**` → Merchant or Trucker Service (depending on sub-path)
- Routes `/api/v1/merchant/**` → Merchant Service
- Routes `/api/v1/admin/**` → Admin Service
- Routes `/api/v1/social/**` → Social Publishing Service
- Routes `/api/v1/ml/**` → ML Analytics Service
- JWT validation middleware (public routes: `/auth/**`, `/health`)
- Rate limiting: 100 req/min per IP (Redis-backed)
- Request/response logging with correlation IDs
- CORS headers for web and mobile clients

**Key Env Vars:** `JWT_SECRET`, `TRUCKER_SERVICE_URL`, `MERCHANT_SERVICE_URL`, `ADMIN_SERVICE_URL`, `REDIS_URL`

---

### 2. Trucker Service (`truck_trucker_service` — Port 3001)
**Technology:** Node.js (Express), PostgreSQL

**Domain:** Everything a trucker does after logging in.

**Key API Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | OTP-based login, returns JWT |
| GET  | `/my/profile` | Fetch trucker profile |
| PUT  | `/my/profile/availability` | Toggle online/offline |
| GET  | `/loads/available` | Browse open loads nearby |
| POST | `/loads/:loadId/accept` | Accept a load (gated by availability) |
| POST | `/my/journey/begin-loading` | Mark arrived at pickup, start loading cargo |
| POST | `/my/journey/start` | Begin driving (in_transit) |
| POST | `/my/journey/complete` | Mark delivered |
| GET  | `/my/journey` | Current active journey |
| POST | `/kyc` | Submit KYC documents |
| POST | `/truckers/trucks` | Add truck to fleet |
| PUT  | `/profile/bank` | Submit bank details |
| GET  | `/my/earnings` | Earnings history |
| GET  | `/my/disputes` | Dispute history |

**Journey State Machine:**
```
[posted] → [accepted] → [loading] → [in_transit] → [delivered]
                                                      ↓
                                               [payment_released]
```
- `accepted`: Trucker accepted the load. Awaiting arrival at pickup.
- `loading`: Trucker arrived; cargo being loaded onto truck.
- `in_transit`: Truck is driving to destination.
- `delivered`: Trucker confirmed delivery. Admin releases payment.

**Availability Gate:**
When a trucker calls `POST /loads/:loadId/accept`, middleware checks `users.availability_status`. If `'offline'`, the request is rejected with `OFFLINE_TRUCKER` error code.

**Database tables used:** `users`, `loads`, `trucks`, `kyc_documents`, `bank_accounts`, `earnings`, `disputes`

---

### 3. Merchant Service (`truck_merchant_service` — Port 3002)
**Technology:** Node.js (Express), PostgreSQL

**Domain:** Everything a merchant (cargo owner / shipper) does.

**Key API Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | OTP-based login |
| GET  | `/my/loads` | Merchant's load history |
| POST | `/loads` | Create a new load posting |
| GET  | `/loads/:loadId` | Load detail |
| PUT  | `/loads/:loadId` | Edit unpublished load |
| DELETE | `/loads/:loadId` | Cancel a load |
| GET  | `/my/profile` | Merchant profile |
| POST | `/my/disputes` | Raise a dispute |

**Load Lifecycle:** Merchants post loads with origin, destination, cargo type, weight, and price. The load appears in the trucker's available load feed immediately after creation.

**Database tables used:** `users`, `loads`, `disputes`

---

### 4. Admin Service (`truck_admin_service` — Port 3003)
**Technology:** Node.js (Express), PostgreSQL + MongoDB

**Domain:** Platform governance — KYC approval, load oversight, dispute resolution, user management.

**Key API Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Admin login (role check) |
| GET  | `/loads` | All loads with full nested detail |
| GET  | `/users` | All users (truckers + merchants) |
| GET  | `/kyc/pending` | KYC submissions awaiting review |
| POST | `/kyc/:userId/approve` | Approve KYC |
| POST | `/kyc/:userId/reject` | Reject KYC with reason |
| GET  | `/disputes` | All disputes |
| POST | `/disputes/:id/resolve` | Resolve a dispute |
| GET  | `/analytics/dashboard` | Platform KPIs |
| GET  | `/social/posts` | Social posts (pending/published/rejected) |
| POST | `/social/posts/:id/approve` | Approve social post |
| POST | `/social/posts/:id/reject` | Reject social post |

**Load Data Format:** The admin service returns loads in nested camelCase:
```json
{
  "loadId": "LD-001",
  "origin": { "city": "Chennai", "state": "TN" },
  "destination": { "city": "Mumbai" },
  "cargo": { "cargoType": "Electronics", "weightKg": 5000 },
  "pricing": { "agreedPrice": 85000 },
  "createdAt": "2026-01-15T09:30:00Z",
  "merchantId": "USR-MERCH-001"
}
```

The admin panel's `normalizeLoad()` function handles mapping this nested structure to flat display fields.

---

### 5. Social Publishing Service (`truck_social_service` — Port 3006)
**Technology:** Node.js (Express), MongoDB

**Domain:** AI-powered social media content creation and multi-platform publishing.

**Key API Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/social/generate-caption` | Generate AI caption for a topic |
| POST | `/api/social/posts` | Create and schedule a post |
| GET  | `/api/social/posts` | List posts (with status filter) |
| PUT  | `/api/social/posts/:id/approve` | Admin approves post |
| PUT  | `/api/social/posts/:id/reject` | Admin rejects post |
| POST | `/api/social/posts/:id/publish` | Publish to selected platforms |

**Caption Generation Cascade:**
```
1. Groq (llama3-8b-8192) ─→ if API key set & response OK ─→ done
2. Claude (claude-3-haiku) ─→ if API key set & response OK ─→ done  
3. OpenAI (gpt-4o-mini)   ─→ if API key set & response OK ─→ done
4. Gemini (gemini-pro)    ─→ if API key set & response OK ─→ done
5. Rich Template Fallback ─→ always succeeds (instant, zero latency)
```

**Template Fallback:** Generates professional platform-aware captions using deterministic template selection based on topic content. Includes platform-specific hashtags (Twitter, LinkedIn, Instagram, Facebook, WhatsApp).

**Publishing Targets:** WhatsApp Business API, Instagram Graph API, Facebook Page API, LinkedIn Company Page API, Twitter/X API v2.

**Data Store:** MongoDB collection `social_posts` stores post metadata, status history, AI-generated captions, scheduled publish times, and per-platform publish results.

---

### 6. ML Analytics Service (`truck_ml_analytics` — Port 3007)
**Technology:** Node.js (Express), Python (subprocess), MongoDB + PostgreSQL

**Domain:** Predictive analytics, demand forecasting, route optimization.

**Capabilities:**
1. **Demand Forecasting:** Predicts load volume for specific routes/corridors using historical load data. Uses time-series analysis (ARIMA model wrapped in Python subprocess).
2. **Dynamic Pricing Engine:** Suggests optimal prices for loads based on distance, cargo type, fuel index, season, and historical acceptance rates.
3. **Route Optimization:** Calculates optimal waypoints for multi-stop loads using Google Maps Distance Matrix API.
4. **Trucker Matching:** Scores available truckers against a load based on: proximity, truck capacity, KYC status, past delivery rating, and specialization (refrigerated, hazmat, oversized).
5. **Fraud Detection:** Flags suspicious load postings or acceptance patterns (e.g., same trucker accepting loads from the same merchant repeatedly at above-market prices).

**Key API Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ml/forecast` | Demand forecast for a route |
| POST | `/api/ml/price-suggest` | Suggested price for a load |
| GET  | `/api/ml/match/:loadId` | Ranked trucker matches for a load |
| GET  | `/api/ml/analytics/dashboard` | Aggregated platform analytics |

---

### 7. Notification Service (`truck_notification` — Port 3008)
**Technology:** Node.js (Express), Redis queue

**Domain:** All outbound communications to users.

**Notification Channels:**
- **SMS:** Via Twilio / MSG91 (OTP delivery, load alerts)
- **Push Notifications:** Firebase Cloud Messaging (FCM) for the mobile app
- **Email:** Nodemailer via SendGrid (KYC result, payment confirmation)
- **WhatsApp:** WhatsApp Business API for load status updates

**Event-driven pattern:** Other services publish events to a Redis pub/sub channel. The notification service subscribes and dispatches:

| Event | Recipient | Channel |
|-------|-----------|---------|
| `load.accepted` | Merchant | SMS + Push |
| `journey.delivered` | Merchant + Admin | Push + Email |
| `kyc.approved` | Trucker | SMS + Email |
| `payment.released` | Trucker | SMS + Push |
| `dispute.opened` | Admin | Email |
| `dispute.resolved` | Both parties | SMS + Email |

---

## Data Layer

### PostgreSQL Schema (Key Tables)

```sql
-- Users (truckers, merchants, admins unified)
users (
  user_id UUID PRIMARY KEY,
  phone VARCHAR(15) UNIQUE,
  role ENUM('trucker', 'merchant', 'admin'),
  full_name VARCHAR,
  availability_status ENUM('available', 'offline') DEFAULT 'offline',
  kyc_status ENUM('pending', 'approved', 'rejected'),
  created_at TIMESTAMP
)

-- Trucks (a trucker can own multiple trucks)
trucks (
  truck_id UUID PRIMARY KEY,
  trucker_id UUID REFERENCES users(user_id),
  registration_number VARCHAR UNIQUE,
  make VARCHAR, model VARCHAR, year INT,
  truck_type ENUM('flatbed', 'container', 'tanker', 'refrigerated', 'tipper'),
  capacity_tons NUMERIC,
  is_active BOOLEAN DEFAULT true
)

-- Loads
loads (
  load_id UUID PRIMARY KEY,
  merchant_id UUID REFERENCES users(user_id),
  trucker_id UUID REFERENCES users(user_id),
  status ENUM('posted', 'accepted', 'loading', 'in_transit', 'delivered', 'cancelled'),
  origin JSONB,        -- { city, state, address, lat, lng, contact }
  destination JSONB,   -- { city, state, address, lat, lng, contact }
  cargo JSONB,         -- { cargoType, weightKg, volumeCbm, isHazmat }
  pricing JSONB,       -- { basePrice, agreedPrice, platformFee, truckerPayout }
  time_window JSONB,   -- { pickupDate, deliveryDate }
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- KYC Documents
kyc_documents (
  kyc_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  aadhaar_number VARCHAR,
  pan_number VARCHAR,
  driving_license VARCHAR,
  document_urls JSONB,  -- S3 URLs
  status ENUM('pending', 'approved', 'rejected'),
  reviewer_id UUID REFERENCES users(user_id),
  review_notes TEXT,
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP
)

-- Bank Accounts
bank_accounts (
  account_id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(user_id),
  account_holder_name VARCHAR,
  bank_name VARCHAR,
  account_number VARCHAR,
  ifsc_code VARCHAR,
  is_verified BOOLEAN DEFAULT false
)

-- Disputes
disputes (
  dispute_id UUID PRIMARY KEY,
  load_id UUID REFERENCES loads(load_id),
  raised_by UUID REFERENCES users(user_id),
  against UUID REFERENCES users(user_id),
  category ENUM('payment', 'damage', 'delay', 'fraud', 'other'),
  description TEXT,
  status ENUM('open', 'under_review', 'resolved', 'closed'),
  resolution TEXT,
  resolved_by UUID REFERENCES users(user_id),
  created_at TIMESTAMP,
  resolved_at TIMESTAMP
)
```

### MongoDB Collections

```
social_posts {
  _id: ObjectId,
  merchant_id: String,
  platform: ['linkedin', 'instagram', 'facebook', 'twitter', 'whatsapp'],
  topic: String,
  tone: String,
  ai_caption: String,
  media_urls: [String],
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected',
  scheduled_at: Date,
  published_at: Date,
  publish_results: { platform: { success, post_id, error } },
  created_at: Date
}

ml_demand_data {
  _id: ObjectId,
  route_corridor: String,  // "Chennai-Mumbai"
  date: Date,
  load_count: Number,
  avg_price: Number,
  forecast_next_7d: [Number]
}

platform_events {
  _id: ObjectId,
  event_type: String,
  actor_id: String,
  target_id: String,
  metadata: Object,
  created_at: Date
}
```

### Redis Usage
- **Session tokens:** JWT blocklist (logout invalidation), TTL = token expiry
- **Rate limiting:** Sliding window counters per IP per route
- **OTP store:** `otp:{phone}` → hashed OTP, TTL 5 minutes
- **Notification queue:** Pub/Sub channel `notifications`
- **Cache:** Available loads feed per city pair, TTL 60 seconds

---

## AI / ML Services

### Caption Generation (Social Service)
- **Primary:** Groq's `llama3-8b-8192` — fastest, free tier available
- **Fallback 1:** Anthropic Claude `claude-3-haiku-20240307`
- **Fallback 2:** OpenAI `gpt-4o-mini`
- **Fallback 3:** Google Gemini Pro
- **Final fallback:** Rich template engine (deterministic, instant, no API dependency)

### Route-Aware Trucker Matching (ML Service)
- Reads available truckers from PostgreSQL filtered by: `availability_status = 'available'`, `kyc_status = 'approved'`
- Scores each against load requirements using weighted formula:
  ```
  score = (0.4 × proximity_score) + (0.3 × capacity_fit) + (0.2 × rating) + (0.1 × specialization_match)
  ```
- Returns ranked list with estimated ETA and suggested price

### Demand Forecasting
- Aggregates 90-day historical load data from PostgreSQL by route corridor
- Feeds into Python ARIMA model (via `child_process.execSync`)
- Returns 7-day demand curve for load posting recommendations

---

## API Gateway & Routing

### Route Map
```
Client → :3000/api/v1/...

  /truckers/**          → truck_trucker_service:3001
  /loads/available      → truck_trucker_service:3001
  /my/journey/**        → truck_trucker_service:3001
  /loads (POST)         → truck_merchant_service:3002
  /merchant/**          → truck_merchant_service:3002
  /admin/**             → truck_admin_service:3003
  /social/**            → truck_social_service:3006
  /ml/**                → truck_ml_analytics:3007
  /notifications/**     → truck_notification:3008
```

### Authentication Flow
```
1. Client sends: POST /api/v1/auth/login { phone }
2. Gateway forwards to appropriate service
3. Service verifies OTP, issues JWT signed with JWT_SECRET
4. Client stores JWT in localStorage / SecureStore
5. All subsequent requests: Authorization: Bearer <token>
   OR:                       x-user-id: <userId> (internal)
6. Gateway middleware validates JWT on every non-public route
7. Decoded userId injected as x-user-id header for downstream services
```

---

## Frontend Applications

### Trucker/Merchant Web Portal (`truck_web` — Port 3010)
**Technology:** Next.js 14, TypeScript, Tailwind CSS

**Key Pages:**
- `/` — Landing page
- `/auth/login` — Phone + OTP login
- `/trucker/dashboard` — Load feed, earnings summary
- `/trucker/journey` — Active journey with GPS map, status actions
- `/trucker/profile` — KYC, bank, truck management, availability toggle
- `/trucker/loads` — Browse available loads
- `/merchant/dashboard` — Posted loads, active shipments
- `/merchant/loads/new` — Post a new load
- `/social` — AI social media creator (caption generation + publishing)

**State Management:** React Context (UserContext, JourneyContext)

**i18n:** `useI18n` hook with English + Hindi translations; auto-detects browser language; falls back to English for missing keys

**API Client:** Axios instance with JWT interceptor; auto-refreshes on 401

### Admin Panel (`truck_admin_panel` — Port 3011)
**Technology:** Next.js 14, TypeScript, Tailwind CSS

**Key Pages:**
- `/admin` — Dashboard with KPIs
- `/admin/users` — User management (truckers + merchants)
- `/admin/loads` — All loads with normalizeLoad() mapping
- `/admin/kyc` — KYC approval queue
- `/admin/disputes` — Dispute resolution
- `/admin/social` — Social post approval queue
- `/admin/analytics` — ML-powered platform analytics

**Data Normalization:** Admin loads API returns nested camelCase; UI `normalizeLoad()` function flattens for display.

---

## Security Architecture

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS (TLS 1.3) via Nginx reverse proxy in production |
| Authentication | JWT (HS256), 7-day expiry, Redis blocklist for logout |
| Authorization | Role-based: `trucker`, `merchant`, `admin` enforced at gateway |
| OTP | 6-digit, 5-min TTL, rate-limited to 3 requests per phone per hour |
| Input Validation | Joi schema validation on all POST/PUT endpoints |
| SQL Injection | Parameterized queries via `node-postgres` (never string interpolation) |
| Rate Limiting | Redis sliding window: 100 req/min (API), 5 req/min (OTP) |
| KYC Gate | Truckers cannot accept loads until `kyc_status = 'approved'` |
| Availability Gate | Truckers cannot accept loads when `availability_status = 'offline'` |
| Payment Escrow | Payments held in escrow until delivery confirmed by both parties |

---

## End-to-End Data Flows

### Flow 1: Load Lifecycle
```
Merchant creates load
  → POST /api/v1/loads { origin, destination, cargo, pricing }
  → Merchant Service validates, inserts into PostgreSQL
  → Load status: 'posted'
  → Notification: "Your load is live" → Merchant (SMS)

Trucker browses and accepts
  → GET /api/v1/loads/available?lat=13.08&lng=80.27
  → Trucker Service queries loads WHERE status='posted' AND origin nearby
  → Trucker sees load; clicks Accept
  → POST /api/v1/loads/:loadId/accept
  → Gateway middleware checks availability_status = 'available'
  → Trucker Service: UPDATE loads SET status='accepted', trucker_id=?
  → Notification: "Load accepted by trucker" → Merchant

Trucker arrives at pickup
  → POST /api/v1/my/journey/begin-loading { loadId }
  → UPDATE loads SET status='loading'
  → UI shows pickup contact details and address

Cargo loaded; trucker starts driving
  → POST /api/v1/my/journey/start
  → UPDATE loads SET status='in_transit'
  → Journey page shows Google Maps route
  → Live GPS updates every 30s

Trucker reaches destination
  → POST /api/v1/my/journey/complete { proofOfDelivery: base64 }
  → UPDATE loads SET status='delivered'
  → Admin notified; payment review triggered

Admin releases payment
  → POST /api/v1/admin/loads/:loadId/release-payment
  → UPDATE loads SET status='payment_released'
  → UPDATE earnings: trucker payout credited
  → Notification: "₹85,000 credited" → Trucker (SMS + Push)
```

### Flow 2: KYC Approval
```
Trucker submits KYC
  → POST /api/v1/kyc { aadhaar, pan, drivingLicense, photoUrls }
  → Trucker Service inserts into kyc_documents
  → Admin notified: "New KYC submission"

Admin reviews
  → GET /api/v1/admin/kyc/pending
  → Admin sees documents; clicks Approve or Reject
  → POST /api/v1/admin/kyc/:userId/approve
  → UPDATE users SET kyc_status='approved'
  → Notification: "KYC Approved! You can now accept loads." → Trucker
```

### Flow 3: AI Caption Generation
```
Merchant opens Social Media page
  → Enters topic ("Our new Chennai hub is live!") + tone (professional)
  → Selects platforms (LinkedIn, Instagram)
  → Clicks "Generate Caption"

Social Service receives request
  → POST /api/v1/social/generate-caption { topic, tone, platform }
  → Tries Groq: if GROQ_API_KEY set → calls llama3-8b-8192
  → (if no key) Tries Claude, then OpenAI, then Gemini
  → (if no key) Falls to rich template: instant professional caption
  → Returns caption in < 2 seconds

Merchant reviews → edits → clicks Post
  → POST /api/v1/social/posts { caption, platforms, mediaUrls }
  → Status: 'pending_approval'

Admin approves
  → POST /api/v1/admin/social/posts/:id/approve
  → Social service calls platform APIs:
       LinkedIn: POST /v2/ugcPosts
       Instagram: POST /{ig-user-id}/media + /{ig-user-id}/media_publish
       Facebook: POST /{page-id}/feed
  → Status updated to 'published' with post IDs
```

---

## Inter-Service Communication

All internal service calls use HTTP over the Docker bridge network. There is no message broker (no RabbitMQ/Kafka) in the current architecture — the Notification Service uses Redis Pub/Sub as a lightweight event bus.

```
Service A calls Service B:
  http://truck_{service_name}:{port}/internal/...

Notification events published by any service:
  redis.publish('notifications', JSON.stringify({
    type: 'load.accepted',
    userId: 'USR-001',
    payload: { loadId: 'LD-001', ... }
  }))

Notification Service subscriber:
  redis.subscribe('notifications', (message) => {
    const event = JSON.parse(message);
    dispatch(event);  // → SMS / Push / Email / WhatsApp
  })
```

---

*Document generated: June 2026 | AI Trucker Platform v1.0*
