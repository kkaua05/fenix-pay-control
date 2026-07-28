const router = require('express').Router();
const usuarioController = require('../controllers/usuarioController');
const { auth, isAdmin } = require('../middlewares/auth');

router.get('/', auth, isAdmin, usuarioController.getAll);
router.get('/:id', auth, isAdmin, usuarioController.getById);
router.post('/', auth, isAdmin, usuarioController.create);
router.put('/:id', auth, isAdmin, usuarioController.update);
router.put('/:id/reset-password', auth, isAdmin, usuarioController.resetPassword);

module.exports = router;