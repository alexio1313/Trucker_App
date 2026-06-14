// Test if the newly generated hash matches Admin@123 AND if the DB was updated
const bcrypt = require('/app/node_modules/bcryptjs');
const { Pool } = require('/app/node_modules/pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const hash = '$2a$10$5n5ZrrAtU1JzgGrta7HoR.yiGCGJAgfA9icvCjzFg5llELTD5FhqS';
  const match = await bcrypt.compare('Admin@123', hash);
  console.log('Hash vs Admin@123:', match);

  // Read from DB
  const res = await pool.query("SELECT phone_number, LEFT(password_hash,30) as h FROM users WHERE phone_number = '+919860001001'");
  if (res.rows.length > 0) {
    const row = res.rows[0];
    console.log('DB hash prefix:', row.h);
    const dbHash = (await pool.query("SELECT password_hash FROM users WHERE phone_number = '+919860001001'")).rows[0].password_hash;
    const dbMatch = await bcrypt.compare('Admin@123', dbHash);
    console.log('DB hash vs Admin@123:', dbMatch);
  } else {
    console.log('User not found in DB');
  }
  await pool.end();
}

run().catch(e => console.error(e.message));
