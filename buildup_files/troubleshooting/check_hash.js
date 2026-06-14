const hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMmHXvPrR1N7UY5gJpBJhJHiEy';
const passwords = ['Admin@123', 'admin@123', 'Admin123', 'TruckQA@2024', 'password'];
const b = require('/app/node_modules/bcryptjs');
Promise.all(passwords.map(p => b.compare(p, hash).then(r => ({ p, r }))))
  .then(results => results.forEach(({p, r}) => console.log(r ? 'MATCH: ' + p : '  no: ' + p)));
