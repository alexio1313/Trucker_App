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
echo "║        🚚 AI TRUCK LOGISTICS PLATFORM                    ║"
echo "║           Docker Environment Starting...                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/5] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${RED}❌ Docker Compose is not installed.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker $(docker --version | cut -d' ' -f3) found${NC}"

# Step 2: Create .env if missing
echo -e "${YELLOW}[2/5] Checking environment config...${NC}"

cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠️  Created .env from .env.example — update with real values before production!${NC}"
else
  echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Step 3: Pull all base images
echo -e "${YELLOW}[3/5] Pulling Docker images (this may take a few minutes first time)...${NC}"
docker compose pull --quiet 2>/dev/null || docker-compose pull --quiet 2>/dev/null
echo -e "${GREEN}✅ Images ready${NC}"

# Step 4: Start infrastructure services first, then app services
echo -e "${YELLOW}[4/5] Starting services...${NC}"

# Start infrastructure (databases, queues, search)
echo "  Starting databases and infrastructure..."
docker compose up -d postgres mongodb redis zookeeper elasticsearch 2>/dev/null || \
docker-compose up -d postgres mongodb redis zookeeper elasticsearch

echo "  Waiting for databases to be healthy (30s)..."
sleep 15

# Start Kafka after Zookeeper
echo "  Starting Kafka..."
docker compose up -d kafka rabbitmq 2>/dev/null || docker-compose up -d kafka rabbitmq
sleep 10

# Start AI and monitoring
echo "  Starting Ollama and monitoring..."
docker compose up -d ollama prometheus grafana 2>/dev/null || \
docker-compose up -d ollama prometheus grafana

# Start all services
echo "  Starting application services..."
docker compose up -d 2>/dev/null || docker-compose up -d

# Step 5: Show status
echo -e "${YELLOW}[5/5] Checking service status...${NC}"
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
echo -e "${GREEN}║  📱 Web App:      http://localhost:3010                  ║${NC}"
echo -e "${GREEN}║  🔧 API Gateway:  http://localhost:3000                  ║${NC}"
echo -e "${GREEN}║  ⚙️  Load Svc:    http://localhost:3001/health           ║${NC}"
echo -e "${GREEN}║  🚚 Trucker Svc:  http://localhost:3002/health           ║${NC}"
echo -e "${GREEN}║  💰 Pricing Svc:  http://localhost:3003/health           ║${NC}"
echo -e "${GREEN}║  📊 Admin Svc:    http://localhost:3004/health           ║${NC}"
echo -e "${GREEN}║  📣 Social Svc:   http://localhost:3005/health           ║${NC}"
echo -e "${GREEN}║  📈 Grafana:      http://localhost:3020 (admin/admin)    ║${NC}"
echo -e "${GREEN}║  🐰 RabbitMQ:     http://localhost:15672 (guest/guest)   ║${NC}"
echo -e "${GREEN}║  🔍 Prometheus:   http://localhost:9090                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: Run './scripts/health-check.sh' to verify all services${NC}"
echo -e "${YELLOW}💡 Tip: Ollama model download may take 5-10 minutes on first run${NC}"
echo ""
