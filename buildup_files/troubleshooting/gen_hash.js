const bcrypt = require('/app/node_modules/bcryptjs');
bcrypt.hash('Admin@123', 10).then(h => {
  console.log('HASH:' + h);
  return bcrypt.compare('Admin@123', h);
}).then(ok => console.log('VERIFY:' + ok));
