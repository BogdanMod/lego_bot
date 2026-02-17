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
// PORT is required by Railway (always injected), no fallback for production
// For local dev: set PORT=3000 in .env or export PORT=3000
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

// Request logging middleware (for debugging)
// Railway captures stdout/stderr, so console.log should work
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] [REQUEST] ${req.method} ${req.path} from ${req.ip || 'unknown'}`;
  console.log(logMsg);
  process.stdout.write(`${logMsg}\n`);
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseMsg = `[${new Date().toISOString()}] [RESPONSE] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`;
    console.log(responseMsg);
    process.stdout.write(`${responseMsg}\n`);
  });
  
  next();
});

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
// Railway uses this to verify the service is ready
app.get('/health', (req, res) => {
  const timestamp = new Date().toISOString();
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VITE_GIT_SHA ?? null;
  const logMsg = `[${timestamp}] [HEALTH] Health check requested from ${req.ip || 'unknown'}, User-Agent: ${req.headers['user-agent'] || 'unknown'}`;
  console.log(logMsg);
  process.stdout.write(`${logMsg}\n`);
  
  res.status(200).json({ 
    ok: true, 
    service: 'mini-app',
    gitSha,
    port: PORT,
    envPort: process.env.PORT,
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
});

// Root endpoint - Railway sometimes checks this for health
app.get('/', (req, res, next) => {
  // Log root requests for debugging
  const userAgent = req.headers['user-agent'] || 'unknown';
  const isRailwayHealthCheck = userAgent.includes('Railway') || req.query.health === 'true';
  
  if (isRailwayHealthCheck) {
    console.log(`[ROOT] Railway health check on root from ${req.ip || 'unknown'}`);
    return res.status(200).json({ ok: true, service: 'mini-app', health: 'ok', port: PORT });
  }
  
  console.log(`[ROOT] Root request from ${req.ip || 'unknown'}, User-Agent: ${userAgent}`);
  // Continue to SPA fallback (will serve index.html)
  next();
});

// Serve /assets with aggressive caching (immutable, max-age=1y)
// Vite generates files with content hashes, so these can be cached forever
// This ensures: Cache-Control: public, max-age=31536000, immutable
const assetsPath = path.join(DIST_DIR, 'assets');
if (existsSync(assetsPath)) {
  app.use(
    '/assets',
    express.static(assetsPath, {
      maxAge: '1y', // 31536000 seconds = 1 year
      immutable: true, // Mark as immutable for browsers
      etag: true,
      lastModified: true,
    }),
    // Fallback: if asset not found, log and return 404
    (req, res) => {
      const timestamp = new Date().toISOString();
      const logMsg = `[ASSETS] 404: Asset not found: ${req.path} (requested from ${req.get('referer') || 'direct'})`;
      console.error(logMsg);
      process.stdout.write(`${logMsg}\n`);
      res.status(404).json({ 
        error: 'Asset not found', 
        path: req.path,
        message: 'This asset file was likely removed after a new deployment. Please clear your browser cache and reload.',
      });
    }
  );
} else {
  console.warn(`[ASSETS] Assets directory not found at ${assetsPath}`);
}

// Serve other static files (like tonconnect-manifest.json, favicon, etc.) without caching
// Note: index.html is NOT served here - it's handled by SPA fallback with no-store
app.use(express.static(DIST_DIR, {
  maxAge: 0, // No caching
  etag: false,
  lastModified: false,
  // Exclude index.html from static serving (handled by SPA fallback)
  index: false,
}));

// SPA fallback: serve index.html for all routes (must be last)
// CRITICAL: ALWAYS with Cache-Control: no-store to prevent Telegram Web from caching
// This ensures desktop Telegram always gets fresh version, not stale cached one
app.get('*', (req, res) => {
  // Skip if this is an asset request (should be handled by /assets middleware)
  // This should never be reached if /assets middleware works correctly
  if (req.path.startsWith('/assets/')) {
    const timestamp = new Date().toISOString();
    const logMsg = `[SPA] Asset request reached SPA fallback (should not happen): ${req.path}`;
    console.error(logMsg);
    process.stdout.write(`${logMsg}\n`);
    return res.status(404).json({ 
      error: 'Asset not found', 
      path: req.path,
      message: 'Asset request should be handled by /assets middleware. This indicates a routing issue.',
    });
  }
  
  const filePath = path.join(DIST_DIR, 'index.html');
  
  // Check if file exists before sending
  if (!existsSync(filePath)) {
    console.error(`[SPA] index.html not found at ${filePath}`);
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  
  // CRITICAL: Force no-store for index.html
  // This is the key fix: Telegram Web caches index.html, causing stale versions
  // no-store tells browser AND Telegram Web to never cache this file
  // Using multiple headers to ensure all browsers and proxies respect this
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  // Remove ETag to prevent conditional requests that might serve cached version
  res.removeHeader('ETag');
  // Add version query param to force reload (if not already present)
  // This helps with aggressive browser caches
  if (!req.query.v) {
    const timestamp = Date.now();
    const logMsg = `[SPA] Serving index.html with no-cache headers, timestamp=${timestamp}`;
    console.log(logMsg);
    process.stdout.write(`${logMsg}\n`);
  }
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`[SPA] Error sending index.html:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
});

// Verify dist directory exists
if (!existsSync(DIST_DIR)) {
  console.error(`❌ Dist directory not found: ${DIST_DIR}`);
  console.error(`   Current working directory: ${process.cwd()}`);
  console.error(`   __dirname: ${__dirname}`);
  process.exit(1);
}

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error(`[ERROR] Unhandled error for ${req.method} ${req.path}:`, err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error', message: err?.message || String(err) });
  }
});

// Ensure logs go to stdout/stderr (Railway captures these)
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

// Log startup immediately
const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VITE_GIT_SHA ?? null;
console.log('[MINI-APP] Starting server...');
console.log(`[MINI-APP] PORT=${PORT}, NODE_ENV=${process.env.NODE_ENV || 'not set'}, gitSha=${gitSha || 'not set'}`);
console.log(`[MINI-APP] DIST_DIR=${DIST_DIR}`);
console.log(`[MINI-APP] CWD=${process.cwd()}`);
console.log(JSON.stringify({
  action: 'startup',
  service: 'mini-app',
  gitSha,
  port: PORT,
  timestamp: new Date().toISOString(),
}));

const server = app.listen(PORT, '0.0.0.0', () => {
  const address = server.address();
  
  // Use process.stdout.write for guaranteed output (Railway captures stdout)
  const log = (msg) => {
    console.log(msg);
    process.stdout.write(`${new Date().toISOString()} ${msg}\n`);
  };
  
  log(`🚀 Mini App server running on http://0.0.0.0:${PORT}`);
  log(`📁 Serving static files from: ${DIST_DIR}`);
  log(`✅ Server listening on port ${PORT} (from env: ${process.env.PORT})`);
  log(`🌐 Health check available at http://0.0.0.0:${PORT}/health`);
  log(`📦 Dist directory exists: ${existsSync(DIST_DIR)}`);
  log(`🔍 Server address: ${JSON.stringify(address)}`);
  log(`✅ Server is ready to accept connections`);
  
  // Test that server is actually listening
  if (address && typeof address === 'object') {
    log(`✅ Verified: Server bound to ${address.address}:${address.port}`);
  }
  
  // Log that we're ready for Railway
  log(`✅ Railway: Service is ready on port ${PORT}`);
  
  // Log a test request to verify logging works
  setTimeout(() => {
    log(`[MINI-APP] Server started successfully, ready for requests`);
  }, 100);
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

