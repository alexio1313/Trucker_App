// Injects simulation routes into trucker service app.js
var fs = require("fs");
var src = fs.readFileSync("/tmp/trucker_current_app.js", "utf8");
if (src.indexOf("simulation.routes") !== -1) { console.log("already has sim routes"); process.exit(0); }
var inject = '\n// SIM PATCH\ntry { app.use("/api/v1/simulation", require("/app/dist/simulation.routes")); } catch(e){ console.error("[sim]", e.message); }\n';
// Inject before JOURNEY PATCH or before 404 handler
var marker = "// JOURNEY PATCH";
var idx = src.indexOf(marker);
if (idx !== -1) {
  src = src.slice(0, idx) + inject + src.slice(idx);
  console.log("Injected before journey patch at:", idx);
} else {
  var marker2 = "app.use((_req, res) => {";
  idx = src.indexOf(marker2);
  if (idx !== -1) { src = src.slice(0, idx) + inject + src.slice(idx); console.log("Injected before 404 at:", idx); }
  else { src += inject; console.log("Appended"); }
}
fs.writeFileSync("/tmp/trucker_sim_patched.js", src);
console.log("Done. Patched size:", src.length, "bytes");
