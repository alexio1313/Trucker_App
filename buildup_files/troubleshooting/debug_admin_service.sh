#!/bin/bash
echo "=== Admin service recent logs ==="
docker logs truck_admin_service --tail=50 2>&1

echo ""
echo "=== Test disputes route directly inside container ==="
docker exec truck_admin_service node -e "
const { query } = require('/app/dist/db/postgres');
query('SELECT dispute_id, status FROM disputes LIMIT 2').then(r => console.log('disputes:', JSON.stringify(r.rows))).catch(e => console.error('disputes err:', e.message));
" 2>&1 || true

echo ""
echo "=== Test loads route directly ==="
docker exec truck_admin_service node -e "
const { query } = require('/app/dist/db/postgres');
query('SELECT load_id, status FROM loads LIMIT 2').then(r => console.log('loads:', JSON.stringify(r.rows))).catch(e => console.error('loads err:', e.message));
" 2>&1 || true

echo ""
echo "=== Test MongoDB connection ==="
docker exec truck_admin_service node -e "
const { MongoClient } = require('mongodb');
const client = new MongoClient('mongodb://mongodb:27017/truck_platform', { auth: { username: 'app_user', password: 'TruckPlatform@2024!Mongo' }, authSource: 'admin', serverSelectionTimeoutMS: 5000 });
client.connect().then(() => { console.log('MongoDB OK'); return client.db('truck_platform').collection('social_posts').find({}).limit(2).toArray(); }).then(r => { console.log('posts:', r.length); client.close(); }).catch(e => { console.error('MongoDB err:', e.message); client.close(); });
" 2>&1 || true

echo ""
echo "=== Check patch lines in app.js (loads, disputes, social) ==="
docker exec truck_admin_service grep -n "admin/loads\|admin/social\|admin/disputes\|PATCH" /app/dist/app.js | head -20
