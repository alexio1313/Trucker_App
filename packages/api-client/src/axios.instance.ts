import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiError } from '@truck-platform/shared';

let accessToken: string | null = null;
let onTokenRefresh: (() => Promise<string>) | null = null;
let onUnauthorized: (() => void) | null = null;

export function configureApiClient(options: {
  baseURL: string;
  getAccessToken: () => string | null;
  refreshToken: () => Promise<string>;
  onUnauthorized: () => void;
}): void {
  accessToken = options.getAccessToken();
  onTokenRefresh = options.refreshToken;
  onUnauthorized = options.onUnauthorized;
  apiClient.defaults.baseURL = options.baseURL;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export const apiClient: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && onTokenRefresh) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token) => {
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await onTokenRefresh();
        setAccessToken(newToken);
        refreshQueue.forEach((cb) => cb(newToken));
        refreshQueue = [];
        originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` };
        return apiClient(originalRequest);
      } catch {
        refreshQueue = [];
        onUnauthorized?.();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const apiErr: ApiError = {
      success: false,
      error: {
        code: error.response?.data?.error?.code ?? 'NETWORK_ERROR',
        message: error.response?.data?.error?.message ?? error.message,
        details: error.response?.data?.error?.details,
      },
      requestId: error.response?.data?.requestId,
    };

    return Promise.reject(apiErr);
  },
);
