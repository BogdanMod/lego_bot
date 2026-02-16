/**
 * Express server for serving frontend static files on Railway
 * Similar to mini-app/server.js
 */

const express = require('express');
const path = require('path');
const { existsSync } = require('fs');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : null;
const DIST_DIR = path.join(__dirname, 'dist');

// Validate PORT - Railway always sets it, so it must be present
if (!PORT || PORT < 1 || PORT > 65535) {
  console.error(`❌ PORT environment variable is required but not set or invalid`);
  console.error(`   Railway automatically sets PORT, but it's missing.`);
  console.error(`   For local dev, set PORT=3000 in .env or export PORT=3000`);
  console.error(`   Current PORT value: ${process.env.PORT || '(not set)'}`);
  process.exit(1);
}

// Check if dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error(`❌ Dist directory not found: ${DIST_DIR}`);
  console.error(`   Make sure to run 'pnpm build' before starting the server.`);
  process.exit(1);
}

// Health check endpoint (must be before static files)
app.get('/health', (req, res) => {
  console.log(`[HEALTH] Health check requested from ${req.ip || 'unknown'}, User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
  res.status(200).json({
    ok: true,
    service: 'frontend',
    port: PORT,
    envPort: process.env.PORT,
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// Serve static files from dist directory
app.use(express.static(DIST_DIR, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  const indexPath = path.join(DIST_DIR, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'index.html not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] Unhandled error for ${req.method} ${req.path}:`, err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message: err?.message || String(err) });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  const address = server.address();
  console.log(`🚀 Frontend server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving static files from: ${DIST_DIR}`);
  console.log(`✅ Server listening on port ${PORT} (from env: ${process.env.PORT || 'not set'})`);
  console.log(`🌐 Health check available at http://0.0.0.0:${PORT}/health`);
  console.log(`📦 Dist directory exists: ${existsSync(DIST_DIR)}`);
  console.log(`🔍 Server address: ${JSON.stringify(address)}`);
  console.log(`✅ Server is ready to accept connections`);
  // Test that server is actually listening
  if (address && typeof address === 'object') {
    console.log(`✅ Verified: Server bound to ${address.address}:${address.port}`);
  }
  // Log that we're ready for Railway
  console.log(`✅ Railway: Service is ready on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

