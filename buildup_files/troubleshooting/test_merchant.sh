#!/bin/bash
# Test merchant login and dashboard APIs through the web proxy (port 3010)
TOKEN=$(curl -s -X POST http://localhost:3010/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")

echo "Merchant Token: ${TOKEN:0:20}..."

echo ""
echo "=== Merchant loads (my loads) ==="
curl -s "http://localhost:3010/api/v1/loads/search?merchantId=b0000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('success:', d.get('success'), 'items:', len(d.get('data',{}).get('items',[])))
if d.get('error'): print('ERROR:', d['error'])
"

echo ""
echo "=== Available loads (status=posted) ==="
curl -s "http://localhost:3010/api/v1/loads/search?status=posted&limit=3" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items = d.get('data',{}).get('items',[])
print('success:', d.get('success'), 'count:', len(items))
if items: print('first load:', items[0].get('loadId'))
"

echo ""
echo "=== Trucker dashboard API ==="
TRUCK_TOKEN=$(curl -s -X POST http://localhost:3010/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919770001001","password":"TruckQA@2024"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")
echo "Trucker Token: ${TRUCK_TOKEN:0:20}..."

curl -s "http://localhost:3010/api/v1/truckers/profile" \
  -H "Authorization: Bearer $TRUCK_TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('success:', d.get('success'), 'name:', d.get('data',{}).get('fullName'))
"

echo ""
echo "=== Nginx 502 test ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3010/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}')
echo "HTTP status: $CODE (expected 200)"

echo ""
echo "=== Recent nginx error log ==="
docker logs truck_web 2>&1 | grep -i error | tail -10
