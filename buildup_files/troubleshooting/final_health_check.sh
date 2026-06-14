#!/bin/bash
echo "============================================"
echo "  FINAL HEALTH CHECK — $(date)"
echo "============================================"

# Get admin token
curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' > /tmp/adminlogin.json
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}")
echo "Admin token: ${#ADMIN_TOKEN} chars"
echo ""

check() {
  local label="$1"
  local url="$2"
  local expected_key="$3"
  local result=$(curl -s --max-time 5 "$url" -H "Authorization: Bearer $ADMIN_TOKEN")
  local has_key=$(echo "$result" | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);var k='$expected_key'.split('.').reduce(function(o,k){return o&&o[k];},j);console.log(k!==undefined&&k!==null?'OK':'MISSING');}catch(e){console.log('ERROR: '+d.substring(0,100));}})" 2>/dev/null)
  if [ "$has_key" = "OK" ]; then
    echo "  [OK] $label"
  else
    echo "  [FAIL] $label → $has_key"
  fi
}

echo "--- Admin Panel Endpoints ---"
check "Admin Loads"         "http://localhost:3004/api/v1/admin/loads?limit=3"  "data.loads"
check "Admin Social Posts"  "http://localhost:3004/api/v1/admin/social-posts"   "data.posts"
check "Admin KYC Queue"     "http://localhost:3004/api/v1/admin/kyc"            "data.items"
check "Admin Disputes"      "http://localhost:3004/api/v1/admin/disputes"       "data.items"
check "Admin Users"         "http://localhost:3004/api/v1/admin/users"          "data.items"
check "Admin Analytics"     "http://localhost:3004/api/v1/admin/analytics"      "data"

echo ""
echo "--- Social Service ---"
check "Social Posts (GW)"  "http://localhost:3000/api/v1/social/posts"        "data.items"

echo ""
echo "--- Load Counts ---"
export PGPASSWORD="TruckPlatform@2024!Secure"
docker exec -e PGPASSWORD=TruckPlatform@2024!Secure truck_postgres psql -U app_user -d truck_platform -t -c "SELECT 'Loads: '||COUNT(*)||' ('||STRING_AGG(status||':'||cnt,' / ') ||')' FROM (SELECT status, COUNT(*) as cnt FROM loads GROUP BY status) t;" 2>&1

echo ""
echo "--- Social Posts in MongoDB ---"
docker exec truck_mongodb mongosh "mongodb://app_user:TruckPlatform%402024%21Mongo@localhost:27017/truck_platform?authSource=admin" --quiet --eval 'var col=db.getSiblingDB("truck_platform").social_posts; var groups=col.aggregate([{$group:{_id:"$status",count:{$sum:1}}}]).toArray(); print(groups.map(function(g){return g._id+":"+g.count;}).join(" / "));' 2>&1

echo ""
echo "--- Container Health ---"
docker ps --format "{{.Names}}\t{{.Status}}" | grep truck | sort | head -15

echo ""
echo "============================================"
echo "  DEMO READY"
echo ""
echo "  Web Portal: http://192.168.8.101:3010"
echo "  Admin Panel: http://192.168.8.101:3011"
echo ""
echo "  Admin:    +919000000001 / TruckQA@2024"
echo "  Trucker:  +919860001001 / Admin@123"
echo "  Merchant: +919860002001 / Admin@123"
echo "============================================"
