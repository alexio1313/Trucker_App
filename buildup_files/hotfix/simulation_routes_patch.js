"use strict";
// simulation.routes.js
// Deploy to: /app/dist/simulation.routes.js  inside truck_trucker_service container
// Register in dist/app.js: app.use('/api/v1/simulation', require('./simulation.routes'));
// Then: docker restart truck_trucker_service

const { Router } = require('express');
const { query, queryOne } = require('./db/postgres');

const router = Router();

// Fixed UUIDs for reproducibility (idempotent re-seeding)
const SIM = {
  truckers: {
    bangalore: { userId: 'f1000000-0000-0000-0000-000000000001', truckId: 'f3000000-0000-0000-0000-000000000001' },
    delhi:     { userId: 'f1000000-0000-0000-0000-000000000002', truckId: 'f3000000-0000-0000-0000-000000000002' },
    mumbai:    { userId: 'f1000000-0000-0000-0000-000000000003', truckId: 'f3000000-0000-0000-0000-000000000003' },
  },
  merchants: {
    bangalore: 'f2000000-0000-0000-0000-000000000001',
    delhi:     'f2000000-0000-0000-0000-000000000002',
    mumbai:    'f2000000-0000-0000-0000-000000000003',
  },
};

const CITY_COORDS = {
  bangalore:  { lat: 12.9716,  lng: 77.5946,  state: 'Karnataka',     name: 'Bangalore' },
  delhi:      { lat: 28.6139,  lng: 77.2090,  state: 'Delhi',         name: 'Delhi' },
  mumbai:     { lat: 19.0760,  lng: 72.8777,  state: 'Maharashtra',   name: 'Mumbai' },
  hyderabad:  { lat: 17.3850,  lng: 78.4867,  state: 'Telangana',     name: 'Hyderabad' },
  chennai:    { lat: 13.0827,  lng: 80.2707,  state: 'Tamil Nadu',    name: 'Chennai' },
  kolkata:    { lat: 22.5726,  lng: 88.3639,  state: 'West Bengal',   name: 'Kolkata' },
  pune:       { lat: 18.5204,  lng: 73.8567,  state: 'Maharashtra',   name: 'Pune' },
  ahmedabad:  { lat: 23.0225,  lng: 72.5714,  state: 'Gujarat',       name: 'Ahmedabad' },
};

// Same hash as seed.sql (password: Admin@123)
const SIM_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy';

const MERCHANT_INFO = {
  bangalore: { name: 'TechLogix Bangalore',        phone: '+919860002001' },
  delhi:     { name: 'NorthLink Cargo Delhi',       phone: '+919860002002' },
  mumbai:    { name: 'MarinePort Logistics Mumbai', phone: '+919860002003' },
};

const LOADS_BY_CITY = {
  bangalore: [
    { toCity: 'Mumbai',    toState: 'Maharashtra', toLat: 19.0760, toLng: 72.8777, dist: 980,  price: 58800, cargo: 'general',              weight: 15000, fromAddr: 'Peenya Industrial Area, Bangalore',     toAddr: 'Bhiwandi Warehouse, Mumbai' },
    { toCity: 'Delhi',     toState: 'Delhi',        toLat: 28.6139, toLng: 77.2090, dist: 2150, price: 107500,cargo: 'fragile',              weight: 8000,  fromAddr: 'Electronic City, Bangalore',            toAddr: 'Okhla Industrial Estate, Delhi' },
    { toCity: 'Chennai',   toState: 'Tamil Nadu',   toLat: 13.0827, toLng: 80.2707, dist: 350,  price: 21000, cargo: 'general',              weight: 12000, fromAddr: 'Bommanahalli, Bangalore',               toAddr: 'Ambattur Industrial Estate, Chennai' },
    { toCity: 'Hyderabad', toState: 'Telangana',    toLat: 17.3850, toLng: 78.4867, dist: 570,  price: 34200, cargo: 'general',              weight: 20000, fromAddr: 'Whitefield, Bangalore',                 toAddr: 'Patancheru Industrial Area, Hyderabad' },
    { toCity: 'Pune',      toState: 'Maharashtra',  toLat: 18.5204, toLng: 73.8567, dist: 840,  price: 50400, cargo: 'oversized',            weight: 25000, fromAddr: 'Peenya Phase 2, Bangalore',             toAddr: 'Chakan Industrial Area, Pune' },
    { toCity: 'Ahmedabad', toState: 'Gujarat',      toLat: 23.0225, toLng: 72.5714, dist: 1280, price: 64000, cargo: 'general',              weight: 18000, fromAddr: 'Nelamangala, Bangalore',                toAddr: 'Sanand Industrial Zone, Ahmedabad' },
  ],
  delhi: [
    { toCity: 'Mumbai',    toState: 'Maharashtra',  toLat: 19.0760, toLng: 72.8777, dist: 1400, price: 84000, cargo: 'general',              weight: 20000, fromAddr: 'Okhla Industrial Estate, Delhi',         toAddr: 'Bhiwandi Logistics Hub, Mumbai' },
    { toCity: 'Bangalore', toState: 'Karnataka',    toLat: 12.9716, toLng: 77.5946, dist: 2150, price: 107500,cargo: 'fragile',              weight: 5000,  fromAddr: 'Gurgaon Sector 44, Delhi NCR',           toAddr: 'Electronic City Phase 2, Bangalore' },
    { toCity: 'Kolkata',   toState: 'West Bengal',  toLat: 22.5726, toLng: 88.3639, dist: 1500, price: 75000, cargo: 'general',              weight: 22000, fromAddr: 'Narela Industrial Area, Delhi',           toAddr: 'Dankuni Industrial Complex, Kolkata' },
    { toCity: 'Jaipur',    toState: 'Rajasthan',    toLat: 26.9124, toLng: 75.7873, dist: 280,  price: 16800, cargo: 'oversized',            weight: 30000, fromAddr: 'Wazirpur Industrial Area, Delhi',         toAddr: 'Sitapura Industrial Area, Jaipur' },
    { toCity: 'Ahmedabad', toState: 'Gujarat',      toLat: 23.0225, toLng: 72.5714, dist: 950,  price: 47500, cargo: 'general',              weight: 16000, fromAddr: 'Bahadurgarh, Haryana',                   toAddr: 'Vatva Industrial Estate, Ahmedabad' },
    { toCity: 'Hyderabad', toState: 'Telangana',    toLat: 17.3850, toLng: 78.4867, dist: 1600, price: 80000, cargo: 'general',              weight: 18000, fromAddr: 'Noida Sector 57, UP',                    toAddr: 'Bollaram Industrial Area, Hyderabad' },
  ],
  mumbai: [
    { toCity: 'Pune',      toState: 'Maharashtra',  toLat: 18.5204, toLng: 73.8567, dist: 150,  price: 13500, cargo: 'general',              weight: 10000, fromAddr: 'Bhiwandi Logistics Park, Mumbai',        toAddr: 'Chakan MIDC, Pune' },
    { toCity: 'Bangalore', toState: 'Karnataka',    toLat: 12.9716, toLng: 77.5946, dist: 980,  price: 58800, cargo: 'general',              weight: 20000, fromAddr: 'Navi Mumbai MIDC, Mumbai',               toAddr: 'Peenya Industrial Area, Bangalore' },
    { toCity: 'Ahmedabad', toState: 'Gujarat',      toLat: 23.0225, toLng: 72.5714, dist: 530,  price: 31800, cargo: 'fragile',              weight: 6000,  fromAddr: 'Andheri East Industrial Area, Mumbai',   toAddr: 'Vatva Industrial Estate, Ahmedabad' },
    { toCity: 'Nagpur',    toState: 'Maharashtra',  toLat: 21.1458, toLng: 79.0882, dist: 830,  price: 49800, cargo: 'general',              weight: 25000, fromAddr: 'Turbhe Industrial Area, Mumbai',          toAddr: 'MIDC Butibori, Nagpur' },
    { toCity: 'Delhi',     toState: 'Delhi',        toLat: 28.6139, toLng: 77.2090, dist: 1400, price: 84000, cargo: 'general',              weight: 22000, fromAddr: 'Taloja MIDC, Navi Mumbai',               toAddr: 'Narela Industrial Area, Delhi' },
    { toCity: 'Goa',       toState: 'Goa',          toLat: 15.2993, toLng: 74.1240, dist: 590,  price: 35400, cargo: 'temperature_controlled',weight: 8000, fromAddr: 'Palghar, Maharashtra',                  toAddr: 'Verna Industrial Estate, Goa' },
  ],
};

// GET /api/v1/simulation/status
router.get('/status', async (_req, res) => {
  try {
    const truckerIds = [
      SIM.truckers.bangalore.userId,
      SIM.truckers.delhi.userId,
      SIM.truckers.mumbai.userId,
    ];
    const merchantIds = [
      SIM.merchants.bangalore,
      SIM.merchants.delhi,
      SIM.merchants.mumbai,
    ];

    const truckers = await query(
      `SELECT u.user_id, u.full_name, u.phone_number, u.kyc_status,
              t.current_lat::float, t.current_lng::float, t.status AS truck_status
       FROM users u
       LEFT JOIN trucks t ON t.trucker_id = u.user_id AND t.deleted_at IS NULL
       WHERE u.user_id = ANY($1::uuid[])`,
      [truckerIds]
    );

    const loadCounts = await query(
      `SELECT merchant_id::text, status, COUNT(*) AS cnt
       FROM loads
       WHERE merchant_id = ANY($1::uuid[]) AND deleted_at IS NULL
       GROUP BY merchant_id, status`,
      [merchantIds]
    );

    res.json({ success: true, data: { truckers, loadCounts } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// POST /api/v1/simulation/seed-truckers
router.post('/seed-truckers', async (_req, res) => {
  try {
    // Upsert merchants (load posters) for each city
    await query(
      `INSERT INTO users (user_id, user_type, full_name, phone_number, password_hash, kyc_status, kyc_reviewed_at)
       VALUES
         ($1, 'merchant', 'TechLogix Bangalore',           '+919860002001', $4, 'verified', NOW()),
         ($2, 'merchant', 'NorthLink Cargo Delhi',          '+919860002002', $4, 'verified', NOW()),
         ($3, 'merchant', 'MarinePort Logistics Mumbai',    '+919860002003', $4, 'verified', NOW())
       ON CONFLICT (user_id) DO UPDATE SET kyc_status = 'verified', kyc_reviewed_at = NOW(), updated_at = NOW()`,
      [SIM.merchants.bangalore, SIM.merchants.delhi, SIM.merchants.mumbai, SIM_HASH]
    );

    // Upsert truckers for each city
    await query(
      `INSERT INTO users (user_id, user_type, full_name, phone_number, password_hash, kyc_status, kyc_reviewed_at, rating)
       VALUES
         ($1, 'trucker', 'Ravi Kumar (Sim-BLR)',         '+919860001001', $4, 'verified', NOW(), 4.8),
         ($2, 'trucker', 'Harpreet Singh (Sim-DEL)',     '+919860001002', $4, 'verified', NOW(), 4.6),
         ($3, 'trucker', 'Mahesh Patil (Sim-MUM)',       '+919860001003', $4, 'verified', NOW(), 4.9)
       ON CONFLICT (user_id) DO UPDATE SET kyc_status = 'verified', kyc_reviewed_at = NOW(), updated_at = NOW()`,
      [SIM.truckers.bangalore.userId, SIM.truckers.delhi.userId, SIM.truckers.mumbai.userId, SIM_HASH]
    );

    // Upsert trucks for each trucker
    await query(
      `INSERT INTO trucks
         (truck_id, trucker_id, registration_no, truck_type, capacity_kg, fuel_type,
          status, current_lat, current_lng, last_location_at, make, model, year)
       VALUES
         ($1, $4, 'KA-09-SIM-1001', 'heavy', 20000, 'diesel', 'available', 12.9716, 77.5946, NOW(), 'Ashok Leyland', 'U-Truck', 2022),
         ($2, $5, 'DL-01-SIM-2001', 'heavy', 20000, 'diesel', 'available', 28.6139, 77.2090, NOW(), 'Tata Motors',   'Prima',   2021),
         ($3, $6, 'MH-01-SIM-3001', 'heavy', 20000, 'diesel', 'available', 19.0760, 72.8777, NOW(), 'Bharat Benz',   '2523',    2023)
       ON CONFLICT (truck_id) DO UPDATE
         SET status = 'available', updated_at = NOW()`,
      [
        SIM.truckers.bangalore.truckId, SIM.truckers.delhi.truckId, SIM.truckers.mumbai.truckId,
        SIM.truckers.bangalore.userId,  SIM.truckers.delhi.userId,  SIM.truckers.mumbai.userId,
      ]
    );

    res.json({
      success: true,
      data: {
        message: '3 sim truckers + 3 sim merchants created/updated with verified KYC',
        credentials: {
          password: 'Admin@123',
          truckers: [
            { city: 'Bangalore', phone: '+919860001001', name: 'Ravi Kumar (Sim-BLR)' },
            { city: 'Delhi',     phone: '+919860001002', name: 'Harpreet Singh (Sim-DEL)' },
            { city: 'Mumbai',    phone: '+919860001003', name: 'Mahesh Patil (Sim-MUM)' },
          ],
        },
      },
    });
  } catch (e) {
    console.error('[simulation] seed-truckers error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// POST /api/v1/simulation/seed-loads  { city: 'bangalore' | 'delhi' | 'mumbai' }
router.post('/seed-loads', async (req, res) => {
  const { city } = req.body || {};
  if (!city || !LOADS_BY_CITY[city]) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'city must be bangalore, delhi, or mumbai' },
    });
  }

  try {
    const merchantId   = SIM.merchants[city];
    const merchantInfo = MERCHANT_INFO[city];
    const cityData     = CITY_COORDS[city];
    const loadsData    = LOADS_BY_CITY[city];

    // Ensure the merchant exists before inserting loads (avoids FK violation if seed-truckers wasn't called first)
    await query(
      `INSERT INTO users (user_id, user_type, full_name, phone_number, password_hash, kyc_status, kyc_reviewed_at)
       VALUES ($1, 'merchant', $2, $3, $4, 'verified', NOW())
       ON CONFLICT (user_id) DO UPDATE SET kyc_status = 'verified', kyc_reviewed_at = NOW(), updated_at = NOW()`,
      [merchantId, merchantInfo.name, merchantInfo.phone, SIM_HASH]
    );

    // Remove old 'posted' loads from this sim merchant to avoid stale data
    await query(`DELETE FROM loads WHERE merchant_id = $1 AND status = 'posted'`, [merchantId]);

    const now = new Date();
    let inserted = 0;

    for (let i = 0; i < loadsData.length; i++) {
      const load = loadsData[i];
      const loadId       = `SIM_${city.substring(0, 3).toUpperCase()}_${Date.now()}_${i}`;
      const commission   = Math.round(load.price * 0.05 * 100) / 100;
      const netEarning   = Math.round((load.price - commission) * 100) / 100;
      const pickupStart  = new Date(now.getTime() + 2  * 3600000);
      const pickupEnd    = new Date(now.getTime() + 8  * 3600000);
      const deliveryEta  = new Date(now.getTime() + (load.dist / 50) * 3600000);

      await query(
        `INSERT INTO loads (
           load_id, merchant_id, status,
           origin_lat, origin_lng, origin_address, origin_city, origin_state,
           dest_lat, dest_lng, dest_address, dest_city, dest_state,
           cargo_weight_kg, cargo_type,
           pickup_start, pickup_end, delivery_expected,
           distance_km, agreed_price, platform_commission, commission_percent,
           net_trucker_earning, ai_suggested_price
         ) VALUES (
           $1, $2, 'posted',
           $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14,
           $15, $16, $17,
           $18, $19, $20, 5.00,
           $21, $22
         ) ON CONFLICT (load_id) DO NOTHING`,
        [
          loadId, merchantId,
          cityData.lat, cityData.lng, load.fromAddr, cityData.name, cityData.state,
          load.toLat, load.toLng, load.toAddr, load.toCity, load.toState,
          load.weight, load.cargo,
          pickupStart.toISOString(), pickupEnd.toISOString(), deliveryEta.toISOString(),
          load.dist, load.price, commission,
          netEarning, load.price,
        ]
      );
      inserted++;
    }

    res.json({ success: true, data: { message: `${inserted} loads seeded for ${city}`, city, count: inserted } });
  } catch (e) {
    console.error('[simulation] seed-loads error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// PATCH /api/v1/simulation/trucker-location  { truckerId, city }
router.patch('/trucker-location', async (req, res) => {
  const { truckerId, city } = req.body || {};
  if (!truckerId || !CITY_COORDS[city]) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'truckerId and city (bangalore/delhi/mumbai/etc.) required' },
    });
  }

  try {
    const { lat, lng, name } = CITY_COORDS[city];
    const rows = await query(
      `UPDATE trucks
       SET current_lat = $1, current_lng = $2, last_location_at = NOW(), updated_at = NOW()
       WHERE trucker_id = $3 AND deleted_at IS NULL
       RETURNING truck_id`,
      [lat, lng, truckerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Truck not found for this trucker' } });
    }

    res.json({ success: true, data: { truckerId, city, cityName: name, lat, lng } });
  } catch (e) {
    console.error('[simulation] trucker-location error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

module.exports = router;
