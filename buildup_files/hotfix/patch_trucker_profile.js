// Run on SERVER: node patch_trucker_profile.js
// Reads /tmp/trucker_app.js, patches it, writes to /tmp/trucker_app_patched.js
var fs = require('fs');

var src = fs.readFileSync('/tmp/trucker_app.js', 'utf8');
var marker = '// SIM PATCH';

if (src.indexOf('/api/v1/truckers/profile') !== -1) {
  console.log('Already has profile route');
  fs.writeFileSync('/tmp/trucker_app_patched.js', src);
  process.exit(0);
}

var profilePatch = '\n// TRUCKER PROFILE PATCH\n' +
  'app.get("/api/v1/truckers/profile", async function(req, res) {\n' +
  '  try {\n' +
  '    var userId = req.headers["x-user-id"] || (req.user && req.user.userId);\n' +
  '    if (!userId) { res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "x-user-id required" } }); return; }\n' +
  '    var db = require("/app/dist/db/postgres");\n' +
  '    var rows = await db.query("SELECT u.*, array_agg(row_to_json(t.*)) FILTER (WHERE t.truck_id IS NOT NULL) as trucks FROM users u LEFT JOIN trucks t ON t.trucker_id = u.user_id WHERE u.user_id = $1 AND u.deleted_at IS NULL GROUP BY u.user_id", [userId]);\n' +
  '    if (!rows[0]) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } }); return; }\n' +
  '    var u = rows[0];\n' +
  '    res.json({ success: true, data: {\n' +
  '      userId: u.user_id, userType: u.user_type, fullName: u.full_name,\n' +
  '      email: u.email, phoneNumber: u.phone_number, kycStatus: u.kyc_status,\n' +
  '      rating: parseFloat(u.rating), totalRatings: u.total_ratings,\n' +
  '      commissionRate: parseFloat(u.commission_rate),\n' +
  '      availabilityStatus: u.availability_status || "offline",\n' +
  '      trucks: u.trucks || [],\n' +
  '    }});\n' +
  '  } catch(e) { res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: e.message } }); }\n' +
  '});\n';

src = src.replace(marker, profilePatch + marker);
fs.writeFileSync('/tmp/trucker_app_patched.js', src);
console.log('Profile route injected. Patched size:', src.length);
