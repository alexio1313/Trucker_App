// Comprehensive demo data seeding — run on SERVER: node /tmp/seed_demo_data.js
// Seeds: KYC pending users, social posts, rich loads with merchant names
var http  = require('http');
var https = require('https');
var { MongoClient } = require('/app/node_modules/mongodb') || require('mongodb');

var GW     = 'http://localhost:3000/api/v1';
var TRUCKER= 'http://localhost:3002/api/v1';
var LOAD   = 'http://localhost:3001/api/v1';
var MONGO  = process.env.MONGODB_URI || 'mongodb://mongodb:27017/truck_platform';

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function req(method, url, body, headers) {
  headers = headers || {};
  return new Promise(function(resolve) {
    var u = new URL(url);
    var bodyStr = body ? JSON.stringify(body) : null;
    var h = Object.assign({ 'Content-Type': 'application/json' }, headers);
    if (bodyStr) h['Content-Length'] = Buffer.byteLength(bodyStr);
    var opts = {
      hostname: u.hostname, port: parseInt(u.port) || 80,
      path: u.pathname + u.search, method: method, headers: h,
    };
    var timer = setTimeout(function() { resolve({ status: 0, body: 'TIMEOUT' }); }, 15000);
    var r2 = http.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        clearTimeout(timer);
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d || null }); }
      });
    });
    r2.on('error', function(e) { clearTimeout(timer); resolve({ status: -1, body: e.message }); });
    if (bodyStr) r2.write(bodyStr);
    r2.end();
  });
}

async function login(phone, pass) {
  var r = await req('POST', GW + '/auth/login', { phoneNumber: phone, password: pass });
  if (r.status === 200 && r.body.success) return r.body.data.accessToken;
  throw new Error('Login failed for ' + phone + ': ' + JSON.stringify(r.body));
}

async function main() {
  console.log('=== DEMO DATA SEEDING ===\n');

  // ─── 1. Get tokens ────────────────────────────────────────────────────────
  console.log('[1] Logging in to get tokens...');
  var adminToken   = await login('+919000000001', 'TruckQA@2024');
  var trucker1     = await login('+919860001001', 'Admin@123');
  var trucker2     = await login('+919860001002', 'Admin@123');
  var merchant1    = await login('+919860002001', 'Admin@123');
  var merchant2    = await login('+919860002002', 'Admin@123');
  var merchant3    = await login('+919860002003', 'Admin@123');
  console.log('  All logins OK\n');

  // ─── 2. Seed social posts via social service directly ─────────────────────
  console.log('[2] Seeding social posts...');
  var mongo = new MongoClient(MONGO);
  await mongo.connect();
  var db = mongo.db();
  var postsCol = db.collection('social_posts');

  var existingCount = await postsCol.countDocuments();
  console.log('  Existing posts:', existingCount);

  if (existingCount < 5) {
    var simPosts = [
      {
        createdBy: 'f2000000-0000-0000-0000-000000000001',
        createdByName: 'TechLogix Bangalore',
        platforms: ['linkedin', 'twitter'],
        content: '🚛 Excited to announce TechLogix has partnered with TruckPlatform for all our Mumbai to Bangalore freight needs!\n\nReliable trucks, real-time tracking, and guaranteed delivery — exactly what our electronics supply chain needed.\n\nThe future of logistics is here! 🇮🇳\n\n#TruckPlatform #Logistics #SupplyChain #Electronics #B2BIndia',
        status: 'published',
        mediaUrls: [],
        scheduledFor: null,
        publishResults: [{ platform: 'linkedin', success: true }, { platform: 'twitter', success: true }],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        approvedBy: 'admin-1',
        approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        createdBy: 'f2000000-0000-0000-0000-000000000002',
        createdByName: 'NorthLink Delhi',
        platforms: ['facebook', 'whatsapp'],
        content: '📦 NorthLink Delhi is now using AI-powered freight matching for all our North India routes!\n\nTruckPlatform found us a verified 20-tonne truck for our Delhi → Ludhiana textile shipment in under 10 minutes. That\'s the power of technology! 💪\n\nIf you\'re a manufacturer in NCR looking for reliable logistics — DM us!\n\n#NorthIndia #Logistics #TextileIndustry #Delhi #Trucking',
        status: 'published',
        mediaUrls: [],
        scheduledFor: null,
        publishResults: [{ platform: 'facebook', success: true }, { platform: 'whatsapp', success: true }],
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        approvedBy: 'admin-1',
        approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        createdBy: 'f2000000-0000-0000-0000-000000000003',
        createdByName: 'MarinePort Mumbai',
        platforms: ['linkedin', 'instagram'],
        content: '🏆 MarinePort Mumbai celebrates 500 loads dispatched via TruckPlatform!\n\nFrom JNPT to warehouses across Maharashtra — our freight has never moved faster or more affordably.\n\nHere\'s to the next 500! 🎉\n\n#Mumbai #PortLogistics #Maharashtra #FreightForwarder #Milestone',
        status: 'pending_approval',
        mediaUrls: [],
        scheduledFor: null,
        publishResults: [],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        publishedAt: null,
      },
      {
        createdBy: 'f2000000-0000-0000-0000-000000000001',
        createdByName: 'TechLogix Bangalore',
        platforms: ['twitter'],
        content: '🚨 Looking for urgently: 2 trucks BLR → HYD tomorrow morning for electronics consignment. 12T each. FASTag mandatory. Contact via TruckPlatform app. #UrgentCargo #Bangalore #Hyderabad #B2BLogistics',
        status: 'pending_approval',
        mediaUrls: [],
        scheduledFor: null,
        publishResults: [],
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        publishedAt: null,
      },
      {
        createdBy: 'f2000000-0000-0000-0000-000000000002',
        createdByName: 'NorthLink Delhi',
        platforms: ['instagram'],
        content: '⚡️ Flash sale on Delhi-Mumbai corridor lanes this week!\n\nBook through TruckPlatform and get priority matching for your cargo.\n\n#Delhi #Mumbai #Logistics #FreightSale',
        status: 'rejected',
        rejectionReason: 'Pricing claims in posts need to be verified with the commercial team first. Please resubmit after confirmation.',
        mediaUrls: [],
        scheduledFor: null,
        publishResults: [],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        publishedAt: null,
      },
      {
        createdBy: 'f2000000-0000-0000-0000-000000000003',
        createdByName: 'MarinePort Mumbai',
        platforms: ['linkedin', 'facebook', 'twitter'],
        content: '🌊 The logistics revolution in Indian ports has arrived.\n\nMarinePort Mumbai now handles seamless last-mile delivery from JNPT to 50+ cities via TruckPlatform\'s verified carrier network.\n\n🏭 24-hour dispatch\n📍 Real-time GPS tracking\n💸 Secure digital payments\n🤝 Dispute resolution support\n\nPartner with us for your import/export cargo needs.\n\n#JNPT #Mumbai #PortLogistics #ExportIndia #ImportLogistics #SupplyChain',
        status: 'published',
        mediaUrls: [],
        scheduledFor: null,
        publishResults: [{ platform: 'linkedin', success: true }, { platform: 'facebook', success: true }, { platform: 'twitter', success: true }],
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        approvedBy: 'admin-1',
        approvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    ];

    await postsCol.insertMany(simPosts);
    console.log('  Inserted', simPosts.length, 'social posts (2 pending, 3 published, 1 rejected)');
  } else {
    console.log('  Posts already exist, skipping');
  }

  // ─── 3. Seed KYC pending users in DB ──────────────────────────────────────
  console.log('\n[3] Seeding KYC pending users...');
  var pg = require('/app/dist/db/postgres');

  // Create KYC-pending trucker accounts for the demo queue
  var kycUsers = [
    { phone: '+919770002001', name: 'Arjun Sharma',    type: 'trucker',   city: 'Pune' },
    { phone: '+919770002002', name: 'Priya Nair',      type: 'trucker',   city: 'Chennai' },
    { phone: '+919770002003', name: 'Rajesh Gupta',    type: 'trucker',   city: 'Ahmedabad' },
    { phone: '+919880002001', name: 'Lakshmi Traders', type: 'merchant',  city: 'Coimbatore' },
    { phone: '+919880002002', name: 'Global Exports',  type: 'merchant',  city: 'Surat' },
  ];

  var bcrypt = require('/app/node_modules/bcryptjs');
  var hash   = await bcrypt.hash('Demo@2024', 12);
  var { v4: uuidv4 } = require('/app/node_modules/uuid') || {};

  var insertedKyc = 0;
  for (var ku of kycUsers) {
    var exists = await pg.query('SELECT user_id FROM users WHERE phone_number = $1', [ku.phone]);
    if (exists.rows.length > 0) {
      // Update to pending KYC for demo
      await pg.query("UPDATE users SET kyc_status = 'pending' WHERE phone_number = $1 AND kyc_status != 'approved'", [ku.phone]);
      console.log('  Updated KYC pending:', ku.name);
      continue;
    }
    var uid = uuidv4 ? uuidv4() : require('crypto').randomUUID();
    await pg.query(
      `INSERT INTO users (user_id, full_name, phone_number, password_hash, user_type, kyc_status, availability_status, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending','offline',NOW())
       ON CONFLICT (phone_number) DO UPDATE SET kyc_status = 'pending'`,
      [uid, ku.name, ku.phone, hash, ku.type]
    );
    insertedKyc++;
    console.log('  Created KYC-pending user:', ku.name, '(' + ku.phone + ')');
  }
  console.log('  KYC users ready:', kycUsers.length, '(' + insertedKyc + ' new)');

  // ─── 4. Post additional loads with rich data ───────────────────────────────
  console.log('\n[4] Posting additional demo loads...');

  var richLoads = [
    {
      token: merchant1,
      body: {
        origin:      { lat: 13.0827, lng: 80.2707, address: 'Ambattur Industrial Estate, Chennai', city: 'Chennai', state: 'Tamil Nadu' },
        destination: { lat: 12.2958, lng: 76.6394, address: 'KIADB Industrial Area, Mysuru', city: 'Mysuru', state: 'Karnataka' },
        cargo: { weightKg: 15000, cargoType: 'automotive_parts', volumeCbm: 32 },
        timeWindow: { pickupStart: new Date(Date.now() + 2*86400000).toISOString(), pickupEnd: new Date(Date.now() + 3*86400000).toISOString(), deliveryExpected: new Date(Date.now() + 4*86400000).toISOString(), loadingTimeMinutes: 90, unloadingTimeMinutes: 60 },
        description: 'Auto components — fragile, handle with care. MSIL supplier shipment.',
      }
    },
    {
      token: merchant2,
      body: {
        origin:      { lat: 28.7041, lng: 77.1025, address: 'Naraina Industrial Area, New Delhi', city: 'Delhi', state: 'Delhi' },
        destination: { lat: 26.8467, lng: 80.9462, address: 'Kanpur Industrial Area, Kanpur', city: 'Kanpur', state: 'Uttar Pradesh' },
        cargo: { weightKg: 22000, cargoType: 'textiles', volumeCbm: 55 },
        timeWindow: { pickupStart: new Date(Date.now() + 1*86400000).toISOString(), pickupEnd: new Date(Date.now() + 2*86400000).toISOString(), deliveryExpected: new Date(Date.now() + 3*86400000).toISOString(), loadingTimeMinutes: 120, unloadingTimeMinutes: 90 },
        description: 'Readymade garments for Kanpur export hub. Sealed containers only.',
      }
    },
    {
      token: merchant3,
      body: {
        origin:      { lat: 19.0760, lng: 72.8777, address: 'JNPT Port, Navi Mumbai', city: 'Mumbai', state: 'Maharashtra' },
        destination: { lat: 21.1702, lng: 72.8311, address: 'Sachin GIDC, Surat', city: 'Surat', state: 'Gujarat' },
        cargo: { weightKg: 18000, cargoType: 'electronics', volumeCbm: 40 },
        timeWindow: { pickupStart: new Date(Date.now() + 1*86400000).toISOString(), pickupEnd: new Date(Date.now() + 1*86400000 + 3600000*6).toISOString(), deliveryExpected: new Date(Date.now() + 2*86400000).toISOString(), loadingTimeMinutes: 60, unloadingTimeMinutes: 45 },
        description: 'Import cargo from JNPT container yard. Customs cleared. Time-sensitive.',
      }
    },
    {
      token: merchant1,
      body: {
        origin:      { lat: 17.3850, lng: 78.4867, address: 'Patancheru Industrial Area, Hyderabad', city: 'Hyderabad', state: 'Telangana' },
        destination: { lat: 15.8497, lng: 74.4977, address: 'Belgaum Industrial Estate, Belagavi', city: 'Belagavi', state: 'Karnataka' },
        cargo: { weightKg: 8000, cargoType: 'pharma', volumeCbm: 20 },
        timeWindow: { pickupStart: new Date(Date.now() + 3*86400000).toISOString(), pickupEnd: new Date(Date.now() + 3*86400000 + 3600000*4).toISOString(), deliveryExpected: new Date(Date.now() + 4*86400000).toISOString(), loadingTimeMinutes: 45, unloadingTimeMinutes: 30 },
        description: 'Pharmaceutical goods — temperature controlled 2-8°C. Refrigerated truck mandatory.',
      }
    },
    {
      token: merchant2,
      body: {
        origin:      { lat: 22.5726, lng: 88.3639, address: 'Dankuni Industrial Area, Kolkata', city: 'Kolkata', state: 'West Bengal' },
        destination: { lat: 25.5941, lng: 85.1376, address: 'Hajipur Industrial Area, Patna', city: 'Patna', state: 'Bihar' },
        cargo: { weightKg: 25000, cargoType: 'steel', volumeCbm: 30 },
        timeWindow: { pickupStart: new Date(Date.now() + 2*86400000).toISOString(), pickupEnd: new Date(Date.now() + 2*86400000 + 3600000*8).toISOString(), deliveryExpected: new Date(Date.now() + 4*86400000).toISOString(), loadingTimeMinutes: 180, unloadingTimeMinutes: 120 },
        description: 'TMT steel bars for construction. Multi-axle trailer required. Overweight permit arranged.',
      }
    },
  ];

  var loadCount = 0;
  for (var ld of richLoads) {
    var r = await req('POST', GW + '/loads', ld.body, { 'Authorization': 'Bearer ' + ld.token });
    if (r.status === 201 || r.status === 200) {
      loadCount++;
      var l = r.body.data;
      var city = l && l.origin ? l.origin.city : '?';
      var dcity = l && l.destination ? l.destination.city : '?';
      console.log('  Posted load:', city, '→', dcity);
    } else {
      console.log('  Load post failed:', r.status, JSON.stringify(r.body).slice(0, 100));
    }
  }
  console.log('  Posted', loadCount, 'new loads');

  // ─── 5. Seed disputes ─────────────────────────────────────────────────────
  console.log('\n[5] Seeding disputes...');
  var loadsRes = await req('GET', LOAD + '/search?pageSize=20&status=delivered', null, {});
  var deliveredLoads = (loadsRes.body && loadsRes.body.data && loadsRes.body.data.items) || [];

  var disputes = [
    { type: 'waiting_charge', desc: 'Trucker waited 4 hours at pickup. Loading dock was not ready. Requesting compensation of ₹2,000 as per contract clause 8.3.' },
    { type: 'damage',         desc: 'Two cartons of electronics were damaged in transit. Photos submitted. Requesting reimbursement of ₹18,500 for damaged goods.' },
    { type: 'late_delivery',  desc: 'Delivery was 6 hours late causing production line shutdown at factory. SLA breach. Penalty clause to be applied.' },
    { type: 'payment_issue',  desc: 'Payment not received 7 days after delivery confirmation. Trucker ID verified. Merchant claims invoice dispute.' },
  ];

  var disputesInserted = 0;
  var dispCheck = await pg.query("SELECT COUNT(*) FROM disputes");
  var dispCount = parseInt(dispCheck.rows[0].count);
  console.log('  Existing disputes:', dispCount);

  if (dispCount < 2 && deliveredLoads.length > 0) {
    for (var i = 0; i < Math.min(disputes.length, deliveredLoads.length); i++) {
      var dispLoad = deliveredLoads[i];
      var dispLoadId = dispLoad.loadId || dispLoad.load_id;
      if (!dispLoadId) continue;
      try {
        var loadInfo = await pg.query('SELECT merchant_id, trucker_id FROM loads WHERE load_id = $1', [dispLoadId]);
        if (!loadInfo.rows.length) continue;
        var row = loadInfo.rows[0];
        var mid  = row.merchant_id;
        var tid  = row.trucker_id;
        if (!mid || !tid) continue;

        var dispId = require('crypto').randomUUID();
        await pg.query(
          `INSERT INTO disputes (dispute_id, load_id, raised_by, raised_against, dispute_type, description, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'open',NOW())
           ON CONFLICT DO NOTHING`,
          [dispId, dispLoadId, i % 2 === 0 ? mid : tid, i % 2 === 0 ? tid : mid, disputes[i].type, disputes[i].desc]
        );
        disputesInserted++;
        console.log('  Created dispute:', disputes[i].type);
      } catch(e) {
        console.log('  Dispute insert error:', e.message.slice(0, 80));
      }
    }
  } else if (dispCount >= 2) {
    console.log('  Disputes already exist');
  } else {
    console.log('  No delivered loads to create disputes against');
  }

  await mongo.close();

  console.log('\n=== SEEDING COMPLETE ===');
  console.log('Social posts: 6 (3 published, 2 pending, 1 rejected)');
  console.log('KYC pending:  5 users in queue');
  console.log('New loads:   ', loadCount, 'added');
  console.log('Disputes:    ', disputesInserted, 'created');
  console.log('\nDemo credentials:');
  console.log('  Admin:    +919000000001 / TruckQA@2024');
  console.log('  Trucker:  +919860001001 / Admin@123');
  console.log('  Merchant: +919860002001 / Admin@123');
}

main().catch(function(e) { console.error('SEED ERROR:', e.message); process.exit(1); });
