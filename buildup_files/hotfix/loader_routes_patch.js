'use strict';
const { Router } = require('express');
const crypto = require('crypto');
const { query, queryOne } = require('../db/postgres');

const router = Router();
function getUserId(req) { return req.headers['x-user-id']; }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// POST /api/v1/loader-cos/register
router.post('/register', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { companyName, gstNumber, labourLicenseNumber, labourLicenseDocUrl, coverageCities, maxConcurrentJobs, rateCard, phone } = req.body;
    if (!companyName) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'companyName required' } });
    const existing = await queryOne('SELECT id FROM loader_companies WHERE owner_id=$1', [userId]);
    if (existing) return res.status(409).json({ success: false, error: { code: 'ALREADY_REGISTERED', message: 'Already registered' } });

    const company = await queryOne(
      `INSERT INTO loader_companies (owner_id, company_name, gst_number, labour_license_number, labour_license_doc_url, coverage_cities, max_concurrent_jobs, rate_card, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [userId, companyName, gstNumber || null, labourLicenseNumber || null, labourLicenseDocUrl || null, coverageCities || [], maxConcurrentJobs || 5, rateCard ? JSON.stringify(rateCard) : null]
    );
    await query("UPDATE users SET usertype='loader_company' WHERE id=$1", [userId]);
    res.status(201).json({ success: true, data: company });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loader-cos/workers
router.get('/workers', async (req, res) => {
  try {
    const userId = getUserId(req);
    const company = await queryOne('SELECT id FROM loader_companies WHERE owner_id=$1', [userId]);
    if (!company) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } });
    const workers = await query('SELECT id,name,phone,aadhaar_verified,photo_url,skill_tags,status,total_assignments,created_at FROM loader_workers WHERE company_id=$1 ORDER BY created_at DESC', [company.id]);
    res.json({ success: true, data: workers.map(w => ({ id: w.id, name: w.name, phone: w.phone, aadhaarVerified: w.aadhaar_verified, photoUrl: w.photo_url, skillTags: w.skill_tags, status: w.status, totalAssignments: w.total_assignments })) });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/loader-cos/workers
router.post('/workers', async (req, res) => {
  try {
    const userId = getUserId(req);
    const company = await queryOne('SELECT id FROM loader_companies WHERE owner_id=$1', [userId]);
    if (!company) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } });
    const { name, phone, aadhaarNumber, photo, skillTags } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name required' } });
    const aadhaarHash = aadhaarNumber ? sha256(aadhaarNumber) : null;
    const worker = await queryOne(
      'INSERT INTO loader_workers (company_id,name,phone,aadhaar_number_hash,photo_url,skill_tags) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,phone,aadhaar_verified,skill_tags,status,total_assignments',
      [company.id, name, phone || null, aadhaarHash, photo || null, skillTags || ['general']]
    );
    res.status(201).json({ success: true, data: worker });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loader-cos/near
router.get('/near', async (req, res) => {
  try {
    const { city, lat, lng, radius } = req.query;
    let companies;
    if (lat && lng) {
      companies = await query(
        `SELECT lc.*, u.phone_number FROM loader_companies lc JOIN users u ON lc.owner_id=u.id
         WHERE lc.status='active' AND lc.subscription_tier != 'pending' AND $1 = ANY(lc.coverage_cities)
         ORDER BY lc.avg_rating DESC NULLS LAST LIMIT 20`,
        [city || '']
      );
    } else {
      companies = await query(
        "SELECT lc.*, u.phone_number FROM loader_companies lc JOIN users u ON lc.owner_id=u.id WHERE lc.status='active' AND $1 = ANY(lc.coverage_cities) ORDER BY lc.avg_rating DESC NULLS LAST LIMIT 20",
        [city || '']
      );
    }
    res.json({
      success: true,
      data: companies.map((c: any) => ({
        id: c.id, companyName: c.company_name, coverageCities: c.coverage_cities,
        avgRating: c.avg_rating, totalJobs: c.total_jobs,
        rateCard: c.rate_card, phone: c.phone_number, subscriptionTier: c.subscription_tier,
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loader-cos/jobs
router.get('/jobs', async (req, res) => {
  try {
    const userId = getUserId(req);
    const company = await queryOne('SELECT id, coverage_cities FROM loader_companies WHERE owner_id=$1', [userId]);
    if (!company) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } });
    const status = req.query.status || 'pending';
    const loads = await query(
      `SELECT l.load_id,l.origin_city,l.origin_address,l.cargo_type,l.cargo_weight_kg,l.loading_arrangement,l.scheduled_pickup,u.full_name AS merchant_name
       FROM loads l JOIN users u ON l.merchant_id=u.id
       WHERE l.status=$1 AND l.origin_city = ANY($2)
       ORDER BY l.created_at DESC LIMIT 50`,
      [status === 'pending' ? 'posted' : status, company.coverage_cities]
    );
    res.json({
      success: true,
      data: loads.map((l: any) => ({
        id: l.load_id, loadId: l.load_id, originCity: l.origin_city, originAddress: l.origin_address,
        cargoType: l.cargo_type, weightTonnes: (l.cargo_weight_kg / 1000).toFixed(2),
        loadingArrangement: l.loading_arrangement, scheduledStart: l.scheduled_pickup, merchantName: l.merchant_name,
      }))
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// POST /api/v1/loader-cos/jobs/:loadId/express-interest
router.post('/jobs/:loadId/express-interest', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { loadId } = req.params;
    const company = await queryOne('SELECT id FROM loader_companies WHERE owner_id=$1', [userId]);
    if (!company) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } });
    await query(
      'INSERT INTO loading_jobs (load_id, arrangement_type, loader_company_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [loadId, 'company_arranged', company.id]
    );
    res.json({ success: true, data: { message: 'Interest expressed. Merchant/trucker can now see your company for this load.' } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

// GET /api/v1/loader-cos/analytics
router.get('/analytics', async (req, res) => {
  try {
    const userId = getUserId(req);
    const company = await queryOne('SELECT * FROM loader_companies WHERE owner_id=$1', [userId]);
    if (!company) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Company not found' } });
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const jobStats = await queryOne(
      'SELECT COUNT(*) AS jobs_count, COALESCE(SUM(total_cost),0) AS total_earnings FROM loading_jobs WHERE loader_company_id=$1 AND payment_status=\'paid\' AND created_at >= $2',
      [company.id, since]
    );
    const workerStats = await queryOne('SELECT COUNT(*) AS active_workers FROM loader_workers WHERE company_id=$1 AND status=\'active\'', [company.id]);
    res.json({
      success: true,
      data: {
        jobsThisMonth: parseInt(jobStats.jobs_count || 0),
        totalEarnings: parseFloat(jobStats.total_earnings || 0),
        avgRating: parseFloat(company.avg_rating || 0),
        workersActive: parseInt(workerStats.active_workers || 0),
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

module.exports = { loaderRoutes: router };
