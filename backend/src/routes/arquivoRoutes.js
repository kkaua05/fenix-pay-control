const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const c = require('../controllers/arquivoController');
const { auth, isAdmin } = require('../middlewares/auth');

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const categoria = req.body.categoria || 'outro';
    const uploadPath = path.join(__dirname, '../../uploads/arquivos', categoria);
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg','image/png','image/jpg','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv','application/rtf',
    'application/zip','application/x-rar-compressed'
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo de arquivo não suportado'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB
const uploadMultiplo = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================================
// ROTAS PRINCIPAIS
// ============================================================
router.get('/', auth, c.getAll);
router.get('/estatisticas', auth, c.getStats);
router.get('/favoritos', auth, c.getFavoritos);
router.get('/compartilhamentos', auth, c.listarMeusCompartilhamentos);
router.get('/pagamento/:pagamento_id', auth, c.getByPagamento);
router.get('/cliente/:cliente_id', auth, c.getByCliente);
router.get('/:id', auth, c.getById);
router.get('/:id/download', auth, c.download);
router.get('/:id/versoes', auth, c.listarVersoes);
router.get('/:id/compartilhamentos', auth, c.listarCompartilhamentos);

// Upload
router.post('/', auth, upload.single('arquivo'), c.upload);
router.post('/multiplo', auth, uploadMultiplo.array('arquivos', 20), c.uploadMultiplo);
router.post('/:id/versao', auth, upload.single('arquivo'), c.uploadNovaVersao);

// Atualizações
router.put('/:id', auth, c.update);

// Exclusão
router.delete('/:id', auth, c.delete);
router.post('/bulk-delete', auth, c.bulkDelete);
router.post('/bulk-categoria', auth, c.bulkUpdateCategoria);

// Favoritos
router.post('/:id/favoritar', auth, c.favoritar);

// Pastas
router.get('/pastas/listar', auth, c.listarPastas);
router.post('/pastas', auth, c.criarPasta);
router.get('/pastas/:id', auth, c.getPastaById);
router.put('/pastas/:id', auth, c.atualizarPasta);
router.delete('/pastas/:id', auth, c.excluirPasta);
router.post('/:id/pasta', auth, c.moverParaPasta);

// Compartilhamento
router.post('/:id/compartilhar', auth, c.compartilhar);
router.delete('/compartilhamentos/:id', auth, c.removerCompartilhamento);

// Rota pública (acesso via link)
router.get('/compartilhar/:token', c.acessoCompartilhado);

module.exports = router;