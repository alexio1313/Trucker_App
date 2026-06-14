'use strict';
// Patches auth.service.js:
// 1. Strips password_hash from responses
// 2. Transforms snake_case DB fields -> camelCase to match frontend User type
const fs = require('fs');
const AUTH = '/app/dist/auth/auth.service.js';
let src = fs.readFileSync(AUTH, 'utf8');

// Remove previous patch if present
const MARKER = '// AUTH_SERVICE_PATCHED_V2';
if (src.includes(MARKER)) {
  // Remove old patch block
  src = src.replace(/\/\/ AUTH_SERVICE_PATCHED_V2[\s\S]*?function safeUser[\s\S]*?\}\n/, '');
}

const HELPER = `
${MARKER}
function safeUser(u) {
  if (!u) return u;
  return {
    userId: u.user_id,
    userType: u.user_type,
    fullName: u.full_name,
    email: u.email,
    phoneNumber: u.phone_number,
    kycStatus: u.kyc_status,
    kycDocFrontUrl: u.kyc_doc_front_url || null,
    kycDocBackUrl: u.kyc_doc_back_url || null,
    bankAccount: u.bank_account || null,
    gstNumber: u.gst_number || null,
    panNumber: u.pan_number || null,
    rating: parseFloat(u.rating || 5),
    totalRatings: u.total_ratings || 0,
    commissionRate: parseFloat(u.commission_rate || 5),
    isSuspended: u.is_suspended || false,
    suspendedUntil: u.suspended_until || null,
    suspensionReason: u.suspension_reason || null,
    fcmToken: u.fcm_token || null,
    lastLoginAt: u.last_login_at || null,
    profilePhotoUrl: u.profile_photo_url || null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    aadhaarVerified: u.aadhaar_verified || false,
    verificationStage: u.verification_stage || 1,
  };
}
`;

// Insert helper before registerUser
src = src.replace('async function registerUser(input) {', HELPER + 'async function registerUser(input) {');

// Wrap all return { ..., user } with safeUser
src = src.replace(/return \{ accessToken, refreshToken, expiresIn: 900, user \};/g,
  'return { accessToken, refreshToken, expiresIn: 900, user: safeUser(user) };');

fs.writeFileSync(AUTH, src);
console.log('auth.service.js patched — snake_case->camelCase + password_hash stripped');
