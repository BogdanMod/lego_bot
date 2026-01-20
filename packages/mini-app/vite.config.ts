import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@dialogue-constructor/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  optimizeDeps: {
    include: ['@dialogue-constructor/shared'],
  },
  server: {
    port: 5174,
    host: true,
  },
});

