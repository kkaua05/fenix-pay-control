const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { testConnection, closePool } = require('../config/database');
const logger = require('../utils/logger');

async function testNeonConnection() {
  logger.info('🔍 Testando conexão com Neon PostgreSQL...');
  logger.info(`📊 DATABASE_URL: ${process.env.DATABASE_URL ? 'Configurada ✅' : 'Não configurada ❌'}`);
  
  if (process.env.DATABASE_URL) {
    // Mostrar parte da URL (ocultando credenciais)
    const url = process.env.DATABASE_URL;
    const maskedUrl = url.replace(/\/\/[^@]+@/, '//****:****@');
    logger.info(`🔗 URL: ${maskedUrl}`);
  }
  
  const connected = await testConnection();
  
  if (connected) {
    logger.info('✅ Conexão com Neon PostgreSQL estabelecida com sucesso!');
  } else {
    logger.error('❌ Falha na conexão com Neon PostgreSQL. Verifique suas credenciais.');
  }
  
  await closePool();
  process.exit(connected ? 0 : 1);
}

testNeonConnection();