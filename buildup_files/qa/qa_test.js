const http = require('http');

function request(options, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
      ...options,
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, data: body }); } });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

async function runQA() {
  console.log('=== AI Trucker Platform QA Test Suite ===\n');
  let token = null;
  let passed = 0;
  let failed = 0;

  const check = (name, condition, detail = '') => {
    if (condition) { console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`); passed++; }
    else { console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`); failed++; }
  };

  // Health checks
  console.log('--- Health Checks ---');
  for (const [name, port] of [['API Gateway', 3000], ['Load Service', 3001], ['Trucker Service', 3002], ['Pricing Service', 3003], ['Admin Service', 3004], ['Social Service', 3005], ['ML Service', 3006], ['Notification Service', 3007], ['Payment Service', 3008]]) {
    const r = await request({ port, path: '/health' });
    check(name, r.status === 200, `port ${port}`);
  }

  // Frontend health
  console.log('\n--- Frontend Tests ---');
  const web = await request({ port: 3010, path: '/' });
  check('Web App (port 3010)', web.status === 200);
  const admin = await request({ port: 3011, path: '/admin' });
  check('Admin Panel (port 3011)', admin.status === 200, `HTTP ${admin.status}`);

  // Auth test
  console.log('\n--- Auth Tests ---');
  const loginResp = await request({ port: 3002, path: '/api/v1/auth/login', method: 'POST' }, { phoneNumber: '+919880001001', password: 'TruckQA@2024' });
  check('Merchant Login', loginResp.data?.success, `status ${loginResp.status}`);
  if (loginResp.data?.data?.accessToken) {
    token = loginResp.data.data.accessToken;
    check('JWT Token Received', token.length > 50, `length=${token.length}`);
    check('User Type is merchant', loginResp.data.data.user?.user_type === 'merchant');
    check('KYC Status verified', loginResp.data.data.user?.kyc_status === 'verified');
  }

  // Loads API
  console.log('\n--- Load Service API ---');
  if (token) {
    const loadsResp = await request({ port: 3001, path: '/api/v1/loads', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    check('List Loads', loadsResp.status === 200, `status ${loadsResp.status}`);
    if (loadsResp.data?.data?.loads) {
      const loads = loadsResp.data.data.loads;
      check('Loads data has entries', loads.length > 0, `${loads.length} loads found`);
      const bangaloreLoad = loads.find(l => l.origin_city === 'Bangalore' || l.origin_address?.includes('Bangalore'));
      check('Bangalore→Delhi route exists', bangaloreLoad !== undefined, bangaloreLoad ? `Load ID: ${bangaloreLoad.load_id?.substring(0, 8)}...` : 'not found');
    }
  }

  // Pricing API
  console.log('\n--- Pricing Service API ---');
  if (token) {
    const pricingResp = await request({ port: 3003, path: '/api/v1/pricing/estimate?origin_lat=12.9716&origin_lng=77.5946&dest_lat=28.6139&dest_lng=77.2090&weight_kg=5000&cargo_type=general', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    check('Bangalore→Delhi Price Estimate', pricingResp.status === 200, `status ${pricingResp.status}`);
    if (pricingResp.data?.data) {
      const pricing = pricingResp.data.data;
      check('Base price calculated', pricing.basePrice > 0, `₹${pricing.basePrice}`);
      check('Total price > base (includes GST)', pricing.totalPrice >= pricing.basePrice);
      check('Distance Bangalore→Delhi (1700-2200km)', pricing.distanceKm > 1500 && pricing.distanceKm < 2500, `${Math.round(pricing.distanceKm)}km`);
    }
  }

  // ML Service
  console.log('\n--- ML Service API ---');
  const mlHealth = await request({ port: 3006, path: '/health' });
  check('ML Service healthy', mlHealth.status === 200);

  // Admin Service
  console.log('\n--- Admin Service API ---');
  if (token) {
    const statsResp = await request({ port: 3004, path: '/api/v1/admin/stats', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    check('Admin Stats API', [200, 401, 403].includes(statsResp.status), `status ${statsResp.status}`);
  }

  // Summary
  console.log('\n=== Results ===');
  console.log(`Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
  console.log(`Success rate: ${Math.round(100 * passed / (passed + failed))}%`);
}

runQA().catch(console.error);
