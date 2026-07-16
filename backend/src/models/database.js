const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================
// USUÁRIOS
// ============================================================

const createUsuario = async (data) => {
  const { nome, usuario, email, senha, perfil = 'FUNCIONARIO' } = data;
  const result = await query(
    `INSERT INTO usuarios (nome, usuario, email, senha, perfil) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, nome, usuario, email, perfil, ativo, created_at`,
    [nome, usuario, email, senha, perfil]
  );
  return result.rows[0];
};

const findUsuarioByUsuario = async (usuario) => {
  const result = await query(
    'SELECT * FROM usuarios WHERE usuario = $1',
    [usuario]
  );
  return result.rows[0];
};

const findUsuarioById = async (id) => {
  const result = await query(
    'SELECT id, nome, usuario, email, perfil, ativo, created_at FROM usuarios WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

const listUsuarios = async (ativo = true) => {
  const result = await query(
    'SELECT id, nome, usuario, email, perfil, ativo, created_at FROM usuarios WHERE ativo = $1 ORDER BY nome',
    [ativo]
  );
  return result.rows;
};

const updateUsuario = async (id, data) => {
  const { nome, email, perfil, ativo } = data;
  const result = await query(
    `UPDATE usuarios 
     SET nome = $1, email = $2, perfil = $3, ativo = $4, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $5 
     RETURNING id, nome, usuario, email, perfil, ativo`,
    [nome, email, perfil, ativo, id]
  );
  return result.rows[0];
};

const updateSenha = async (id, senha) => {
  await query(
    'UPDATE usuarios SET senha = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [senha, id]
  );
};

// ============================================================
// CLIENTES
// ============================================================

const createCliente = async (data) => {
  const { id, nome_completo, cpf } = data;
  
  let queryText = '';
  let params = [];
  
  if (id) {
    const existing = await query('SELECT id FROM clientes WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      throw new Error('Já existe um cliente com este ID');
    }
    
    queryText = `
      INSERT INTO clientes (id, nome_completo, cpf) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    params = [id, nome_completo, cpf];
  } else {
    queryText = `
      INSERT INTO clientes (nome_completo, cpf) 
      VALUES ($1, $2) 
      RETURNING *
    `;
    params = [nome_completo, cpf];
  }
  
  const result = await query(queryText, params);
  return result.rows[0];
};

const findClienteById = async (id) => {
  const result = await query(
    'SELECT * FROM clientes WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

const findClienteByCpf = async (cpf) => {
  const result = await query(
    'SELECT * FROM clientes WHERE cpf = $1',
    [cpf]
  );
  return result.rows[0];
};

const searchClientes = async (searchTerm) => {
  const result = await query(
    `SELECT * FROM clientes 
     WHERE nome_completo ILIKE $1 
        OR cpf ILIKE $1 
        OR CAST(id AS TEXT) ILIKE $1
     ORDER BY nome_completo 
     LIMIT 20`,
    [`%${searchTerm}%`]
  );
  return result.rows;
};

const listClientes = async (pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  try {
    const [result, countResult] = await Promise.all([
      query(
        `SELECT * FROM clientes 
         ORDER BY id 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query('SELECT COUNT(*) as total FROM clientes')
    ]);

    return {
      data: result.rows || [],
      total: parseInt(countResult.rows[0]?.total || 0),
      page: parseInt(page),
      limit: parseInt(limit)
    };
  } catch (error) {
    logger.error('❌ Erro ao listar clientes:', error);
    return {
      data: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }
};

const updateCliente = async (id, data) => {
  const { nome_completo, cpf } = data;
  const result = await query(
    `UPDATE clientes 
     SET nome_completo = $1, cpf = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3 
     RETURNING *`,
    [nome_completo, cpf, id]
  );
  return result.rows[0];
};

const deleteCliente = async (id) => {
  const result = await query(
    'DELETE FROM clientes WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0];
};

// ============================================================
// PAGAMENTOS - CORRIGIDO
// ============================================================

const createPagamento = async (data) => {
  const {
    cliente_id,
    cliente_nome,
    valor,
    forma_pagamento,
    bandeira,
    parcelas,
    observacoes,
    comprovante,
    usuario_id
  } = data;

  try {
    const result = await query(
      `INSERT INTO pagamentos (
        cliente_id, cliente_nome, valor, forma_pagamento, bandeira, parcelas,
        observacoes, comprovante, usuario_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        String(cliente_id),
        String(cliente_nome),
        parseFloat(valor),
        String(forma_pagamento),
        bandeira || 'VISA', // Valor padrão se não fornecido
        parseInt(parcelas) || 1, // Valor padrão
        observacoes || null,
        comprovante || null,
        parseInt(usuario_id)
      ]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Erro ao criar pagamento:', error);
    throw error;
  }
};

const listPagamentos = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  let whereClauses = [];
  let values = [];
  let paramCount = 1;

  if (filters.search) {
    whereClauses.push(`(
      CAST(cliente_id AS TEXT) ILIKE $${paramCount} OR 
      cliente_nome ILIKE $${paramCount}
    )`);
    values.push(`%${filters.search}%`);
    paramCount++;
  }

  if (filters.data_inicio && filters.data_fim) {
    whereClauses.push(`created_at BETWEEN $${paramCount} AND $${paramCount + 1}`);
    values.push(filters.data_inicio, filters.data_fim);
    paramCount += 2;
  }

  if (filters.forma_pagamento) {
    whereClauses.push(`forma_pagamento = $${paramCount}`);
    values.push(filters.forma_pagamento);
    paramCount++;
  }

  if (filters.usuario_id) {
    whereClauses.push(`usuario_id = $${paramCount}`);
    values.push(parseInt(filters.usuario_id));
    paramCount++;
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const queryText = `
    SELECT 
      p.*,
      u.nome as usuario_nome,
      u.usuario as usuario_login
    FROM pagamentos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;

  const countText = `
    SELECT COUNT(*) as total 
    FROM pagamentos p
    ${where}
  `;

  const valuesWithPagination = [...values, limit, offset];
  
  const [result, countResult] = await Promise.all([
    query(queryText, valuesWithPagination),
    query(countText, values)
  ]);

  return {
    data: result.rows || [],
    total: parseInt(countResult.rows[0]?.total || 0),
    page: parseInt(page),
    limit: parseInt(limit)
  };
};

const findPagamentoById = async (id) => {
  const result = await query(
    `SELECT 
      p.*,
      u.nome as usuario_nome,
      u.usuario as usuario_login,
      u.email as usuario_email
    FROM pagamentos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    WHERE p.id = $1`,
    [id]
  );
  return result.rows[0];
};

const updatePagamento = async (id, data) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = [
    'cliente_id', 'cliente_nome', 'valor', 'forma_pagamento',
    'bandeira', 'parcelas', 'observacoes', 'comprovante'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== null) {
      fields.push(`${field} = $${paramCount}`);
      values.push(data[field]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    throw new Error('Nenhum campo para atualizar');
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(parseInt(id));

  const result = await query(
    `UPDATE pagamentos SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
};

const deletePagamento = async (id) => {
  const result = await query(
    'DELETE FROM pagamentos WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0];
};

// ============================================================
// LOGS
// ============================================================

const createLog = async (data) => {
  const { usuario, usuario_id, acao, descricao, ip, navegador, sistema, pagamento_id } = data;
  
  await query(
    `INSERT INTO logs (usuario, usuario_id, acao, descricao, ip, navegador, sistema, pagamento_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [usuario, usuario_id || null, acao, descricao, ip || null, navegador || null, sistema || null, pagamento_id || null]
  );
};

const getLogsByPagamento = async (pagamento_id) => {
  const result = await query(
    'SELECT * FROM logs WHERE pagamento_id = $1 ORDER BY created_at DESC',
    [pagamento_id]
  );
  return result.rows;
};

const listLogs = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClauses = [];
  let values = [];
  let paramCount = 1;

  if (filters.usuario) {
    whereClauses.push(`usuario ILIKE $${paramCount}`);
    values.push(`%${filters.usuario}%`);
    paramCount++;
  }

  if (filters.acao) {
    whereClauses.push(`acao = $${paramCount}`);
    values.push(filters.acao);
    paramCount++;
  }

  if (filters.data_inicio && filters.data_fim) {
    whereClauses.push(`created_at BETWEEN $${paramCount} AND $${paramCount + 1}`);
    values.push(filters.data_inicio, filters.data_fim);
    paramCount += 2;
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await query(
    `SELECT * FROM logs 
     ${where}
     ORDER BY created_at DESC
     LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
    [...values, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) as total FROM logs ${where}`,
    values
  );

  return {
    data: result.rows || [],
    total: parseInt(countResult.rows[0]?.total || 0),
    page: parseInt(page),
    limit: parseInt(limit)
  };
};

// ============================================================
// DASHBOARD
// ============================================================

const getDashboardData = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  try {
    const [
      todayResult, 
      totalResult, 
      creditoResult, 
      debitoResult, 
      pixResult,
      lastResult, 
      dailyResult,
      topClientsResult,
      recentPaymentsResult
    ] = await Promise.all([
      query(
        `SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total 
         FROM pagamentos 
         WHERE created_at >= $1 AND created_at < $2`,
        [today, tomorrow]
      ),
      query(
        `SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total 
         FROM pagamentos`
      ),
      query(
        `SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total 
         FROM pagamentos WHERE forma_pagamento = 'CREDITO'`
      ),
      query(
        `SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total 
         FROM pagamentos WHERE forma_pagamento = 'DEBITO'`
      ),
      query(
        `SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total 
         FROM pagamentos WHERE forma_pagamento = 'PIX'`
      ),
      query(
        `SELECT p.*, u.nome as usuario_nome 
         FROM pagamentos p
         LEFT JOIN usuarios u ON p.usuario_id = u.id
         ORDER BY p.created_at DESC LIMIT 1`
      ),
      query(
        `SELECT 
          DATE(created_at) as data,
          TO_CHAR(created_at, 'Dy') as dia,
          COUNT(*) as quantidade,
          COALESCE(SUM(valor), 0) as valor
         FROM pagamentos 
         WHERE created_at >= $1 AND created_at < $2
         GROUP BY DATE(created_at), TO_CHAR(created_at, 'Dy')
         ORDER BY data`,
        [sevenDaysAgo, tomorrow]
      ),
      query(
        `SELECT 
          cliente_id,
          cliente_nome,
          COUNT(*) as total_pagamentos,
          COALESCE(SUM(valor), 0) as valor_total
         FROM pagamentos
         GROUP BY cliente_id, cliente_nome
         ORDER BY total_pagamentos DESC
         LIMIT 5`
      ),
      query(
        `SELECT 
          p.*,
          u.nome as usuario_nome
         FROM pagamentos p
         LEFT JOIN usuarios u ON p.usuario_id = u.id
         ORDER BY p.created_at DESC
         LIMIT 5`
      )
    ]);

    const dailyData = dailyResult.rows.map(row => ({
      dia: row.dia,
      data: row.data,
      quantidade: parseInt(row.quantidade) || 0,
      valor: parseFloat(row.valor) || 0
    }));

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dailyMap = {};
    dailyData.forEach(d => {
      dailyMap[d.dia] = d;
    });

    const filledDaily = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dayName = dayNames[date.getDay()];
      const dayData = dailyMap[dayName] || { 
        dia: dayName, 
        data: date.toISOString().split('T')[0], 
        quantidade: 0, 
        valor: 0 
      };
      filledDaily.push(dayData);
    }

    return {
      today: {
        total: parseInt(todayResult.rows[0]?.total) || 0,
        valor_total: parseFloat(todayResult.rows[0]?.valor_total) || 0
      },
      totals: {
        total: parseInt(totalResult.rows[0]?.total) || 0,
        valor_total: parseFloat(totalResult.rows[0]?.valor_total) || 0,
        credito: {
          count: parseInt(creditoResult.rows[0]?.total) || 0,
          valor: parseFloat(creditoResult.rows[0]?.valor_total) || 0
        },
        debito: {
          count: parseInt(debitoResult.rows[0]?.total) || 0,
          valor: parseFloat(debitoResult.rows[0]?.valor_total) || 0
        },
        pix: {
          count: parseInt(pixResult.rows[0]?.total) || 0,
          valor: parseFloat(pixResult.rows[0]?.valor_total) || 0
        }
      },
      daily: filledDaily,
      top_clients: topClientsResult.rows.map(row => ({
        cliente_id: row.cliente_id,
        cliente_nome: row.cliente_nome,
        total_pagamentos: parseInt(row.total_pagamentos) || 0,
        valor_total: parseFloat(row.valor_total) || 0
      })),
      recent_payments: recentPaymentsResult.rows.map(row => ({
        ...row,
        valor: parseFloat(row.valor) || 0
      })),
      last_payment: lastResult.rows[0] ? {
        ...lastResult.rows[0],
        valor: parseFloat(lastResult.rows[0].valor) || 0
      } : null
    };
  } catch (error) {
    logger.error('❌ Erro ao buscar dados do dashboard:', error);
    return {
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
    };
  }
};

// ============================================================
// RELATÓRIOS
// ============================================================

const getRelatorioData = async (filters = {}) => {
  let whereClauses = [];
  let values = [];
  let paramCount = 1;

  if (filters.periodo_inicio && filters.periodo_fim) {
    whereClauses.push(`p.created_at BETWEEN $${paramCount} AND $${paramCount + 1}`);
    values.push(filters.periodo_inicio, filters.periodo_fim);
    paramCount += 2;
  }

  if (filters.funcionario) {
    whereClauses.push(`u.nome ILIKE $${paramCount}`);
    values.push(`%${filters.funcionario}%`);
    paramCount++;
  }

  if (filters.forma_pagamento) {
    whereClauses.push(`p.forma_pagamento = $${paramCount}`);
    values.push(filters.forma_pagamento);
    paramCount++;
  }

  if (filters.cliente) {
    whereClauses.push(`(CAST(p.cliente_id AS TEXT) ILIKE $${paramCount} OR p.cliente_nome ILIKE $${paramCount})`);
    values.push(`%${filters.cliente}%`);
    paramCount++;
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const queryText = `
    SELECT 
      p.*,
      u.nome as usuario_nome,
      u.usuario as usuario_login
    FROM pagamentos p
    LEFT JOIN usuarios u ON p.usuario_id = u.id
    ${where}
    ORDER BY p.created_at DESC
  `;

  const result = await query(queryText, values);

  const summary = {
    total_registros: result.rows.length || 0,
    valor_total: result.rows.reduce((sum, p) => sum + parseFloat(p.valor), 0),
    valor_medio: result.rows.length > 0 
      ? result.rows.reduce((sum, p) => sum + parseFloat(p.valor), 0) / result.rows.length 
      : 0,
    creditos: result.rows.filter(p => p.forma_pagamento === 'CREDITO').length,
    debitos: result.rows.filter(p => p.forma_pagamento === 'DEBITO').length,
    pix: result.rows.filter(p => p.forma_pagamento === 'PIX').length,
    valor_credito: result.rows
      .filter(p => p.forma_pagamento === 'CREDITO')
      .reduce((sum, p) => sum + parseFloat(p.valor), 0),
    valor_debito: result.rows
      .filter(p => p.forma_pagamento === 'DEBITO')
      .reduce((sum, p) => sum + parseFloat(p.valor), 0),
    valor_pix: result.rows
      .filter(p => p.forma_pagamento === 'PIX')
      .reduce((sum, p) => sum + parseFloat(p.valor), 0)
  };

  return {
    registros: result.rows || [],
    summary
  };
};

// ============================================================
// ARQUIVOS
// ============================================================

const createArquivo = async (data) => {
  const {
    nome_original,
    nome_arquivo,
    caminho,
    tamanho,
    tipo,
    categoria,
    descricao,
    tags,
    pagamento_id,
    cliente_id,
    usuario_id,
    versao,
    arquivo_pai_id,
    publico
  } = data;

  try {
    const result = await query(
      `INSERT INTO arquivos (
        nome_original, nome_arquivo, caminho, tamanho, tipo, categoria,
        descricao, tags, pagamento_id, cliente_id, usuario_id,
        versao, arquivo_pai_id, publico
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        nome_original, nome_arquivo, caminho, parseInt(tamanho) || 0, tipo, categoria,
        descricao || null, tags || null, pagamento_id || null, cliente_id || null,
        parseInt(usuario_id), parseInt(versao) || 1, arquivo_pai_id || null, publico || false
      ]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Erro ao criar arquivo:', error);
    throw error;
  }
};

const listArquivos = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  let whereClauses = [];
  let values = [];
  let paramCount = 1;

  if (filters.search) {
    whereClauses.push(`(
      nome_original ILIKE $${paramCount} OR 
      descricao ILIKE $${paramCount} OR 
      categoria ILIKE $${paramCount}
    )`);
    values.push(`%${filters.search}%`);
    paramCount++;
  }

  if (filters.categoria) {
    whereClauses.push(`categoria = $${paramCount}`);
    values.push(filters.categoria);
    paramCount++;
  }

  if (filters.pagamento_id) {
    whereClauses.push(`pagamento_id = $${paramCount}`);
    values.push(parseInt(filters.pagamento_id));
    paramCount++;
  }

  if (filters.cliente_id) {
    whereClauses.push(`cliente_id = $${paramCount}`);
    values.push(parseInt(filters.cliente_id));
    paramCount++;
  }

  if (filters.usuario_id) {
    whereClauses.push(`usuario_id = $${paramCount}`);
    values.push(parseInt(filters.usuario_id));
    paramCount++;
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const queryText = `
    SELECT 
      a.*,
      u.nome as usuario_nome,
      u.usuario as usuario_login
    FROM arquivos a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;

  const countText = `
    SELECT COUNT(*) as total 
    FROM arquivos a
    ${where}
  `;

  const valuesWithPagination = [...values, limit, offset];
  
  try {
    const [result, countResult] = await Promise.all([
      query(queryText, valuesWithPagination),
      query(countText, values)
    ]);

    return {
      data: result.rows || [],
      total: parseInt(countResult.rows[0]?.total || 0),
      page: parseInt(page),
      limit: parseInt(limit)
    };
  } catch (error) {
    logger.error('❌ Erro ao listar arquivos:', error);
    return {
      data: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  }
};

const findArquivoById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        a.*,
        u.nome as usuario_nome,
        u.usuario as usuario_login
      FROM arquivos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.id = $1`,
      [parseInt(id)]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao buscar arquivo ${id}:`, error);
    return null;
  }
};

const findArquivosByPagamento = async (pagamento_id) => {
  try {
    const result = await query(
      `SELECT 
        a.*,
        u.nome as usuario_nome,
        u.usuario as usuario_login
      FROM arquivos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.pagamento_id = $1
      ORDER BY a.created_at DESC`,
      [parseInt(pagamento_id)]
    );
    return result.rows || [];
  } catch (error) {
    logger.error(`❌ Erro ao buscar arquivos do pagamento ${pagamento_id}:`, error);
    return [];
  }
};

const updateArquivo = async (id, data) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = ['descricao', 'tags', 'categoria', 'publico'];

  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== null) {
      fields.push(`${field} = $${paramCount}`);
      values.push(data[field]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    throw new Error('Nenhum campo para atualizar');
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(parseInt(id));

  try {
    const result = await query(
      `UPDATE arquivos SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao atualizar arquivo ${id}:`, error);
    throw error;
  }
};

const deleteArquivo = async (id) => {
  try {
    const result = await query(
      'DELETE FROM arquivos WHERE id = $1 RETURNING id, caminho, nome_arquivo',
      [parseInt(id)]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao deletar arquivo ${id}:`, error);
    throw error;
  }
};

const incrementDownloads = async (id) => {
  try {
    const result = await query(
      'UPDATE arquivos SET downloads = downloads + 1 WHERE id = $1 RETURNING downloads',
      [parseInt(id)]
    );
    return result.rows[0]?.downloads || 0;
  } catch (error) {
    logger.error(`❌ Erro ao incrementar downloads ${id}:`, error);
    return 0;
  }
};

const createCompartilhamento = async (data) => {
  const { arquivo_id, usuario_id, token, data_expiracao, permissoes } = data;
  
  try {
    const result = await query(
      `INSERT INTO compartilhamentos (
        arquivo_id, usuario_id, token, data_expiracao, permissoes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [parseInt(arquivo_id), usuario_id || null, token, data_expiracao || null, permissoes || 'visualizar']
    );
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Erro ao criar compartilhamento:', error);
    throw error;
  }
};

const findCompartilhamentoByToken = async (token) => {
  try {
    const result = await query(
      `SELECT c.*, a.nome_original, a.caminho, a.tipo
       FROM compartilhamentos c
       JOIN arquivos a ON c.arquivo_id = a.id
       WHERE c.token = $1 AND (c.data_expiracao IS NULL OR c.data_expiracao > NOW())`,
      [token]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao buscar compartilhamento ${token}:`, error);
    return null;
  }
};

const listCompartilhamentos = async (arquivo_id) => {
  try {
    const result = await query(
      `SELECT c.*, u.nome as usuario_nome
       FROM compartilhamentos c
       LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.arquivo_id = $1
       ORDER BY c.created_at DESC`,
      [parseInt(arquivo_id)]
    );
    return result.rows || [];
  } catch (error) {
    logger.error(`❌ Erro ao listar compartilhamentos ${arquivo_id}:`, error);
    return [];
  }
};

const deleteCompartilhamento = async (id) => {
  try {
    await query('DELETE FROM compartilhamentos WHERE id = $1', [parseInt(id)]);
  } catch (error) {
    logger.error(`❌ Erro ao deletar compartilhamento ${id}:`, error);
    throw error;
  }
};

// ============================================================
// EXPORTAÇÕES
// ============================================================

module.exports = {
  // Usuários
  createUsuario,
  findUsuarioByUsuario,
  findUsuarioById,
  listUsuarios,
  updateUsuario,
  updateSenha,
  
  // Clientes
  createCliente,
  findClienteById,
  findClienteByCpf,
  searchClientes,
  listClientes,
  updateCliente,
  deleteCliente,
  
  // Pagamentos
  createPagamento,
  listPagamentos,
  findPagamentoById,
  updatePagamento,
  deletePagamento,
  
  // Logs
  createLog,
  getLogsByPagamento,
  listLogs,
  
  // Dashboard
  getDashboardData,
  
  // Relatórios
  getRelatorioData,
  
  // Arquivos
  createArquivo,
  listArquivos,
  findArquivoById,
  findArquivosByPagamento,
  updateArquivo,
  deleteArquivo,
  incrementDownloads,
  createCompartilhamento,
  findCompartilhamentoByToken,
  listCompartilhamentos,
  deleteCompartilhamento
};