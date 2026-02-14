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
const PORT = process.env.PORT || 5174;
const DIST_DIR = path.join(__dirname, 'dist');

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mini App server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving static files from: ${DIST_DIR}`);
});

