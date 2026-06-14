-- Migration 012: State border crossings
CREATE TABLE IF NOT EXISTS state_crossings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50) NOT NULL,
  from_state VARCHAR(100),
  to_state VARCHAR(100),
  crossing_lat DECIMAL(10,6),
  crossing_lng DECIMAL(10,6),
  crossing_time TIMESTAMP NOT NULL,
  naka_type VARCHAR(50) DEFAULT 'border',
  entry_tax_paid DECIMAL(8,2) DEFAULT 0,
  document_checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
