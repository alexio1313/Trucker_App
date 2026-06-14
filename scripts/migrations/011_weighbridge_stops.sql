-- Migration 011: Weighbridge stops
CREATE TABLE IF NOT EXISTS weighbridge_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50) NOT NULL,
  location_name VARCHAR(255),
  location_lat DECIMAL(10,6),
  location_lng DECIMAL(10,6),
  state_name VARCHAR(100),
  stop_time TIMESTAMP NOT NULL,
  weight_recorded_tonnes DECIMAL(8,2),
  gvw_limit_tonnes DECIMAL(8,2),
  status VARCHAR(20) DEFAULT 'pass',
  fine_amount DECIMAL(10,2),
  receipt_photo_url VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
