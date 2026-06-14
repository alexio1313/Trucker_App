/**
 * Journey backend patch v2
 * Writes journey-routes.js to /app/dist/, then injects require() into app.js
 * Mode: node patch_journey_backend_v2.js [load|trucker]
 */
const fs = require('fs');
const path = require('path');
const MODE = process.argv[2];

// ── Journey routes file content ──────────────────────────────────────────────
// Written to /app/dist/journey-routes.js, then required by app.js
// Using ONLY regular string literals (no template literals) to avoid escaping issues.

const JOURNEY_ROUTES_JS = [
  "// Journey management routes — auto-patched",
  "const { Pool } = require('pg');",
  "",
  "module.exports = function registerJourneyRoutes(app) {",
  "  const pool = new Pool({",
  "    connectionString: process.env.DATABASE_URL,",
  "    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false",
  "  });",
  "",
  "  // Create tables if not exist",
  "  (async function initTables() {",
  "    try {",
  "      await pool.query(",
  "        'CREATE TABLE IF NOT EXISTS journey_logs (' +",
  "        '  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' +",
  "        '  load_id UUID NOT NULL,' +",
  "        '  trucker_id UUID NOT NULL,' +",
  "        '  journey_status VARCHAR(30) NOT NULL DEFAULT \\'not_started\\',' +",
  "        '  start_odometer_km NUMERIC(10,2),' +",
  "        '  end_odometer_km NUMERIC(10,2),' +",
  "        '  total_distance_km NUMERIC(10,2),' +",
  "        '  total_fuel_liters NUMERIC(10,2) DEFAULT 0,' +",
  "        '  total_fuel_cost NUMERIC(12,2) DEFAULT 0,' +",
  "        '  actual_toll_cost NUMERIC(12,2),' +",
  "        '  journey_started_at TIMESTAMPTZ,' +",
  "        '  journey_ended_at TIMESTAMPTZ,' +",
  "        '  created_at TIMESTAMPTZ DEFAULT NOW()' +",
  "        ')'",
  "      );",
  "      await pool.query(",
  "        'CREATE TABLE IF NOT EXISTS fuel_stops (' +",
  "        '  stop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' +",
  "        '  load_id UUID NOT NULL,' +",
  "        '  trucker_id UUID NOT NULL,' +",
  "        '  fuel_liters NUMERIC(8,2) NOT NULL,' +",
  "        '  fuel_cost NUMERIC(10,2) NOT NULL,' +",
  "        '  odometer_km NUMERIC(10,2),' +",
  "        '  fuel_station_name TEXT,' +",
  "        '  logged_at TIMESTAMPTZ DEFAULT NOW()' +",
  "        ')'",
  "      );",
  "      console.log('[journey] DB tables ready');",
  "    } catch (e) {",
  "      console.error('[journey] table init error:', e.message);",
  "    }",
  "  })();",
  "",
  "  function getTruckerId(req) {",
  "    return (req.user && (req.user.userId || req.user.user_id)) || req.headers['x-user-id'];",
  "  }",
  "",
  "  // GET /api/v1/truckers/my/active-load",
  "  app.get('/api/v1/truckers/my/active-load', async function(req, res) {",
  "    try {",
  "      var truckerId = getTruckerId(req);",
  "      if (!truckerId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });",
  "      var loadSql = 'SELECT l.load_id, l.origin_city, l.dest_city, l.origin_address, l.dest_address,' +",
  "        ' l.origin_lat::float, l.origin_lng::float, l.dest_lat::float, l.dest_lng::float,' +",
  "        ' l.origin_state, l.dest_state, l.cargo_type, l.cargo_weight_kg,' +",
  "        ' l.agreed_price::float, l.distance_km::float, l.status,' +",
  "        ' l.origin_contact_name, l.origin_contact_phone, l.dest_contact_name, l.dest_contact_phone,' +",
  "        ' u.full_name AS merchant_name' +",
  "        ' FROM loads l LEFT JOIN users u ON u.user_id = l.merchant_id' +",
  "        ' WHERE l.trucker_id = $1 AND l.status = ANY($2)' +",
  "        ' ORDER BY l.updated_at DESC LIMIT 1';",
  "      var loadRes = await pool.query(loadSql, [truckerId, ['accepted','loading','in_transit']]);",
  "      if (loadRes.rows.length === 0) {",
  "        return res.json({ success: true, data: { load: null, journey: null, fuelStops: [] } });",
  "      }",
  "      var load = loadRes.rows[0];",
  "      var jRes = await pool.query('SELECT * FROM journey_logs WHERE load_id = $1 ORDER BY created_at DESC LIMIT 1', [load.load_id]);",
  "      var fsRes = await pool.query('SELECT * FROM fuel_stops WHERE load_id = $1 ORDER BY logged_at ASC', [load.load_id]);",
  "      res.json({ success: true, data: { load: load, journey: jRes.rows[0] || null, fuelStops: fsRes.rows } });",
  "    } catch (e) {",
  "      console.error('[journey/active-load]', e.message);",
  "      res.status(500).json({ success: false, error: { message: e.message } });",
  "    }",
  "  });",
  "",
  "  // POST /api/v1/truckers/my/journey/start",
  "  app.post('/api/v1/truckers/my/journey/start', async function(req, res) {",
  "    try {",
  "      var truckerId = getTruckerId(req);",
  "      var loadId = req.body.loadId;",
  "      var startOdo = req.body.startOdometerKm;",
  "      if (!loadId) return res.status(400).json({ success: false, error: { message: 'loadId required' } });",
  "      var checkSql = 'SELECT load_id FROM loads WHERE load_id = $1 AND trucker_id = $2 AND status = ANY($3)';",
  "      var check = await pool.query(checkSql, [loadId, truckerId, ['accepted','loading']]);",
  "      if (check.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Load not found or already started' } });",
  "      await pool.query(\"UPDATE loads SET status='in_transit', updated_at=NOW() WHERE load_id=$1\", [loadId]);",
  "      var existing = await pool.query('SELECT log_id FROM journey_logs WHERE load_id=$1', [loadId]);",
  "      var journeyRow;",
  "      if (existing.rows.length > 0) {",
  "        var upd = await pool.query(\"UPDATE journey_logs SET journey_status='in_progress', start_odometer_km=$1, journey_started_at=NOW() WHERE load_id=$2 RETURNING *\", [startOdo || null, loadId]);",
  "        journeyRow = upd.rows[0];",
  "      } else {",
  "        var ins = await pool.query(\"INSERT INTO journey_logs (load_id, trucker_id, journey_status, start_odometer_km, journey_started_at) VALUES ($1, $2, 'in_progress', $3, NOW()) RETURNING *\", [loadId, truckerId, startOdo || null]);",
  "        journeyRow = ins.rows[0];",
  "      }",
  "      res.json({ success: true, data: { journey: journeyRow } });",
  "    } catch (e) {",
  "      console.error('[journey/start]', e.message);",
  "      res.status(500).json({ success: false, error: { message: e.message } });",
  "    }",
  "  });",
  "",
  "  // POST /api/v1/truckers/my/journey/fuel-stop",
  "  app.post('/api/v1/truckers/my/journey/fuel-stop', async function(req, res) {",
  "    try {",
  "      var truckerId = getTruckerId(req);",
  "      var b = req.body;",
  "      if (!b.loadId || !b.fuelLiters || !b.fuelCost) return res.status(400).json({ success: false, error: { message: 'loadId, fuelLiters, fuelCost required' } });",
  "      var fsRes = await pool.query('INSERT INTO fuel_stops (load_id, trucker_id, fuel_liters, fuel_cost, odometer_km, fuel_station_name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [b.loadId, truckerId, b.fuelLiters, b.fuelCost, b.odometerKm||null, b.stationName||null]);",
  "      await pool.query('UPDATE journey_logs SET total_fuel_liters=COALESCE(total_fuel_liters,0)+$1, total_fuel_cost=COALESCE(total_fuel_cost,0)+$2 WHERE load_id=$3', [b.fuelLiters, b.fuelCost, b.loadId]);",
  "      res.json({ success: true, data: { fuelStop: fsRes.rows[0] } });",
  "    } catch (e) {",
  "      console.error('[journey/fuel-stop]', e.message);",
  "      res.status(500).json({ success: false, error: { message: e.message } });",
  "    }",
  "  });",
  "",
  "  // POST /api/v1/truckers/my/journey/deliver",
  "  app.post('/api/v1/truckers/my/journey/deliver', async function(req, res) {",
  "    try {",
  "      var truckerId = getTruckerId(req);",
  "      var b = req.body;",
  "      if (!b.loadId) return res.status(400).json({ success: false, error: { message: 'loadId required' } });",
  "      await pool.query(\"UPDATE loads SET status='delivered', updated_at=NOW() WHERE load_id=$1 AND trucker_id=$2\", [b.loadId, truckerId]);",
  "      var jSql = 'UPDATE journey_logs SET journey_status=$1, end_odometer_km=$2, actual_toll_cost=$3,' +",
  "        ' total_distance_km=CASE WHEN start_odometer_km IS NOT NULL AND $2 IS NOT NULL THEN ($2::numeric-start_odometer_km) ELSE NULL END,' +",
  "        ' journey_ended_at=NOW() WHERE load_id=$4 RETURNING *';",
  "      var jRes = await pool.query(jSql, ['completed', b.endOdometerKm||null, b.actualTollCost||null, b.loadId]);",
  "      res.json({ success: true, data: { journey: jRes.rows[0] || null } });",
  "    } catch (e) {",
  "      console.error('[journey/deliver]', e.message);",
  "      res.status(500).json({ success: false, error: { message: e.message } });",
  "    }",
  "  });",
  "",
  "  // GET /api/v1/truckers/my/journey/stats",
  "  app.get('/api/v1/truckers/my/journey/stats', async function(req, res) {",
  "    try {",
  "      var truckerId = getTruckerId(req);",
  "      var sql = 'SELECT' +",
  "        ' COUNT(*) FILTER (WHERE j.journey_status=$2) AS total_trips,' +",
  "        ' COALESCE(SUM(j.total_distance_km),0)::float AS total_km,' +",
  "        ' COALESCE(SUM(j.total_fuel_liters),0)::float AS total_fuel_liters,' +",
  "        ' COALESCE(SUM(j.total_fuel_cost),0)::float AS total_fuel_cost,' +",
  "        ' COALESCE(SUM(j.actual_toll_cost),0)::float AS total_toll_cost,' +",
  "        ' COALESCE(SUM(l.agreed_price),0)::float AS gross_earnings' +",
  "        ' FROM journey_logs j JOIN loads l ON l.load_id=j.load_id WHERE j.trucker_id=$1';",
  "      var r = await pool.query(sql, [truckerId, 'completed']);",
  "      var row = r.rows[0];",
  "      row.net_earnings = (row.gross_earnings||0) - (row.total_fuel_cost||0) - (row.total_toll_cost||0);",
  "      res.json({ success: true, data: row });",
  "    } catch (e) {",
  "      console.error('[journey/stats]', e.message);",
  "      res.status(500).json({ success: false, error: { message: e.message } });",
  "    }",
  "  });",
  "",
  "  console.log('[journey] 5 endpoints registered');",
  "};",
].join("\n");

// ── Load service: active load check ──────────────────────────────────────────
function patchLoadService() {
  console.log('[patch] Patching load service...');
  var appPath = '/app/dist/app.js';
  var src = fs.readFileSync(appPath, 'utf8');
  if (src.includes('ACTIVE_LOAD_EXISTS') || src.includes('active-load-check')) {
    console.log('[patch] Load service already patched');
    return;
  }
  var checkFn = [
    '',
    '// PATCHED: active load check endpoint',
    'app.get("/api/v1/loads/active-check/:truckerId", async function(req, res) {',
    '  try {',
    '    var tid = req.params.truckerId;',
    '    var r = await pool.query("SELECT load_id FROM loads WHERE trucker_id=$1 AND status=ANY($2) LIMIT 1",[tid,["accepted","loading","in_transit"]]);',
    '    res.json({ success: true, data: { hasActiveLoad: r.rows.length > 0, loadId: r.rows[0] ? r.rows[0].load_id : null } });',
    '  } catch(e) { res.status(500).json({ success: false, error: { message: e.message } }); }',
    '});',
    '',
  ].join('\n');

  // inject before app.listen or at end
  if (/app\.listen\s*\(/.test(src)) {
    src = src.replace(/app\.listen\s*\(/, checkFn + 'app.listen(');
  } else {
    src = src + checkFn;
  }
  fs.writeFileSync(appPath, src);
  console.log('[patch] Load service patched');
}

// ── Trucker service: journey endpoints ───────────────────────────────────────
function patchTruckerService() {
  console.log('[patch] Patching trucker service...');
  var appPath = '/app/dist/app.js';
  var routesPath = '/app/dist/journey-routes.js';

  var src = fs.readFileSync(appPath, 'utf8');
  if (src.includes('journey-routes') || src.includes('journey_logs')) {
    console.log('[patch] Trucker service already has journey routes');
    return;
  }

  // Write the routes file
  fs.writeFileSync(routesPath, JOURNEY_ROUTES_JS);
  console.log('[patch] Written journey-routes.js');

  // Inject require at end of app.js (before listen or at end)
  var requireLine = '\n// JOURNEY PATCH\ntry { require("/app/dist/journey-routes")(app); } catch(e){ console.error("[journey] load failed:", e.message); }\n';

  if (/app\.listen\s*\(/.test(src)) {
    src = src.replace(/app\.listen\s*\(/, requireLine + 'app.listen(');
  } else {
    src = src + requireLine;
  }
  fs.writeFileSync(appPath, src);
  console.log('[patch] Trucker service patched (require injected)');
}

// ── Main ─────────────────────────────────────────────────────────────────────
(function main() {
  if (MODE === 'load') {
    patchLoadService();
  } else if (MODE === 'trucker') {
    patchTruckerService();
  } else {
    console.log('Usage: node patch_journey_backend_v2.js [load|trucker]');
    process.exit(1);
  }
  console.log('[patch] Done');
})();
