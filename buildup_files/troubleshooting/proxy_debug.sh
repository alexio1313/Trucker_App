#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accessToken'])")

echo "Token: ${TOKEN:0:30}..."

echo ""
echo "=== Sending request through gateway ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/loads

echo ""
echo "=== Load service logs after gateway request ==="
docker logs truck_load_service --tail=8 2>&1

echo ""
echo "=== Gateway error logs ==="
docker logs truck_api_gateway 2>&1 | grep -i "error\|warn\|proxy\|upstream" | tail -10

echo ""
echo "=== Test HPM proxy directly in gateway container ==="
docker exec truck_api_gateway node -e "
const http = require('http');
const opts = { hostname: 'load_service', port: 3001, path: '/api/v1/loads', method: 'GET',
  headers: { 'Authorization': 'test', 'x-user-id': 'test-id', 'x-user-type': 'merchant' }, timeout: 5000 };
const r = http.request(opts, res => {
  let b = '';
  res.on('data', d => b += d);
  res.on('end', () => console.log('STATUS:', res.statusCode, '| BODY:', b.substring(0, 200)));
});
r.on('error', e => console.log('ERROR:', e.message));
r.on('timeout', () => { r.destroy(); console.log('TIMEOUT'); });
r.end();
"
