const { query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================
// ARQUIVOS - QUERIES COMPLETAS
// ============================================================

const createArquivo = async (data) => {
  const {
    nome_original, nome_arquivo, caminho, tamanho, tipo, categoria,
    descricao, tags, pagamento_id, cliente_id, usuario_id,
    versao, arquivo_pai_id, publico, data_expiracao, metadata
  } = data;

  try {
    const result = await query(
      `INSERT INTO arquivos (
        nome_original, nome_arquivo, caminho, tamanho, tipo, categoria,
        descricao, tags, pagamento_id, cliente_id, usuario_id,
        versao, arquivo_pai_id, publico, data_expiracao, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        nome_original, nome_arquivo, caminho, parseInt(tamanho) || 0, tipo, categoria || 'outro',
        descricao || null, tags || null, pagamento_id || null, cliente_id || null,
        parseInt(usuario_id), parseInt(versao) || 1, arquivo_pai_id || null,
        publico || false, data_expiracao || null, metadata ? JSON.stringify(metadata) : '{}'
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
      a.nome_original ILIKE $${paramCount} OR 
      a.descricao ILIKE $${paramCount} OR 
      a.categoria ILIKE $${paramCount}
    )`);
    values.push(`%${filters.search}%`);
    paramCount++;
  }

  if (filters.categoria) {
    whereClauses.push(`a.categoria = $${paramCount}`);
    values.push(filters.categoria);
    paramCount++;
  }

  if (filters.tipo) {
    whereClauses.push(`a.tipo ILIKE $${paramCount}`);
    values.push(`%${filters.tipo}%`);
    paramCount++;
  }

  if (filters.pagamento_id) {
    whereClauses.push(`a.pagamento_id = $${paramCount}`);
    values.push(parseInt(filters.pagamento_id));
    paramCount++;
  }

  if (filters.cliente_id) {
    whereClauses.push(`a.cliente_id = $${paramCount}`);
    values.push(parseInt(filters.cliente_id));
    paramCount++;
  }

  if (filters.usuario_id) {
    whereClauses.push(`a.usuario_id = $${paramCount}`);
    values.push(parseInt(filters.usuario_id));
    paramCount++;
  }

  if (filters.favorito) {
    whereClauses.push(`a.favorito = true`);
  }

  if (filters.destaque) {
    whereClauses.push(`a.destaque = true`);
  }

  if (filters.pasta_id) {
    whereClauses.push(`EXISTS (SELECT 1 FROM arquivo_pasta ap WHERE ap.arquivo_id = a.id AND ap.pasta_id = $${paramCount})`);
    values.push(parseInt(filters.pasta_id));
    paramCount++;
  }

  if (filters.data_inicio) {
    whereClauses.push(`a.created_at >= $${paramCount}`);
    values.push(filters.data_inicio);
    paramCount++;
  }

  if (filters.data_fim) {
    whereClauses.push(`a.created_at <= $${paramCount}`);
    values.push(filters.data_fim + 'T23:59:59');
    paramCount++;
  }

  if (filters.tamanho_min) {
    whereClauses.push(`a.tamanho >= $${paramCount}`);
    values.push(parseInt(filters.tamanho_min));
    paramCount++;
  }

  if (filters.tamanho_max) {
    whereClauses.push(`a.tamanho <= $${paramCount}`);
    values.push(parseInt(filters.tamanho_max));
    paramCount++;
  }

  const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const orderBy = filters.orderBy || 'a.created_at DESC';
  const allowedOrders = ['a.created_at DESC', 'a.created_at ASC', 'a.nome_original ASC', 'a.tamanho DESC', 'a.downloads DESC'];
  const safeOrderBy = allowedOrders.includes(orderBy) ? orderBy : 'a.created_at DESC';

  const queryText = `
    SELECT 
      a.*,
      u.nome as usuario_nome,
      u.usuario as usuario_login,
      COALESCE(
        (SELECT json_agg(json_build_object('id', p.id, 'nome', p.nome)) 
         FROM arquivo_pasta ap 
         JOIN pastas p ON p.id = ap.pasta_id 
         WHERE ap.arquivo_id = a.id), 
        '[]'::json
      ) as pastas
    FROM arquivos a
    LEFT JOIN usuarios u ON a.usuario_id = u.id
    ${where}
    ORDER BY ${safeOrderBy}
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

    const totalSizeResult = await query(
      `SELECT COALESCE(SUM(tamanho), 0) as total_size FROM arquivos a ${where}`,
      values
    );

    return {
      data: result.rows || [],
      total: parseInt(countResult.rows[0]?.total || 0),
      page: parseInt(page),
      limit: parseInt(limit),
      totalSize: parseInt(totalSizeResult.rows[0]?.total_size || 0)
    };
  } catch (error) {
    logger.error('❌ Erro ao listar arquivos:', error);
    return {
      data: [],
      total: 0,
      page: parseInt(page),
      limit: parseInt(limit),
      totalSize: 0
    };
  }
};

const findArquivoById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        a.*,
        u.nome as usuario_nome,
        u.usuario as usuario_login,
        u.email as usuario_email,
        COALESCE(
          (SELECT json_agg(json_build_object('id', p.id, 'nome', p.nome)) 
           FROM arquivo_pasta ap 
           JOIN pastas p ON p.id = ap.pasta_id 
           WHERE ap.arquivo_id = a.id), 
          '[]'::json
        ) as pastas,
        COALESCE(
          (SELECT json_agg(v.* ORDER BY v.versao DESC) 
           FROM versoes_arquivo v 
           WHERE v.arquivo_id = a.id), 
          '[]'::json
        ) as versoes
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

const findArquivosByCliente = async (cliente_id) => {
  try {
    const result = await query(
      `SELECT 
        a.*,
        u.nome as usuario_nome
      FROM arquivos a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE a.cliente_id = $1
      ORDER BY a.created_at DESC`,
      [parseInt(cliente_id)]
    );
    return result.rows || [];
  } catch (error) {
    logger.error(`❌ Erro ao buscar arquivos do cliente ${cliente_id}:`, error);
    return [];
  }
};

const updateArquivo = async (id, data) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = [
    'descricao', 'tags', 'categoria', 'publico', 'favorito', 'destaque',
    'data_expiracao', 'metadata'
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
      'DELETE FROM arquivos WHERE id = $1 RETURNING id, caminho, nome_arquivo, nome_original',
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

// ============================================================
// FAVORITOS
// ============================================================

const toggleFavorito = async (arquivo_id, usuario_id) => {
  try {
    const existing = await query(
      'SELECT * FROM favoritos_arquivo WHERE arquivo_id = $1 AND usuario_id = $2',
      [parseInt(arquivo_id), parseInt(usuario_id)]
    );

    if (existing.rows.length > 0) {
      await query(
        'DELETE FROM favoritos_arquivo WHERE arquivo_id = $1 AND usuario_id = $2',
        [parseInt(arquivo_id), parseInt(usuario_id)]
      );
      return { favorito: false };
    } else {
      await query(
        'INSERT INTO favoritos_arquivo (arquivo_id, usuario_id) VALUES ($1, $2)',
        [parseInt(arquivo_id), parseInt(usuario_id)]
      );
      return { favorito: true };
    }
  } catch (error) {
    logger.error(`❌ Erro ao toggle favorito ${arquivo_id}:`, error);
    throw error;
  }
};

const listFavoritos = async (usuario_id, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  try {
    const result = await query(
      `SELECT 
        a.*, u.nome as usuario_nome,
        f.created_at as favoritado_em
      FROM favoritos_arquivo f
      JOIN arquivos a ON a.id = f.arquivo_id
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE f.usuario_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3`,
      [parseInt(usuario_id), limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM favoritos_arquivo WHERE usuario_id = $1',
      [parseInt(usuario_id)]
    );

    return {
      data: result.rows || [],
      total: parseInt(countResult.rows[0]?.total || 0),
      page: parseInt(page),
      limit: parseInt(limit)
    };
  } catch (error) {
    logger.error('❌ Erro ao listar favoritos:', error);
    return { data: [], total: 0, page, limit };
  }
};

// ============================================================
// PASTAS
// ============================================================

const createPasta = async (data) => {
  const { nome, descricao, pasta_pai_id, usuario_id, cor, icone } = data;

  try {
    const result = await query(
      `INSERT INTO pastas (nome, descricao, pasta_pai_id, usuario_id, cor, icone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nome, descricao || null, pasta_pai_id || null, parseInt(usuario_id), cor || '#FF6B00', icone || '📁']
    );
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Erro ao criar pasta:', error);
    throw error;
  }
};

const listPastas = async (usuario_id, pasta_pai_id = null) => {
  try {
    let queryText = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM pastas sub WHERE sub.pasta_pai_id = p.id) as subpastas_count,
        (SELECT COUNT(*) FROM arquivo_pasta ap WHERE ap.pasta_id = p.id) as arquivos_count
      FROM pastas p
      WHERE p.usuario_id = $1
    `;
    let values = [parseInt(usuario_id)];

    if (pasta_pai_id !== undefined) {
      if (pasta_pai_id === null) {
        queryText += ` AND p.pasta_pai_id IS NULL`;
      } else {
        queryText += ` AND p.pasta_pai_id = $2`;
        values.push(parseInt(pasta_pai_id));
      }
    }

    queryText += ` ORDER BY p.nome ASC`;

    const result = await query(queryText, values);
    return result.rows || [];
  } catch (error) {
    logger.error('❌ Erro ao listar pastas:', error);
    return [];
  }
};

const findPastaById = async (id) => {
  try {
    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM pastas sub WHERE sub.pasta_pai_id = p.id) as subpastas_count,
        (SELECT COUNT(*) FROM arquivo_pasta ap WHERE ap.pasta_id = p.id) as arquivos_count
      FROM pastas p WHERE p.id = $1`,
      [parseInt(id)]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao buscar pasta ${id}:`, error);
    return null;
  }
};

const updatePasta = async (id, data) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = ['nome', 'descricao', 'cor', 'icone'];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramCount}`);
      values.push(data[field]);
      paramCount++;
    }
  }

  if (fields.length === 0) throw new Error('Nenhum campo para atualizar');
  values.push(parseInt(id));

  const result = await query(
    `UPDATE pastas SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );
  return result.rows[0];
};

const deletePasta = async (id) => {
  try {
    // Move arquivos da pasta para a raiz antes de deletar
    await query('DELETE FROM arquivo_pasta WHERE pasta_id = $1', [parseInt(id)]);
    const result = await query('DELETE FROM pastas WHERE id = $1 RETURNING id', [parseInt(id)]);
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao deletar pasta ${id}:`, error);
    throw error;
  }
};

const addArquivoToPasta = async (arquivo_id, pasta_id) => {
  try {
    await query(
      'INSERT INTO arquivo_pasta (arquivo_id, pasta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [parseInt(arquivo_id), parseInt(pasta_id)]
    );
  } catch (error) {
    logger.error(`❌ Erro ao adicionar arquivo à pasta:`, error);
    throw error;
  }
};

const removeArquivoFromPasta = async (arquivo_id, pasta_id) => {
  try {
    await query(
      'DELETE FROM arquivo_pasta WHERE arquivo_id = $1 AND pasta_id = $2',
      [parseInt(arquivo_id), parseInt(pasta_id)]
    );
  } catch (error) {
    logger.error(`❌ Erro ao remover arquivo da pasta:`, error);
    throw error;
  }
};

// ============================================================
// VERSÕES
// ============================================================

const createVersao = async (data) => {
  const { arquivo_id, nome_original, nome_arquivo, caminho, tamanho, tipo, usuario_id, versao, changelog } = data;

  try {
    const result = await query(
      `INSERT INTO versoes_arquivo (arquivo_id, nome_original, nome_arquivo, caminho, tamanho, tipo, usuario_id, versao, changelog)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [parseInt(arquivo_id), nome_original, nome_arquivo, caminho, parseInt(tamanho) || 0, tipo, parseInt(usuario_id), parseInt(versao), changelog || null]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('❌ Erro ao criar versão:', error);
    throw error;
  }
};

const listVersoes = async (arquivo_id) => {
  try {
    const result = await query(
      `SELECT v.*, u.nome as usuario_nome
       FROM versoes_arquivo v
       LEFT JOIN usuarios u ON v.usuario_id = u.id
       WHERE v.arquivo_id = $1
       ORDER BY v.versao DESC`,
      [parseInt(arquivo_id)]
    );
    return result.rows || [];
  } catch (error) {
    logger.error(`❌ Erro ao listar versões:`, error);
    return [];
  }
};

// ============================================================
// COMPARTILHAMENTOS
// ============================================================

const createCompartilhamento = async (data) => {
  const { arquivo_id, usuario_id, token, data_expiracao, permissoes, max_downloads, senha } = data;

  try {
    const result = await query(
      `INSERT INTO compartilhamentos (arquivo_id, usuario_id, token, data_expiracao, permissoes, max_downloads, senha)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [parseInt(arquivo_id), usuario_id || null, token, data_expiracao || null, permissoes || 'visualizar', parseInt(max_downloads) || 0, senha || null]
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
      `SELECT c.*, a.nome_original, a.caminho, a.tipo, a.tamanho
       FROM compartilhamentos c
       JOIN arquivos a ON c.arquivo_id = a.id
       WHERE c.token = $1 
       AND (c.data_expiracao IS NULL OR c.data_expiracao > NOW())
       AND (c.max_downloads = 0 OR c.downloads_atual < c.max_downloads)`,
      [token]
    );
    return result.rows[0];
  } catch (error) {
    logger.error(`❌ Erro ao buscar compartilhamento ${token}:`, error);
    return null;
  }
};

const incrementCompartilhamentoDownload = async (id) => {
  try {
    await query(
      'UPDATE compartilhamentos SET downloads_atual = downloads_atual + 1 WHERE id = $1',
      [parseInt(id)]
    );
  } catch (error) {
    logger.error(`❌ Erro ao incrementar download do compartilhamento:`, error);
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
    logger.error(`❌ Erro ao listar compartilhamentos:`, error);
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

const listAllCompartilhamentosByUser = async (usuario_id) => {
  try {
    const result = await query(
      `SELECT c.*, a.nome_original, a.caminho, a.tipo, a.categoria, u.nome as criado_por
       FROM compartilhamentos c
       JOIN arquivos a ON c.arquivo_id = a.id
       JOIN usuarios u ON a.usuario_id = u.id
       WHERE a.usuario_id = $1
       ORDER BY c.created_at DESC`,
      [parseInt(usuario_id)]
    );
    return result.rows || [];
  } catch (error) {
    logger.error('❌ Erro ao listar compartilhamentos do usuário:', error);
    return [];
  }
};

// ============================================================
// ESTATÍSTICAS
// ============================================================

const getArquivoStats = async (usuario_id) => {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) as total_arquivos,
        COALESCE(SUM(tamanho), 0) as tamanho_total,
        COALESCE(SUM(downloads), 0) as total_downloads,
        COUNT(*) FILTER (WHERE a.favorito = true) as favoritos,
        COUNT(*) FILTER (WHERE a.destaque = true) as destaques,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '7 days') as arquivos_semana,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - INTERVAL '30 days') as arquivos_mes
      FROM arquivos a
      WHERE a.usuario_id = $1`,
      [parseInt(usuario_id)]
    );

    const categoriasResult = await query(
      `SELECT categoria, COUNT(*) as total, COALESCE(SUM(tamanho), 0) as tamanho
       FROM arquivos WHERE usuario_id = $1
       GROUP BY categoria ORDER BY total DESC`,
      [parseInt(usuario_id)]
    );

    const tiposResult = await query(
      `SELECT 
        CASE 
          WHEN tipo LIKE 'image/%' THEN 'Imagens'
          WHEN tipo LIKE 'application/pdf' THEN 'PDF'
          WHEN tipo LIKE 'application/msword%' OR tipo LIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml%' THEN 'Documentos'
          WHEN tipo LIKE 'application/vnd.ms-excel%' OR tipo LIKE 'application/vnd.openxmlformats-officedocument.spreadsheetml%' THEN 'Planilhas'
          WHEN tipo LIKE 'text/%' THEN 'Texto'
          ELSE 'Outros'
        END as tipo_agrupado,
        COUNT(*) as total,
        COALESCE(SUM(tamanho), 0) as tamanho
       FROM arquivos WHERE usuario_id = $1
       GROUP BY tipo_agrupado ORDER BY total DESC`,
      [parseInt(usuario_id)]
    );

    return {
      geral: result.rows[0] || {
        total_arquivos: 0, tamanho_total: 0, total_downloads: 0,
        favoritos: 0, destaques: 0, arquivos_semana: 0, arquivos_mes: 0
      },
      categorias: categoriasResult.rows || [],
      tipos: tiposResult.rows || []
    };
  } catch (error) {
    logger.error('❌ Erro ao buscar stats de arquivos:', error);
    return { geral: {}, categorias: [], tipos: [] };
  }
};

// ============================================================
// BULK OPERATIONS
// ============================================================

const bulkDelete = async (ids) => {
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `DELETE FROM arquivos WHERE id IN (${placeholders}) RETURNING id, caminho, nome_arquivo`,
      ids.map(id => parseInt(id))
    );
    return result.rows;
  } catch (error) {
    logger.error('❌ Erro ao deletar múltiplos arquivos:', error);
    throw error;
  }
};

const bulkUpdateCategoria = async (ids, categoria) => {
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await query(
      `UPDATE arquivos SET categoria = $${ids.length + 1} WHERE id IN (${placeholders})`,
      [...ids.map(id => parseInt(id)), categoria]
    );
  } catch (error) {
    logger.error('❌ Erro ao atualizar categorias:', error);
    throw error;
  }
};

const bulkAddToPasta = async (ids, pasta_id) => {
  try {
    const values = ids.map((id, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
    const params = ids.flatMap(id => [parseInt(id), parseInt(pasta_id)]);
    await query(
      `INSERT INTO arquivo_pasta (arquivo_id, pasta_id) VALUES ${values} ON CONFLICT DO NOTHING`,
      params
    );
  } catch (error) {
    logger.error('❌ Erro ao adicionar arquivos à pasta:', error);
    throw error;
  }
};

// ============================================================
// EXPORTAÇÃO
// ============================================================

module.exports = {
  // Arquivos
  createArquivo,
  listArquivos,
  findArquivoById,
  findArquivosByPagamento,
  findArquivosByCliente,
  updateArquivo,
  deleteArquivo,
  incrementDownloads,

  // Favoritos
  toggleFavorito,
  listFavoritos,

  // Pastas
  createPasta,
  listPastas,
  findPastaById,
  updatePasta,
  deletePasta,
  addArquivoToPasta,
  removeArquivoFromPasta,

  // Versões
  createVersao,
  listVersoes,

  // Compartilhamentos
  createCompartilhamento,
  findCompartilhamentoByToken,
  incrementCompartilhamentoDownload,
  listCompartilhamentos,
  deleteCompartilhamento,
  listAllCompartilhamentosByUser,

  // Estatísticas
  getArquivoStats,

  // Bulk
  bulkDelete,
  bulkUpdateCategoria,
  bulkAddToPasta
};