#!/bin/bash
echo "=== Admin panel type ==="
docker exec truck_admin_panel cat /etc/os-release 2>/dev/null | head -3 || true

echo ""
echo "=== Nginx config ==="
docker exec truck_admin_panel find /etc/nginx -name "*.conf" 2>/dev/null | head -5
docker exec truck_admin_panel cat /etc/nginx/nginx.conf 2>/dev/null | head -30 || echo "No nginx.conf"
docker exec truck_admin_panel ls /etc/nginx/ 2>/dev/null || echo "No /etc/nginx/"

echo ""
echo "=== Is this a Node.js server (not nginx)? ==="
docker exec truck_admin_panel ps aux 2>/dev/null | head -10 || true
docker exec truck_admin_panel ls /app 2>/dev/null | head -10 || true

echo ""
echo "=== Web panel nginx (truck_web) ==="
docker exec truck_web find /etc/nginx -name "*.conf" 2>/dev/null | head -3
docker exec truck_web cat /etc/nginx/conf.d/default.conf 2>/dev/null | head -30 || true

echo ""
echo "=== Check what process serves port 3011 ==="
docker port truck_admin_panel 2>/dev/null
