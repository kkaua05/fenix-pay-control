// ============================================================
// Vercel Serverless Entry Point
// ============================================================
// This file is the entry point for Vercel serverless functions.
// It avoids module-level side effects that crash serverless.

const app = require('../src/app');

module.exports = app;