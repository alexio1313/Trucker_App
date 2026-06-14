"use strict";
// trucker.intel.routes.js
// Deploy to: /app/dist/trucker.intel.routes.js inside truck_trucker_service container
// Register in dist/app.js BEFORE the 404 handler: app.use("/api/v1/truckers", require("./trucker.intel.routes"));
// Then: docker restart truck_trucker_service

const { Router } = require('express');
const { query } = require('./db/postgres');
const https = require('https');
const http = require('http');

const router = Router();

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'TruckPlatform/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Moderate showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm',
};

// ─── GET /api/v1/truckers/document-alerts ────────────────────────────────────
// Returns truckers with documents expiring within 60 days (or already expired)
// No auth required (admin internal use)
router.get('/document-alerts', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT
        u.user_id, u.full_name, u.phone_number, u.kyc_status,
        t.truck_id, t.registration_no,
        COALESCE(t.make, '') AS make,
        COALESCE(t.model, '') AS model,
        t.insurance_expiry::text,
        t.permit_expiry::text,
        t.fitness_expiry::text,
        (t.insurance_expiry - CURRENT_DATE) AS insurance_days_left,
        (t.permit_expiry    - CURRENT_DATE) AS permit_days_left,
        (t.fitness_expiry   - CURRENT_DATE) AS fitness_days_left,
        CASE
          WHEN t.insurance_expiry <= CURRENT_DATE THEN 'expired'
          WHEN t.insurance_expiry <= CURRENT_DATE + INTERVAL '7 days'  THEN 'critical'
          WHEN t.insurance_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
          ELSE 'ok'
        END AS insurance_alert,
        CASE
          WHEN t.permit_expiry <= CURRENT_DATE THEN 'expired'
          WHEN t.permit_expiry <= CURRENT_DATE + INTERVAL '7 days'  THEN 'critical'
          WHEN t.permit_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
          ELSE 'ok'
        END AS permit_alert,
        CASE
          WHEN t.fitness_expiry <= CURRENT_DATE THEN 'expired'
          WHEN t.fitness_expiry <= CURRENT_DATE + INTERVAL '7 days'  THEN 'critical'
          WHEN t.fitness_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning'
          ELSE 'ok'
        END AS fitness_alert
      FROM users u
      JOIN trucks t ON t.trucker_id = u.user_id AND t.deleted_at IS NULL
      WHERE u.user_type = 'trucker' AND u.deleted_at IS NULL
        AND (
          (t.insurance_expiry IS NOT NULL AND t.insurance_expiry <= CURRENT_DATE + INTERVAL '60 days') OR
          (t.permit_expiry    IS NOT NULL AND t.permit_expiry    <= CURRENT_DATE + INTERVAL '60 days') OR
          (t.fitness_expiry   IS NOT NULL AND t.fitness_expiry   <= CURRENT_DATE + INTERVAL '60 days')
        )
      ORDER BY LEAST(
        COALESCE(t.insurance_expiry, '2099-01-01'::date),
        COALESCE(t.permit_expiry,    '2099-01-01'::date),
        COALESCE(t.fitness_expiry,   '2099-01-01'::date)
      ) ASC
      LIMIT 100
    `);

    // Summary counts
    const summary = rows.reduce((acc, r) => {
      if (['insurance_alert', 'permit_alert', 'fitness_alert'].some(k => r[k] === 'expired')) acc.expired++;
      else if (['insurance_alert', 'permit_alert', 'fitness_alert'].some(k => r[k] === 'critical')) acc.critical++;
      else acc.warning++;
      return acc;
    }, { expired: 0, critical: 0, warning: 0 });

    res.json({ success: true, data: { alerts: rows, summary, total: rows.length } });
  } catch (e) {
    console.error('[trucker-intel] document-alerts error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// ─── GET /api/v1/truckers/live-positions ─────────────────────────────────────
// All active truckers with GPS positions for admin live map
router.get('/live-positions', async (_req, res) => {
  try {
    const rows = await query(`
      SELECT DISTINCT ON (u.user_id)
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
      LIMIT 200
    `);

    res.json({ success: true, data: { truckers: rows, count: rows.length, updatedAt: new Date().toISOString() } });
  } catch (e) {
    console.error('[trucker-intel] live-positions error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// ─── GET /api/v1/truckers/route-weather ──────────────────────────────────────
// Weather at origin, midpoint, destination using Open-Meteo (free, no API key)
// Query: originLat, originLng, destLat?, destLng?
router.get('/route-weather', async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.query;

  if (!originLat || !originLng) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'originLat and originLng required' } });
  }

  const oLat = parseFloat(originLat), oLng = parseFloat(originLng);
  const fields = 'temperature_2m,wind_speed_10m,weather_code,precipitation,relative_humidity_2m';

  const points = [{ lat: oLat, lng: oLng, label: 'Origin' }];
  if (destLat && destLng) {
    const dLat = parseFloat(destLat), dLng = parseFloat(destLng);
    points.push({ lat: (oLat + dLat) / 2, lng: (oLng + dLng) / 2, label: 'Midpoint' });
    points.push({ lat: dLat, lng: dLng, label: 'Destination' });
  }

  try {
    const forecasts = await Promise.all(
      points.map(async (p) => {
        try {
          const data = await fetchJson(
            `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&current=${fields}&timezone=auto`,
          );
          const c = data.current;
          const advisory = c.weather_code >= 95 ? '⛈️ Thunderstorm — avoid travel if possible' :
            c.weather_code >= 71 ? '❄️ Snow on road — drive very slowly' :
            c.weather_code >= 61 ? '🌧️ Rain — wet roads, increase following distance' :
            c.weather_code >= 45 ? '🌫️ Fog — reduce speed, use headlights' :
            c.wind_speed_10m > 60 ? '💨 Strong winds — caution for heavy trucks' : null;

          return {
            location: p.label, lat: p.lat, lng: p.lng,
            temperature: `${c.temperature_2m}°C`,
            windSpeed: `${c.wind_speed_10m} km/h`,
            humidity: `${c.relative_humidity_2m}%`,
            precipitation: `${c.precipitation} mm`,
            condition: WMO[c.weather_code] || `Code ${c.weather_code}`,
            weatherCode: c.weather_code,
            isAdverse: c.weather_code >= 45 || c.wind_speed_10m > 50,
            advisory,
          };
        } catch {
          return { location: p.label, lat: p.lat, lng: p.lng, error: 'Weather temporarily unavailable' };
        }
      }),
    );

    res.json({
      success: true,
      data: {
        forecasts,
        hasAdverseWeather: forecasts.some((f) => f.isAdverse),
        overallAdvisory: forecasts.some((f) => f.isAdverse) ? 'Adverse weather detected — plan carefully' : 'Good driving conditions',
        source: 'Open-Meteo (open-meteo.com) — free, no API key required',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(503).json({ success: false, error: { code: 'WEATHER_API_ERROR', message: 'Weather service unavailable' } });
  }
});

// ─── GET /api/v1/truckers/fleet-summary ──────────────────────────────────────
// Admin fleet overview: counts by status, today's completions, active loads
router.get('/fleet-summary', async (_req, res) => {
  try {
    const [statusCounts, todayStats, topTruckers] = await Promise.all([
      query(`
        SELECT t.status, COUNT(*)::int AS count
        FROM trucks t
        JOIN users u ON u.user_id = t.trucker_id AND u.user_type = 'trucker' AND u.deleted_at IS NULL
        WHERE t.deleted_at IS NULL
        GROUP BY t.status
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_today,
          COUNT(*) FILTER (WHERE status = 'in_transit')::int AS in_transit,
          COUNT(*) FILTER (WHERE status = 'posted')::int AS available_loads,
          COALESCE(SUM(agreed_price) FILTER (WHERE status = 'delivered'), 0)::float AS revenue_today
        FROM loads
        WHERE deleted_at IS NULL
          AND (status = 'in_transit' OR (status = 'delivered' AND delivery_confirmed_at >= CURRENT_DATE))
      `),
      query(`
        SELECT u.user_id, u.full_name, u.rating::float,
          COUNT(l.load_id)::int AS loads_this_month,
          COALESCE(SUM(l.net_trucker_earning), 0)::float AS earnings_this_month
        FROM users u
        JOIN loads l ON l.trucker_id = u.user_id AND l.status = 'delivered'
          AND l.delivery_confirmed_at >= date_trunc('month', CURRENT_DATE)
        WHERE u.user_type = 'trucker' AND u.deleted_at IS NULL
        GROUP BY u.user_id, u.full_name, u.rating
        ORDER BY loads_this_month DESC
        LIMIT 5
      `),
    ]);

    res.json({
      success: true,
      data: {
        fleetStatus: statusCounts,
        todayStats: todayStats[0],
        topTruckers,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[trucker-intel] fleet-summary error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

module.exports = router;
