// Fix MongoDB connection in social service dist/db/mongo.js
var fs = require('fs');
var src = fs.readFileSync('/app/services/social-publishing/dist/db/mongo.js', 'utf8');
console.log('[info] Original mongo.js (last 400 chars):', src.slice(-400));

// Replace the MongoClient instantiation to use explicit auth
var newSrc = src.replace(
  'client = new mongodb_1.MongoClient(env_1.env.MONGODB_URI)',
  "client = new mongodb_1.MongoClient('mongodb://mongodb:27017/truck_platform', { auth: { username: 'app_user', password: 'TruckPlatform@2024!Mongo' }, authSource: 'admin' })"
);

if (newSrc === src) {
  // Try alternate pattern
  newSrc = src.replace(
    /client\s*=\s*new\s+mongodb_1\.MongoClient\s*\([^)]+\)/,
    "client = new mongodb_1.MongoClient('mongodb://mongodb:27017/truck_platform', { auth: { username: 'app_user', password: 'TruckPlatform@2024!Mongo' }, authSource: 'admin' })"
  );
}

if (newSrc !== src) {
  fs.writeFileSync('/app/services/social-publishing/dist/db/mongo.js', newSrc);
  console.log('[ok] Fixed MongoDB connection in social service mongo.js');
} else {
  console.log('[error] Could not find MongoClient pattern to replace');
  console.log('[debug] Source snippet:', src.slice(src.indexOf('MongoClient') - 20, src.indexOf('MongoClient') + 100));
}
