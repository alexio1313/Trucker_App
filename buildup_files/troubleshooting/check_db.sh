#!/bin/bash
echo "=== Users in DB ==="
docker exec truck_postgres psql -U postgres -d truck_platform -c "SELECT phone, role, full_name, kyc_status, availability_status FROM users ORDER BY role, phone LIMIT 20;"

echo ""
echo "=== Loads in DB ==="
docker exec truck_postgres psql -U postgres -d truck_platform -c "SELECT load_id, status, merchant_id, trucker_id FROM loads LIMIT 10;"

echo ""
echo "=== Social posts in MongoDB ==="
docker exec truck_mongodb mongosh --quiet --eval "db = db.getSiblingDB('truck_platform'); printjson(db.social_posts.find({},{_id:0,status:1,createdByName:1,platforms:1}).toArray())"

echo ""
echo "=== KYC documents ==="
docker exec truck_postgres psql -U postgres -d truck_platform -c "SELECT user_id, status FROM kyc_documents LIMIT 10;" 2>/dev/null || echo "No kyc_documents table or no data"

echo ""
echo "=== Disputes ==="
docker exec truck_postgres psql -U postgres -d truck_platform -c "SELECT dispute_id, status, category FROM disputes LIMIT 10;" 2>/dev/null || echo "No disputes table or no data"
