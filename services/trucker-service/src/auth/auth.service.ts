import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { query, queryOne } from '../db/postgres';
import { env } from '../config/env';
import { logger } from '../logger';

interface DbUser {
  user_id: string;
  user_type: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  password_hash: string;
  kyc_status: string;
  rating: string;
  total_ratings: number;
  commission_rate: string;
  is_suspended: boolean;
  suspended_until: Date | null;
  suspension_reason: string | null;
  fcm_token: string | null;
  last_login_at: Date | null;
  profile_photo_url: string | null;
  gst_number: string | null;
  pan_number: string | null;
  created_at: Date;
  updated_at: Date;
}

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: env.REDIS_URL });
    await redisClient.connect();
  }
  return redisClient;
}

function generateAccessToken(userId: string, userType: string): string {
  return jwt.sign({ userId, userType }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function registerUser(input: {
  userType: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  gstNumber?: string;
  companyName?: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: DbUser }> {
  const existing = await queryOne<DbUser>(
    'SELECT user_id FROM users WHERE phone_number = $1',
    [input.phoneNumber],
  );
  if (existing) throw new Error('PHONE_ALREADY_REGISTERED');

  const passwordHash = await bcrypt.hash(input.password, 12);

  const rows = await query<DbUser>(
    `INSERT INTO users (user_type, full_name, phone_number, email, password_hash, gst_number, kyc_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
    [input.userType, input.fullName, input.phoneNumber, input.email ?? null, passwordHash, input.gstNumber ?? null],
  );
  const user = rows[0];

  await query(
    'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
    [user.user_id],
  );

  const accessToken = generateAccessToken(user.user_id, user.user_type);
  const refreshToken = generateRefreshToken(user.user_id);

  const redis = await getRedis();
  await redis.set(
    `refresh:${user.user_id}:${refreshToken.slice(-10)}`,
    refreshToken,
    { EX: 30 * 24 * 60 * 60 },
  );

  logger.info('User registered', { userId: user.user_id, userType: input.userType });
  return { accessToken, refreshToken, expiresIn: 900, user };
}

export async function loginUser(input: {
  phoneNumber: string;
  password: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: DbUser }> {
  const user = await queryOne<DbUser>(
    'SELECT * FROM users WHERE phone_number = $1',
    [input.phoneNumber],
  );
  if (!user) throw new Error('INVALID_CREDENTIALS');

  const passwordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordValid) throw new Error('INVALID_CREDENTIALS');

  if (user.is_suspended) {
    if (!user.suspended_until || user.suspended_until > new Date()) {
      throw new Error('ACCOUNT_SUSPENDED');
    }
  }

  await query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);

  const accessToken = generateAccessToken(user.user_id, user.user_type);
  const refreshToken = generateRefreshToken(user.user_id);

  const redis = await getRedis();
  await redis.set(
    `refresh:${user.user_id}:${refreshToken.slice(-10)}`,
    refreshToken,
    { EX: 30 * 24 * 60 * 60 },
  );

  logger.info('User logged in', { userId: user.user_id });
  return { accessToken, refreshToken, expiresIn: 900, user };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  let payload: { userId: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const redis = await getRedis();
  const stored = await redis.get(`refresh:${payload.userId}:${refreshToken.slice(-10)}`);
  if (!stored || stored !== refreshToken) throw new Error('REFRESH_TOKEN_REUSED');

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE user_id = $1', [payload.userId]);
  if (!user) throw new Error('USER_NOT_FOUND');

  const newAccessToken = generateAccessToken(user.user_id, user.user_type);
  return { accessToken: newAccessToken, expiresIn: 900 };
}

export async function logoutUser(userId: string, accessToken: string): Promise<void> {
  const redis = await getRedis();
  await redis.set(`blacklist:${accessToken}`, '1', { EX: 900 });
  const keys = await redis.keys(`refresh:${userId}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
  logger.info('User logged out', { userId });
}

export async function sendOtp(phoneNumber: string): Promise<number> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const redis = await getRedis();
  await redis.set(`otp:${phoneNumber}`, otp, { EX: 300 });
  // In production: send via Twilio SMS
  logger.info('OTP generated', { phoneNumber, otp: env.NODE_ENV === 'development' ? otp : '[REDACTED]' });
  return 300;
}

export async function verifyOtpAndLogin(
  phoneNumber: string,
  otp: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: DbUser }> {
  const redis = await getRedis();
  const stored = await redis.get(`otp:${phoneNumber}`);
  if (!stored || stored !== otp) throw new Error('INVALID_OTP');

  await redis.del(`otp:${phoneNumber}`);

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE phone_number = $1', [phoneNumber]);
  if (!user) throw new Error('USER_NOT_FOUND');

  const accessToken = generateAccessToken(user.user_id, user.user_type);
  const refreshToken = generateRefreshToken(user.user_id);

  await redis.set(
    `refresh:${user.user_id}:${refreshToken.slice(-10)}`,
    refreshToken,
    { EX: 30 * 24 * 60 * 60 },
  );

  await query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [user.user_id]);
  return { accessToken, refreshToken, expiresIn: 900, user };
}
