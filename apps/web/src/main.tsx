import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { configureApiClient } from '@truck-platform/api-client';
import { useAuthStore } from '@truck-platform/state';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 2 },
    mutations: { retry: 0 },
  },
});

configureApiClient({
  baseURL: import.meta.env['VITE_API_URL'] ?? '/api/v1',
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshToken: () => useAuthStore.getState().refreshAccessToken(),
  onUnauthorized: () => { useAuthStore.getState().logout(); window.location.href = '/login'; },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
