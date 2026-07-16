const {
  createCliente,
  findClienteById,
  findClienteByCpf,
  searchClientes,
  listClientes,
  updateCliente,
  deleteCliente,
  createLog
} = require('../models/database');
const logger = require('../utils/logger');
const { getIO } = require('../services/socketService');

const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pagination = { page: parseInt(page), limit: parseInt(limit) };

    const result = await listClientes(pagination);

    return res.json({
      success: true,
      data: result.data || [],
      pagination: {
        page: result.page || 1,
        limit: result.limit || 20,
        total: result.total || 0,
        pages: Math.ceil((result.total || 0) / (result.limit || 20))
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao listar clientes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar clientes',
      error: error.message
    });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await findClienteById(parseInt(id));

    if (!cliente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    return res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar cliente ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar cliente',
      error: error.message
    });
  }
};

const search = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const result = await searchClientes(q.trim());

    return res.json({
      success: true,
      data: result || []
    });
  } catch (error) {
    logger.error('❌ Erro ao buscar clientes:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes',
      error: error.message
    });
  }
};

const create = async (req, res) => {
  try {
    const { id, nome_completo, cpf } = req.body;

    if (!nome_completo || !cpf) {
      return res.status(400).json({
        success: false,
        message: 'Nome completo e CPF são obrigatórios'
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido. Deve conter 11 dígitos.'
      });
    }

    const existingClient = await findClienteByCpf(cpfLimpo);
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Já existe um cliente com este CPF'
      });
    }

    if (id) {
      const existingId = await findClienteById(parseInt(id));
      if (existingId) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um cliente com este ID'
        });
      }
    }

    const cliente = await createCliente({
      id: id ? parseInt(id) : null,
      nome_completo,
      cpf: cpfLimpo
    });

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'CREATE_CLIENTE',
      descricao: `Criou cliente ${nome_completo} - CPF: ${cpfLimpo}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Cliente criado por ${req.user.nome}: ${nome_completo}`);

    // Emitir evento em tempo real
    const io = getIO();
    if (io) {
      io.emit('cliente:created', {
        ...cliente,
        usuario_nome: req.user.nome,
        created_at: new Date().toISOString()
      });
    }

    return res.status(201).json({
      success: true,
      data: cliente,
      message: 'Cliente cadastrado com sucesso!'
    });
  } catch (error) {
    logger.error('❌ Erro ao criar cliente:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Erro ao criar cliente',
      error: error.message
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome_completo, cpf } = req.body;

    const clienteExistente = await findClienteById(parseInt(id));

    if (!clienteExistente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'CPF inválido. Deve conter 11 dígitos.'
      });
    }

    if (cpfLimpo !== clienteExistente.cpf) {
      const existingClient = await findClienteByCpf(cpfLimpo);
      if (existingClient && existingClient.id !== parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: 'Já existe um cliente com este CPF'
        });
      }
    }

    const cliente = await updateCliente(parseInt(id), { 
      nome_completo, 
      cpf: cpfLimpo 
    });

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'UPDATE_CLIENTE',
      descricao: `Atualizou cliente ${nome_completo} - ID: ${id}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Cliente ${id} atualizado por ${req.user.nome}`);

    // Emitir evento em tempo real
    const io = getIO();
    if (io) {
      io.emit('cliente:updated', {
        ...cliente,
        usuario_nome: req.user.nome,
        updated_at: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      data: cliente,
      message: 'Cliente atualizado com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao atualizar cliente ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar cliente',
      error: error.message
    });
  }
};

const delete_ = async (req, res) => {
  try {
    const { id } = req.params;

    const clienteExistente = await findClienteById(parseInt(id));

    if (!clienteExistente) {
      return res.status(404).json({
        success: false,
        message: 'Cliente não encontrado'
      });
    }

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'DELETE_CLIENTE',
      descricao: `Excluiu cliente ${clienteExistente.nome_completo} - ID: ${id}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    await deleteCliente(parseInt(id));

    logger.info(`✅ Cliente ${id} excluído por ${req.user.nome}`);

    // Emitir evento em tempo real
    const io = getIO();
    if (io) {
      io.emit('cliente:deleted', {
        id: parseInt(id),
        usuario_nome: req.user.nome,
        deleted_at: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: 'Cliente excluído com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao excluir cliente ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir cliente',
      error: error.message
    });
  }
};

module.exports = {
  getAll,
  getById,
  search,
  create,
  update,
  delete: delete_
};