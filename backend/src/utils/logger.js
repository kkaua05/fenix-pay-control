const winston = require('winston');
const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL;

// Criar diretório de logs se não existir (apenas local)
const logDir = path.join(__dirname, '../../logs');
if (!isVercel && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// On Vercel, only use console transport (no disk writes)
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// Only add file transports locally
if (!isVercel) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fenix-pay-control' },
  transports
});

module.exports = logger;