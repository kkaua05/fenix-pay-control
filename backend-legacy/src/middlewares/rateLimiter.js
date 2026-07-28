const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: true,
    message: 'Muitas requisições. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: true,
    message: 'Muitas tentativas de login. Tente novamente em 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { limiter, authLimiter };