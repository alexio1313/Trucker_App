// Inject trucker intel routes into app.js on SERVER
var fs = require('fs');
var src = fs.readFileSync('/tmp/trucker_app.js', 'utf8');

if (src.indexOf('trucker.intel.routes') !== -1) {
  console.log('Intel routes already mounted');
  fs.writeFileSync('/tmp/trucker_app_intel.js', src);
  process.exit(0);
}

// Inject before the 404 handler
var marker = 'app.use((_req, res) => {';
var inject = '\n// INTEL ROUTES\ntry { app.use("/api/v1/truckers", require("/app/dist/trucker.intel.routes")); } catch(e){ console.error("[intel]", e.message); }\n';
src = src.replace(marker, inject + marker);
fs.writeFileSync('/tmp/trucker_app_intel.js', src);
console.log('Intel routes injected. Size:', src.length);
