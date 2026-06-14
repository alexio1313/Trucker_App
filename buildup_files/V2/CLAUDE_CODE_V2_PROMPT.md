# AI Truck Platform — V2 Enhancement Implementation Prompt
## Feed this file to Claude Code to initiate all V2 features

---

## CONTEXT: WHAT EXISTS TODAY

The platform is a monorepo running 18 Docker containers. Core stack:
- **Frontend web:** `apps/web` — Vite + React 18 + TailwindCSS (port 3010)
- **Admin panel:** `apps/admin` — Next.js 14 (port 3011)
- **Mobile:** `apps/mobile` — Expo 51 / React Native 0.74
- **API gateway:** port 3000
- **Services (ports 3001–3008):** load_service, trucker_service, pricing_service, admin_service, social_service, ml_service, notification_service, payment_service
- **Databases:** PostgreSQL 16 + PostGIS, MongoDB 7, Redis 7, Elasticsearch 8
- **Messaging:** Kafka + RabbitMQ
- **Auth:** `req.headers['x-user-id']` pattern (PBKDF2 hashing)
- **Patches:** runtime patches via `docker cp` in `scripts/docker-up-v6.sh`
- **QA:** 38/38 tests passing (`node /tmp/qa_full_regression.js`)
- **APK:** `app-debug.apk` pointing to `http://192.168.8.101:3000/api/v1`

**Existing tables:** `users`, `trucks`, `loads`, `journey_logs`, `fuel_stops`, `disputes`

**Existing userTypes:** `merchant`, `trucker`, `admin`

**DO NOT break existing flows. All changes must be additive/backward-compatible.**

---

## V2 SCOPE: WHAT TO BUILD

### SPRINT 1 (Weeks 1–2): Progressive KYC Infrastructure

#### 1A. Database Migrations

Run these SQL migrations against the PostgreSQL container (`truck_postgres`):

```sql
-- Migration 001: KYC fields on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_stage INT DEFAULT 1;
-- 1=phone_verified, 2=identity_verified, 3=business_verified
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_provider VARCHAR(50);
-- values: 'surepass', 'perfios', 'digilocker', 'manual'
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_reference_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhaar_dob DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Migration 002: Trucker KYC detail
CREATE TABLE IF NOT EXISTS trucker_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  dl_number VARCHAR(20) NOT NULL,
  dl_valid_till DATE,
  dl_vehicle_classes TEXT[],
  dl_verified BOOLEAN DEFAULT FALSE,
  dl_verified_at TIMESTAMP,
  selfie_url VARCHAR(500),
  selfie_match_score DECIMAL(5,2),
  selfie_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Migration 003: Truck documents
CREATE TABLE IF NOT EXISTS truck_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  vehicle_number VARCHAR(15) NOT NULL UNIQUE,
  vehicle_type VARCHAR(50),
  owner_name VARCHAR(255),
  permit_type VARCHAR(50),
  permit_states TEXT[],
  rc_verified BOOLEAN DEFAULT FALSE,
  insurance_expiry DATE,
  fitness_expiry DATE,
  permit_expiry DATE,
  rc_doc_url VARCHAR(500),
  insurance_doc_url VARCHAR(500),
  fitness_doc_url VARCHAR(500),
  permit_doc_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 004: Logistics companies
CREATE TABLE IF NOT EXISTS logistics_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  gst_number VARCHAR(15) NOT NULL,
  gst_verified BOOLEAN DEFAULT FALSE,
  pan_number VARCHAR(10),
  cin_number VARCHAR(21),
  subscription_tier VARCHAR(20) DEFAULT 'starter',
  -- 'starter'=₹1999, 'growth'=₹4999, 'enterprise'=₹9999 /month
  subscription_expires_at TIMESTAMP,
  own_fleet_count INT DEFAULT 0,
  service_areas TEXT[],
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 005: Loader companies
CREATE TABLE IF NOT EXISTS loader_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  company_name VARCHAR(255) NOT NULL,
  gst_number VARCHAR(15),
  gst_verified BOOLEAN DEFAULT FALSE,
  labour_license_number VARCHAR(50),
  labour_license_doc_url VARCHAR(500),
  labour_license_verified BOOLEAN DEFAULT FALSE,
  pan_number VARCHAR(10),
  coverage_cities TEXT[],
  max_concurrent_jobs INT DEFAULT 5,
  subscription_tier VARCHAR(20) DEFAULT 'starter',
  -- 'starter'=₹1499, 'growth'=₹3999, 'enterprise'=₹7999 /month
  subscription_expires_at TIMESTAMP,
  rate_card JSONB DEFAULT '{
    "per_bag_general": 12,
    "per_tonne_general": 350,
    "per_tonne_machinery": 600,
    "detention_per_hour": 75,
    "minimum_charge": 200,
    "night_surcharge_pct": 25
  }'::jsonb,
  total_jobs INT DEFAULT 0,
  avg_rating DECIMAL(3,2),
  is_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 006: Loader workers
CREATE TABLE IF NOT EXISTS loader_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES loader_companies(id),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(15),
  aadhaar_number_hash VARCHAR(64), -- SHA256 hash only, never plain
  aadhaar_verified BOOLEAN DEFAULT FALSE,
  photo_url VARCHAR(500),
  skill_tags TEXT[] DEFAULT ARRAY['general'],
  -- options: 'general','heavy_machinery','hazmat','refrigerated','fragile'
  status VARCHAR(20) DEFAULT 'active',
  total_assignments INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 007: Highway businesses
CREATE TABLE IF NOT EXISTS highway_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  business_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  -- 'dhaba','fuel_station','truck_stop','tyre_shop','service_center'
  phone VARCHAR(15),
  gst_number VARCHAR(15),
  gst_verified BOOLEAN DEFAULT FALSE,
  fssai_number VARCHAR(15),
  fssai_verified BOOLEAN DEFAULT FALSE,
  location_lat DECIMAL(10,6) NOT NULL,
  location_lng DECIMAL(10,6) NOT NULL,
  location GEOMETRY(POINT, 4326), -- PostGIS
  address TEXT,
  highway_name VARCHAR(50),
  verified_on_highway BOOLEAN DEFAULT FALSE,
  facilities JSONB DEFAULT '{}'::jsonb,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  subscription_tier VARCHAR(20) DEFAULT 'free',
  -- 'free'=₹0, 'basic'=₹499, 'standard'=₹1499, 'premium'=₹3499 /month
  subscription_expires_at TIMESTAMP,
  ad_credits_balance DECIMAL(10,2) DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  is_open_24hr BOOLEAN DEFAULT FALSE,
  current_status VARCHAR(20) DEFAULT 'open',
  -- 'open','closed','busy'
  is_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending','active','suspended'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 008: Highway business ads
CREATE TABLE IF NOT EXISTS highway_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES highway_businesses(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  offer_code VARCHAR(50),
  offer_text VARCHAR(255),
  target_break_types TEXT[] DEFAULT ARRAY['fuel','meal','rest'],
  radius_km INT DEFAULT 10,
  time_from VARCHAR(5) DEFAULT '00:00',
  time_to VARCHAR(5) DEFAULT '23:59',
  status VARCHAR(20) DEFAULT 'active',
  budget_total DECIMAL(10,2),
  spent_total DECIMAL(10,2) DEFAULT 0,
  cost_per_impression DECIMAL(6,2) DEFAULT 0.50,
  cost_per_click DECIMAL(6,2) DEFAULT 3.00,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 009: Loading jobs (detention + arrangement tracking)
CREATE TABLE IF NOT EXISTS loading_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id VARCHAR(50) NOT NULL REFERENCES loads(id),
  arrangement_type VARCHAR(30) NOT NULL,
  -- 'merchant_arranged', 'trucker_arranged'
  arranged_by_user_id UUID REFERENCES users(id),
  loader_company_id UUID REFERENCES loader_companies(id),
  scheduled_start TIMESTAMP,
  trucker_arrival_time TIMESTAMP,
  detention_started_at TIMESTAMP,
  loading_started_at TIMESTAMP,
  loading_completed_at TIMESTAMP,
  duration_minutes INT,
  detention_minutes INT DEFAULT 0,
  detention_rate_per_hour DECIMAL(8,2) DEFAULT 75,
  detention_cost DECIMAL(10,2) DEFAULT 0,
  loading_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  items_loaded INT,
  weight_loaded_tonnes DECIMAL(8,2),
  issue_notes TEXT,
  trucker_sign_off BOOLEAN DEFAULT FALSE,
  merchant_sign_off BOOLEAN DEFAULT FALSE,
  payment_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 010: Toll crossings per journey
CREATE TABLE IF NOT EXISTS toll_crossings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50) NOT NULL,
  plaza_name VARCHAR(255) NOT NULL,
  plaza_lat DECIMAL(10,6),
  plaza_lng DECIMAL(10,6),
  highway_code VARCHAR(20),
  state_name VARCHAR(100),
  crossing_time TIMESTAMP NOT NULL,
  amount_paid DECIMAL(8,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'fastag',
  fastag_transaction_id VARCHAR(100),
  vehicle_category VARCHAR(20),
  source VARCHAR(20) DEFAULT 'gps_inferred',
  -- 'fastag_api','gps_inferred','driver_manual'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 011: Weighbridge stops
CREATE TABLE IF NOT EXISTS weighbridge_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50) NOT NULL,
  location_name VARCHAR(255),
  location_lat DECIMAL(10,6),
  location_lng DECIMAL(10,6),
  state_name VARCHAR(100),
  stop_time TIMESTAMP NOT NULL,
  weight_recorded_tonnes DECIMAL(8,2),
  gvw_limit_tonnes DECIMAL(8,2),
  status VARCHAR(20) DEFAULT 'pass',
  -- 'pass','warning','overloaded','fined'
  fine_amount DECIMAL(10,2),
  receipt_photo_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 012: State border crossings
CREATE TABLE IF NOT EXISTS state_crossings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50) NOT NULL,
  from_state VARCHAR(100),
  to_state VARCHAR(100),
  crossing_lat DECIMAL(10,6),
  crossing_lng DECIMAL(10,6),
  crossing_time TIMESTAMP NOT NULL,
  naka_type VARCHAR(50) DEFAULT 'border',
  -- 'border','entry_tax','agricultural','mining'
  entry_tax_paid DECIMAL(8,2) DEFAULT 0,
  document_checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 013: Break suggestions (existing trip_breaks enhancement)
CREATE TABLE IF NOT EXISTS trip_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50),
  break_type VARCHAR(50) NOT NULL,
  -- 'fuel','meal','rest','washroom','toll','weighbridge','breakdown'
  location_name VARCHAR(255),
  location_lat DECIMAL(10,6),
  location_lng DECIMAL(10,6),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_minutes INT,
  cost_impact JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'in_progress',
  -- 'planned','in_progress','completed','skipped'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS break_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  break_type VARCHAR(50) NOT NULL,
  suggested_km DECIMAL(8,1),
  location_name VARCHAR(255),
  location_lat DECIMAL(10,6),
  location_lng DECIMAL(10,6),
  reason VARCHAR(255),
  compliance_rule VARCHAR(100),
  -- 'MOTOR_VEHICLES_ACT_REST','FUEL_RESERVE','MEAL_TIME','NIGHT_SAFETY'
  priority INT DEFAULT 3,
  -- 1=urgent(red), 2=high(orange), 3=normal(blue), 4=low(grey)
  accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMP,
  skipped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add PostGIS index for geo queries
CREATE INDEX IF NOT EXISTS idx_highway_biz_location
  ON highway_businesses USING GIST(location);

-- Trigger to sync lat/lng to PostGIS geometry
CREATE OR REPLACE FUNCTION sync_highway_biz_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_location ON highway_businesses;
CREATE TRIGGER trg_sync_location
  BEFORE INSERT OR UPDATE OF location_lat, location_lng
  ON highway_businesses
  FOR EACH ROW EXECUTE FUNCTION sync_highway_biz_location();
```

#### 1B. New userTypes in Registration

Extend the existing `users` table `userType` column to accept:
- `logistics` (previously only `merchant`, `trucker`, `admin`)
- `loader_company`
- `highway_business`

Update `users` table CHECK constraint if one exists:
```sql
-- If there's a CHECK constraint on userType, drop and recreate:
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_usertype_check;
ALTER TABLE users ADD CONSTRAINT users_usertype_check
  CHECK (usertype IN ('merchant', 'trucker', 'admin', 'logistics', 'loader_company', 'highway_business', 'developer', 'tester', 'qa'));
```

#### 1C. KYC Service (New Microservice — port 3009)

Create `services/kyc-service/` with the following endpoints:

```
POST /api/v1/kyc/aadhaar/send-otp
  Body: { aadhaarNumber: string }
  Calls: Surepass API (env: SUREPASS_API_KEY)
  Returns: { transactionId: string }

POST /api/v1/kyc/aadhaar/verify-otp
  Body: { transactionId: string, otp: string }
  Returns: { name: string, dob: string, address: string, photo: string }
  On success: updates users SET aadhaar_verified=true, aadhaar_name=..., verification_stage=2

POST /api/v1/kyc/pan/verify
  Body: { panNumber: string }
  Returns: { name: string, dob: string, entityType: string }

POST /api/v1/kyc/gst/verify
  Body: { gstin: string }
  Returns: { legalName: string, tradeName: string, status: string, address: string }

POST /api/v1/kyc/dl/verify
  Body: { dlNumber: string, dob: string }
  Returns: { name: string, validTill: string, vehicleClasses: string[] }

POST /api/v1/kyc/rc/verify
  Body: { vehicleNumber: string }
  Returns: { ownerName: string, vehicleType: string, permitType: string, insuranceExpiry: string }

GET /api/v1/kyc/digilocker/auth-url
  Returns: { authUrl: string, state: string }

GET /api/v1/kyc/digilocker/callback
  Query: { code: string, state: string }
  Fetches: Aadhaar + PAN + DL from DigiLocker
  Updates: user record with verified data

POST /api/v1/kyc/selfie/verify
  Body: { selfieBase64: string, aadhaarPhotoBase64: string }
  Calls: Surepass face match API
  Returns: { matchScore: number, verified: boolean }
```

**Environment variables needed:**
```
SUREPASS_API_KEY=your_key_here
SUREPASS_BASE_URL=https://kyc-api.surepass.io/api/v1
DIGILOCKER_CLIENT_ID=your_client_id
DIGILOCKER_CLIENT_SECRET=your_client_secret
DIGILOCKER_REDIRECT_URI=http://192.168.8.101:3000/api/v1/kyc/digilocker/callback
```

**Anti-spam logic in KYC service:**
```javascript
// On each verification, check:
// 1. Same Aadhaar not used by another active user (different userType)
const existing = await db.query(
  'SELECT id, usertype FROM users WHERE aadhaar_name = $1 AND id != $2 AND aadhaar_verified = true',
  [aadhaarName, userId]
);
if (existing.rows.length > 0) {
  return res.status(409).json({ error: 'Aadhaar already registered with another account' });
}

// 2. New merchant: max 5 loads in first 24h (enforce in load_service)
// 3. New account payment hold (enforce in payment_service)
```

#### 1D. Registration Flow — New userTypes

Add to `apps/web/src/pages/auth/RegisterPage.tsx`:

**Step 1 (all users):** Select role
- [Merchant / Shipper] → userType='merchant'
- [Logistics Company / Fleet Owner] → userType='logistics'
- [Truck Driver] → userType='trucker'
- [Loading / Labour Company] → userType='loader_company'
- [Highway Business (Dhaba / Fuel / etc.)] → userType='highway_business'

**Step 2 (all users):** Phone OTP — existing pattern

**Step 3 (all users):** Aadhaar eKYC
- Primary CTA: [Verify with DigiLocker] (faster, fetches all docs in one go)
- Secondary: [Enter Aadhaar manually]
- Language selector prominent here (Hindi/Punjabi/Gujarati/Tamil/English)

**Step 4 (role-specific):**
- Merchant: GST + bank account
- Logistics: GST/CIN + PAN + bank account
- Trucker: DL + selfie + (add truck later)
- Loader Company: GST + labour licence upload + bank account
- Highway Business: Business type + GPS pin + 3 photos (defer subscription choice to after listing is live)

Add routes in `apps/web/src/App.tsx`:
```typescript
'/register' → RegisterPage (new, role-selectable)
'/register/trucker' → TruckerRegisterPage
'/register/merchant' → MerchantRegisterPage
'/register/logistics' → LogisticsRegisterPage
'/register/loader' → LoaderCompanyRegisterPage
'/register/highway' → HighwayBizRegisterPage
'/trucker/kyc' → TruckerKYCPage (add DL + truck)
```

Post-login redirect in `LoginPage.tsx` — extend existing switch:
```typescript
switch(userType) {
  case 'merchant': navigate('/dashboard');
  case 'trucker': navigate('/trucker/dashboard');
  case 'admin': window.location.href = 'http://192.168.8.101:3011/admin';
  case 'logistics': navigate('/logistics/dashboard');       // NEW
  case 'loader_company': navigate('/loader/dashboard');     // NEW
  case 'highway_business': navigate('/highway/dashboard'); // NEW
}
```

---

### SPRINT 2 (Weeks 3–4): Loading Arrangement Flow

#### 2A. Extend Load Posting (Merchant Side)

In `apps/web/src/pages/merchant/` add `PostLoadPage.tsx` (or extend existing load posting form):

**New field: `loading_arrangement`**
```typescript
type LoadingArrangement = 'merchant_arranged' | 'trucker_arranged';

// When merchant selects 'merchant_arranged':
// → Fetch and display loader companies near pickup location
// GET /api/v1/loader-cos/near?city=Bangalore&lat=12.97&lng=77.59
// Show as readonly recommendation list (no booking button)
// Show: "Detention of ₹75/hr applies automatically if your team is late"

// When merchant selects 'trucker_arranged':
// → Show: "Truckers bidding on this load must include a loading crew"
```

Add `loading_arrangement` column to `loads` table:
```sql
ALTER TABLE loads ADD COLUMN IF NOT EXISTS loading_arrangement VARCHAR(30) DEFAULT 'merchant_arranged';
ALTER TABLE loads ADD COLUMN IF NOT EXISTS detention_rate_per_hour DECIMAL(8,2) DEFAULT 75;
```

#### 2B. Trucker Load Acceptance — Loading Confirmation

In `apps/web/src/pages/trucker/LoadsPage.tsx` and `apps/mobile/app/(trucker)/loads.tsx`:

When trucker taps "Accept Load", show modal:
```
IF load.loading_arrangement === 'merchant_arranged':
  "Merchant is arranging the loading team.
   Detention charges of ₹75/hr apply if their team is more than 30 minutes late.
   Do you agree?"
  [Yes, I agree] [Message merchant first]

IF load.loading_arrangement === 'trucker_arranged':
  "This load requires YOU to bring a loading crew.
   Do you have a loading team?"
  [Yes — cost included in my quote]
  [I need to find loaders — see nearby loader companies]

  IF 'I need to find loaders':
  → Show loader companies near pickup:
    GET /api/v1/loader-cos/near?city=[pickup_city]
  → "Contact them directly before accepting"
  → [Accept anyway] [Cancel]
```

Add to trucker acceptance API:
```
POST /api/v1/truckers/my/loads/{loadId}/accept
Body: {
  loading_confirmed: boolean,
  brings_loaders: boolean,         // if trucker_arranged
  loading_cost_included: boolean,  // is it in freight quote?
  loading_cost_separate_amount: number  // if separate
}
```

#### 2C. Detention Timer Backend

In `trucker-routes-patch.js`, add endpoints:

```javascript
// Trucker arrives at pickup
POST /api/v1/truckers/my/journey/arrived-pickup
Body: { loadId, lat, lng }
Logic:
  - Insert into loading_jobs: { load_id, arrangement_type, trucker_arrival_time: NOW() }
  - If arrangement_type === 'merchant_arranged':
    - Set detention_started_at = NOW() + 30 minutes (grace period)
    - Start background timer

// Trucker marks loading complete
POST /api/v1/truckers/my/journey/loading-complete
Body: { loadId, itemsLoaded, weightTonnes, issues? }
Logic:
  - Set loading_completed_at = NOW()
  - Calculate detention_minutes = (loading_completed_at - detention_started_at) in minutes
  - detention_cost = (detention_minutes / 60) * detention_rate_per_hour
  - Set trucker_sign_off = true
  - Notify merchant: "Loading complete. Detention: ₹{cost}"

// GET detention status (polling from both apps)
GET /api/v1/loads/{loadId}/detention-status
Returns: {
  detentionRunning: boolean,
  minutesElapsed: number,
  costSoFar: number,
  ratePerHour: number
}
```

#### 2D. Loader Company Recommendation API

```javascript
// GET loader companies near a city (used in both merchant and trucker flows)
GET /api/v1/loader-cos/near?city=Bangalore&lat=12.97&lng=77.59&radius=20
Returns: [
  {
    id: "uuid",
    company_name: "Kumar Hamali Services",
    coverage_cities: ["Bangalore", "Mysore"],
    avg_rating: 4.6,
    total_jobs: 234,
    rate_card: { per_tonne_general: 350, detention_per_hour: 75 },
    phone: "+91XXXXXXXXXX",
    subscription_tier: "growth"  // only show active subscribers
  }
]
```

---

### SPRINT 3 (Weeks 5–6): Highway Business Portal (MVP)

#### 3A. New Routes in `apps/web/src/App.tsx`

```typescript
// Highway Business portal (completely separate from merchant)
'/highway/register' → HighwayBizRegisterPage
'/highway/dashboard' → HighwayDashboardPage
'/highway/profile' → HighwayProfilePage
'/highway/ads' → HighwayAdsPage
'/highway/analytics' → HighwayAnalyticsPage
'/highway/subscription' → HighwaySubscriptionPage
```

**ProtectedRoute** for highway portal: `userType === 'highway_business'`

#### 3B. Highway Business Backend Endpoints

Add to a new `highway-routes-patch.js` (deployed to `truck_trucker_service` or a new container):

```javascript
// Registration
POST /api/v1/highway/register
Body: {
  businessName, category, phone, gstNumber?,
  fssaiNumber?, locationLat, locationLng, address,
  highwayName?, facilities, photos, isOpen24hr
}

// Profile
GET /api/v1/highway/me
PUT /api/v1/highway/me

// Subscription
POST /api/v1/highway/subscription
Body: { tier: 'free'|'basic'|'standard'|'premium' }

// Update live status
PATCH /api/v1/highway/me/status
Body: { currentStatus: 'open'|'closed'|'busy' }

// Ads
GET /api/v1/highway/ads
POST /api/v1/highway/ads
Body: {
  title, description, imageUrl?, offerCode?, offerText?,
  targetBreakTypes, radiusKm, timeFrom, timeTo,
  budgetTotal, costPerImpression, costPerClick,
  startsAt, endsAt
}
PUT /api/v1/highway/ads/:adId
DELETE /api/v1/highway/ads/:adId

// Analytics
GET /api/v1/highway/analytics?period=7d|30d|90d
Returns: { impressions, clicks, ctr, spendTotal, estimatedVisits }

// Add ad credits
POST /api/v1/highway/credits/add
Body: { amount: number }  // prepay credits
```

#### 3C. Driver-Facing: Highway Business on Map

In `apps/web/src/pages/trucker/JourneyPage.tsx`:

**Map layer: Highway business pins**
```javascript
// Fetch highway businesses near current position
// GET /api/v1/highway/near?lat=X&lng=Y&radius=15
// Returns businesses sorted by subscription_tier (premium first)

// Pin colors by category:
const PIN_COLORS = {
  dhaba: '#F59E0B',        // amber — food
  fuel_station: '#EF4444', // red — fuel
  truck_stop: '#3B82F6',   // blue — rest
  tyre_shop: '#6B7280',    // grey — service
  service_center: '#8B5CF6' // purple — repair
};

// Pin size by tier:
// free: 12px dot
// basic: 16px dot + category icon
// standard: 20px dot + name label
// premium: 24px pulsing dot + name + rating
```

**GET /api/v1/highway/near endpoint:**
```javascript
GET /api/v1/highway/near?lat=12.97&lng=77.59&radius=15
Returns: [
  {
    id, businessName, category, locationLat, locationLng,
    subscriptionTier, avgRating, isOpen24hr, currentStatus,
    facilities, phone, activeOffer?
  }
]
// PostGIS query:
// WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, $radius * 1000)
// AND status = 'active'
// ORDER BY CASE subscription_tier WHEN 'premium' THEN 1 WHEN 'standard' THEN 2 WHEN 'basic' THEN 3 ELSE 4 END
```

#### 3D. Contextual Ad Serving

**Break → Ad trigger logic:**

In the break suggestion engine, after a break is accepted:
```javascript
// POST /api/v1/highway/ads/serve
// Called when driver accepts a break suggestion
Body: {
  driverLat, driverLng,
  breakType: 'fuel'|'meal'|'rest'|'washroom',
  driverId
}

Logic:
  1. Find active ads within radius where breakType in ad.target_break_types
  2. Filter by time window (time_from <= NOW() <= time_to)
  3. Check driver hasn't seen this ad 3x today (frequency cap)
  4. Rank by subscription tier (premium first), then avg rating
  5. Return top 3 ads
  6. Log impression for each returned ad
  7. Deduct impression cost from business ad_credits_balance

// Log ad click
POST /api/v1/highway/ads/:adId/click
Body: { driverId }
Logic: Log click, deduct click cost from ad_credits_balance
```

**Mobile ad card component** (`apps/mobile/app/(trucker)/BreaksPage.tsx`):
```typescript
// After driver accepts break, show AdCard component
<AdCard
  ad={contextualAd}
  onPress={() => logAdClick(ad.id)}
  onNavigate={() => openMaps(ad.businessLat, ad.businessLng)}
  onCall={() => Linking.openURL(`tel:${ad.phone}`)}
/>

// AdCard shows: business name, offer text, distance, rating
// Premium tier: highlighted border + "Featured" badge
// Never show ads during breakdown (safety)
```

---

### SPRINT 4 (Weeks 7–8): Geo-Ad Analytics & Credits

#### 4A. Highway Business Dashboard (`apps/web/src/pages/highway/`)

**HighwayDashboardPage.tsx:**
- Stats: total impressions today / this week / this month
- Ad credits remaining (warning when <₹100)
- Active campaigns list with pause/resume
- Top performing ad (best CTR)
- Recent driver reviews

**HighwayAdsPage.tsx:**
Create ad campaign form:
- Image upload (Cloudflare R2 or S3)
- Title + description + offer code
- Trigger: which break types (fuel/meal/rest)
- Radius slider (1–20km)
- Time window (e.g. 6am–10pm only)
- Budget (total cap) + cost per impression/click
- Date range

**HighwayAnalyticsPage.tsx:**
```
Period selector: 7 days / 30 days / 90 days
Metrics:
  - Impressions over time (bar chart)
  - Clicks over time (line chart)
  - CTR % (impressions → clicks)
  - Credits spent vs budget
  - Estimated physical visits (clicks × 0.4 conversion assumption)
  - Top performing ad
  - Driver demographics (city, truck type) if available
```

#### 4B. Admin: Highway Business Management

In `apps/admin/src/app/admin/`:

Add `highway-businesses/page.tsx`:
- List all pending highway businesses (status='pending')
- Show: name, category, GPS location, photos, FSSAI number
- [Approve] → sets is_verified=true, status='active'
- [Reject with reason] → sets status='suspended'
- Verify GPS is near highway (show on map)

Add `highway-ads/page.tsx`:
- Review ad campaigns before they go live
- [Approve Ad] → ad becomes visible to drivers
- [Reject Ad] → with reason

---

### SPRINT 5 (Weeks 9–10): Loader Company Portal

#### 5A. New Routes

```typescript
'/loader/register' → LoaderCompanyRegisterPage
'/loader/dashboard' → LoaderDashboardPage
'/loader/workers' → LoaderWorkersPage
'/loader/jobs' → LoaderJobsPage
'/loader/subscription' → LoaderSubscriptionPage
'/loader/analytics' → LoaderAnalyticsPage
```

#### 5B. Loader Company Backend

```javascript
// Registration
POST /api/v1/loader-cos/register
Body: {
  companyName, gstNumber, labourLicenseNumber,
  labourLicenseDocUrl, coverageCities, maxConcurrentJobs,
  rateCard, phone
}

// Add worker
POST /api/v1/loader-cos/workers
Body: {
  name, phone, aadhaarNumber (plain — hash on backend), photo, skillTags
}
// Backend: hash Aadhaar with SHA256 before storing
// Run UIDAI existence check (not full eKYC) for cost control

// Get jobs near their coverage cities
GET /api/v1/loader-cos/jobs?status=pending|active|completed
// Returns loads in their coverage cities that need loading

// Accept job referral
POST /api/v1/loader-cos/jobs/:loadId/express-interest
// Loader company is shown to merchant/trucker when they look for loaders

// Job dashboard
GET /api/v1/loader-cos/analytics
Returns: { jobsThisMonth, totalEarnings, avgRating, workersActive }
```

---

### JOURNEY ENHANCEMENTS: Toll, Weight, ETA (Add to existing journey flow)

These extend `trucker-routes-patch.js` and `JourneyPage.tsx`.

#### Toll Crossing Log

```javascript
// Driver manually logs toll (primary method while FASTag API partnership pending)
POST /api/v1/truckers/my/journey/toll
Body: { loadId, journeyLogId, plazaName, highwayCode, stateName, amountPaid, paymentMethod }

// GPS-inferred toll (background process)
// When GPS position matches known toll location (±500m), auto-suggest:
// "Did you pass [Hoskote Toll Plaza]? Amount: ~₹195"
// Driver confirms → logs automatically

// GET toll log for a load (merchant/logistics can see)
GET /api/v1/loads/:loadId/toll-log
Returns: [{ plazaName, stateName, crossingTime, amountPaid, source }]
```

#### Weighbridge Log

```javascript
// Driver logs weighbridge stop
POST /api/v1/truckers/my/journey/weighbridge
Body: { loadId, journeyLogId, locationName, weightRecordedTonnes, gvwLimitTonnes, fineAmount? }

// GET weight log
GET /api/v1/loads/:loadId/weight-log
```

#### State Border Crossings

```javascript
// Auto-detected by GPS (background process in mobile app)
// When GPS crosses a known state border coordinate, auto-log
POST /api/v1/truckers/my/journey/state-crossing
Body: { loadId, journeyLogId, fromState, toState, crossingLat, crossingLng, nakaType }
```

#### Break Suggestions (Extend existing journey)

```javascript
// Called every 5 minutes while journey is active
GET /api/v1/truckers/my/journey/break-suggestions?journeyLogId=X

Server-side logic:
  drivingSince = hours since last break
  fuelRangeKm = (currentFuelLiters × 4km/L)
  currentHour = hour in IST

  suggestions = []

  IF drivingSince >= 4 AND no rest break in last 4h:
    suggestions.push({ type:'rest', priority:1, reason:'Mandatory (Motor Vehicles Act)', ... })

  IF fuelRangeKm < 100:
    suggestions.push({ type:'fuel', priority:2, reason:'Fuel reserve low — range ${fuelRangeKm}km', ... })

  IF hoursSinceStart >= 6 AND no meal break today:
    suggestions.push({ type:'meal', priority:3, reason:'Meal break — 6+ hours driving', ... })

  IF currentHour >= 21 OR currentHour < 5:
    suggestions.push({ type:'rest', priority:4, reason:'Night driving — consider stopping', ... })

  return suggestions sorted by priority

// Accept a suggestion (start break)
POST /api/v1/truckers/my/journey/break-start
Body: { journeyLogId, breakType, locationName, lat, lng }

// End a break
POST /api/v1/truckers/my/journey/break-end
Body: { breakId }
Logic: calculate duration, recalculate ETA, notify merchant if delay > 30 mins
```

#### ETA Recalculation

```javascript
// Called after every break-end, every 30 mins, and on demand
GET /api/v1/truckers/my/journey/eta?journeyLogId=X

Server logic:
  1. OSRM route: remaining km from current GPS to destination
  2. Base driving time: remainingKm / avgSpeedKmh (assume 45 for NH, 35 for SH)
  3. Traffic multiplier:
     - Peak hours (6-10am, 4-9pm): ×1.3
     - Night (10pm-5am): ×1.1
     - Normal: ×1.0
  4. Pending breaks (from break_suggestions not yet taken):
     - Each fuel: +15 mins
     - Each meal: +45 mins
     - Each rest: +30 mins
  5. Fatigue buffer: IF drivingHoursTotal > 8: + (drivingHoursTotal - 8) × 5 mins
  6. newETA = NOW() + totalMinutes

Returns: {
  newETA: ISO datetime,
  remainingKm: number,
  breakdown: {
    drivingMins: number,
    pendingBreaksMins: number,
    trafficDelayMins: number,
    fatigueMins: number
  },
  delayVsOriginal: number  // minutes delayed vs original ETA
}

// If delayVsOriginal > 30: emit Kafka event 'journey.eta-delayed'
// notification_service picks up and notifies merchant
```

---

### MERCHANT TRACKING VIEW ENHANCEMENTS

In `apps/web/src/pages/merchant/` add or enhance `ShipmentTrackingPage.tsx`:

```typescript
// Full tracking view for a specific load
// Shows: GPS position on map + timeline of events

Timeline events (newest first):
  - Toll crossings (plaza name, amount, time)
  - State border crossings (from/to state, time)
  - Weighbridge stops (weight, status, fine if any)
  - Break starts/ends (type, duration, location)
  - ETA updates (new ETA, reason for change)
  - Loading events (started, completed, detention)

Right panel: ETA breakdown
  - Current ETA
  - Original ETA
  - Delta (red if delayed > 30 mins)
  - Breakdown components

Map: OSRM route polyline + current truck position
     + toll plazas crossed (green tick)
     + weighbridges (scale icon)
     + state borders (dashed line)
```

---

### ADMIN PANEL ENHANCEMENTS

In `apps/admin/src/app/admin/`:

Add these pages:
- `kyc-queue/page.tsx` — pending KYC reviews (loader licences, highway photos)
- `loader-companies/page.tsx` — list, verify, suspend loader companies
- `highway-businesses/page.tsx` — list, verify, manage highway businesses
- `highway-ads/page.tsx` — review and approve ads

Enhance `users/page.tsx`:
- Show verification_stage badge (1/2/3) per user
- Filter by userType (now includes logistics, loader_company, highway_business)
- One-click KYC approve for flagged cases

---

### MOBILE APP (Expo) ENHANCEMENTS

In `apps/mobile/`:

**New screens:**
- `app/(trucker)/breaks.tsx` — break suggestions + active break timer
- `app/(trucker)/toll-log.tsx` — manual toll entry + auto-suggested tolls
- `app/(trucker)/weighbridge.tsx` — weighbridge logging
- `app/(trucker)/journey-tracking.tsx` — enhanced from existing `tracking.tsx`

**Update `tracking.tsx`:**
- Add highway business pins to MapView
- Add break suggestion banner (shows priority-1 breaks as sticky alert)
- Add ETA breakdown card (expandable)
- Add toll/weight log FAB button

**New highway business app screens:**
- `app/(highway)/dashboard.tsx`
- `app/(highway)/ads.tsx`
- `app/(highway)/analytics.tsx`

**New loader company app screens:**
- `app/(loader)/dashboard.tsx`
- `app/(loader)/workers.tsx`
- `app/(loader)/jobs.tsx`

---

### SOCIAL PAGE → AD MANAGER MIGRATION

Existing files:
- `apps/web/src/pages/merchant/SocialPage.tsx`
- `apps/admin/src/app/admin/social/page.tsx`

Do NOT delete these. Rename/repurpose:
- `SocialPage.tsx` → keep at `/dashboard/social` but add notice: "Social posting is being replaced by the Highway Business Ad Platform. If you operate a dhaba, fuel station, or truck stop, register at /highway/register to advertise directly to drivers."
- Remove the Instagram/LinkedIn/Twitter/Facebook platform selector
- Keep the admin approval workflow structure (it's useful for highway ad approval)

---

### DOCKER: New Service Registration

Add to `docker-compose.yml`:
```yaml
  kyc_service:
    image: truck_kyc_service:latest
    build:
      context: .
      dockerfile: services/kyc-service/Dockerfile
    ports:
      - "3009:3000"
    environment:
      - DATABASE_URL=postgresql://truck_user:TruckPlatform@2024@postgres:5432/truck_db
      - SUREPASS_API_KEY=${SUREPASS_API_KEY}
      - DIGILOCKER_CLIENT_ID=${DIGILOCKER_CLIENT_ID}
      - DIGILOCKER_CLIENT_SECRET=${DIGILOCKER_CLIENT_SECRET}
    depends_on:
      - postgres
```

Add to `scripts/docker-up-v6.sh`:
```bash
# Run all 13 migrations
docker exec truck_postgres psql -U truck_user -d truck_db < scripts/migrations/001_kyc_fields.sql
# ... repeat for 002-013
```

Add proxy routes in `proxy.routes.patch.js`:
```javascript
// KYC service
if (req.path.startsWith('/api/v1/kyc')) {
  proxy(req, res, 'http://kyc_service:3000');
}
// Highway business
if (req.path.startsWith('/api/v1/highway')) {
  proxy(req, res, 'http://kyc_service:3000');  // or separate service
}
// Loader companies
if (req.path.startsWith('/api/v1/loader-cos')) {
  proxy(req, res, 'http://truck_trucker_service:3000');
}
```

---

### QA TEST ADDITIONS

Extend `qa_full_regression.js` with:

```javascript
// KYC endpoints
{ method:'POST', path:'/api/v1/kyc/gst/verify', body:{gstin:'27AAPFU0939F1ZV'}, expect:200 },

// Loading arrangement
{ method:'POST', path:'/api/v1/truckers/my/journey/arrived-pickup', headers:{...}, body:{loadId:'...'}, expect:200 },
{ method:'GET', path:'/api/v1/loader-cos/near?city=Bangalore', expect:200 },

// Toll/weight logging
{ method:'POST', path:'/api/v1/truckers/my/journey/toll', body:{...}, expect:200 },
{ method:'GET', path:'/api/v1/loads/TEST123/toll-log', expect:200 },

// Break suggestions
{ method:'GET', path:'/api/v1/truckers/my/journey/break-suggestions?journeyLogId=...', expect:200 },

// Highway business
{ method:'GET', path:'/api/v1/highway/near?lat=12.97&lng=77.59&radius=15', expect:200 },

// ETA
{ method:'GET', path:'/api/v1/truckers/my/journey/eta?journeyLogId=...', expect:200 },
```

Target: 55+ tests passing (up from 38).

---

### CHANGELOG ENTRIES TO ADD

```markdown
## [UPCOMING] V2 Enhancement Sprint

### Sprint 1: Progressive KYC
- 13 new database migrations (run via scripts/migrations/)
- New userTypes: logistics, loader_company, highway_business
- KYC service (port 3009): Aadhaar OTP, DigiLocker, PAN, GST, DL, RC, RC verification
- Role-specific registration flows with language support (Hindi/Punjabi/Gujarati/Tamil)
- Anti-spam: Aadhaar uniqueness check, payment hold on new accounts

### Sprint 2: Loading Arrangement
- Load posting: 'loading_arrangement' field (merchant_arranged | trucker_arranged)
- Detention timer: auto-starts when trucker arrives and merchant team is not present
- Loader company recommendation widget (display-only, no platform booking)
- Loading sign-off flow: both trucker and merchant confirm completion

### Sprint 3: Highway Business Portal
- New portal at /highway/* (separate from merchant and trucker)
- 5 business categories: dhaba, fuel_station, truck_stop, tyre_shop, service_center
- 4 subscription tiers: free, basic (₹499), standard (₹1,499), premium (₹3,499)
- Map pins on driver app (category-colored, size by tier)
- Emergency services (tyre/mechanic) shown regardless of tier

### Sprint 4: Geo-Ads
- Ad creation and management for highway businesses
- Contextual serving: break type + GPS radius + time window
- Frequency cap: max 3 impressions per driver per ad per day
- Credits system: prepay, deduct per impression/click

### Sprint 5: Loader Company Portal
- New portal at /loader/*
- Worker roster with Aadhaar existence check
- Job referral system (based on coverage cities)
- Rate card: per-bag, per-tonne, detention, night surcharge

### Journey Enhancements (All Sprints)
- Toll crossing log (manual + GPS-inferred, FASTag API ready)
- Weighbridge stop log
- State border auto-detection
- Break suggestions engine (fatigue, fuel, meal, night safety)
- ETA recalculation after every break
- Merchant tracking view: full timeline (tolls + weight + breaks + ETA)
```

---

## ENVIRONMENT & CONSTRAINTS

- Server IP: `192.168.8.101`
- All patches via `docker cp` + process restart (existing pattern)
- Use `req.headers['x-user-id']` for auth (not JWT, existing pattern)
- PostgreSQL password: `TruckPlatform@2024` (from existing CHANGELOG)
- MongoDB URI: `mongodb://truck_user:TruckPlatform@2024Mongo@mongo:27017/` (last @ split fix already applied)
- All new backend files go to `/app/dist/` in respective containers via docker cp
- Frontend: Vite monorepo with alias resolution from `packages/*/src` (no dist/ compile needed)
- Mobile: Expo 51, points to `http://192.168.8.101:3000/api/v1`
- Auth storage key: `auth-storage-v2` (already updated)
- Test credentials:
  - Merchant: +919880001001 / TruckQA@2024
  - Trucker: +919770001001 / TruckQA@2024
  - Admin: +919000000001 / TruckQA@2024

---

## LOCKED DECISIONS (Do Not Override)

1. Option C loading (platform-arranged) is DEFERRED — show "coming soon" only
2. Highway businesses are NOT merged with merchant portal — completely separate login
3. KYC via Surepass/Perfios API (not manual document review for standard cases)
4. DigiLocker is PRIMARY KYC path — prompt it first on every registration
5. Loader companies earn directly from merchants/truckers — platform earns subscription only
6. Social media posting (Instagram/Twitter/Facebook) is REMOVED from merchant scope
7. Emergency results (tyre/mechanic) shown to all drivers regardless of subscription tier
8. Payment hold on new accounts for first 3 transactions (48h hold)
9. Aadhaar number: hash with SHA256 before storing, never store in plain text
10. All existing 38 QA tests must continue passing after each sprint
```
