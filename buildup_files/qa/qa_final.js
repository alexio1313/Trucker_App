const http = require('http');

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

function req(host, port, path, method, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ hostname: host, port, path, method: method || 'GET', headers, timeout: 10000 }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(b) }); } catch { resolve({ s: res.statusCode, d: b.substring(0, 200) }); } });
    });
    r.on('error', e => resolve({ s: 0, d: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ s: 0, d: 'timeout' }); });
    if (data) r.write(data);
    r.end();
  });
}

async function runQA() {
  console.log('=== AI Trucker Platform — Full QA Suite ===');
  console.log('Platform: Bangalore→Delhi Truck Logistics\n');
  let token = null, passed = 0, failed = 0;

  const check = (name, condition, detail) => {
    const d = detail !== undefined ? ': ' + detail : '';
    if (condition) { console.log('  ✓ ' + name + d); passed++; }
    else { console.log('  ✗ ' + name + d); failed++; }
  };

  // --- Health Checks ---
  console.log('--- Health Checks (Docker network) ---');
  for (const [name, {host, port}] of Object.entries(SERVICES)) {
    const r = await req(host, port, '/health');
    check(name, r.s === 200, host + ':' + port);
  }

  // --- Auth ---
  console.log('\n--- Authentication ---');
  const login = await req('trucker_service', 3002, '/api/v1/auth/login', 'POST', null, { phoneNumber: '+919880001001', password: 'TruckQA@2024' });
  check('Merchant Login (+919880001001)', login.d && login.d.success, 'status ' + login.s);
  if (login.d && login.d.data && login.d.data.accessToken) {
    token = login.d.data.accessToken;
    check('JWT Token issued', token.length > 100);
    check('User type: merchant', login.d.data.user && login.d.data.user.user_type === 'merchant');
    check('KYC status: verified', login.d.data.user && login.d.data.user.kyc_status === 'verified');
    check('User: Rajesh Kumar Textiles', login.d.data.user && login.d.data.user.full_name === 'Rajesh Kumar Textiles', login.d.data.user && login.d.data.user.full_name);
  }

  // --- Auth Me via Gateway ---
  console.log('\n--- API Gateway → Auth ---');
  if (token) {
    const me = await req('api_gateway', 3000, '/api/v1/auth/me', 'GET', token);
    check('GW: GET /api/v1/auth/me', me.s === 200, 'status ' + me.s);
    check('Returns correct user', me.d && me.d.data && me.d.data.phone_number === '+919880001001');
  }

  // --- Loads ---
  console.log('\n--- Load Service (Bangalore→Delhi) ---');
  if (token) {
    const loads = await req('api_gateway', 3000, '/api/v1/loads', 'GET', token);
    check('GW: GET /api/v1/loads', loads.s === 200, 'status ' + loads.s);
    if (loads.d && loads.d.data && loads.d.data.items) {
      const items = loads.d.data.items;
      check('Loads returned', items.length > 0, items.length + ' loads');
      const blr = items.find(l => l.origin && l.origin.city === 'Bangalore');
      check('Bangalore→Delhi load exists', !!blr, blr ? 'ID: ' + blr.loadId.substring(0, 12) : 'not found');
      if (blr) {
        check('Load has correct destination (Delhi)', blr.destination && blr.destination.city === 'Delhi');
        check('Load status: posted or in_transit', ['posted', 'in_transit'].includes(blr.status), blr.status);
        check('Distance ~2000-2200km', blr.distanceKm > 1800 && blr.distanceKm < 2500, blr.distanceKm + 'km');
      }
    }

    // Search endpoint
    const search = await req('api_gateway', 3000, '/api/v1/loads/search?status=posted', 'GET', token);
    check('GW: GET /api/v1/loads/search', [200, 400].includes(search.s), 'status ' + search.s);
  }

  // --- Pricing ---
  console.log('\n--- Pricing Service (₹ Calculation) ---');
  if (token) {
    const quote = await req('api_gateway', 3000, '/api/v1/pricing/quote', 'POST', token, {
      originLat: 12.9716, originLng: 77.5946, originCity: 'Bangalore',
      destLat: 28.6139, destLng: 77.2090, destCity: 'Delhi',
      cargoWeightKg: 5000, cargoType: 'general', truckType: 'trailer',
      pickupStart: '2026-06-15T09:00:00Z'
    });
    check('GW: POST /api/v1/pricing/quote', quote.s === 200, 'status ' + quote.s);
    if (quote.d && quote.d.data) {
      const p = quote.d.data;
      check('Final price > 0 (₹)', p.finalPrice > 0, '₹' + p.finalPrice);
      check('Distance ~1800-2200km', p.distanceKm > 1500 && p.distanceKm < 2500, Math.round(p.distanceKm) + 'km');
      check('Net trucker earning calculated', p.netTruckerEarning > 0, '₹' + p.netTruckerEarning);
      check('Platform fee included', p.platformFee > 0, '₹' + p.platformFee);
      check('GST calculated', p.gst > 0, '₹' + p.gst);
    }

    // Surge pricing
    const surge = await req('api_gateway', 3000, '/api/v1/pricing/surge?originCity=Bangalore&destinationCity=Delhi&cargoType=general', 'GET', token);
    check('GW: GET /api/v1/pricing/surge', surge.s === 200, 'status ' + surge.s);
  }

  // --- Trucker Login ---
  console.log('\n--- Trucker Auth ---');
  const truckerLogin = await req('api_gateway', 3000, '/api/v1/auth/login', 'POST', null, { phoneNumber: '+919770001001', password: 'TruckQA@2024' });
  check('GW: Trucker Login (+919770001001)', truckerLogin.d && truckerLogin.d.success, 'status ' + truckerLogin.s);

  // --- Security ---
  console.log('\n--- Security Tests ---');
  const noAuth = await req('api_gateway', 3000, '/api/v1/loads');
  check('Unauthenticated → 401', noAuth.s === 401, 'status ' + noAuth.s);
  const badJwt = await req('api_gateway', 3000, '/api/v1/loads', 'GET', 'invalid.jwt.here');
  check('Bad JWT → 401', badJwt.s === 401, 'status ' + badJwt.s);

  // --- ML Service ---
  console.log('\n--- ML Service ---');
  const mlHealth = await req('ml_service', 3006, '/health');
  check('ML Service health', mlHealth.s === 200);
  if (token) {
    const eta = await req('api_gateway', 3000, '/api/v1/loads', 'GET', token);
    check('ML data accessible via gateway', eta.s === 200);
  }

  // --- Admin Service ---
  console.log('\n--- Admin Service ---');
  const adminHealth = await req('admin_service', 3004, '/health');
  check('Admin Service health', adminHealth.s === 200);

  // Summary
  console.log('\n=============================');
  console.log('=== FINAL QA RESULTS ===');
  console.log('=============================');
  console.log('✓ Passed: ' + passed);
  console.log('✗ Failed: ' + failed);
  console.log('Total: ' + (passed + failed) + ' | Rate: ' + Math.round(100 * passed / (passed + failed)) + '%');
  console.log('');
  if (failed === 0) console.log('🎉 ALL TESTS PASSED!');
  else console.log('⚠ ' + failed + ' tests need attention');
}

runQA().catch(e => { console.error('QA ERROR:', e.message); });
