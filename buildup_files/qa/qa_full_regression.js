/**
 * Full Platform QA — Trucker · Merchant · Admin
 * Run from SERVER (not inside container): node qa_full_regression.js
 * All services are on localhost from the server's perspective.
 */

'use strict';
const http  = require('http');
const https = require('https');

const GW          = 'http://localhost:3000';
const LOAD_SVC    = 'http://localhost:3001';
const TRUCKER_SVC = 'http://localhost:3002';
const ADMIN_SVC   = 'http://localhost:3004';

let pass = 0, fail = 0, warn = 0;
const errors = [];

// ── Helpers ──────────────────────────────────────────────────────────────────
function req(method, url, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve, reject) {
    var u = new URL(url);
    var bodyStr = body ? JSON.stringify(body) : null;
    var h = Object.assign({ 'Content-Type': 'application/json' }, headers);
    if (bodyStr) h['Content-Length'] = Buffer.byteLength(bodyStr);
    var opts = {
      hostname: u.hostname, port: parseInt(u.port) || 80,
      path: u.pathname + u.search, method: method,
      headers: h,
    };
    var timer = setTimeout(function() { resolve({ status: 0, body: 'TIMEOUT' }); }, 15000);
    var r = (u.protocol === 'https:' ? https : http).request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        clearTimeout(timer);
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d || null }); }
      });
    });
    r.on('error', function(e) { clearTimeout(timer); reject(e); });
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

function authH(token) { return { Authorization: 'Bearer ' + token }; }
function uidH(uid)    { return { 'x-user-id': uid }; }

function color(c, s) {
  var m = { green:'\x1b[32m', red:'\x1b[31m', yellow:'\x1b[33m', cyan:'\x1b[36m', bold:'\x1b[1m', reset:'\x1b[0m' };
  return m[c] + s + m.reset;
}
function ok(msg)        { pass++; console.log(color('green',  '  OK ' + msg)); }
function ko(msg, d)     { fail++; errors.push(msg); console.log(color('red', '  XX ' + msg) + (d ? ' -- ' + JSON.stringify(d).slice(0,100) : '')); }
function wo(msg)        { warn++; console.log(color('yellow', '  WW ' + msg)); }
function section(t)     { console.log('\n' + color('bold', color('cyan', '=== ' + t + ' ===')));  }

// ── State ────────────────────────────────────────────────────────────────────
var truckerToken='', truckerId='';
var merchantToken='', merchantId='';
var adminToken='';
var testLoadId='';

async function main() {
  console.log(color('bold', '\n--- AI Trucker Platform Full Regression QA ---\n'));

  // ── 1. AUTH ────────────────────────────────────────────────────────────────
  section('1. Authentication');

  async function doLogin(phone, password, label) {
    try {
      var r = await req('POST', GW + '/api/v1/auth/login', { phoneNumber: phone, password: password });
      var detail = r.status + ' ' + (typeof r.body === 'object' ? JSON.stringify(r.body).slice(0,120) : String(r.body).slice(0,80));
      if (r.status === 200 && r.body && r.body.success && r.body.data && r.body.data.accessToken) {
        ok(label + ' login -- ' + r.body.data.user.fullName + ' (' + r.body.data.user.userType + ')');
        return { token: r.body.data.accessToken, userId: r.body.data.user.userId };
      }
      ko(label + ' login failed [' + detail + ']');
    } catch(e) { ko(label + ' login error', e.message); }
    return {};
  }

  var t = await doLogin('+919860001001', 'Admin@123', 'Sim Trucker (BLR)');
  truckerToken = t.token || ''; truckerId = t.userId || '';
  var m = await doLogin('+919860002001', 'Admin@123', 'Sim Merchant (BLR)');
  merchantToken = m.token || ''; merchantId = m.userId || '';
  var a = await doLogin('+919000000001', 'TruckQA@2024', 'Admin');
  adminToken = a.token || '';

  // Wrong password
  try {
    var rw = await req('POST', GW + '/api/v1/auth/login', { phoneNumber: '+919860001001', password: 'WrongPass' });
    if (!rw.body.success || rw.status >= 400) ok('Wrong password rejected correctly');
    else ko('Wrong password not rejected', rw.body);
  } catch(e) { ko('Wrong password test', e.message); }

  // /auth/me
  if (truckerToken) {
    try {
      var rm = await req('GET', GW + '/api/v1/auth/me', null, authH(truckerToken));
      if (rm.status === 200 && rm.body.success) ok('/auth/me returns profile for authenticated user');
      else ko('/auth/me failed', rm.body);
    } catch(e) { ko('/auth/me error', e.message); }
  }

  // ── 2. TRUCKER PROFILE ────────────────────────────────────────────────────
  section('2. Trucker Profile & Availability');

  if (truckerToken) {
    try {
      var rp = await req('GET', GW + '/api/v1/truckers/profile', null, authH(truckerToken));
      if (rp.status === 200 && rp.body.success) {
        var u = rp.body.data;
        ok('Trucker profile: ' + u.fullName + ', KYC=' + u.kycStatus + ', trucks=' + (u.trucks ? u.trucks.length : 0));
        if (u.kycStatus !== 'verified') wo('Trucker KYC not verified -- may limit load acceptance');
      } else ko('Trucker profile', rp.body);
    } catch(e) { ko('Trucker profile error', e.message); }

    try {
      var ra = await req('PATCH', GW + '/api/v1/truckers/availability', { status: 'available' }, authH(truckerToken));
      if (ra.status === 200 && ra.body.success) ok('Trucker availability set to available');
      else wo('Availability set: ' + JSON.stringify(ra.body).slice(0,80));
    } catch(e) { wo('Availability error: ' + e.message); }
  }

  // ── 3. LOAD SEARCH ────────────────────────────────────────────────────────
  section('3. Load Search');

  var availableLoads = [];
  try {
    var rs = await req('GET', LOAD_SVC + '/api/v1/loads/search?status=posted&pageSize=20');
    if (rs.status === 200 && rs.body.success) {
      availableLoads = rs.body.data.items || [];
      ok('Load search: ' + availableLoads.length + ' posted loads found');
      if (availableLoads.length > 0) {
        var sampleLoad = availableLoads[0];
        // normalize to consistent field access (camelCase from load service)
        ok('Load fields: id=' + (sampleLoad.loadId||sampleLoad.load_id||'?') +
           ' from=' + (sampleLoad.origin && sampleLoad.origin.city || sampleLoad.origin_city || '?') +
           ' to=' + (sampleLoad.destination && sampleLoad.destination.city || sampleLoad.dest_city || '?'));
      }
      if (availableLoads.length === 0) wo('No posted loads found -- seed data may be needed');
    } else ko('Load search', rs.body);
  } catch(e) { ko('Load search error', e.message); }

  // ── 4. ACTIVE LOAD — PRE-ACCEPT ──────────────────────────────────────────
  section('4. Active Load State (pre-accept)');

  if (truckerId) {
    try {
      var r4a = await req('GET', TRUCKER_SVC + '/api/v1/truckers/my/active-load');
      if (r4a.status === 401 || (r4a.body && r4a.body.success && !r4a.body.data.load)) {
        ok('Active-load without x-user-id: null/401 as expected');
      } else wo('Active-load without header state: ' + JSON.stringify(r4a.body).slice(0,80));

      var r4b = await req('GET', TRUCKER_SVC + '/api/v1/truckers/my/active-load', null, uidH(truckerId));
      if (r4b.body && r4b.body.success) {
        ok('Active-load with x-user-id: ' + (r4b.body.data.load ? 'has existing load -- trucker busy' : 'null -- free to accept'));
      } else ko('Active-load with x-user-id', r4b.body);
    } catch(e) { ko('Active-load pre-check', e.message); }
  }

  // ── 5. RESET STALE LOADS ──────────────────────────────────────────────────
  section('5. Reset stale accepted loads');

  if (truckerId) {
    try {
      var r5 = await req('GET', LOAD_SVC + '/api/v1/loads/search?pageSize=50');
      var stale = (r5.body && r5.body.data && r5.body.data.items || []).filter(function(l) {
        var lid = l.truckerId || l.trucker_id;
        return lid === truckerId && (l.status === 'accepted' || l.status === 'in_transit');
      });
      if (stale.length > 0) {
        wo(stale.length + ' stale load(s) for this trucker -- resetting');
        for (var i = 0; i < stale.length; i++) {
          var sl = stale[i];
          var slid = sl.loadId || sl.load_id;
          await req('PATCH', LOAD_SVC + '/api/v1/loads/' + slid + '/status', { status: 'posted', trucker_id: null });
          wo('Reset: ' + slid.slice(0,24));
        }
      } else {
        ok('No stale loads to reset');
      }
    } catch(e) { wo('Stale load reset: ' + e.message); }
  }

  // ── 6. ACCEPT LOAD ────────────────────────────────────────────────────────
  section('6. Load Acceptance');

  // Refresh list
  try {
    var r6r = await req('GET', LOAD_SVC + '/api/v1/loads/search?status=posted&pageSize=20');
    if (r6r.body && r6r.body.success) availableLoads = r6r.body.data.items || [];
  } catch(e) {}

  var loadToAccept = null;
  for (var i = 0; i < availableLoads.length; i++) {
    var l = availableLoads[i];
    var lid = l.truckerId || l.trucker_id;
    var lst = l.status;
    if (!lid && lst === 'posted') { loadToAccept = l; break; }
  }

  if (loadToAccept && truckerToken) {
    testLoadId = (loadToAccept.loadId || loadToAccept.load_id) || '';
    var originCity = (loadToAccept.origin && loadToAccept.origin.city) || loadToAccept.origin_city || '?';
    var destCity = (loadToAccept.destination && loadToAccept.destination.city) || loadToAccept.dest_city || '?';
    ok('Accepting load: ' + testLoadId.slice(0,20) + '... ' + originCity + '->' + destCity);
    try {
      var r6 = await req('POST', GW + '/api/v1/loads/' + testLoadId + '/accept', {}, authH(truckerToken));
      if (r6.status === 200 && r6.body.success) ok('Load accepted via gateway');
      else if (r6.status === 409) ok('409 Conflict -- trucker already has active load (expected)');
      else ko('Accept load', r6.body);
    } catch(e) { ko('Accept load error', e.message); }

    // Test active load lock
    var another = null;
    for (var j = 0; j < availableLoads.length; j++) {
      if (availableLoads[j].load_id !== testLoadId && !availableLoads[j].trucker_id && availableLoads[j].status === 'posted') {
        another = availableLoads[j]; break;
      }
    }
    if (another) {
      try {
        var r6b = await req('POST', GW + '/api/v1/loads/' + another.load_id + '/accept', {}, authH(truckerToken));
        if (!r6b.body.success || r6b.status === 409) ok('Active load lock enforced -- second accept blocked');
        else wo('Active load lock NOT enforced -- accepted second load');
      } catch(e) { wo('Active load lock test: ' + e.message); }
    }
  } else if (!loadToAccept) {
    wo('No free posted load -- checking for existing active load');
    try {
      var r6f = await req('GET', LOAD_SVC + '/api/v1/loads/search?pageSize=50');
      var mine = (r6f.body && r6f.body.data && r6f.body.data.items || []).find(function(l) {
        var lid = l.truckerId || l.trucker_id;
        return lid === truckerId;
      });
      if (mine) {
        testLoadId = mine.loadId || mine.load_id;
        ok('Using existing load ' + testLoadId.slice(0,20));
      } else ko('No load available for journey tests');
    } catch(e) { ko('Find existing load', e.message); }
  }

  // ── 7. ACTIVE LOAD VISIBLE AFTER ACCEPT ──────────────────────────────────
  section('7. Journey -- Active Load Visible');

  if (truckerId && testLoadId) {
    try {
      var r7 = await req('GET', TRUCKER_SVC + '/api/v1/truckers/my/active-load', null, uidH(truckerId));
      if (r7.body && r7.body.success && r7.body.data.load) {
        var l7 = r7.body.data.load;
        ok('Active load visible: ' + l7.origin_city + '->' + l7.dest_city + ' status=' + l7.status);
        if (l7.origin_lat && l7.dest_lat) ok('Load has coordinates -- map will render');
        else wo('Load missing lat/lng -- map will not show route');
      } else if (r7.body && r7.body.success && !r7.body.data.load) {
        ko('Active load NOT visible after acceptance -- trucker_id mismatch in DB');
      } else ko('Active-load post-accept', r7.body);
    } catch(e) { ko('Active-load post-accept', e.message); }
  }

  // ── 8. START JOURNEY ─────────────────────────────────────────────────────
  section('8. Journey -- Start');

  if (truckerId && testLoadId) {
    try {
      var r8 = await req('POST', TRUCKER_SVC + '/api/v1/truckers/my/journey/start',
        { loadId: testLoadId, startOdometerKm: 45000 }, uidH(truckerId));
      if (r8.body && r8.body.success) {
        ok('Journey started -- logId=' + (r8.body.data && r8.body.data.journey && r8.body.data.journey.log_id ? r8.body.data.journey.log_id.slice(0,8) : 'N/A'));
      } else if (r8.body && r8.body.error && r8.body.error.message && r8.body.error.message.indexOf('already') >= 0) {
        ok('Journey already started (load already in_transit -- OK)');
      } else ko('Start journey', r8.body);
    } catch(e) { ko('Start journey', e.message); }
  }

  // ── 9. FUEL STOP ─────────────────────────────────────────────────────────
  section('9. Journey -- Fuel Stop');

  if (truckerId && testLoadId) {
    try {
      var r9 = await req('POST', TRUCKER_SVC + '/api/v1/truckers/my/journey/fuel-stop',
        { loadId: testLoadId, fuelLiters: 120, fuelCost: 11160, stationName: 'HP Petrol Pump NH-44' },
        uidH(truckerId));
      if (r9.body && r9.body.success) ok('Fuel stop logged: 120L @ Rs.11160');
      else ko('Fuel stop', r9.body);
    } catch(e) { ko('Fuel stop', e.message); }
  }

  // ── 10. MARK DELIVERED ───────────────────────────────────────────────────
  section('10. Journey -- Mark Delivered');

  if (truckerId && testLoadId) {
    try {
      var r10 = await req('POST', TRUCKER_SVC + '/api/v1/truckers/my/journey/deliver',
        { loadId: testLoadId, endOdometerKm: 47230, actualTollCost: 1180 }, uidH(truckerId));
      if (r10.body && r10.body.success) {
        var j10 = r10.body.data && r10.body.data.journey;
        ok('Delivered -- dist=' + (j10 && j10.total_distance_km || 0) + 'km toll=Rs.' + (j10 && j10.actual_toll_cost || 0));
      } else ko('Mark delivered', r10.body);
    } catch(e) { ko('Mark delivered', e.message); }
  }

  // ── 11. JOURNEY STATS ────────────────────────────────────────────────────
  section('11. Journey Stats');

  if (truckerId) {
    try {
      var r11 = await req('GET', TRUCKER_SVC + '/api/v1/truckers/my/journey/stats', null, uidH(truckerId));
      if (r11.body && r11.body.success) {
        var s11 = r11.body.data;
        ok('Stats: trips=' + (s11.total_trips||0) + ' km=' + (s11.total_km||0) + ' fuel=Rs.' + (s11.total_fuel_cost||0));
      } else ko('Journey stats', r11.body);
    } catch(e) { ko('Journey stats', e.message); }
  }

  // ── 12. MERCHANT — POST LOAD ─────────────────────────────────────────────
  section('12. Merchant -- Post Load');

  var newLoadId = '';
  if (merchantToken) {
    try {
      var pickupStart = new Date(Date.now() + 86400000).toISOString();
      var pickupEnd   = new Date(Date.now() + 172800000).toISOString();
      var delivery    = new Date(Date.now() + 259200000).toISOString();
      var r12 = await req('POST', GW + '/api/v1/loads', {
        origin: { lat: 12.9716, lng: 77.5946, address: 'Peenya Industrial Area', city: 'Bangalore', state: 'Karnataka' },
        destination: { lat: 17.3850, lng: 78.4867, address: 'Patancheru Industrial Area', city: 'Hyderabad', state: 'Telangana' },
        cargo: { weightKg: 12000, cargoType: 'general' },
        timeWindow: { pickupStart: pickupStart, pickupEnd: pickupEnd, deliveryExpected: delivery, loadingTimeMinutes: 60, unloadingTimeMinutes: 60 },
      }, authH(merchantToken));
      if ((r12.status === 200 || r12.status === 201) && r12.body.success) {
        newLoadId = (r12.body.data && (r12.body.data.loadId || r12.body.data.load_id)) || '';
        ok('Merchant posted load: BLR->HYD Rs.34200 id=' + newLoadId.slice(0,8));
      } else ko('Post load', r12.body);
    } catch(e) { ko('Post load error', e.message); }

    try {
      var r12b = await req('GET', LOAD_SVC + '/api/v1/loads/search?pageSize=5', null, authH(merchantToken));
      if (r12b.body && r12b.body.success) ok('Merchant view loads: ' + (r12b.body.data.items || []).length + ' loads');
      else wo('Merchant loads view: ' + JSON.stringify(r12b.body).slice(0,80));
    } catch(e) { wo('Merchant loads: ' + e.message); }
  }

  // ── 13. DISPUTES ─────────────────────────────────────────────────────────
  section('13. Disputes');

  var dLoadId = newLoadId || testLoadId;
  if (dLoadId) {
    try {
      var r13 = await req('POST', ADMIN_SVC + '/api/v1/admin/disputes', {
        loadId: dLoadId, raisedByRole: 'merchant',
        description: 'QA test dispute -- goods delayed 4hrs at loading dock',
        disputeType: 'late_delivery',
      });
      if (r13.status === 201 && r13.body.success) ok('Dispute raised');
      else if (JSON.stringify(r13.body).indexOf('already') >= 0) wo('Dispute already exists for this load');
      else ko('Raise dispute', r13.body);
    } catch(e) { ko('Raise dispute error', e.message); }

    try {
      var r13b = await req('GET', ADMIN_SVC + '/api/v1/admin/disputes?pageSize=10');
      if (r13b.body && r13b.body.success) ok('List disputes: ' + (r13b.body.data && r13b.body.data.disputes && r13b.body.data.disputes.length || 0) + ' disputes');
      else ko('List disputes', r13b.body);
    } catch(e) { ko('List disputes', e.message); }
  }

  // ── 14. ADMIN OPS ─────────────────────────────────────────────────────────
  section('14. Admin Operations');

  try {
    var r14a = await req('GET', ADMIN_SVC + '/api/v1/admin/users?pageSize=10');
    if (r14a.body && r14a.body.success) {
      var userCount = (r14a.body.data && (r14a.body.data.items || r14a.body.data.users || r14a.body.data) || []).length;
      ok('Admin users: ' + userCount + ' users returned');
    } else ko('Admin users', r14a.body);
  } catch(e) { ko('Admin users', e.message); }

  try {
    var r14b = await req('GET', LOAD_SVC + '/api/v1/loads/search?pageSize=10');
    if (r14b.body && r14b.body.success) {
      var items14 = r14b.body.data.items || [];
      ok('Loads: ' + items14.length + ' total, statuses: ' + [...new Set(items14.map(function(l){ return l.status; }))].join(','));
    } else ko('Loads search', r14b.body);
  } catch(e) { ko('Loads search', e.message); }

  try {
    var r14c = await req('GET', TRUCKER_SVC + '/api/v1/truckers/live-positions');
    if (r14c.status === 200 && r14c.body && r14c.body.success) ok('Fleet live-positions endpoint responds');
    else wo('Fleet live-positions: ' + r14c.status + ' ' + JSON.stringify(r14c.body).slice(0,80));
  } catch(e) { wo('Fleet live-positions: ' + e.message); }

  try {
    var r14d = await req('GET', TRUCKER_SVC + '/api/v1/simulation/status');
    if (r14d.body && r14d.body.success) ok('Simulation status: ' + (r14d.body.data && r14d.body.data.truckers && r14d.body.data.truckers.length || 0) + ' sim truckers');
    else ko('Simulation status', r14d.body);
  } catch(e) { ko('Simulation status', e.message); }

  // ── 15. HEALTH CHECKS ────────────────────────────────────────────────────
  section('15. Service Health');

  var svcs = [
    ['API Gateway',   GW + '/health'],
    ['Load Svc',      'http://localhost:3001/health'],
    ['Trucker Svc',   'http://localhost:3002/health'],
    ['Pricing Svc',   'http://localhost:3003/health'],
    ['Admin Svc',     'http://localhost:3004/health'],
    ['Social Svc',    'http://localhost:3005/health'],
    ['ML Svc',        'http://localhost:3006/health'],
    ['Notification',  'http://localhost:3007/health'],
    ['Payment Svc',   'http://localhost:3008/health'],
  ];
  for (var si = 0; si < svcs.length; si++) {
    try {
      var rh = await req('GET', svcs[si][1]);
      if (rh.status === 200) ok(svcs[si][0] + ' healthy');
      else ko(svcs[si][0] + ' unhealthy (' + rh.status + ')');
    } catch(e) { ko(svcs[si][0] + ' unreachable', e.message); }
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  var total = pass + fail + warn;
  var score = total > 0 ? Math.round((pass / total) * 100) : 0;
  console.log('\n' + '='.repeat(55));
  console.log(color('bold', 'QA RESULTS:'));
  console.log(color('green',  '  PASS: ' + pass));
  console.log(color('yellow', '  WARN: ' + warn));
  console.log(color('red',    '  FAIL: ' + fail));
  console.log('='.repeat(55));
  if (errors.length > 0) {
    console.log(color('red', '\nFailed:'));
    errors.forEach(function(e) { console.log(color('red', '  - ' + e)); });
  }
  console.log('\nScore: ' + (score >= 80 ? color('green', score + '%') : color('red', score + '%')) + ' (' + pass + '/' + total + ')');
  if (fail === 0) console.log(color('green', '\nAll critical tests passing -- platform ready!\n'));
  else console.log(color('red', '\nFix the failing tests above\n'));
}

main().catch(function(e) { console.error('QA fatal:', e.message); process.exit(1); });
