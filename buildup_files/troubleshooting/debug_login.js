// Debug what's happening with the login call from the QA script
const http = require('http');
const GW = 'http://localhost:3000';

function req(method, url, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var bodyStr = body ? JSON.stringify(body) : null;
    var opts = {
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    var r = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        console.log('STATUS:', res.statusCode);
        console.log('RAW:', d.slice(0, 200));
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function run() {
  console.log('=== Trucker login ===');
  var r1 = await req('POST', GW + '/api/v1/auth/login', { phoneNumber: '+919860001001', password: 'Admin@123' });
  console.log('Success:', r1.body && r1.body.success, 'Type:', typeof r1.body);

  if (r1.body && r1.body.success) {
    console.log('Token:', r1.body.data && r1.body.data.accessToken ? 'GOT IT' : 'MISSING');
    console.log('User:', JSON.stringify(r1.body.data && r1.body.data.user || {}).slice(0,100));
  }

  console.log('\n=== Merchant login ===');
  var r2 = await req('POST', GW + '/api/v1/auth/login', { phoneNumber: '+919860002001', password: 'Admin@123' });
  console.log('Status:', r2.status, 'Success:', r2.body && r2.body.success);
}

run().catch(e => console.error('Error:', e.message));
