#!/bin/bash
# AI TRUCK LOGISTICS PLATFORM - Docker Start Script (v5)
# Auto-applies all runtime patches on every start:
#   1. API Gateway proxy fix  (login body + path restore)
#   2. Auth service camelCase fix (white screen after login)
#   3. Social service MongoDB URI fix (password contains @)
#   4. Trucker service missing routes (profile/trucks/earnings/history/journey)
#   5. Admin service: kyc, analytics, feature-flags, app (audit-logs), users routes
#   6. Web app bundle: admin user redirect to port 3011
#   7. Nginx reload (fix stale upstream connections after restarts)

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

# Swap the admin panel to use the rebuilt image that has the signout button
echo "  Ensuring admin panel uses rebuilt image with signout button..."
if docker image inspect truck_admin_panel_new >/dev/null 2>&1; then
  docker stop truck_admin_panel 2>/dev/null || true
  docker rm truck_admin_panel 2>/dev/null || true
  docker run -d \
    --name truck_admin_panel \
    --network truck-platform_platform_network \
    -p 3011:3001 \
    --restart unless-stopped \
    truck_admin_panel_new
  echo "  Admin panel started with signout button image."
fi

echo "[4/5] Applying runtime patches..."
sleep 5

# ── Patch 1: API Gateway proxy routes ────────────────────────────────────────
PROXY_PATCH="$SCRIPT_DIR/proxy.routes.patch.js"
if [ -f "$PROXY_PATCH" ]; then
  echo "  [1/7] Patching API gateway..."
  docker cp "$PROXY_PATCH" truck_api_gateway:/app/dist/routes/proxy.routes.js
  docker restart truck_api_gateway
  sleep 3
  echo "  Gateway patched."
else
  echo "  WARN: $PROXY_PATCH not found"
fi

# ── Patch 2: Trucker service auth → camelCase user object ────────────────────
AUTH_PATCH="$SCRIPT_DIR/auth.service.patch.js"
if [ -f "$AUTH_PATCH" ]; then
  echo "  [2/7] Patching trucker auth service..."
  docker cp "$AUTH_PATCH" truck_trucker_service:/app/dist/auth/auth.service.js
  echo "  Auth service patched."
else
  echo "  WARN: $AUTH_PATCH not found"
fi

# ── Patch 3: Trucker service missing routes ───────────────────────────────────
TRUCKER_ROUTES_PATCH="$SCRIPT_DIR/trucker-routes-patch.js"
if [ -f "$TRUCKER_ROUTES_PATCH" ]; then
  echo "  [3/7] Patching trucker service routes..."
  docker cp "$TRUCKER_ROUTES_PATCH" truck_trucker_service:/app/dist/trucker-routes-patch.js
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
MONGO_PATCH="$SCRIPT_DIR/mongo.patch.js"
if [ -f "$MONGO_PATCH" ]; then
  echo "  [4/7] Patching social service MongoDB..."
  docker cp "$MONGO_PATCH" truck_social_service:/app/dist/db/mongo.js
  docker restart truck_social_service
  sleep 3
  echo "  Social service patched."
else
  echo "  WARN: $MONGO_PATCH not found"
fi

# ── Patch 5: Admin service — all route fixes ──────────────────────────────────
KYC_PATCH="$SCRIPT_DIR/admin-kyc.routes.patch.js"
ANALYTICS_PATCH="$SCRIPT_DIR/admin-analytics.routes.patch.js"
FF_PATCH="$SCRIPT_DIR/admin-feature-flags.routes.patch.js"
APP_PATCH="$SCRIPT_DIR/admin-app.patch.js"
USERS_PATCH="$SCRIPT_DIR/admin-users.routes.patch.js"

if [ -f "$KYC_PATCH" ]; then
  echo "  [5/7] Patching admin service routes..."
  [ -f "$KYC_PATCH" ]       && docker cp "$KYC_PATCH"       truck_admin_service:/app/dist/admin/kyc.routes.js
  [ -f "$ANALYTICS_PATCH" ] && docker cp "$ANALYTICS_PATCH" truck_admin_service:/app/dist/admin/analytics.routes.js
  [ -f "$FF_PATCH" ]        && docker cp "$FF_PATCH"         truck_admin_service:/app/dist/admin/feature-flags.routes.js
  [ -f "$APP_PATCH" ]       && docker cp "$APP_PATCH"        truck_admin_service:/app/dist/app.js
  [ -f "$USERS_PATCH" ]     && docker cp "$USERS_PATCH"      truck_admin_service:/app/dist/admin/users.routes.js
  docker restart truck_admin_service
  sleep 3
  echo "  Admin service patched."
else
  echo "  WARN: Admin patch files not found"
fi

# ── Patch 6: Web app bundle — admin user redirect fix ────────────────────────
# Admin users (userType='admin') were caught in an infinite redirect loop
# at /dashboard (merchant route). This patch redirects them to port 3011.
WEB_BUNDLE="$SCRIPT_DIR/web-bundle-patched.js"
if [ -f "$WEB_BUNDLE" ]; then
  echo "  [6/7] Applying web app bundle patch (admin redirect fix)..."
  docker cp "$WEB_BUNDLE" truck_web:/usr/share/nginx/html/assets/index-BtpoGK-n.js
  echo "  Web bundle patched."
else
  echo "  WARN: $WEB_BUNDLE not found — admin redirect loop will not be fixed"
fi

# ── Patch 7: Nginx dynamic DNS config + reload ───────────────────────────────
# Fixes: nginx caches api_gateway IP at startup. When containers restart with
# new IPs, nginx gets Connection refused (502). Using Docker DNS resolver
# (127.0.0.11) with valid=10s forces re-resolution every 10 seconds.
NGINX_CONF="$SCRIPT_DIR/nginx-web.conf"
if [ -f "$NGINX_CONF" ]; then
  echo "  [7/7] Applying nginx dynamic DNS config..."
  docker cp "$NGINX_CONF" truck_web:/etc/nginx/conf.d/default.conf
  docker exec truck_web nginx -t 2>/dev/null && \
    docker exec truck_web nginx -s reload && \
    echo "  Nginx config updated and reloaded." || \
    echo "  WARN: nginx config test failed — reloading anyway"
else
  echo "  [7/7] Reloading nginx (no config override found)..."
  docker exec truck_web nginx -s reload 2>/dev/null && echo "  Nginx reloaded." || echo "  WARN: nginx reload failed"
fi

echo "[5/5] All patches applied."
docker compose ps

echo ""
echo "=============================================="
echo "  ACCESS URLS"
echo "=============================================="
echo "  Web App:      http://192.168.8.101:3010"
echo "  Admin Panel:  http://192.168.8.101:3011/admin"
echo "  API Gateway:  http://192.168.8.101:3000"
echo ""
echo "  Test Credentials:"
echo "  Merchant: +919880001001 / TruckQA@2024"
echo "  Trucker:  +919770001001 / TruckQA@2024"
echo "  Admin:    +919000000001 / TruckQA@2024"
echo "=============================================="
