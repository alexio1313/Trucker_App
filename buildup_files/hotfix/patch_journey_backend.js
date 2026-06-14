/**
 * Backend journey management patch
 * Targets: truck_load_service (active load lock) + truck_trucker_service (journey endpoints)
 *
 * Run with:
 *   node patch_journey_backend.js
 * Then deploy:
 *   wsl bash -c 'scp "/mnt/f/AI_BOT/AI Trucker App/patch_journey_backend.js" ubuntu@192.168.8.101:/tmp/'
 *   wsl ssh ubuntu@192.168.8.101 "docker cp /tmp/patch_journey_backend.js truck_load_service:/tmp/ && docker cp /tmp/patch_journey_backend.js truck_trucker_service:/tmp/ && docker exec truck_load_service node /tmp/patch_journey_backend.js load && docker exec truck_trucker_service node /tmp/patch_journey_backend.js trucker"
 */

const http = require('http');
const path = require('path');
const fs   = require('fs');

const MODE = process.argv[2]; // 'load' or 'trucker'

// ──────────────────────────────────────────────
// Shared: DB tables creation
// ──────────────────────────────────────────────
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS journey_logs (
  log_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id           UUID NOT NULL REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id        UUID NOT NULL,
  journey_status    VARCHAR(30) NOT NULL DEFAULT 'not_started',
  start_odometer_km NUMERIC(10,2),
  end_odometer_km   NUMERIC(10,2),
  total_distance_km NUMERIC(10,2),
  total_fuel_liters NUMERIC(10,2) DEFAULT 0,
  total_fuel_cost   NUMERIC(12,2) DEFAULT 0,
  actual_toll_cost  NUMERIC(12,2),
  journey_started_at TIMESTAMPTZ,
  journey_ended_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fuel_stops (
  stop_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id          UUID NOT NULL REFERENCES loads(load_id) ON DELETE CASCADE,
  trucker_id       UUID NOT NULL,
  fuel_liters      NUMERIC(8,2) NOT NULL,
  fuel_cost        NUMERIC(10,2) NOT NULL,
  odometer_km      NUMERIC(10,2),
  fuel_station_name TEXT,
  logged_at        TIMESTAMPTZ DEFAULT NOW()
);
`;

// ──────────────────────────────────────────────
// Load service patch: active load check on accept
// ──────────────────────────────────────────────
const LOAD_ACCEPT_PATCH = `
// JOURNEY PATCH: active load lock
const _origLoadAccept = router.stack.find(l => l.route && l.route.path === '/:loadId/accept' && l.route.methods.post);
// Inject middleware into load accept route
async function activeLoadCheck(req, res, next) {
  try {
    const truckerId = req.user?.userId || req.body?.truckerId;
    if (!truckerId) return next();
    const pool = req.app.get('db') || global._pool;
    if (!pool) return next();
    const active = await pool.query(
      \`SELECT load_id FROM loads WHERE trucker_id = $1 AND status IN ('accepted','loading','in_transit') LIMIT 1\`,
      [truckerId]
    );
    if (active.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'ACTIVE_LOAD_EXISTS', message: 'You already have an active load. Complete or cancel it before accepting a new one.' }
      });
    }
    next();
  } catch (e) { next(); }
}
`;

// ──────────────────────────────────────────────
// Trucker service patch: journey endpoints
// ──────────────────────────────────────────────
function buildTruckerJourneyCode(appJsContent) {
  const inject = `
// ═══════════════════════════════════════
// JOURNEY MANAGEMENT ENDPOINTS (patched)
// ═══════════════════════════════════════
const { Pool: _JPool } = require('pg');
const _jPool = new _JPool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Helper: get trucker_id from auth token or localStorage userId in header
function _getTruckerId(req) {
  return req.user?.userId || req.user?.user_id || req.headers['x-user-id'];
}

// Ensure tables exist
(async () => {
  try {
    await _jPool.query(\`
      CREATE TABLE IF NOT EXISTS journey_logs (
        log_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        load_id           UUID NOT NULL,
        trucker_id        UUID NOT NULL,
        journey_status    VARCHAR(30) NOT NULL DEFAULT 'not_started',
        start_odometer_km NUMERIC(10,2),
        end_odometer_km   NUMERIC(10,2),
        total_distance_km NUMERIC(10,2),
        total_fuel_liters NUMERIC(10,2) DEFAULT 0,
        total_fuel_cost   NUMERIC(12,2) DEFAULT 0,
        actual_toll_cost  NUMERIC(12,2),
        journey_started_at TIMESTAMPTZ,
        journey_ended_at   TIMESTAMPTZ,
        created_at         TIMESTAMPTZ DEFAULT NOW()
      )
    \`);
    await _jPool.query(\`
      CREATE TABLE IF NOT EXISTS fuel_stops (
        stop_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        load_id          UUID NOT NULL,
        trucker_id       UUID NOT NULL,
        fuel_liters      NUMERIC(8,2) NOT NULL,
        fuel_cost        NUMERIC(10,2) NOT NULL,
        odometer_km      NUMERIC(10,2),
        fuel_station_name TEXT,
        logged_at        TIMESTAMPTZ DEFAULT NOW()
      )
    \`);
    console.log('[journey] DB tables ready');
  } catch (e) { console.error('[journey] table init failed:', e.message); }
})();

// GET /api/v1/truckers/my/active-load
app.get('/api/v1/truckers/my/active-load', async (req, res) => {
  try {
    const truckerId = _getTruckerId(req);
    if (!truckerId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const loadRes = await _jPool.query(
      \`SELECT l.load_id, l.origin_city, l.dest_city, l.origin_address, l.dest_address,
              l.origin_lat::float, l.origin_lng::float, l.dest_lat::float, l.dest_lng::float,
              l.origin_state, l.dest_state, l.cargo_type, l.cargo_weight_kg,
              l.agreed_price::float, l.distance_km::float, l.status,
              l.origin_contact_name, l.origin_contact_phone,
              l.dest_contact_name, l.dest_contact_phone,
              u.full_name AS merchant_name
       FROM loads l
       LEFT JOIN users u ON u.user_id = l.merchant_id
       WHERE l.trucker_id = $1 AND l.status IN ('accepted','loading','in_transit')
       ORDER BY l.updated_at DESC LIMIT 1\`,
      [truckerId]
    );

    if (loadRes.rows.length === 0) {
      return res.json({ success: true, data: { load: null, journey: null, fuelStops: [] } });
    }

    const load = loadRes.rows[0];
    const jRes = await _jPool.query(
      'SELECT * FROM journey_logs WHERE load_id = $1 ORDER BY created_at DESC LIMIT 1',
      [load.load_id]
    );
    const fsRes = await _jPool.query(
      'SELECT * FROM fuel_stops WHERE load_id = $1 ORDER BY logged_at ASC',
      [load.load_id]
    );

    res.json({ success: true, data: {
      load,
      journey: jRes.rows[0] || null,
      fuelStops: fsRes.rows,
    }});
  } catch (e) {
    console.error('[journey/active-load]', e);
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/start
app.post('/api/v1/truckers/my/journey/start', async (req, res) => {
  try {
    const truckerId = _getTruckerId(req);
    const { loadId, startOdometerKm } = req.body;
    if (!loadId) return res.status(400).json({ success: false, error: { message: 'loadId required' } });

    // Verify ownership
    const check = await _jPool.query(
      'SELECT load_id FROM loads WHERE load_id = $1 AND trucker_id = $2 AND status IN (\'accepted\',\'loading\')',
      [loadId, truckerId]
    );
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Load not found or already started' } });

    // Update load status to in_transit
    await _jPool.query(
      "UPDATE loads SET status='in_transit', updated_at=NOW() WHERE load_id=$1",
      [loadId]
    );

    // Create journey log
    const existing = await _jPool.query('SELECT log_id FROM journey_logs WHERE load_id=$1', [loadId]);
    let journeyRow;
    if (existing.rows.length > 0) {
      const upd = await _jPool.query(
        \`UPDATE journey_logs SET journey_status='in_progress', start_odometer_km=$1, journey_started_at=NOW()
         WHERE load_id=$2 RETURNING *\`,
        [startOdometerKm || null, loadId]
      );
      journeyRow = upd.rows[0];
    } else {
      const ins = await _jPool.query(
        \`INSERT INTO journey_logs (load_id, trucker_id, journey_status, start_odometer_km, journey_started_at)
         VALUES ($1, $2, 'in_progress', $3, NOW()) RETURNING *\`,
        [loadId, truckerId, startOdometerKm || null]
      );
      journeyRow = ins.rows[0];
    }

    res.json({ success: true, data: { journey: journeyRow } });
  } catch (e) {
    console.error('[journey/start]', e);
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/fuel-stop
app.post('/api/v1/truckers/my/journey/fuel-stop', async (req, res) => {
  try {
    const truckerId = _getTruckerId(req);
    const { loadId, fuelLiters, fuelCost, odometerKm, stationName } = req.body;
    if (!loadId || !fuelLiters || !fuelCost) {
      return res.status(400).json({ success: false, error: { message: 'loadId, fuelLiters, fuelCost required' } });
    }

    // Insert fuel stop
    const fsRes = await _jPool.query(
      \`INSERT INTO fuel_stops (load_id, trucker_id, fuel_liters, fuel_cost, odometer_km, fuel_station_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *\`,
      [loadId, truckerId, fuelLiters, fuelCost, odometerKm || null, stationName || null]
    );

    // Update totals in journey_logs
    await _jPool.query(
      \`UPDATE journey_logs
       SET total_fuel_liters = COALESCE(total_fuel_liters,0) + $1,
           total_fuel_cost   = COALESCE(total_fuel_cost,0) + $2
       WHERE load_id = $3\`,
      [fuelLiters, fuelCost, loadId]
    );

    res.json({ success: true, data: { fuelStop: fsRes.rows[0] } });
  } catch (e) {
    console.error('[journey/fuel-stop]', e);
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/deliver
app.post('/api/v1/truckers/my/journey/deliver', async (req, res) => {
  try {
    const truckerId = _getTruckerId(req);
    const { loadId, endOdometerKm, actualTollCost } = req.body;
    if (!loadId) return res.status(400).json({ success: false, error: { message: 'loadId required' } });

    // Update load status
    await _jPool.query(
      "UPDATE loads SET status='delivered', updated_at=NOW() WHERE load_id=$1 AND trucker_id=$2",
      [loadId, truckerId]
    );

    // Update journey log
    const jRes = await _jPool.query(
      \`UPDATE journey_logs
       SET journey_status='completed',
           end_odometer_km=$1,
           actual_toll_cost=$2,
           total_distance_km = CASE WHEN start_odometer_km IS NOT NULL AND $1 IS NOT NULL THEN ($1::numeric - start_odometer_km) ELSE NULL END,
           journey_ended_at=NOW()
       WHERE load_id=$3 RETURNING *\`,
      [endOdometerKm || null, actualTollCost || null, loadId]
    );

    res.json({ success: true, data: { journey: jRes.rows[0] || null } });
  } catch (e) {
    console.error('[journey/deliver]', e);
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// GET /api/v1/truckers/my/journey/stats
app.get('/api/v1/truckers/my/journey/stats', async (req, res) => {
  try {
    const truckerId = _getTruckerId(req);
    const stats = await _jPool.query(
      \`SELECT
         COUNT(*) FILTER (WHERE j.journey_status='completed') AS total_trips,
         COALESCE(SUM(j.total_distance_km),0)::float AS total_km,
         COALESCE(SUM(j.total_fuel_liters),0)::float AS total_fuel_liters,
         COALESCE(SUM(j.total_fuel_cost),0)::float AS total_fuel_cost,
         COALESCE(SUM(j.actual_toll_cost),0)::float AS total_toll_cost,
         COALESCE(SUM(l.agreed_price),0)::float AS gross_earnings
       FROM journey_logs j
       JOIN loads l ON l.load_id = j.load_id
       WHERE j.trucker_id = $1\`,
      [truckerId]
    );
    const row = stats.rows[0];
    row.net_earnings = (row.gross_earnings || 0) - (row.total_fuel_cost || 0) - (row.total_toll_cost || 0);
    res.json({ success: true, data: row });
  } catch (e) {
    console.error('[journey/stats]', e);
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

console.log('[journey] 5 endpoints registered: active-load, start, fuel-stop, deliver, stats');
`;
  return inject;
}

// ──────────────────────────────────────────────
// LOAD SERVICE: add active load check
// ──────────────────────────────────────────────
async function patchLoadService() {
  console.log('[patch] Patching load service (active load lock)...');
  const appPath = '/app/dist/app.js';
  let src = fs.readFileSync(appPath, 'utf8');

  if (src.includes('ACTIVE_LOAD_EXISTS')) {
    console.log('[patch] Load service already patched, skipping');
    return;
  }

  // Find accept route and inject check
  // The accept route typically has pattern: router.post('/:loadId/accept' or similar
  // We inject a pre-check by wrapping the accept endpoint handler
  const acceptPattern = /app\.post\(['"`]\/api\/v1\/loads\/:loadId\/accept['"`]/;
  if (acceptPattern.test(src)) {
    src = src.replace(acceptPattern, (match) => {
      return `
// PATCHED: active load lock
app.post('/api/v1/loads/active-load-check-DISABLED', async(req,res)=>{});
${match}`;
    });
  }

  // Inject the active load middleware inline into the accept handler
  // Find the accept handler body and add the check at the start
  const handlerStart = /app\.post\(['"`]\/api\/v1\/loads\/:loadId\/accept['"`][^,]*,\s*async\s*\(req,\s*res\)\s*=>\s*\{/;
  if (handlerStart.test(src)) {
    const dbPoolName = src.includes('pool.query') ? 'pool' : src.match(/const (\w+) = new Pool/)?.[1] || 'pool';
    const checkCode = `
    // Active load lock (journey patch)
    const _trId = req.user?.userId || req.user?.user_id;
    if (_trId) {
      try {
        const _al = await ${dbPoolName}.query(
          "SELECT load_id FROM loads WHERE trucker_id = $1 AND status IN ('accepted','loading','in_transit') LIMIT 1",
          [_trId]
        );
        if (_al.rows.length > 0) {
          return res.status(409).json({ success: false, error: { code: 'ACTIVE_LOAD_EXISTS', message: 'You already have an active load. Deliver it before accepting a new one.' } });
        }
      } catch(_e) { /* continue if check fails */ }
    }`;

    src = src.replace(handlerStart, (match) => match + checkCode);
  } else {
    console.log('[patch] Could not find accept route — injecting standalone active load endpoint instead');
    // Inject as new endpoint before 404 handler
    const notFoundPattern = /app\.use\([^)]*404[^)]*\)/;
    const fallback = `
// Patched: active load check endpoint
app.get('/api/v1/loads/active-check/:truckerId', async (req, res) => {
  try {
    const { truckerId } = req.params;
    const r = await pool.query("SELECT load_id FROM loads WHERE trucker_id=$1 AND status IN ('accepted','loading','in_transit') LIMIT 1",[truckerId]);
    res.json({ success: true, data: { hasActiveLoad: r.rows.length > 0, loadId: r.rows[0]?.load_id || null } });
  } catch(e) { res.status(500).json({ success: false }); }
});
`;
    if (notFoundPattern.test(src)) {
      src = src.replace(notFoundPattern, fallback + '\n$&');
    } else {
      src += fallback;
    }
  }

  fs.writeFileSync(appPath, src);
  console.log('[patch] Load service patched successfully');
}

// ──────────────────────────────────────────────
// TRUCKER SERVICE: inject journey endpoints
// ──────────────────────────────────────────────
async function patchTruckerService() {
  console.log('[patch] Patching trucker service (journey endpoints)...');
  const appPath = '/app/dist/app.js';
  let src = fs.readFileSync(appPath, 'utf8');

  if (src.includes('journey_logs') || src.includes('JOURNEY MANAGEMENT ENDPOINTS')) {
    console.log('[patch] Trucker service already has journey endpoints, skipping');
    return;
  }

  const injectedCode = buildTruckerJourneyCode(src);

  // Inject before the last app.listen or module.exports
  const listenPattern = /app\.listen\s*\(/;
  if (listenPattern.test(src)) {
    src = src.replace(listenPattern, injectedCode + '\napp.listen(');
  } else {
    // Fallback: append before module.exports or at end
    const exportsPattern = /module\.exports\s*=/;
    if (exportsPattern.test(src)) {
      src = src.replace(exportsPattern, injectedCode + '\nmodule.exports =');
    } else {
      src += injectedCode;
    }
  }

  fs.writeFileSync(appPath, src);
  console.log('[patch] Trucker service patched successfully');
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
(async () => {
  if (MODE === 'load') {
    await patchLoadService();
  } else if (MODE === 'trucker') {
    await patchTruckerService();
  } else {
    console.log('Usage: node patch_journey_backend.js [load|trucker]');
    console.log('');
    console.log('Or run both:');
    console.log('  node patch_journey_backend.js load');
    console.log('  node patch_journey_backend.js trucker');
    process.exit(1);
  }
  console.log('[patch] Done. Restart the container to apply changes.');
})();
