#!/bin/bash
echo "=== Find MongoDB connection files in social service ==="
docker exec truck_social_service find /app/services -name "*.js" 2>/dev/null | grep -v node_modules | xargs grep -l "MongoClient\|mongoose\|mongodb" 2>/dev/null | head -5

echo ""
echo "=== Social service MongoDB config ==="
docker exec truck_social_service find /app/services -name "*.js" 2>/dev/null | grep -v node_modules | xargs grep -l "MongoClient" 2>/dev/null | while read f; do
  echo "FILE: $f"
  grep -A5 "MongoClient\|connect(" "$f" 2>/dev/null | head -10
  echo "---"
done

echo ""
echo "=== Fix: patch social service MongoDB connection ==="
docker exec truck_social_service node -e "
var fs=require('fs');
var cp=require('child_process');

// Find all JS files in social service (not node_modules)
var files=cp.execSync('find /app/services -name \"*.js\" 2>/dev/null').toString().trim().split('\n').filter(function(f){return f && f.indexOf('node_modules')===-1;});

var patched=0;
files.forEach(function(f){
  try{
    var src=fs.readFileSync(f,'utf8');
    if(src.indexOf('MongoClient')===-1 && src.indexOf('mongoose')===-1) return;

    // Replace URI-based connections that might have @ in password
    var newSrc=src;

    // Pattern: new MongoClient(process.env.MONGODB_URI || ...)
    if(newSrc.indexOf('MONGODB_URI')>-1 || newSrc.indexOf('mongodb://')>-1) {
      // Replace MongoClient with explicit auth version
      newSrc=newSrc.replace(
        /new MongoClient\s*\(\s*(process\.env\.MONGODB_URI\s*\|\|\s*)?['\"]\s*mongodb:\/\/[^'\"]+['\"],?\s*\{?[^}]*\}?\s*\)/g,
        \"new MongoClient('mongodb://mongodb:27017/truck_platform', { auth: { username: 'app_user', password: 'TruckPlatform@2024!Mongo' }, authSource: 'admin' })\"
      );

      // Also handle mongoose.connect
      newSrc=newSrc.replace(
        /mongoose\.connect\s*\(\s*(process\.env\.MONGODB_URI\s*\|\|\s*)?['\"]\s*mongodb:\/\/[^'\"]+['\"]/g,
        \"mongoose.connect('mongodb://app_user:TruckPlatform%402024%21Mongo@mongodb:27017/truck_platform?authSource=admin'\"
      );

      if(newSrc!==src) {
        fs.writeFileSync(f, newSrc);
        console.log('[ok] Fixed MongoDB connection in:', f);
        patched++;
      }
    }
  }catch(e){ console.log('[err]', f, e.message); }
});

if(patched===0) console.log('[info] No files patched - showing manual fix needed');
" 2>&1

echo ""
echo "=== Restart social service ==="
docker restart truck_social_service
sleep 4

echo ""
echo "=== Social service logs after restart ==="
docker logs truck_social_service --tail 10 2>&1

echo ""
echo "=== Test /posts endpoint ==="
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}")
curl -s --max-time 5 "http://localhost:3005/api/v1/social/posts" -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 300
