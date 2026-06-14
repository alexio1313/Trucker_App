#!/bin/bash
# Run from server host to test via localhost port mappings
TOKEN=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['accessToken']) if d.get('success') else print('FAIL:'+str(d))")

echo "Token: ${TOKEN:0:40}..."

echo ""
echo "--- Gateway /api/v1/loads ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/loads | python3 -m json.tool | head -30

echo ""
echo "--- Direct load_service /api/v1/loads ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/loads | python3 -m json.tool | head -30

echo ""
echo "--- Pricing quote via gateway ---"
curl -s -X POST http://localhost:3000/api/v1/pricing/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"originLat":12.9716,"originLng":77.5946,"originCity":"Bangalore","destLat":28.6139,"destLng":77.2090,"destCity":"Delhi","cargoWeightKg":5000,"cargoType":"general","truckType":"trailer","pickupStart":"2026-06-15T09:00:00Z"}' \
  | python3 -m json.tool | head -30

echo ""
echo "--- Auth middleware check (bad token) ---"
curl -s -H "Authorization: Bearer badtoken" http://localhost:3000/api/v1/loads | python3 -m json.tool
