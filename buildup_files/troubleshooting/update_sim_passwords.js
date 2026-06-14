// Run inside truck_trucker_service — uses its own DB module + bcryptjs
const bcrypt = require('/app/node_modules/bcryptjs');
const { query } = require('/app/dist/db/postgres');

const SIM_PHONES = [
  '+919860001001', '+919860001002', '+919860001003',
  '+919860002001', '+919860002002', '+919860002003',
];
const PASSWORD = 'Admin@123';

async function run() {
  const hash = await bcrypt.hash(PASSWORD, 12);
  console.log('New hash (first 20):', hash.slice(0, 20) + '...');

  // Verify before writing
  const ok = await bcrypt.compare(PASSWORD, hash);
  if (!ok) { console.error('Hash verification failed!'); process.exit(1); }

  for (const phone of SIM_PHONES) {
    const rows = await query(
      "UPDATE users SET password_hash = $1 WHERE phone_number = $2 RETURNING full_name",
      [hash, phone]
    );
    const name = rows[0]?.full_name || 'NOT FOUND';
    console.log((rows.length ? 'OK' : 'MISS') + '  ' + phone + '  ' + name);
  }

  // Verify from DB
  const check = await query("SELECT password_hash FROM users WHERE phone_number = $1", ['+919860001001']);
  const dbOk = await bcrypt.compare(PASSWORD, check[0].password_hash);
  console.log('DB verification (Admin@123):', dbOk ? 'PASS ✓' : 'FAIL ✗');
  process.exit(0);
}

run().catch(e => { console.error('Error:', e.message, e.stack); process.exit(1); });
