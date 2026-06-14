#!/bin/bash
echo "=== Testing auth endpoints ==="

# Try different auth patterns
echo "1. /auth/login with phoneNumber+password:"
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919000000001","password":"TruckQA@2024"}' | head -c 400
echo ""

echo "2. /auth/login with phone+password:"
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"+919000000001","password":"TruckQA@2024"}' | head -c 400
echo ""

echo "3. Check what services handle /auth:"
curl -s http://localhost:3000/api/v1/auth 2>&1 | head -c 200
echo ""

echo "4. Check all service health:"
for port in 3000 3001 3002 3003 3006 3007 3008; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:$port/health)
  echo "  Port $port: $STATUS"
done

echo "5. Check docker ps:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -20
