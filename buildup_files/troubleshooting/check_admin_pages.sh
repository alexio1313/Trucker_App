#!/bin/bash
echo "=== KYC page ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3011/admin/kyc
echo ""
echo "=== Social page ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3011/admin/social
echo ""
echo "=== Disputes page ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3011/admin/disputes
echo ""
echo "=== Dashboard ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3011/admin
echo ""
echo "=== Backend KYC endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/kyc?status=pending" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success=',d.get('success'), 'count=',len(d.get('data',{}).get('items',[])))"
echo "=== Backend Disputes endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/disputes?status=open" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success=',d.get('success'), 'count=',len(d.get('data',{}).get('items',[])))"
echo "=== Backend Social endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/social-posts" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success=',d.get('success'), 'count=',len(d.get('data',{}).get('posts',[])))"
echo "=== Backend Loads endpoint ==="
curl -s "http://localhost:3004/api/v1/admin/loads?limit=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success=',d.get('success'), 'total=',d.get('data',{}).get('total',0))"
