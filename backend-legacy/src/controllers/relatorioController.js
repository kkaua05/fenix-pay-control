const { getRelatorioData } = require('../models/database');
const logger = require('../utils/logger');

const getRelatorios = async (req, res) => {
  try {
    const {
      periodo_inicio,
      periodo_fim,
      funcionario,
      forma_pagamento,
      cliente
    } = req.query;

    // Validação do período
    if (periodo_inicio && periodo_fim) {
      const inicio = new Date(periodo_inicio);
      const fim = new Date(periodo_fim);
      
      if (inicio > fim) {
        return res.status(400).json({
          success: false,
          message: 'Data inicial não pode ser maior que a data final'
        });
      }
    }

    const filters = {
      periodo_inicio,
      periodo_fim,
      funcionario,
      forma_pagamento,
      cliente
    };

    const data = await getRelatorioData(filters);

    logger.info(`✅ Relatório gerado por ${req.user.nome} - ${data.registros.length} registros encontrados`);

    res.json({
      success: true,
      data: {
        registros: data.registros || [],
        summary: data.summary || {
          total_registros: 0,
          valor_total: 0,
          valor_medio: 0,
          creditos: 0,
          debitos: 0,
          pix: 0,
          valor_credito: 0,
          valor_debito: 0,
          valor_pix: 0
        },
        filtros: filters,
        total_registros: data.registros ? data.registros.length : 0,
        data_geracao: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório',
      error: error.message
    });
  }
};

module.exports = { getRelatorios };