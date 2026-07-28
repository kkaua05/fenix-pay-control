const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const arquivoQueries = require('../models/arquivoQueries');
const { createLog } = require('../models/database');
const logger = require('../utils/logger');
const { getIO } = require('../services/socketService');

const uploadBaseDir = path.join(__dirname, '../../uploads/arquivos');

const CATEGORIAS_VALIDAS = ['comprovante', 'documento', 'contrato', 'nota_fiscal', 'recibo', 'imagem', 'pdf', 'planilha', 'outro'];

const ensureDirectories = () => {
  CATEGORIAS_VALIDAS.forEach(dir => {
    const fullPath = path.join(uploadBaseDir, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  });
};
ensureDirectories();

// ============================================================
// LISTAR ARQUIVOS
// ============================================================
const getAll = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, categoria, tipo, pagamento_id,
      cliente_id, pasta_id, favorito, destaque, orderBy,
      data_inicio, data_fim, tamanho_min, tamanho_max
    } = req.query;

    const filters = {
      search, categoria, tipo, pagamento_id, cliente_id,
      pasta_id, favorito: favorito === 'true', destaque: destaque === 'true',
      orderBy, data_inicio, data_fim, tamanho_min, tamanho_max
    };

    if (req.user.perfil !== 'ADMIN') filters.usuario_id = req.user.id;

    const pagination = { page: parseInt(page), limit: parseInt(limit) };
    const result = await arquivoQueries.listArquivos(filters, pagination);

    return res.json({
      success: true,
      data: result.data || [],
      pagination: {
        page: result.page || 1,
        limit: result.limit || 20,
        total: result.total || 0,
        pages: Math.ceil((result.total || 0) / (result.limit || 20)),
        totalSize: result.totalSize || 0
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao listar arquivos:', error);
    return res.status(500).json({ success: false, message: 'Erro ao carregar arquivos' });
  }
};

// ============================================================
// BUSCAR ARQUIVO POR ID
// ============================================================
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const arquivo = await arquivoQueries.findArquivoById(parseInt(id));
    if (!arquivo) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    return res.json({ success: true, data: arquivo });
  } catch (error) {
    logger.error(`❌ Erro ao buscar arquivo:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao carregar arquivo' });
  }
};

// ============================================================
// BUSCAR ARQUIVOS POR PAGAMENTO/CLIENTE
// ============================================================
const getByPagamento = async (req, res) => {
  try {
    const { pagamento_id } = req.params;
    const data = await arquivoQueries.findArquivosByPagamento(parseInt(pagamento_id));
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao carregar arquivos' });
  }
};

const getByCliente = async (req, res) => {
  try {
    const { cliente_id } = req.params;
    const data = await arquivoQueries.findArquivosByCliente(parseInt(cliente_id));
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao carregar arquivos' });
  }
};

// ============================================================
// UPLOAD DE ARQUIVO
// ============================================================
const upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });

    const { categoria, descricao, tags, pagamento_id, cliente_id, publico, data_expiracao } = req.body;

    const ext = path.extname(req.file.originalname).toLowerCase();
    let catFinal = categoria || 'outro';
    if (!categoria || categoria === 'auto') {
      const img = ['.jpg','.jpeg','.png','.gif','.webp'];
      const docs = ['.doc','.docx','.txt','.rtf','.odt'];
      const sheets = ['.xls','.xlsx','.csv'];
      if (img.includes(ext)) catFinal = 'imagem';
      else if (ext === '.pdf') catFinal = 'pdf';
      else if (docs.includes(ext)) catFinal = 'documento';
      else if (sheets.includes(ext)) catFinal = 'planilha';
      else catFinal = 'outro';
    }

    const arquivo = await arquivoQueries.createArquivo({
      nome_original: req.file.originalname,
      nome_arquivo: req.file.filename,
      caminho: req.file.path,
      tamanho: req.file.size,
      tipo: req.file.mimetype,
      categoria: catFinal,
      descricao: descricao || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : null,
      pagamento_id: pagamento_id || null,
      cliente_id: cliente_id || null,
      usuario_id: req.user.id,
      publico: publico === 'true' || publico === true,
      data_expiracao: data_expiracao || null
    });

    await createLog({
      usuario: req.user.nome, usuario_id: req.user.id,
      acao: 'UPLOAD_ARQUIVO',
      descricao: `Upload: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`,
      ip: req.ip, navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    const io = getIO();
    if (io) io.emit('arquivo:uploaded', { ...arquivo, usuario_nome: req.user.nome });

    return res.status(201).json({ success: true, data: arquivo, message: '✅ Arquivo enviado!' });
  } catch (error) {
    logger.error('❌ Erro no upload:', error);
    return res.status(500).json({ success: false, message: 'Erro ao enviar arquivo' });
  }
};

// ============================================================
// DOWNLOAD
// ============================================================
const download = async (req, res) => {
  try {
    const { id } = req.params;
    const arquivo = await arquivoQueries.findArquivoById(parseInt(id));
    if (!arquivo) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    if (!fs.existsSync(arquivo.caminho)) return res.status(404).json({ success: false, message: 'Arquivo físico não encontrado' });

    await arquivoQueries.incrementDownloads(parseInt(id));
    return res.download(arquivo.caminho, arquivo.nome_original);
  } catch (error) {
    logger.error(`❌ Erro no download:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao baixar arquivo' });
  }
};

// ============================================================
// ATUALIZAR METADADOS
// ============================================================
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { descricao, tags, categoria, publico, destaque, data_expiracao } = req.body;

    const existente = await arquivoQueries.findArquivoById(parseInt(id));
    if (!existente) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });

    const data = {};
    if (descricao !== undefined) data.descricao = descricao;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    if (categoria !== undefined) data.categoria = categoria;
    if (publico !== undefined) data.publico = publico === 'true' || publico === true;
    if (destaque !== undefined) data.destaque = destaque === 'true' || destaque === true;
    if (data_expiracao !== undefined) data.data_expiracao = data_expiracao || null;

    const arquivo = await arquivoQueries.updateArquivo(parseInt(id), data);
    return res.json({ success: true, data: arquivo, message: '✅ Arquivo atualizado!' });
  } catch (error) {
    logger.error(`❌ Erro ao atualizar:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar' });
  }
};

// ============================================================
// EXCLUIR
// ============================================================
const delete_ = async (req, res) => {
  try {
    const { id } = req.params;
    const existente = await arquivoQueries.findArquivoById(parseInt(id));
    if (!existente) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });

    if (fs.existsSync(existente.caminho)) fs.unlinkSync(existente.caminho);
    if (existente.versoes && existente.versoes.length > 0) {
      existente.versoes.forEach(v => { if (v.caminho && fs.existsSync(v.caminho)) fs.unlinkSync(v.caminho); });
    }

    await arquivoQueries.deleteArquivo(parseInt(id));

    await createLog({
      usuario: req.user.nome, usuario_id: req.user.id, acao: 'DELETE_ARQUIVO',
      descricao: `Excluiu: ${existente.nome_original}`,
      ip: req.ip, navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    const io = getIO();
    if (io) io.emit('arquivo:deleted', { id: parseInt(id), usuario_nome: req.user.nome });

    return res.json({ success: true, message: '🗑️ Arquivo excluído!' });
  } catch (error) {
    logger.error(`❌ Erro ao excluir:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir' });
  }
};

// ============================================================
// FAVORITOS
// ============================================================
const favoritar = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await arquivoQueries.toggleFavorito(parseInt(id), req.user.id);
    return res.json({
      success: true, data: result,
      message: result.favorito ? '⭐ Favoritado!' : '⭐ Desfavoritado'
    });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao favoritar' });
  }
};

const getFavoritos = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await arquivoQueries.listFavoritos(req.user.id, { page: parseInt(page), limit: parseInt(limit) });
    return res.json({
      success: true, data: result.data,
      pagination: { page: result.page, limit: result.limit, total: result.total, pages: Math.ceil(result.total / result.limit) }
    });
  } catch (error) {
    logger.error('❌ Erro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao listar favoritos' });
  }
};

// ============================================================
// PASTAS
// ============================================================
const criarPasta = async (req, res) => {
  try {
    const { nome, descricao, pasta_pai_id, cor, icone } = req.body;
    if (!nome || !nome.trim()) return res.status(400).json({ success: false, message: 'Nome obrigatório' });

    const pasta = await arquivoQueries.createPasta({
      nome: nome.trim(), descricao: descricao || null,
      pasta_pai_id: pasta_pai_id || null, usuario_id: req.user.id,
      cor: cor || '#FF6B00', icone: icone || '📁'
    });
    return res.status(201).json({ success: true, data: pasta, message: '📁 Pasta criada!' });
  } catch (error) {
    logger.error('❌ Erro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao criar pasta' });
  }
};

const listarPastas = async (req, res) => {
  try {
    const { pasta_pai_id } = req.query;
    const pastas = await arquivoQueries.listPastas(req.user.id, pasta_pai_id !== undefined ? (pasta_pai_id ? parseInt(pasta_pai_id) : null) : undefined);
    return res.json({ success: true, data: pastas || [] });
  } catch (error) {
    logger.error('❌ Erro:', error);
    return res.status(500).json({ success: false, message: 'Erro ao listar pastas' });
  }
};

const getPastaById = async (req, res) => {
  try {
    const { id } = req.params;
    const pasta = await arquivoQueries.findPastaById(parseInt(id));
    if (!pasta) return res.status(404).json({ success: false, message: 'Pasta não encontrada' });
    return res.json({ success: true, data: pasta });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao buscar pasta' });
  }
};

const atualizarPasta = async (req, res) => {
  try {
    const { id } = req.params;
    const data = {};
    ['nome','descricao','cor','icone'].forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    const pasta = await arquivoQueries.updatePasta(parseInt(id), data);
    return res.json({ success: true, data: pasta, message: '📁 Pasta atualizada!' });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar pasta' });
  }
};

const excluirPasta = async (req, res) => {
  try {
    const { id } = req.params;
    await arquivoQueries.deletePasta(parseInt(id));
    return res.json({ success: true, message: '🗑️ Pasta excluída!' });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao excluir pasta' });
  }
};

const moverParaPasta = async (req, res) => {
  try {
    const { id } = req.params;
    const { pasta_id, remover } = req.body;
    if (remover) {
      await arquivoQueries.removeArquivoFromPasta(parseInt(id), parseInt(pasta_id));
      return res.json({ success: true, message: '📦 Removido da pasta' });
    }
    if (pasta_id) {
      await arquivoQueries.addArquivoToPasta(parseInt(id), parseInt(pasta_id));
      return res.json({ success: true, message: '📦 Movido para pasta!' });
    }
    return res.status(400).json({ success: false, message: 'pasta_id obrigatório' });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao mover' });
  }
};

// ============================================================
// VERSÕES
// ============================================================
const uploadNovaVersao = async (req, res) => {
  try {
    const { id } = req.params;
    const { changelog } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });

    const existente = await arquivoQueries.findArquivoById(parseInt(id));
    if (!existente) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });

    await arquivoQueries.createVersao({
      arquivo_id: parseInt(id), nome_original: existente.nome_original,
      nome_arquivo: existente.nome_arquivo, caminho: existente.caminho,
      tamanho: existente.tamanho, tipo: existente.tipo,
      usuario_id: req.user.id, versao: existente.versao,
      changelog: changelog || 'Versão anterior'
    });

    const novaVersao = (existente.versao || 1) + 1;
    const r = await query(
      `UPDATE arquivos SET nome_arquivo=$1,caminho=$2,tamanho=$3,tipo=$4,versao=$5,updated_at=NOW() WHERE id=$6 RETURNING *`,
      [req.file.filename, req.file.path, req.file.size, req.file.mimetype, novaVersao, parseInt(id)]
    );

    return res.json({ success: true, data: r.rows[0], message: `📝 Versão ${novaVersao} salva!` });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao criar versão' });
  }
};

const listarVersoes = async (req, res) => {
  try {
    const { id } = req.params;
    const versoes = await arquivoQueries.listVersoes(parseInt(id));
    return res.json({ success: true, data: versoes || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao listar versões' });
  }
};

// ============================================================
// COMPARTILHAMENTOS
// ============================================================
const compartilhar = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, data_expiracao, permissoes, max_downloads } = req.body;

    const arquivo = await arquivoQueries.findArquivoById(parseInt(id));
    if (!arquivo) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });

    const token = uuidv4().substring(0, 8).toUpperCase();
    const comp = await arquivoQueries.createCompartilhamento({
      arquivo_id: parseInt(id), usuario_id: usuario_id || null, token,
      data_expiracao: data_expiracao || null,
      permissoes: permissoes || 'visualizar',
      max_downloads: parseInt(max_downloads) || 0
    });

    const shareUrl = `${req.protocol}://${req.get('host')}/api/arquivos/compartilhar/${token}`;
    return res.json({ success: true, data: { ...comp, url: shareUrl, token }, message: '🔗 Link gerado!' });
  } catch (error) {
    logger.error(`❌ Erro:`, error);
    return res.status(500).json({ success: false, message: 'Erro ao compartilhar' });
  }
};

const acessoCompartilhado = async (req, res) => {
  try {
    const { token } = req.params;
    const comp = await arquivoQueries.findCompartilhamentoByToken(token);
    if (!comp) return res.status(404).json({ success: false, message: 'Link inválido ou expirado' });

    await arquivoQueries.incrementCompartilhamentoDownload(comp.id);
    await arquivoQueries.incrementDownloads(comp.arquivo_id);

    if (!fs.existsSync(comp.caminho)) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    return res.download(comp.caminho, comp.nome_original);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao acessar arquivo' });
  }
};

const listarCompartilhamentos = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await arquivoQueries.listCompartilhamentos(parseInt(id));
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao listar' });
  }
};

const removerCompartilhamento = async (req, res) => {
  try {
    const { id } = req.params;
    await arquivoQueries.deleteCompartilhamento(parseInt(id));
    return res.json({ success: true, message: 'Compartilhamento removido!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao remover' });
  }
};

const listarMeusCompartilhamentos = async (req, res) => {
  try {
    const data = await arquivoQueries.listAllCompartilhamentosByUser(req.user.id);
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao listar' });
  }
};

// ============================================================
// ESTATÍSTICAS
// ============================================================
const getStats = async (req, res) => {
  try {
    const stats = await arquivoQueries.getArquivoStats(req.user.id);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao buscar estatísticas' });
  }
};

// ============================================================
// OPERAÇÕES EM MASSA
// ============================================================
const bulkDeleteHandler = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: 'IDs inválidos' });

    const arquivos = await arquivoQueries.bulkDelete(ids);
    arquivos.forEach(arq => { if (arq.caminho && fs.existsSync(arq.caminho)) fs.unlinkSync(arq.caminho); });

    await createLog({
      usuario: req.user.nome, usuario_id: req.user.id, acao: 'BULK_DELETE_ARQUIVOS',
      descricao: `Excluiu ${ids.length} arquivos em massa`,
      ip: req.ip, navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    return res.json({ success: true, message: `🗑️ ${ids.length} arquivos excluídos!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao excluir em massa' });
  }
};

const bulkUpdateCategoriaHandler = async (req, res) => {
  try {
    const { ids, categoria } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !categoria) return res.status(400).json({ success: false, message: 'Dados inválidos' });
    await arquivoQueries.bulkUpdateCategoria(ids, categoria);
    return res.json({ success: true, message: `📁 ${ids.length} arquivos atualizados!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro ao atualizar' });
  }
};

const uploadMultiplo = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: 'Nenhum arquivo' });
    const { categoria, descricao, tags, pagamento_id, cliente_id } = req.body;
    const resultados = [];

    for (const file of req.files) {
      const arq = await arquivoQueries.createArquivo({
        nome_original: file.originalname, nome_arquivo: file.filename,
        caminho: file.path, tamanho: file.size, tipo: file.mimetype,
        categoria: categoria || 'outro', descricao: descricao || null,
        tags: tags ? tags.split(',').map(t => t.trim()) : null,
        pagamento_id: pagamento_id || null, cliente_id: cliente_id || null,
        usuario_id: req.user.id, publico: false
      });
      resultados.push(arq);
    }

    return res.status(201).json({ success: true, data: resultados, message: `✅ ${resultados.length} arquivo(s) enviado(s)!` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erro no upload múltiplo' });
  }
};

module.exports = {
  getAll, getById, getByPagamento, getByCliente,
  upload, download, update, delete: delete_,
  favoritar, getFavoritos,
  criarPasta, listarPastas, getPastaById, atualizarPasta, excluirPasta, moverParaPasta,
  uploadNovaVersao, listarVersoes,
  compartilhar, acessoCompartilhado, listarCompartilhamentos, removerCompartilhamento, listarMeusCompartilhamentos,
  getStats,
  bulkDelete: bulkDeleteHandler, bulkUpdateCategoria: bulkUpdateCategoriaHandler,
  uploadMultiplo
};