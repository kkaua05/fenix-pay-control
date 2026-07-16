const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
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
  deleteCompartilhamento,
  createLog
} = require('../models/database');
const logger = require('../utils/logger');
const { getIO } = require('../services/socketService');

const uploadDir = path.join(__dirname, '../../uploads/arquivos');

// Garantir que os diretórios existam
const ensureDirectories = () => {
  const dirs = ['comprovantes', 'documentos', 'temporarios'];
  dirs.forEach(dir => {
    const fullPath = path.join(uploadDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};
ensureDirectories();

// Listar arquivos
const getAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      categoria,
      pagamento_id,
      cliente_id
    } = req.query;

    const filters = { 
      search, 
      categoria, 
      pagamento_id, 
      cliente_id, 
      usuario_id: req.user.id 
    };
    const pagination = { 
      page: parseInt(page), 
      limit: parseInt(limit) 
    };

    const result = await listArquivos(filters, pagination);

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
    logger.error('❌ Erro ao listar arquivos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar arquivos',
      error: error.message
    });
  }
};

// Buscar arquivo por ID
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const arquivo = await findArquivoById(parseInt(id));

    if (!arquivo) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    return res.json({
      success: true,
      data: arquivo
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar arquivo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar arquivo',
      error: error.message
    });
  }
};

// Buscar arquivos por pagamento
const getByPagamento = async (req, res) => {
  try {
    const { pagamento_id } = req.params;
    const arquivos = await findArquivosByPagamento(parseInt(pagamento_id));

    return res.json({
      success: true,
      data: arquivos || []
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar arquivos do pagamento ${req.params.pagamento_id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao carregar arquivos',
      error: error.message
    });
  }
};

// Upload de arquivo
const upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    const {
      categoria = 'comprovante',
      descricao,
      tags,
      pagamento_id,
      cliente_id,
      publico = false
    } = req.body;

    const arquivo = await createArquivo({
      nome_original: req.file.originalname,
      nome_arquivo: req.file.filename,
      caminho: req.file.path,
      tamanho: req.file.size,
      tipo: req.file.mimetype,
      categoria,
      descricao: descricao || null,
      tags: tags ? tags.split(',').map(t => t.trim()) : null,
      pagamento_id: pagamento_id || null,
      cliente_id: cliente_id || null,
      usuario_id: req.user.id,
      publico: publico === 'true' || publico === true
    });

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'UPLOAD_ARQUIVO',
      descricao: `Upload de arquivo: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Arquivo enviado por ${req.user.nome}: ${req.file.originalname}`);

    const io = getIO();
    if (io) {
      io.emit('arquivo:uploaded', {
        ...arquivo,
        usuario_nome: req.user.nome
      });
    }

    return res.status(201).json({
      success: true,
      data: arquivo,
      message: 'Arquivo enviado com sucesso!'
    });
  } catch (error) {
    logger.error('❌ Erro no upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao enviar arquivo',
      error: error.message
    });
  }
};

// Download de arquivo
const download = async (req, res) => {
  try {
    const { id } = req.params;
    const arquivo = await findArquivoById(parseInt(id));

    if (!arquivo) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    await incrementDownloads(parseInt(id));

    if (!fs.existsSync(arquivo.caminho)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo físico não encontrado'
      });
    }

    logger.info(`📥 Download do arquivo ${arquivo.nome_original} por ${req.user.nome}`);

    return res.download(arquivo.caminho, arquivo.nome_original);
  } catch (error) {
    logger.error(`❌ Erro no download ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao baixar arquivo',
      error: error.message
    });
  }
};

// Atualizar arquivo
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { descricao, tags, categoria, publico } = req.body;

    const arquivoExistente = await findArquivoById(parseInt(id));

    if (!arquivoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    const arquivo = await updateArquivo(parseInt(id), {
      descricao,
      tags: tags ? tags.split(',').map(t => t.trim()) : null,
      categoria,
      publico: publico === 'true' || publico === true
    });

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'UPDATE_ARQUIVO',
      descricao: `Atualizou arquivo: ${arquivoExistente.nome_original}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`✅ Arquivo ${id} atualizado por ${req.user.nome}`);

    return res.json({
      success: true,
      data: arquivo,
      message: 'Arquivo atualizado com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao atualizar arquivo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar arquivo',
      error: error.message
    });
  }
};

// Excluir arquivo
const delete_ = async (req, res) => {
  try {
    const { id } = req.params;

    const arquivoExistente = await findArquivoById(parseInt(id));

    if (!arquivoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    if (fs.existsSync(arquivoExistente.caminho)) {
      fs.unlinkSync(arquivoExistente.caminho);
    }

    await deleteArquivo(parseInt(id));

    await createLog({
      usuario: req.user.nome,
      usuario_id: req.user.id,
      acao: 'DELETE_ARQUIVO',
      descricao: `Excluiu arquivo: ${arquivoExistente.nome_original}`,
      ip: req.ip,
      navegador: req.headers['user-agent'],
      sistema: req.headers['sec-ch-ua-platform'] || 'Unknown'
    });

    logger.info(`🗑️ Arquivo ${id} excluído por ${req.user.nome}`);

    const io = getIO();
    if (io) {
      io.emit('arquivo:deleted', {
        id: parseInt(id),
        usuario_nome: req.user.nome
      });
    }

    return res.json({
      success: true,
      message: 'Arquivo excluído com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao excluir arquivo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir arquivo',
      error: error.message
    });
  }
};

// Compartilhar arquivo
const compartilhar = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, data_expiracao, permissoes } = req.body;

    const arquivo = await findArquivoById(parseInt(id));

    if (!arquivo) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    const token = uuidv4().substring(0, 8).toUpperCase();

    const compartilhamento = await createCompartilhamento({
      arquivo_id: parseInt(id),
      usuario_id: usuario_id || null,
      token,
      data_expiracao: data_expiracao || null,
      permissoes: permissoes || 'visualizar'
    });

    const shareUrl = `${req.protocol}://${req.get('host')}/api/arquivos/compartilhar/${token}`;

    logger.info(`📤 Arquivo ${id} compartilhado por ${req.user.nome}`);

    return res.json({
      success: true,
      data: {
        ...compartilhamento,
        url: shareUrl,
        token
      },
      message: 'Arquivo compartilhado com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao compartilhar arquivo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao compartilhar arquivo',
      error: error.message
    });
  }
};

// Acessar arquivo compartilhado
const acessoCompartilhado = async (req, res) => {
  try {
    const { token } = req.params;
    const compartilhamento = await findCompartilhamentoByToken(token);

    if (!compartilhamento) {
      return res.status(404).json({
        success: false,
        message: 'Link inválido ou expirado'
      });
    }

    await incrementDownloads(compartilhamento.arquivo_id);

    if (!fs.existsSync(compartilhamento.caminho)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo físico não encontrado'
      });
    }

    return res.download(compartilhamento.caminho, compartilhamento.nome_original);
  } catch (error) {
    logger.error(`❌ Erro ao acessar compartilhamento ${req.params.token}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao acessar arquivo',
      error: error.message
    });
  }
};

// Listar compartilhamentos
const listCompartilhamentosArquivo = async (req, res) => {
  try {
    const { id } = req.params;
    const compartilhamentos = await listCompartilhamentos(parseInt(id));

    return res.json({
      success: true,
      data: compartilhamentos || []
    });
  } catch (error) {
    logger.error(`❌ Erro ao listar compartilhamentos do arquivo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar compartilhamentos',
      error: error.message
    });
  }
};

// Remover compartilhamento
const removerCompartilhamento = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteCompartilhamento(parseInt(id));

    return res.json({
      success: true,
      message: 'Compartilhamento removido com sucesso!'
    });
  } catch (error) {
    logger.error(`❌ Erro ao remover compartilhamento ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao remover compartilhamento',
      error: error.message
    });
  }
};

module.exports = {
  getAll,
  getById,
  getByPagamento,
  upload,
  download,
  update,
  delete: delete_,
  compartilhar,
  acessoCompartilhado,
  listCompartilhamentosArquivo,
  removerCompartilhamento
};