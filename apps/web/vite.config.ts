import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@truck-platform/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@truck-platform/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@truck-platform/state': path.resolve(__dirname, '../../packages/state/src'),
      '@truck-platform/ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src'),
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
