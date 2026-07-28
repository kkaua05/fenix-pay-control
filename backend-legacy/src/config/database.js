const { Pool } = require('pg');
const logger = require('../utils/logger');

// Configuração do pool de conexões
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  logger.info('📊 Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  logger.error('❌ Erro no PostgreSQL:', err);
});

// Função de query com tratamento de erro
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Query: ${text.substring(0, 100)}... - ${duration}ms`);
    }
    return res;
  } catch (error) {
    logger.error('❌ Erro na query:', { 
      text: text.substring(0, 200), 
      params, 
      error: error.message,
      code: error.code
    });
    throw error;
  }
};

// Função para testar conexão
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    logger.info('✅ Conexão com PostgreSQL estabelecida com sucesso!');
    logger.info(`📊 Versão: ${result.rows[0].version}`);
    return true;
  } catch (error) {
    logger.error('❌ Falha ao conectar ao PostgreSQL:', error.message);
    return false;
  }
};

module.exports = { 
  pool, 
  query, 
  testConnection
};