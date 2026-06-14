import { Router } from 'express';
import {
  handleRegister,
  handleLogin,
  handleSendOtp,
  handleVerifyOtp,
  handleRefreshToken,
  handleLogout,
  handleMe,
} from './auth.controller';

const router = Router();

// Public
router.post('/register', handleRegister);
router.post('/login', handleLogin);
router.post('/send-otp', handleSendOtp);
router.post('/verify-otp', handleVerifyOtp);
router.post('/refresh', handleRefreshToken);

// Protected (x-user-id header set by api-gateway after JWT validation)
router.post('/logout', handleLogout);
router.get('/me', handleMe);

export { router as authRoutes };
