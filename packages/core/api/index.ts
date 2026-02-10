// Vercel Serverless Function
// Export Express app for Vercel runtime.
// Use src so Vercel bundles dependencies correctly.

// Import via ESM so this file can execute in Vitest/Vite environments where TS sources exist.
// (Vercel will compile TS on deploy.)
import appModule from '../src/index';

// Vercel expects a handler export
const app: any = (appModule as any)?.default ?? (appModule as any);
export default app;
module.exports = app;
