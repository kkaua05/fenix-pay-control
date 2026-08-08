import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const Clientes = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    nome_completo: '',
    cpf: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await api.get(`/clientes?${params}`);
      setClientes(response.data.data || []);
      setPagination(response.data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      showToast('Erro ao carregar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, [pagination.page]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchClientes();
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/clientes/search?q=${encodeURIComponent(searchTerm.trim())}`);
      setClientes(response.data.data || []);
      setPagination(prev => ({ ...prev, total: response.data.data.length || 0, pages: 1 }));
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      showToast('Erro ao buscar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const openModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        id: cliente.id,
        nome_completo: cliente.nome_completo,
        cpf: cliente.cpf
      });
    } else {
      setEditingCliente(null);
      setFormData({ id: '', nome_completo: '', cpf: '' });
    }
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cpf') {
      const numbers = value.replace(/\D/g, '');
      if (numbers.length > 11) return;
      
      if (numbers.length <= 3) {
        formattedValue = numbers;
      } else if (numbers.length <= 6) {
        formattedValue = numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
      } else if (numbers.length <= 9) {
        formattedValue = numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      } else {
        formattedValue = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
      }
      
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const cleanCpf = (cpf) => cpf.replace(/\D/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nome_completo || !formData.cpf) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const cpfLimpo = cleanCpf(formData.cpf);
    if (cpfLimpo.length !== 11) {
      showToast('CPF inválido. Deve conter 11 dígitos.', 'error');
      return;
    }

    if (formData.id && isNaN(parseInt(formData.id))) {
      showToast('ID deve ser um número válido', 'error');
      return;
    }

    const dataToSend = {
      id: formData.id ? parseInt(formData.id) : null,
      nome_completo: formData.nome_completo,
      cpf: cpfLimpo
    };

    try {
      if (editingCliente) {
        await api.put(`/clientes/${editingCliente.id}`, {
          nome_completo: formData.nome_completo,
          cpf: cpfLimpo
        });
        showToast('✅ Cliente atualizado com sucesso!', 'success');
      } else {
        await api.post('/clientes', dataToSend);
        showToast('✅ Cliente cadastrado com sucesso!', 'success');
      }

      setShowModal(false);
      setEditingCliente(null);
      setFormData({ id: '', nome_completo: '', cpf: '' });
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchClientes();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      const message = error.response?.data?.message || 'Erro ao salvar cliente';
      showToast(message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) {
      return;
    }

    try {
      await api.delete(`/clientes/${id}`);
      showToast('✅ Cliente excluído com sucesso!', 'success');
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchClientes();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showToast('Erro ao excluir cliente', 'error');
    }
  };

  const formatCpf = (cpf) => {
    if (!cpf) return '—';
    if (cpf.includes('.') || cpf.includes('-')) return cpf;
    if (cpf.length === 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Gerencie todos os clientes cadastrados</p>
        </div>
        {isAdmin && (
          <button onClick={() => openModal()} className="btn-primary">
            ➕ Novo Cliente
          </button>
        )}
      </div>

      <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Buscar por ID, CPF ou Nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <button onClick={handleSearch} className="btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
            🔍 Buscar
          </button>
          <button onClick={() => { setSearchTerm(''); fetchClientes(); }} className="btn-secondary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
            Limpar
          </button>
        </div>
      </div>

      <div className="table-container animate-fade-in">
        <table>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Nome Completo</th>
              <th>CPF</th>
              <th>Data de Cadastro</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                  <span className="loading-pulse" style={{ color: '#B0B8C8' }}>Carregando clientes...</span>
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Nenhum cliente encontrado
                </td>
              </tr>
            ) : (
              clientes.map((cliente, index) => (
                <tr key={cliente.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <td style={{ fontWeight: '600', color: '#FF6B00' }}>#{cliente.id}</td>
                  <td>
                    <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{cliente.nome_completo}</div>
                    {cliente.ixc_id && (
                      <div style={{ fontSize: '0.7rem', color: '#6B7280', marginTop: '2px' }}>IXC #{cliente.ixc_id}</div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                    {formatCpf(cliente.cpf)}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {new Date(cliente.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openModal(cliente)}
                            style={{
                              padding: '4px 14px',
                              borderRadius: '6px',
                              background: 'rgba(41, 121, 255, 0.15)',
                              color: '#2979FF',
                              fontSize: '0.8rem',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.15)'}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDelete(cliente.id)}
                            style={{
                              padding: '4px 14px',
                              borderRadius: '6px',
                              background: 'rgba(255, 23, 68, 0.15)',
                              color: '#FF1744',
                              fontSize: '0.8rem',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.15)'}
                          >
                            🗑️ Excluir
                          </button>
                        </>
                      )}
                      {!isAdmin && (
                        <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>Apenas admin</span>
                      )}
                    </div>
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
            Mostrando <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{clientes.length}</span> de <span style={{ color: '#FFFFFF', fontWeight: '500' }}>{pagination.total}</span> registros
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

      {showModal && (
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
          <div className="card animate-fade-in" style={{ maxWidth: '500px', width: '100%' }}>
            <h3 style={{ marginBottom: '20px', color: '#FFFFFF' }}>
              {editingCliente ? '✏️ Editar Cliente' : '➕ Novo Cliente'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              {!editingCliente && (
                <div className="input-group">
                  <label>ID (Opcional - Deixe em branco para automático)</label>
                  <input
                    type="number"
                    name="id"
                    value={formData.id}
                    onChange={handleFormChange}
                    placeholder="Digite um número para o ID"
                    min="1"
                  />
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>
                    Se não preencher, o ID será gerado automaticamente
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  name="nome_completo"
                  value={formData.nome_completo}
                  onChange={handleFormChange}
                  placeholder="Nome completo do cliente"
                  required
                />
              </div>

              <div className="input-group">
                <label>CPF *</label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleFormChange}
                  placeholder="000.000.000-00 ou 00000000000"
                  maxLength="14"
                  required
                />
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>
                  Digite com ou sem pontos e traço
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCliente(null);
                    setFormData({ id: '', nome_completo: '', cpf: '' });
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingCliente ? '💾 Atualizar' : '💾 Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;