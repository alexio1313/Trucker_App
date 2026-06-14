#!/bin/bash
# Deploy simulation routes to trucker service container
# Run from your local machine: bash deploy_simulation.sh <server-ip> <ssh-user>
# Example: bash deploy_simulation.sh 192.168.8.101 ubuntu

SERVER="${1:-192.168.8.101}"
SSH_USER="${2:-ubuntu}"
CONTAINER="truck_trucker_service"

echo "==> Deploying simulation routes to $SERVER ($CONTAINER)"

# Step 1: Copy the file to /tmp on server, then into container
ENCODED=$(base64 -w 0 simulation_routes_patch.js 2>/dev/null || base64 simulation_routes_patch.js)

ssh "${SSH_USER}@${SERVER}" "
  echo '${ENCODED}' | base64 -d > /tmp/simulation.routes.js
  docker cp /tmp/simulation.routes.js ${CONTAINER}:/app/dist/simulation.routes.js
  echo 'File copied to container'
"

# Step 2: Check if simulation route is already registered in app.js
ssh "${SSH_USER}@${SERVER}" "
  if docker exec ${CONTAINER} grep -q 'simulation.routes' /app/dist/app.js 2>/dev/null; then
    echo 'Simulation route already registered in app.js'
  else
    echo 'Patching app.js to register simulation routes...'
    # Find the 404 handler or end of routes and inject before it
    docker exec ${CONTAINER} sh -c \"
      sed -i 's|app.use(function(_req, res)|app.use(\"/api/v1/simulation\", require(\"./simulation.routes\"));\\\napp.use(function(_req, res)|' /app/dist/app.js
    \"
    # Fallback: try the arrow function form
    docker exec ${CONTAINER} sh -c \"
      if ! grep -q 'simulation.routes' /app/dist/app.js; then
        sed -i 's|app.use((_req, res)|app.use(\"/api/v1/simulation\", require(\"./simulation.routes\"));\\\napp.use((_req, res)|' /app/dist/app.js
      fi
    \"
    echo 'app.js patched'
  fi
"

# Step 3: Restart container
echo "==> Restarting container..."
ssh "${SSH_USER}@${SERVER}" "docker restart ${CONTAINER}"

echo "==> Waiting for service to start..."
sleep 5

# Step 4: Health check
STATUS=$(ssh "${SSH_USER}@${SERVER}" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/health")
echo "==> Health check: HTTP $STATUS"

if [ "$STATUS" = "200" ]; then
  echo "✅ Deployment successful!"
  echo "   Simulation endpoint: http://${SERVER}:3002/api/v1/simulation/status"
  echo ""
  echo "Test with:"
  echo "  curl http://${SERVER}:3002/api/v1/simulation/status"
  echo "  curl -X POST http://${SERVER}:3002/api/v1/simulation/seed-truckers"
  echo "  curl -X POST -H 'Content-Type: application/json' -d '{\"city\":\"bangalore\"}' http://${SERVER}:3002/api/v1/simulation/seed-loads"
else
  echo "❌ Service not responding. Check logs:"
  echo "  ssh ${SSH_USER}@${SERVER} 'docker logs ${CONTAINER} --tail 50'"
fi
