// Fix MongoDB connection in admin service to handle @ in password
var fs = require('fs');
var src = fs.readFileSync('/app/dist/app.js', 'utf8');

// Replace the broken getMongoDb function with one that uses explicit credentials
var oldFn = `var _mongoClient = null;
async function getMongoDb() {
  if (!_mongoClient || !_mongoClient.topology || !_mongoClient.topology.isConnected()) {
    var { MongoClient } = require('mongodb');
    var uri = process.env.MONGODB_URI || 'mongodb://app_user:TruckPlatform%402024%21Mongo@mongodb:27017/truck_platform?authSource=admin';
    _mongoClient = new MongoClient(uri);
    await _mongoClient.connect();
  }
  return _mongoClient.db('truck_platform');
}`;

var newFn = `var _mongoClient = null;
async function getMongoDb() {
  if (!_mongoClient) {
    var { MongoClient } = require('mongodb');
    // Use explicit credentials to avoid URI encoding issues with @ in password
    _mongoClient = new MongoClient('mongodb://mongodb:27017/truck_platform', {
      auth: { username: 'app_user', password: 'TruckPlatform@2024!Mongo' },
      authSource: 'admin'
    });
    await _mongoClient.connect();
  }
  return _mongoClient.db('truck_platform');
}`;

if (src.indexOf(oldFn) > -1) {
  src = src.replace(oldFn, newFn);
  console.log('[ok] Fixed MongoDB connection to use explicit credentials');
} else {
  // Try partial match
  var idx = src.indexOf('async function getMongoDb()');
  if (idx > -1) {
    var endIdx = src.indexOf('\n}', idx) + 2;
    src = src.slice(0, idx) + newFn + src.slice(endIdx);
    console.log('[ok] Replaced getMongoDb function (partial match)');
  } else {
    console.log('[warn] Could not find getMongoDb function to replace');
  }
}

fs.writeFileSync('/app/dist/app.js', src);
console.log('[ok] app.js saved');
