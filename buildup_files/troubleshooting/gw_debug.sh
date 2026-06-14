#!/bin/bash
set -e
TOKEN=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['accessToken'])")

echo "Token obtained: ${TOKEN:0:30}..."

echo ""
echo "=== Gateway /api/v1/loads ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/loads

echo ""
echo "=== Gateway /api/v1/auth/me ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/auth/me | head -5

echo ""
echo "=== Direct load listing (merchant loads) ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-user-id: test" \
  -H "x-user-type: merchant" \
  http://localhost:3001/api/v1/loads | head -200

echo ""
echo "=== Pricing POST quote direct ==="
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  -X POST http://localhost:3003/api/v1/pricing/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-user-id: test" \
  -H "x-user-type: merchant" \
  -d '{"originLat":12.9716,"originLng":77.5946,"originCity":"Bangalore","destLat":28.6139,"destLng":77.2090,"destCity":"Delhi","cargoWeightKg":5000,"cargoType":"general","truckType":"trailer","pickupStart":"2026-06-15T09:00:00Z"}' | head -200

echo ""
echo "=== Gateway logs (last 10 lines) ==="
docker logs truck_api_gateway --tail=10 2>&1
