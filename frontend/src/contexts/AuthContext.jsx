import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../services/api';
import { useToast } from '../hooks/useToast';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    const initializeAuth = () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          if (decoded.exp * 1000 > Date.now()) {
            setUser(decoded);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          } else {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
          }
        } catch {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (usuario, senha) => {
    try {
      const response = await api.post('/auth/login', { usuario, senha });
      
      if (response.data.success) {
        const { token, user: userData } = response.data;

        // Salvar token
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Atualizar estado do usuário
        setUser(userData);
        
        // Mostrar toast de sucesso
        showToast('✅ Login realizado com sucesso!', 'success');
        
        // Redirecionar para dashboard
        navigate('/dashboard', { replace: true });
        
        return { success: true };
      } else {
        showToast(response.data.message || 'Erro ao fazer login', 'error');
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Erro no login:', error);
      const message = error.response?.data?.message || 'Erro ao fazer login';
      showToast(message, 'error');
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    navigate('/login', { replace: true });
    showToast('Logout realizado com sucesso', 'info');
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.perfil === 'ADMIN'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};