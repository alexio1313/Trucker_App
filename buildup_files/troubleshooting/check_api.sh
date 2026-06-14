#!/bin/bash
# Get admin token and check actual API response format
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' \
  | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}})")

echo "=== Admin Loads API response (first load) ==="
curl -s "http://localhost:3000/api/v1/admin/loads?page=1&limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "
var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{var j=JSON.parse(d); if(j.data&&j.data.loads) console.log(JSON.stringify(j.data.loads[0],null,2));
  else console.log(JSON.stringify(j,null,2).substring(0,1000));}catch(e){console.log(d.substring(0,500));}
})"

echo ""
echo "=== Admin loads route (what endpoint exists?) ==="
curl -s "http://localhost:3000/api/v1/admin/loads" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "
var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{var j=JSON.parse(d);var keys=j.data?Object.keys(j.data):[];console.log('keys:',keys.join(','));
  if(j.data&&j.data[0]) console.log('first item keys:',Object.keys(j.data[0]).join(','));
  else if(j.data&&j.data.loads) console.log('loads[0] keys:',Object.keys(j.data.loads[0]).join(','));
  }catch(e){console.log(d.substring(0,500));}})"

echo ""
echo "=== Admin Social Posts API ==="
curl -s "http://localhost:3000/api/v1/admin/social-posts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "
var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{var j=JSON.parse(d);console.log(JSON.stringify(j,null,2).substring(0,800));}
  catch(e){console.log(d.substring(0,400));}})"

echo ""
echo "=== Admin Users API ==="
curl -s "http://localhost:3000/api/v1/admin/users?limit=2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | node -e "
var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{var j=JSON.parse(d);if(j.data&&j.data[0]) console.log(Object.keys(j.data[0]).join(','));
  else console.log(JSON.stringify(j,null,2).substring(0,400));}
  catch(e){console.log(d.substring(0,400));}})"

echo ""
echo "=== Check what admin routes exist ==="
# Try various known patterns
for ROUTE in "loads" "load" "all-loads" "shipments"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/v1/admin/$ROUTE" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "  /admin/$ROUTE → HTTP $CODE"
done
