#!/bin/bash
echo "=============================================="
echo "  FINAL END-TO-END TEST"
echo "=============================================="

PASS=0; FAIL=0
check() {
  local label="$1"; local result="$2"; local expected="$3"
  if echo "$result" | grep -q "$expected"; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label — got: $result"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "[1] Login endpoints..."
M_TOKEN=$(curl -s -X POST http://localhost:3010/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919880001001","password":"TruckQA@2024"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['user']['userType']+'|'+d['data']['accessToken'])")
M_TYPE=$(echo $M_TOKEN | cut -d'|' -f1)
M_JWT=$(echo $M_TOKEN | cut -d'|' -f2)
check "Merchant login (userType=merchant)" "$M_TYPE" "merchant"

T_TOKEN=$(curl -s -X POST http://localhost:3010/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919770001001","password":"TruckQA@2024"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['user']['userType']+'|'+d['data']['accessToken'])")
T_TYPE=$(echo $T_TOKEN | cut -d'|' -f1)
T_JWT=$(echo $T_TOKEN | cut -d'|' -f2)
check "Trucker login (userType=trucker)" "$T_TYPE" "trucker"

A_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")
check "Admin login" "${A_TOKEN:0:10}" "eyJ"

echo ""
echo "[2] Data endpoints..."
LOADS=$(curl -s "http://localhost:3010/api/v1/loads/search?status=posted&limit=3" \
  -H "Authorization: Bearer $M_JWT" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['pagination']['total'])")
check "Loads posted count > 0" "$LOADS" "[^0]"

PROFILE=$(curl -s "http://localhost:3002/api/v1/truckers/profile" \
  -H "x-user-id: c0000000-0000-0000-0000-000000000001" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['fullName'])")
check "Trucker profile" "$PROFILE" "Suresh"

echo ""
echo "[3] Admin endpoints..."
ANALYTICS=$(curl -s "http://localhost:3000/api/v1/admin/analytics" \
  -H "Authorization: Bearer $A_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['activeLoads'])")
check "Admin analytics activeLoads > 0" "$ANALYTICS" "[^0]"

FF=$(curl -s "http://localhost:3000/api/v1/admin/feature-flags" \
  -H "Authorization: Bearer $A_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d['success'] else 'fail')")
check "Admin feature-flags" "$FF" "ok"

AUDIT=$(curl -s "http://localhost:3000/api/v1/admin/audit-logs" \
  -H "Authorization: Bearer $A_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d['success'] else 'fail')")
check "Admin audit-logs" "$AUDIT" "ok"

echo ""
echo "[4] Fleet map endpoint..."
FLEET=$(curl -s "http://localhost:3002/api/v1/truckers/live-positions" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['count'])")
check "Live positions count > 0" "$FLEET" "[^0]"

echo ""
echo "[5] Admin panel..."
ADMIN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3011/admin)
check "Admin panel HTTP 200" "$ADMIN_HTTP" "200"

SIGNOUT=$(curl -s http://localhost:3011/admin | grep -o "Sign Out" | head -1)
check "Sign Out button in admin HTML" "$SIGNOUT" "Sign Out"

echo ""
echo "=============================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "=============================================="
