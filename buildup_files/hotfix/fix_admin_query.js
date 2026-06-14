// Fix the loads endpoint to use the correct query pattern from postgres.js
// postgres.js exports: { pool, query, queryOne }
var fs = require('fs');
var src = fs.readFileSync('/app/dist/app.js', 'utf8');

// The current broken loads endpoint uses:
//   var pool = require('/app/dist/db/postgres');
//   var result = await pool.query(...)
//
// postgres.js exports a named 'query' function, not pool.query directly
// Fix: use require('/app/dist/db/postgres').query(text, params)

// Replace the broken loads route with a fixed version
var oldLoads = src.indexOf('// PATCH: Admin loads endpoint');
var newLoads = src.indexOf('// PATCH: Admin social-posts endpoints');

if (oldLoads === -1) {
  console.log('[error] Could not find loads patch marker');
  process.exit(1);
}

// Cut out old loads route
var beforeLoads = src.slice(0, oldLoads);
var afterLoads = newLoads > -1 ? src.slice(newLoads) : src.slice(src.indexOf('\n', oldLoads + 1000));

var fixedLoadsRoute = `// PATCH: Admin loads endpoint
app.get('/api/v1/admin/loads', async (req, res) => {
  try {
    var pgDb = require('/app/dist/db/postgres');
    var dbQuery = pgDb.query || function(t,p){ return pgDb.pool.query(t,p); };
    var page = parseInt(req.query.page) || 1;
    var limit = Math.min(parseInt(req.query.limit) || 50, 200);
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
      where.push('(l.origin_city ILIKE $' + pidx + ' OR l.dest_city ILIKE $' + pidx + ' OR l.load_id::text ILIKE $' + pidx + ')');
      params.push('%' + search + '%');
      pidx++;
    }

    var whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    var countParams = params.slice();
    params.push(limit);
    params.push(offset);

    var rows = await dbQuery(
      'SELECT l.*, um.full_name AS merchant_name, um.phone_number AS merchant_phone, ut.full_name AS trucker_name, ut.phone_number AS trucker_phone FROM loads l LEFT JOIN users um ON um.user_id = l.merchant_id LEFT JOIN users ut ON ut.user_id = l.trucker_id ' + whereClause + ' ORDER BY l.created_at DESC LIMIT $' + pidx + ' OFFSET $' + (pidx+1),
      params
    );

    var countRows = await dbQuery('SELECT COUNT(*) as cnt FROM loads l ' + whereClause, countParams);
    var total = parseInt((countRows[0]||{}).cnt || 0);

    res.json({
      success: true,
      data: {
        loads: rows,
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch(err) {
    console.error('[admin/loads]', err.message, err.stack);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});
`;

src = beforeLoads + fixedLoadsRoute + '\n' + afterLoads;
fs.writeFileSync('/app/dist/app.js', src);
console.log('[ok] Fixed loads route with correct postgres.js query pattern');
