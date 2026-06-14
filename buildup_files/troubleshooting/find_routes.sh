#!/bin/bash
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' \
  | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}})")

echo "=== Exploring admin service routes (direct port 3004) ==="
for ROUTE in "" "health" "loads" "users" "kyc" "disputes" "social" "social-posts" "analytics" "dashboard" "stats" "all" "shipments" "truckers" "merchants" "platform"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3004/api/v1/admin/$ROUTE" -H "Authorization: Bearer $ADMIN_TOKEN" --max-time 3)
  if [ "$CODE" != "404" ]; then
    echo "  /admin/$ROUTE → HTTP $CODE"
    curl -s "http://localhost:3004/api/v1/admin/$ROUTE" -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 300
    echo ""
  fi
done

echo ""
echo "=== Admin service API root ==="
curl -s "http://localhost:3004/" -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 300

echo ""
echo "=== Check admin routes file ==="
docker exec truck_admin_service find /app -name "*.routes.js" -o -name "*admin*route*" 2>/dev/null | head -10

echo ""
echo "=== Admin service routes ==="
docker exec truck_admin_service find /app -name "*.routes.js" 2>/dev/null | xargs grep -l "loads\|social\|kyc" 2>/dev/null | head -5

echo ""
echo "=== What routes the admin service actually registers ==="
docker exec truck_admin_service node -e "
var fs=require('fs');
var files=require('child_process').execSync('find /app -name \"*.routes.js\" 2>/dev/null').toString().trim().split('\n');
files.forEach(function(f){
  if(!f) return;
  try{
    var src=fs.readFileSync(f,'utf8');
    var matches=src.match(/router\.(get|post|put|delete)\s*\(\s*['\"]([^'\"]+)/g)||[];
    if(matches.length) {
      console.log('FILE:',f);
      matches.forEach(function(m){console.log('  ',m.substring(0,80));});
    }
  }catch(e){}
});
" 2>&1 | head -60
