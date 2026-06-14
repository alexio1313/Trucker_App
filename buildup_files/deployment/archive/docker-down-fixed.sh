#!/bin/bash
# Stop all Truck Platform services (keeps data volumes and images)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "Stopping all Truck Platform services..."

# Primary stop via compose
docker compose down || docker-compose down

# Fallback: catch any truck_* containers compose missed
REMAINING=$(docker ps --filter "name=truck_" --format "{{.Names}}" 2>/dev/null)
if [ -n "$REMAINING" ]; then
  echo "Stopping remaining containers: $REMAINING"
  docker stop $REMAINING
fi

# Confirm nothing left
STILL_RUNNING=$(docker ps --filter "name=truck_" --format "{{.Names}}" 2>/dev/null)
if [ -n "$STILL_RUNNING" ]; then
  echo "WARNING: These containers are still running: $STILL_RUNNING"
else
  echo "All services stopped. Data volumes preserved."
fi

echo "Run './scripts/docker-up.sh' to restart"
