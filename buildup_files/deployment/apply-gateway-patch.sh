#!/bin/bash
# One-time patch for AI Truck Platform API Gateway
# Run this on the demo laptop after "docker compose up" to fix login.
# After this, docker-up.sh will apply the patch automatically on every start.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== AI Truck Platform - Apply Gateway Login Fix ==="

# Check the patch file exists
PATCH_JS="$SCRIPT_DIR/proxy.routes.patch.js"
if [ ! -f "$PATCH_JS" ]; then
  echo "ERROR: $PATCH_JS not found. Run this script from the scripts/ directory."
  exit 1
fi

# Check gateway container is running
if ! docker ps --format "{{.Names}}" | grep -q "truck_api_gateway"; then
  echo "ERROR: truck_api_gateway container is not running. Start containers first with docker-up.sh"
  exit 1
fi

echo "Patching API gateway proxy routes..."
docker cp "$PATCH_JS" truck_api_gateway:/app/dist/routes/proxy.routes.js
docker restart truck_api_gateway
sleep 4

echo "Testing login..."
RESULT=$(curl -s --max-time 10 -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' 2>/dev/null | head -c 50)

if echo "$RESULT" | grep -q "success.*true"; then
  echo "SUCCESS: Login works."
else
  echo "WARN: Login test inconclusive. Response: $RESULT"
  echo "      Try manually: curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"phoneNumber\":\"+919000000001\",\"password\":\"TruckQA@2024\"}'"
fi

echo ""
echo "Patch applied. docker-up.sh will auto-apply this on every restart."
