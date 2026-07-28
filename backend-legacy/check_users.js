const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('❌ Erro na autenticação:', error);
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado'
    });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.perfil !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem realizar esta ação.'
    });
  }
  next();
};

module.exports = { auth, isAdmin };