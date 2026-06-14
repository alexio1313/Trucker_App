// Journey management routes -- auto-patched
var pg = require('pg');
module.exports = function registerJourneyRoutes(app) {
  var pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  function getTruckerId(req) {
    return req.headers['x-user-id'] || (req.user && (req.user.userId || req.user.user_id));
  }

  // Create tables
  pool.query(
    'CREATE TABLE IF NOT EXISTS journey_logs (' +
    '  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' +
    '  load_id UUID NOT NULL,' +
    '  trucker_id UUID NOT NULL,' +
    "  journey_status VARCHAR(30) NOT NULL DEFAULT 'not_started'," +
    '  start_odometer_km NUMERIC(10,2),' +
    '  end_odometer_km NUMERIC(10,2),' +
    '  total_distance_km NUMERIC(10,2),' +
    '  total_fuel_liters NUMERIC(10,2) DEFAULT 0,' +
    '  total_fuel_cost NUMERIC(12,2) DEFAULT 0,' +
    '  actual_toll_cost NUMERIC(12,2),' +
    '  journey_started_at TIMESTAMPTZ,' +
    '  journey_ended_at TIMESTAMPTZ,' +
    '  created_at TIMESTAMPTZ DEFAULT NOW()' +
    ')'
  ).then(function() {
    return pool.query(
      'CREATE TABLE IF NOT EXISTS fuel_stops (' +
      '  stop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),' +
      '  load_id UUID NOT NULL,' +
      '  trucker_id UUID NOT NULL,' +
      '  fuel_liters NUMERIC(8,2) NOT NULL,' +
      '  fuel_cost NUMERIC(10,2) NOT NULL,' +
      '  odometer_km NUMERIC(10,2),' +
      '  fuel_station_name TEXT,' +
      '  logged_at TIMESTAMPTZ DEFAULT NOW()' +
      ')'
    );
  }).then(function() {
    console.log('[journey] DB tables ready');
  }).catch(function(e) {
    console.error('[journey] table init error:', e.message);
  });

  // GET /api/v1/truckers/my/active-load
  app.get('/api/v1/truckers/my/active-load', function(req, res) {
    var tid = getTruckerId(req);
    if (!tid) return res.status(401).json({success:false,error:{message:'Unauthorized'}});
    var sql = 'SELECT l.load_id, l.origin_city, l.dest_city, l.origin_address, l.dest_address,' +
      ' l.origin_lat::float, l.origin_lng::float, l.dest_lat::float, l.dest_lng::float,' +
      ' l.origin_state, l.dest_state, l.cargo_type, l.cargo_weight_kg,' +
      ' l.agreed_price::float, l.distance_km::float, l.status,' +
      ' l.origin_contact_name, l.origin_contact_phone, l.dest_contact_name, l.dest_contact_phone' +
      ' FROM loads l WHERE l.trucker_id=$1 AND l.status=ANY($2)' +
      ' ORDER BY l.updated_at DESC LIMIT 1';
    pool.query(sql, [tid, ['accepted','loading','in_transit']])
      .then(function(lr) {
        if (!lr.rows.length) return res.json({success:true,data:{load:null,journey:null,fuelStops:[]}});
        var load = lr.rows[0];
        return Promise.all([
          pool.query('SELECT * FROM journey_logs WHERE load_id=$1 ORDER BY created_at DESC LIMIT 1', [load.load_id]),
          pool.query('SELECT * FROM fuel_stops WHERE load_id=$1 ORDER BY logged_at ASC', [load.load_id])
        ]).then(function(results) {
          res.json({success:true,data:{load:load,journey:results[0].rows[0]||null,fuelStops:results[1].rows}});
        });
      })
      .catch(function(e) { res.status(500).json({success:false,error:{message:e.message}}); });
  });

  // POST /api/v1/truckers/my/journey/start
  app.post('/api/v1/truckers/my/journey/start', function(req, res) {
    var tid = getTruckerId(req);
    var loadId = req.body.loadId;
    var startOdo = req.body.startOdometerKm || null;
    if (!loadId) return res.status(400).json({success:false,error:{message:'loadId required'}});
    pool.query('SELECT load_id FROM loads WHERE load_id=$1 AND trucker_id=$2 AND status=ANY($3)',
      [loadId, tid, ['accepted','loading']])
      .then(function(ck) {
        if (!ck.rows.length) {
          res.status(404).json({success:false,error:{message:'Load not found or already started'}});
          return null;
        }
        return pool.query("UPDATE loads SET status='in_transit',updated_at=NOW() WHERE load_id=$1", [loadId])
          .then(function() {
            return pool.query('SELECT log_id FROM journey_logs WHERE load_id=$1', [loadId]);
          })
          .then(function(ex) {
            if (ex.rows.length) {
              return pool.query(
                "UPDATE journey_logs SET journey_status='in_progress',start_odometer_km=$1,journey_started_at=NOW() WHERE load_id=$2 RETURNING *",
                [startOdo, loadId]
              );
            } else {
              return pool.query(
                "INSERT INTO journey_logs(load_id,trucker_id,journey_status,start_odometer_km,journey_started_at) VALUES($1,$2,'in_progress',$3,NOW()) RETURNING *",
                [loadId, tid, startOdo]
              );
            }
          })
          .then(function(jr) { res.json({success:true,data:{journey:jr.rows[0]}}); });
      })
      .catch(function(e) { res.status(500).json({success:false,error:{message:e.message}}); });
  });

  // POST /api/v1/truckers/my/journey/fuel-stop
  app.post('/api/v1/truckers/my/journey/fuel-stop', function(req, res) {
    var tid = getTruckerId(req);
    var b = req.body;
    if (!b.loadId || !b.fuelLiters || !b.fuelCost) {
      return res.status(400).json({success:false,error:{message:'loadId, fuelLiters, fuelCost required'}});
    }
    pool.query(
      'INSERT INTO fuel_stops(load_id,trucker_id,fuel_liters,fuel_cost,odometer_km,fuel_station_name) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [b.loadId, tid, b.fuelLiters, b.fuelCost, b.odometerKm||null, b.stationName||null]
    ).then(function(fr) {
      return pool.query(
        'UPDATE journey_logs SET total_fuel_liters=COALESCE(total_fuel_liters,0)+$1,total_fuel_cost=COALESCE(total_fuel_cost,0)+$2 WHERE load_id=$3',
        [b.fuelLiters, b.fuelCost, b.loadId]
      ).then(function() { res.json({success:true,data:{fuelStop:fr.rows[0]}}); });
    }).catch(function(e) { res.status(500).json({success:false,error:{message:e.message}}); });
  });

  // POST /api/v1/truckers/my/journey/deliver
  app.post('/api/v1/truckers/my/journey/deliver', function(req, res) {
    var tid = getTruckerId(req);
    var b = req.body;
    if (!b.loadId) return res.status(400).json({success:false,error:{message:'loadId required'}});
    pool.query("UPDATE loads SET status='delivered',updated_at=NOW() WHERE load_id=$1 AND trucker_id=$2",
      [b.loadId, tid])
      .then(function() {
        return pool.query(
          'UPDATE journey_logs SET journey_status=$1,end_odometer_km=$2,actual_toll_cost=$3,' +
          'total_distance_km=CASE WHEN start_odometer_km IS NOT NULL AND $2 IS NOT NULL THEN ($2::numeric-start_odometer_km) ELSE NULL END,' +
          'journey_ended_at=NOW() WHERE load_id=$4 RETURNING *',
          ['completed', b.endOdometerKm||null, b.actualTollCost||null, b.loadId]
        );
      })
      .then(function(jr) { res.json({success:true,data:{journey:jr.rows[0]||null}}); })
      .catch(function(e) { res.status(500).json({success:false,error:{message:e.message}}); });
  });

  // GET /api/v1/truckers/my/journey/stats
  app.get('/api/v1/truckers/my/journey/stats', function(req, res) {
    var tid = getTruckerId(req);
    var sql = 'SELECT COUNT(*) FILTER (WHERE j.journey_status=$2) AS total_trips,' +
      ' COALESCE(SUM(j.total_distance_km),0)::float AS total_km,' +
      ' COALESCE(SUM(j.total_fuel_liters),0)::float AS total_fuel_liters,' +
      ' COALESCE(SUM(j.total_fuel_cost),0)::float AS total_fuel_cost,' +
      ' COALESCE(SUM(j.actual_toll_cost),0)::float AS total_toll_cost,' +
      ' COALESCE(SUM(l.agreed_price),0)::float AS gross_earnings' +
      ' FROM journey_logs j JOIN loads l ON l.load_id=j.load_id WHERE j.trucker_id=$1';
    pool.query(sql, [tid, 'completed'])
      .then(function(r) {
        var row = r.rows[0];
        row.net_earnings = (parseFloat(row.gross_earnings)||0) - (parseFloat(row.total_fuel_cost)||0) - (parseFloat(row.total_toll_cost)||0);
        res.json({success:true,data:row});
      })
      .catch(function(e) { res.status(500).json({success:false,error:{message:e.message}}); });
  });

  console.log('[journey] 5 endpoints registered: active-load, start, fuel-stop, deliver, stats');
};
