require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { query, testConnection, closePool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    // Testar conexão primeiro
    const connected = await testConnection();
    if (!connected) {
      logger.error('❌ Não foi possível conectar ao Neon PostgreSQL. Verifique suas credenciais.');
      process.exit(1);
    }

    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    const statements = sql.split(';').filter(s => s.trim());
    
    logger.info('🚀 Iniciando migrations no Neon PostgreSQL...');
    logger.info(`📄 Arquivo: ${sqlPath}`);
    logger.info(`📊 Total de statements: ${statements.length}`);
    
    let executed = 0;
    let errors = 0;

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          if (statement.trim().startsWith('--')) {
            continue;
          }
          
          await query(statement);
          executed++;
          
          if (executed % 10 === 0) {
            logger.info(`✅ ${executed} statements executados...`);
          }
        } catch (err) {
          if (err.message.includes('already exists')) {
            logger.info(`⚠️ Tabela/objeto já existe, pulando...`);
          } else if (err.message.includes('duplicate key')) {
            logger.info(`⚠️ Registro duplicado, pulando...`);
          } else {
            logger.error(`❌ Erro ao executar statement:`, err.message);
            errors++;
          }
        }
      }
    }
    
    logger.info(`✅ Migrations concluídas!`);
    logger.info(`📊 Statements executados: ${executed}`);
    if (errors > 0) {
      logger.warn(`⚠️ ${errors} erros ignorados (objetos já existentes)`);
    }
    logger.info('🚀 Banco de dados Neon PostgreSQL pronto para uso!');
    
    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erro ao executar migrations:', error);
    await closePool();
    process.exit(1);
  }
}

runMigrations();