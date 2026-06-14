// Fix column name mismatches in KYC and disputes routes
var fs = require('fs');

// Fix KYC route: kyc_doc_front_key → kyc_doc_front_url
var kycSrc = fs.readFileSync('/app/dist/admin/kyc.routes.js', 'utf8');
var kycFixed = kycSrc
  .replace(/kyc_doc_front_key/g, 'kyc_doc_front_url')
  .replace(/kyc_doc_back_key/g, 'kyc_doc_back_url');
fs.writeFileSync('/app/dist/admin/kyc.routes.js', kycFixed);
console.log('[ok] Fixed KYC column names: kyc_doc_front_key → kyc_doc_front_url');

// Fix disputes route: resolution column = resolution_notes
var dispSrc = fs.readFileSync('/app/dist/admin/disputes.routes.js', 'utf8');
// The resolve endpoint sets resolution = $3 but column may be resolution_notes
var dispFixed = dispSrc
  .replace(
    /UPDATE disputes SET status = 'resolved', resolved_by = \$2,\s*resolution = \$3, compensation_amount = \$4, resolved_at = NOW\(\), updated_at = NOW\(\)/,
    "UPDATE disputes SET status = 'resolved', resolved_by = $2, resolution_notes = $3, resolution_amount = $4, resolved_at = NOW(), updated_at = NOW()"
  );

if (dispFixed !== dispSrc) {
  fs.writeFileSync('/app/dist/admin/disputes.routes.js', dispFixed);
  console.log('[ok] Fixed disputes resolve: resolution → resolution_notes');
} else {
  console.log('[info] Disputes resolve SQL already correct or pattern not found');
  // Show the update statement
  var idx = dispSrc.indexOf('UPDATE disputes');
  if (idx > -1) console.log('[debug]', dispSrc.slice(idx, idx+200));
}
