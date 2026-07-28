const router = require('express').Router();
const clienteController = require('../controllers/clienteController');
const { auth, isAdmin } = require('../middlewares/auth');

// Rotas públicas (autenticadas)
router.get('/', auth, clienteController.getAll);
router.get('/search', auth, clienteController.search);
router.get('/:id', auth, clienteController.getById);

// Rotas administrativas
router.post('/', auth, isAdmin, clienteController.create);
router.put('/:id', auth, isAdmin, clienteController.update);
router.delete('/:id', auth, isAdmin, clienteController.delete);

module.exports = router;