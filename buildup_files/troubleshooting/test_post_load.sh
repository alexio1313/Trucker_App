#!/bin/bash
MERCH_TOKEN=$(curl -s -m 10 http://localhost:3000/api/v1/auth/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860002001","password":"Admin@123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")

echo "=== Post Load Test ==="
curl -s -m 10 http://localhost:3000/api/v1/loads \
  -X POST -H "Authorization: Bearer $MERCH_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 12.9716, "lng": 77.5946, "address": "Peenya Industrial Area", "city": "Bangalore", "state": "Karnataka"},
    "destination": {"lat": 17.3850, "lng": 78.4867, "address": "Patancheru Industrial Area", "city": "Hyderabad", "state": "Telangana"},
    "cargo": {"weightKg": 12000, "cargoType": "general"},
    "timeWindow": {
      "pickupStart": "2026-06-15T08:00:00.000Z",
      "pickupEnd": "2026-06-15T18:00:00.000Z",
      "deliveryExpected": "2026-06-16T18:00:00.000Z",
      "loadingTimeMinutes": 60,
      "unloadingTimeMinutes": 60
    }
  }'
echo ""
echo "=== Load Service Logs ==="
docker logs truck_load_service --tail=20 2>&1 | grep -v "GET /health"
