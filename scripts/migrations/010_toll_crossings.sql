-- Migration 010: Toll crossings per journey
CREATE TABLE IF NOT EXISTS toll_crossings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50) NOT NULL,
  plaza_name VARCHAR(255) NOT NULL,
  plaza_lat DECIMAL(10,6),
  plaza_lng DECIMAL(10,6),
  highway_code VARCHAR(20),
  state_name VARCHAR(100),
  crossing_time TIMESTAMP NOT NULL,
  amount_paid DECIMAL(8,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'fastag',
  fastag_transaction_id VARCHAR(100),
  vehicle_category VARCHAR(20),
  source VARCHAR(20) DEFAULT 'gps_inferred',
  created_at TIMESTAMP DEFAULT NOW()
);
