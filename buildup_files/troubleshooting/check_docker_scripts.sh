#!/bin/bash
echo "=== docker-down script ==="
cat ~/truck-platform/docker-down.sh 2>/dev/null || \
cat /home/ubuntu/truck-platform/docker-down.sh 2>/dev/null || \
find /home/ubuntu -name "docker-down*" 2>/dev/null | xargs cat 2>/dev/null

echo ""
echo "=== docker-up script ==="
cat ~/truck-platform/docker-up.sh 2>/dev/null || \
cat /home/ubuntu/truck-platform/docker-up.sh 2>/dev/null || \
find /home/ubuntu -name "docker-up*" 2>/dev/null | xargs cat 2>/dev/null

echo ""
echo "=== any Makefile ==="
cat ~/truck-platform/Makefile 2>/dev/null | head -60 || true

echo ""
echo "=== docker-compose.yml pull policy ==="
grep -n "pull_policy\|image:" ~/truck-platform/docker-compose.yml 2>/dev/null | head -30
