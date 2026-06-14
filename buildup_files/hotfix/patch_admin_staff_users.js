// Patch: add POST /api/v1/admin/staff-users to admin service
// Creates internal admin/developer/tester/QA accounts without KYC
const fs = require('fs');
const path = '/app/dist/app.js';
let src = fs.readFileSync(path, 'utf8');

const ROUTE_CODE = `
const { Router } = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const staffRouter = Router();

staffRouter.get('/', async (_req, res) => {
  try {
    const rows = await pool.query(
      "SELECT user_id, full_name, phone_number, email, user_type, kyc_status, created_at FROM users WHERE user_type = 'admin' AND deleted_at IS NULL ORDER BY created_at DESC"
    );
    res.json({ success: true, data: { items: rows.rows, total: rows.rowCount } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

staffRouter.post('/', async (req, res) => {
  const { fullName, phone, email, password, role } = req.body;
  const allowed = ['admin', 'developer', 'tester', 'qa'];
  if (!fullName || !phone || !password || !allowed.includes(role)) {
    return res.status(400).json({ success: false, error: { message: 'fullName, phone, password, and role (admin/developer/tester/qa) required' } });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await pool.query(
      \`INSERT INTO users (user_id, user_type, full_name, phone_number, email, password_hash, kyc_status, kyc_reviewed_at)
       VALUES ($1, 'admin', $2, $3, $4, $5, 'verified', NOW())
       ON CONFLICT (phone_number) DO NOTHING\`,
      [userId, fullName, phone, email || null, hash]
    );
    res.status(201).json({ success: true, data: { userId, fullName, phone, role, message: 'Staff user created — can log in with phone + password' } });
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } });
  }
});

module.exports = staffRouter;
`;

// Write the staff router file
fs.writeFileSync('/app/dist/staff.users.routes.js', ROUTE_CODE, 'utf8');

// Inject route registration before the 404 handler
const INJECT_BEFORE = "app.use((_req, res) => {";
if (!src.includes(INJECT_BEFORE)) { console.error('Injection point not found'); process.exit(1); }

const INJECTION = `app.use('/api/v1/admin/staff-users', require('./staff.users.routes'));\n`;
const patched = src.replace(INJECT_BEFORE, INJECTION + INJECT_BEFORE);
fs.writeFileSync(path, patched, 'utf8');
console.log('Patched admin service: added /api/v1/admin/staff-users');
