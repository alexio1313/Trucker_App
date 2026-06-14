const http = require('http');

function req(host, port, path, method, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request({ hostname: host, port, path, method: method || 'GET', headers, timeout: 8000 }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(b) }); } catch { resolve({ s: res.statusCode, d: b.substring(0, 300) }); } });
    });
    r.on('error', e => resolve({ s: 0, d: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ s: 0, d: 'timeout' }); });
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  const login = await req('trucker_service', 3002, '/api/v1/auth/login', 'POST', null, { phoneNumber: '+919880001001', password: 'TruckQA@2024' });
  const token = login.d && login.d.data ? login.d.data.accessToken : null;
  console.log('LOGIN:', login.s, '| token:', token ? token.substring(0, 30) + '...' : 'NONE');

  const loads = await req('load_service', 3001, '/api/v1/loads', 'GET', token);
  console.log('\nGET /api/v1/loads:', loads.s);
  console.log('Body:', JSON.stringify(loads.d).substring(0, 400));

  const loads2 = await req('load_service', 3001, '/api/loads', 'GET', token);
  console.log('\nGET /api/loads:', loads2.s, JSON.stringify(loads2.d).substring(0, 200));

  const routes = await req('load_service', 3001, '/', 'GET');
  console.log('\nGET / (load):', routes.s, JSON.stringify(routes.d).substring(0, 200));

  const p1 = await req('pricing_service', 3003, '/api/v1/pricing/estimate?origin_lat=12.9716&origin_lng=77.5946&dest_lat=28.6139&dest_lng=77.2090&weight_kg=5000&cargo_type=general', 'GET', token);
  console.log('\nGET /api/v1/pricing/estimate:', p1.s, JSON.stringify(p1.d).substring(0, 300));

  const p2 = await req('pricing_service', 3003, '/api/v1/pricing', 'GET', token);
  console.log('\nGET /api/v1/pricing:', p2.s, JSON.stringify(p2.d).substring(0, 200));

  const p3 = await req('pricing_service', 3003, '/api/pricing/estimate?origin_lat=12.9716&origin_lng=77.5946&dest_lat=28.6139&dest_lng=77.2090&weight_kg=5000&cargo_type=general', 'GET', token);
  console.log('\nGET /api/pricing/estimate:', p3.s, JSON.stringify(p3.d).substring(0, 200));

  const gw1 = await req('api_gateway', 3000, '/api/v1/loads', 'GET', token);
  console.log('\nGW /api/v1/loads:', gw1.s, JSON.stringify(gw1.d).substring(0, 300));

  const gw2 = await req('api_gateway', 3000, '/health', 'GET');
  console.log('\nGW /health:', gw2.s, JSON.stringify(gw2.d).substring(0, 200));
}

main().catch(console.error);
