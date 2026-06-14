#!/bin/bash
cd /home/ubuntu/truck-platform

echo "=== Services defined in docker-compose.yml ==="
docker compose config --services 2>/dev/null

echo ""
echo "=== Currently running containers ==="
docker ps --format "{{.Names}}: {{.Status}}" | grep -i truck | sort

echo ""
echo "=== Is social_service in compose? ==="
grep -n "social" docker-compose.yml | head -10
