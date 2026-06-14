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
