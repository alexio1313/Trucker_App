import { configureApiClient } from '@truck-platform/api-client';
import { useAuthStore } from '@truck-platform/state';

export function initApiClient(baseURL: string): void {
  configureApiClient({
    baseURL,
    getAccessToken: () => useAuthStore.getState().accessToken,
    refreshToken: () => useAuthStore.getState().refreshAccessToken(),
    onUnauthorized: () => useAuthStore.getState().logout(),
  });
}
