"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.refreshAccessToken = refreshAccessToken;
exports.logoutUser = logoutUser;
exports.sendOtp = sendOtp;
exports.verifyOtpAndLogin = verifyOtpAndLogin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("redis");
const postgres_1 = require("../db/postgres");
const env_1 = require("../config/env");
const logger_1 = require("../logger");
let redisClient = null;
async function getRedis() {
    if (!redisClient) {
        redisClient = (0, redis_1.createClient)({ url: env_1.env.REDIS_URL });
        await redisClient.connect();
    }
    return redisClient;
}
function generateAccessToken(userId, userType) {
    return jsonwebtoken_1.default.sign({ userId, userType }, env_1.env.JWT_ACCESS_SECRET, {
        expiresIn: env_1.env.JWT_ACCESS_EXPIRES_IN,
    });
}
function generateRefreshToken(userId) {
    return jsonwebtoken_1.default.sign({ userId }, env_1.env.JWT_REFRESH_SECRET, {
        expiresIn: env_1.env.JWT_REFRESH_EXPIRES_IN,
    });
}
// Map DB snake_case row to camelCase User interface expected by the frontend
function toUser(row) {
    return {
        userId: row.user_id,
        userType: row.user_type,
        fullName: row.full_name,
        email: row.email || null,
        phoneNumber: row.phone_number,
        kycStatus: row.kyc_status,
        kycDocFrontUrl: row.kyc_doc_front_url || null,
        kycDocBackUrl: row.kyc_doc_back_url || null,
        bankAccount: row.bank_account || null,
        gstNumber: row.gst_number || null,
        panNumber: row.pan_number || null,
        rating: row.rating || 0,
        totalRatings: row.total_ratings || 0,
        commissionRate: row.commission_rate || 0,
        isSuspended: row.is_suspended || false,
        suspendedUntil: row.suspended_until || null,
        suspensionReason: row.suspension_reason || null,
        fcmToken: row.fcm_token || null,
        lastLoginAt: row.last_login_at || null,
        profilePhotoUrl: row.profile_photo_url || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
async function registerUser(input) {
    const existing = await (0, postgres_1.queryOne)('SELECT user_id FROM users WHERE phone_number = $1', [input.phoneNumber]);
    if (existing)
        throw new Error('PHONE_ALREADY_REGISTERED');
    const passwordHash = await bcryptjs_1.default.hash(input.password, 12);
    const rows = await (0, postgres_1.query)(`INSERT INTO users (user_type, full_name, phone_number, email, password_hash, gst_number, kyc_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`, [input.userType, input.fullName, input.phoneNumber, input.email ?? null, passwordHash, input.gstNumber ?? null]);
    const user = rows[0];
    await (0, postgres_1.query)('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
    const accessToken = generateAccessToken(user.user_id, user.user_type);
    const refreshToken = generateRefreshToken(user.user_id);
    const redis = await getRedis();
    await redis.set(`refresh:${user.user_id}:${refreshToken.slice(-10)}`, refreshToken, { EX: 30 * 24 * 60 * 60 });
    logger_1.logger.info('User registered', { userId: user.user_id, userType: input.userType });
    return { accessToken, refreshToken, expiresIn: 900, user: toUser(user) };
}
async function loginUser(input) {
    const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE phone_number = $1', [input.phoneNumber]);
    if (!user)
        throw new Error('INVALID_CREDENTIALS');
    const passwordValid = await bcryptjs_1.default.compare(input.password, user.password_hash);
    if (!passwordValid)
        throw new Error('INVALID_CREDENTIALS');
    if (user.is_suspended) {
        if (!user.suspended_until || user.suspended_until > new Date()) {
            throw new Error('ACCOUNT_SUSPENDED');
        }
    }
    await (0, postgres_1.query)('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
    const accessToken = generateAccessToken(user.user_id, user.user_type);
    const refreshToken = generateRefreshToken(user.user_id);
    const redis = await getRedis();
    await redis.set(`refresh:${user.user_id}:${refreshToken.slice(-10)}`, refreshToken, { EX: 30 * 24 * 60 * 60 });
    logger_1.logger.info('User logged in', { userId: user.user_id });
    return { accessToken, refreshToken, expiresIn: 900, user: toUser(user) };
}
async function refreshAccessToken(refreshToken) {
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(refreshToken, env_1.env.JWT_REFRESH_SECRET);
    }
    catch {
        throw new Error('INVALID_REFRESH_TOKEN');
    }
    const redis = await getRedis();
    const stored = await redis.get(`refresh:${payload.userId}:${refreshToken.slice(-10)}`);
    if (!stored || stored !== refreshToken)
        throw new Error('REFRESH_TOKEN_REUSED');
    const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE user_id = $1', [payload.userId]);
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const newAccessToken = generateAccessToken(user.user_id, user.user_type);
    return { accessToken: newAccessToken, expiresIn: 900 };
}
async function logoutUser(userId, accessToken) {
    const redis = await getRedis();
    await redis.set(`blacklist:${accessToken}`, '1', { EX: 900 });
    const keys = await redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
        await redis.del(keys);
    }
    logger_1.logger.info('User logged out', { userId });
}
async function sendOtp(phoneNumber) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redis = await getRedis();
    await redis.set(`otp:${phoneNumber}`, otp, { EX: 300 });
    logger_1.logger.info('OTP generated', { phoneNumber, otp: env_1.env.NODE_ENV === 'development' ? otp : '[REDACTED]' });
    return 300;
}
async function verifyOtpAndLogin(phoneNumber, otp) {
    const redis = await getRedis();
    const stored = await redis.get(`otp:${phoneNumber}`);
    if (!stored || stored !== otp)
        throw new Error('INVALID_OTP');
    await redis.del(`otp:${phoneNumber}`);
    const user = await (0, postgres_1.queryOne)('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
    if (!user)
        throw new Error('USER_NOT_FOUND');
    const accessToken = generateAccessToken(user.user_id, user.user_type);
    const refreshToken = generateRefreshToken(user.user_id);
    await redis.set(`refresh:${user.user_id}:${refreshToken.slice(-10)}`, refreshToken, { EX: 30 * 24 * 60 * 60 });
    await (0, postgres_1.query)('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
    return { accessToken, refreshToken, expiresIn: 900, user: toUser(user) };
}
//# sourceMappingURL=auth.service.js.map
