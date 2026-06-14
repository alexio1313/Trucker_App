#!/bin/bash
echo "=== disputes.routes.js ==="
docker exec truck_admin_service cat /app/dist/admin/disputes.routes.js

echo ""
echo "=== kyc.routes.js ==="
docker exec truck_admin_service cat /app/dist/admin/kyc.routes.js | head -60

echo ""
echo "=== postgres.js ==="
docker exec truck_admin_service cat /app/dist/db/postgres.js
