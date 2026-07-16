const {
  createPagamento,
  listPagamentos,
  findPagamentoById,
  updatePagamento,
  deletePagamento,
  createLog,
  getLogsByPagamento,
  getDashboardData
} = require('../models/database');
const logger = require('../utils/logger');

// ============================================================
// LISTAR TODOS OS PAGAMENTOS
// ============================================================

const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      data_inicio,
      data_fim,
      forma_pagamento,
      usuario_id
    } = req.query;

    const filters = { 
      search, 
      data_inicio, 
      data_fim, 
      forma_pagamento, 
      usuario_id 
    };
    const pagination = { 
      page: parseInt(page), 
      limit: parseInt(limit) 
    };

    const result = await listPagamentos(filters, pagination);

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
    logger.error('❌ Erro ao listar pagamentos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar pagamentos',
      error: error.message
    });
  }
};

// ============================================================
// BUSCAR PAGAMENTO POR ID
// ============================================================

const getById = async (req, res) => {
  try {
    const { id } = req.params;

    const pagamento = await findPagamentoById(parseInt(id));

    if (!pagamento) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    const logs = await getLogsByPagamento(parseInt(id));

    return res.json({
      success: true,
      data: { ...pagamento, logs: logs || [] }
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar pagamento ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar pagamento',
      error: error.message
    });
  }
};

// ============================================================
// CRIAR NOVO PAGAMENTO - CORRIGIDO
// ============================================================

const create = async (req, res) => {
  try {
    const {
      cliente_id,
      cliente_nome,
      valor,
      forma_pagamento,
      observacoes
    } = req.body;

    // Validação dos campos obrigatórios
    if (!cliente_id || !cliente_nome || !valor || !forma_pagamento) {
      logger.warn('Campos obrigatórios faltando:', { 
        cliente_id, 
        cliente_nome, 
        valor, 
        forma_pagamento 
      });
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: cliente, valor e forma de pagamento'
      });
    }

    // Validar valor
    const valorNumero = parseFloat(valor);
    if (isNaN(valorNumero) || valorNumero <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valor inválido. Deve ser um número maior que zero.'
      });
    }

    // Validar forma de pagamento
    const formasValidas = ['CREDITO', 'DEBITO', 'PIX'];
    if (!formasValidas.includes(forma_pagamento)) {
      return res.status(400).json({
        success: false,
        message: 'Forma de pagamento inválida. Use CREDITO, DEBITO ou PIX.'
      });
    }

    const comprovante = req.file ? req.file.filename : null;

    // Criar pagamento
    const pagamento = await createPagamento({
      cliente_id: String(cliente_id),
      cliente_nome: String(cliente_nome),
      valor: valorNumero,
      forma_pagamento: String(forma_pagamento),
      observacoes: observacoes || null,
      comprovante: comprovante || null,
      usuario_id: req.user.id
    });

    // Registrar log
    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'CREATE',
      descricao: `Criou pagamento para ${cliente_nome} - R$ ${valorNumero.toFixed(2)}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown',
      pagamento_id: pagamento.id
    });

    logger.info(`✅ Pagamento criado por ${req.user.nome}: ${cliente_nome} - R$ ${valorNumero.toFixed(2)}`);

    // Buscar pagamento completo com dados do usuário
    const pagamentoCompleto = await findPagamentoById(pagamento.id);

    // Emitir evento em tempo real
    try {
      const { getIO } = require('../services/socketService');
      const io = getIO();
      if (io) {
        io.to('pagamentos').emit('pagamento:created', {
          ...pagamentoCompleto,
          usuario_nome: req.user.nome,
          created_at: new Date().toISOString()
        });
        io.to('dashboard').emit('dashboard:update', { 
          type: 'create',
          message: `Novo pagamento: ${cliente_nome} - R$ ${valorNumero.toFixed(2)}`
        });
      }
    } catch (socketError) {
      logger.warn('⚠️ Erro ao emitir evento socket:', socketError.message);
    }

    return res.status(201).json({
      success: true,
      data: pagamentoCompleto,
      message: 'Pagamento registrado com sucesso!'
    });
  } catch (error) {
    logger.error('❌ Erro ao criar pagamento:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar pagamento',
      error: error.message
    });
  }
};

// ============================================================
// ATUALIZAR PAGAMENTO
// ============================================================

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    const pagamentoExistente = await findPagamentoById(parseInt(id));

    if (!pagamentoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    if (req.file) {
      data.comprovante = req.file.filename;
    }

    if (data.valor) data.valor = parseFloat(data.valor);

    await updatePagamento(parseInt(id), data);

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'UPDATE',
      descricao: `Atualizou pagamento ID ${id}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown',
      pagamento_id: parseInt(id)
    });

    logger.info(`✅ Pagamento ${id} atualizado por ${req.user.nome}`);

    const pagamentoCompleto = await findPagamentoById(parseInt(id));

    return res.json({
      success: true,
      data: pagamentoCompleto,
      message: 'Pagamento atualizado com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao atualizar pagamento ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar pagamento',
      error: error.message
    });
  }
};

// ============================================================
// EXCLUIR PAGAMENTO
// ============================================================

const delete_ = async (req, res) => {
  try {
    const { id } = req.params;

    const pagamentoExistente = await findPagamentoById(parseInt(id));

    if (!pagamentoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Pagamento não encontrado'
      });
    }

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'DELETE',
      descricao: `Excluiu pagamento ID ${id} - ${pagamentoExistente.cliente_nome} - R$ ${pagamentoExistente.valor}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown',
      pagamento_id: parseInt(id)
    });

    await deletePagamento(parseInt(id));

    logger.info(`✅ Pagamento ${id} excluído por ${req.user.nome}`);

    return res.json({
      success: true,
      message: 'Pagamento excluído com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao excluir pagamento ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir pagamento',
      error: error.message
    });
  }
};

// ============================================================
// DASHBOARD
// ============================================================

const getDashboard = async (req, res) => {
  try {
    const data = await getDashboardData();
    
    return res.json({
      success: true,
      data: {
        today: data.today || { total: 0, valor_total: 0 },
        totals: data.totals || { 
          total: 0, 
          valor_total: 0, 
          credito: { count: 0, valor: 0 },
          debito: { count: 0, valor: 0 },
          pix: { count: 0, valor: 0 }
        },
        daily: data.daily || [],
        top_clients: data.top_clients || [],
        recent_payments: data.recent_payments || [],
        last_payment: data.last_payment || null
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao buscar dados do dashboard:', error);
    return res.json({
      success: true,
      data: {
        today: { total: 0, valor_total: 0 },
        totals: { 
          total: 0, 
          valor_total: 0, 
          credito: { count: 0, valor: 0 },
          debito: { count: 0, valor: 0 },
          pix: { count: 0, valor: 0 }
        },
        daily: [],
        top_clients: [],
        recent_payments: [],
        last_payment: null
      }
    });
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: delete_,
  getDashboard
};