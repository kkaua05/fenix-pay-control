const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Erro:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  const status = err.status || 500;
  const message = err.message || 'Erro interno do servidor';

  res.status(status).json({
    error: true,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;