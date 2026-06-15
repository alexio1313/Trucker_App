#!/bin/bash
# Deploy updated truckers_extra.routes.js to server
# Fixes: truck now follows OSRM road polyline (not straight line)
# Run from project root: bash buildup_files/deployment/deploy_route_fix.sh [server-ip] [ssh-user]

SERVER="${1:-192.168.8.101}"
SSH_USER="${2:-ubuntu}"
CONTAINER="truck_trucker_service"
LOCAL_FILE="buildup_files/hotfix/truckers_extra.routes.js"

echo "==> Deploying updated truckers_extra.routes.js"
echo "    Server: $SERVER | Container: $CONTAINER"

# Base64-encode and transfer
ENCODED=$(base64 -w 0 "$LOCAL_FILE" 2>/dev/null || base64 "$LOCAL_FILE")

ssh "${SSH_USER}@${SERVER}" "
  echo '${ENCODED}' | base64 -d > /tmp/truckers_extra.routes.js
  docker cp /tmp/truckers_extra.routes.js ${CONTAINER}:/app/truckers_extra.routes.js
  echo 'File copied to container'
  docker exec ${CONTAINER} node -e \"require('./truckers_extra.routes.js'); console.log('Routes syntax OK')\"
"

# Restart to pick up changes
echo "==> Restarting trucker service..."
ssh "${SSH_USER}@${SERVER}" "docker restart ${CONTAINER}"
sleep 4

STATUS=$(ssh "${SSH_USER}@${SERVER}" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/health" 2>/dev/null)
echo "==> Health check: HTTP ${STATUS:-???}"

if [ "${STATUS}" = "200" ]; then
  echo "✅ Route fix deployed successfully"
  echo "   Truck simulation now follows the OSRM road route, not a straight line"
else
  echo "⚠️  Service may not be ready yet. Check: ssh ${SSH_USER}@${SERVER} 'docker logs ${CONTAINER} --tail 30'"
fi
