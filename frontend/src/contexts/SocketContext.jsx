import { createContext, useContext, useEffect, useState } from 'react';
import socketService from '../services/socket';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // O backend roda como serverless function no Vercel (sem processo persistente),
  // por isso nao ha servidor socket.io para se conectar. Tentar conectar aqui so
  // gera erros de WebSocket infinitos no console sem nenhum beneficio. `connected`
  // permanece false e os metodos on/off/emit continuam seguros (no-op) via
  // socketService. Reativar isso exigiria hospedar um servidor sempre ativo.
  useEffect(() => {
    setConnected(false);
  }, [isAuthenticated, user]);

  const value = {
    socket: socketService,
    connected,
    onlineUsers,
    emit: (event, data) => socketService.emit(event, data),
    on: (event, callback) => socketService.on(event, callback),
    off: (event, callback) => socketService.off(event, callback)
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};