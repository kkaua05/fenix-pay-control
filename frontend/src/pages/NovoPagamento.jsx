import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const NovoPagamento = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [formData, setFormData] = useState({
    cliente_id: '',
    cliente_nome: '',
    valor: '',
    forma_pagamento: 'CREDITO',
    observacoes: ''
  });
  const [file, setFile] = useState(null);

  // Buscar clientes quando pesquisar
  useEffect(() => {
    if (searchTerm.length >= 2) {
      const searchClientes = async () => {
        try {
          const response = await api.get(`/clientes/search?q=${encodeURIComponent(searchTerm)}`);
          setClientes(response.data.data || []);
        } catch (error) {
          console.error('Erro ao buscar clientes:', error);
        }
      };
      searchClientes();
    } else {
      setClientes([]);
    }
  }, [searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const maxSize = 5 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        showToast('Arquivo muito grande. Máximo 5MB.', 'error');
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const selecionarCliente = (cliente) => {
    setFormData(prev => ({
      ...prev,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome_completo
    }));
    setSearchTerm(cliente.nome_completo);
    setClientes([]);
    setShowClienteModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.cliente_id || !formData.cliente_nome) {
      showToast('Selecione um cliente', 'error');
      return;
    }

    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      showToast('Informe um valor válido', 'error');
      return;
    }

    if (!formData.forma_pagamento) {
      showToast('Selecione a forma de pagamento', 'error');
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('cliente_id', String(formData.cliente_id));
      formDataToSend.append('cliente_nome', String(formData.cliente_nome));
      formDataToSend.append('valor', String(formData.valor));
      formDataToSend.append('forma_pagamento', String(formData.forma_pagamento));
      formDataToSend.append('observacoes', formData.observacoes || '');
      
      if (file) {
        formDataToSend.append('comprovante', file);
      }

      const response = await api.post('/pagamentos', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        showToast('✅ Pagamento registrado com sucesso!', 'success');
        navigate('/pagamentos');
      } else {
        showToast(response.data.message || 'Erro ao registrar pagamento', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      const message = error.response?.data?.message || 'Erro ao registrar pagamento';
      const errorDetail = error.response?.data?.error || '';
      showToast(message, 'error');
      console.error('Detalhe do erro:', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Novo Pagamento</h1>
          <p className="page-subtitle">Registre um novo pagamento no sistema</p>
        </div>
        <button
          onClick={() => navigate('/pagamentos')}
          className="btn-secondary"
        >
          ↩️ Voltar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card animate-fade-in">
        {/* Cliente */}
        <div className="input-group">
          <label>Cliente *</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar cliente por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowClienteModal(true)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowClienteModal(true)}
              className="btn-secondary"
            >
              Buscar
            </button>
          </div>
          {formData.cliente_nome && (
            <div style={{ 
              marginTop: '8px', 
              padding: '10px 16px', 
              background: 'rgba(0, 230, 118, 0.1)', 
              borderRadius: '8px', 
              color: '#00E676',
              border: '1px solid rgba(0, 230, 118, 0.2)'
            }}>
              ✅ Cliente selecionado: <strong>{formData.cliente_nome}</strong>
            </div>
          )}
        </div>

        {/* Lista de clientes */}
        {showClienteModal && clientes.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              background: '#161A22', 
              borderRadius: '10px', 
              border: '1px solid #2A3040', 
              maxHeight: '200px', 
              overflowY: 'auto' 
            }}>
              {clientes.map(cliente => (
                <div
                  key={cliente.id}
                  onClick={() => selecionarCliente(cliente)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #2A3040',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 107, 0, 0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{cliente.nome_completo}</div>
                  <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>CPF: {cliente.cpf}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Valor */}
        <div className="input-group">
          <label>Valor do Pagamento *</label>
          <input
            type="number"
            name="valor"
            value={formData.valor}
            onChange={handleChange}
            placeholder="0,00"
            step="0.01"
            min="0.01"
            required
          />
        </div>

        {/* Forma de Pagamento */}
        <div className="input-group">
          <label>Forma de Pagamento *</label>
          <select
            name="forma_pagamento"
            value={formData.forma_pagamento}
            onChange={handleChange}
            required
          >
            <option value="CREDITO">💳 Crédito</option>
            <option value="DEBITO">💳 Débito</option>
            <option value="PIX">📱 PIX</option>
          </select>
        </div>

        {/* Observações */}
        <div className="input-group">
          <label>Observações</label>
          <textarea
            name="observacoes"
            value={formData.observacoes}
            onChange={handleChange}
            placeholder="Observações sobre o pagamento..."
            rows="3"
          />
        </div>

        {/* Comprovante */}
        <div className="input-group">
          <label>Comprovante (Imagem ou PDF)</label>
          <input
            type="file"
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.pdf"
          />
          <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '4px' }}>
            📎 Formatos: JPG, PNG, PDF | Máx: 5MB
          </div>
          {file && (
            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(0, 230, 118, 0.1)', borderRadius: '6px', color: '#00E676' }}>
              ✅ Arquivo selecionado: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ minWidth: '160px' }}
          >
            {loading ? '💾 Salvando...' : '💾 Salvar Pagamento'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/pagamentos')}
            className="btn-secondary"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovoPagamento;