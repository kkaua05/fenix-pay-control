const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findUsuarioByUsuario, createLog } = require('../models/database');
const logger = require('../utils/logger');

const login = async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      logger.warn('Tentativa de login sem credenciais');
      return res.status(400).json({
        success: false,
        message: 'Usuário e senha são obrigatórios'
      });
    }

    logger.info(`🔍 Tentativa de login para: ${usuario}`);

    const user = await findUsuarioByUsuario(usuario);

    if (!user) {
      logger.warn(`❌ Usuário não encontrado: ${usuario}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    if (!user.ativo) {
      logger.warn(`❌ Usuário inativo: ${usuario}`);
      return res.status(401).json({
        success: false,
        message: 'Usuário desativado. Contate o administrador.'
      });
    }

    const validPassword = await bcrypt.compare(senha, user.senha);
    
    if (!validPassword) {
      logger.warn(`❌ Senha incorreta para: ${usuario}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    logger.info(`✅ Login bem-sucedido para: ${usuario}`);

    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        nome: user.nome,
        perfil: user.perfil,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await createLog({
      usuario: user.nome,
      usuario_id: user.id,
      acao: 'LOGIN',
      descricao: 'Login realizado com sucesso',
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nome: user.nome,
        usuario: user.usuario,
        email: user.email,
        perfil: user.perfil
      }
    });
  } catch (error) {
    logger.error('❌ Erro no login:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

const verificarToken = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    logger.error('❌ Erro ao verificar token:', error);
    return res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

module.exports = { login, verificarToken };