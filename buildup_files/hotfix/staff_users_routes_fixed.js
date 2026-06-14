"use strict";
// staff.users.routes.js — internal staff user management (no KYC required)
const { Router } = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const router = Router();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

const ROLES = ['admin', 'developer', 'tester', 'qa'];

// GET /api/v1/admin/staff-users
router.get('/', async (_req, res) => {
  try {
    const rows = await pool.query(
      `SELECT user_id, full_name, phone_number, email, user_type, kyc_status, created_at
       FROM users WHERE user_type = 'admin' AND deleted_at IS NULL ORDER BY created_at DESC`
    );
    res.json({ success: true, data: { items: rows.rows, total: rows.rowCount } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// POST /api/v1/admin/staff-users
router.post('/', async (req, res) => {
  const { fullName, phone, email, password, role } = req.body;
  if (!fullName || !phone || !password) {
    return res.status(400).json({ success: false, error: { message: 'fullName, phone, and password are required' } });
  }
  const finalRole = ROLES.includes(role) ? role : 'admin';
  try {
    const hash = hashPassword(password);
    const userId = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (user_id, user_type, full_name, phone_number, email, password_hash, kyc_status, kyc_reviewed_at)
       VALUES ($1, 'admin', $2, $3, $4, $5, 'verified', NOW())
       ON CONFLICT (phone_number) DO UPDATE
       SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, updated_at = NOW()
       RETURNING user_id, full_name, phone_number, user_type`,
      [userId, fullName, phone, email || null, hash]
    );
    const u = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        userId: u.user_id,
        fullName: u.full_name,
        phone: u.phone_number,
        role: finalRole,
        message: 'Staff user created. They can log in with phone + password via the main app.',
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

// DELETE /api/v1/admin/staff-users/:userId
router.delete('/:userId', async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET deleted_at = NOW() WHERE user_id = $1 AND user_type = 'admin'`,
      [req.params.userId]
    );
    res.json({ success: true, data: { message: 'Staff user removed' } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

module.exports = router;
