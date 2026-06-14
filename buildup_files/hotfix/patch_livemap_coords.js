// Patch: add load origin/dest lat-lng to live-positions so frontend can draw routes
const fs = require('fs');
const path = '/app/dist/trucker.intel.routes.js';
let src = fs.readFileSync(path, 'utf8');

const OLD = `        l.load_id,
        l.origin_city,
        l.dest_city,
        l.status AS load_status,
        COALESCE(l.distance_km, 0)::float AS distance_km,
        COALESCE(l.agreed_price, 0)::float AS agreed_price`;

const NEW = `        l.load_id,
        l.origin_city,
        l.dest_city,
        l.status AS load_status,
        COALESCE(l.distance_km, 0)::float AS distance_km,
        COALESCE(l.agreed_price, 0)::float AS agreed_price,
        l.origin_lat::float AS load_origin_lat,
        l.origin_lng::float AS load_origin_lng,
        l.dest_lat::float AS load_dest_lat,
        l.dest_lng::float AS load_dest_lng`;

if (!src.includes('l.origin_city')) { console.error('Pattern not found'); process.exit(1); }
const patched = src.replace(OLD, NEW);
fs.writeFileSync(path, patched, 'utf8');
console.log('Patched live-positions: added load origin/dest coords');
