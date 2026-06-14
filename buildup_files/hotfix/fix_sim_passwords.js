// Fix sim user passwords — generate correct bcrypt hash and update DB
const bcrypt = require('/app/node_modules/bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SIM_PASSWORD = 'Admin@123';

async function fix() {
  const hash = await bcrypt.hash(SIM_PASSWORD, 10);
  console.log('Generated hash for Admin@123:', hash);

  // Verify it
  const ok = await bcrypt.compare(SIM_PASSWORD, hash);
  console.log('Hash verification:', ok);

  const simPhones = [
    '+919860001001', '+919860001002', '+919860001003',  // truckers
    '+919860002001', '+919860002002', '+919860002003',  // merchants
  ];

  const res = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE phone_number = ANY($2) RETURNING phone_number, full_name",
    [hash, simPhones]
  );
  console.log('Updated ' + res.rowCount + ' users:');
  res.rows.forEach(r => console.log('  ', r.phone_number, r.full_name));

  await pool.end();
  console.log('Done — sim users can now login with Admin@123');
}

fix().catch(e => { console.error('Error:', e.message); process.exit(1); });
