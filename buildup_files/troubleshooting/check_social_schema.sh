#!/bin/bash
export PGPASSWORD="TruckPlatform@2024!Secure"
PG="docker exec -e PGPASSWORD=TruckPlatform@2024!Secure truck_postgres psql -U app_user -d truck_platform"

echo "=== social_posts table schema ==="
$PG -c "\d social_posts"

echo ""
echo "=== Sample social_posts ==="
$PG -c "SELECT * FROM social_posts LIMIT 3;" 2>&1 | head -30

echo ""
echo "=== Loads full select (first 2) ==="
$PG -c "SELECT l.load_id, l.status, l.origin_city, l.dest_city, l.cargo_type, l.cargo_weight_kg, l.agreed_price, l.created_at, u.full_name as merchant_name, u.phone_number as merchant_phone FROM loads l LEFT JOIN users u ON u.user_id=l.merchant_id LIMIT 2;" 2>&1

echo ""
echo "=== Admin service app.js route registration ==="
docker exec truck_admin_service cat /app/dist/app.js 2>&1 | grep -E "router|route|use|kyc|disputes|loads|social" | head -30
