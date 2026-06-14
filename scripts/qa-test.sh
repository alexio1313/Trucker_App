#!/bin/bash
# =============================================================
# TruckPlatform QA Test Script
# Tests all API endpoints and service health
# =============================================================
set -e

API="http://localhost:3000/api/v1"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1 — $2"; FAIL=$((FAIL+1)); }
section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

# ─── Health Checks ────────────────────────────────────────────
section "SERVICE HEALTH CHECKS"

for svc in "3000:api-gateway" "3001:load-service" "3002:trucker-service" "3003:pricing-service" "3004:admin-service" "3005:social-service"; do
  port="${svc%%:*}"
  name="${svc##*:}"
  if curl -sf "http://localhost:${port}/health" > /dev/null 2>&1; then
    pass "$name health"
  else
    fail "$name health" "port $port not responding"
  fi
done

# ─── Auth Endpoints ───────────────────────────────────────────
section "AUTHENTICATION"

# Register merchant
REGISTER=$(curl -sf -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"QA Test Merchant","phoneNumber":"+919111111111","password":"Test@1234","userType":"merchant"}' 2>&1)
if echo "$REGISTER" | grep -q '"success":true'; then
  pass "POST /auth/register (merchant)"
else
  fail "POST /auth/register" "$REGISTER"
fi

# Login merchant
LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919880001001","password":"Merchant@123"}' 2>&1)
if echo "$LOGIN" | grep -q '"accessToken"'; then
  pass "POST /auth/login (merchant)"
  MERCHANT_TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
else
  fail "POST /auth/login" "$LOGIN"
fi

# Login trucker
TRUCKER_LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919770001001","password":"Trucker@123"}' 2>&1)
if echo "$TRUCKER_LOGIN" | grep -q '"accessToken"'; then
  pass "POST /auth/login (trucker)"
  TRUCKER_TOKEN=$(echo "$TRUCKER_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
else
  fail "POST /auth/login (trucker)" "$TRUCKER_LOGIN"
fi

# Login admin
ADMIN_LOGIN=$(curl -sf -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"Admin@123"}' 2>&1)
if echo "$ADMIN_LOGIN" | grep -q '"accessToken"'; then
  pass "POST /auth/login (admin)"
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
else
  fail "POST /auth/login (admin)" "$ADMIN_LOGIN"
fi

# GET /auth/me
if [ -n "$MERCHANT_TOKEN" ]; then
  ME=$(curl -sf -H "Authorization: Bearer $MERCHANT_TOKEN" "$API/auth/me" 2>&1)
  if echo "$ME" | grep -q '"userType"'; then
    pass "GET /auth/me"
  else
    fail "GET /auth/me" "$ME"
  fi
fi

# ─── Loads ────────────────────────────────────────────────────
section "LOAD MANAGEMENT (Bangalore → Delhi)"

if [ -n "$MERCHANT_TOKEN" ]; then
  # Get price quote
  QUOTE=$(curl -sf -X POST "$API/pricing/quote" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MERCHANT_TOKEN" \
    -d '{
      "originLat":12.9716,"originLng":77.5946,
      "destLat":28.6139,"destLng":77.2090,
      "truckType":"heavy","weightKg":10000,"cargoType":"general"
    }' 2>&1)
  if echo "$QUOTE" | grep -q '"recommendedPrice"'; then
    pass "POST /pricing/quote (BLR→DEL, 2150km)"
  else
    fail "POST /pricing/quote" "$QUOTE"
  fi

  # Post a load
  LOAD=$(curl -sf -X POST "$API/loads" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MERCHANT_TOKEN" \
    -d '{
      "origin":{"lat":12.9716,"lng":77.5946,"address":"Peenya Industrial Area","city":"Bangalore","state":"Karnataka"},
      "destination":{"lat":28.6139,"lng":77.2090,"address":"Okhla Industrial Estate","city":"Delhi","state":"Delhi"},
      "cargo":{"weightKg":8000,"cargoType":"general","description":"Test cargo"},
      "truckTypeRequired":"heavy",
      "pickupTime":{"earliest":"2026-06-14T08:00:00Z","latest":"2026-06-14T14:00:00Z"},
      "deliveryTime":{"earliest":"2026-06-16T08:00:00Z","latest":"2026-06-17T18:00:00Z"},
      "budgetMin":40000,"budgetMax":55000
    }' 2>&1)
  if echo "$LOAD" | grep -q '"loadId"'; then
    pass "POST /loads (create Bangalore → Delhi load)"
    LOAD_ID=$(echo "$LOAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['loadId'])" 2>/dev/null || echo "")
  else
    fail "POST /loads" "$LOAD"
  fi

  # Get merchant loads
  LOADS=$(curl -sf -H "Authorization: Bearer $MERCHANT_TOKEN" "$API/loads/merchant?page=1&pageSize=5" 2>&1)
  if echo "$LOADS" | grep -q '"items"'; then
    pass "GET /loads/merchant"
  else
    fail "GET /loads/merchant" "$LOADS"
  fi
fi

# ─── Tracking ─────────────────────────────────────────────────
section "LIVE TRACKING (Simulated Bangalore → Delhi)"

if [ -n "$TRUCKER_TOKEN" ]; then
  # Push location update (simulating being in Bangalore)
  LOC=$(curl -sf -X POST "$API/tracking/location" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TRUCKER_TOKEN" \
    -d '{
      "loadId":"e0000000-0000-0000-0000-000000000002",
      "lat":12.9716,"lng":77.5946,
      "speed":0,"heading":0,"accuracy":5
    }' 2>&1)
  if echo "$LOC" | grep -q '"success":true'; then
    pass "POST /tracking/location (Bangalore origin)"
  else
    fail "POST /tracking/location" "$LOC"
  fi

  # Get live tracking
  LIVE=$(curl -sf -H "Authorization: Bearer $MERCHANT_TOKEN" \
    "$API/tracking/live/e0000000-0000-0000-0000-000000000002" 2>&1)
  if echo "$LIVE" | grep -q '"currentLocation"'; then
    pass "GET /tracking/live/:loadId"
  else
    fail "GET /tracking/live/:loadId" "$LIVE"
  fi

  # Get ETA prediction (Bangalore → Delhi)
  ETA=$(curl -sf -H "Authorization: Bearer $MERCHANT_TOKEN" \
    "$API/tracking/eta/e0000000-0000-0000-0000-000000000002" 2>&1)
  if echo "$ETA" | grep -q '"estimatedArrival"'; then
    pass "GET /tracking/eta/:loadId"
  else
    fail "GET /tracking/eta/:loadId" "$ETA"
  fi
fi

# ─── ML / AI ──────────────────────────────────────────────────
section "AI/ML SERVICES"

if [ -n "$TRUCKER_TOKEN" ]; then
  # Route optimize
  ROUTE=$(curl -sf -X POST "$API/ml/route-optimize" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TRUCKER_TOKEN" \
    -d '{"loadId":"e0000000-0000-0000-0000-000000000002"}' 2>&1)
  if echo "$ROUTE" | grep -q '"routes"'; then
    pass "POST /ml/route-optimize"
  else
    fail "POST /ml/route-optimize" "$ROUTE"
  fi

  # Negotiate
  NEG=$(curl -sf -X POST "$API/ml/negotiate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TRUCKER_TOKEN" \
    -d '{"loadId":"e0000000-0000-0000-0000-000000000001","offeredPrice":50000,"estimatedFuelCost":12000}' 2>&1)
  if echo "$NEG" | grep -q '"recommendation"'; then
    pass "POST /ml/negotiate"
  else
    fail "POST /ml/negotiate" "$NEG"
  fi
fi

# ─── Admin ────────────────────────────────────────────────────
section "ADMIN ENDPOINTS"

if [ -n "$ADMIN_TOKEN" ]; then
  ANALYTICS=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/analytics" 2>&1)
  if echo "$ANALYTICS" | grep -q '"activeLoads"'; then
    pass "GET /admin/analytics"
  else
    fail "GET /admin/analytics" "$ANALYTICS"
  fi

  USERS=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/users?page=1&pageSize=10" 2>&1)
  if echo "$USERS" | grep -q '"items"'; then
    pass "GET /admin/users"
  else
    fail "GET /admin/users" "$USERS"
  fi

  KYC=$(curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/kyc?status=pending" 2>&1)
  if echo "$KYC" | grep -q '"items"'; then
    pass "GET /admin/kyc"
  else
    fail "GET /admin/kyc" "$KYC"
  fi
fi

# ─── Frontend ─────────────────────────────────────────────────
section "FRONTEND ACCESSIBILITY"

WEB=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3010 2>&1)
if [ "$WEB" = "200" ]; then
  pass "Web merchant portal (port 3010)"
else
  fail "Web merchant portal" "HTTP $WEB"
fi

ADMIN=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3011 2>&1)
if [ "$ADMIN" = "200" ]; then
  pass "Admin panel (port 3011)"
else
  fail "Admin panel" "HTTP $ADMIN"
fi

# ─── Summary ──────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  QA RESULTS: ${GREEN}${PASS} PASSED${NC} | ${RED}${FAIL} FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAIL -gt 0 ]; then
  echo "  Run: docker compose logs <service> to debug failures"
  exit 1
fi
