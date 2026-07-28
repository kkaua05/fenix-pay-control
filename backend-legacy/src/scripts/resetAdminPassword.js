const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const bcrypt = require('bcryptjs');
const { query, closePool } = require('../config/database');
const logger = require('../utils/logger');

async function resetAdminPassword() {
  try {
    const novaSenha = 'admin123';
    const hashedPassword = await bcrypt.hash(novaSenha, 10);

    // Verificar se o admin existe
    const adminExists = await query(
      'SELECT id, usuario FROM usuarios WHERE usuario = $1',
      ['admin']
    );

    if (adminExists.rows.length === 0) {
      // Criar admin se não existir
      await query(
        `INSERT INTO usuarios (nome, usuario, email, senha, perfil, ativo) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Administrador', 'admin', 'admin@fenix.com', hashedPassword, 'ADMIN', true]
      );
      logger.info('✅ Usuário admin criado com sucesso!');
    } else {
      // Atualizar senha do admin existente
      await query(
        'UPDATE usuarios SET senha = $1, updated_at = CURRENT_TIMESTAMP WHERE usuario = $2',
        [hashedPassword, 'admin']
      );
      logger.info('✅ Senha do admin atualizada com sucesso!');
    }

    logger.info(`🔑 Usuário: admin`);
    logger.info(`🔑 Senha: ${novaSenha}`);
    
    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Erro ao resetar senha:', error);
    await closePool();
    process.exit(1);
  }
}

resetAdminPassword();