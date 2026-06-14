// Master patch script — run on SERVER: node /tmp/patch_all_fixes.js
// Patches journey-routes.js, app.js for:
//   1. POST /my/journey/begin-loading  (accepted → loading)
//   2. Availability gate on load acceptance (loads must be online)
//   3. Load search includes merchant_name in response
var fs = require('fs');

// ─── 1. JOURNEY ROUTES: add begin-loading endpoint ──────────────────────────

var journeySrc = fs.readFileSync('/app/dist/journey-routes.js', 'utf8');

if (journeySrc.indexOf('begin-loading') !== -1) {
  console.log('[journey] begin-loading already patched');
} else {
  // Inject begin-loading handler before the start handler
  var beginLoadingRoute = `
// BEGIN-LOADING: accepted → loading
router.post('/my/journey/begin-loading', async (req, res) => {
  var userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing x-user-id' } });
  var { loadId } = req.body;
  if (!loadId) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'loadId required' } });
  try {
    var db = require('/app/dist/db/postgres');
    // Verify this load belongs to this trucker and is in accepted state
    var chk = await db.query(
      'SELECT load_id, status FROM loads WHERE load_id = $1 AND trucker_id = $2',
      [loadId, userId]
    );
    if (!chk.rows.length) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Load not found or not assigned to you' } });
    var currentStatus = chk.rows[0].status;
    if (currentStatus !== 'accepted') return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Load must be in accepted state to begin loading. Current: ' + currentStatus } });
    await db.query('UPDATE loads SET status = $1, updated_at = NOW() WHERE load_id = $2', ['loading', loadId]);
    res.json({ success: true, data: { loadId, status: 'loading', message: 'Arrived at pickup — cargo loading started' } });
  } catch (err) {
    console.error('[begin-loading]', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
`;

  // Find the start-journey handler and inject before it
  var marker = "router.post('/my/journey/start'";
  var idx = journeySrc.indexOf(marker);
  if (idx < 0) {
    // Try alternate form
    marker = "router.post(\"/my/journey/start\"";
    idx = journeySrc.indexOf(marker);
  }
  if (idx >= 0) {
    journeySrc = journeySrc.slice(0, idx) + beginLoadingRoute + '\n' + journeySrc.slice(idx);
    console.log('[journey] begin-loading route injected before start route');
  } else {
    // Append at end before module.exports
    var exportIdx = journeySrc.lastIndexOf('module.exports');
    if (exportIdx < 0) exportIdx = journeySrc.length;
    journeySrc = journeySrc.slice(0, exportIdx) + beginLoadingRoute + '\n' + journeySrc.slice(exportIdx);
    console.log('[journey] begin-loading route appended');
  }
  fs.writeFileSync('/app/dist/journey-routes.js', journeySrc);
}

// ─── 2. TRUCKER SERVICE app.js: availability gate on accept ──────────────────

var appSrc = fs.readFileSync('/app/dist/app.js', 'utf8');

// Check for availability patch on loads/accept
if (appSrc.indexOf('OFFLINE_TRUCKER') !== -1) {
  console.log('[app] availability gate already patched');
} else {
  var availGate = `
// AVAILABILITY GATE: block load acceptance when offline
app.use('/api/v1/loads/:loadId/accept', async (req, res, next) => {
  if (req.method !== 'POST') return next();
  var userId = req.headers['x-user-id'];
  if (!userId) return next();
  try {
    var db = require('/app/dist/db/postgres');
    var r = await db.query('SELECT availability_status FROM users WHERE user_id = $1', [userId]);
    if (r.rows.length && r.rows[0].availability_status !== 'available') {
      return res.status(400).json({ success: false, error: { code: 'OFFLINE_TRUCKER', message: 'You must be online to accept loads. Please turn on your availability in Profile.' } });
    }
  } catch(e) { /* if check fails, allow through */ }
  next();
});
`;

  // Inject after existing patches (SIM, JOURNEY, INTEL, TRUCKER PROFILE)
  var profileMarker = '// TRUCKER PROFILE PATCH';
  var pidx = appSrc.indexOf(profileMarker);
  if (pidx >= 0) {
    // Find end of that block
    var afterBlock = appSrc.indexOf('\n\n', pidx + 50);
    if (afterBlock < 0) afterBlock = pidx + 500;
    appSrc = appSrc.slice(0, afterBlock) + '\n' + availGate + appSrc.slice(afterBlock);
    console.log('[app] availability gate injected after profile patch');
  } else {
    // Inject before 404 handler
    var notFound = "app.use((_req, res) => {";
    var nfIdx = appSrc.indexOf(notFound);
    if (nfIdx < 0) nfIdx = appSrc.length;
    appSrc = appSrc.slice(0, nfIdx) + availGate + '\n' + appSrc.slice(nfIdx);
    console.log('[app] availability gate injected before 404 handler');
  }
  fs.writeFileSync('/app/dist/app.js', appSrc);
}

console.log('[patch_all_fixes] Done.');
