#!/bin/bash
TRUCKER_ID="a0000000-0000-0000-0000-000000000001"

echo "=== Active load for trucker ==="
curl -s "http://localhost:3002/api/v1/truckers/my/active-load" \
  -H "x-user-id: $TRUCKER_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>&1 || \
  curl -s "http://localhost:3002/api/v1/truckers/my/active-load" -H "x-user-id: $TRUCKER_ID"

echo ""
echo "=== All loads with accepted/loading status ==="
PGPASSWORD="TruckPlatform@2024!Secure" psql -h localhost -U app_user -d truck_platform -c \
  "SELECT load_id, status, trucker_id, merchant_id, origin_city, dest_city FROM loads WHERE status IN ('accepted','loading','in_transit') LIMIT 10;" 2>&1

echo ""
echo "=== Trucker user IDs ==="
PGPASSWORD="TruckPlatform@2024!Secure" psql -h localhost -U app_user -d truck_platform -c \
  "SELECT user_id, full_name, phone_number FROM users WHERE user_type='trucker' LIMIT 5;" 2>&1

echo ""
echo "=== Check trucker_service /my/active-load route ==="
docker exec truck_trucker_service grep -rn "active-load\|active_load\|activeLoad" /app/dist/ 2>/dev/null | head -20

echo ""
echo "=== Trucker service logs (last 20) ==="
docker logs truck_trucker_service --tail=20 2>&1
