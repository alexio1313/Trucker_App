'use strict';
// Patches auth.service.js to strip password_hash from returned user objects
const fs = require('fs');
const AUTH = '/app/dist/auth/auth.service.js';
let src = fs.readFileSync(AUTH, 'utf8');

const MARKER = '// SAFE_USER_PATCHED';
if (src.includes(MARKER)) {
  console.log('Already patched');
  process.exit(0);
}

// Insert safeUser helper after the last export declaration block
const HELPER = `
${MARKER}
function safeUser(u) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
}
`;

// Add helper before registerUser function
src = src.replace('async function registerUser(input) {', HELPER + 'async function registerUser(input) {');

// Strip password_hash in registerUser return
src = src.replace(
  'return { accessToken, refreshToken, expiresIn: 900, user };',
  'return { accessToken, refreshToken, expiresIn: 900, user: safeUser(user) };'
);

// Strip in loginUser return (there's also a 'user' return there - replace the second occurrence)
// loginUser returns { accessToken, refreshToken, expiresIn: 900, user }
// We already replaced registerUser's return above; now replace loginUser's
const loginReturn = 'return { accessToken, refreshToken, expiresIn: 900, user: safeUser(user) };';
const verifyReturn = '    return { accessToken, refreshToken, expiresIn: 900, user };\n}';
src = src.replace(verifyReturn, `    return { accessToken, refreshToken, expiresIn: 900, user: safeUser(user) };\n}`);

fs.writeFileSync(AUTH, src);
console.log('auth.service.js patched — password_hash stripped from responses');
