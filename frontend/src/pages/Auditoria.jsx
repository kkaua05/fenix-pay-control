import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const Auditoria = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    usuario: '',
    acao: '',
    data_inicio: '',
    data_fim: ''
  });

  useEffect(() => {
    fetchLogs();
  }, [pagination.page]);

  const fetchLogs = async () => {
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

      const response = await api.get(`/logs?${params}`);
      setLogs(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      showToast('Erro ao carregar logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const getAcaoBadge = (acao) => {
    const styles = {
      LOGIN: 'badge-info',
      CREATE: 'badge-success',
      UPDATE: 'badge-warning',
      DELETE: 'badge-error',
      CREATE_USER: 'badge-success',
      UPDATE_USER: 'badge-warning',
      RESET_PASSWORD: 'badge-warning',
      CREATE_CLIENTE: 'badge-success',
      UPDATE_CLIENTE: 'badge-warning',
      DELETE_CLIENTE: 'badge-error'
    };
    return styles[acao] || 'badge-info';
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('pt-BR');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-subtitle">Histórico completo de todas as ações do sistema</p>
        </div>
        <button
          onClick={() => {
            setFilters({ usuario: '', acao: '', data_inicio: '', data_fim: '' });
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          className="btn-secondary"
        >
          Limpar Filtros
        </button>
      </div>

      <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Usuário</label>
              <input
                type="text"
                name="usuario"
                value={filters.usuario}
                onChange={handleFilterChange}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Ação</label>
              <select name="acao" value={filters.acao} onChange={handleFilterChange}>
                <option value="">Todas</option>
                <option value="LOGIN">Login</option>
                <option value="CREATE">Criar Pagamento</option>
                <option value="UPDATE">Atualizar Pagamento</option>
                <option value="DELETE">Excluir Pagamento</option>
                <option value="CREATE_USER">Criar Usuário</option>
                <option value="UPDATE_USER">Atualizar Usuário</option>
                <option value="RESET_PASSWORD">Resetar Senha</option>
                <option value="CREATE_CLIENTE">Criar Cliente</option>
                <option value="UPDATE_CLIENTE">Atualizar Cliente</option>
                <option value="DELETE_CLIENTE">Excluir Cliente</option>
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Data Início</label>
              <input
                type="date"
                name="data_inicio"
                value={filters.data_inicio}
                onChange={handleFilterChange}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Data Fim</label>
              <input
                type="date"
                name="data_fim"
                value={filters.data_fim}
                onChange={handleFilterChange}
              />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Buscando...' : '🔍 Buscar'}
            </button>
          </div>
        </form>
      </div>

      <div className="table-container animate-fade-in">
        <table>
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Descrição</th>
              <th>IP</th>
              <th>Sistema</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                  <span className="loading-pulse" style={{ color: '#B0B8C8' }}>Carregando logs...</span>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Nenhum registro de auditoria encontrado
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr key={log.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
                  <td style={{ fontSize: '0.85rem' }}>{formatDate(log.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{log.usuario}</div>
                  </td>
                  <td>
                    <span className={`badge ${getAcaoBadge(log.acao)}`}>
                      {log.acao}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.9rem', color: '#B0B8C8' }}>{log.descricao}</td>
                  <td style={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'monospace' }}>
                    {log.ip || '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                    {log.sistema || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
            Mostrando <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{logs.length}</span> de <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{pagination.total}</span> registros
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
    </div>
  );
};

export default Auditoria;