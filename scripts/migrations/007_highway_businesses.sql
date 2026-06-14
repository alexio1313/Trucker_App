-- Migration 007: Highway businesses
CREATE TABLE IF NOT EXISTS highway_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  business_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  phone VARCHAR(15),
  gst_number VARCHAR(15),
  gst_verified BOOLEAN DEFAULT FALSE,
  fssai_number VARCHAR(15),
  fssai_verified BOOLEAN DEFAULT FALSE,
  location_lat DECIMAL(10,6) NOT NULL,
  location_lng DECIMAL(10,6) NOT NULL,
  location GEOMETRY(POINT, 4326),
  address TEXT,
  highway_name VARCHAR(50),
  verified_on_highway BOOLEAN DEFAULT FALSE,
  facilities JSONB DEFAULT '{}'::jsonb,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  subscription_tier VARCHAR(20) DEFAULT 'free',
  subscription_expires_at TIMESTAMP,
  ad_credits_balance DECIMAL(10,2) DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  is_open_24hr BOOLEAN DEFAULT FALSE,
  current_status VARCHAR(20) DEFAULT 'open',
  is_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highway_biz_location ON highway_businesses USING GIST(location);

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
