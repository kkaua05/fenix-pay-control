// Minimal Express app for Vercel debugging
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Vercel function is working!',
    node: process.version,
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
      vercel: !!process.env.VERCEL
    }
  });
});

module.exports = app;