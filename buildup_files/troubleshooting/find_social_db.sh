#!/bin/bash
echo "=== Social service dist files ==="
docker exec truck_social_service find /app/services/social-publishing/dist -name "*.js" 2>/dev/null | grep -v node_modules | head -20

echo ""
echo "=== Files with MongoDB connections ==="
docker exec truck_social_service bash -c "find /app/services/social-publishing/dist -name '*.js' 2>/dev/null | xargs grep -l 'MongoClient\|mongoose\|mongodb' 2>/dev/null" | head -10

echo ""
echo "=== Social service app entry ==="
docker exec truck_social_service cat /app/services/social-publishing/dist/app.js 2>/dev/null | head -50

echo ""
echo "=== Social service index ==="
docker exec truck_social_service node -e "
var cp=require('child_process');
var files=cp.execSync('find /app/services/social-publishing/dist -name \"*.js\" 2>/dev/null').toString().trim().split('\n');
var fs=require('fs');
files.forEach(function(f){
  if(!f) return;
  try{
    var src=fs.readFileSync(f,'utf8');
    if(src.indexOf('MongoClient')>-1 || src.indexOf('mongoose.connect')>-1) {
      console.log('FOUND:', f);
      // Show context
      var idx=src.indexOf('MongoClient');
      if(idx>-1) console.log(src.slice(Math.max(0,idx-50), idx+200));
    }
  }catch(e){}
});
" 2>&1 | head -60
