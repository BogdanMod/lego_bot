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
  const logMsg = `[${timestamp}] [HEALTH] Health check requested from ${req.ip || 'unknown'}, User-Agent: ${req.headers['user-agent'] || 'unknown'}`;
  console.log(logMsg);
  process.stdout.write(`${logMsg}\n`);
  
  res.status(200).json({ 
    ok: true, 
    service: 'mini-app', 
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

// Serve static files with proper caching
// Vite generates files with content hashes (e.g., index-abc123.js)
// These files can be cached forever since hash changes on content change
// But we need to ensure index.html is never cached
app.use(express.static(DIST_DIR, {
  maxAge: (req) => {
    // Assets with hashes (JS/CSS from Vite) can be cached for 1 year
    if (req.path.match(/\/assets\/.*-[a-f0-9]+\.(js|css|woff2?|png|jpg|svg)$/i)) {
      return '1y';
    }
    // All other files (including index.html) should not be cached
    return '0';
  },
  immutable: (req) => {
    // Only mark hashed assets as immutable
    return !!req.path.match(/\/assets\/.*-[a-f0-9]+\.(js|css)$/i);
  },
  etag: true,
  lastModified: true,
}));

// SPA fallback: serve index.html for all routes (must be last)
app.get('*', (req, res, next) => {
  const filePath = path.join(DIST_DIR, 'index.html');
  
  // Check if file exists before sending
  if (!existsSync(filePath)) {
    console.error(`[SPA] index.html not found at ${filePath}`);
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  
  // Force no-cache for index.html to ensure fresh JS/CSS references
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('ETag', '');
  
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
console.log('[MINI-APP] Starting server...');
console.log(`[MINI-APP] PORT=${PORT}, NODE_ENV=${process.env.NODE_ENV || 'not set'}`);
console.log(`[MINI-APP] DIST_DIR=${DIST_DIR}`);
console.log(`[MINI-APP] CWD=${process.cwd()}`);

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

