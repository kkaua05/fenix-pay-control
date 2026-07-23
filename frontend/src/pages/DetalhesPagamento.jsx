import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const DetalhesPagamento = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pagamento, setPagamento] = useState(null);
  const [showComprovante, setShowComprovante] = useState(false);
  const [activeTab, setActiveTab] = useState('detalhes');

  useEffect(() => {
    fetchPagamento();
  }, [id]);

  const fetchPagamento = async () => {
    try {
      const response = await api.get(`/pagamentos/${id}`);
      setPagamento(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar pagamento:', error);
      showToast('Erro ao carregar pagamento', 'error');
      navigate('/pagamentos');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('pt-BR');
  };

  const formatDateShort = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatTime = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('pt-BR');
  };

  const getFormaBadge = (forma) => {
    const colors = {
      CREDITO: { bg: 'rgba(255, 107, 0, 0.15)', color: '#FF6B00', icon: '💳' },
      DEBITO: { bg: 'rgba(0, 230, 118, 0.15)', color: '#00E676', icon: '💳' },
      PIX: { bg: 'rgba(41, 121, 255, 0.15)', color: '#2979FF', icon: '📱' }
    };
    const style = colors[forma] || { bg: '#2A3040', color: '#B0B8C8', icon: '💰' };
    return (
      <span style={{
        padding: '6px 16px',
        borderRadius: '8px',
        fontSize: '0.85rem',
        background: style.bg,
        color: style.color,
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {style.icon} {forma}
      </span>
    );
  };

  const getAcaoBadge = (acao) => {
    const styles = {
      CREATE: { bg: 'rgba(0, 230, 118, 0.15)', color: '#00E676', icon: '✅' },
      UPDATE: { bg: 'rgba(255, 171, 0, 0.15)', color: '#FFAB00', icon: '✏️' },
      DELETE: { bg: 'rgba(255, 23, 68, 0.15)', color: '#FF1744', icon: '🗑️' },
      LOGIN: { bg: 'rgba(41, 121, 255, 0.15)', color: '#2979FF', icon: '🔑' },
      CREATE_USER: { bg: 'rgba(0, 230, 118, 0.15)', color: '#00E676', icon: '👤' },
      UPDATE_USER: { bg: 'rgba(255, 171, 0, 0.15)', color: '#FFAB00', icon: '✏️' },
      RESET_PASSWORD: { bg: 'rgba(255, 171, 0, 0.15)', color: '#FFAB00', icon: '🔑' }
    };
    const style = styles[acao] || { bg: '#2A3040', color: '#B0B8C8', icon: '📋' };
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '6px',
        fontSize: '0.75rem',
        background: style.bg,
        color: style.color,
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {style.icon} {acao}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="loading-pulse" style={{ color: '#B0B8C8', fontSize: '1.1rem' }}>
            Carregando detalhes do pagamento...
          </div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #2A3040', 
            borderTop: '3px solid #FF6B00', 
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!pagamento) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
          <div style={{ color: '#B0B8C8', fontSize: '1.2rem' }}>Pagamento não encontrado</div>
          <button
            onClick={() => navigate('/pagamentos')}
            className="btn-primary"
            style={{ marginTop: '16px' }}
          >
            ↩️ Voltar para Pagamentos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title">Detalhes do Pagamento</h1>
            <span style={{
              padding: '4px 16px',
              borderRadius: '20px',
              background: 'rgba(255, 107, 0, 0.15)',
              color: '#FF6B00',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}>
              #{pagamento.id}
            </span>
          </div>
          <p className="page-subtitle">
            Visualize todas as informações do pagamento
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {pagamento.comprovante && (
            <button
              onClick={() => setShowComprovante(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📎 Ver Comprovante
            </button>
          )}
          <button
            onClick={() => navigate('/pagamentos')}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ↩️ Voltar
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="card animate-fade-in" style={{ 
        marginBottom: '24px',
        borderLeft: '4px solid #00E676',
        background: 'rgba(0, 230, 118, 0.05)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#00E676',
              display: 'inline-block',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ color: '#00E676', fontWeight: '600' }}>Pagamento Concluído</span>
            <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>
              • {formatDate(pagamento.created_at)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ 
              padding: '4px 12px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#6B7280'
            }}>
              📋 ID: #{pagamento.id}
            </span>
            {pagamento.forma_pagamento && (
              <span style={{ 
                padding: '4px 12px', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#6B7280'
              }}>
                {getFormaBadge(pagamento.forma_pagamento)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        marginBottom: '24px',
        background: '#161A22',
        borderRadius: '12px',
        padding: '4px',
        border: '1px solid #2A3040',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('detalhes')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: activeTab === 'detalhes' ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
            color: activeTab === 'detalhes' ? '#FF6B00' : '#B0B8C8',
            border: activeTab === 'detalhes' ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'detalhes' ? '600' : '400',
            whiteSpace: 'nowrap'
          }}
        >
          📋 Detalhes
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            background: activeTab === 'auditoria' ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
            color: activeTab === 'auditoria' ? '#FF6B00' : '#B0B8C8',
            border: activeTab === 'auditoria' ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'auditoria' ? '600' : '400',
            whiteSpace: 'nowrap'
          }}
        >
          🔍 Auditoria
        </button>
        {pagamento.comprovante && (
          <button
            onClick={() => setActiveTab('comprovante')}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: activeTab === 'comprovante' ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
              color: activeTab === 'comprovante' ? '#FF6B00' : '#B0B8C8',
              border: activeTab === 'comprovante' ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'comprovante' ? '600' : '400',
              whiteSpace: 'nowrap'
            }}
          >
            📎 Comprovante
          </button>
        )}
      </div>

      {/* Conteúdo - Detalhes */}
      {activeTab === 'detalhes' && (
        <div className="animate-fade-in">
          <div className="grid-2">
            {/* Coluna Esquerda - Informações do Pagamento */}
            <div className="card">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '1px solid #2A3040'
              }}>
                <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
                  💳 Informações do Pagamento
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  #{pagamento.id}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Cliente */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    👤 Cliente
                  </div>
                  <div style={{ fontWeight: '600', color: '#FFFFFF', fontSize: '1.1rem', marginTop: '4px' }}>
                    {pagamento.cliente_nome}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '2px' }}>
                    ID: {pagamento.cliente_id}
                  </div>
                </div>

                {/* Valor */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255, 107, 0, 0.05)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 107, 0, 0.15)'
                }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    💰 Valor
                  </div>
                  <div style={{ 
                    fontWeight: '700', 
                    color: '#FF6B00', 
                    fontSize: '2rem',
                    marginTop: '4px'
                  }}>
                    {formatCurrency(pagamento.valor)}
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    💳 Forma de Pagamento
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    {getFormaBadge(pagamento.forma_pagamento)}
                  </div>
                </div>

                {/* Observações */}
                {pagamento.observacoes && (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    border: '1px solid #2A3040'
                  }}>
                    <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📝 Observações
                    </div>
                    <div style={{ color: '#B0B8C8', marginTop: '4px', lineHeight: '1.6' }}>
                      {pagamento.observacoes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Coluna Direita - Informações do Registro */}
            <div className="card">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: '1px solid #2A3040'
              }}>
                <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
                  📋 Informações do Registro
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  {pagamento.usuario_nome || '—'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Data de Criação */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📅 Data de Criação
                  </div>
                  <div style={{ color: '#FFFFFF', fontWeight: '500', marginTop: '4px' }}>
                    {formatDate(pagamento.created_at)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                    {formatDateShort(pagamento.created_at)} às {formatTime(pagamento.created_at)}
                  </div>
                </div>

                {/* Última Atualização */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🔄 Última Atualização
                  </div>
                  <div style={{ color: '#FFFFFF', fontWeight: '500', marginTop: '4px' }}>
                    {formatDate(pagamento.updated_at)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                    {formatDateShort(pagamento.updated_at)} às {formatTime(pagamento.updated_at)}
                  </div>
                </div>

                {/* Usuário Responsável */}
                <div style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '10px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    👤 Usuário Responsável
                  </div>
                  <div style={{ color: '#FFFFFF', fontWeight: '500', marginTop: '4px' }}>
                    {pagamento.usuario_nome || '—'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                    @{pagamento.usuario_login || '—'}
                  </div>
                </div>

                {/* Comprovante */}
                {pagamento.comprovante && (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(41, 121, 255, 0.05)',
                    borderRadius: '10px',
                    border: '1px solid rgba(41, 121, 255, 0.15)'
                  }}>
                    <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📎 Comprovante
                    </div>
                    <button
                      onClick={() => setShowComprovante(true)}
                      style={{
                        marginTop: '8px',
                        padding: '8px 20px',
                        background: 'rgba(41, 121, 255, 0.15)',
                        color: '#2979FF',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.15)'}
                    >
                      📄 Visualizar Comprovante
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo - Auditoria */}
      {activeTab === 'auditoria' && (
        <div className="card animate-fade-in">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #2A3040'
          }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
              🔍 Histórico de Auditoria
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              {pagamento.logs?.length || 0} registros
            </span>
          </div>

          {pagamento.logs && pagamento.logs.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamento.logs.map((log, index) => (
                    <tr key={log.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                      <td style={{ fontSize: '0.85rem', color: '#B0B8C8' }}>
                        {formatDate(log.created_at)}
                      </td>
                      <td>
                        <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{log.usuario}</div>
                      </td>
                      <td>{getAcaoBadge(log.acao)}</td>
                      <td style={{ color: '#B0B8C8' }}>{log.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
              Nenhum registro de auditoria encontrado
            </div>
          )}
        </div>
      )}

      {/* Conteúdo - Comprovante */}
      {activeTab === 'comprovante' && pagamento.comprovante && (
        <div className="card animate-fade-in">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #2A3040'
          }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
              📎 Comprovante
            </h3>
            {pagamento.comprovante && !pagamento.comprovante.startsWith('data:') ? (
              <a
                href={`/uploads/comprovantes/${pagamento.comprovante}`}
                download
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                ⬇️ Baixar
              </a>
            ) : (
              <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>
                📎 Comprovante
              </span>
            )}
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '8px',
            padding: '20px',
            minHeight: '400px'
          }}>
            {(() => {
              const isDataUri = pagamento.comprovante.startsWith('data:');
              const isImage = isDataUri || pagamento.comprovante.match(/\.(jpg|jpeg|png)$/i);
              const comprovanteSrc = isDataUri ? pagamento.comprovante : `/uploads/comprovantes/${pagamento.comprovante}`;
              
              return isImage ? (
                <img
                  src={comprovanteSrc}
                  alt="Comprovante"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '600px',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              ) : (
                <iframe
                  src={comprovanteSrc}
                  style={{
                    width: '100%',
                    height: '600px',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                  title="Comprovante PDF"
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal de Comprovante */}
      {showComprovante && pagamento.comprovante && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '90%',
            maxHeight: '90%',
            background: '#161A22',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #2A3040',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }}>
            {/* Header do Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
                📎 Comprovante - #{pagamento.id}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {pagamento.comprovante && !pagamento.comprovante.startsWith('data:') ? (
                  <a
                    href={`/uploads/comprovantes/${pagamento.comprovante}`}
                    download
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                  >
                    ⬇️ Baixar
                  </a>
                ) : null}
                <button
                  onClick={() => setShowComprovante(false)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 23, 68, 0.15)',
                    color: '#FF1744',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.15)'}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '16px',
              minHeight: '400px',
              maxHeight: '70vh',
              overflow: 'auto'
            }}>
              {(() => {
                const isDataUri = pagamento.comprovante.startsWith('data:');
                const isImage = isDataUri || pagamento.comprovante.match(/\.(jpg|jpeg|png)$/i);
                const comprovanteSrc = isDataUri ? pagamento.comprovante : `/uploads/comprovantes/${pagamento.comprovante}`;
                
                return isImage ? (
                  <img
                    src={comprovanteSrc}
                    alt="Comprovante"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '60vh',
                      objectFit: 'contain',
                      borderRadius: '8px'
                    }}
                  />
                ) : (
                  <iframe
                    src={comprovanteSrc}
                    style={{
                      width: '100%',
                      height: '60vh',
                      border: 'none',
                      borderRadius: '8px'
                    }}
                    title="Comprovante PDF"
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default DetalhesPagamento;