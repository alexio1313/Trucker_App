// inject_v2_routes.js
// Run inside truck_trucker_service container from /app:
//   node /tmp/inject_v2_routes.js
// Injects highway, loader, and journey-v2 route files + patches app.js
'use strict';
const fs = require('fs');
const path = require('path');

const APP_JS = '/app/dist/app.js';

// ─── Highway routes ──────────────────────────────────────────────────────────
const highwayRoutes = fs.readFileSync('/tmp/highway_routes_patch.js', 'utf8');
fs.writeFileSync('/app/dist/highway.routes.js', highwayRoutes);
console.log('Written: /app/dist/highway.routes.js');

// ─── Loader routes ───────────────────────────────────────────────────────────
const loaderRoutes = fs.readFileSync('/tmp/loader_routes_patch.js', 'utf8');
fs.writeFileSync('/app/dist/loader.routes.js', loaderRoutes);
console.log('Written: /app/dist/loader.routes.js');

// ─── Journey V2 routes ───────────────────────────────────────────────────────
const journeyRoutes = fs.readFileSync('/tmp/journey_v2_patch.js', 'utf8');
fs.writeFileSync('/app/dist/journey_v2.routes.js', journeyRoutes);
console.log('Written: /app/dist/journey_v2.routes.js');

// ─── Patch app.js ────────────────────────────────────────────────────────────
let appJs = fs.readFileSync(APP_JS, 'utf8');

const INJECTION_MARKER = '// V2_ROUTES_INJECTED';
if (appJs.includes(INJECTION_MARKER)) {
  console.log('app.js already patched — skipping');
  process.exit(0);
}

// Insert before the 404 catch-all
const BEFORE = "app.use((_req, res) => {";
const INJECTION = `${INJECTION_MARKER}
const highwayRouter = require('./highway.routes');
const loaderRouter = require('./loader.routes');
const journeyV2Router = require('./journey_v2.routes');
app.use('/api/v1/highway', highwayRouter);
app.use('/api/v1/loader-cos', loaderRouter);
app.use('/api/v1/truckers/my/journey', journeyV2Router);
`;

if (!appJs.includes(BEFORE)) {
  console.error('ERROR: Could not find 404 handler anchor in app.js');
  process.exit(1);
}

appJs = appJs.replace(BEFORE, INJECTION + BEFORE);
fs.writeFileSync(APP_JS, appJs);
console.log('Patched: /app/dist/app.js — V2 routes registered');
console.log('Routes added: /api/v1/highway, /api/v1/loader-cos, /api/v1/truckers/my/journey (V2)');
