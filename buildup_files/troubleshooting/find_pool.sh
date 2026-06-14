#!/bin/bash
echo "=== Find pool/DB connection files ==="
docker exec truck_admin_service find /app/dist -name "*.js" 2>/dev/null | xargs grep -l "Pool\|pg\.Pool\|postgres\|DATABASE_URL" 2>/dev/null | head -10

echo ""
echo "=== What require paths exist for DB ==="
docker exec truck_admin_service node -e "
var fs=require('fs');
var cp=require('child_process');
var files=cp.execSync('find /app/dist -name \"*.js\" 2>/dev/null').toString().trim().split('\n');
var dbFiles=[];
files.forEach(function(f){
  if(!f) return;
  try{
    var src=fs.readFileSync(f,'utf8');
    if(src.indexOf('Pool(')>-1||src.indexOf('pg.Pool')>-1||src.indexOf('Pool =')>-1||src.indexOf('DATABASE_URL')>-1) {
      dbFiles.push(f);
    }
  }catch(e){}
});
console.log('DB files:', dbFiles.join('\n'));
" 2>&1

echo ""
echo "=== Test admin/loads endpoint ==="
sleep 2
curl -s -X POST "http://localhost:3000/api/v1/auth/login" -H "Content-Type: application/json" -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' > /tmp/adminlogin.json
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}")
echo "Token: ${#ADMIN_TOKEN} chars"
curl -s "http://localhost:3004/api/v1/admin/loads?limit=3" -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 500
