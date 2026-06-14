#!/bin/bash
echo "=== Trucker service entry point ==="
docker exec truck_trucker_service cat /app/package.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('main:', d.get('main')); print('scripts:', d.get('scripts',{}))" 2>/dev/null || \
  docker exec truck_trucker_service cat /app/package.json 2>/dev/null | head -20

echo ""
echo "=== Files in /app/dist/ ==="
docker exec truck_trucker_service ls /app/dist/ 2>/dev/null

echo ""
echo "=== What starts the trucker service ==="
docker inspect truck_trucker_service --format '{{json .Config.Cmd}}' 2>/dev/null
docker inspect truck_trucker_service --format '{{json .Config.Entrypoint}}' 2>/dev/null

echo ""
echo "=== First 10 lines of the main dist file ==="
docker exec truck_trucker_service ls /app/dist/ | head -5
MAIN=$(docker exec truck_trucker_service ls /app/dist/ | grep -E "^(index|app|server|main)" | head -1)
echo "Main file: $MAIN"
docker exec truck_trucker_service head -20 /app/dist/$MAIN 2>/dev/null || true

echo ""
echo "=== Search for app.listen in dist files ==="
docker exec truck_trucker_service grep -rn "app.listen\|server.listen" /app/dist/ 2>/dev/null | head -10
