#!/bin/bash
echo "=== KYC ==="
curl -sv "http://localhost:3004/api/v1/admin/kyc?status=pending" 2>&1 | grep -E "(< HTTP|{|error)" | head -10

echo ""
echo "=== Disputes ==="
curl -sv "http://localhost:3004/api/v1/admin/disputes?status=open" 2>&1 | grep -E "(< HTTP|{|error)" | head -10

echo ""
echo "=== Social ==="
curl -sv "http://localhost:3004/api/v1/admin/social-posts" 2>&1 | grep -E "(< HTTP|{|error)" | head -10

echo ""
echo "=== Loads ==="
curl -sv "http://localhost:3004/api/v1/admin/loads?limit=2" 2>&1 | grep -E "(< HTTP|{|error)" | head -10

echo ""
echo "=== Container status ==="
docker ps --format "{{.Names}}: {{.Status}}" | grep truck
