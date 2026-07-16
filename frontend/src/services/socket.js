import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isTriggering = false;
  }

  connect(token) {
    if (this.socket) {
      this.disconnect();
    }

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket conectado!');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket desconectado');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erro na conexão do socket:', error);
    });

    // Configurar listener universal - delega todos os eventos do socket para o sistema de listeners
    this.socket.onAny((event, data) => {
      this.trigger(event, data);
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  trigger(event, data) {
    if (this.isTriggering) return;
    this.isTriggering = true;

    try {
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`❌ Erro no callback do evento ${event}:`, error);
          }
        });
      }
    } finally {
      this.isTriggering = false;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.isTriggering = false;
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

export default new SocketService();