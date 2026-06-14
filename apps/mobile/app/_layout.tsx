import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { initApiClient } from '../src/lib/api';
import { useAuthStore } from '@truck-platform/state';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 2 },
    mutations: { retry: 0 },
  },
});

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000/api/v1';

export default function RootLayout() {
  useEffect(() => {
    initApiClient(API_BASE_URL);
    // Restore token from persisted storage on mount
    const { accessToken, setTokens, user } = useAuthStore.getState();
    if (accessToken && user) {
      // Token already restored by zustand persist middleware
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
