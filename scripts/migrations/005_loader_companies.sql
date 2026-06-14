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
