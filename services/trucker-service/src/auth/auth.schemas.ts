import { z } from 'zod';

export const registerSchema = z.object({
  userType: z.enum(['merchant', 'trucker']),
  fullName: z.string().min(2).max(100),
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian mobile number (+91XXXXXXXXXX)'),
  email: z.string().email().optional(),
  password: z.string().min(8).max(72),
  gstNumber: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional(),
  companyName: z.string().min(2).max(200).optional(),
});

export const loginSchema = z.object({
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/),
  password: z.string().min(1).optional(),
  otp: z.string().length(6).optional(),
}).refine((data) => data.password || data.otp, {
  message: 'Either password or OTP is required',
});

export const sendOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/),
});

export const verifyOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/),
  otp: z.string().length(6),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
