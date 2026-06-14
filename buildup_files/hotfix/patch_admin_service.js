// Patch admin service app.js to add:
//   GET /api/v1/admin/loads        (with merchant info join)
//   GET /api/v1/admin/social-posts (from MongoDB)
//   PUT /api/v1/admin/social-posts/:id/approve
//   PUT /api/v1/admin/social-posts/:id/reject
//   GET /api/v1/admin/kyc (test + fix if broken)

var fs = require('fs');
var src = fs.readFileSync('/app/dist/app.js', 'utf8');

// ─── 1. Add loads endpoint ────────────────────────────────────────────────────
if (src.indexOf('/api/v1/admin/loads') === -1) {

  var loadsRoute = `
// PATCH: Admin loads endpoint
app.get('/api/v1/admin/loads', async (req, res) => {
  try {
    var pool = require('/app/dist/db/pool');
    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 50;
    var offset = (page - 1) * limit;
    var status = req.query.status;
    var search = req.query.search || '';

    var where = [];
    var params = [];
    var pidx = 1;

    if (status && status !== 'all') {
      where.push('l.status = $' + pidx++);
      params.push(status);
    }
    if (search) {
      where.push('(l.origin_city ILIKE $' + pidx + ' OR l.dest_city ILIKE $' + pidx + ' OR l.load_id ILIKE $' + pidx + ')');
      params.push('%' + search + '%');
      pidx++;
    }

    var whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(limit);
    params.push(offset);

    var result = await pool.query(
      \`SELECT l.*,
        um.full_name AS merchant_name,
        um.phone_number AS merchant_phone,
        ut.full_name AS trucker_name,
        ut.phone_number AS trucker_phone
       FROM loads l
       LEFT JOIN users um ON um.user_id = l.merchant_id
       LEFT JOIN users ut ON ut.user_id = l.trucker_id
       \${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $\${pidx} OFFSET $\${pidx + 1}\`,
      params
    );

    var countResult = await pool.query(
      \`SELECT COUNT(*) FROM loads l \${whereClause}\`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      data: {
        loads: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: page,
        limit: limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch(err) {
    console.error('[admin/loads]', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
`;

  // Insert before the catch-all 404 handler
  var notFoundIdx = src.indexOf("app.use((_req, res) => {");
  if (notFoundIdx < 0) notFoundIdx = src.length;
  src = src.slice(0, notFoundIdx) + loadsRoute + '\n' + src.slice(notFoundIdx);
  console.log('[ok] /admin/loads endpoint added');
} else {
  console.log('[skip] /admin/loads already patched');
}

// ─── 2. Add social-posts endpoints (read from MongoDB) ──────────────────────
if (src.indexOf('/api/v1/admin/social-posts') === -1) {

  var socialRoute = `
// PATCH: Admin social-posts endpoints (reads from MongoDB)
var _mongoClient = null;
async function getMongoDb() {
  if (!_mongoClient || !_mongoClient.topology || !_mongoClient.topology.isConnected()) {
    var { MongoClient } = require('mongodb');
    var uri = process.env.MONGODB_URI || 'mongodb://app_user:TruckPlatform%402024%21Mongo@mongodb:27017/truck_platform?authSource=admin';
    _mongoClient = new MongoClient(uri);
    await _mongoClient.connect();
  }
  return _mongoClient.db('truck_platform');
}

app.get('/api/v1/admin/social-posts', async (req, res) => {
  try {
    var db = await getMongoDb();
    var col = db.collection('social_posts');
    var status = req.query.status;
    var filter = status && status !== 'all' ? { status: status } : {};
    var posts = await col.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ success: true, data: { posts: posts, total: posts.length } });
  } catch(err) {
    console.error('[admin/social-posts GET]', err.message);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.put('/api/v1/admin/social-posts/:postId/approve', async (req, res) => {
  try {
    var db = await getMongoDb();
    var { ObjectId } = require('mongodb');
    var col = db.collection('social_posts');
    var id = req.params.postId;
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'published', approvedBy: req.headers['x-user-id'], approvedAt: new Date(), publishedAt: new Date() } }
    );
    res.json({ success: true, data: { message: 'Post approved and published' } });
  } catch(err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

app.put('/api/v1/admin/social-posts/:postId/reject', async (req, res) => {
  try {
    var db = await getMongoDb();
    var { ObjectId } = require('mongodb');
    var col = db.collection('social_posts');
    var id = req.params.postId;
    var reason = (req.body || {}).reason || 'Rejected by admin';
    await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'rejected', rejectionReason: reason, rejectedAt: new Date() } }
    );
    res.json({ success: true, data: { message: 'Post rejected' } });
  } catch(err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
`;

  var notFoundIdx2 = src.indexOf("app.use((_req, res) => {");
  if (notFoundIdx2 < 0) notFoundIdx2 = src.length;
  src = src.slice(0, notFoundIdx2) + socialRoute + '\n' + src.slice(notFoundIdx2);
  console.log('[ok] /admin/social-posts endpoints added');
} else {
  console.log('[skip] /admin/social-posts already patched');
}

// ─── 3. Check pool import ─────────────────────────────────────────────────────
// The loads route uses require('/app/dist/db/pool') — check if it exists
var poolPath = '/app/dist/db/pool.js';
if (!require('fs').existsSync(poolPath)) {
  // Try to find the pool
  var poolFiles = require('child_process').execSync('find /app/dist -name "pool*" -o -name "database*" 2>/dev/null').toString().trim().split('\n');
  console.log('[warn] pool.js not at expected path. Found:', poolFiles.join(', '));
  // Update the require path in the new route
  if (poolFiles[0] && poolFiles[0].trim()) {
    src = src.replace("require('/app/dist/db/pool')", "require('" + poolFiles[0].trim() + "')");
    console.log('[ok] Updated pool require path to:', poolFiles[0].trim());
  }
}

fs.writeFileSync('/app/dist/app.js', src);
console.log('[ok] app.js patched and saved (' + src.length + ' chars)');
