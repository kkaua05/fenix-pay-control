const bcrypt = require('bcrypt');
const {
  createUsuario,
  findUsuarioById,
  listUsuarios,
  updateUsuario,
  updateSenha,
  createLog
} = require('../models/database');
const logger = require('../utils/logger');

const getAll = async (req, res) => {
  try {
    const usuarios = await listUsuarios();
    
    return res.json({
      success: true,
      data: usuarios || []
    });
  } catch (error) {
    logger.error('❌ Erro ao listar usuários:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar usuários',
      error: error.message
    });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await findUsuarioById(parseInt(id));

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    return res.json({
      success: true,
      data: usuario
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar usuário ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar usuário',
      error: error.message
    });
  }
};

const create = async (req, res) => {
  try {
    const { nome, usuario, email, senha, perfil } = req.body;

    if (!nome || !usuario || !email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: nome, usuario, email, senha'
      });
    }

    if (senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter pelo menos 6 caracteres'
      });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const newUser = await createUsuario({
      nome,
      usuario,
      email,
      senha: hashedPassword,
      perfil: perfil || 'FUNCIONARIO'
    });

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'CREATE_USER',
      descricao: `Criou usuário ${usuario}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Usuário criado: ${usuario} por ${req.user.nome}`);

    return res.status(201).json({
      success: true,
      data: newUser,
      message: 'Usuário criado com sucesso!'
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Usuário ou email já existe'
      });
    }
    logger.error('❌ Erro ao criar usuário:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      error: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil, ativo } = req.body;

    const usuarioExistente = await findUsuarioById(parseInt(id));

    if (!usuarioExistente) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const usuario = await updateUsuario(parseInt(id), { 
      nome: nome || usuarioExistente.nome,
      email: email || usuarioExistente.email,
      perfil: perfil || usuarioExistente.perfil,
      ativo: ativo !== undefined ? ativo : usuarioExistente.ativo
    });

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'UPDATE_USER',
      descricao: `Atualizou usuário ${usuarioExistente.usuario}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Usuário ${usuarioExistente.usuario} atualizado por ${req.user.nome}`);

    return res.json({
      success: true,
      data: usuario,
      message: 'Usuário atualizado com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao atualizar usuário ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário',
      error: error.message
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { nova_senha } = req.body;

    if (!nova_senha || nova_senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter pelo menos 6 caracteres'
      });
    }

    const usuarioExistente = await findUsuarioById(parseInt(id));

    if (!usuarioExistente) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const hashedPassword = await bcrypt.hash(nova_senha, 10);
    await updateSenha(parseInt(id), hashedPassword);

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'RESET_PASSWORD',
      descricao: `Resetou senha do usuário ${usuarioExistente.usuario}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Senha resetada para ${usuarioExistente.usuario} por ${req.user.nome}`);

    return res.json({
      success: true,
      message: 'Senha alterada com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao resetar senha do usuário ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha',
      error: error.message
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  resetPassword
};