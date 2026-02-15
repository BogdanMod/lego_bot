/**
 * Production server for Mini App on Railway
 * Serves static files from dist/ with proper security headers for Telegram embedding
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

// Serve static files
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  immutable: true,
  etag: true,
}));

// SPA fallback: serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), {
    maxAge: '0',
    etag: false,
  });
});

// Health check endpoint (for Railway)
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mini-app', port: PORT, timestamp: Date.now() });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mini App server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving static files from: ${DIST_DIR}`);
  console.log(`✅ Server listening on port ${PORT} (from env: ${process.env.PORT || 'default'})`);
  console.log(`🌐 Health check available at http://0.0.0.0:${PORT}/health`);
});

// Handle errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

