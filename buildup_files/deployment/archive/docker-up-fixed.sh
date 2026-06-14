#!/bin/bash
# =============================================================
# AI TRUCK LOGISTICS PLATFORM - Docker Start Script
# Starts all 15 services in correct dependency order
# =============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        AI TRUCK LOGISTICS PLATFORM                       ║"
echo "║           Docker Environment Starting...                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/4] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}ERROR: Docker is not installed.${NC}"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${RED}ERROR: Docker Compose is not installed.${NC}"
  exit 1
fi

echo -e "${GREEN}OK: Docker $(docker --version | cut -d' ' -f3) found${NC}"

# Step 2: Check .env
echo -e "${YELLOW}[2/4] Checking environment config...${NC}"

cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}WARN: Created .env from .env.example${NC}"
else
  echo -e "${GREEN}OK: .env file exists${NC}"
fi

# Step 3: Start services using cached images (no pull)
echo -e "${YELLOW}[3/4] Starting services (using cached images)...${NC}"

# Start infrastructure first
echo "  Starting databases and infrastructure..."
docker compose up -d postgres mongodb redis zookeeper elasticsearch 2>/dev/null || \
docker-compose up -d postgres mongodb redis zookeeper elasticsearch

echo "  Waiting for databases (15s)..."
sleep 15

# Start Kafka after Zookeeper is up
echo "  Starting Kafka and RabbitMQ..."
docker compose up -d kafka rabbitmq 2>/dev/null || docker-compose up -d kafka rabbitmq
sleep 8

# Start all remaining services
echo "  Starting application services..."
docker compose up -d 2>/dev/null || docker-compose up -d

# Step 4: Status
echo -e "${YELLOW}[4/4] Checking service status...${NC}"
sleep 5

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   SERVICE STATUS                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

docker compose ps 2>/dev/null || docker-compose ps

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ACCESS URLS                           ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Web App:      http://192.168.8.101:3000                 ║${NC}"
echo -e "${GREEN}║  API Gateway:  http://192.168.8.101:3000                 ║${NC}"
echo -e "${GREEN}║  Admin Panel:  http://192.168.8.101:3011                 ║${NC}"
echo -e "${GREEN}║  Load Svc:     http://192.168.8.101:3001/health          ║${NC}"
echo -e "${GREEN}║  Trucker Svc:  http://192.168.8.101:3002/health          ║${NC}"
echo -e "${GREEN}║  Pricing Svc:  http://192.168.8.101:3003/health          ║${NC}"
echo -e "${GREEN}║  Admin Svc:    http://192.168.8.101:3004/health          ║${NC}"
echo -e "${GREEN}║  Social Svc:   http://192.168.8.101:3005/health          ║${NC}"
echo -e "${GREEN}║  Grafana:      http://192.168.8.101:3020 (admin/admin)   ║${NC}"
echo -e "${GREEN}║  RabbitMQ:     http://192.168.8.101:15672 (guest/guest)  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Tip: Run './scripts/health-check.sh' to verify all services${NC}"
echo ""
