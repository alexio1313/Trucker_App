#!/bin/bash
# Test trucker endpoints and load posting format

MERCH_TOKEN=$(curl -s -m 10 http://localhost:3000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860002001","password":"Admin@123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")

TRUCK_TOKEN=$(curl -s -m 10 http://localhost:3000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860001001","password":"Admin@123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")

echo "=== Merchant post load (with pickup times) ==="
curl -s -m 10 http://localhost:3000/api/v1/loads \
  -X POST -H "Authorization: Bearer $MERCH_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "originCity": "Bangalore", "originState": "Karnataka",
    "originLat": 12.9716, "originLng": 77.5946, "originAddress": "Peenya Industrial Area",
    "destCity": "Hyderabad", "destState": "Telangana",
    "destLat": 17.3850, "destLng": 78.4867, "destAddress": "Patancheru Industrial Area",
    "cargoType": "general", "cargoWeightKg": 12000, "distanceKm": 570, "agreedPrice": 34200,
    "pickupStart": "2026-06-15T08:00:00.000Z", "pickupEnd": "2026-06-15T18:00:00.000Z"
  }' | head -c 400
echo ""

echo "=== Trucker profile endpoints ==="
curl -s -m 10 http://localhost:3002/api/v1/truckers/profile \
  -H "Authorization: Bearer $TRUCK_TOKEN" | head -c 200
echo ""
curl -s -m 10 http://localhost:3002/api/v1/truckers/my/profile \
  -H "Authorization: Bearer $TRUCK_TOKEN" | head -c 200
echo ""

echo "=== Trucker availability ==="
curl -s -m 10 http://localhost:3000/api/v1/truckers/availability \
  -X PATCH -H "Authorization: Bearer $TRUCK_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"available"}' | head -c 200
echo ""
