#!/bin/bash
TRUCKER_ID="c0000000-0000-0000-0000-000000000001"

echo "=== Trucker service logs (journey registration) ==="
docker logs truck_trucker_service --tail=15 2>&1 | grep -E "(journey|error|Error|listen)" | head -10

echo ""
echo "=== Test active-load endpoint ==="
curl -s "http://localhost:3002/api/v1/truckers/my/active-load" \
  -H "x-user-id: $TRUCKER_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('success:', d.get('success'))
load = d.get('data', {}).get('load')
if load:
    print('load_id:', load.get('load_id'))
    print('status:', load.get('status'))
    print('route:', load.get('origin_city'), '->', load.get('dest_city'))
else:
    print('no active load')
    print('raw:', json.dumps(d)[:300])
" 2>&1

echo ""
echo "=== Test via gateway (as trucker user) ==="
# First login to get token
TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919860001001","password":"Admin@123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

echo "Token obtained: $([ -n '$TOKEN' ] && echo YES || echo NO)"

if [ -n "$TOKEN" ]; then
  curl -s "http://localhost:3000/api/v1/truckers/my/active-load" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('success:', d.get('success'))
load = d.get('data', {}).get('load')
if load:
    print('load_id:', load.get('load_id'))
    print('status:', load.get('status'))
    print('route:', load.get('origin_city'), '->', load.get('dest_city'))
else:
    print('no active load or error:', json.dumps(d)[:200])
" 2>&1
fi
