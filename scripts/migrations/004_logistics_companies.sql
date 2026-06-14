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
  subscription_expires_at TIMESTAMP,
  own_fleet_count INT DEFAULT 0,
  service_areas TEXT[],
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
