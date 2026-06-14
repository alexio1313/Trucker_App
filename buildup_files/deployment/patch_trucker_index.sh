#!/bin/bash
echo "=== index.js content ==="
docker exec truck_trucker_service cat /app/dist/index.js

echo ""
echo "=== app.js tail (to see where routes are registered) ==="
docker exec truck_trucker_service tail -30 /app/dist/app.js

echo ""
echo "=== journey-routes.js first 20 lines (confirm it's our patch) ==="
docker exec truck_trucker_service head -20 /app/dist/journey-routes.js
