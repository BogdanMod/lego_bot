import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production build, use compiled dist; in dev, use source
const isProduction = process.env.NODE_ENV === 'production';
const sharedBrowserPath = isProduction && existsSync(path.resolve(__dirname, '../shared/dist/browser.js'))
  ? path.resolve(__dirname, '../shared/dist/browser.js')
  : path.resolve(__dirname, '../shared/src/browser.ts');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@dialogue-constructor/shared/browser', replacement: sharedBrowserPath },
      { find: '@dialogue-constructor/shared/server', replacement: path.resolve(__dirname, './src/stubs/shared-server.ts') },
      { find: '@dialogue-constructor/shared', replacement: sharedBrowserPath },
    ],
    conditions: ['browser', 'module', 'import', 'default'],
  },
  optimizeDeps: {
    exclude: ['@dialogue-constructor/shared'],
    include: ['@dialogue-constructor/shared/browser'],
  },
  server: {
    port: 5174,
    host: true,
    allowedHosts: [
      '.up.railway.app',
      'localhost',
      '127.0.0.1',
    ],
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    host: true,
    allowedHosts: [
      '.up.railway.app',
      'localhost',
      '127.0.0.1',
    ],
  },
});

