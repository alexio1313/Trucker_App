'use strict';
const { Router } = require('express');
const { query, queryOne } = require('./db/postgres');

const router = Router();
function getUserId(req) { return req.headers['x-user-id']; }

// POST /api/v1/highway/register
router.post('/register', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { businessName, category, phone, gstNumber, fssaiNumber, locationLat, locationLng, address, highwayName, facilities, photos, isOpen24hr } = req.body;
    if (!businessName || !category || !locationLat || !locationLng) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'businessName, category, locationLat, locationLng required' } });
    }
    const existing = await queryOne('SELECT id FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (existing) return res.status(409).json({ success: false, error: { code: 'ALREADY_REGISTERED', message: 'Already registered a highway business' } });

    const biz = await queryOne(
      `INSERT INTO highway_businesses (owner_id, business_name, category, phone, gst_number, fssai_number, location_lat, location_lng, address, highway_name, facilities, photos, is_open_24hr, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending') RETURNING *`,
      [userId, businessName, category, phone || null, gstNumber || null, fssaiNumber || null, locationLat, locationLng, address || null, highwayName || null, JSON.stringify(facilities || {}), photos || [], isOpen24hr || false]
    );
    await query("UPDATE users SET user_type = 'highway_business' WHERE user_id = $1", [userId]);
    res.status(201).json({ success: true, data: biz });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/highway/me
router.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    const biz = await queryOne('SELECT * FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (!biz) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    res.json({ success: true, data: serialize(biz) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// PUT /api/v1/highway/me
router.put('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { businessName, phone, address, highwayName, facilities, isOpen24hr } = req.body;
    const biz = await queryOne(
      `UPDATE highway_businesses SET business_name=COALESCE($1,business_name), phone=COALESCE($2,phone), address=COALESCE($3,address), highway_name=COALESCE($4,highway_name), facilities=COALESCE($5,facilities), is_open_24hr=COALESCE($6,is_open_24hr) WHERE owner_id=$7 RETURNING *`,
      [businessName, phone, address, highwayName, facilities ? JSON.stringify(facilities) : null, isOpen24hr, userId]
    );
    res.json({ success: true, data: serialize(biz) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// PATCH /api/v1/highway/me/status
router.patch('/me/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { currentStatus } = req.body;
    if (!['open', 'closed', 'busy'].includes(currentStatus)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Status must be open, closed, or busy' } });
    }
    await query('UPDATE highway_businesses SET current_status=$1 WHERE owner_id=$2', [currentStatus, userId]);
    res.json({ success: true, data: { currentStatus } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/highway/subscription
router.post('/subscription', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { tier } = req.body;
    if (!['free', 'basic', 'standard', 'premium'].includes(tier)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid tier' } });
    }
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query('UPDATE highway_businesses SET subscription_tier=$1, subscription_expires_at=$2 WHERE owner_id=$3', [tier, expiresAt, userId]);
    res.json({ success: true, data: { tier, expiresAt } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/highway/ads
router.get('/ads', async (req, res) => {
  try {
    const userId = getUserId(req);
    const biz = await queryOne('SELECT id FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (!biz) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    const ads = await query('SELECT * FROM highway_ads WHERE business_id=$1 ORDER BY created_at DESC', [biz.id]);
    res.json({ success: true, data: ads.map(serializeAd) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/highway/ads
router.post('/ads', async (req, res) => {
  try {
    const userId = getUserId(req);
    const biz = await queryOne('SELECT id, subscription_tier FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (!biz) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    const { title, description, offerCode, offerText, targetBreakTypes, radiusKm, timeFrom, timeTo, budgetTotal, costPerImpression, costPerClick, startsAt, endsAt } = req.body;
    const ad = await queryOne(
      `INSERT INTO highway_ads (business_id, title, description, offer_code, offer_text, target_break_types, radius_km, time_from, time_to, budget_total, cost_per_impression, cost_per_click, starts_at, ends_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending_review') RETURNING *`,
      [biz.id, title, description || null, offerCode || null, offerText || null, targetBreakTypes || ['fuel', 'meal', 'rest'], radiusKm || 10, timeFrom || '00:00', timeTo || '23:59', budgetTotal, costPerImpression || 0.5, costPerClick || 3.0, startsAt || null, endsAt || null]
    );
    res.status(201).json({ success: true, data: serializeAd(ad) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// PUT /api/v1/highway/ads/:adId
router.put('/ads/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const userId = getUserId(req);
    const biz = await queryOne('SELECT id FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (!biz) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    const { status, title, description } = req.body;
    const ad = await queryOne(
      'UPDATE highway_ads SET status=COALESCE($1,status), title=COALESCE($2,title), description=COALESCE($3,description) WHERE id=$4 AND business_id=$5 RETURNING *',
      [status, title, description, adId, biz.id]
    );
    res.json({ success: true, data: serializeAd(ad) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// DELETE /api/v1/highway/ads/:adId
router.delete('/ads/:adId', async (req, res) => {
  try {
    const { adId } = req.params;
    const userId = getUserId(req);
    const biz = await queryOne('SELECT id FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (!biz) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });
    await query('DELETE FROM highway_ads WHERE id=$1 AND business_id=$2', [adId, biz.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/highway/analytics
router.get('/analytics', async (req, res) => {
  try {
    const userId = getUserId(req);
    const period = req.query.period || '7d';
    const biz = await queryOne('SELECT id, ad_credits_balance FROM highway_businesses WHERE owner_id = $1', [userId]);
    if (!biz) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business not found' } });

    const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await queryOne(
      'SELECT COALESCE(SUM(impressions),0) AS impressions, COALESCE(SUM(clicks),0) AS clicks, COALESCE(SUM(spent_total),0) AS spend_total, COUNT(*) FILTER (WHERE status=\'active\') AS active_ads FROM highway_ads WHERE business_id=$1 AND created_at >= $2',
      [biz.id, since]
    );
    const impressions = parseInt(stats.impressions || 0);
    const clicks = parseInt(stats.clicks || 0);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const estimatedVisits = Math.round(clicks * 0.4);

    const topAdRow = await queryOne(
      'SELECT title, CASE WHEN impressions > 0 THEN clicks::float/impressions ELSE 0 END AS ctr FROM highway_ads WHERE business_id=$1 ORDER BY ctr DESC LIMIT 1',
      [biz.id]
    );

    res.json({
      success: true,
      data: {
        impressions,
        clicks,
        ctr,
        spendTotal: parseFloat(stats.spend_total || 0),
        estimatedVisits,
        creditsBalance: parseFloat(biz.ad_credits_balance || 0),
        activeAds: parseInt(stats.active_ads || 0),
        topAd: topAdRow ? { title: topAdRow.title, ctr: parseFloat(topAdRow.ctr) } : null,
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/highway/credits/add
router.post('/credits/add', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Amount must be positive' } });
    const biz = await queryOne('UPDATE highway_businesses SET ad_credits_balance = ad_credits_balance + $1 WHERE owner_id=$2 RETURNING ad_credits_balance', [amount, userId]);
    res.json({ success: true, data: { newBalance: parseFloat(biz.ad_credits_balance) } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/highway/near  (driver-facing)
router.get('/near', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'lat and lng required' } });
    const radiusKm = parseFloat(radius) || 15;
    const businesses = await query(
      `SELECT id, business_name, category, location_lat, location_lng, subscription_tier, avg_rating, is_open_24hr, current_status, facilities, phone,
       ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) / 1000 AS distance_km
       FROM highway_businesses
       WHERE status = 'active' AND is_verified = true
       AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3 * 1000)
       ORDER BY CASE subscription_tier WHEN 'premium' THEN 1 WHEN 'standard' THEN 2 WHEN 'basic' THEN 3 ELSE 4 END, distance_km`,
      [parseFloat(lng), parseFloat(lat), radiusKm]
    );
    // Always include emergency services (tyre/mechanic) regardless of tier
    const emergencyExtras = await query(
      `SELECT id, business_name, category, location_lat, location_lng, subscription_tier, avg_rating, is_open_24hr, current_status, facilities, phone,
       ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) / 1000 AS distance_km
       FROM highway_businesses
       WHERE status='active' AND category IN ('tyre_shop','service_center')
       AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3 * 1000)`,
      [parseFloat(lng), parseFloat(lat), radiusKm]
    );
    const allIds = new Set(businesses.map((b) => b.id));
    const extras = emergencyExtras.filter((b) => !allIds.has(b.id));
    res.json({ success: true, data: [...businesses, ...extras].map(serializePublic) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/highway/ads/serve  (contextual ad serving for breaks)
router.post('/ads/serve', async (req, res) => {
  try {
    const { driverLat, driverLng, breakType, driverId } = req.body;
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);

    const ads = await query(
      `SELECT ha.*, hb.business_name, hb.location_lat, hb.location_lng, hb.subscription_tier, hb.avg_rating, hb.phone,
       ST_Distance(hb.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) / 1000 AS distance_km
       FROM highway_ads ha
       JOIN highway_businesses hb ON ha.business_id = hb.id
       WHERE ha.status='active' AND hb.status='active'
       AND $3 = ANY(ha.target_break_types)
       AND ha.time_from <= $4 AND ha.time_to >= $4
       AND (ha.ends_at IS NULL OR ha.ends_at > NOW())
       AND (ha.starts_at IS NULL OR ha.starts_at <= NOW())
       AND (ha.budget_total IS NULL OR ha.spent_total < ha.budget_total)
       AND hb.ad_credits_balance > 0
       AND ST_DWithin(hb.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, ha.radius_km * 1000)
       ORDER BY CASE hb.subscription_tier WHEN 'premium' THEN 1 WHEN 'standard' THEN 2 WHEN 'basic' THEN 3 ELSE 4 END, hb.avg_rating DESC
       LIMIT 3`,
      [parseFloat(driverLng), parseFloat(driverLat), breakType, timeStr]
    );

    // Log impressions and deduct credits
    for (const ad of ads) {
      await query('UPDATE highway_ads SET impressions = impressions + 1, spent_total = spent_total + $1 WHERE id = $2', [ad.cost_per_impression, ad.id]);
      await query('UPDATE highway_businesses SET ad_credits_balance = ad_credits_balance - $1 WHERE id = $2', [ad.cost_per_impression, ad.business_id]);
    }

    res.json({ success: true, data: ads.map(serializeAdForDriver) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/highway/ads/:adId/click
router.post('/ads/:adId/click', async (req, res) => {
  try {
    const { adId } = req.params;
    const ad = await queryOne('SELECT cost_per_click, business_id FROM highway_ads WHERE id=$1', [adId]);
    if (!ad) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ad not found' } });
    await query('UPDATE highway_ads SET clicks = clicks + 1, spent_total = spent_total + $1 WHERE id = $2', [ad.cost_per_click, adId]);
    await query('UPDATE highway_businesses SET ad_credits_balance = ad_credits_balance - $1 WHERE id = $2', [ad.cost_per_click, ad.business_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

function serialize(b) {
  return {
    id: b.id, businessName: b.business_name, category: b.category, phone: b.phone,
    gstNumber: b.gst_number, gstVerified: b.gst_verified, fssaiNumber: b.fssai_number,
    locationLat: b.location_lat, locationLng: b.location_lng, address: b.address,
    highwayName: b.highway_name, facilities: b.facilities, photos: b.photos,
    subscriptionTier: b.subscription_tier, adCreditsBalance: b.ad_credits_balance,
    avgRating: b.avg_rating, totalReviews: b.total_reviews,
    isOpen24hr: b.is_open_24hr, currentStatus: b.current_status,
    isVerified: b.is_verified, status: b.status, createdAt: b.created_at,
  };
}

function serializePublic(b) {
  return {
    id: b.id, businessName: b.business_name, category: b.category,
    locationLat: b.location_lat, locationLng: b.location_lng,
    subscriptionTier: b.subscription_tier, avgRating: b.avg_rating,
    isOpen24hr: b.is_open_24hr, currentStatus: b.current_status,
    facilities: b.facilities, phone: b.phone, distanceKm: parseFloat(b.distance_km || 0),
  };
}

function serializeAd(a) {
  return {
    id: a.id, businessId: a.business_id, title: a.title, description: a.description,
    offerCode: a.offer_code, offerText: a.offer_text,
    targetBreakTypes: a.target_break_types, radiusKm: a.radius_km,
    timeFrom: a.time_from, timeTo: a.time_to, status: a.status,
    budgetTotal: a.budget_total, spentTotal: a.spent_total,
    costPerImpression: a.cost_per_impression, costPerClick: a.cost_per_click,
    impressions: a.impressions, clicks: a.clicks,
    startsAt: a.starts_at, endsAt: a.ends_at, createdAt: a.created_at,
  };
}

function serializeAdForDriver(a) {
  return {
    id: a.id, title: a.title, description: a.description,
    offerCode: a.offer_code, offerText: a.offer_text,
    businessName: a.business_name, businessLat: a.location_lat, businessLng: a.location_lng,
    subscriptionTier: a.subscription_tier, avgRating: a.avg_rating, phone: a.phone,
    distanceKm: parseFloat(a.distance_km || 0),
  };
}

module.exports = router;
