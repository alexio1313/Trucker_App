#!/bin/bash
# Fix disputes.routes.js: count query uses alias 'd' but FROM is just 'disputes' (no alias)
docker exec truck_admin_service node -e "
const fs = require('fs');
const path = '/app/dist/admin/disputes.routes.js';
let src = fs.readFileSync(path, 'utf8');

// The bug: count query uses 'WHERE d.status' but FROM clause has no alias 'd'
// Fix: replace 'WHERE d.status' with 'WHERE status' for the count query
// The main SELECT query is fine (it has FROM disputes d)
// The count query: SELECT COUNT(*) FROM disputes WHERE d.status = ... <- WRONG
src = src.replace(
  'const countRow = await (0, postgres_1.queryOne)(\`SELECT COUNT(*) FROM disputes \${where}\`, status ? [status] : []);',
  'const countWhere = status ? \`WHERE status = \\\$1\` : \"\"; const countRow = await (0, postgres_1.queryOne)(\`SELECT COUNT(*) FROM disputes \${countWhere}\`, status ? [status] : []);'
);

fs.writeFileSync(path, src);
console.log('Fixed disputes.routes.js');
// Verify
const src2 = fs.readFileSync(path, 'utf8');
const idx = src2.indexOf('countWhere');
console.log('Verification:', src2.slice(idx, idx + 200));
" 2>&1

echo ""
echo "=== Restarting admin service ==="
docker restart truck_admin_service
sleep 6

echo ""
echo "=== Testing disputes endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/disputes?status=open" | head -c 300

echo ""
echo "=== Testing loads endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/loads?limit=3" | head -c 300

echo ""
echo "=== Testing social endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/social-posts" | head -c 300

echo ""
echo "=== Admin service logs (last 10) ==="
docker logs truck_admin_service --tail=10 2>&1
