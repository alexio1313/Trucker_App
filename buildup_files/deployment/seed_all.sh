#!/bin/bash
# Comprehensive demo data seed — run on SERVER as bash /tmp/seed_all.sh
set -e

PG_PASS="TruckPlatform@2024!Secure"
MONGO_URI="mongodb://app_user:TruckPlatform%402024%21Mongo@localhost:27017/truck_platform?authSource=admin"
GW="http://localhost:3000/api/v1"

export PGPASSWORD="$PG_PASS"
PG="docker exec -e PGPASSWORD=$PG_PASS truck_postgres psql -U app_user -d truck_platform"

echo "============================================"
echo "  AI Trucker Platform — Demo Data Seed"
echo "  $(date)"
echo "============================================"

# ─── 1. Check / verify users ─────────────────────────────────────────────────
echo ""
echo "[1] Checking existing users..."
$PG -c "SELECT phone, role, full_name, kyc_status, availability_status FROM users ORDER BY role, phone LIMIT 20;" 2>&1 || echo "Could not query users"

# ─── 2. Seed social posts in MongoDB ─────────────────────────────────────────
echo ""
echo "[2] Seeding social posts in MongoDB..."

docker exec truck_mongodb mongosh \
  "mongodb://app_user:TruckPlatform%402024%21Mongo@localhost:27017/truck_platform?authSource=admin" \
  --quiet \
  --eval '
var col = db.getSiblingDB("truck_platform").social_posts;
var count = col.countDocuments();
print("  Existing posts: " + count);

if (count < 5) {
  var now = new Date();
  var d1 = new Date(now - 7*86400000);
  var d2 = new Date(now - 5*86400000);
  var d3 = new Date(now - 3*86400000);
  var d4 = new Date(now - 1*86400000);
  var d5 = new Date(now - 6*3600000);
  var d6 = new Date(now - 2*86400000);

  col.insertMany([
    {
      createdBy: "f2000000-0000-0000-0000-000000000001",
      createdByName: "TechLogix Bangalore",
      platforms: ["linkedin","twitter"],
      content: "Excited to announce TechLogix has partnered with TruckPlatform for all our Mumbai to Bangalore freight needs! Reliable trucks, real-time tracking, and guaranteed delivery - exactly what our electronics supply chain needed. The future of logistics is here!\n\n#TruckPlatform #Logistics #SupplyChain #Electronics #B2BIndia",
      status: "published",
      mediaUrls: [],
      scheduledFor: null,
      publishResults: [{platform:"linkedin",success:true},{platform:"twitter",success:true}],
      createdAt: d2,
      publishedAt: d2,
      approvedBy: "admin-1",
      approvedAt: d2
    },
    {
      createdBy: "f2000000-0000-0000-0000-000000000002",
      createdByName: "NorthLink Delhi",
      platforms: ["facebook","whatsapp"],
      content: "NorthLink Delhi is now using AI-powered freight matching for all our North India routes! TruckPlatform found us a verified 20-tonne truck for our Delhi to Ludhiana textile shipment in under 10 minutes. That is the power of technology!\n\n#NorthIndia #Logistics #TextileIndustry #Delhi #Trucking",
      status: "published",
      mediaUrls: [],
      scheduledFor: null,
      publishResults: [{platform:"facebook",success:true},{platform:"whatsapp",success:true}],
      createdAt: d3,
      publishedAt: d3,
      approvedBy: "admin-1",
      approvedAt: d3
    },
    {
      createdBy: "f2000000-0000-0000-0000-000000000003",
      createdByName: "MarinePort Mumbai",
      platforms: ["linkedin","instagram","facebook"],
      content: "The logistics revolution in Indian ports has arrived. MarinePort Mumbai now handles seamless last-mile delivery from JNPT to 50+ cities via TruckPlatform verified carrier network.\n\n24-hour dispatch | Real-time GPS tracking | Secure digital payments | Dispute resolution support\n\n#JNPT #Mumbai #PortLogistics #ExportIndia #SupplyChain",
      status: "published",
      mediaUrls: [],
      scheduledFor: null,
      publishResults: [{platform:"linkedin",success:true},{platform:"facebook",success:true},{platform:"instagram",success:true}],
      createdAt: d1,
      publishedAt: d1,
      approvedBy: "admin-1",
      approvedAt: d1
    },
    {
      createdBy: "f2000000-0000-0000-0000-000000000003",
      createdByName: "MarinePort Mumbai",
      platforms: ["linkedin","instagram"],
      content: "MarinePort Mumbai celebrates 500 loads dispatched via TruckPlatform! From JNPT to warehouses across Maharashtra - our freight has never moved faster or more affordably. Here is to the next 500!\n\n#Mumbai #PortLogistics #Maharashtra #FreightForwarder #Milestone",
      status: "pending_approval",
      mediaUrls: [],
      scheduledFor: null,
      publishResults: [],
      createdAt: d4,
      publishedAt: null
    },
    {
      createdBy: "f2000000-0000-0000-0000-000000000001",
      createdByName: "TechLogix Bangalore",
      platforms: ["twitter"],
      content: "Looking for urgently: 2 trucks BLR to HYD tomorrow morning for electronics consignment. 12T each. FASTag mandatory. Contact via TruckPlatform app. #UrgentCargo #Bangalore #Hyderabad #B2BLogistics",
      status: "pending_approval",
      mediaUrls: [],
      scheduledFor: null,
      publishResults: [],
      createdAt: d5,
      publishedAt: null
    },
    {
      createdBy: "f2000000-0000-0000-0000-000000000002",
      createdByName: "NorthLink Delhi",
      platforms: ["instagram"],
      content: "Flash sale on Delhi-Mumbai corridor lanes this week! Book through TruckPlatform and get priority matching for your cargo.\n\n#Delhi #Mumbai #Logistics #FreightSale",
      status: "rejected",
      rejectionReason: "Pricing claims need to be verified with the commercial team first. Please resubmit after confirmation.",
      mediaUrls: [],
      scheduledFor: null,
      publishResults: [],
      createdAt: d6,
      publishedAt: null
    }
  ]);
  print("  Inserted 6 social posts (3 published, 2 pending, 1 rejected)");
} else {
  print("  Posts already exist, skipping");
}
' 2>&1

# ─── 3. Get admin token ───────────────────────────────────────────────────────
echo ""
echo "[3] Getting auth tokens..."
ADMIN_TOKEN=$(curl -s -X POST "$GW/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' \
  | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}})") 2>/dev/null

if [ -z "$ADMIN_TOKEN" ]; then
  echo "  [warn] Admin login failed — using x-user-id header approach"
else
  echo "  [ok] Admin token obtained (${#ADMIN_TOKEN} chars)"
fi

# Try to get trucker/merchant tokens
TRUCKER1_TOKEN=$(curl -s -X POST "$GW/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860001001","password":"Admin@123"}' \
  | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}})") 2>/dev/null

MERCHANT1_TOKEN=$(curl -s -X POST "$GW/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860002001","password":"Admin@123"}' \
  | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data.accessToken||'');}catch(e){console.log('');}})") 2>/dev/null

echo "  Trucker1 token: $([ -n "$TRUCKER1_TOKEN" ] && echo "OK (${#TRUCKER1_TOKEN} chars)" || echo "MISSING")"
echo "  Merchant1 token: $([ -n "$MERCHANT1_TOKEN" ] && echo "OK (${#MERCHANT1_TOKEN} chars)" || echo "MISSING")"

# ─── 4. Check what loads exist ───────────────────────────────────────────────
echo ""
echo "[4] Checking existing loads..."
$PG -c "SELECT load_id, status, (SELECT phone FROM users WHERE user_id=merchant_id) as merchant FROM loads ORDER BY created_at DESC LIMIT 10;" 2>&1 || echo "Could not query loads"

# ─── 5. Seed loads (via load service API if we have merchant token) ───────────
echo ""
echo "[5] Seeding demo loads..."

if [ -n "$MERCHANT1_TOKEN" ]; then
  # Post loads via API using merchant1 token
  for LOAD_DATA in \
    '{"origin":{"city":"Chennai","state":"Tamil Nadu","address":"Anna Salai Industrial Area, Chennai 600002","pincode":"600002","contactName":"Rajesh Kumar","contactPhone":"+919444001001","coordinates":{"lat":13.0827,"lng":80.2707}},"destination":{"city":"Mysuru","state":"Karnataka","address":"Hebbal Industrial Area, Mysuru 570017","pincode":"570017","contactName":"Suresh Nair","contactPhone":"+919480001001","coordinates":{"lat":12.2958,"lng":76.6394}},"cargo":{"description":"Automotive components and spare parts","cargoType":"Automotive Parts","weightKg":8000,"volumeCbm":42,"isFragile":false,"isHazmat":false,"requiresRefrigeration":false},"pricing":{"basePrice":72000,"currency":"INR"},"timeWindow":{"pickupDate":"2026-06-15T06:00:00Z","deliveryDate":"2026-06-16T18:00:00Z"},"specialInstructions":"Handle with care — precision components. Driver must carry GSTIN invoice."}' \
    '{"origin":{"city":"Mumbai","state":"Maharashtra","address":"JNPT Road, Nhava Sheva, Navi Mumbai 400707","pincode":"400707","contactName":"Priya Mehta","contactPhone":"+919022001001","coordinates":{"lat":18.9467,"lng":72.9520}},"destination":{"city":"Surat","state":"Gujarat","address":"Sachin GIDC, Surat 394230","pincode":"394230","contactName":"Amit Patel","contactPhone":"+919261001001","coordinates":{"lat":21.1702,"lng":72.8311}},"cargo":{"description":"Consumer electronics — laptops, tablets, accessories","cargoType":"Electronics","weightKg":3500,"volumeCbm":28,"isFragile":true,"isHazmat":false,"requiresRefrigeration":false},"pricing":{"basePrice":48000,"currency":"INR"},"timeWindow":{"pickupDate":"2026-06-15T08:00:00Z","deliveryDate":"2026-06-15T20:00:00Z"},"specialInstructions":"Fragile cargo. Air-ride suspension truck preferred. No stacking."}' \
    '{"origin":{"city":"Delhi","state":"Delhi","address":"Okhla Industrial Estate Phase III, New Delhi 110020","pincode":"110020","contactName":"Vikram Singh","contactPhone":"+919011001001","coordinates":{"lat":28.5355,"lng":77.2090}},"destination":{"city":"Kanpur","state":"Uttar Pradesh","address":"Panki Industrial Area, Kanpur 208022","pincode":"208022","contactName":"Ramesh Gupta","contactPhone":"+919512001001","coordinates":{"lat":26.4499,"lng":80.3319}},"cargo":{"description":"Finished textiles — shirts, trousers, ethnic wear","cargoType":"Textiles","weightKg":12000,"volumeCbm":65,"isFragile":false,"isHazmat":false,"requiresRefrigeration":false},"pricing":{"basePrice":38000,"currency":"INR"},"timeWindow":{"pickupDate":"2026-06-16T05:00:00Z","deliveryDate":"2026-06-16T17:00:00Z"},"specialInstructions":"Goods covered with waterproof tarpaulin. Driver must obtain signed delivery receipt."}'; do
    RESULT=$(curl -s -X POST "$GW/loads" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $MERCHANT1_TOKEN" \
      -d "$LOAD_DATA" 2>/dev/null)
    LOAD_ID=$(echo "$RESULT" | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data&&j.data.loadId||j.data&&j.data.load_id||'');}catch(e){console.log('');}})" 2>/dev/null)
    if [ -n "$LOAD_ID" ]; then
      echo "  [ok] Load created: $LOAD_ID"
    else
      # Try alternate path
      RESULT2=$(curl -s -X POST "http://localhost:3001/api/v1/loads" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $MERCHANT1_TOKEN" \
        -d "$LOAD_DATA" 2>/dev/null)
      LOAD_ID2=$(echo "$RESULT2" | node -e "var d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{var j=JSON.parse(d);console.log(j.data&&(j.data.loadId||j.data.load_id)||'');}catch(e){console.log('');}})" 2>/dev/null)
      if [ -n "$LOAD_ID2" ]; then
        echo "  [ok] Load created via direct: $LOAD_ID2"
      else
        echo "  [warn] Load creation failed. GW response: $(echo $RESULT | head -c 200)"
      fi
    fi
  done
else
  echo "  [skip] No merchant token — checking if loads already exist..."
  $PG -c "SELECT COUNT(*) as load_count FROM loads;" 2>&1 || true
fi

# ─── 6. Seed KYC submissions ──────────────────────────────────────────────────
echo ""
echo "[6] Checking KYC status..."
$PG -c "SELECT u.phone, u.full_name, u.role, u.kyc_status FROM users u WHERE u.role IN ('trucker','merchant') ORDER BY u.phone LIMIT 10;" 2>&1 || echo "Could not query KYC"

# Submit KYC if trucker token available
if [ -n "$TRUCKER1_TOKEN" ]; then
  KYC_RESULT=$(curl -s -X POST "$GW/truckers/kyc" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TRUCKER1_TOKEN" \
    -d '{"aadhaarNumber":"1234-5678-9012","panNumber":"ABCDE1234F","drivingLicenseNumber":"TN01-20180012345","documentUrls":{"aadhaar":"https://demo.truckplatform.in/kyc/aadhaar_demo.jpg","pan":"https://demo.truckplatform.in/kyc/pan_demo.jpg","drivingLicense":"https://demo.truckplatform.in/kyc/dl_demo.jpg"}}' 2>/dev/null)
  echo "  Trucker KYC submit: $(echo $KYC_RESULT | head -c 200)"
fi

# ─── 7. Final summary ────────────────────────────────────────────────────────
echo ""
echo "[7] Final state check..."
echo "--- Users ---"
$PG -c "SELECT role, COUNT(*) as count FROM users GROUP BY role;" 2>&1 || true
echo "--- Loads ---"
$PG -c "SELECT status, COUNT(*) as count FROM loads GROUP BY status;" 2>&1 || true
echo "--- MongoDB social posts ---"
docker exec truck_mongodb mongosh \
  "mongodb://app_user:TruckPlatform%402024%21Mongo@localhost:27017/truck_platform?authSource=admin" \
  --quiet \
  --eval 'var col=db.getSiblingDB("truck_platform").social_posts; var agg=col.aggregate([{$group:{_id:"$status",count:{$sum:1}}}]).toArray(); printjson(agg);' 2>&1

echo ""
echo "============================================"
echo "  SEED COMPLETE — $(date)"
echo "============================================"
echo ""
echo "Demo URLs:"
echo "  Web portal:   http://192.168.8.101:3010"
echo "  Admin panel:  http://192.168.8.101:3011"
echo ""
echo "Demo credentials:"
echo "  Admin:    +919000000001 / TruckQA@2024"
echo "  Trucker:  +919860001001 / Admin@123"
echo "  Merchant: +919860002001 / Admin@123"
