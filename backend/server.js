const app = require('./src/app');
const logger = require('./src/utils/logger');

// For Vercel serverless - just export app
// Do NOT process.exit() - it kills serverless functions
const isVercel = !!process.env.VERCEL;

async function startServer() {
  try {
    logger.info('🔍 Verificando conexão com o banco de dados...');
    const { testConnection } = require('./src/config/database');
    const connected = await testConnection();
    
    if (!connected) {
      logger.error('❌ Não foi possível conectar ao banco de dados.');
      if (!isVercel) process.exit(1);
      return;
    }

    if (!isVercel) {
      const PORT = process.env.PORT || 5000;
      const server = app.listen(PORT, () => {
        logger.info(`🚀 Servidor Fênix Pay Control rodando na porta ${PORT}`);
        logger.info(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`🔗 http://localhost:${PORT}`);
      });

      // Inicializar Socket.IO (apenas local)
      try {
        const { initializeSocket } = require('./src/services/socketService');
        initializeSocket(server);
        logger.info('🔌 WebSocket inicializado com sucesso!');
      } catch (socketError) {
        logger.warn('⚠️ WebSocket nao disponivel em serverless');
      }
    } else {
      logger.info('🚀 Rodando em modo serverless (Vercel)');
    }

  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    if (!isVercel) process.exit(1);
  }
}

startServer();

// Export for Vercel serverless
module.exports = app;