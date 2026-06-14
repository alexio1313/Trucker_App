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
