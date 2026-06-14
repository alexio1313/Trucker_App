#!/bin/bash
for container in truck_pricing_service truck_admin_service truck_notification_service truck_payment_service truck_social_service truck_ml_service; do
  echo "=== $container ==="
  docker exec $container grep "api" /app/dist/app.js 2>/dev/null | grep "app.use" | head -5
done
