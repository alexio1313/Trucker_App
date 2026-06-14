"use strict";
// enhanced.load.routes.js
// Deploy to: /app/dist/enhanced.load.routes.js inside truck_load_service container
// Register in dist/app.js BEFORE loadRoutes: app.use("/api/v1/loads", require("./enhanced.load.routes"));
// Then: docker restart truck_load_service

const { Router } = require('express');
const { query } = require('./db/postgres');
const https = require('https');
const http = require('http');

const router = Router();

// Fetch JSON from external URL (no npm dependencies)
function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'TruckPlatform/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from external API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// WMO weather codes → human-readable
const WMO = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Moderate showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm',
};

function weatherAdvisory(code, windKmh) {
  if (code >= 95) return '⛈️ Thunderstorm — avoid travel if possible';
  if (code >= 71) return '❄️ Snow on road — drive very slowly';
  if (code >= 61) return '🌧️ Rain — wet roads, increase following distance';
  if (code >= 45) return '🌫️ Fog — reduce speed, use headlights';
  if (windKmh > 60) return '💨 Strong winds — caution for heavy trucks';
  return null;
}

// ─── GET /api/v1/loads/backhaul ───────────────────────────────────────────────
// Return-trip load matching: finds loads to pick up near trucker's delivery point
// Query params: destLat, destLng — where trucker just delivered
//               homeLat?, homeLng? — trucker's home city (prioritises loads toward home)
//               pickupRadiusKm=150 — how far from dest to search for pickup
router.get('/backhaul', async (req, res) => {
  const { destLat, destLng, homeLat, homeLng } = req.query;
  const radiusKm = parseFloat(req.query.pickupRadiusKm || '150');
  const page = Math.max(1, parseInt(req.query.page || '1'));

  if (!destLat || !destLng) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'destLat and destLng are required' } });
  }

  const dLat = parseFloat(destLat);
  const dLng = parseFloat(destLng);
  const offset = (page - 1) * 10;

  try {
    let rows;
    if (homeLat && homeLng) {
      const hLat = parseFloat(homeLat);
      const hLng = parseFloat(homeLng);

      // Score = pickup_dist + 0.5 * dropoff_to_home (prefers close pickup + loads going toward home)
      rows = await query(`
        SELECT l.*,
          ROUND((6371 * acos(LEAST(1.0,
            cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(l.origin_lat))
          )))::numeric, 1) AS pickup_dist_km,
          ROUND((6371 * acos(LEAST(1.0,
            cos(radians($3)) * cos(radians(l.dest_lat)) * cos(radians(l.dest_lng) - radians($4)) +
            sin(radians($3)) * sin(radians(l.dest_lat))
          )))::numeric, 1) AS dropoff_to_home_km
        FROM loads l
        WHERE l.status = 'posted' AND l.deleted_at IS NULL
          AND (6371 * acos(LEAST(1.0,
            cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(l.origin_lat))
          ))) <= $5
        ORDER BY
          (6371 * acos(LEAST(1.0,
            cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(l.origin_lat))
          ))) +
          (6371 * acos(LEAST(1.0,
            cos(radians($3)) * cos(radians(l.dest_lat)) * cos(radians(l.dest_lng) - radians($4)) +
            sin(radians($3)) * sin(radians(l.dest_lat))
          ))) * 0.5 ASC
        LIMIT 10 OFFSET $6
      `, [dLat, dLng, hLat, hLng, radiusKm, offset]);
    } else {
      rows = await query(`
        SELECT l.*,
          ROUND((6371 * acos(LEAST(1.0,
            cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(l.origin_lat))
          )))::numeric, 1) AS pickup_dist_km,
          0 AS dropoff_to_home_km
        FROM loads l
        WHERE l.status = 'posted' AND l.deleted_at IS NULL
          AND (6371 * acos(LEAST(1.0,
            cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(l.origin_lat))
          ))) <= $3
        ORDER BY pickup_dist_km ASC
        LIMIT 10 OFFSET $4
      `, [dLat, dLng, radiusKm, offset]);
    }

    res.json({
      success: true,
      data: {
        loads: rows.map((r) => ({
          ...r,
          pickup_dist_km: parseFloat(r.pickup_dist_km),
          dropoff_to_home_km: parseFloat(r.dropoff_to_home_km),
          returnTripScore: Math.max(0, Math.round(100 - (parseFloat(r.pickup_dist_km) / radiusKm) * 60)),
        })),
        meta: { destLat: dLat, destLng: dLng, radiusKm, page },
      },
    });
  } catch (e) {
    console.error('[enhanced-loads] backhaul error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// ─── GET /api/v1/loads/nearby ────────────────────────────────────────────────
// Loads within radius of trucker's current GPS position
// Query: lat, lng, radiusKm=100, page=1
router.get('/nearby', async (req, res) => {
  const { lat, lng } = req.query;
  const radiusKm = parseFloat(req.query.radiusKm || '100');
  const page = Math.max(1, parseInt(req.query.page || '1'));

  if (!lat || !lng) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'lat and lng are required' } });
  }

  const cLat = parseFloat(lat);
  const cLng = parseFloat(lng);
  const offset = (page - 1) * 10;

  try {
    const rows = await query(`
      SELECT l.*,
        ROUND((6371 * acos(LEAST(1.0,
          cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
          sin(radians($1)) * sin(radians(l.origin_lat))
        )))::numeric, 1) AS pickup_dist_km
      FROM loads l
      WHERE l.status = 'posted' AND l.deleted_at IS NULL
        AND (6371 * acos(LEAST(1.0,
          cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
          sin(radians($1)) * sin(radians(l.origin_lat))
        ))) <= $3
      ORDER BY pickup_dist_km ASC
      LIMIT 10 OFFSET $4
    `, [cLat, cLng, radiusKm, offset]);

    res.json({
      success: true,
      data: {
        loads: rows.map((r) => ({ ...r, pickup_dist_km: parseFloat(r.pickup_dist_km) })),
        meta: { lat: cLat, lng: cLng, radiusKm, count: rows.length },
      },
    });
  } catch (e) {
    console.error('[enhanced-loads] nearby error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// ─── GET /api/v1/loads/en-route ──────────────────────────────────────────────
// Loads along planned route (detour ≤ 25% of total route distance)
// Query: originLat, originLng, destLat, destLng
router.get('/en-route', async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.query;

  if (!originLat || !originLng || !destLat || !destLng) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'originLat, originLng, destLat, destLng required' } });
  }

  const oLat = parseFloat(originLat), oLng = parseFloat(originLng);
  const dLat = parseFloat(destLat), dLng = parseFloat(destLng);

  try {
    // Get route distance first
    const [distRow] = await query(`
      SELECT ROUND((6371 * acos(LEAST(1.0,
        cos(radians($1)) * cos(radians($3)) * cos(radians($4) - radians($2)) +
        sin(radians($1)) * sin(radians($3))
      )))::numeric, 1) AS route_km
    `, [oLat, oLng, dLat, dLng]);

    const routeKm = parseFloat(distRow.route_km);
    const maxDetour = routeKm * 1.25; // 25% detour allowed

    // Loads where pickup is within 25% detour AND in the forward direction
    const rows = await query(`
      SELECT l.*,
        ROUND((6371 * acos(LEAST(1.0,
          cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
          sin(radians($1)) * sin(radians(l.origin_lat))
        )))::numeric, 1) AS origin_to_pickup_km,
        ROUND((6371 * acos(LEAST(1.0,
          cos(radians(l.origin_lat)) * cos(radians($3)) * cos(radians($4) - radians(l.origin_lng)) +
          sin(radians(l.origin_lat)) * sin(radians($3))
        )))::numeric, 1) AS pickup_to_dest_km
      FROM loads l
      WHERE l.status = 'posted' AND l.deleted_at IS NULL
        AND (
          (6371 * acos(LEAST(1.0,
            cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(l.origin_lat))
          ))) +
          (6371 * acos(LEAST(1.0,
            cos(radians(l.origin_lat)) * cos(radians($3)) * cos(radians($4) - radians(l.origin_lng)) +
            sin(radians(l.origin_lat)) * sin(radians($3))
          )))
        ) <= $5
        AND (6371 * acos(LEAST(1.0,
          cos(radians(l.origin_lat)) * cos(radians($3)) * cos(radians($4) - radians(l.origin_lng)) +
          sin(radians(l.origin_lat)) * sin(radians($3))
        ))) < (6371 * acos(LEAST(1.0,
          cos(radians($1)) * cos(radians(l.origin_lat)) * cos(radians(l.origin_lng) - radians($2)) +
          sin(radians($1)) * sin(radians(l.origin_lat))
        )))
      ORDER BY origin_to_pickup_km ASC
      LIMIT 10
    `, [oLat, oLng, dLat, dLng, maxDetour]);

    res.json({
      success: true,
      data: {
        loads: rows.map((r) => ({
          ...r,
          origin_to_pickup_km: parseFloat(r.origin_to_pickup_km),
          pickup_to_dest_km: parseFloat(r.pickup_to_dest_km),
        })),
        meta: { routeKm, maxDetourKm: parseFloat(maxDetour.toFixed(1)), count: rows.length },
      },
    });
  } catch (e) {
    console.error('[enhanced-loads] en-route error:', e.message);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// ─── GET /api/v1/loads/weather-route ─────────────────────────────────────────
// Weather at origin, midpoint, and destination using Open-Meteo (free, no key)
// Query: originLat, originLng, destLat, destLng
router.get('/weather-route', async (req, res) => {
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
          return {
            location: p.label, lat: p.lat, lng: p.lng,
            temperature: `${c.temperature_2m}°C`,
            windSpeed: `${c.wind_speed_10m} km/h`,
            humidity: `${c.relative_humidity_2m}%`,
            precipitation: `${c.precipitation} mm`,
            condition: WMO[c.weather_code] || `Code ${c.weather_code}`,
            weatherCode: c.weather_code,
            isAdverse: c.weather_code >= 45 || c.wind_speed_10m > 50,
            advisory: weatherAdvisory(c.weather_code, c.wind_speed_10m),
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
        overallAdvisory: forecasts.some((f) => f.isAdverse)
          ? 'Adverse weather detected on route — plan accordingly'
          : 'Good driving conditions along route',
        source: 'Open-Meteo (open-meteo.com) — free, no API key',
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    res.status(503).json({ success: false, error: { code: 'WEATHER_API_ERROR', message: 'Weather service unavailable' } });
  }
});

// ─── GET /api/v1/loads/fuel-stops ────────────────────────────────────────────
// Fuel stations along route using Overpass API (OpenStreetMap, free)
// Query: originLat, originLng, destLat, destLng
router.get('/fuel-stops', async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.query;

  if (!originLat || !originLng || !destLat || !destLng) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'originLat, originLng, destLat, destLng required' } });
  }

  const oLat = parseFloat(originLat), oLng = parseFloat(originLng);
  const dLat = parseFloat(destLat), dLng = parseFloat(destLng);
  // Query at midpoint for fuel stations within 25km
  const mLat = (oLat + dLat) / 2, mLng = (oLng + dLng) / 2;

  try {
    const overpassQuery = encodeURIComponent(
      `[out:json][timeout:10];node["amenity"="fuel"](around:25000,${mLat},${mLng});out 8;`,
    );
    const data = await fetchJson(`https://overpass-api.de/api/interpreter?data=${overpassQuery}`);

    const deg2rad = (d) => (d * Math.PI) / 180;
    const stations = (data.elements || [])
      .map((e) => {
        const dist = Math.round(
          6371 * Math.acos(Math.min(1,
            Math.cos(deg2rad(mLat)) * Math.cos(deg2rad(e.lat)) * Math.cos(deg2rad(e.lon) - deg2rad(mLng)) +
            Math.sin(deg2rad(mLat)) * Math.sin(deg2rad(e.lat)),
          )) * 10,
        ) / 10;
        return {
          name: e.tags.name || e.tags.brand || 'Fuel Station',
          brand: e.tags.brand || null,
          lat: e.lat, lng: e.lon,
          distFromMidKm: dist,
          openingHours: e.tags.opening_hours || null,
          isBpcl: /bharat|bpcl/i.test(e.tags.name || e.tags.brand || ''),
          isIocl: /indian oil|iocl/i.test(e.tags.name || e.tags.brand || ''),
          isHpcl: /hindustan|hpcl|hp petrol/i.test(e.tags.name || e.tags.brand || ''),
        };
      })
      .sort((a, b) => a.distFromMidKm - b.distFromMidKm);

    res.json({
      success: true,
      data: {
        stations,
        midpoint: { lat: mLat, lng: mLng },
        count: stations.length,
        source: 'OpenStreetMap/Overpass API',
        tip: 'FASTag accepted at all NHAI toll plazas — keep minimum ₹200 balance',
      },
    });
  } catch (e) {
    console.error('[enhanced-loads] fuel-stops error:', e.message);
    res.json({ success: true, data: { stations: [], count: 0, note: 'Overpass API temporarily unavailable' } });
  }
});

module.exports = router;
