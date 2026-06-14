#!/bin/bash
export PGPASSWORD="TruckPlatform@2024!Secure"
PG="docker exec -e PGPASSWORD=TruckPlatform@2024!Secure truck_postgres psql -U app_user -d truck_platform"

echo "=== users table columns ==="
$PG -c "\d users" 2>&1 | head -30

echo ""
echo "=== loads table columns ==="
$PG -c "\d loads" 2>&1 | head -30

echo ""
echo "=== Sample users ==="
$PG -c "SELECT * FROM users LIMIT 3;" 2>&1 | head -20

echo ""
echo "=== Sample loads ==="
$PG -c "SELECT * FROM loads LIMIT 2;" 2>&1

echo ""
echo "=== KYC table ==="
$PG -c "\dt" 2>&1

echo ""
echo "=== Disputes ==="
$PG -c "SELECT * FROM disputes LIMIT 3;" 2>&1 | head -20
