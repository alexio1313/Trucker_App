import { Request, Response } from 'express';
import {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
} from './auth.schemas';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  sendOtp,
  verifyOtpAndLogin,
} from './auth.service';
import { logger } from '../logger';

export async function handleRegister(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
    return;
  }
  try {
    const result = await registerUser(parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    const code = (err as Error).message;
    if (code === 'PHONE_ALREADY_REGISTERED') {
      res.status(409).json({ success: false, error: { code, message: 'Phone number already registered' } });
    } else {
      logger.error('Register error', { error: code });
      res.status(500).json({ success: false, error: { code: 'REGISTER_FAILED', message: 'Registration failed' } });
    }
  }
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    return;
  }
  try {
    const result = await loginUser({ phoneNumber: parsed.data.phoneNumber, password: parsed.data.password! });
    res.json({ success: true, data: result });
  } catch (err) {
    const code = (err as Error).message;
    const map: Record<string, [number, string]> = {
      INVALID_CREDENTIALS: [401, 'Invalid phone number or password'],
      ACCOUNT_SUSPENDED: [403, 'Account is suspended'],
    };
    const [status, message] = map[code] ?? [500, 'Login failed'];
    res.status(status).json({ success: false, error: { code, message } });
  }
}

export async function handleSendOtp(req: Request, res: Response): Promise<void> {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid Indian phone number required' } });
    return;
  }
  const expiresIn = await sendOtp(parsed.data.phoneNumber);
  res.json({ success: true, data: { expiresIn } });
}

export async function handleVerifyOtp(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    return;
  }
  try {
    const result = await verifyOtpAndLogin(parsed.data.phoneNumber, parsed.data.otp);
    res.json({ success: true, data: result });
  } catch (err) {
    const code = (err as Error).message;
    const map: Record<string, [number, string]> = {
      INVALID_OTP: [401, 'Invalid or expired OTP'],
      USER_NOT_FOUND: [404, 'User not found'],
    };
    const [status, message] = map[code] ?? [500, 'OTP verification failed'];
    res.status(status).json({ success: false, error: { code, message } });
  }
}

export async function handleRefreshToken(req: Request, res: Response): Promise<void> {
  const parsed = refreshTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Refresh token required' } });
    return;
  }
  try {
    const result = await refreshAccessToken(parsed.data.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    const code = (err as Error).message;
    res.status(401).json({ success: false, error: { code, message: 'Invalid or reused refresh token' } });
  }
}

export async function handleLogout(req: Request, res: Response): Promise<void> {
  const userId = req.headers['x-user-id'] as string;
  const token = req.headers.authorization?.slice(7) ?? '';
  await logoutUser(userId, token);
  res.json({ success: true, data: null });
}

export async function handleMe(req: Request, res: Response): Promise<void> {
  const userId = req.headers['x-user-id'] as string;
  const { queryOne: qOne } = await import('../db/postgres');
  const user = await qOne('SELECT * FROM users WHERE user_id = $1', [userId]);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  res.json({ success: true, data: user });
}
