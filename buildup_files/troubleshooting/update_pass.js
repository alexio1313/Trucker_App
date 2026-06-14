const bcrypt = require('bcryptjs');
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});

bcrypt.hash('TruckQA@2024', 10).then(hash => {
  console.log('Hash generated, prefix:', hash.substring(0, 7));
  return pool.query('UPDATE users SET password_hash = $1', [hash]);
}).then(r => {
  console.log('Updated', r.rowCount, 'users with TruckQA@2024 password');
  return pool.end();
}).catch(e => { console.error('Error:', e.message); pool.end(); });
