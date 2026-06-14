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

# Step 5: Run V2 database migrations
echo -e "${YELLOW}[5/6] Running V2 database migrations...${NC}"

MIGRATIONS=(
  "scripts/migrations/000_usertype_constraint.sql"
  "scripts/migrations/001_kyc_fields.sql"
  "scripts/migrations/002_trucker_kyc.sql"
  "scripts/migrations/003_truck_documents.sql"
  "scripts/migrations/004_logistics_companies.sql"
  "scripts/migrations/005_loader_companies.sql"
  "scripts/migrations/006_loader_workers.sql"
  "scripts/migrations/007_highway_businesses.sql"
  "scripts/migrations/008_highway_ads.sql"
  "scripts/migrations/009_loading_jobs.sql"
  "scripts/migrations/010_toll_crossings.sql"
  "scripts/migrations/011_weighbridge_stops.sql"
  "scripts/migrations/012_state_crossings.sql"
  "scripts/migrations/013_trip_breaks.sql"
)

# Wait for postgres to be ready
echo "  Waiting for postgres to be ready..."
until docker exec truck_postgres pg_isready -U app_user -d truck_platform >/dev/null 2>&1; do
  sleep 2
done

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$ROOT_DIR/$migration" ]; then
    echo "  Applying: $migration"
    docker exec -i truck_postgres psql -U app_user -d truck_platform < "$ROOT_DIR/$migration" >/dev/null 2>&1 && \
      echo -e "  ${GREEN}✅ $migration${NC}" || \
      echo -e "  ${YELLOW}⚠️  $migration (already applied or skipped)${NC}"
  else
    echo -e "  ${YELLOW}⚠️  $migration not found, skipping${NC}"
  fi
done

echo -e "${GREEN}✅ V2 migrations complete${NC}"

# Step 6: Show status
echo -e "${YELLOW}[6/6] Checking service status...${NC}"
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
echo -e "${GREEN}║  🪪 KYC Svc:      http://localhost:3009/health           ║${NC}"
echo -e "${GREEN}║  📈 Grafana:      http://localhost:3020 (admin/admin)    ║${NC}"
echo -e "${GREEN}║  🐰 RabbitMQ:     http://localhost:15672 (guest/guest)   ║${NC}"
echo -e "${GREEN}║  🔍 Prometheus:   http://localhost:9090                  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}💡 Tip: Run './scripts/health-check.sh' to verify all services${NC}"
echo -e "${YELLOW}💡 Tip: Ollama model download may take 5-10 minutes on first run${NC}"
echo ""
