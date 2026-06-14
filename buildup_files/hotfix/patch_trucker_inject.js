// Simple injector: adds require('./journey-routes')(app) before 404 handler
var fs = require('fs');
var appPath = '/app/dist/app.js';
var src = fs.readFileSync(appPath, 'utf8');
if (src.indexOf('journey-routes') !== -1) {
  console.log('[patch] Already patched');
  process.exit(0);
}
var inject = '\n// JOURNEY PATCH\ntry { require("/app/dist/journey-routes")(app); } catch(e) { console.error("[journey]", e.message); }\n';
// Inject before 404 handler
var marker = 'app.use((_req, res) => {';
var idx = src.indexOf(marker);
if (idx !== -1) {
  src = src.slice(0, idx) + inject + src.slice(idx);
  console.log('[patch] Injected before 404 handler at index', idx);
} else {
  src = src + inject;
  console.log('[patch] Appended to end');
}
fs.writeFileSync(appPath, src);
console.log('[patch] Done');
