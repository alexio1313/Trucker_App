'use strict';
// truckers_extra.routes.js — mounts at /api/v1/truckers
// Provides live-positions (for admin LiveMap) + advance-drive (for simulation)
const { Router } = require('express');
const { query, queryOne } = require('./db/postgres');

const router = Router();

// GET /api/v1/truckers/live-positions
router.get('/live-positions', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT
         u.user_id, u.full_name, u.phone_number, u.rating::float,
         t.truck_id, t.registration_no, t.make, t.model, t.truck_type,
         t.status AS truck_status,
         t.current_lat::float, t.current_lng::float, t.last_location_at,
         l.load_id, l.origin_city, l.dest_city, l.status AS load_status,
         l.distance_km::float, l.agreed_price::float,
         l.origin_lat::float AS load_origin_lat, l.origin_lng::float AS load_origin_lng,
         l.dest_lat::float   AS load_dest_lat,   l.dest_lng::float   AS load_dest_lng
       FROM users u
       JOIN trucks t ON t.trucker_id = u.user_id AND t.deleted_at IS NULL
       LEFT JOIN loads l
         ON l.trucker_id = u.user_id AND l.status IN ('accepted','loading','in_transit')
       WHERE u.user_type = 'trucker'
         AND u.is_suspended = false
         AND t.current_lat IS NOT NULL
         AND t.current_lng IS NOT NULL
       ORDER BY t.last_location_at DESC NULLS LAST
       LIMIT 200`,
      []
    );
    res.json({ success: true, data: { truckers: rows, updatedAt: new Date().toISOString(), count: rows.length } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/advance-drive/:truckerId
// Moves trucker GPS stepKm toward their active load's destination
// Used by admin simulation auto-drive panel
router.post('/advance-drive/:truckerId', async (req, res) => {
  const { truckerId } = req.params;
  const stepKm = parseFloat(req.body?.stepKm || '10');
  try {
    const truck = await queryOne(
      'SELECT current_lat::float AS lat, current_lng::float AS lng FROM trucks WHERE trucker_id=$1 AND deleted_at IS NULL',
      [truckerId]
    );
    if (!truck) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Truck not found' } });

    const load = await queryOne(
      "SELECT dest_lat::float AS dlat, dest_lng::float AS dlng FROM loads WHERE trucker_id=$1 AND status IN ('accepted','loading','in_transit') ORDER BY updated_at DESC LIMIT 1",
      [truckerId]
    );
    if (!load) return res.status(404).json({ success: false, error: { code: 'NO_ACTIVE_LOAD', message: 'No active load for this trucker' } });

    const { lat: curLat, lng: curLng } = truck;
    const { dlat: destLat, dlng: destLng } = load;

    const KM_PER_DEG = 111.0;
    const dLat = destLat - curLat;
    const dLng = destLng - curLng;
    const distKm = Math.sqrt((dLat * KM_PER_DEG) ** 2 + (dLng * KM_PER_DEG) ** 2);

    let newLat, newLng, arrived = false;
    if (distKm <= stepKm || distKm < 0.5) {
      newLat = destLat; newLng = destLng; arrived = true;
    } else {
      const ratio = stepKm / distKm;
      newLat = curLat + dLat * ratio;
      newLng = curLng + dLng * ratio;
    }

    await query(
      'UPDATE trucks SET current_lat=$1, current_lng=$2, last_location_at=NOW(), updated_at=NOW() WHERE trucker_id=$3',
      [newLat, newLng, truckerId]
    );

    // Also update journey_log remaining_km if one exists
    if (!arrived && distKm > stepKm) {
      await query(
        `UPDATE journey_logs SET remaining_km=(remaining_km - $1), current_lat=$2, current_lng=$3
         WHERE trucker_id=$4 AND status='active' AND remaining_km IS NOT NULL`,
        [stepKm, newLat, newLng, truckerId]
      );
    }

    res.json({
      success: true,
      data: {
        truckerId,
        newLat, newLng,
        distanceMovedKm: arrived ? distKm : stepKm,
        remainingKm: arrived ? 0 : Math.max(0, distKm - stepKm).toFixed(1),
        arrived,
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

module.exports = router;
