#!/bin/bash
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}" 2>/dev/null)

# If login file doesn't exist, refresh it
if [ -z "$ADMIN_TOKEN" ]; then
  curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' > /tmp/adminlogin.json
  ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}")
fi

echo "=== Gateway: /admin/loads ==="
RESULT=$(curl -s "http://localhost:3000/api/v1/admin/loads?limit=2" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESULT" | head -c 300

echo ""
echo ""
echo "=== Gateway: /admin/social-posts ==="
RESULT2=$(curl -s "http://localhost:3000/api/v1/admin/social-posts" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESULT2" | head -c 200

echo ""
echo ""
echo "=== Gateway: /admin/kyc ==="
RESULT3=$(curl -s "http://localhost:3000/api/v1/admin/kyc" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESULT3" | head -c 200

echo ""
echo ""
echo "=== Gateway: /admin/disputes ==="
RESULT4=$(curl -s "http://localhost:3000/api/v1/admin/disputes" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$RESULT4" | head -c 200
