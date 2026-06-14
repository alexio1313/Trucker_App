'use strict';
// inject_v2_routes.js — run inside truck_trucker_service container
// Injects V2 routes AND auth service camelCase patch. Fully idempotent.
const fs = require('fs');
const APP_JS = '/app/dist/app.js';

// ─── 1. Write route files ─────────────────────────────────────────────────────
fs.writeFileSync('/app/dist/highway.routes.js', fs.readFileSync('/tmp/highway_routes_patch.js', 'utf8'));
console.log('Written: /app/dist/highway.routes.js');

fs.writeFileSync('/app/dist/loader.routes.js', fs.readFileSync('/tmp/loader_routes_patch.js', 'utf8'));
console.log('Written: /app/dist/loader.routes.js');

fs.writeFileSync('/app/dist/journey_v2.routes.js', fs.readFileSync('/tmp/journey_v2_patch.js', 'utf8'));
console.log('Written: /app/dist/journey_v2.routes.js');

fs.writeFileSync('/app/dist/simulation.routes.js', fs.readFileSync('/tmp/simulation_routes_patch.js', 'utf8'));
console.log('Written: /app/dist/simulation.routes.js');

// ─── 2. Patch auth.service.js (camelCase + strip password_hash) ──────────────
const AUTH = '/app/dist/auth/auth.service.js';
let authSrc = fs.readFileSync(AUTH, 'utf8');
const AUTH_MARKER = '// AUTH_SERVICE_PATCHED_V2';

if (authSrc.includes(AUTH_MARKER)) {
  authSrc = authSrc.replace(/\/\/ AUTH_SERVICE_PATCHED_V2[\s\S]*?function safeUser[\s\S]*?\}\n/, '');
}

const SAFE_USER_HELPER = `
${AUTH_MARKER}
function safeUser(u) {
  if (!u) return u;
  return {
    userId: u.user_id,
    userType: u.user_type,
    fullName: u.full_name,
    email: u.email,
    phoneNumber: u.phone_number,
    kycStatus: u.kyc_status,
    kycDocFrontUrl: u.kyc_doc_front_url || null,
    kycDocBackUrl: u.kyc_doc_back_url || null,
    bankAccount: u.bank_account || null,
    gstNumber: u.gst_number || null,
    panNumber: u.pan_number || null,
    rating: parseFloat(u.rating || 5),
    totalRatings: u.total_ratings || 0,
    commissionRate: parseFloat(u.commission_rate || 5),
    isSuspended: u.is_suspended || false,
    suspendedUntil: u.suspended_until || null,
    suspensionReason: u.suspension_reason || null,
    fcmToken: u.fcm_token || null,
    lastLoginAt: u.last_login_at || null,
    profilePhotoUrl: u.profile_photo_url || null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    aadhaarVerified: u.aadhaar_verified || false,
    verificationStage: u.verification_stage || 1,
  };
}
`;

authSrc = authSrc.replace('async function registerUser(input) {', SAFE_USER_HELPER + 'async function registerUser(input) {');
authSrc = authSrc.replace(/return \{ accessToken, refreshToken, expiresIn: 900, user \};/g,
  'return { accessToken, refreshToken, expiresIn: 900, user: safeUser(user) };');

fs.writeFileSync(AUTH, authSrc);
console.log('Patched: /app/dist/auth/auth.service.js (camelCase + no password_hash)');

// ─── 3. Patch app.js with V2 routes ──────────────────────────────────────────
let appJs = fs.readFileSync(APP_JS, 'utf8');
const INJECTION_MARKER = '// V2_ROUTES_INJECTED';
const BEFORE = 'app.use((_req, res) => {';

if (appJs.includes(INJECTION_MARKER)) {
  // Remove everything from the marker up to (but not including) the 404 handler anchor
  appJs = appJs.replace(/\/\/ V2_ROUTES_INJECTED[\s\S]*?(?=app\.use\(\(_req, res\) => \{)/, '');
  console.log('Removed previous V2 injection block');
}

if (!appJs.includes(BEFORE)) {
  console.error('ERROR: Cannot find 404 handler anchor in app.js — aborting');
  process.exit(1);
}

const INJECTION = INJECTION_MARKER + `
const highwayRouter = require('./highway.routes');
const loaderRouter = require('./loader.routes');
const journeyV2Router = require('./journey_v2.routes');
const simulationRouter = require('./simulation.routes');
app.use('/api/v1/highway', highwayRouter);
app.use('/api/v1/loader-cos', loaderRouter);
app.use('/api/v1/truckers/my/journey', journeyV2Router);
app.use('/api/v1/simulation', simulationRouter);
`;

appJs = appJs.replace(BEFORE, INJECTION + BEFORE);
fs.writeFileSync(APP_JS, appJs);
console.log('Patched: /app/dist/app.js');
console.log('Routes: /api/v1/highway  /api/v1/loader-cos  /api/v1/truckers/my/journey  /api/v1/simulation (V2)');
