#!/bin/bash
echo "=== Trucker service postgres.js ==="
docker exec truck_trucker_service cat /app/dist/db/postgres.js

echo ""
echo "=== Full journey-routes.js ==="
docker exec truck_trucker_service cat /app/dist/journey-routes.js

echo ""
echo "=== Test postgres query directly ==="
docker exec truck_trucker_service node -e "
var db = require('/app/dist/db/postgres');
var pool = db.pool || db.default || db;
console.log('typeof pool:', typeof pool);
console.log('keys:', Object.keys(db));
if (db.query) {
  db.query('SELECT COUNT(*) as cnt FROM loads').then(r => {
    console.log('query result type:', typeof r);
    console.log('is array:', Array.isArray(r));
    console.log('result:', JSON.stringify(r).slice(0,200));
  }).catch(e => console.error('err:', e.message));
} else if (pool && pool.query) {
  pool.query('SELECT COUNT(*) as cnt FROM loads').then(r => {
    console.log('pool.query result:', typeof r.rows, r.rows[0]);
  }).catch(e => console.error('err:', e.message));
}
setTimeout(() => process.exit(0), 3000);
" 2>&1 | grep -v Warning | grep -v "node >=22" | grep -v "found at"

echo ""
echo "=== Test active-load directly ==="
docker exec truck_trucker_service node -e "
var db = require('/app/dist/db/postgres');
var TRUCKER_ID = 'c0000000-0000-0000-0000-000000000001';
Promise.resolve().then(async () => {
  var result;
  if (db.query) {
    result = await db.query('SELECT l.* FROM loads l WHERE l.trucker_id = \$1 AND l.status IN (\$2,\$3,\$4) ORDER BY l.updated_at DESC LIMIT 1', [TRUCKER_ID, 'accepted','loading','in_transit']);
    console.log('db.query result (array?):', Array.isArray(result), 'len:', result.length, 'first:', JSON.stringify(result[0])?.slice(0,100));
  }
}).catch(e => console.error(e.message));
setTimeout(() => process.exit(0), 5000);
" 2>&1 | grep -v Warning | grep -v "node >=22" | grep -v "found at"
