#!/bin/bash
echo "=== Port mapping for trucker service ==="
docker port truck_trucker_service

echo ""
echo "=== Does server.js load journey-routes? ==="
docker exec truck_trucker_service grep -n "journey" /app/dist/server.js 2>/dev/null | head -10

echo ""
echo "=== Trucker service main entry ==="
docker exec truck_trucker_service cat /app/dist/server.js 2>/dev/null | head -30

echo ""
echo "=== Direct call to trucker service internal port ==="
# Try direct call
INTERNAL_PORT=$(docker port truck_trucker_service 2>/dev/null | grep -oP '(?<=0.0.0.0:)\d+' | head -1)
echo "Internal port: $INTERNAL_PORT"
curl -sv "http://localhost:${INTERNAL_PORT:-3002}/api/v1/truckers/my/active-load" \
  -H "x-user-id: a0000000-0000-0000-0000-000000000001" 2>&1 | grep -E "(HTTP|success|error|Route)" | head -10

echo ""
echo "=== Check all registered routes in trucker service ==="
docker exec truck_trucker_service node -e "
const app = require('/app/dist/server.js');
" 2>&1 | tail -5 || true

echo ""
echo "=== What does curl to port 3002 return for known route? ==="
curl -s "http://localhost:3002/api/v1/truckers/profile" -H "x-user-id: a0000000-0000-0000-0000-000000000001" | head -c 200

echo ""
echo "=== Loads with trucker assigned ==="
docker exec truck_postgres psql -U app_user -d truck_platform -c "SELECT load_id, status, trucker_id, origin_city, dest_city FROM loads WHERE trucker_id IS NOT NULL ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || \
  docker exec truck_postgres psql -U postgres -d truck_platform -c "SELECT load_id, status, trucker_id, origin_city, dest_city FROM loads WHERE trucker_id IS NOT NULL ORDER BY created_at DESC LIMIT 5;" 2>/dev/null

echo ""
echo "=== Loads with status accepted/loading/in_transit ==="
docker exec truck_postgres psql -U app_user -d truck_platform -c "SELECT load_id, status, trucker_id, origin_city, dest_city FROM loads WHERE status IN ('accepted','loading','in_transit') LIMIT 5;" 2>/dev/null || \
  docker exec truck_postgres psql -U postgres -d truck_platform -c "SELECT load_id, status, trucker_id, origin_city, dest_city FROM loads WHERE status IN ('accepted','loading','in_transit') LIMIT 5;" 2>/dev/null
