const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const arquivoController = require('../controllers/arquivoController');
const { auth, isAdmin } = require('../middlewares/auth');

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const categoria = req.body.categoria || 'comprovante';
    const uploadPath = path.join(__dirname, '../../uploads/arquivos', categoria);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Rotas de arquivos
router.get('/', auth, arquivoController.getAll);
router.get('/pagamento/:pagamento_id', auth, arquivoController.getByPagamento);
router.get('/:id', auth, arquivoController.getById);
router.get('/:id/download', auth, arquivoController.download);
router.post('/', auth, upload.single('arquivo'), arquivoController.upload);
router.put('/:id', auth, arquivoController.update);
router.delete('/:id', auth, arquivoController.delete);

// Rotas de compartilhamento
router.post('/:id/compartilhar', auth, arquivoController.compartilhar);
router.get('/compartilhar/:token', arquivoController.acessoCompartilhado);
router.get('/:id/compartilhamentos', auth, arquivoController.listCompartilhamentosArquivo);
router.delete('/compartilhamentos/:id', auth, arquivoController.removerCompartilhamento);

module.exports = router;