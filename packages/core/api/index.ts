// Vercel Serverless Function
// Export Express app for Vercel runtime.
// Use src so Vercel bundles dependencies correctly.
// @ts-ignore - src files may not have runtime types
const app = require('../src/index').default || require('../src/index');

// Vercel expects a handler export
module.exports = app;
