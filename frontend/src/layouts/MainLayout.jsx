import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import mascote from '../assets/mascote.png';

const SIDEBAR_COLLAPSED_KEY = 'fenix_sidebar_collapsed';

const MainLayout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [imageError, setImageError] = useState(false);
  const [clock, setClock] = useState(new Date());

  const navRef = useRef(null);
  const itemRefs = useRef({});
  const [pill, setPill] = useState({ top: 0, height: 0, opacity: 0 });
  const [pillReady, setPillReady] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = useMemo(() => [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/pagamentos', label: 'Pagamentos', icon: '💳' },
    { path: '/pagamentos/novo', label: 'Novo Pagamento', icon: '➕' },
    { path: '/pagamento-rapido', label: 'Pagamento Rápido', icon: '📸' },
    { path: '/clientes', label: 'Clientes', icon: '👤' },
    { path: '/arquivos', label: 'Arquivos', icon: '📁' },
    { path: '/faturas/buscar', label: 'Buscar Fatura/Boletos', icon: '🤖' },
    { path: '/relatorios', label: 'Relatórios', icon: '📈' },
    ...(isAdmin ? [{ path: '/usuarios', label: 'Usuários', icon: '👥' }] : []),
    ...(isAdmin ? [{ path: '/auditoria', label: 'Auditoria', icon: '🔍' }] : [])
  ], [isAdmin]);

  const isActive = (path) => location.pathname === path;
  const activeItem = useMemo(
    () => menuItems.find(item => isActive(item.path)),
    [menuItems, location.pathname]
  );
  const activePath = activeItem?.path || null;

  const recomputePill = useCallback(() => {
    const el = activePath ? itemRefs.current[activePath] : null;
    if (el && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const next = { top: elRect.top - navRect.top, height: elRect.height, opacity: 1 };
      setPill(prev => (
        prev.top === next.top && prev.height === next.height && prev.opacity === next.opacity
          ? prev
          : next
      ));
    } else {
      setPill(prev => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
    }
  }, [activePath]);

  useLayoutEffect(() => {
    recomputePill();
    const raf = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(raf);
  }, [recomputePill, collapsed]);

  useEffect(() => {
    window.addEventListener('resize', recomputePill);
    return () => window.removeEventListener('resize', recomputePill);
  }, [recomputePill]);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* noop */ }
      return next;
    });
  };

  const handleImageError = () => setImageError(true);

  const sidebarWidth = isMobile ? 270 : (collapsed ? 84 : 270);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{
        width: `${sidebarWidth}px`,
        background: 'linear-gradient(180deg, #11151A 0%, #0D1015 100%)',
        borderRight: '1px solid var(--border-subtle)',
        padding: '22px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'transform 0.35s var(--ease), width 0.3s var(--ease-soft)',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Blob decorativo */}
        <div aria-hidden style={{
          position: 'absolute', top: '-60px', left: '-60px', width: '200px', height: '200px',
          background: 'radial-gradient(circle, rgba(255,107,0,0.10), transparent 70%)',
          borderRadius: '50%', animation: 'floatBlob 9s ease-in-out infinite', pointerEvents: 'none'
        }} />

        {/* Logo */}
        <div style={{ padding: collapsed && !isMobile ? '0 16px' : '0 24px', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
          <Link to="/dashboard" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            textDecoration: 'none',
            justifyContent: collapsed && !isMobile ? 'center' : 'flex-start'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--orange-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(255, 107, 0, 0.35)',
              padding: '4px',
              flexShrink: 0,
              overflow: 'hidden'
            }}>
              {!imageError ? (
                <img
                  src={mascote}
                  alt="Fênix Mascote"
                  style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover', background: '#11151A' }}
                  onError={handleImageError}
                />
              ) : (
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🔥</span>
              )}
            </div>
            {(!collapsed || isMobile) && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#FFFFFF', letterSpacing: '-0.5px', fontFamily: 'var(--font-display)' }}>
                  Fênix Pay
                </div>
                <div style={{ color: 'var(--orange-primary)', fontSize: '0.6rem', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.85 }}>
                  Control
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Menu */}
        <nav ref={navRef} style={{ flex: 1, padding: collapsed && !isMobile ? '0 10px' : '0 12px', position: 'relative' }}>
          {(!collapsed || isMobile) && (
            <div style={{ padding: '0 12px 8px', color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
              Menu Principal
            </div>
          )}

          {/* Indicador deslizante */}
          <div style={{
            position: 'absolute',
            left: '4px',
            right: '4px',
            top: `${pill.top}px`,
            height: `${pill.height}px`,
            opacity: pill.opacity,
            background: 'rgba(255, 107, 0, 0.14)',
            border: '1px solid rgba(255, 107, 0, 0.25)',
            borderRadius: '10px',
            boxShadow: '0 0 20px rgba(255,107,0,0.12)',
            transition: pillReady ? 'top 0.4s var(--ease), height 0.4s var(--ease), opacity 0.25s' : 'none',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {menuItems.map(item => (
            <Link
              key={item.path}
              ref={el => { itemRefs.current[item.path] = el; }}
              to={item.path}
              title={collapsed && !isMobile ? item.label : undefined}
              onClick={() => { if (isMobile) setSidebarOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                margin: '2px 0',
                borderRadius: '10px',
                color: isActive(item.path) ? '#FFFFFF' : 'var(--text-secondary)',
                transition: 'color 0.2s var(--ease-soft)',
                textDecoration: 'none',
                position: 'relative',
                zIndex: 1,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start'
              }}
              onMouseEnter={e => { if (!isActive(item.path)) e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={e => { if (!isActive(item.path)) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <span style={{ fontSize: '1.2rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {(!collapsed || isMobile) && (
                <span style={{ fontSize: '0.9rem', fontWeight: isActive(item.path) ? '600' : '400', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
              {isActive(item.path) && (!collapsed || isMobile) && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--orange-primary)', boxShadow: '0 0 12px rgba(255, 107, 0, 0.6)' }} />
              )}
            </Link>
          ))}
        </nav>

        {/* Toggle recolher (desktop) */}
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            style={{
              margin: '8px 12px',
              padding: '8px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'var(--transition)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange-primary)'; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.3s var(--ease)', transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              «
            </span>
          </button>
        )}

        {/* Footer Sidebar */}
        <div style={{ padding: collapsed && !isMobile ? '16px 12px' : '16px 24px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', background: 'var(--orange-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '1rem', color: '#FFFFFF', flexShrink: 0
            }}>
              {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {(!collapsed || isMobile) && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.nome || 'Usuário'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="status-dot success" style={{ marginRight: 0 }} />
                  {user?.perfil || 'Funcionário'}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            title="Sair"
            style={{
              width: '100%', padding: '10px', borderRadius: '10px', background: 'var(--error-bg)', color: 'var(--error)',
              fontSize: '0.85rem', transition: 'var(--transition)', border: 'none', fontWeight: '500', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 59, 92, 0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--error-bg)'}
          >
            🚪 {(!collapsed || isMobile) && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Overlay Mobile */}
      {sidebarOpen && isMobile && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, animation: 'fadeIn 0.2s ease' }}
        />
      )}

      {/* Toggle Mobile */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed', top: '16px', left: sidebarOpen ? `${sidebarWidth + 10}px` : '16px', zIndex: 1001,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 14px',
          color: '#FFFFFF', fontSize: '1.2rem', transition: 'left 0.35s var(--ease)', cursor: 'pointer',
          display: isMobile ? 'block' : 'none'
        }}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Main Content */}
      <main style={{
        marginLeft: isMobile ? '0' : `${sidebarWidth}px`,
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.3s var(--ease-soft)',
        paddingTop: isMobile ? '64px' : '0'
      }}>
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 32px', borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(17, 21, 26, 0.55)', backdropFilter: 'blur(10px)',
            position: 'sticky', top: 0, zIndex: 50
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <span style={{ fontSize: '1.05rem' }}>{activeItem?.icon || '🔥'}</span>
              <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{activeItem?.label || 'Fênix Pay Control'}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)',
              background: 'var(--bg-elevated)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)'
            }}>
              <span className="status-dot success" style={{ marginRight: 0 }} />
              {clock.toLocaleString('pt-BR')}
            </div>
          </div>
        )}
        <div key={location.pathname} style={{ animation: 'fadeInUp 0.4s var(--ease) both' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
