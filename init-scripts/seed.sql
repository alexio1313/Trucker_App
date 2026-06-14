-- =============================================================
-- SEED DATA — India-based test data for QA
-- Bangalore → Delhi route testing
-- =============================================================

-- Admin user (password: Admin@123)
INSERT INTO users (user_id, user_type, full_name, phone_number, password_hash, kyc_status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin',
  'Admin User',
  '+919000000001',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy',
  'verified'
) ON CONFLICT (user_id) DO NOTHING;

-- Merchant users (Bangalore)
INSERT INTO users (user_id, user_type, full_name, phone_number, password_hash, kyc_status, gst_number)
VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  'merchant',
  'Rajesh Kumar Textiles',
  '+919880001001',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy',
  'verified',
  '29ABCDE1234F1Z5'
),
(
  'b0000000-0000-0000-0000-000000000002',
  'merchant',
  'Priya Exports Pvt Ltd',
  '+919880001002',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy',
  'pending',
  '29XYZAB5678G2H6'
) ON CONFLICT (user_id) DO NOTHING;

-- Trucker users (Bangalore, password: Trucker@123)
INSERT INTO users (user_id, user_type, full_name, phone_number, password_hash, kyc_status)
VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  'trucker',
  'Suresh Verma',
  '+919770001001',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy',
  'verified'
),
(
  'c0000000-0000-0000-0000-000000000002',
  'trucker',
  'Ramu Naidu',
  '+919770001002',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy',
  'verified'
),
(
  'c0000000-0000-0000-0000-000000000003',
  'trucker',
  'Mohan Singh',
  '+919770001003',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy',
  'pending'
) ON CONFLICT (user_id) DO NOTHING;

-- Trucks for truckers (Bangalore GPS coordinates)
INSERT INTO trucks (truck_id, trucker_id, registration_no, truck_type, capacity_kg, status, current_lat, current_lng, last_location_at)
VALUES
(
  'd0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'KA01AB1234',
  'heavy',
  15000,
  'available',
  12.9716,
  77.5946,
  NOW()
),
(
  'd0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000002',
  'KA05CD5678',
  'medium',
  8000,
  'available',
  12.9352,
  77.6245,
  NOW()
),
(
  'd0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000003',
  'KA03EF9012',
  'heavy',
  25000,
  'on_load',
  13.0067,
  77.5667,
  NOW()
) ON CONFLICT (truck_id) DO NOTHING;

-- Sample loads: Bangalore → Delhi
INSERT INTO loads (
  load_id, merchant_id, status,
  origin_address, origin_city, origin_state, origin_lat, origin_lng,
  dest_address, dest_city, dest_state, dest_lat, dest_lng,
  cargo_weight_kg, cargo_type,
  pickup_start, pickup_end, delivery_expected,
  distance_km, agreed_price
)
VALUES
(
  'e0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'posted',
  'Peenya Industrial Area, Bangalore',
  'Bangalore', 'Karnataka',
  13.0300, 77.5200,
  'Okhla Industrial Estate, New Delhi',
  'Delhi', 'Delhi',
  28.5355, 77.2910,
  12000, 'general',
  NOW() + interval '2 hours',
  NOW() + interval '6 hours',
  NOW() + interval '4 days',
  2150,
  NULL
),
(
  'e0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000001',
  'in_transit',
  'Whitefield, Bangalore',
  'Bangalore', 'Karnataka',
  12.9698, 77.7499,
  'Connaught Place, New Delhi',
  'Delhi', 'Delhi',
  28.6315, 77.2167,
  3500, 'fragile',
  NOW() - interval '4 hours',
  NOW() - interval '2 hours',
  NOW() + interval '2 days',
  2180,
  22500
),
(
  'e0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000002',
  'delivered',
  'Bommanahalli, Bangalore',
  'Bangalore', 'Karnataka',
  12.8997, 77.6161,
  'Gurgaon Sector 18, Haryana',
  'Delhi', 'Haryana',
  28.4741, 77.0726,
  18000, 'general',
  NOW() - interval '5 days',
  NOW() - interval '4 days',
  NOW() - interval '1 day',
  2120,
  63000
) ON CONFLICT (load_id) DO NOTHING;

-- Assign trucker to in_transit load
UPDATE loads
SET trucker_id = 'c0000000-0000-0000-0000-000000000001',
    truck_id   = 'd0000000-0000-0000-0000-000000000001'
WHERE load_id = 'e0000000-0000-0000-0000-000000000002';

-- Update truck status for in_transit load
UPDATE trucks SET status = 'on_load'
WHERE truck_id = 'd0000000-0000-0000-0000-000000000001';

-- Tracking events for in_transit load (Bangalore → Delhi journey via NH44)
INSERT INTO load_tracking (load_id, event_type, timestamp, latitude, longitude, truck_id)
VALUES
('e0000000-0000-0000-0000-000000000002', 'pickup_start',   NOW() - interval '4 hours', 12.9698, 77.7499, 'd0000000-0000-0000-0000-000000000001'),
('e0000000-0000-0000-0000-000000000002', 'loading_complete', NOW() - interval '3.5 hours', 12.9698, 77.7499, 'd0000000-0000-0000-0000-000000000001'),
('e0000000-0000-0000-0000-000000000002', 'in_transit',     NOW() - interval '3 hours', 13.3409, 77.1173, 'd0000000-0000-0000-0000-000000000001'),
('e0000000-0000-0000-0000-000000000002', 'in_transit',     NOW() - interval '2 hours', 14.4644, 77.8166, 'd0000000-0000-0000-0000-000000000001'),
('e0000000-0000-0000-0000-000000000002', 'in_transit',     NOW() - interval '1 hour',  17.3850, 78.4867, 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Feature flags (flag_value is BOOLEAN)
INSERT INTO feature_flags (flag_key, flag_value, description, updated_by)
VALUES
('ai_pricing',           true, 'Enable AI-powered surge pricing',          'a0000000-0000-0000-0000-000000000001'),
('fraud_detection',      true, 'Enable ML fraud detection',                'a0000000-0000-0000-0000-000000000001'),
('social_publishing',    true, 'Enable social media auto-post',             'a0000000-0000-0000-0000-000000000001'),
('ollama_fallback',      true, 'Use Ollama as Claude fallback',             'a0000000-0000-0000-0000-000000000001'),
('blockade_detection',   true, 'Enable road blockade crowdsourcing',        'a0000000-0000-0000-0000-000000000001'),
('route_optimization',   true, 'Enable AI route optimizer',                 'a0000000-0000-0000-0000-000000000001'),
('surge_pricing',        true, 'Enable dynamic surge pricing',              'a0000000-0000-0000-0000-000000000001'),
('kyc_verification',     true, 'Enable automated KYC review',               'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (flag_key) DO NOTHING;
