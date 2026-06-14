#!/bin/bash
curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' > /tmp/adminlogin.json
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}")

echo "=== KYC route source ==="
docker exec truck_admin_service cat /app/dist/admin/kyc.routes.js | head -60

echo ""
echo "=== Disputes route source ==="
docker exec truck_admin_service cat /app/dist/admin/disputes.routes.js | head -60

echo ""
echo "=== Test KYC directly (30s timeout) ==="
curl -s --max-time 30 "http://localhost:3004/api/v1/admin/kyc" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 500
echo ""
echo "Exit: $?"

echo ""
echo "=== Admin service logs (last 30 lines) ==="
docker logs truck_admin_service --tail 30 2>&1
