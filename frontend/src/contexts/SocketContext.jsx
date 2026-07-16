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

  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      if (token) {
        socketService.connect(token);
        setConnected(true);

        // Escutar usuários online
        socketService.on('users:online', (users) => {
          setOnlineUsers(users);
        });

        return () => {
          socketService.disconnect();
          setConnected(false);
        };
      }
    }
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