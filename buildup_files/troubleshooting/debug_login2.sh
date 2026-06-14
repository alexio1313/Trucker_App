#!/bin/bash
echo "=== Test Admin login (5s timeout) ==="
curl -s --max-time 5 -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' 2>&1 | head -c 500

echo ""
echo "=== Test Trucker login ==="
curl -s --max-time 5 -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860001001","password":"Admin@123"}' 2>&1 | head -c 500

echo ""
echo "=== Auth route check - what does /auth/login return? ==="
curl -sv --max-time 5 -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' 2>&1 | grep -E "(< HTTP|< |{|error|success)" | head -20

echo ""
echo "=== Check which service handles auth ==="
docker logs truck_api_gateway --tail=5 2>&1 | head -10

echo ""
echo "=== Users in DB ==="
docker exec truck_postgres psql -U app_user -d truck_platform -c \
  "SELECT phone_number, user_type, password_hash IS NOT NULL as has_pw FROM users LIMIT 8;" 2>/dev/null

echo ""
echo "=== Is trucker service healthy? ==="
curl -s --max-time 3 http://localhost:3002/health | head -c 200
