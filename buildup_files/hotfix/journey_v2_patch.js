'use strict';
const { Router } = require('express');
const { query, queryOne } = require('./db/postgres');

const router = Router();
function getUserId(req) { return req.headers['x-user-id']; }

// POST /api/v1/truckers/my/journey/arrived-pickup
router.post('/arrived-pickup', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { loadId, lat, lng } = req.body;
    if (!loadId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId required' } });
    const load = await queryOne('SELECT loading_arrangement, detention_rate_per_hour FROM loads WHERE load_id=$1', [loadId]);
    if (!load) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found' } });

    const gracePeriodEnd = new Date(Date.now() + 30 * 60 * 1000);
    const job = await queryOne(
      `INSERT INTO loading_jobs (load_id, arrangement_type, arranged_by_user_id, trucker_arrival_time, detention_started_at, detention_rate_per_hour)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       ON CONFLICT DO NOTHING RETURNING *`,
      [loadId, load.loading_arrangement, userId, load.loading_arrangement === 'merchant_arranged' ? gracePeriodEnd : null, load.detention_rate_per_hour || 75]
    );
    res.json({
      success: true,
      data: {
        arrivalTime: new Date().toISOString(),
        detentionStartsAt: load.loading_arrangement === 'merchant_arranged' ? gracePeriodEnd.toISOString() : null,
        message: load.loading_arrangement === 'merchant_arranged'
          ? `Merchant notified. Detention charges of ₹${load.detention_rate_per_hour || 75}/hr apply after 30 minutes.`
          : 'Arrival recorded.',
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/loading-complete
router.post('/loading-complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { loadId, itemsLoaded, weightTonnes, issues } = req.body;
    const job = await queryOne('SELECT * FROM loading_jobs WHERE load_id=$1 ORDER BY created_at DESC LIMIT 1', [loadId]);
    if (!job) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loading job not found' } });

    const now = new Date();
    let detentionMinutes = 0;
    let detentionCost = 0;
    if (job.detention_started_at) {
      const detentionMs = now.getTime() - new Date(job.detention_started_at).getTime();
      detentionMinutes = Math.max(0, Math.floor(detentionMs / 60000));
      detentionCost = (detentionMinutes / 60) * parseFloat(job.detention_rate_per_hour || 75);
    }

    const updated = await queryOne(
      `UPDATE loading_jobs SET loading_completed_at=NOW(), items_loaded=$1, weight_loaded_tonnes=$2,
       issue_notes=$3, detention_minutes=$4, detention_cost=$5, trucker_sign_off=true
       WHERE id=$6 RETURNING *`,
      [itemsLoaded || null, weightTonnes || null, issues || null, detentionMinutes, detentionCost, job.id]
    );

    res.json({
      success: true,
      data: {
        completedAt: now.toISOString(),
        detentionMinutes,
        detentionCost: detentionCost.toFixed(2),
        message: `Loading complete. Detention: ₹${detentionCost.toFixed(0)} (${detentionMinutes} mins)`,
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loads/:loadId/detention-status
router.get('/detention-status', async (req, res) => {
  try {
    const { loadId } = req.query;
    const job = await queryOne('SELECT * FROM loading_jobs WHERE load_id=$1 ORDER BY created_at DESC LIMIT 1', [loadId]);
    if (!job || !job.detention_started_at) {
      return res.json({ success: true, data: { detentionRunning: false, minutesElapsed: 0, costSoFar: 0, ratePerHour: 75 } });
    }
    const now = Date.now();
    const started = new Date(job.detention_started_at).getTime();
    const minutesElapsed = job.loading_completed_at ? job.detention_minutes : Math.max(0, Math.floor((now - started) / 60000));
    const costSoFar = (minutesElapsed / 60) * parseFloat(job.detention_rate_per_hour || 75);
    res.json({
      success: true,
      data: {
        detentionRunning: !job.loading_completed_at,
        minutesElapsed,
        costSoFar: parseFloat(costSoFar.toFixed(2)),
        ratePerHour: parseFloat(job.detention_rate_per_hour || 75),
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/toll
router.post('/toll', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { loadId, journeyLogId, plazaName, highwayCode, stateName, amountPaid, paymentMethod, plazaLat, plazaLng } = req.body;
    if (!loadId || !plazaName || !amountPaid) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId, plazaName, amountPaid required' } });
    const crossing = await queryOne(
      `INSERT INTO toll_crossings (journey_log_id, load_id, plaza_name, plaza_lat, plaza_lng, highway_code, state_name, crossing_time, amount_paid, payment_method, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,'driver_manual') RETURNING *`,
      [journeyLogId, loadId, plazaName, plazaLat || null, plazaLng || null, highwayCode || null, stateName || null, parseFloat(amountPaid), paymentMethod || 'fastag']
    );
    res.status(201).json({ success: true, data: { id: crossing.id, plazaName, amountPaid: crossing.amount_paid, crossingTime: crossing.crossing_time } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loads/:loadId/toll-log
router.get('/toll-log', async (req, res) => {
  try {
    const { loadId } = req.query;
    const crossings = await query('SELECT * FROM toll_crossings WHERE load_id=$1 ORDER BY crossing_time DESC', [loadId]);
    res.json({
      success: true,
      data: crossings.map((c) => ({
        id: c.id, plazaName: c.plaza_name, stateName: c.state_name, highwayCode: c.highway_code,
        crossingTime: c.crossing_time, amountPaid: c.amount_paid, paymentMethod: c.payment_method, source: c.source,
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/weighbridge
router.post('/weighbridge', async (req, res) => {
  try {
    const { loadId, journeyLogId, locationName, locationLat, locationLng, weightRecordedTonnes, gvwLimitTonnes, fineAmount, notes } = req.body;
    if (!loadId || !locationName) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId, locationName required' } });
    const fine = parseFloat(fineAmount || 0);
    const weight = parseFloat(weightRecordedTonnes || 0);
    const gvw = parseFloat(gvwLimitTonnes || 0);
    const status = fine > 0 ? 'fined' : (gvw > 0 && weight > gvw) ? 'overloaded' : 'pass';
    const stop = await queryOne(
      `INSERT INTO weighbridge_stops (journey_log_id, load_id, location_name, location_lat, location_lng, stop_time, weight_recorded_tonnes, gvw_limit_tonnes, status, fine_amount, notes)
       VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9,$10) RETURNING *`,
      [journeyLogId, loadId, locationName, locationLat || null, locationLng || null, weight, gvw || null, status, fine, notes || null]
    );
    res.status(201).json({ success: true, data: { id: stop.id, locationName, weightRecordedTonnes: weight, status, fineAmount: fine } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loads/:loadId/weight-log
router.get('/weight-log', async (req, res) => {
  try {
    const { loadId } = req.query;
    const stops = await query('SELECT * FROM weighbridge_stops WHERE load_id=$1 ORDER BY stop_time DESC', [loadId]);
    res.json({
      success: true,
      data: stops.map((s) => ({
        id: s.id, locationName: s.location_name, stateName: s.state_name,
        stopTime: s.stop_time, weightRecordedTonnes: s.weight_recorded_tonnes,
        gvwLimitTonnes: s.gvw_limit_tonnes, status: s.status, fineAmount: s.fine_amount,
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/state-crossing
router.post('/state-crossing', async (req, res) => {
  try {
    const { loadId, journeyLogId, fromState, toState, crossingLat, crossingLng, nakaType, entryTaxPaid } = req.body;
    const crossing = await queryOne(
      `INSERT INTO state_crossings (journey_log_id, load_id, from_state, to_state, crossing_lat, crossing_lng, crossing_time, naka_type, entry_tax_paid)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8) RETURNING *`,
      [journeyLogId, loadId, fromState || null, toState || null, crossingLat || null, crossingLng || null, nakaType || 'border', parseFloat(entryTaxPaid || 0)]
    );
    res.status(201).json({ success: true, data: { id: crossing.id, fromState, toState, crossingTime: crossing.crossing_time } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/truckers/my/journey/break-suggestions
router.get('/break-suggestions', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { journeyLogId } = req.query;
    if (!journeyLogId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'journeyLogId required' } });

    const lastBreak = await queryOne('SELECT ended_at FROM trip_breaks WHERE journey_log_id=$1 ORDER BY ended_at DESC LIMIT 1', [journeyLogId]);
    const journeyStart = await queryOne('SELECT started_at FROM journey_logs WHERE id=$1', [journeyLogId]);
    const breaks = await query("SELECT break_type, ended_at FROM trip_breaks WHERE journey_log_id=$1 AND status='completed' ORDER BY ended_at DESC", [journeyLogId]);

    const now = new Date();
    const lastBreakTime = lastBreak?.ended_at ? new Date(lastBreak.ended_at) : (journeyStart?.started_at ? new Date(journeyStart.started_at) : now);
    const drivingSinceHours = (now.getTime() - lastBreakTime.getTime()) / 3600000;
    const currentHourIST = (now.getUTCHours() + 5.5) % 24;
    const todayMealBreaks = breaks.filter((b) => b.break_type === 'meal' && new Date(b.ended_at).toDateString() === now.toDateString()).length;

    const suggestions = [];

    if (drivingSinceHours >= 4) {
      suggestions.push({ type: 'rest', priority: 1, reason: 'Mandatory rest (Motor Vehicles Act)', complianceRule: 'MOTOR_VEHICLES_ACT_REST', suggestedKm: null });
    }

    if (drivingSinceHours >= 6 && todayMealBreaks === 0) {
      suggestions.push({ type: 'meal', priority: 3, reason: `Meal break — ${Math.floor(drivingSinceHours)}+ hours driving`, complianceRule: 'MEAL_TIME' });
    }

    if (currentHourIST >= 21 || currentHourIST < 5) {
      suggestions.push({ type: 'rest', priority: 2, reason: 'Night driving — consider stopping', complianceRule: 'NIGHT_SAFETY' });
    }

    suggestions.sort((a, b) => a.priority - b.priority);

    const existingIds = await query('SELECT break_type FROM break_suggestions WHERE journey_log_id=$1 AND accepted=false AND skipped=false', [journeyLogId]);
    const existingTypes = new Set(existingIds.map((s) => s.break_type));

    for (const s of suggestions) {
      if (!existingTypes.has(s.type)) {
        await query(
          'INSERT INTO break_suggestions (journey_log_id, break_type, reason, compliance_rule, priority) VALUES ($1,$2,$3,$4,$5)',
          [journeyLogId, s.type, s.reason, s.complianceRule, s.priority]
        );
      }
    }

    res.json({ success: true, data: suggestions });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/break-start
router.post('/break-start', async (req, res) => {
  try {
    const { journeyLogId, breakType, locationName, lat, lng } = req.body;
    if (!journeyLogId || !breakType) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'journeyLogId, breakType required' } });
    const breakRecord = await queryOne(
      "INSERT INTO trip_breaks (journey_log_id, break_type, location_name, location_lat, location_lng, started_at, status) VALUES ($1,$2,$3,$4,$5,NOW(),'in_progress') RETURNING *",
      [journeyLogId, breakType, locationName || null, lat || null, lng || null]
    );
    await query('UPDATE break_suggestions SET accepted=true, accepted_at=NOW() WHERE journey_log_id=$1 AND break_type=$2 AND accepted=false', [journeyLogId, breakType]);
    res.status(201).json({ success: true, data: { id: breakRecord.id, breakType, startedAt: breakRecord.started_at } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/truckers/my/journey/break-end
router.post('/break-end', async (req, res) => {
  try {
    const { breakId, journeyLogId } = req.body;
    if (!breakId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'breakId required' } });
    const breakRecord = await queryOne(
      "UPDATE trip_breaks SET ended_at=NOW(), status='completed', duration_minutes=EXTRACT(EPOCH FROM (NOW()-started_at))/60 WHERE id=$1 RETURNING *",
      [breakId]
    );
    const durationMins = Math.round(parseFloat(breakRecord.duration_minutes || 0));
    if (durationMins > 30 && journeyLogId) {
      // Would emit Kafka event for ETA recalculation
    }
    res.json({ success: true, data: { durationMinutes: durationMins, endedAt: breakRecord.ended_at } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/truckers/my/journey/eta
router.get('/eta', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { journeyLogId, loadId } = req.query;
    const jl = await queryOne('SELECT * FROM journey_logs WHERE id=$1 OR load_id=$2 ORDER BY created_at DESC LIMIT 1', [journeyLogId || null, loadId || null]);
    if (!jl) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journey not found' } });

    const load = await queryOne('SELECT * FROM loads WHERE load_id=$1', [jl.load_id]);
    const totalDrivingHours = jl.started_at ? (Date.now() - new Date(jl.started_at).getTime()) / 3600000 : 0;

    const remainingKm = parseFloat(jl.remaining_km || load?.distance_km || 100);
    const avgSpeed = 45;
    const now = new Date();
    const hourIST = (now.getUTCHours() + 5.5) % 24;
    const trafficMultiplier = (hourIST >= 6 && hourIST <= 10) || (hourIST >= 16 && hourIST <= 21) ? 1.3 : (hourIST >= 22 || hourIST < 5) ? 1.1 : 1.0;

    const drivingMins = Math.round((remainingKm / avgSpeed) * 60 * trafficMultiplier);
    const trafficDelayMins = Math.round(drivingMins * (trafficMultiplier - 1));
    const pendingSuggestions = await query("SELECT break_type FROM break_suggestions WHERE journey_log_id=$1 AND accepted=false AND skipped=false", [jl.id]);
    const pendingBreaksMins = pendingSuggestions.reduce((acc, s) => {
      if (s.break_type === 'fuel') return acc + 15;
      if (s.break_type === 'meal') return acc + 45;
      if (s.break_type === 'rest') return acc + 30;
      return acc;
    }, 0);
    const fatigueMins = totalDrivingHours > 8 ? Math.round((totalDrivingHours - 8) * 5) : 0;
    const totalMins = drivingMins + pendingBreaksMins + fatigueMins;
    const newETA = new Date(Date.now() + totalMins * 60000);

    const originalETA = load?.expected_delivery ? new Date(load.expected_delivery) : null;
    const delayVsOriginal = originalETA ? Math.round((newETA.getTime() - originalETA.getTime()) / 60000) : 0;

    if (delayVsOriginal > 30) {
      // Would emit Kafka event 'journey.eta-delayed'
    }

    res.json({
      success: true,
      data: {
        newETA: newETA.toISOString(),
        originalETA: originalETA?.toISOString() || null,
        remainingKm,
        delayVsOriginal,
        breakdown: { drivingMins, pendingBreaksMins, trafficDelayMins, fatigueMins },
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

module.exports = router;
