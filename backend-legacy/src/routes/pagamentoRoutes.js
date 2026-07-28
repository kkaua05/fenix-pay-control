const router = require('express').Router();
const pagamentoController = require('../controllers/pagamentoController');
const { auth, isAdmin } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Rotas de pagamentos
router.get('/', auth, pagamentoController.getAll);
router.get('/dashboard', auth, pagamentoController.getDashboard);
router.get('/:id', auth, pagamentoController.getById);
router.post('/', auth, upload.single('comprovante'), pagamentoController.create);
router.put('/:id', auth, upload.single('comprovante'), pagamentoController.update);
router.delete('/:id', auth, isAdmin, pagamentoController.delete);

module.exports = router;