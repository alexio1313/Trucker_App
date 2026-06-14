#!/bin/bash
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}" 2>/dev/null)

echo "=== Social service /posts (via gateway) ==="
curl -s "http://localhost:3000/api/v1/social/posts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 500

echo ""
echo "=== Social service direct (port 3005) ==="
for ROUTE in "posts" "api/posts" "api/v1/social/posts"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3005/$ROUTE" -H "Authorization: Bearer $ADMIN_TOKEN" --max-time 3)
  echo "  /$ROUTE → HTTP $CODE"
done

echo ""
echo "=== Social service routes ==="
docker exec truck_social_service find /app -name "*.routes.js" -o -name "*route*.js" 2>/dev/null | head -5
docker exec truck_social_service node -e "
var fs=require('fs');
var cp=require('child_process');
var files=cp.execSync('find /app -name \"*.js\" 2>/dev/null | head -20').toString().trim().split('\n');
files.forEach(function(f){
  if(!f || f.indexOf('node_modules')>-1) return;
  try{
    var src=fs.readFileSync(f,'utf8');
    var matches=src.match(/router\.(get|post|put|patch|delete)\s*\(\s*['\"\`]([^'\"\`]+)/g)||[];
    if(matches.length){console.log('FILE:',f); matches.slice(0,5).forEach(function(m){console.log(' ',m.substring(0,70));});}
  }catch(e){}
});
" 2>&1 | head -40

echo ""
echo "=== MongoDB social_posts collection ==="
docker exec truck_mongodb mongosh "mongodb://app_user:TruckPlatform%402024%21Mongo@localhost:27017/truck_platform?authSource=admin" \
  --quiet \
  --eval 'var col=db.getSiblingDB("truck_platform").social_posts; print("Count:", col.countDocuments()); var p=col.findOne(); if(p) print("Sample keys:", Object.keys(p).join(","));' 2>&1
