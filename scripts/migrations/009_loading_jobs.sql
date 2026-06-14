-- Migration 009: Loading jobs
ALTER TABLE loads ADD COLUMN IF NOT EXISTS loading_arrangement VARCHAR(30) DEFAULT 'merchant_arranged';
ALTER TABLE loads ADD COLUMN IF NOT EXISTS detention_rate_per_hour DECIMAL(8,2) DEFAULT 75;

CREATE TABLE IF NOT EXISTS loading_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id VARCHAR(50) NOT NULL,
  arrangement_type VARCHAR(30) NOT NULL,
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
