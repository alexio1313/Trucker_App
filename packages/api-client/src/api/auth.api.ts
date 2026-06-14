import { apiClient } from '../axios.instance';
import {
  ApiResponse,
  AuthTokens,
  LoginInput,
  RegisterInput,
  User,
  KYCSubmission,
} from '@truck-platform/shared';
import { ENDPOINTS } from '@truck-platform/shared';

export const authApi = {
  register(input: RegisterInput): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post(ENDPOINTS.AUTH.REGISTER, input).then((r) => r.data);
  },

  login(input: LoginInput): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post(ENDPOINTS.AUTH.LOGIN, input).then((r) => r.data);
  },

  sendOtp(phoneNumber: string): Promise<ApiResponse<{ expiresIn: number }>> {
    return apiClient.post(ENDPOINTS.AUTH.SEND_OTP, { phoneNumber }).then((r) => r.data);
  },

  verifyOtp(phoneNumber: string, otp: string): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post(ENDPOINTS.AUTH.VERIFY_OTP, { phoneNumber, otp }).then((r) => r.data);
  },

  refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; expiresIn: number }>> {
    return apiClient.post(ENDPOINTS.AUTH.REFRESH, { refreshToken }).then((r) => r.data);
  },

  logout(): Promise<ApiResponse<null>> {
    return apiClient.post(ENDPOINTS.AUTH.LOGOUT).then((r) => r.data);
  },

  me(): Promise<ApiResponse<User>> {
    return apiClient.get(ENDPOINTS.AUTH.ME).then((r) => r.data);
  },

  submitKyc(submission: KYCSubmission): Promise<ApiResponse<{ kycId: string }>> {
    return apiClient.post(ENDPOINTS.KYC.SUBMIT, submission).then((r) => r.data);
  },

  getKycUploadUrl(
    docType: string,
    side: 'front' | 'back',
  ): Promise<ApiResponse<{ signedUrl: string; key: string }>> {
    return apiClient.post(ENDPOINTS.KYC.UPLOAD_URL, { docType, side }).then((r) => r.data);
  },
};
