// Patch: fix duplicate truckers in live-positions by using DISTINCT ON
const fs = require('fs');
const path = '/app/dist/trucker.intel.routes.js';

let src = fs.readFileSync(path, 'utf8');

const OLD = `      SELECT
        u.user_id, u.full_name, u.phone_number,
        COALESCE(u.rating, 5.0)::float AS rating,
        t.truck_id, t.registration_no,
        COALESCE(t.make, '') AS make,
        COALESCE(t.model, '') AS model,
        t.truck_type,
        t.status AS truck_status,
        t.current_lat::float,
        t.current_lng::float,
        t.last_location_at,
        l.load_id,
        l.origin_city,
        l.dest_city,
        l.status AS load_status,
        COALESCE(l.distance_km, 0)::float AS distance_km,
        COALESCE(l.agreed_price, 0)::float AS agreed_price
      FROM users u
      JOIN trucks t ON t.trucker_id = u.user_id AND t.deleted_at IS NULL
      LEFT JOIN loads l ON l.trucker_id = u.user_id
        AND l.status IN ('accepted', 'loading', 'in_transit')
        AND l.deleted_at IS NULL
      WHERE u.user_type = 'trucker' AND u.deleted_at IS NULL
        AND t.current_lat IS NOT NULL AND t.current_lng IS NOT NULL
      ORDER BY t.last_location_at DESC NULLS LAST
      LIMIT 200`;

const NEW = `      SELECT DISTINCT ON (u.user_id)
        u.user_id, u.full_name, u.phone_number,
        COALESCE(u.rating, 5.0)::float AS rating,
        t.truck_id, t.registration_no,
        COALESCE(t.make, '') AS make,
        COALESCE(t.model, '') AS model,
        t.truck_type,
        t.status AS truck_status,
        t.current_lat::float,
        t.current_lng::float,
        t.last_location_at,
        l.load_id,
        l.origin_city,
        l.dest_city,
        l.status AS load_status,
        COALESCE(l.distance_km, 0)::float AS distance_km,
        COALESCE(l.agreed_price, 0)::float AS agreed_price
      FROM users u
      JOIN trucks t ON t.trucker_id = u.user_id AND t.deleted_at IS NULL
      LEFT JOIN loads l ON l.trucker_id = u.user_id
        AND l.status IN ('accepted', 'loading', 'in_transit')
        AND l.deleted_at IS NULL
      WHERE u.user_type = 'trucker' AND u.deleted_at IS NULL
        AND t.current_lat IS NOT NULL AND t.current_lng IS NOT NULL
      ORDER BY u.user_id, l.created_at DESC NULLS LAST, t.last_location_at DESC NULLS LAST
      LIMIT 200`;

if (!src.includes(OLD.trim().split('\n')[0])) {
  console.error('Pattern not found — file may have changed');
  process.exit(1);
}

const patched = src.replace(OLD, NEW);
fs.writeFileSync(path, patched, 'utf8');
console.log('Patched live-positions: added DISTINCT ON (u.user_id)');
