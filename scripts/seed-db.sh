#!/bin/bash
# =============================================================
# AI TRUCK LOGISTICS PLATFORM - Database Seed Script
# Inserts realistic test data for development
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo -e "${BLUE}🌱 Seeding database with test data...${NC}"

# ==================== PostgreSQL SEED ====================
echo -e "${YELLOW}  Seeding PostgreSQL...${NC}"

docker compose exec -T postgres psql -U app_user -d truck_platform << 'EOSQL'

-- =====================
-- SEED ADMIN USER
-- =====================
INSERT INTO users (user_id, user_type, full_name, email, phone_number, password_hash, kyc_status, rating)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Platform Admin', 'admin@truckplatform.com',
   '+919999999999', '$2b$10$dev_hash_admin', 'verified', 5.00)
ON CONFLICT (phone_number) DO NOTHING;

-- =====================
-- SEED MERCHANT USERS
-- =====================
INSERT INTO users (user_id, user_type, full_name, email, phone_number, password_hash, kyc_status, gst_number, rating)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'merchant', 'Raj Kumar Exports', 'raj@rajexports.com',
   '+919876543210', '$2b$10$dev_hash_merch1', 'verified', '29ABCDE1234F1Z5', 4.80),
  ('00000000-0000-0000-0000-000000000011', 'merchant', 'Delhi Goods Corp', 'info@delhigoods.com',
   '+919876543211', '$2b$10$dev_hash_merch2', 'verified', '07ABCDE5678F2Z6', 4.60),
  ('00000000-0000-0000-0000-000000000012', 'merchant', 'Mumbai Electronics Ltd', 'ops@mumbaielec.com',
   '+919876543212', '$2b$10$dev_hash_merch3', 'pending', NULL, 5.00)
ON CONFLICT (phone_number) DO NOTHING;

-- =====================
-- SEED TRUCKER USERS
-- =====================
INSERT INTO users (user_id, user_type, full_name, email, phone_number, password_hash, kyc_status, rating)
VALUES
  ('00000000-0000-0000-0000-000000000020', 'trucker', 'Ramesh Singh', 'ramesh@gmail.com',
   '+919123456781', '$2b$10$dev_hash_truck1', 'verified', 4.90),
  ('00000000-0000-0000-0000-000000000021', 'trucker', 'Suresh Yadav', 'suresh@gmail.com',
   '+919123456782', '$2b$10$dev_hash_truck2', 'verified', 4.70),
  ('00000000-0000-0000-0000-000000000022', 'trucker', 'Mahesh Patil', 'mahesh@gmail.com',
   '+919123456783', '$2b$10$dev_hash_truck3', 'verified', 4.50),
  ('00000000-0000-0000-0000-000000000023', 'trucker', 'Dinesh Kumar', 'dinesh@gmail.com',
   '+919123456784', '$2b$10$dev_hash_truck4', 'pending', 5.00)
ON CONFLICT (phone_number) DO NOTHING;

-- =====================
-- SEED TRUCKS
-- =====================
INSERT INTO trucks (truck_id, trucker_id, registration_no, make, model, year, capacity_kg, volume_cbm, truck_type, mileage_kmpl, status, current_lat, current_lng)
VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020',
   'DL01AB1234', 'Tata', 'Prima 4028.S', 2022, 28000, 72.0, 'heavy', 4.5, 'available', 28.6139, 77.2090),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000021',
   'MH02CD5678', 'Ashok Leyland', 'Captain 3518', 2021, 18000, 45.0, 'medium', 5.2, 'available', 19.0760, 72.8777),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000022',
   'KA03EF9012', 'Eicher', 'Pro 3015', 2023, 8000, 22.0, 'light', 8.0, 'available', 12.9716, 77.5946),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000021',
   'UP04GH3456', 'Mahindra', 'Furio 17', 2020, 7000, 18.5, 'light', 9.0, 'on_load', 26.8467, 80.9462)
ON CONFLICT (registration_no) DO NOTHING;

-- =====================
-- SEED LOADS
-- =====================
INSERT INTO loads (load_id, merchant_id, origin_lat, origin_lng, origin_address, origin_city, origin_state,
  dest_lat, dest_lng, dest_address, dest_city, dest_state,
  cargo_weight_kg, cargo_type,
  pickup_start, pickup_end, delivery_expected,
  loading_time_minutes, unloading_time_minutes,
  agreed_price, platform_commission, commission_percent,
  fuel_cost_estimate, toll_cost_estimate, net_trucker_earning,
  distance_km, status, surge_multiplier,
  origin_location, dest_location)
VALUES
  -- Load 1: Delhi to Nagpur (posted)
  ('LD_2026_001001', '00000000-0000-0000-0000-000000000010',
   28.6139, 77.2090, 'Delhi Port, Connaught Place', 'Delhi', 'Delhi',
   21.1458, 79.0882, 'Nagpur Central Warehouse', 'Nagpur', 'Maharashtra',
   5000, 'electronics',
   NOW() + INTERVAL '1 hour', NOW() + INTERVAL '8 hours', NOW() + INTERVAL '30 hours',
   30, 45,
   42750, 2137.50, 5.00,
   8200, 2100, 30362.50,
   892.0, 'posted', 1.00,
   ST_GeogFromText('POINT(77.2090 28.6139)'), ST_GeogFromText('POINT(79.0882 21.1458)')),

  -- Load 2: Mumbai to Bangalore (accepted - in transit)
  ('LD_2026_001002', '00000000-0000-0000-0000-000000000011',
   19.0760, 72.8777, 'Mumbai JNPT Port, Nhava Sheva', 'Mumbai', 'Maharashtra',
   12.9716, 77.5946, 'Whitefield Tech Park Warehouse', 'Bangalore', 'Karnataka',
   8000, 'general',
   NOW() - INTERVAL '5 hours', NOW() + INTERVAL '3 hours', NOW() + INTERVAL '20 hours',
   60, 90,
   65000, 3250.00, 5.00,
   12500, 3800, 45750.00,
   984.0, 'in_transit', 1.15,
   ST_GeogFromText('POINT(72.8777 19.0760)'), ST_GeogFromText('POINT(77.5946 12.9716)')),

  -- Load 3: Chennai to Hyderabad (posted)
  ('LD_2026_001003', '00000000-0000-0000-0000-000000000010',
   13.0827, 80.2707, 'Chennai Port Trust', 'Chennai', 'Tamil Nadu',
   17.3850, 78.4867, 'Hyderabad Industrial Estate', 'Hyderabad', 'Telangana',
   3000, 'fragile',
   NOW() + INTERVAL '2 hours', NOW() + INTERVAL '10 hours', NOW() + INTERVAL '18 hours',
   45, 60,
   28500, 1425.00, 5.00,
   5200, 1500, 20375.00,
   628.0, 'posted', 1.00,
   ST_GeogFromText('POINT(80.2707 13.0827)'), ST_GeogFromText('POINT(78.4867 17.3850)'))
ON CONFLICT (load_id) DO NOTHING;

-- =====================
-- SEED LOAD TRACKING
-- =====================
INSERT INTO load_tracking (load_id, event_type, timestamp, latitude, longitude, speed_kmh, truck_id)
VALUES
  ('LD_2026_001002', 'pickup_start',       NOW() - INTERVAL '5 hours',  19.0760, 72.8777, 0,    '00000000-0000-0000-0000-000000000031'),
  ('LD_2026_001002', 'loading_start',      NOW() - INTERVAL '4.8 hours', 19.0760, 72.8777, 0,   '00000000-0000-0000-0000-000000000031'),
  ('LD_2026_001002', 'loading_complete',   NOW() - INTERVAL '4 hours',  19.0760, 72.8777, 0,    '00000000-0000-0000-0000-000000000031'),
  ('LD_2026_001002', 'departure',          NOW() - INTERVAL '3.9 hours', 19.0890, 72.8910, 45,  '00000000-0000-0000-0000-000000000031'),
  ('LD_2026_001002', 'in_transit',         NOW() - INTERVAL '2 hours',  17.8500, 75.1500, 72,   '00000000-0000-0000-0000-000000000031'),
  ('LD_2026_001002', 'in_transit',         NOW() - INTERVAL '1 hour',   15.8700, 76.4500, 68,   '00000000-0000-0000-0000-000000000031');

-- =====================
-- SEED FEATURE FLAGS (ensure they exist)
-- =====================
INSERT INTO feature_flags (flag_key, flag_value, description)
VALUES
  ('enable_ai_pricing', true, 'Use ML model for dynamic pricing'),
  ('enable_fraud_detection', true, 'Run fraud scoring on transactions'),
  ('enable_social_publishing', true, 'Allow one-click social media publishing'),
  ('enable_surge_pricing', true, 'Apply surge multiplier in high demand periods'),
  ('maintenance_mode', false, 'Put platform in maintenance mode')
ON CONFLICT (flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value;

SELECT 'Seed complete!' AS status,
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM trucks) AS trucks,
       (SELECT COUNT(*) FROM loads) AS loads,
       (SELECT COUNT(*) FROM load_tracking) AS tracking_events;

EOSQL

echo -e "${GREEN}  ✅ PostgreSQL seeded${NC}"

# ==================== MONGODB SEED ====================
echo -e "${YELLOW}  Seeding MongoDB...${NC}"

docker compose exec -T mongodb mongosh -u app_user -p "${MONGO_PASSWORD:-dev_password}" \
  --authenticationDatabase admin truck_platform --quiet << 'EOJS'

// Seed chat messages for load LD_2026_001002
db.chat_messages.insertMany([
  {
    load_id: 'LD_2026_001002',
    sender_id: '00000000-0000-0000-0000-000000000011',
    sender_type: 'merchant',
    message: 'Please ensure the goods are handled carefully, these are fragile electronics',
    message_type: 'text',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    read_by: ['00000000-0000-0000-0000-000000000021'],
    ai_moderated: true,
    sentiment: 'neutral',
    flagged: false
  },
  {
    load_id: 'LD_2026_001002',
    sender_id: '00000000-0000-0000-0000-000000000021',
    sender_type: 'trucker',
    message: 'Understood, we will take extra care. Currently on NH-48, ETA on track.',
    message_type: 'text',
    timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    read_by: ['00000000-0000-0000-0000-000000000011'],
    ai_moderated: true,
    sentiment: 'positive',
    flagged: false
  }
]);

// Seed load metadata
db.load_metadata.insertOne({
  load_id: 'LD_2026_001002',
  ai_analysis: {
    route_score: 0.89,
    demand_score: 0.75,
    risk_factors: ['high_traffic_mumbai', 'monsoon_season'],
    updated_at: new Date()
  },
  route_alternatives: [
    { route_id: 'rt_001', distance_km: 984, toll_cost: 3800, time_estimate: '16h 30m', score: 0.89 },
    { route_id: 'rt_002', distance_km: 1010, toll_cost: 3200, time_estimate: '17h 15m', score: 0.82 }
  ],
  realtime_updates: []
});

print('MongoDB seeded: chat_messages and load_metadata');

EOJS

echo -e "${GREEN}  ✅ MongoDB seeded${NC}"

# ==================== REDIS SEED ====================
echo -e "${YELLOW}  Warming Redis cache...${NC}"

docker compose exec -T redis redis-cli << 'EOREDIS'
SET "feature:enable_ai_pricing" "true" EX 3600
SET "feature:enable_fraud_detection" "true" EX 3600
SET "feature:enable_surge_pricing" "true" EX 3600
SET "feature:maintenance_mode" "false" EX 3600
SET "config:platform_commission_percent" "5" EX 3600
SET "config:max_surge_multiplier" "1.5" EX 3600
SET "config:waiting_charge_per_minute" "10" EX 3600
PING
EOREDIS

echo -e "${GREEN}  ✅ Redis cache warmed${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🌱 Database seeding complete!                           ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  Test credentials:                                       ║${NC}"
echo -e "${GREEN}║  Admin:    +919999999999 / admin@truckplatform.com       ║${NC}"
echo -e "${GREEN}║  Merchant: +919876543210 / raj@rajexports.com            ║${NC}"
echo -e "${GREEN}║  Trucker:  +919123456781 / ramesh@gmail.com              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
