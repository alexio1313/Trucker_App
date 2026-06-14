-- Migration 006: Loader workers
CREATE TABLE IF NOT EXISTS loader_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES loader_companies(id),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(15),
  aadhaar_number_hash VARCHAR(64),
  aadhaar_verified BOOLEAN DEFAULT FALSE,
  photo_url VARCHAR(500),
  skill_tags TEXT[] DEFAULT ARRAY['general'],
  status VARCHAR(20) DEFAULT 'active',
  total_assignments INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
