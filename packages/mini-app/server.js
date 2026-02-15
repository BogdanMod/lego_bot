/**
 * Production server for Mini App on Railway
 * Serves static files from dist/ with proper security headers for Telegram embedding
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
// Railway provides PORT via environment variable, must use it
// PORT is required by Railway, don't use fallback
const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = path.join(__dirname, 'dist');

// Validate PORT
if (!PORT || PORT < 1 || PORT > 65535) {
  console.error(`❌ Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

// Security headers for Telegram Mini App embedding
app.use((req, res, next) => {
  // Allow embedding in Telegram
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org"
  );
  // Don't set X-Frame-Options (conflicts with CSP frame-ancestors)
  
  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
});

// Health check endpoint (for Railway) - MUST be before SPA fallback
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mini-app', port: PORT, timestamp: Date.now() });
});

// Serve static files
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  immutable: true,
  etag: true,
}));

// SPA fallback: serve index.html for all routes (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), {
    maxAge: '0',
    etag: false,
  });
});

// Verify dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error(`❌ Dist directory not found: ${DIST_DIR}`);
  console.error(`   Current working directory: ${process.cwd()}`);
  console.error(`   __dirname: ${__dirname}`);
  process.exit(1);
}

const server = app.listen(PORT, '0.0.0.0', () => {
  const address = server.address();
  console.log(`🚀 Mini App server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving static files from: ${DIST_DIR}`);
  console.log(`✅ Server listening on port ${PORT} (from env: ${process.env.PORT || 'default'})`);
  console.log(`🌐 Health check available at http://0.0.0.0:${PORT}/health`);
  console.log(`📦 Dist directory exists: ${existsSync(DIST_DIR)}`);
  console.log(`🔍 Server address: ${JSON.stringify(address)}`);
  console.log(`✅ Server is ready to accept connections`);
  
  // Test that server is actually listening
  if (address && typeof address === 'object') {
    console.log(`✅ Verified: Server bound to ${address.address}:${address.port}`);
  }
});

// Handle errors
server.on('error', (error) => {
  console.error('❌ Server error occurred:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  }
  process.exit(1);
});

// Handle process signals for graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Keep process alive
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  // Don't exit - just log
});

