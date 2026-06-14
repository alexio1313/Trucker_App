// Patch load service to include merchant_name in search results
// Run on SERVER: node /tmp/patch_load_merchant_name.js
// Then docker cp /tmp/load_search_patched.js truck_load_service:/app/dist/routes/load.routes.js
var fs = require('fs');

var src = fs.readFileSync('/app/dist/routes/load.routes.js', 'utf8');

if (src.indexOf('merchant_name') !== -1) {
  console.log('merchant_name already in load routes');
  process.exit(0);
}

// Find the search query that returns loads — look for the SELECT statement
// We want to JOIN with users to get merchant full_name
// The key insight: loads has merchant_id (UUID FK to users.user_id)
// We wrap the existing query to add merchant name via a subquery

// Strategy: find where items are returned and add merchant_name via a separate lookup
// Look for the response mapping code

var searchMarker = 'items.map';
var idx = src.indexOf(searchMarker);

if (idx >= 0) {
  // Find the map function that transforms DB rows to response
  // We'll inject a merchant name lookup
  console.log('Found items.map at index', idx);

  // Look for where we format the response object
  // Inject a function that adds merchant_name from a parallel query
  var addMerchantName = `
// Enrich results with merchant names
async function addMerchantNames(db, items) {
  var merchantIds = [...new Set(items.map(function(i) { return i.merchantId || i.merchant_id; }).filter(Boolean))];
  if (!merchantIds.length) return items;
  try {
    var r = await db.query('SELECT user_id, full_name FROM users WHERE user_id = ANY($1::uuid[])', [merchantIds]);
    var nameMap = {};
    r.rows.forEach(function(row) { nameMap[row.user_id] = row.full_name; });
    return items.map(function(item) {
      var mid = item.merchantId || item.merchant_id;
      if (mid && nameMap[mid]) item.merchant_name = nameMap[mid];
      return item;
    });
  } catch(e) { return items; }
}
`;

  // Inject this function near the top of the file (after requires)
  var requireEnd = src.indexOf('\n\nrouter');
  if (requireEnd < 0) requireEnd = src.indexOf('\nrouter.');
  if (requireEnd < 0) requireEnd = 100;

  src = src.slice(0, requireEnd) + '\n' + addMerchantName + src.slice(requireEnd);

  // Now find where the search endpoint sends the response and add merchant name enrichment
  // Look for res.json with items
  var resJsonPattern = 'res.json({ success: true, data: { items';
  var resIdx = src.indexOf(resJsonPattern);
  if (resIdx < 0) {
    resJsonPattern = "res.json({success:true,data:{items";
    resIdx = src.indexOf(resJsonPattern);
  }

  if (resIdx >= 0) {
    // Inject before res.json: items = await addMerchantNames(db, items);
    // Find the line start
    var lineStart = src.lastIndexOf('\n', resIdx);
    src = src.slice(0, lineStart + 1) +
      '    try { items = await addMerchantNames(db, items); } catch(e) {}\n' +
      src.slice(lineStart + 1);
    console.log('Injected addMerchantNames call before res.json');
  } else {
    console.log('Could not find res.json pattern — merchant name enrichment not added to response');
    // Still write the helper function
  }
}

fs.writeFileSync('/tmp/load_search_patched.js', src);
console.log('Done. Output: /tmp/load_search_patched.js');
