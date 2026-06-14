#!/bin/bash
# AI TRUCK LOGISTICS PLATFORM - Docker Start Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "=============================================="
echo "  AI TRUCK LOGISTICS PLATFORM - Starting Up"
echo "=============================================="

# Check .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "WARN: Created .env from .env.example"
fi

# Remove any stopped truck_ containers that would block compose up
STOPPED=$(docker ps -a --filter "name=truck_" --filter "status=exited" --format "{{.Names}}" 2>/dev/null)
if [ -n "$STOPPED" ]; then
  echo "Removing stopped containers: $STOPPED"
  docker rm $STOPPED
fi

echo "[1/4] Starting databases and infrastructure..."
docker compose up -d postgres mongodb redis zookeeper elasticsearch
echo "Waiting 15s for databases to initialise..."
sleep 15

echo "[2/4] Starting Kafka and RabbitMQ..."
docker compose up -d kafka rabbitmq
sleep 8

echo "[3/4] Starting all application services..."
docker compose up -d

echo "[4/4] Checking status..."
sleep 5
docker compose ps

echo ""
echo "=============================================="
echo "  ACCESS URLS"
echo "=============================================="
echo "  Web App:      http://192.168.8.101:3000"
echo "  Admin Panel:  http://192.168.8.101:3011"
echo "  API Gateway:  http://192.168.8.101:3000"
echo "  Admin Svc:    http://192.168.8.101:3004/health"
echo "  Trucker Svc:  http://192.168.8.101:3002/health"
echo "  Load Svc:     http://192.168.8.101:3001/health"
echo "  Social Svc:   http://192.168.8.101:3005/health"
echo "  Grafana:      http://192.168.8.101:3020"
echo "  RabbitMQ:     http://192.168.8.101:15672"
echo "=============================================="
