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
