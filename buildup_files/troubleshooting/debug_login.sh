#!/bin/bash
echo "=== Test Admin login ==="
curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>/dev/null | head -30

echo ""
echo "=== Test Trucker login ==="
curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860001001","password":"Admin@123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>/dev/null | head -30

echo ""
echo "=== Test Merchant login ==="
curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860002001","password":"Admin@123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))" 2>/dev/null | head -30

echo ""
echo "=== Check users in DB ==="
docker exec truck_postgres psql -U app_user -d truck_platform -c \
  "SELECT user_id, full_name, phone_number, user_type, password_hash IS NOT NULL as has_password FROM users ORDER BY created_at LIMIT 10;" 2>/dev/null

echo ""
echo "=== API Gateway logs (last 20) ==="
docker logs truck_api_gateway --tail=20 2>&1 | grep -v "^$"

echo ""
echo "=== Trucker service logs (last 10) ==="
docker logs truck_trucker_service --tail=10 2>&1 | grep -v "^$"
