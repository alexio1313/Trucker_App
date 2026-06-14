// inject_v2_routes.js
// Run inside truck_trucker_service container:
//   node /tmp/inject_v2_routes.js
// Injects highway, loader, and journey-v2 route files + patches app.js
'use strict';
const fs = require('fs');

const APP_JS = '/app/dist/app.js';

// ─── Write route files (always overwrite with latest) ────────────────────────
fs.writeFileSync('/app/dist/highway.routes.js', fs.readFileSync('/tmp/highway_routes_patch.js', 'utf8'));
console.log('Written: /app/dist/highway.routes.js');

fs.writeFileSync('/app/dist/loader.routes.js', fs.readFileSync('/tmp/loader_routes_patch.js', 'utf8'));
console.log('Written: /app/dist/loader.routes.js');

fs.writeFileSync('/app/dist/journey_v2.routes.js', fs.readFileSync('/tmp/journey_v2_patch.js', 'utf8'));
console.log('Written: /app/dist/journey_v2.routes.js');

// ─── Patch app.js ────────────────────────────────────────────────────────────
let appJs = fs.readFileSync(APP_JS, 'utf8');

const INJECTION_MARKER = '// V2_ROUTES_INJECTED';
const BEFORE = 'app.use((_req, res) => {';

// Remove any previous injection (idempotent re-run)
if (appJs.includes(INJECTION_MARKER)) {
  // Strip everything from marker up to and including the blank line before BEFORE
  appJs = appJs.replace(/\/\/ V2_ROUTES_INJECTED\n[\s\S]*?app\.use\('\/api\/v1\/truckers\/my\/journey', journeyV2Router\);\n/, '');
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
app.use('/api/v1/highway', highwayRouter);
app.use('/api/v1/loader-cos', loaderRouter);
app.use('/api/v1/truckers/my/journey', journeyV2Router);
`;

appJs = appJs.replace(BEFORE, INJECTION + BEFORE);
fs.writeFileSync(APP_JS, appJs);
console.log('Patched: /app/dist/app.js');
console.log('Routes: /api/v1/highway  /api/v1/loader-cos  /api/v1/truckers/my/journey (V2)');
