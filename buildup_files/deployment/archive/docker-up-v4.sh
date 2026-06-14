#!/bin/bash
# AI TRUCK LOGISTICS PLATFORM - Docker Start Script (v4)
# Auto-applies all runtime patches on every start:
#   1. API Gateway proxy fix  (login body + path restore)
#   2. Auth service camelCase fix (white screen after login)
#   3. Social service MongoDB URI fix (password contains @)
#   4. Trucker service missing routes (profile/trucks/earnings/history/journey)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "=============================================="
echo "  AI TRUCK LOGISTICS PLATFORM - Starting Up"
echo "=============================================="

if [ ! -f .env ]; then
  cp .env.example .env
  echo "WARN: Created .env from .env.example"
fi

STOPPED=$(docker ps -a --filter "name=truck_" --filter "status=exited" --format "{{.Names}}" 2>/dev/null)
if [ -n "$STOPPED" ]; then
  echo "Removing stopped containers: $STOPPED"
  docker rm "$STOPPED"
fi

echo "[1/4] Starting databases and infrastructure..."
docker compose up -d postgres mongodb redis zookeeper elasticsearch
echo "Waiting 15s for databases to initialise..."
sleep 15

echo "[2/4] Starting Kafka and RabbitMQ..."
docker compose up -d kafka rabbitmq
sleep 8

echo "[3/4] Starting all application services..."
docker compose up -d

echo "[4/4] Applying runtime patches..."
sleep 5

# ── Patch 1: API Gateway proxy routes ────────────────────────────────────────
# Fixes login for all user types. express.json() consumes the body before the
# proxy can forward it; Express also strips /api/v1 prefix. Both fixed via
# req.originalUrl and body re-injection.
PROXY_PATCH="$SCRIPT_DIR/proxy.routes.patch.js"
if [ -f "$PROXY_PATCH" ]; then
  echo "  [1/4] Patching API gateway..."
  docker cp "$PROXY_PATCH" truck_api_gateway:/app/dist/routes/proxy.routes.js
  docker restart truck_api_gateway
  sleep 3
  echo "  Gateway patched."
else
  echo "  WARN: $PROXY_PATCH not found"
fi

# ── Patch 2: Trucker service auth → camelCase user object ────────────────────
# Fixes white screen: DB returns snake_case, React expects camelCase (userType etc.)
AUTH_PATCH="$SCRIPT_DIR/auth.service.patch.js"
if [ -f "$AUTH_PATCH" ]; then
  echo "  [2/4] Patching trucker auth service..."
  docker cp "$AUTH_PATCH" truck_trucker_service:/app/dist/auth/auth.service.js
  echo "  Auth service patched."
else
  echo "  WARN: $AUTH_PATCH not found"
fi

# ── Patch 3: Trucker service missing routes ───────────────────────────────────
# Adds: profile, trucks, earnings, history, journey (active-load, begin-loading,
# start, fuel-stop, deliver), bank details, KYC submit
TRUCKER_ROUTES_PATCH="$SCRIPT_DIR/trucker-routes-patch.js"
if [ -f "$TRUCKER_ROUTES_PATCH" ]; then
  echo "  [3/4] Patching trucker service routes..."
  docker cp "$TRUCKER_ROUTES_PATCH" truck_trucker_service:/app/dist/trucker-routes-patch.js
  # Inject require into app.js before the 404 handler (idempotent)
  docker exec truck_trucker_service node -e "
    const fs = require('fs');
    const p = '/app/dist/app.js';
    let c = fs.readFileSync(p, 'utf8');
    const marker = \"require('./trucker-routes-patch')\";
    if (!c.includes(marker)) {
      const insert = 'try { require(\"./trucker-routes-patch\")(app); } catch(e) { console.warn(\"trucker-routes-patch:\", e.message); }';
      c = c.replace('app.use((_req, res) => {', insert + '\napp.use((_req, res) => {');
      fs.writeFileSync(p, c);
      console.log('app.js patched');
    } else {
      console.log('app.js already patched');
    }
  "
  docker restart truck_trucker_service
  sleep 3
  echo "  Trucker routes patched."
else
  echo "  WARN: $TRUCKER_ROUTES_PATCH not found"
fi

# ── Patch 4: Social service MongoDB URI fix ───────────────────────────────────
# Fixes ENOTFOUND error: password TruckPlatform@2024!Mongo contains @ which breaks
# standard URI parser. Fixed by splitting on last @ instead of first.
MONGO_PATCH="$SCRIPT_DIR/mongo.patch.js"
if [ -f "$MONGO_PATCH" ]; then
  echo "  [4/4] Patching social service MongoDB..."
  docker cp "$MONGO_PATCH" truck_social_service:/app/dist/db/mongo.js
  docker restart truck_social_service
  sleep 3
  echo "  Social service patched."
else
  echo "  WARN: $MONGO_PATCH not found"
fi

# ── Patch 5: Admin service column name fixes ─────────────────────────────────
# Fixes: kyc.routes.js queries non-existent column kyc_doc_front_key (should
# be kyc_doc_front_url); analytics.routes.js queries platform_commission from
# payments table (doesn't exist there — it's on loads table).
KYC_PATCH="$SCRIPT_DIR/admin-kyc.routes.patch.js"
ANALYTICS_PATCH="$SCRIPT_DIR/admin-analytics.routes.patch.js"
if [ -f "$KYC_PATCH" ] && [ -f "$ANALYTICS_PATCH" ]; then
  echo "  [5/5] Patching admin service routes..."
  docker cp "$KYC_PATCH" truck_admin_service:/app/dist/admin/kyc.routes.js
  docker cp "$ANALYTICS_PATCH" truck_admin_service:/app/dist/admin/analytics.routes.js
  docker restart truck_admin_service
  sleep 3
  echo "  Admin service patched."
else
  echo "  WARN: Admin patch files not found"
fi

docker compose ps

echo ""
echo "=============================================="
echo "  ACCESS URLS"
echo "=============================================="
echo "  Web App:      http://192.168.8.101:3011"
echo "  API Gateway:  http://192.168.8.101:3000"
echo "  Admin Panel:  http://192.168.8.101:3011/admin"
echo "  Admin Svc:    http://192.168.8.101:3004/health"
echo "  Trucker Svc:  http://192.168.8.101:3002/health"
echo "  Load Svc:     http://192.168.8.101:3001/health"
echo "  Social Svc:   http://192.168.8.101:3005/health"
echo "  Grafana:      http://192.168.8.101:3020"
echo "  RabbitMQ:     http://192.168.8.101:15672"
echo "=============================================="
