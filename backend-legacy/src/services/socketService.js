const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;
let connectedUsers = new Map();

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Middleware de autenticação
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Token não fornecido'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userName = decoded.nome;
      socket.userPerfil = decoded.perfil;
      next();
    } catch (error) {
      logger.error('❌ Erro na autenticação do socket:', error);
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userName = socket.userName;
    
    // Registrar usuário conectado
    connectedUsers.set(userId, {
      socketId: socket.id,
      userName: userName,
      perfil: socket.userPerfil,
      connectedAt: new Date()
    });

    logger.info(`✅ Usuário conectado: ${userName} (${userId}) - Socket: ${socket.id}`);
    
    // Emitir lista de usuários online
    io.emit('users:online', getOnlineUsers());

    // Entrar em salas
    socket.join('pagamentos');
    socket.join('dashboard');

    // Eventos de pagamento
    socket.on('pagamento:create', (data) => {
      logger.info(`📝 Pagamento criado por ${userName}:`, data);
      io.to('pagamentos').emit('pagamento:created', {
        ...data,
        usuario_nome: userName,
        created_at: new Date().toISOString()
      });
      // Atualizar dashboard
      io.to('dashboard').emit('dashboard:update', { type: 'create' });
    });

    socket.on('pagamento:update', (data) => {
      logger.info(`📝 Pagamento atualizado por ${userName}:`, data);
      io.to('pagamentos').emit('pagamento:updated', {
        ...data,
        usuario_nome: userName,
        updated_at: new Date().toISOString()
      });
      io.to('dashboard').emit('dashboard:update', { type: 'update' });
    });

    socket.on('pagamento:delete', (data) => {
      logger.info(`🗑️ Pagamento excluído por ${userName}:`, data);
      io.to('pagamentos').emit('pagamento:deleted', data);
      io.to('dashboard').emit('dashboard:update', { type: 'delete' });
    });

    // Eventos de cliente
    socket.on('cliente:create', (data) => {
      logger.info(`📝 Cliente criado por ${userName}:`, data);
      io.emit('cliente:created', {
        ...data,
        usuario_nome: userName,
        created_at: new Date().toISOString()
      });
    });

    socket.on('cliente:update', (data) => {
      logger.info(`📝 Cliente atualizado por ${userName}:`, data);
      io.emit('cliente:updated', {
        ...data,
        usuario_nome: userName,
        updated_at: new Date().toISOString()
      });
    });

    socket.on('cliente:delete', (data) => {
      logger.info(`🗑️ Cliente excluído por ${userName}:`, data);
      io.emit('cliente:deleted', data);
    });

    // Evento de notificação geral
    socket.on('notification:send', (data) => {
      io.emit('notification:received', {
        ...data,
        from: userName,
        timestamp: new Date().toISOString()
      });
    });

    // Desconexão
    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      logger.info(`❌ Usuário desconectado: ${userName} (${userId})`);
      io.emit('users:online', getOnlineUsers());
    });

    // Erro
    socket.on('error', (error) => {
      logger.error(`❌ Erro no socket ${socket.id}:`, error);
    });
  });

  return io;
};

const getOnlineUsers = () => {
  const users = [];
  connectedUsers.forEach((value, key) => {
    users.push({
      id: key,
      nome: value.userName,
      perfil: value.perfil,
      socketId: value.socketId
    });
  });
  return users;
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  getIO,
  emitToAll,
  emitToRoom,
  getOnlineUsers
};