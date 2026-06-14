#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["data"]["accessToken"])')

echo "Admin login: ${TOKEN:0:20}..."

echo "=== ANALYTICS ==="
curl -s "http://localhost:3000/api/v1/admin/analytics" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20

echo ""
echo "=== DB: user counts ==="
docker exec truck_postgres psql -U truck_user -d truck_platform -t -c \
  "SELECT user_type, count(*) FROM users GROUP BY user_type;"

echo "=== DB: load counts by status ==="
docker exec truck_postgres psql -U truck_user -d truck_platform -t -c \
  "SELECT status, count(*) FROM loads GROUP BY status;"

echo "=== DB: trucker GPS positions ==="
docker exec truck_postgres psql -U truck_user -d truck_platform -t -c \
  "SELECT full_name, availability_status FROM users WHERE user_type='trucker' LIMIT 10;"
