const router = require('express').Router();
const logController = require('../controllers/logController');
const { auth, isAdmin } = require('../middlewares/auth');

router.get('/', auth, isAdmin, logController.getAll);
router.post('/', auth, isAdmin, logController.create);

module.exports = router;