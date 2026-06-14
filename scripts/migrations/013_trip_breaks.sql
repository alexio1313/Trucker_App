-- Migration 013: Trip breaks and break suggestions
CREATE TABLE IF NOT EXISTS trip_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  load_id VARCHAR(50),
  break_type VARCHAR(50) NOT NULL,
  location_name VARCHAR(255),
  location_lat DECIMAL(10,6),
  location_lng DECIMAL(10,6),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_minutes INT,
  cost_impact JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS break_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_log_id UUID NOT NULL REFERENCES journey_logs(id),
  break_type VARCHAR(50) NOT NULL,
  suggested_km DECIMAL(8,1),
  location_name VARCHAR(255),
  location_lat DECIMAL(10,6),
  location_lng DECIMAL(10,6),
  reason VARCHAR(255),
  compliance_rule VARCHAR(100),
  priority INT DEFAULT 3,
  accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMP,
  skipped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
