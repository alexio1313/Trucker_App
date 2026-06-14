#!/bin/bash
set -e
PROJECT_DIR="/home/ubuntu/truck-platform"
echo "=== Copying files ==="
cp /tmp/KYCContent.tsx "$PROJECT_DIR/apps/admin/src/app/admin/kyc/KYCContent.tsx"
cp /tmp/DisputesContent.tsx "$PROJECT_DIR/apps/admin/src/app/admin/disputes/DisputesContent.tsx"
cp /tmp/SocialContent.tsx "$PROJECT_DIR/apps/admin/src/app/admin/social/SocialContent.tsx"
cp /tmp/DashboardContent.tsx "$PROJECT_DIR/apps/admin/src/app/admin/DashboardContent.tsx"
echo "=== Rebuilding admin_panel ==="
cd "$PROJECT_DIR"
docker compose build --no-cache admin_panel 2>&1 | tail -50
echo "=== Restarting container ==="
docker compose up -d admin_panel --no-deps
sleep 8
echo "=== Container status ==="
docker ps --filter name=truck_admin_panel --format "{{.Names}}: {{.Status}}"
echo ""
echo "=== Health check ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3011/admin
echo ""
echo "=== DONE ==="
