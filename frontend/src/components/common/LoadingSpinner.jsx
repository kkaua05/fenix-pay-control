const LoadingSpinner = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--bg-primary, #0A0C10)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
        <div style={{ position: 'relative', width: '56px', height: '56px' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '4px solid rgba(255, 107, 0, 0.15)'
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '4px solid transparent',
            borderTopColor: '#FF6B00',
            borderRightColor: '#FF9A2F',
            animation: 'spin 0.9s linear infinite'
          }} />
          <div style={{
            position: 'absolute', inset: '14px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF6B00, #FF9A2F)',
            boxShadow: '0 0 20px rgba(255, 107, 0, 0.4)',
            animation: 'pulse 1.4s ease-in-out infinite'
          }} />
        </div>
        <div style={{ color: 'var(--text-secondary, #A7AFC0)', fontSize: '0.9rem', letterSpacing: '0.5px' }}>
          Carregando...
        </div>
      </div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
