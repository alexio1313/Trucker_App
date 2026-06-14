#!/bin/bash
echo "=== Admin service routes ==="
docker exec truck_admin_service node -e "
const app = require('/app/dist/app.js');
// list registered routes
"  2>&1 | head -20 || true

echo ""
echo "=== Check if loads route exists in dist/app.js ==="
docker exec truck_admin_service grep -n "loads\|social" /app/dist/app.js | head -20

echo ""
echo "=== disputes curl verbose ==="
curl -sv "http://localhost:3004/api/v1/admin/disputes?status=open" 2>&1 | head -30

echo ""
echo "=== social curl verbose ==="
curl -sv "http://localhost:3004/api/v1/admin/social-posts" 2>&1 | head -30

echo ""
echo "=== loads curl verbose ==="
curl -sv "http://localhost:3004/api/v1/admin/loads" 2>&1 | head -30
