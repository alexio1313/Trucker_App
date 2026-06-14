#!/bin/bash
# Master deployment script — run on SERVER after uploading
# Usage: bash /tmp/server_deploy_all.sh
set -e

echo "============================================"
echo "  AI Trucker Platform — Full Deployment"
echo "  $(date)"
echo "============================================"
cd ~/truck-platform

# ─── 1. PATCH TRUCKER SERVICE: begin-loading + availability gate ─────────────
echo ""
echo "[1] Patching trucker service (journey + availability)..."

# Copy current journey-routes.js out of container
docker cp truck_trucker_service:/app/dist/journey-routes.js /tmp/journey-routes.js

# Patch: add begin-loading endpoint
node - <<'NODEEOF'
var fs = require('fs');
var src = fs.readFileSync('/tmp/journey-routes.js', 'utf8');

if (src.indexOf('begin-loading') !== -1) {
  console.log('  [skip] begin-loading already patched');
  process.exit(0);
}

var beginLoading = `
// BEGIN-LOADING: move load from accepted → loading
router.post('/my/journey/begin-loading', async (req, res) => {
  var userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing x-user-id' } });
  var { loadId } = req.body || {};
  if (!loadId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId required' } });
  try {
    var db = require('/app/dist/db/postgres');
    var chk = await db.query('SELECT load_id, status FROM loads WHERE load_id = $1 AND trucker_id = $2', [loadId, userId]);
    if (!chk.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found or not assigned to you' } });
    var cur = chk.rows[0].status;
    if (cur !== 'accepted') return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Load must be accepted first. Current: ' + cur } });
    await db.query("UPDATE loads SET status='loading', updated_at=NOW() WHERE load_id=$1", [loadId]);
    res.json({ success: true, data: { loadId, status: 'loading', message: 'Arrived at pickup — cargo loading started' } });
  } catch(err) {
    console.error('[begin-loading]', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
`;

// Inject before the start handler
var marker = "router.post('/my/journey/start'";
var idx = src.indexOf(marker);
if (idx < 0) { marker = 'router.post(\"/my/journey/start\"'; idx = src.indexOf(marker); }
if (idx >= 0) {
  src = src.slice(0, idx) + beginLoading + '\n' + src.slice(idx);
  console.log('  [ok] begin-loading route injected');
} else {
  // Append before module.exports
  var eIdx = src.lastIndexOf('module.exports');
  if (eIdx < 0) eIdx = src.length;
  src = src.slice(0, eIdx) + beginLoading + '\n' + src.slice(eIdx);
  console.log('  [ok] begin-loading route appended');
}
fs.writeFileSync('/tmp/journey-routes-patched.js', src);
NODEEOF

# Check if patched file was created, else use original
if [ -f /tmp/journey-routes-patched.js ]; then
  docker cp /tmp/journey-routes-patched.js truck_trucker_service:/app/dist/journey-routes.js
  echo "  [ok] journey-routes.js deployed"
fi

# Patch app.js: availability gate
docker cp truck_trucker_service:/app/dist/app.js /tmp/trucker-app.js
node - <<'NODEEOF'
var fs = require('fs');
var src = fs.readFileSync('/tmp/trucker-app.js', 'utf8');
if (src.indexOf('OFFLINE_TRUCKER') !== -1) { console.log('  [skip] availability gate already patched'); process.exit(0); }
var gate = `
// AVAILABILITY GATE
app.use('/api/v1/loads/:loadId/accept', async (req, res, next) => {
  if (req.method !== 'POST') return next();
  var userId = req.headers['x-user-id'];
  if (!userId) return next();
  try {
    var db = require('/app/dist/db/postgres');
    var r = await db.query('SELECT availability_status FROM users WHERE user_id=$1',[userId]);
    if (r.rows.length && r.rows[0].availability_status !== 'available') {
      return res.status(400).json({ success: false, error: { code: 'OFFLINE_TRUCKER', message: 'You must be online to accept loads. Turn on availability in Profile.' } });
    }
  } catch(e) { /* allow if check fails */ }
  next();
});
`;
var nfIdx = src.indexOf('app.use((_req, res) => {');
if (nfIdx < 0) nfIdx = src.length;
src = src.slice(0, nfIdx) + gate + '\n' + src.slice(nfIdx);
fs.writeFileSync('/tmp/trucker-app-patched.js', src);
console.log('  [ok] availability gate injected');
NODEEOF

if [ -f /tmp/trucker-app-patched.js ]; then
  docker cp /tmp/trucker-app-patched.js truck_trucker_service:/app/dist/app.js
  echo "  [ok] trucker app.js deployed"
fi

docker restart truck_trucker_service
echo "  [ok] trucker service restarted"
sleep 3

# ─── 2. PATCH SOCIAL SERVICE: fix caption generator (remove Ollama, add templates) ──
echo ""
echo "[2] Patching social service (caption generator)..."

docker cp truck_social_service:/app/services/social-publishing/dist/ai/caption.generator.js /tmp/caption-gen.js 2>/dev/null || \
  docker exec truck_social_service find /app -name "caption.generator.js" 2>/dev/null | head -1 | xargs -I{} docker cp truck_social_service:{} /tmp/caption-gen.js 2>/dev/null || true

if [ -f /tmp/caption-gen.js ]; then
  node - <<'NODEEOF'
var fs = require('fs');
var src = fs.readFileSync('/tmp/caption-gen.js', 'utf8');
if (src.indexOf('generateTemplateCaption') !== -1) { console.log('  [skip] template fallback already patched'); process.exit(0); }

var templateFn = `
function generateTemplateCaption(req) {
  var topic = (req.topic||'').trim();
  var tone  = req.tone || 'professional';
  var plat  = req.platform || 'linkedin';
  var h = { twitter:'#Logistics #Trucking #India #FreightIndia', linkedin:'#LogisticsIndia #SupplyChain #Trucking #FreightTech', instagram:'#TruckingLife #LogisticsIndia #FreightForwarder #Truckers #IndiaLogistics', facebook:'#Logistics #Trucking #India', whatsapp:'' };
  var pro = [
    '🚛 ' + topic + '\\n\\nAt TruckPlatform, we connect verified truckers with trusted merchants for seamless freight across India.\\n\\n✅ Real-time tracking\\n✅ Transparent pricing\\n✅ Guaranteed payments\\n\\n' + (h[plat]||h.linkedin),
    '📦 ' + topic + '\\n\\nTruckPlatform is transforming Indian logistics — empowering 10,000+ truckers and merchants to move smarter, faster, and more profitably. 🇮🇳\\n\\n' + (h[plat]||h.linkedin),
    '🏆 ' + topic + '\\n\\nEvery load tracked, every payment secured, every trucker verified. We\\'re not just moving goods — we\\'re building trust across India\\'s supply chain.\\n\\n' + (h[plat]||h.linkedin),
  ];
  var cas = [
    'Hey! 👋 ' + topic + ' — and we couldn\\'t be more excited!\\n\\nTruckPlatform makes it super easy to book trusted trucks across India. Got cargo? We\\'ve got wheels! 🚛💨\\n\\n' + (h[plat]||'#Trucks'),
    'Big news! 🎉 ' + topic + '\\n\\nOur truckers work hard every day to keep India moving. Thank you for being part of the TruckPlatform family! ❤️\\n\\n' + (h[plat]||'#Trucking'),
  ];
  var cel = [
    '🎊 CELEBRATING: ' + topic + ' 🎉\\n\\nThis milestone belongs to every trucker, merchant, and team member who believed in us!\\n\\nThank you for making history in Indian logistics! 🚀🇮🇳\\n\\n' + (h[plat]||'#Milestone'),
  ];
  var tpls = tone==='celebratory'?cel:tone==='casual'?cas:pro;
  var idx = Math.abs((topic.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0))) % tpls.length;
  return tpls[idx];
}
`;

// Replace the final static fallback line with rich template call
var oldFallback = "return `Check out our latest update! ${req.topic} #TruckPlatform #Logistics #India`;";
var newFallback = "logger.info('Caption generated via template fallback');\n  return generateTemplateCaption(req);";
if (src.indexOf(oldFallback) >= 0) {
  src = src.replace(oldFallback, newFallback);
} else {
  // Try without template literal
  src = src.replace(/return [`'"]\s*Check out our latest update.*?[`'"];?/s, newFallback);
}

// Remove Ollama from provider list (30s timeout blocks everything)
src = src.replace(/\{[^}]*name:\s*['"]Ollama['"][^}]*\},?\s*/s, '');
src = src.replace(/,?\s*\{[^}]*generateWithOllama[^}]*\}/s, '');

// Inject template function before generateCaption
var exportIdx = src.indexOf('async function generateCaption');
if (exportIdx < 0) exportIdx = src.indexOf('function generateCaption');
if (exportIdx >= 0) {
  src = src.slice(0, exportIdx) + templateFn + '\n' + src.slice(exportIdx);
}

fs.writeFileSync('/tmp/caption-gen-patched.js', src);
console.log('  [ok] caption generator patched (Ollama removed, rich templates added)');
NODEEOF

  if [ -f /tmp/caption-gen-patched.js ]; then
    # Find where the file is in the container
    CAPTION_PATH=$(docker exec truck_social_service find /app -name "caption.generator.js" 2>/dev/null | head -1)
    if [ -n "$CAPTION_PATH" ]; then
      docker cp /tmp/caption-gen-patched.js truck_social_service:$CAPTION_PATH
      docker restart truck_social_service
      echo "  [ok] social service caption generator deployed and restarted"
    else
      echo "  [warn] could not find caption.generator.js in social container"
    fi
  fi
else
  echo "  [warn] could not extract caption.generator.js from social container"
fi

sleep 3

# ─── 3. REBUILD FRONTEND CONTAINERS ──────────────────────────────────────────
echo ""
echo "[3] Rebuilding frontend containers..."
echo "  This takes 5-10 minutes..."

docker compose build --no-cache truck_web truck_admin_panel 2>&1 | tail -20
docker compose up -d truck_web truck_admin_panel --no-deps
echo "  [ok] Frontend containers rebuilt"

sleep 5

# Re-apply gateway proxy patch (build from image resets it)
echo ""
echo "[4] Re-applying API gateway proxy patch..."
docker cp truck_api_gateway:/app/dist/routes/proxy.routes.js /tmp/gw-proxy.js 2>/dev/null || echo "  [warn] could not copy proxy.routes.js"

# Check if the patch is still in place
if grep -q 'fixRequestBody\|pathRewrite' /tmp/gw-proxy.js 2>/dev/null; then
  echo "  [ok] Gateway proxy patch still in place"
else
  echo "  [warn] Gateway proxy patch was lost — re-applying..."
  # If we have the patch script from previous session, run it
  if [ -f /tmp/patch_gateway_proxy.js ]; then
    node /tmp/patch_gateway_proxy.js
  else
    echo "  [ERROR] patch_gateway_proxy.js not found — gateway routes may be broken"
    echo "  Please re-run patch_gateway_proxy.js manually"
  fi
fi

# ─── 5. SEED DEMO DATA ────────────────────────────────────────────────────────
echo ""
echo "[5] Seeding demo data..."
if [ -f /tmp/seed_demo_data.js ]; then
  docker exec truck_trucker_service node /tmp/seed_demo_data.js 2>&1 | tail -20
else
  echo "  [skip] seed_demo_data.js not found at /tmp/"
fi

# ─── 6. HEALTH CHECK ─────────────────────────────────────────────────────────
echo ""
echo "[6] Health check..."
for SVC in 3000 3001 3002 3003 3004 3005 3006 3007 3008; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:$SVC/health)
  if [ "$STATUS" = "200" ]; then
    echo "  [ok] Port $SVC healthy"
  else
    echo "  [WARN] Port $SVC status $STATUS"
  fi
done

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE"
echo "  $(date)"
echo "============================================"
echo ""
echo "URLs:"
echo "  Trucker/Merchant portal: http://192.168.8.101:3010"
echo "  Admin panel:             http://192.168.8.101:3011/admin"
echo ""
echo "Demo credentials:"
echo "  Admin:    +919000000001 / TruckQA@2024"
echo "  Trucker:  +919860001001 / Admin@123"
echo "  Merchant: +919860002001 / Admin@123"
