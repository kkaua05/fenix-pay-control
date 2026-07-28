require('dotenv').config();
const { query, closePool } = require('../config/database');
const logger = require('../utils/logger');

async function listUsers() {
  try {
    const result = await query(
      'SELECT id, nome, usuario, email, perfil, ativo, created_at FROM usuarios ORDER BY id'
    );

    if (result.rows.length === 0) {
      logger.info('📋 Nenhum usuário encontrado no sistema');
    } else {
      logger.info(`📋 Total de usuários: ${result.rows.length}`);
      console.log('\n');
      console.log('='.repeat(100));
      console.log('ID | Nome | Usuário | Email | Perfil | Ativo | Criado em');
      console.log('='.repeat(100));
      
      result.rows.forEach(u => {
        console.log(
          `${String(u.id).padEnd(4)} | ${u.nome.padEnd(20)} | ${u.usuario.padEnd(10)} | ${u.email.padEnd(25)} | ${u.perfil.padEnd(10)} | ${u.ativo ? '✅' : '❌'} | ${u.created_at}`
        );
      });
      console.log('='.repeat(100));
    }

    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erro ao listar usuários:', error);
    await closePool();
    process.exit(1);
  }
}

listUsers();