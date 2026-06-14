#!/bin/bash
# Stop all services (keeps data volumes)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "🛑 Stopping all Truck Platform services..."
docker compose down 2>/dev/null || docker-compose down
echo "✅ All services stopped. Data volumes preserved."
echo "💡 Run './scripts/docker-up.sh' to restart"
