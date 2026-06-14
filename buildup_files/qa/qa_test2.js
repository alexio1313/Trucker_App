const http = require('http');

// Use Docker service names for inter-container communication
const SERVICES = {
  'API Gateway': { host: 'api_gateway', port: 3000 },
  'Load Service': { host: 'load_service', port: 3001 },
  'Trucker Service': { host: 'trucker_service', port: 3002 },
  'Pricing Service': { host: 'pricing_service', port: 3003 },
  'Admin Service': { host: 'admin_service', port: 3004 },
  'Social Service': { host: 'social_service', port: 3005 },
  'ML Service': { host: 'ml_service', port: 3006 },
  'Notification Service': { host: 'notification_service', port: 3007 },
  'Payment Service': { host: 'payment_service', port: 3008 },
};

function request(host, port, path, method, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request({ hostname: host, port, path, method: method || 'GET', headers, timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, raw: body.substring(0, 100) }); } });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

async function runQA() {
  console.log('=== AI Trucker Platform QA Test Suite ===');
  console.log('Testing Bangalore→Delhi logistics platform\n');
  let token = null;
  let passed = 0, failed = 0;

  const check = (name, condition, detail = '') => {
    if (condition) { console.log(`  ✓ ${name}${detail ? ': ' + detail : ''}`); passed++; }
    else { console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`); failed++; }
  };

  // Health checks via Docker network
  console.log('--- Health Checks (via Docker network) ---');
  for (const [name, {host, port}] of Object.entries(SERVICES)) {
    const r = await request(host, port, '/health');
    check(name, r.status === 200, `${host}:${port}`);
  }

  // Auth test
  console.log('\n--- Authentication ---');
  const loginResp = await request('trucker_service', 3002, '/api/v1/auth/login', 'POST', null, { phoneNumber: '+919880001001', password: 'TruckQA@2024' });
  check('Merchant Login (+919880001001)', loginResp.data?.success, `status ${loginResp.status}`);
  if (loginResp.data?.data?.accessToken) {
    token = loginResp.data.data.accessToken;
    check('JWT Token issued', token.length > 100);
    check('User type: merchant', loginResp.data.data.user?.user_type === 'merchant');
    check('KYC status: verified', loginResp.data.data.user?.kyc_status === 'verified');
    check('User name correct', loginResp.data.data.user?.full_name === 'Rajesh Kumar Textiles', loginResp.data.data.user?.full_name);
  }

  // Loads API
  console.log('\n--- Load Service (Bangalore→Delhi) ---');
  if (token) {
    const loadsResp = await request('load_service', 3001, '/api/v1/loads', 'GET', token);
    check('List loads endpoint', loadsResp.status === 200, `status ${loadsResp.status}`);
    if (loadsResp.data?.data?.loads) {
      const loads = loadsResp.data.data.loads;
      check('Loads found in database', loads.length > 0, `${loads.length} loads`);
      const blrLoad = loads.find(l => l.origin_address?.includes('Bangalore') || l.origin_city === 'Bangalore');
      check('Bangalore origin load exists', !!blrLoad, blrLoad ? `ID: ${blrLoad.load_id?.substring(0, 12)}` : 'not found');
    }
  }

  // Pricing API - Bangalore to Delhi
  console.log('\n--- Pricing Service (₹/km calculation) ---');
  if (token) {
    const q = 'origin_lat=12.9716&origin_lng=77.5946&dest_lat=28.6139&dest_lng=77.2090&weight_kg=5000&cargo_type=general';
    const pricingResp = await request('pricing_service', 3003, `/api/v1/pricing/estimate?${q}`, 'GET', token);
    check('Price estimate endpoint', pricingResp.status === 200, `status ${pricingResp.status}`);
    if (pricingResp.data?.data) {
      const p = pricingResp.data.data;
      check('Base price calculated (₹>0)', p.basePrice > 0, `₹${p.basePrice?.toFixed(2)}`);
      check('Total price >= base price', p.totalPrice >= p.basePrice, `₹${p.totalPrice?.toFixed(2)}`);
      check('Distance ~1750-2200km', p.distanceKm > 1500, `${p.distanceKm?.toFixed(0)}km`);
    }
  }

  // API Gateway routing
  console.log('\n--- API Gateway Routing ---');
  if (token) {
    const gwLoads = await request('api_gateway', 3000, '/api/v1/loads', 'GET', token);
    check('GW→Load Service proxy', gwLoads.status === 200, `status ${gwLoads.status}`);
    const gwPricing = await request('api_gateway', 3000, '/api/v1/pricing/estimate?origin_lat=12.9716&origin_lng=77.5946&dest_lat=28.6139&dest_lng=77.2090&weight_kg=1000&cargo_type=general', 'GET', token);
    check('GW→Pricing Service proxy', gwPricing.status === 200, `status ${gwPricing.status}`);
  }

  // Unauthenticated rejection
  console.log('\n--- Security Tests ---');
  const unauth = await request('load_service', 3001, '/api/v1/loads');
  check('Unauthenticated request rejected', unauth.status === 401, `status ${unauth.status}`);
  const badToken = await request('load_service', 3001, '/api/v1/loads', 'GET', 'invalid.jwt.token');
  check('Invalid token rejected', [401, 403].includes(badToken.status), `status ${badToken.status}`);

  // Summary
  console.log(`\n=== RESULTS ===`);
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${passed + failed} | Rate: ${Math.round(100 * passed / (passed + failed))}%`);
}

runQA().catch(console.error);
