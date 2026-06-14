// Adds the /live-positions endpoint to trucker-routes-patch.js
const fs = require('fs');
const path = '/home/ubuntu/truck-platform/scripts/trucker-routes-patch.js';

let content = fs.readFileSync(path, 'utf8');

const marker = '    // ── KYC Submit ────────────────────────────────────────────────────────────';
const newRoute = `
    // ── Live Fleet Positions (admin live map) ─────────────────────────────────
    // Returns all truckers with GPS from trucks table + active load data

    app.get('/api/v1/truckers/live-positions', async (req, res) => {
        try {
            const rows = await query(\`
                SELECT
                  u.user_id,
                  u.full_name,
                  u.phone_number,
                  COALESCE(u.rating::float, 5) AS rating,
                  t.truck_id,
                  t.registration_no,
                  COALESCE(t.make, 'Tata') AS make,
                  COALESCE(t.model, 'LPT') AS model,
                  t.truck_type,
                  COALESCE(t.status, 'available') AS truck_status,
                  t.current_lat::float AS current_lat,
                  t.current_lng::float AS current_lng,
                  t.last_location_at,
                  l.load_id,
                  l.origin_city,
                  l.dest_city,
                  l.status AS load_status,
                  COALESCE(l.distance_km::float, 0) AS distance_km,
                  COALESCE(l.agreed_price::float, 0) AS agreed_price,
                  l.origin_lat::float AS load_origin_lat,
                  l.origin_lng::float AS load_origin_lng,
                  l.dest_lat::float AS load_dest_lat,
                  l.dest_lng::float AS load_dest_lng
                FROM users u
                JOIN trucks t ON t.trucker_id = u.user_id AND t.deleted_at IS NULL
                LEFT JOIN LATERAL (
                  SELECT load_id, origin_city, dest_city, status, distance_km, agreed_price,
                         origin_lat, origin_lng, dest_lat, dest_lng
                  FROM loads
                  WHERE trucker_id = u.user_id
                    AND status IN ('accepted','loading','in_transit')
                    AND deleted_at IS NULL
                  ORDER BY created_at DESC LIMIT 1
                ) l ON true
                WHERE u.user_type = 'trucker'
                  AND u.deleted_at IS NULL
                  AND t.current_lat IS NOT NULL
                ORDER BY u.created_at
            \`);
            res.json({
                success: true,
                data: {
                    truckers: rows,
                    updatedAt: new Date().toISOString(),
                    count: rows.length,
                },
            });
        } catch (e) {
            console.error('GET /truckers/live-positions error:', e.message);
            res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
        }
    });

`;

if (content.includes('/live-positions')) {
    console.log('live-positions already exists in patch — skipping');
    process.exit(0);
}

if (!content.includes(marker)) {
    console.error('ERROR: marker not found in file');
    process.exit(1);
}

content = content.replace(marker, newRoute + marker);
fs.writeFileSync(path, content);
console.log('live-positions route added successfully');
