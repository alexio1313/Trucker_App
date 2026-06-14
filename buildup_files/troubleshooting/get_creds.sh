#!/bin/bash
echo "=== PostgreSQL env in container ==="
docker exec truck_postgres env | grep -E "POSTGRES|USER|PASS|DB" | sort

echo ""
echo "=== MongoDB env in container ==="
docker exec truck_mongodb env | grep -E "MONGO|USER|PASS|DB" | sort

echo ""
echo "=== Trucker service DB env ==="
docker exec truck_trucker_service env | grep -E "PG|POSTGRES|DATABASE|DB_|MONGO" | sort
