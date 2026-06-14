-- =============================================================
-- AI TRUCK LOGISTICS PLATFORM - PostgreSQL Schema
-- All 15 tables with indexes, constraints, and soft-delete
-- =============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";   -- for geo queries

-- =============================================================
-- TABLE 1: USERS
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_type     VARCHAR(10) NOT NULL CHECK (user_type IN ('merchant', 'trucker', 'admin')),
  full_name     VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE,
  phone_number  VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  kyc_status    VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  kyc_doc_front_url  VARCHAR(500),
  kyc_doc_back_url   VARCHAR(500),
  kyc_reviewed_at    TIMESTAMP,
  kyc_reviewed_by    UUID,
  bank_account       JSONB,           -- encrypted: {account_number, ifsc, beneficiary_name}
  gst_number         VARCHAR(15),
  pan_number         VARCHAR(10),
  rating             DECIMAL(3,2) DEFAULT 5.00 CHECK (rating BETWEEN 1 AND 5),
  total_ratings      INT DEFAULT 0,
  commission_rate    DECIMAL(4,2) DEFAULT 5.00,  -- custom rate override (default 5%)
  is_suspended       BOOLEAN DEFAULT FALSE,
  suspended_until    TIMESTAMP,
  suspension_reason  TEXT,
  fcm_token          VARCHAR(500),
  last_login_at      TIMESTAMP,
  profile_photo_url  VARCHAR(500),
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at         TIMESTAMP
);

-- =============================================================
-- TABLE 2: TRUCKS
-- =============================================================
CREATE TABLE IF NOT EXISTS trucks (
  truck_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trucker_id       UUID NOT NULL REFERENCES users(user_id),
  registration_no  VARCHAR(50) NOT NULL UNIQUE,
  make             VARCHAR(100),
  model            VARCHAR(100),
  year             INT,
  capacity_kg      INT NOT NULL,
  volume_cbm       DECIMAL(8,2),
  truck_type       VARCHAR(20) NOT NULL
                     CHECK (truck_type IN ('mini', 'light', 'medium', 'heavy', 'trailer')),
  fuel_type        VARCHAR(10) DEFAULT 'diesel'
                     CHECK (fuel_type IN ('diesel', 'petrol', 'cng', 'electric')),
  mileage_kmpl     DECIMAL(5,2),
  insurance_no     VARCHAR(100),
  insurance_expiry DATE,
  permit_no        VARCHAR(100),
  permit_expiry    DATE,
  fitness_expiry   DATE,
  status           VARCHAR(20) DEFAULT 'available'
                     CHECK (status IN ('available', 'on_load', 'maintenance', 'inactive')),
  current_lat      DECIMAL(10,8),
  current_lng      DECIMAL(11,8),
  last_location_at TIMESTAMP,
  photos           JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMP
);

-- =============================================================
-- TABLE 3: LOADS
-- =============================================================
CREATE TABLE IF NOT EXISTS loads (
  load_id              VARCHAR(50) PRIMARY KEY,   -- e.g. LD_2026_001234
  merchant_id          UUID NOT NULL REFERENCES users(user_id),
  trucker_id           UUID REFERENCES users(user_id),
  truck_id             UUID REFERENCES trucks(truck_id),

  -- Origin
  origin_lat           DECIMAL(10,8) NOT NULL,
  origin_lng           DECIMAL(11,8) NOT NULL,
  origin_address       VARCHAR(500) NOT NULL,
  origin_city          VARCHAR(100),
  origin_state         VARCHAR(100),
  origin_contact_name  VARCHAR(255),
  origin_contact_phone VARCHAR(20),

  -- Destination
  dest_lat             DECIMAL(10,8) NOT NULL,
  dest_lng             DECIMAL(11,8) NOT NULL,
  dest_address         VARCHAR(500) NOT NULL,
  dest_city            VARCHAR(100),
  dest_state           VARCHAR(100),
  dest_contact_name    VARCHAR(255),
  dest_contact_phone   VARCHAR(20),

  -- Cargo
  cargo_weight_kg      INT NOT NULL,
  cargo_volume_cbm     DECIMAL(8,2),
  cargo_type           VARCHAR(30) NOT NULL DEFAULT 'general'
                         CHECK (cargo_type IN ('general','fragile','hazmat','temperature_controlled','liquid','oversized')),
  special_requirements TEXT,
  cargo_photos         JSONB,

  -- Timing
  pickup_start         TIMESTAMP NOT NULL,
  pickup_end           TIMESTAMP NOT NULL,
  delivery_expected    TIMESTAMP NOT NULL,
  loading_time_minutes INT NOT NULL DEFAULT 30,
  unloading_time_minutes INT NOT NULL DEFAULT 45,

  -- Pricing
  agreed_price         DECIMAL(12,2),
  platform_commission  DECIMAL(12,2),
  commission_percent   DECIMAL(4,2) DEFAULT 5.00,
  fuel_cost_estimate   DECIMAL(10,2),
  toll_cost_estimate   DECIMAL(10,2),
  waiting_charges      DECIMAL(10,2) DEFAULT 0,
  waiting_charge_rate  DECIMAL(8,2) DEFAULT 10.00,  -- per minute
  net_trucker_earning  DECIMAL(12,2),
  distance_km          DECIMAL(8,2),
  ai_suggested_price   DECIMAL(12,2),
  surge_multiplier     DECIMAL(4,2) DEFAULT 1.00,

  -- Status
  status               VARCHAR(20) NOT NULL DEFAULT 'posted'
                         CHECK (status IN ('posted','accepted','loading','in_transit','delivered','cancelled','disputed')),
  cancellation_reason  TEXT,
  cancelled_by         UUID REFERENCES users(user_id),

  -- Delivery confirmation
  pod_photo_url        VARCHAR(500),
  delivery_confirmed_at TIMESTAMP,
  delivery_confirmed_by UUID,

  -- Geolocation (PostGIS point types for fast geo queries)
  origin_location      GEOGRAPHY(Point, 4326),
  dest_location        GEOGRAPHY(Point, 4326),

  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMP
);

-- =============================================================
-- TABLE 4: LOAD_TRACKING (Time-series GPS data)
-- =============================================================
CREATE TABLE IF NOT EXISTS load_tracking (
  tracking_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id        VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  event_type     VARCHAR(30) NOT NULL
                   CHECK (event_type IN (
                     'pickup_start','loading_start','loading_complete',
                     'departure','in_transit','blockade_detected',
                     'route_deviation','arrival','unloading_start','unloading_complete'
                   )),
  timestamp      TIMESTAMP NOT NULL DEFAULT NOW(),
  latitude       DECIMAL(10,8),
  longitude      DECIMAL(11,8),
  accuracy_meters INT,
  speed_kmh      DECIMAL(6,2),
  heading        DECIMAL(5,2),
  altitude       DECIMAL(8,2),
  truck_id       UUID REFERENCES trucks(truck_id),
  additional_data JSONB
);

-- =============================================================
-- TABLE 5: PRICING_HISTORY
-- =============================================================
CREATE TABLE IF NOT EXISTS pricing_history (
  pricing_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id               VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  calculation_method    VARCHAR(20) NOT NULL
                          CHECK (calculation_method IN ('ml_model','manual_override','special_rate','default')),
  base_distance_cost    DECIMAL(12,2),
  fuel_cost_estimate    DECIMAL(10,2),
  toll_cost_estimate    DECIMAL(10,2),
  surge_multiplier      DECIMAL(4,2) DEFAULT 1.00,
  surge_reason          TEXT,
  special_cargo_premium DECIMAL(10,2) DEFAULT 0,
  merchant_discount     DECIMAL(10,2) DEFAULT 0,
  platform_commission   DECIMAL(10,2),
  final_price           DECIMAL(12,2),
  price_locked_until    TIMESTAMP,
  ai_model_version      VARCHAR(50),
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 6: SLA_TRACKING
-- =============================================================
CREATE TABLE IF NOT EXISTS sla_tracking (
  sla_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id               VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  event_type            VARCHAR(20) NOT NULL
                          CHECK (event_type IN ('loading','unloading')),
  allowed_time_minutes  INT NOT NULL,
  actual_time_minutes   INT,
  start_time            TIMESTAMP,
  end_time              TIMESTAMP,
  violation_flag        BOOLEAN DEFAULT FALSE,
  violation_minutes     INT DEFAULT 0,
  waiting_charges       DECIMAL(10,2) DEFAULT 0,
  merchant_approved     BOOLEAN,
  merchant_approval_at  TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 7: TOLL_CHARGES
-- =============================================================
CREATE TABLE IF NOT EXISTS toll_charges (
  toll_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id        VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  toll_gate_name VARCHAR(255) NOT NULL,
  toll_gate_lat  DECIMAL(10,8),
  toll_gate_lng  DECIMAL(11,8),
  highway_name   VARCHAR(100),
  toll_operator  VARCHAR(100),
  estimated_charge DECIMAL(8,2),
  actual_charge  DECIMAL(8,2),
  payment_method VARCHAR(20) DEFAULT 'fasttag'
                   CHECK (payment_method IN ('fasttag','cash','card')),
  payment_status VARCHAR(20) DEFAULT 'pending'
                   CHECK (payment_status IN ('pending','completed','failed','reimbursed')),
  receipt_url    VARCHAR(500),
  passed_at      TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 8: PAYMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id            VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  merchant_id        UUID NOT NULL REFERENCES users(user_id),
  trucker_id         UUID REFERENCES users(user_id),
  payment_type       VARCHAR(20) NOT NULL
                       CHECK (payment_type IN ('load_payment','waiting_charge','toll_reimbursement','bonus','penalty','refund')),
  amount             DECIMAL(12,2) NOT NULL,
  currency           VARCHAR(3) DEFAULT 'INR',
  gateway            VARCHAR(20) DEFAULT 'razorpay'
                       CHECK (gateway IN ('razorpay','stripe','manual')),
  gateway_payment_id VARCHAR(255),
  gateway_order_id   VARCHAR(255),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','completed','failed','refunded')),
  failure_reason     TEXT,
  metadata           JSONB,
  initiated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMP,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 9: RATINGS
-- =============================================================
CREATE TABLE IF NOT EXISTS ratings (
  rating_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id       VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  rater_id      UUID NOT NULL REFERENCES users(user_id),
  ratee_id      UUID NOT NULL REFERENCES users(user_id),
  rating_type   VARCHAR(20) NOT NULL
                  CHECK (rating_type IN ('merchant_rates_trucker','trucker_rates_merchant')),
  score         DECIMAL(3,2) NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment       TEXT,
  tags          JSONB,      -- ['on_time','professional','good_communication']
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (load_id, rater_id, ratee_id)
);

-- =============================================================
-- TABLE 10: DISPUTES
-- =============================================================
CREATE TABLE IF NOT EXISTS disputes (
  dispute_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id          VARCHAR(50) NOT NULL REFERENCES loads(load_id),
  raised_by        UUID NOT NULL REFERENCES users(user_id),
  raised_against   UUID NOT NULL REFERENCES users(user_id),
  dispute_type     VARCHAR(30) NOT NULL
                     CHECK (dispute_type IN (
                       'payment_issue','waiting_charge','damage','late_delivery',
                       'no_show','cargo_mismatch','communication','other'
                     )),
  description      TEXT NOT NULL,
  evidence_urls    JSONB,
  priority         VARCHAR(10) DEFAULT 'medium'
                     CHECK (priority IN ('low','medium','high','critical')),
  status           VARCHAR(20) NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','under_review','resolved','escalated','closed')),
  assigned_to      UUID REFERENCES users(user_id),  -- admin handling it
  ai_suggestion    TEXT,
  ai_confidence    DECIMAL(3,2),
  resolution_type  VARCHAR(30)
                     CHECK (resolution_type IN ('full_refund','partial_refund','no_action','escalated','compensation')),
  resolution_amount DECIMAL(12,2),
  resolution_notes  TEXT,
  resolved_at       TIMESTAMP,
  resolved_by       UUID REFERENCES users(user_id),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 11: NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(user_id),     -- null = broadcast
  user_type_target VARCHAR(10)
                     CHECK (user_type_target IN ('merchant','trucker','admin','all')),
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  deep_link       VARCHAR(500),
  notification_type VARCHAR(30) NOT NULL
                     CHECK (notification_type IN (
                       'load_accepted','load_update','payment','sla_alert',
                       'blockade','chat','fraud_alert','kyc_update','broadcast','system'
                     )),
  channel         VARCHAR(10) NOT NULL DEFAULT 'push'
                     CHECK (channel IN ('push','sms','email','in_app')),
  status          VARCHAR(20) DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','delivered','failed','read')),
  fcm_message_id  VARCHAR(255),
  read_at         TIMESTAMP,
  sent_at         TIMESTAMP,
  metadata        JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 12: AUDIT_LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID NOT NULL REFERENCES users(user_id),
  action        VARCHAR(50) NOT NULL,
  entity_type   VARCHAR(50) NOT NULL,     -- 'user','load','dispute','payment'
  entity_id     VARCHAR(100) NOT NULL,
  before_state  JSONB,
  after_state   JSONB,
  ip_address    INET,
  user_agent    VARCHAR(500),
  request_id    VARCHAR(100),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 13: SOCIAL_POSTS
-- =============================================================
CREATE TABLE IF NOT EXISTS social_posts (
  post_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  load_id        VARCHAR(50) REFERENCES loads(load_id),
  created_by     UUID NOT NULL REFERENCES users(user_id),
  platforms      JSONB NOT NULL,        -- ['facebook','instagram','twitter']
  caption        TEXT,
  hashtags       TEXT,
  description    TEXT,
  media_urls     JSONB,
  llm_used       VARCHAR(20)
                   CHECK (llm_used IN ('ollama','claude','gpt','manual')),
  platform_results JSONB,               -- {facebook: {post_id, url, status}, ...}
  scheduled_for  TIMESTAMP,
  published_at   TIMESTAMP,
  analytics      JSONB,                 -- {likes, shares, reach, clicks}
  analytics_at   TIMESTAMP,
  status         VARCHAR(20) DEFAULT 'draft'
                   CHECK (status IN ('draft','scheduled','published','failed')),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 14: FRAUD_ALERTS
-- =============================================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
  alert_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(user_id),
  load_id        VARCHAR(50) REFERENCES loads(load_id),
  payment_id     UUID REFERENCES payments(payment_id),
  alert_type     VARCHAR(30) NOT NULL
                   CHECK (alert_type IN (
                     'unusual_price','rapid_cancel','ip_mismatch',
                     'device_anomaly','location_jump','payment_fraud',
                     'fake_account','duplicate_load','rating_manipulation'
                   )),
  risk_score     DECIMAL(5,2) NOT NULL,   -- 0-100
  risk_factors   JSONB,                   -- list of triggered features
  action_taken   VARCHAR(20) DEFAULT 'flagged'
                   CHECK (action_taken IN ('flagged','held','blocked','dismissed','escalated')),
  reviewed_by    UUID REFERENCES users(user_id),
  reviewed_at    TIMESTAMP,
  review_notes   TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================
-- TABLE 15: FEATURE_FLAGS
-- =============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_key      VARCHAR(100) NOT NULL UNIQUE,
  flag_value    BOOLEAN NOT NULL DEFAULT TRUE,
  description   TEXT,
  updated_by    UUID REFERENCES users(user_id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default feature flags
INSERT INTO feature_flags (flag_key, flag_value, description) VALUES
  ('enable_ai_pricing', true, 'Use ML model for dynamic pricing'),
  ('enable_fraud_detection', true, 'Run fraud scoring on transactions'),
  ('enable_social_publishing', true, 'Allow one-click social media publishing'),
  ('enable_ollama_fallback', true, 'Fall back to Ollama if Claude API fails'),
  ('enable_blockade_detection', true, 'Poll traffic APIs for road blockades'),
  ('enable_surge_pricing', true, 'Apply surge multiplier in high demand periods'),
  ('enable_kyc_required', true, 'Require KYC before accepting loads'),
  ('maintenance_mode', false, 'Put platform in maintenance mode')
ON CONFLICT (flag_key) DO NOTHING;

-- =============================================================
-- PERFORMANCE INDEXES
-- =============================================================

-- users
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone        ON users(phone_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_type         ON users(user_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_kyc          ON users(kyc_status) WHERE deleted_at IS NULL;

-- trucks
CREATE INDEX IF NOT EXISTS idx_trucks_trucker     ON trucks(trucker_id, status);
CREATE INDEX IF NOT EXISTS idx_trucks_status      ON trucks(status) WHERE deleted_at IS NULL;

-- loads  (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_loads_merchant     ON loads(merchant_id) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_loads_trucker      ON loads(trucker_id) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_loads_status_date  ON loads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loads_origin_geo   ON loads USING GIST(origin_location);
CREATE INDEX IF NOT EXISTS idx_loads_dest_geo     ON loads USING GIST(dest_location);
CREATE INDEX IF NOT EXISTS idx_loads_pickup_start ON loads(pickup_start) WHERE status = 'posted';

-- load_tracking (time-series — very high write volume)
CREATE INDEX IF NOT EXISTS idx_tracking_load_ts   ON load_tracking(load_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_event     ON load_tracking(load_id, event_type);

-- pricing_history
CREATE INDEX IF NOT EXISTS idx_pricing_load       ON pricing_history(load_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_load      ON payments(load_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_merchant  ON payments(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_trucker   ON payments(trucker_id, status);

-- fraud_alerts
CREATE INDEX IF NOT EXISTS idx_fraud_user_ts      ON fraud_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_score        ON fraud_alerts(risk_score DESC) WHERE action_taken = 'flagged';

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_user         ON notifications(user_id, status, created_at DESC);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_admin        ON audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON audit_logs(entity_type, entity_id, created_at DESC);

-- disputes
CREATE INDEX IF NOT EXISTS idx_disputes_load      ON disputes(load_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status    ON disputes(status, priority, created_at DESC);

-- =============================================================
-- AUTO-UPDATE updated_at trigger
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_loads_updated_at
  BEFORE UPDATE ON loads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_trucks_updated_at
  BEFORE UPDATE ON trucks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON social_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- LOAD ID SEQUENCE GENERATOR
-- =============================================================
CREATE SEQUENCE IF NOT EXISTS load_id_seq START 1000;

CREATE OR REPLACE FUNCTION generate_load_id()
RETURNS VARCHAR AS $$
DECLARE
  year_part TEXT;
  seq_part  TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  seq_part  := LPAD(nextval('load_id_seq')::TEXT, 6, '0');
  RETURN 'LD_' || year_part || '_' || seq_part;
END;
$$ LANGUAGE plpgsql;
