const app = require('./src/app');
const logger = require('./src/utils/logger');
const { testConnection } = require('./src/config/database');
const { initializeSocket } = require('./src/services/socketService');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    logger.info('🔍 Verificando conexão com o banco de dados...');
    const connected = await testConnection();
    
    if (!connected) {
      logger.error('❌ Não foi possível conectar ao banco de dados.');
      process.exit(1);
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor Fênix Pay Control rodando na porta ${PORT}`);
      logger.info(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 http://localhost:${PORT}`);
    });

    // Inicializar Socket.IO
    initializeSocket(server);
    logger.info('🔌 WebSocket inicializado com sucesso!');

  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();