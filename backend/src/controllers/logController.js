const { listLogs, createLog } = require('../models/database');
const logger = require('../utils/logger');

const getAll = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      usuario,
      acao,
      data_inicio,
      data_fim
    } = req.query;

    const filters = { usuario, acao, data_inicio, data_fim };
    const pagination = { page: parseInt(page), limit: parseInt(limit) };

    const result = await listLogs(filters, pagination);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit)
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao listar logs:', error);
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { usuario, usuario_id, acao, descricao, ip, navegador, sistema, pagamento_id } = req.body;
    
    await createLog({
      usuario,
      usuario_id,
      acao,
      descricao,
      ip,
      navegador,
      sistema,
      pagamento_id
    });

    res.status(201).json({
      success: true,
      message: 'Log criado com sucesso'
    });
  } catch (error) {
    logger.error('❌ Erro ao criar log:', error);
    next(error);
  }
};

module.exports = { getAll, create };