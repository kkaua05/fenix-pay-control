const router = require('express').Router();
const { getRelatorios } = require('../controllers/relatorioController');
const { auth } = require('../middlewares/auth');

/**
 * Rota para gerar relatórios
 * GET /api/relatorios
 * 
 * Parâmetros de consulta (query params):
 * - periodo_inicio: Data de início (YYYY-MM-DD)
 * - periodo_fim: Data de fim (YYYY-MM-DD)
 * - funcionario: Nome do funcionário (filtro parcial)
 * - bandeira: Bandeira do cartão (MASTERCARD, VISA, ELO, HIPERCARD, AMEX, OUTRA)
 * - forma_pagamento: Forma de pagamento (CREDITO, DEBITO, PIX)
 * - maquininha: Número da maquininha
 * - cliente: Nome ou ID do cliente (filtro parcial)
 * 
 * Autenticação: Obrigatória (Bearer Token)
 */
router.get('/', auth, getRelatorios);

module.exports = router;