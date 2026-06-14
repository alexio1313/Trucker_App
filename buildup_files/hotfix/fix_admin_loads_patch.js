// Fix the pool require path in admin service app.js
var fs = require('fs');
var src = fs.readFileSync('/app/dist/app.js', 'utf8');

// Fix pool path
src = src.replace(/require\('\/app\/dist\/db\/pool'\)/g, "require('/app/dist/db/postgres')");
console.log('[ok] Fixed pool require to use postgres.js');

// Also check what postgres.js exports — if it's a Pool or a query function
var pgSrc = fs.readFileSync('/app/dist/db/postgres.js', 'utf8');
console.log('[info] postgres.js exports:', pgSrc.slice(-300));

fs.writeFileSync('/app/dist/app.js', src);
console.log('[ok] app.js updated');
