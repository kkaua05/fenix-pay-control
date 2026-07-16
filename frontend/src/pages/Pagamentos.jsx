import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';

const Pagamentos = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const { socket, connected } = useSocket();
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    data_inicio: '',
    data_fim: '',
    forma_pagamento: ''
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPagamentos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await api.get(`/pagamentos?${params}`);
      setPagamentos(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
      showToast('Erro ao carregar pagamentos', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, showToast]);

  useEffect(() => {
    fetchPagamentos();
  }, [fetchPagamentos]);

  // Escutar eventos de tempo real
  useEffect(() => {
    if (!connected) return;

    const handlePagamentoCreated = (data) => {
      showToast(`🔄 Novo pagamento: ${data.cliente_nome} - R$ ${data.valor.toFixed(2)}`, 'success');
      fetchPagamentos();
    };

    const handlePagamentoUpdated = (data) => {
      showToast(`🔄 Pagamento #${data.id} atualizado`, 'info');
      fetchPagamentos();
    };

    const handlePagamentoDeleted = (data) => {
      showToast(`🔄 Pagamento #${data.id} excluído`, 'warning');
      fetchPagamentos();
    };

    socket.on('pagamento:created', handlePagamentoCreated);
    socket.on('pagamento:updated', handlePagamentoUpdated);
    socket.on('pagamento:deleted', handlePagamentoDeleted);

    return () => {
      socket.off('pagamento:created', handlePagamentoCreated);
      socket.off('pagamento:updated', handlePagamentoUpdated);
      socket.off('pagamento:deleted', handlePagamentoDeleted);
    };
  }, [connected, socket, fetchPagamentos, showToast]);

  // Restante do componente Pagamentos...
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    // Força reload com page=1 passando diretamente
    setLoading(true);
    const params = new URLSearchParams();
    params.append('page', 1);
    params.append('limit', pagination.limit);
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params.append(key, filters[key]);
      }
    });
    api.get(`/pagamentos?${params}`)
      .then(response => {
        setPagamentos(response.data.data || []);
        setPagination(response.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        setLastUpdate(new Date());
      })
      .catch(error => {
        console.error('Erro ao carregar pagamentos:', error);
        showToast('Erro ao carregar pagamentos', 'error');
      })
      .finally(() => setLoading(false));
  };
  const limparFiltros = () => {
    setFilters({ search: '', data_inicio: '', data_fim: '', forma_pagamento: '' });
    setLoading(true);
    api.get(`/pagamentos?page=1&limit=20`)
      .then(response => {
        setPagamentos(response.data.data || []);
        setPagination(response.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        setLastUpdate(new Date());
      })
      .catch(error => {
        console.error('Erro ao carregar pagamentos:', error);
        showToast('Erro ao carregar pagamentos', 'error');
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/pagamentos/${selectedId}`);
      showToast('Pagamento excluído com sucesso!', 'success');
      setShowDeleteModal(false);
      fetchPagamentos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showToast('Erro ao excluir pagamento', 'error');
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

  const getFormaBadge = (forma) => {
    const colors = {
      CREDITO: { bg: 'rgba(255, 107, 0, 0.15)', color: '#FF6B00' },
      DEBITO: { bg: 'rgba(0, 230, 118, 0.15)', color: '#00E676' },
      PIX: { bg: 'rgba(41, 121, 255, 0.15)', color: '#2979FF' }
    };
    const style = colors[forma] || { bg: '#2A3040', color: '#B0B8C8' };
    return (
      <span style={{
        padding: '2px 10px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        background: style.bg,
        color: style.color,
        fontWeight: '600'
      }}>
        {forma}
      </span>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pagamentos</h1>
          <p className="page-subtitle">
            Gerencie todos os pagamentos realizados
            {connected && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: '#00E676', 
                marginLeft: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#00E676',
                  display: 'inline-block',
                  animation: 'pulse 2s infinite'
                }} />
                Tempo Real
              </span>
            )}
          </p>
        </div>
        <Link to="/pagamentos/novo" className="btn-primary">
          ➕ Novo Pagamento
        </Link>
      </div>

      {/* Filtros */}
      <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <input
              type="text"
              name="search"
              placeholder="🔍 Buscar por cliente..."
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <input
              type="date"
              name="data_inicio"
              value={filters.data_inicio}
              onChange={handleFilterChange}
              placeholder="Data início"
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <input
              type="date"
              name="data_fim"
              value={filters.data_fim}
              onChange={handleFilterChange}
              placeholder="Data fim"
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <select name="forma_pagamento" value={filters.forma_pagamento} onChange={handleFilterChange}>
              <option value="">Todas formas</option>
              <option value="CREDITO">Crédito</option>
              <option value="DEBITO">Débito</option>
              <option value="PIX">PIX</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <button onClick={applyFilters} className="btn-primary" style={{ padding: '10px 20px' }}>
              🔍 Filtrar
            </button>
            <button 
              onClick={limparFiltros} 
              className="btn-secondary" 
              style={{ padding: '10px 20px' }}
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-container animate-fade-in">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Forma</th>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                  <span className="loading-pulse" style={{ color: '#B0B8C8' }}>Carregando pagamentos...</span>
                </td>
              </tr>
            ) : pagamentos.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Nenhum pagamento encontrado
                </td>
              </tr>
            ) : (
              pagamentos.map((pagamento, index) => (
                <tr key={pagamento.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <td>
                    <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{pagamento.cliente_nome}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>ID: {pagamento.cliente_id}</div>
                  </td>
                  <td style={{ fontWeight: '600', color: '#FF6B00', fontSize: '1.05rem' }}>
                    {formatCurrency(pagamento.valor)}
                  </td>
                  <td>{getFormaBadge(pagamento.forma_pagamento)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{formatDate(pagamento.created_at)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{pagamento.usuario_nome || '—'}</td>
                  <td>
                    <span className="badge badge-success">
                      <span className="status-dot success"></span>
                      Concluído
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Link 
                        to={`/pagamentos/${pagamento.id}`}
                        style={{
                          padding: '4px 14px',
                          borderRadius: '6px',
                          background: 'rgba(41, 121, 255, 0.15)',
                          color: '#2979FF',
                          fontSize: '0.8rem',
                          transition: 'all 0.2s ease',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.15)'}
                      >
                        👁️ Ver
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setSelectedId(pagamento.id);
                            setShowDeleteModal(true);
                          }}
                          style={{
                            padding: '4px 14px',
                            borderRadius: '6px',
                            background: 'rgba(255, 23, 68, 0.15)',
                            color: '#FF1744',
                            fontSize: '0.8rem',
                            transition: 'all 0.2s ease',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.25)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.15)'}
                        >
                          🗑️ Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {pagination.pages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ color: '#6B7280', fontSize: '0.9rem' }}>
            Mostrando <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{pagamentos.length}</span> de <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{pagination.total}</span> registros
            {lastUpdate && (
              <span style={{ marginLeft: '12px', fontSize: '0.7rem' }}>
                Última atualização: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="btn-secondary"
              style={{ padding: '8px 18px' }}
            >
              ← Anterior
            </button>
            <span style={{
              padding: '8px 18px',
              background: '#161A22',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              color: '#FFFFFF',
              border: '1px solid #2A3040'
            }}>
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
              disabled={pagination.page === pagination.pages}
              className="btn-secondary"
              style={{ padding: '8px 18px' }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card animate-fade-in" style={{ maxWidth: '420px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '3rem' }}>⚠️</div>
              <h3 style={{ marginTop: '8px', color: '#FFFFFF' }}>Confirmar Exclusão</h3>
            </div>
            <p style={{ color: '#B0B8C8', textAlign: 'center', marginBottom: '24px' }}>
              Tem certeza que deseja excluir este pagamento?<br />
              <span style={{ color: '#6B7280', fontSize: '0.85rem' }}>Esta ação não pode ser desfeita.</span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger"
              >
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pagamentos;