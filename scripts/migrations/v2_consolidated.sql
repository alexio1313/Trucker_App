-- V2 Consolidated Migration — column names match hotfix patch files exactly
-- user_id PK (not id), user_type (not usertype), journey_logs table created here
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING / ADD COLUMN IF NOT EXISTS)

-- ── 0. Extend user_type column width (was VARCHAR(10), new types need 30) ────
ALTER TABLE users ALTER COLUMN user_type TYPE VARCHAR(30);

-- ── 1. Extend user_type CHECK constraint ──────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
  ALTER TABLE users
    ADD CONSTRAINT users_user_type_check
    CHECK (user_type IN ('merchant','trucker','admin','logistics','loader_company','highway_business','developer','tester','qa'));
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

-- ── 2. KYC fields on users ────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_stage INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kyc_provider VARCHAR(20),
  ADD COLUMN IF NOT EXISTS kyc_reference_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS aadhaar_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS aadhaar_dob DATE,
  ADD COLUMN IF NOT EXISTS aadhaar_number_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS gst_verified BOOLEAN DEFAULT FALSE;

-- ── 3. Trucker KYC ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trucker_kyc (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trucker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  dl_number VARCHAR(20),
  dl_expiry DATE,
  dl_verified BOOLEAN DEFAULT FALSE,
  dl_front_url VARCHAR(500),
  dl_back_url VARCHAR(500),
  selfie_url VARCHAR(500),
  face_match_score NUMERIC(5,2),
  selfie_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT trucker_kyc_trucker_id_key UNIQUE (trucker_id)
);

-- ── 4. Truck documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS truck_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  truck_id UUID NOT NULL REFERENCES trucks(truck_id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  rc_number VARCHAR(50),
  rc_expiry DATE,
  rc_verified BOOLEAN DEFAULT FALSE,
  insurance_number VARCHAR(50),
  insurance_expiry DATE,
  insurance_verified BOOLEAN DEFAULT FALSE,
  fitness_expiry DATE,
  fitness_verified BOOLEAN DEFAULT FALSE,
  permit_type VARCHAR(30),
  permit_expiry DATE,
  permit_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Logistics companies ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistics_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  gst_number VARCHAR(15),
  pan_number VARCHAR(10),
  subscription_tier VARCHAR(20) DEFAULT 'starter' CHECK (subscription_tier IN ('starter','growth','enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  fleet_size INTEGER DEFAULT 0,
  coverage_states TEXT[],
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Loader companies ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loader_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  coverage_cities TEXT[],
  gst_number VARCHAR(15),
  labour_license_number VARCHAR(50),
  labour_license_doc_url VARCHAR(500),
  max_concurrent_jobs INTEGER DEFAULT 5,
  rate_card JSONB DEFAULT '{"loading_per_tonne":150,"unloading_per_tonne":150,"crane_per_hour":500}'::jsonb,
  avg_rating NUMERIC(3,2) DEFAULT 5.00,
  total_jobs INTEGER DEFAULT 0,
  subscription_tier VARCHAR(20) DEFAULT 'starter' CHECK (subscription_tier IN ('starter','growth','enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Loader workers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loader_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES loader_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  aadhaar_number_hash VARCHAR(64),
  aadhaar_verified BOOLEAN DEFAULT FALSE,
  photo_url VARCHAR(500),
  skill_tags TEXT[] DEFAULT '{}',
  daily_wage NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  total_assignments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. Highway businesses ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS highway_businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  business_name VARCHAR(255) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('dhaba','fuel','truck_stop','tyre_shop','service_center')),
  address TEXT,
  highway_name VARCHAR(255),
  location_lat NUMERIC(10,8),
  location_lng NUMERIC(11,8),
  location GEOMETRY(POINT,4326),
  phone VARCHAR(20),
  open_hours VARCHAR(50),
  facilities JSONB DEFAULT '{}'::jsonb,
  photos TEXT[] DEFAULT '{}',
  is_open_24hr BOOLEAN DEFAULT FALSE,
  current_status VARCHAR(20) DEFAULT 'open' CHECK (current_status IN ('open','closed','busy')),
  gst_number VARCHAR(15),
  gst_verified BOOLEAN DEFAULT FALSE,
  fssai_number VARCHAR(30),
  subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free','basic','standard','premium')),
  subscription_expires_at TIMESTAMPTZ,
  ad_credits_balance NUMERIC(10,2) DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 5.00,
  total_reviews INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highway_biz_location ON highway_businesses USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_highway_biz_category ON highway_businesses(category);
CREATE INDEX IF NOT EXISTS idx_highway_biz_status ON highway_businesses(status, is_verified);

CREATE OR REPLACE FUNCTION sync_highway_biz_location() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.location_lat IS NOT NULL AND NEW.location_lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_highway_biz_location ON highway_businesses;
CREATE TRIGGER trg_sync_highway_biz_location
  BEFORE INSERT OR UPDATE ON highway_businesses
  FOR EACH ROW EXECUTE FUNCTION sync_highway_biz_location();

-- ── 9. Highway ads ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS highway_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES highway_businesses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  offer_text VARCHAR(255),
  offer_code VARCHAR(50),
  image_url VARCHAR(500),
  target_break_types TEXT[] DEFAULT '{}',
  radius_km NUMERIC(6,2) DEFAULT 5,
  time_from TIME DEFAULT '00:00',
  time_to TIME DEFAULT '23:59',
  budget_total NUMERIC(10,2) DEFAULT 0,
  cost_per_impression NUMERIC(6,2) DEFAULT 0.5,
  cost_per_click NUMERIC(6,2) DEFAULT 3.0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spent_total NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending_review' CHECK (status IN ('pending_review','pending','active','paused','rejected')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. Loading arrangement columns on loads ──────────────────────────────────
ALTER TABLE loads
  ADD COLUMN IF NOT EXISTS loading_arrangement VARCHAR(30) DEFAULT 'trucker_arranged' CHECK (loading_arrangement IN ('merchant_arranged','trucker_arranged')),
  ADD COLUMN IF NOT EXISTS detention_rate_per_hour NUMERIC(10,2) DEFAULT 75;

-- ── 11. Loading jobs (used by journey_v2 and loader routes) ──────────────────
CREATE TABLE IF NOT EXISTS loading_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  loader_company_id UUID REFERENCES loader_companies(id) ON DELETE SET NULL,
  arrangement_type VARCHAR(30),
  arranged_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  trucker_arrival_time TIMESTAMPTZ,
  detention_started_at TIMESTAMPTZ,
  detention_rate_per_hour NUMERIC(10,2) DEFAULT 75,
  loading_completed_at TIMESTAMPTZ,
  items_loaded INTEGER,
  weight_loaded_tonnes NUMERIC(6,2),
  issue_notes TEXT,
  detention_minutes INTEGER DEFAULT 0,
  detention_cost NUMERIC(10,2) DEFAULT 0,
  trucker_sign_off BOOLEAN DEFAULT FALSE,
  total_cost NUMERIC(10,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','disputed')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','completed','cancelled')),
  worker_count INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. Journey logs (referenced by journey_v2_patch.js) ─────────────────────
CREATE TABLE IF NOT EXISTS journey_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  remaining_km NUMERIC(8,2),
  distance_covered_km NUMERIC(8,2) DEFAULT 0,
  current_lat NUMERIC(10,8),
  current_lng NUMERIC(11,8),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. Toll crossings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS toll_crossings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journey_log_id UUID REFERENCES journey_logs(id) ON DELETE SET NULL,
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  plaza_name VARCHAR(255) NOT NULL,
  plaza_lat NUMERIC(10,8),
  plaza_lng NUMERIC(11,8),
  highway_code VARCHAR(20),
  state_name VARCHAR(100),
  crossing_time TIMESTAMPTZ DEFAULT NOW(),
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'fastag' CHECK (payment_method IN ('fastag','cash','upi','card')),
  source VARCHAR(20) DEFAULT 'driver_manual' CHECK (source IN ('driver_manual','auto_fastag','gps_detected'))
);

-- ── 14. Weighbridge stops ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weighbridge_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journey_log_id UUID REFERENCES journey_logs(id) ON DELETE SET NULL,
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  location_name VARCHAR(255) NOT NULL,
  location_lat NUMERIC(10,8),
  location_lng NUMERIC(11,8),
  stop_time TIMESTAMPTZ DEFAULT NOW(),
  weight_recorded_tonnes NUMERIC(6,2),
  gvw_limit_tonnes NUMERIC(6,2),
  state_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pass' CHECK (status IN ('pass','overloaded','fined')),
  fine_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT
);

-- ── 15. State crossings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS state_crossings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journey_log_id UUID REFERENCES journey_logs(id) ON DELETE SET NULL,
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  from_state VARCHAR(100),
  to_state VARCHAR(100),
  crossing_lat NUMERIC(10,8),
  crossing_lng NUMERIC(11,8),
  crossing_time TIMESTAMPTZ DEFAULT NOW(),
  naka_type VARCHAR(30) DEFAULT 'border',
  entry_tax_paid NUMERIC(10,2) DEFAULT 0
);

-- ── 16. Trip breaks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_breaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journey_log_id UUID REFERENCES journey_logs(id) ON DELETE SET NULL,
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  break_type VARCHAR(20) NOT NULL CHECK (break_type IN ('rest','fuel','meal','washroom')),
  location_name VARCHAR(255),
  location_lat NUMERIC(10,8),
  location_lng NUMERIC(11,8),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT
);

-- ── 17. Break suggestions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS break_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journey_log_id UUID REFERENCES journey_logs(id) ON DELETE SET NULL,
  load_id VARCHAR(50) REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  break_type VARCHAR(20) NOT NULL,
  reason TEXT,
  compliance_rule VARCHAR(50),
  priority INTEGER DEFAULT 3,
  accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'V2 migrations applied successfully' AS result;
