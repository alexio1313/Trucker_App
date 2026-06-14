#!/bin/bash
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' \
  | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}})")

echo "=== Load service routes (port 3001) ==="
docker exec truck_load_service find /app -name "*.routes.js" 2>/dev/null | head -10
docker exec truck_load_service node -e "
var fs=require('fs');
var files=require('child_process').execSync('find /app -name \"*.routes.js\" 2>/dev/null').toString().trim().split('\n');
files.forEach(function(f){
  if(!f) return;
  try{
    var src=fs.readFileSync(f,'utf8');
    var matches=src.match(/router\.(get|post|put|delete|patch)\s*\(\s*['\"\`]([^'\"\`]+)/g)||[];
    if(matches.length){
      console.log('FILE:',f);
      matches.forEach(function(m){console.log('  ',m.substring(0,80));});
    }
  }catch(e){}
});
" 2>&1 | head -50

echo ""
echo "=== Test load service endpoints directly ==="
for ROUTE in "loads" "loads?limit=3" "loads/all" "all-loads" "admin/loads"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/api/v1/$ROUTE" -H "Authorization: Bearer $ADMIN_TOKEN" --max-time 3)
  echo "  GET /api/v1/$ROUTE → HTTP $CODE"
done

echo ""
echo "=== Gateway proxy config ==="
docker exec truck_api_gateway find /app -name "proxy*.js" -o -name "*route*gateway*" 2>/dev/null | head -5
docker exec truck_api_gateway node -e "
var fs=require('fs');
var files=require('child_process').execSync('find /app/dist -name \"*.js\" 2>/dev/null').toString().trim().split('\n');
files.forEach(function(f){
  if(!f) return;
  try{
    var src=fs.readFileSync(f,'utf8');
    if(src.indexOf('admin')>-1 && src.indexOf('proxy')>-1) {
      console.log('FILE:',f,'SIZE:',src.length);
      // Show proxy setup lines
      var lines=src.split('\n').filter(function(l){return l.indexOf('createProxy')>-1 || l.indexOf('/admin')>-1 || l.indexOf('ADMIN')>-1;});
      lines.slice(0,10).forEach(function(l){console.log('  ',l.trim().substring(0,100));});
    }
  }catch(e){}
});
" 2>&1 | head -40

echo ""
echo "=== Gateway routes to admin (check app.js) ==="
docker exec truck_api_gateway cat /app/dist/app.js 2>/dev/null | grep -E "admin|ADMIN" | head -20
