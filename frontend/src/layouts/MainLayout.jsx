import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import mascote from '../assets/mascote.png';

const MainLayout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/pagamentos', label: 'Pagamentos', icon: '💳' },
    { path: '/pagamentos/novo', label: 'Novo Pagamento', icon: '➕' },
    { path: '/pagamento-rapido', label: 'Pagamento Rápido', icon: '📸' },
    { path: '/clientes', label: 'Clientes', icon: '👤' },
    { path: '/arquivos', label: 'Arquivos', icon: '📁' },
    { path: '/faturas/buscar', label: 'Buscar Fatura', icon: '🤖' },
    { path: '/relatorios', label: 'Relatórios', icon: '📈' },
    ...(isAdmin ? [{ path: '/usuarios', label: 'Usuários', icon: '👥' }] : []),
    ...(isAdmin ? [{ path: '/auditoria', label: 'Auditoria', icon: '🔍' }] : [])
  ];

  const isActive = (path) => location.pathname === path;

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0C10' }}>
      {/* Sidebar */}
      <aside style={{
        width: '270px',
        background: '#11151A',
        borderRight: '1px solid #1A2030',
        padding: '24px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        transition: 'transform 0.3s ease',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo com Mascote */}
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <Link to="/dashboard" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '14px', 
            textDecoration: 'none' 
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FF6B00, #FF9A2F)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(255, 107, 0, 0.3)',
              padding: '4px',
              flexShrink: 0,
              overflow: 'hidden'
            }}>
              {!imageError ? (
                <img 
                  src={mascote} 
                  alt="Fênix Mascote" 
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    background: '#11151A'
                  }}
                  onError={handleImageError}
                />
              ) : (
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🔥</span>
              )}
            </div>
            <div>
              <div style={{ 
                fontWeight: '700', 
                fontSize: '1.1rem', 
                color: '#FFFFFF',
                letterSpacing: '-0.5px'
              }}>
                Fênix Pay
              </div>
              <div style={{ 
                color: '#FF6B00', 
                fontSize: '0.6rem', 
                letterSpacing: '2px', 
                textTransform: 'uppercase',
                opacity: 0.8
              }}>
                Control
              </div>
            </div>
          </Link>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '0 12px' }}>
          <div style={{ 
            padding: '0 12px 8px', 
            color: '#6B7280', 
            fontSize: '0.65rem', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            fontWeight: '600'
          }}>
            Menu Principal
          </div>
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                margin: '2px 0',
                borderRadius: '10px',
                color: isActive(item.path) ? '#FFFFFF' : '#B0B8C8',
                transition: 'all 0.2s ease',
                background: isActive(item.path) ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
                border: isActive(item.path) ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid transparent',
                textDecoration: 'none'
              }}
              onMouseEnter={e => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.color = '#FFFFFF';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.color = '#B0B8C8';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '1.2rem', width: '28px', textAlign: 'center' }}>
                {item.icon}
              </span>
              <span style={{ 
                fontSize: '0.9rem', 
                fontWeight: isActive(item.path) ? '600' : '400',
                flex: 1
              }}>
                {item.label}
              </span>
              {isActive(item.path) && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#FF6B00',
                  boxShadow: '0 0 12px rgba(255, 107, 0, 0.6)'
                }} />
              )}
            </Link>
          ))}
        </nav>

        {/* Footer Sidebar */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #1A2030',
          marginTop: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FF6B00, #FF9A2F)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '1rem',
              color: '#FFFFFF'
            }}>
              {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontSize: '0.9rem', 
                fontWeight: '500', 
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {user?.nome || 'Usuário'}
              </div>
              <div style={{ 
                fontSize: '0.7rem', 
                color: '#6B7280',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#00E676',
                  display: 'inline-block'
                }} />
                {user?.perfil || 'Funcionário'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: 'rgba(255, 23, 68, 0.1)',
              color: '#FF1744',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              border: 'none',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.1)'}
          >
            🚪 Sair
          </button>
        </div>
      </aside>

      {/* Overlay Mobile */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 999
          }}
        />
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '16px',
          left: sidebarOpen ? '280px' : '16px',
          zIndex: 1001,
          background: '#161A22',
          border: '1px solid #2A3040',
          borderRadius: '10px',
          padding: '10px 14px',
          color: '#FFFFFF',
          fontSize: '1.2rem',
          transition: 'left 0.3s ease',
          cursor: 'pointer',
          display: window.innerWidth < 768 ? 'block' : 'none'
        }}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Main Content */}
      <main style={{
        marginLeft: window.innerWidth < 768 ? '0' : '270px',
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease',
        paddingTop: window.innerWidth < 768 ? '64px' : '0'
      }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          main {
            margin-left: 0 !important;
          }
        }
        aside::-webkit-scrollbar {
          width: 4px;
        }
        aside::-webkit-scrollbar-track {
          background: transparent;
        }
        aside::-webkit-scrollbar-thumb {
          background: #2A3040;
          border-radius: 2px;
        }
        aside::-webkit-scrollbar-thumb:hover {
          background: #FF6B00;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MainLayout;