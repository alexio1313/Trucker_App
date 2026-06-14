#!/bin/bash
# Get token first
LOGIN=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}')
echo "Login status: $(echo $LOGIN | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("success"))')"

TOKEN=$(echo $LOGIN | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["data"]["accessToken"])')
echo "Token: ${TOKEN:0:40}..."

echo ""
echo "=== No auth token → expect 401 ==="
curl -s -w "\nHTTP: %{http_code}" http://localhost:3000/api/v1/loads

echo ""
echo ""
echo "=== With valid bearer token ==="
curl -s -w "\nHTTP: %{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/loads

echo ""
echo ""
echo "=== Check auth/me ==="
curl -s -w "\nHTTP: %{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/auth/me | head -5

echo ""
echo ""
echo "=== Redis check from gateway ==="
docker exec truck_api_gateway node -e "
const {createClient} = require('redis');
const c = createClient({url: 'redis://redis:6379'});
c.connect().then(() => {
  console.log('Redis connected OK');
  return c.ping();
}).then(r => {
  console.log('PING:', r);
  c.quit();
}).catch(e => {
  console.log('Redis ERROR:', e.message);
});
"

echo ""
echo "=== Gateway recent access logs ==="
docker logs truck_api_gateway --tail=5 2>&1 | grep -v '"level"'
