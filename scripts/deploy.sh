#!/bin/bash
# =============================================================
# TruckPlatform Deploy Script
# Run on the server: bash scripts/deploy.sh
# =============================================================
set -e

COMPOSE_CMD="docker compose"
PROJECT_DIR="/opt/truck-platform"

echo "======================================================"
echo "  TruckPlatform Deploy — $(date)"
echo "======================================================"

# Step 1: Pull latest images for infrastructure
echo ""
echo "[1/6] Pulling infrastructure images..."
$COMPOSE_CMD pull postgres mongodb redis zookeeper kafka rabbitmq elasticsearch ollama prometheus grafana

# Step 2: Build all application services
echo ""
echo "[2/6] Building application services (this takes ~5-10 min first time)..."
$COMPOSE_CMD build --parallel api_gateway load_service trucker_service pricing_service admin_service social_service
$COMPOSE_CMD build --parallel web admin_panel

# Step 3: Start infrastructure first
echo ""
echo "[3/6] Starting infrastructure services..."
$COMPOSE_CMD up -d postgres mongodb redis zookeeper
echo "  Waiting 15s for databases to initialise..."
sleep 15

$COMPOSE_CMD up -d kafka rabbitmq elasticsearch
echo "  Waiting 20s for Kafka/Elasticsearch..."
sleep 20

# Step 4: Start Ollama and pull model (background)
echo ""
echo "[4/6] Starting Ollama (AI model will pull in background)..."
$COMPOSE_CMD up -d ollama
echo "  Ollama will pull mistral:7b in the background. Check: docker logs truck_ollama"

# Step 5: Start backend services
echo ""
echo "[5/6] Starting backend microservices..."
$COMPOSE_CMD up -d api_gateway load_service trucker_service pricing_service admin_service social_service

echo "  Waiting 10s for services to start..."
sleep 10

# Step 6: Start frontend + monitoring
echo ""
echo "[6/6] Starting frontend apps and monitoring..."
$COMPOSE_CMD up -d web admin_panel prometheus grafana

echo ""
echo "======================================================"
echo "  DEPLOY COMPLETE"
echo "======================================================"
echo ""
echo "  Web App (Merchant Portal):  http://192.168.8.101:3010"
echo "  Admin Panel:                http://192.168.8.101:3011"
echo "  API Gateway:                http://192.168.8.101:3000"
echo "  Grafana Monitoring:         http://192.168.8.101:3020"
echo "  RabbitMQ Dashboard:         http://192.168.8.101:15672"
echo ""
echo "  Test credentials:"
echo "    Admin:    +919000000001 / Admin@123"
echo "    Merchant: +919880001001 / Merchant@123"
echo "    Trucker:  +919770001001 / Trucker@123"
echo ""
echo "  Check container status: docker compose ps"
echo "  View logs: docker compose logs -f [service_name]"
echo "======================================================"
