#!/bin/bash
curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' > /tmp/adminlogin.json
ADMIN_TOKEN=$(node -e "var d=require('fs').readFileSync('/tmp/adminlogin.json','utf8');try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}")
echo "Token: ${#ADMIN_TOKEN} chars"

echo ""
echo "=== Test /admin/loads ==="
curl -s "http://localhost:3004/api/v1/admin/loads?limit=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "
var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{var j=JSON.parse(d);
    if(j.data&&j.data.loads) {
      console.log('Total loads:', j.data.total);
      var l=j.data.loads[0];
      if(l) console.log('First load:', JSON.stringify({load_id:l.load_id,status:l.status,origin_city:l.origin_city,dest_city:l.dest_city,merchant_name:l.merchant_name,agreed_price:l.agreed_price},null,2));
    } else {
      console.log(JSON.stringify(j,null,2).substring(0,400));
    }
  }catch(e){console.log(d.substring(0,400));}})"

echo ""
echo "=== Test /admin/social-posts ==="
curl -s "http://localhost:3004/api/v1/admin/social-posts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "
var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{var j=JSON.parse(d);
    if(j.data&&j.data.posts) {
      console.log('Total posts:', j.data.total);
      j.data.posts.forEach(function(p){console.log(' -',p.status,':',p.createdByName,'->',p.platforms);});
    } else {
      console.log(JSON.stringify(j,null,2).substring(0,400));
    }
  }catch(e){console.log(d.substring(0,400));}})"

echo ""
echo "=== Test /admin/kyc via gateway ==="
curl -s "http://localhost:3000/api/v1/admin/kyc" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 300

echo ""
echo "=== Test /admin/disputes ==="
curl -s "http://localhost:3000/api/v1/admin/disputes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | head -c 400
