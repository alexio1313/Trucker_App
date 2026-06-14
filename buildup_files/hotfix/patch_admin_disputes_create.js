// Patch: add POST /api/v1/admin/disputes to admin service
// Uses actual disputes table schema (description, dispute_type, raised_by UUID, raised_against UUID)
'use strict';
const fs = require('fs');

const DISPUTE_CREATE = `
// Patch: create dispute endpoint — uses actual disputes table schema
{
  const { Pool: Pool_D } = require('pg');
  const { v4: uuidv4_D } = require('uuid');
  const pool_d = new Pool_D({ connectionString: process.env.DATABASE_URL });

  const VALID_DISPUTE_TYPES = ['payment_issue','waiting_charge','damage','late_delivery','no_show','cargo_mismatch','communication','other'];

  // POST /api/v1/admin/disputes  (create dispute)
  app.post('/api/v1/admin/disputes', async (req, res) => {
    const { loadId, raisedByRole, description, disputeType } = req.body || {};
    if (!loadId || !description) return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'loadId and description are required' } });
    const dtype = VALID_DISPUTE_TYPES.includes(disputeType) ? disputeType : 'other';
    try {
      // Look up the load to get merchant_id and trucker_id
      const loadRow = await pool_d.query('SELECT merchant_id, trucker_id FROM loads WHERE load_id = $1', [loadId]);
      if (!loadRow.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found' } });
      const { merchant_id, trucker_id } = loadRow.rows[0];
      // Must have at least one party
      if (!merchant_id && !trucker_id) return res.status(400).json({ success: false, error: { code: 'NO_PARTIES', message: 'Load has no merchant or trucker assigned' } });
      // Determine raised_by and raised_against
      let raised_by, raised_against;
      if (raisedByRole === 'merchant') {
        raised_by = merchant_id;
        raised_against = trucker_id;
      } else {
        raised_by = trucker_id || merchant_id;
        raised_against = merchant_id || trucker_id;
      }
      if (!raised_by || !raised_against) {
        raised_by = raised_by || raised_against;
        raised_against = raised_against || raised_by;
      }
      const disputeId = uuidv4_D();
      const row = await pool_d.query(
        \`INSERT INTO disputes (dispute_id, load_id, raised_by, raised_against, dispute_type, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', NOW(), NOW())
         RETURNING dispute_id, load_id, raised_by, raised_against, dispute_type, description, status, created_at\`,
        [disputeId, loadId, raised_by, raised_against, dtype, description]
      );
      // Mark load as disputed
      await pool_d.query("UPDATE loads SET status = 'disputed', updated_at = NOW() WHERE load_id = $1", [loadId]);
      res.status(201).json({ success: true, data: row.rows[0] });
    } catch (err) {
      console.error('[Disputes] Create error:', err.message);
      res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message } });
    }
  });
}
`;

const appPath = '/app/dist/app.js';
let src = fs.readFileSync(appPath, 'utf8');

// Remove old bad patch if it exists
if (src.includes("column \\\"reason\\\"") || src.includes('POST /api/v1/admin/disputes')) {
  // Remove old injection between markers
  src = src.replace(/\/\/ Patch: create dispute endpoint[\s\S]*?(?=app\.use\()/m, '');
}

const INJECT_BEFORE = "app.use((_req, res) => {";
if (!src.includes(INJECT_BEFORE)) { console.error('Injection point not found'); process.exit(1); }

const patched = src.replace(INJECT_BEFORE, DISPUTE_CREATE + '\n' + INJECT_BEFORE);
fs.writeFileSync(appPath, patched, 'utf8');
console.log('Patched admin service: added POST /api/v1/admin/disputes (schema-correct)');
