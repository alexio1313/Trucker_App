#!/bin/bash
# =============================================================
# AI TRUCK LOGISTICS PLATFORM - Health Check Script
# Verifies all services are healthy before development begins
# Exit code 0 = all healthy | Exit code 1 = one or more failed
# =============================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
START_TIME=$(date +%s)

check_service() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"
  local start=$(date +%s%3N)

  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  local end=$(date +%s%3N)
  local ms=$((end - start))

  if [ "$response" = "$expected" ] || [ "$response" = "200" ] || [ "$response" = "000" -a "$expected" = "any" ]; then
    printf "${GREEN}  ✅ %-30s ${ms}ms${NC}\n" "$name"
    PASS=$((PASS + 1))
  else
    printf "${RED}  ❌ %-30s (HTTP $response)${NC}\n" "$name"
    FAIL=$((FAIL + 1))
  fi
}

check_tcp() {
  local name="$1"
  local host="$2"
  local port="$3"
  local start=$(date +%s%3N)

  if timeout 5 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
    local end=$(date +%s%3N)
    local ms=$((end - start))
    printf "${GREEN}  ✅ %-30s ${ms}ms${NC}\n" "$name"
    PASS=$((PASS + 1))
  else
    printf "${RED}  ❌ %-30s (connection refused)${NC}\n" "$name"
    FAIL=$((FAIL + 1))
  fi
}

check_docker() {
  local name="$1"
  local container="$2"
  local status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null)

  if [ "$status" = "healthy" ]; then
    printf "${GREEN}  ✅ %-30s healthy${NC}\n" "$name"
    PASS=$((PASS + 1))
  elif [ "$status" = "starting" ]; then
    printf "${YELLOW}  ⏳ %-30s starting...${NC}\n" "$name"
    FAIL=$((FAIL + 1))
  else
    printf "${RED}  ❌ %-30s $status${NC}\n" "$name"
    FAIL=$((FAIL + 1))
  fi
}

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        🏥 TRUCK PLATFORM HEALTH CHECK                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Checking $(date '+%Y-%m-%d %H:%M:%S')..."
echo ""

# ==================== DATABASES ====================
echo -e "${BLUE}📦 Databases${NC}"
check_docker "PostgreSQL"       "truck_postgres"
check_docker "MongoDB"          "truck_mongodb"
check_docker "Redis"            "truck_redis"
echo ""

# ==================== MESSAGE QUEUES ====================
echo -e "${BLUE}📬 Message Queues${NC}"
check_docker "Zookeeper"        "truck_zookeeper"
check_docker "Kafka"            "truck_kafka"
check_docker "RabbitMQ"        "truck_rabbitmq"
check_service "RabbitMQ UI"    "http://localhost:15672"
echo ""

# ==================== SEARCH ====================
echo -e "${BLUE}🔍 Search & Cache${NC}"
check_service "Elasticsearch"  "http://localhost:9200/_cluster/health"
echo ""

# ==================== AI SERVICES ====================
echo -e "${BLUE}🤖 AI Services${NC}"
check_service "Ollama"         "http://localhost:11434/api/tags"
echo ""

# ==================== BACKEND SERVICES ====================
echo -e "${BLUE}⚙️  Backend Services${NC}"
check_service "API Gateway"    "http://localhost:3000/health"
check_service "Load Service"   "http://localhost:3001/health"
check_service "Trucker Service" "http://localhost:3002/health"
check_service "Pricing Service" "http://localhost:3003/health"
check_service "Admin Service"  "http://localhost:3004/health"
check_service "Social Service" "http://localhost:3005/health"
echo ""

# ==================== FRONTEND ====================
echo -e "${BLUE}🌐 Frontend${NC}"
check_service "Web App"        "http://localhost:3010"
echo ""

# ==================== MONITORING ====================
echo -e "${BLUE}📊 Monitoring${NC}"
check_service "Prometheus"     "http://localhost:9090/-/ready"
check_service "Grafana"        "http://localhost:3020/api/health"
echo ""

# ==================== SUMMARY ====================
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 All $TOTAL services healthy! (${ELAPSED}s)${NC}"
  exit 0
else
  echo -e "${RED}⚠️  $PASS/$TOTAL healthy, $FAIL failed (${ELAPSED}s)${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting tips:${NC}"
  echo "  • View logs:   docker compose logs -f <service_name>"
  echo "  • Check status: docker compose ps"
  echo "  • Restart:     docker compose restart <service_name>"
  echo "  • Full reset:  ./scripts/docker-reset.sh"
  exit 1
fi
