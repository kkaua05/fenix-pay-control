const app = require('./src/app');
const logger = require('./src/utils/logger');

const isVercel = !!process.env.VERCEL;

// Startup - non-blocking, just for local dev
async function startServer() {
  try {
    const { testConnection } = require('./src/config/database');
    const connected = await testConnection();
    logger.info(`📊 Conexão DB: ${connected ? 'OK' : 'FALHOU'}`);
  } catch (error) {
    logger.warn('⚠️ Erro ao testar DB (serverless ignorado):', error.message);
  }
}

// Only start server locally, not on Vercel
if (!isVercel) {
  (async () => {
    await startServer();
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
    });
    try {
      const { initializeSocket } = require('./src/services/socketService');
      initializeSocket(server);
    } catch (e) {
      logger.warn('Socket.IO ignorado');
    }
  })();
}

// Vercel: export the app directly (no process.exit, no blocking)
module.exports = app;