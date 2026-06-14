#!/bin/bash
# =============================================================
# DANGER: Wipe all data volumes and restart fresh
# Use this to reset to a clean state during development
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}"
echo "⚠️  WARNING: This will DELETE ALL DATA including databases!"
echo -e "${NC}"
read -p "Are you sure? Type 'yes' to confirm: " confirm

if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo -e "${YELLOW}Stopping all services...${NC}"
docker compose down -v 2>/dev/null || docker-compose down -v

echo -e "${YELLOW}Removing orphan containers...${NC}"
docker compose down --remove-orphans 2>/dev/null || true

echo -e "${YELLOW}Pruning unused Docker resources...${NC}"
docker system prune -f

echo -e "${GREEN}✅ Reset complete. Starting fresh environment...${NC}"
"$SCRIPT_DIR/docker-up.sh"
