'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const query = (text, params) => pool.query(text, params).then(r => r.rows);
const queryOne = (text, params) => pool.query(text, params).then(r => r.rows[0]);

const SUREPASS_BASE = process.env.SUREPASS_BASE_URL || 'https://kyc-api.surepass.io/api/v1';
const SUREPASS_KEY = process.env.SUREPASS_API_KEY || '';
const DIGILOCKER_CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || '';
const DIGILOCKER_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || '';
const DIGILOCKER_REDIRECT = process.env.DIGILOCKER_REDIRECT_URI || 'http://192.168.8.101:3000/api/v1/kyc/digilocker/callback';

function getUserId(req) { return req.headers['x-user-id']; }

function surepassHeaders() {
  return { Authorization: `Bearer ${SUREPASS_KEY}`, 'Content-Type': 'application/json' };
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'kyc-service' }));

// POST /api/v1/kyc/aadhaar/send-otp
app.post('/api/v1/kyc/aadhaar/send-otp', async (req, res) => {
  try {
    const { aadhaarNumber } = req.body;
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Aadhaar must be 12 digits' } });
    }
    if (!SUREPASS_KEY) {
      // mock for dev
      return res.json({ success: true, data: { transactionId: 'mock_txn_' + Date.now() } });
    }
    const resp = await axios.post(`${SUREPASS_BASE}/aadhaar-v2/send-otp`, { id_number: aadhaarNumber }, { headers: surepassHeaders() });
    res.json({ success: true, data: { transactionId: resp.data.data?.client_id } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// POST /api/v1/kyc/aadhaar/verify-otp
app.post('/api/v1/kyc/aadhaar/verify-otp', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { transactionId, otp } = req.body;

    let aadhaarData;
    if (!SUREPASS_KEY || transactionId.startsWith('mock_txn_')) {
      aadhaarData = { name: 'Test User', dob: '1990-01-01', address: 'Test Address', photo: '' };
    } else {
      const resp = await axios.post(`${SUREPASS_BASE}/aadhaar-v2/submit-otp`, { client_id: transactionId, otp }, { headers: surepassHeaders() });
      const d = resp.data.data;
      aadhaarData = { name: d.full_name, dob: d.dob, address: d.address?.combined_address, photo: d.profile_image };
    }

    // Anti-spam: check if aadhaar already used by another active user
    const existing = await queryOne(
      'SELECT id, usertype FROM users WHERE aadhaar_name = $1 AND id != $2 AND aadhaar_verified = true',
      [aadhaarData.name, userId]
    );
    if (existing) {
      return res.status(409).json({ success: false, error: { code: 'DUPLICATE_AADHAAR', message: 'Aadhaar already registered with another account' } });
    }

    await query(
      'UPDATE users SET aadhaar_verified = true, aadhaar_name = $1, aadhaar_dob = $2, verification_stage = 2, kyc_provider = $3, kyc_reference_id = $4 WHERE id = $5',
      [aadhaarData.name, aadhaarData.dob || null, 'surepass', transactionId, userId]
    );

    res.json({ success: true, data: aadhaarData });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// POST /api/v1/kyc/pan/verify
app.post('/api/v1/kyc/pan/verify', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { panNumber } = req.body;
    if (!panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid PAN format' } });
    }
    let panData;
    if (!SUREPASS_KEY) {
      panData = { name: 'Test User', dob: '1990-01-01', entityType: 'Individual' };
    } else {
      const resp = await axios.post(`${SUREPASS_BASE}/pan`, { id_number: panNumber }, { headers: surepassHeaders() });
      const d = resp.data.data;
      panData = { name: d.full_name, dob: d.dob, entityType: d.type };
    }
    await query('UPDATE users SET pan_number = $1 WHERE id = $2', [panNumber, userId]);
    res.json({ success: true, data: panData });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// POST /api/v1/kyc/gst/verify
app.post('/api/v1/kyc/gst/verify', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { gstin } = req.body;
    if (!gstin) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'GSTIN required' } });
    let gstData;
    if (!SUREPASS_KEY) {
      gstData = { legalName: 'Test Company Pvt Ltd', tradeName: 'Test Co', status: 'Active', address: '123 Test St, Bangalore' };
    } else {
      const resp = await axios.post(`${SUREPASS_BASE}/gstin`, { id_number: gstin }, { headers: surepassHeaders() });
      const d = resp.data.data;
      gstData = { legalName: d.legal_name, tradeName: d.trade_name, status: d.status, address: d.address };
    }
    await query('UPDATE users SET gst_number = $1, gst_verified = true WHERE id = $2', [gstin, userId]);
    res.json({ success: true, data: gstData });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// POST /api/v1/kyc/dl/verify
app.post('/api/v1/kyc/dl/verify', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { dlNumber, dob } = req.body;
    if (!dlNumber) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'DL number required' } });
    let dlData;
    if (!SUREPASS_KEY) {
      dlData = { name: 'Test Driver', validTill: '2030-01-01', vehicleClasses: ['LMV', 'TRANS'] };
    } else {
      const resp = await axios.post(`${SUREPASS_BASE}/driving-license`, { id_number: dlNumber, dob }, { headers: surepassHeaders() });
      const d = resp.data.data;
      dlData = { name: d.name, validTill: d.validity?.non_transport, vehicleClasses: d.vehicle_classes };
    }
    // Upsert trucker_kyc
    await query(
      `INSERT INTO trucker_kyc (user_id, dl_number, dl_valid_till, dl_vehicle_classes, dl_verified, dl_verified_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (user_id) DO UPDATE SET dl_number=$2, dl_valid_till=$3, dl_vehicle_classes=$4, dl_verified=true, dl_verified_at=NOW()`,
      [userId, dlNumber, dlData.validTill || null, dlData.vehicleClasses || []]
    );
    res.json({ success: true, data: dlData });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// POST /api/v1/kyc/rc/verify
app.post('/api/v1/kyc/rc/verify', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { vehicleNumber } = req.body;
    if (!vehicleNumber) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Vehicle number required' } });
    let rcData;
    if (!SUREPASS_KEY) {
      rcData = { ownerName: 'Test Owner', vehicleType: 'HGV', permitType: 'National', insuranceExpiry: '2025-12-31' };
    } else {
      const resp = await axios.post(`${SUREPASS_BASE}/rc-details`, { id_number: vehicleNumber }, { headers: surepassHeaders() });
      const d = resp.data.data;
      rcData = { ownerName: d.owner_name, vehicleType: d.vehicle_category, permitType: d.permit_type, insuranceExpiry: d.insurance_upto };
    }
    await query(
      `INSERT INTO truck_documents (user_id, vehicle_number, vehicle_type, owner_name, permit_type, rc_verified)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (vehicle_number) DO UPDATE SET vehicle_type=$3, owner_name=$4, permit_type=$5, rc_verified=true`,
      [userId, vehicleNumber.toUpperCase(), rcData.vehicleType, rcData.ownerName, rcData.permitType]
    );
    res.json({ success: true, data: rcData });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// GET /api/v1/kyc/digilocker/auth-url
app.get('/api/v1/kyc/digilocker/auth-url', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `https://api.digitallocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${DIGILOCKER_CLIENT_ID}&redirect_uri=${encodeURIComponent(DIGILOCKER_REDIRECT)}&state=${state}&scope=aadhaar`;
  res.json({ success: true, data: { authUrl, state } });
});

// GET /api/v1/kyc/digilocker/callback
app.get('/api/v1/kyc/digilocker/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING_CODE', message: 'Authorization code missing' } });
    // Exchange code for token and fetch documents
    // In production: call DigiLocker token endpoint and fetch XML documents
    res.redirect(`http://192.168.8.101:3010/kyc/digilocker/success?code=${code}`);
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'DIGILOCKER_ERROR', message: e.message } });
  }
});

// POST /api/v1/kyc/selfie/verify
app.post('/api/v1/kyc/selfie/verify', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { selfieBase64, aadhaarPhotoBase64 } = req.body;
    if (!selfieBase64) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Selfie required' } });
    let matchScore = 95.0;
    let verified = true;
    if (SUREPASS_KEY && aadhaarPhotoBase64) {
      const resp = await axios.post(`${SUREPASS_BASE}/face-match`, { image1: selfieBase64, image2: aadhaarPhotoBase64 }, { headers: surepassHeaders() });
      matchScore = resp.data.data?.match_score || 0;
      verified = matchScore >= 75;
    }
    await query(
      `UPDATE trucker_kyc SET selfie_match_score = $1, selfie_verified = $2 WHERE user_id = $3`,
      [matchScore, verified, userId]
    );
    if (verified) {
      await query('UPDATE users SET verification_stage = 3 WHERE id = $1', [userId]);
    }
    res.json({ success: true, data: { matchScore, verified } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'KYC_ERROR', message: e.message } });
  }
});

// GET /api/v1/kyc/status
app.get('/api/v1/kyc/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    const user = await queryOne('SELECT verification_stage, aadhaar_verified, gst_verified, pan_number, kyc_provider FROM users WHERE id = $1', [userId]);
    const kyc = await queryOne('SELECT dl_verified, selfie_verified FROM trucker_kyc WHERE user_id = $1', [userId]);
    res.json({ success: true, data: { ...user, ...kyc } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: e.message } });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KYC service listening on port ${PORT}`));
