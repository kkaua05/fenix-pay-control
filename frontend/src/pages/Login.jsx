import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const Login = () => {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Se já estiver autenticado, redirecionar
  if (isAuthenticated) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!usuario || !senha) {
      showToast('Preencha todos os campos', 'error');
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(usuario, senha);
      
      if (result.success) {
        // O login já faz o redirect
        return;
      }
    } catch (error) {
      console.error('❌ Erro no login:', error);
      showToast('Erro ao fazer login', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0A0C10',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background com gradiente e efeitos */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255, 107, 0, 0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-40%',
        left: '-20%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255, 107, 0, 0.05) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .login-card {
          animation: slideUp 0.6s ease forwards;
        }
        .mascot-container {
          animation: pulse 3s ease-in-out infinite;
        }
        .input-focus {
          transition: all 0.3s ease;
        }
        .input-focus:focus {
          border-color: #FF6B00;
          box-shadow: 0 0 0 4px rgba(255, 107, 0, 0.1);
        }
        .btn-primary {
          background: linear-gradient(135deg, #FF6B00, #FF9A2F);
          color: #FFFFFF;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(255, 107, 0, 0.3);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .btn-primary::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: width 0.6s, height 0.6s, top 0.6s, left 0.6s;
        }
        .btn-primary:hover:not(:disabled)::after {
          width: 300px;
          height: 300px;
          top: -100px;
          left: -100px;
        }
      `}</style>

      <div className="login-card" style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(22, 26, 34, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '48px 40px',
        border: '1px solid rgba(255, 107, 0, 0.15)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(255, 107, 0, 0.05)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Mascote */}
        <div className="mascot-container" style={{
          textAlign: 'center',
          marginBottom: '24px',
          position: 'relative'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto',
            background: 'linear-gradient(135deg, #FF6B00, #FF9A2F)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.8rem',
            boxShadow: '0 8px 32px rgba(255, 107, 0, 0.3)',
            position: 'relative',
            transition: 'all 0.3s ease'
          }}>
            <span style={{ 
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
              lineHeight: 1
            }}>🔥</span>
            
            <div style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 107, 0, 0.2)',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
          </div>
          
          <div style={{
            marginTop: '12px',
            fontSize: '0.75rem',
            color: '#6B7280',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            Fênix Pay Control
          </div>
        </div>

        {/* Título */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #FF6B00, #FF9A2F)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '4px'
          }}>
            Bem-vindo de volta
          </h1>
          <p style={{
            color: '#6B7280',
            fontSize: '0.9rem',
            fontWeight: '400'
          }}>
            Acesse sua conta para continuar
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div className="input-group" style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#B0B8C8',
              fontSize: '0.8rem',
              fontWeight: '500',
              letterSpacing: '0.5px'
            }}>
              👤 Usuário
            </label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Digite seu usuário"
              autoComplete="username"
              required
              className="input-focus"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: '#1A1F2A',
                border: '1px solid #2A3040',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '0.95rem',
                transition: 'all 0.3s ease',
                outline: 'none'
              }}
            />
          </div>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: '#B0B8C8',
              fontSize: '0.8rem',
              fontWeight: '500',
              letterSpacing: '0.5px'
            }}>
              🔒 Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                required
                className="input-focus"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  paddingRight: '48px',
                  background: '#1A1F2A',
                  border: '1px solid #2A3040',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '0.95rem',
                  transition: 'all 0.3s ease',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  padding: '4px',
                  transition: 'color 0.3s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#B0B8C8'}
                onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#6B7280',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                style={{
                  accentColor: '#FF6B00',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              Lembrar acesso
            </label>
            <a
              href="#"
              style={{
                color: '#FF6B00',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#FF9A2F'}
              onMouseLeave={e => e.currentTarget.style.color = '#FF6B00'}
            >
              Esqueceu a senha?
            </a>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Entrando...
              </span>
            ) : (
              '🚀 Entrar'
            )}
          </button>
        </form>

        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: '0.75rem'
        }}>
          <p>Fênix Internet © {new Date().getFullYear()}</p>
          <p style={{
            marginTop: '4px',
            color: '#3A4050',
            fontSize: '0.7rem',
            letterSpacing: '1px'
          }}>
            Sistema de Controle de Pagamentos
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;