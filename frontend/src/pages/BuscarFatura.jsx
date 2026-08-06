import { useState } from 'react';
import api from '../services/api';
import { useToast } from '../hooks/useToast';

const formatCpf = (digits) => {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const BuscarFatura = () => {
  const { showToast } = useToast();
  const [cpfDigits, setCpfDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const handleCpfChange = (e) => {
    setCpfDigits(e.target.value.replace(/\D/g, '').slice(0, 11));
  };

  const handleBuscar = async (e) => {
    e.preventDefault();
    if (cpfDigits.length !== 11) {
      showToast('Informe um CPF válido com 11 dígitos', 'error');
      return;
    }
    setLoading(true);
    setErro(null);
    setResultado(null);
    try {
      const response = await api.post('/faturas/buscar-portal', { cpf: cpfDigits }, { timeout: 58000 });
      setResultado(response.data);
      if (response.data.semFaturaPendente) {
        showToast(`✅ ${response.data.cliente.nome} não tem faturas pendentes`, 'success');
      } else {
        showToast('✅ Fatura importada para o Gerenciador de Arquivos!', 'success');
      }
    } catch (error) {
      const msg = error.response?.data?.message
        || (error.code === 'ECONNABORTED' ? 'O portal demorou demais para responder. Tente novamente.' : null)
        || 'Erro ao buscar fatura no portal';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 Buscar Fatura no Portal</h1>
          <p className="page-subtitle">
            Acessa automaticamente o Portal do Cliente (Fênix Wireless) e importa a fatura pendente para o Gerenciador de Arquivos
          </p>
        </div>
      </div>

      <div className="card animate-fade-in" style={{ maxWidth: '480px' }}>
        <form onSubmit={handleBuscar}>
          <div className="input-group">
            <label>CPF do Cliente</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formatCpf(cpfDigits)}
              onChange={handleCpfChange}
              disabled={loading}
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || cpfDigits.length !== 11} style={{ width: '100%' }}>
            {loading ? '⏳ Acessando o portal... (pode levar até 30s)' : '🔍 Buscar Fatura'}
          </button>
        </form>
      </div>

      {erro && (
        <div className="card animate-fade-in" style={{ marginTop: '20px', borderColor: 'rgba(255,23,68,0.3)' }}>
          <div style={{ color: '#FF1744', fontWeight: '500' }}>⚠️ {erro}</div>
        </div>
      )}

      {resultado && !erro && (
        <div className="card animate-fade-in" style={{ marginTop: '20px', maxWidth: '480px' }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Cliente</div>
            <div style={{ color: '#FFFFFF', fontWeight: '600' }}>{resultado.cliente.nome}</div>
            <div style={{ color: '#B0B8C8', fontSize: '0.85rem' }}>{resultado.cliente.cpf}</div>
          </div>

          {resultado.semFaturaPendente ? (
            <div style={{ color: '#00E676', fontWeight: '500' }}>✅ Sem faturas pendentes no momento</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Fatura</div>
                  <div style={{ color: '#FFFFFF' }}>#{resultado.fatura.numero}</div>
                </div>
                <div>
                  <div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Vencimento</div>
                  <div style={{ color: '#FFFFFF' }}>{resultado.fatura.vencimento}</div>
                </div>
                <div>
                  <div style={{ color: '#6B7280', fontSize: '0.75rem' }}>Valor</div>
                  <div style={{ color: '#00E676', fontWeight: '600' }}>{resultado.fatura.valor?.replace(/\s+/g, ' ').trim()}</div>
                </div>
              </div>
              {!resultado.clienteVinculado && (
                <div style={{ color: '#FFAB00', fontSize: '0.8rem', marginBottom: '12px' }}>
                  ⚠️ Nenhum cliente cadastrado com esse CPF — a fatura foi salva sem vínculo de cliente.
                </div>
              )}
              <a href={resultado.arquivo.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center', width: '100%' }}>
                📄 Ver PDF da Fatura
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BuscarFatura;
