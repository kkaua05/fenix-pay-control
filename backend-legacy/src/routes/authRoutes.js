const router = require('express').Router();
const { login, verificarToken } = require('../controllers/authController');
const { auth } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/login', authLimiter, login);
router.get('/verify', auth, verificarToken);

module.exports = router;