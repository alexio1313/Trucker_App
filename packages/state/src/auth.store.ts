import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { User, AuthTokens } from '@truck-platform/shared';
import { authApi, setAccessToken } from '@truck-platform/api-client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login(phoneNumber: string, password: string): Promise<void>;
  loginWithOtp(phoneNumber: string, otp: string): Promise<void>;
  sendOtp(phoneNumber: string): Promise<{ expiresIn: number }>;
  logout(): Promise<void>;
  refreshAccessToken(): Promise<string>;
  setTokens(tokens: AuthTokens): void;
  clearError(): void;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    immer((set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setTokens(tokens: AuthTokens) {
        set((state) => {
          state.user = tokens.user;
          state.accessToken = tokens.accessToken;
          state.refreshToken = tokens.refreshToken;
          state.isAuthenticated = true;
        });
        setAccessToken(tokens.accessToken);
      },

      async sendOtp(phoneNumber) {
        set((state) => { state.isLoading = true; state.error = null; });
        try {
          const res = await authApi.sendOtp(phoneNumber);
          return res.data;
        } finally {
          set((state) => { state.isLoading = false; });
        }
      },

      async login(phoneNumber, password) {
        set((state) => { state.isLoading = true; state.error = null; });
        try {
          const res = await authApi.login({ phoneNumber, password });
          get().setTokens(res.data);
        } catch (err: unknown) {
          const message = (err as { error?: { message?: string } })?.error?.message ?? 'Login failed';
          set((state) => { state.error = message; });
          throw err;
        } finally {
          set((state) => { state.isLoading = false; });
        }
      },

      async loginWithOtp(phoneNumber, otp) {
        set((state) => { state.isLoading = true; state.error = null; });
        try {
          const res = await authApi.verifyOtp(phoneNumber, otp);
          get().setTokens(res.data);
        } catch (err: unknown) {
          const message = (err as { error?: { message?: string } })?.error?.message ?? 'OTP verification failed';
          set((state) => { state.error = message; });
          throw err;
        } finally {
          set((state) => { state.isLoading = false; });
        }
      },

      async logout() {
        try {
          await authApi.logout();
        } finally {
          set((state) => {
            state.user = null;
            state.accessToken = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
          });
          setAccessToken(null);
        }
      },

      async refreshAccessToken() {
        const currentRefreshToken = get().refreshToken;
        if (!currentRefreshToken) throw new Error('No refresh token');
        const res = await authApi.refreshToken(currentRefreshToken);
        set((state) => { state.accessToken = res.data.accessToken; });
        setAccessToken(res.data.accessToken);
        return res.data.accessToken;
      },

      clearError() {
        set((state) => { state.error = null; });
      },
    })),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
