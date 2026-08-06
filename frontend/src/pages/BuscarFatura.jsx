import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../hooks/useToast';

const formatCpf = (digits) => {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const COMO_FUNCIONA = [
  { icon: '🔐', titulo: 'Login automático', texto: 'O CPF informado é usado como login e senha no Portal do Cliente Fênix Wireless.' },
  { icon: '🔎', titulo: 'Localiza a fatura', texto: 'O robô procura a fatura pendente mais recente na conta do cliente.' },
  { icon: '📁', titulo: 'Importa pro sistema', texto: 'O PDF é salvo no Gerenciador de Arquivos e vinculado ao cliente, se cadastrado.' }
];

const ETAPAS = [
  { icon: '🔐', label: 'Conectando ao portal e autenticando com o CPF', at: 0 },
  { icon: '🔎', label: 'Verificando faturas pendentes', at: 6000 },
  { icon: '📄', label: 'Extraindo o PDF da fatura', at: 14000 },
  { icon: '☁️', label: 'Enviando para o Gerenciador de Arquivos', at: 24000 }
];

const BuscarFatura = () => {
  const { showToast } = useToast();
  const [cpfDigits, setCpfDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const timersRef = useRef([]);
  const intervalRef = useRef(null);

  const cpfValido = cpfDigits.length === 11;

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const iniciarProgresso = () => {
    setEtapaAtual(0);
    setElapsed(0);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = ETAPAS.slice(1).map((etapa, idx) =>
      setTimeout(() => setEtapaAtual(idx + 1), etapa.at)
    );
    const start = Date.now();
    intervalRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
  };

  const pararProgresso = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const handleCpfChange = (e) => {
    setCpfDigits(e.target.value.replace(/\D/g, '').slice(0, 11));
  };

  const handleBuscar = async (e) => {
    e.preventDefault();
    if (!cpfValido) {
      showToast('Informe um CPF válido com 11 dígitos', 'error');
      return;
    }
    setLoading(true);
    setErro(null);
    setResultado(null);
    iniciarProgresso();
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
      pararProgresso();
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 Buscar Fatura no Portal</h1>
          <p className="page-subtitle">
            Automação que acessa o Portal do Cliente (Fênix Wireless) e importa a fatura pendente direto para o Gerenciador de Arquivos
          </p>
        </div>
        <span className="badge badge-info">⚙️ Automação via Playwright</span>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* COLUNA ESQUERDA: busca + como funciona */}
        <div>
          <div className="card animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'var(--orange-gradient)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0
              }}>🔍</div>
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1rem' }}>Consultar cliente</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Informe apenas o CPF, sem pontuação</div>
              </div>
            </div>

            <form onSubmit={handleBuscar}>
              <div className="input-group" style={{ position: 'relative' }}>
                <label>CPF do Cliente</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={formatCpf(cpfDigits)}
                  onChange={handleCpfChange}
                  disabled={loading}
                  autoFocus
                  style={{
                    paddingRight: '40px',
                    borderColor: cpfDigits.length > 0 ? (cpfValido ? 'var(--success)' : 'var(--border-color)') : undefined
                  }}
                />
                {cpfDigits.length > 0 && (
                  <span style={{
                    position: 'absolute', right: '14px', top: '38px', fontSize: '1rem',
                    color: cpfValido ? 'var(--success)' : 'var(--text-muted)'
                  }}>
                    {cpfValido ? '✓' : `${cpfDigits.length}/11`}
                  </span>
                )}
              </div>
              <button type="submit" className="btn-primary" disabled={loading || !cpfValido} style={{ width: '100%' }}>
                {loading ? `⏳ Buscando... (${elapsed}s)` : '🔍 Buscar Fatura'}
              </button>
            </form>
          </div>

          <div className="card animate-fade-in" style={{ marginTop: '20px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '16px' }}>
              Como funciona
            </div>
            {COMO_FUNCIONA.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: idx < COMO_FUNCIONA.length - 1 ? '16px' : 0 }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0
                }}>{item.icon}</div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: '600' }}>{item.titulo}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.4 }}>{item.texto}</div>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)',
              color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              ⏱️ O processo costuma levar entre 15 e 40 segundos
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: status / resultado */}
        <div>
          {!loading && !resultado && !erro && (
            <div className="card animate-fade-in" style={{
              textAlign: 'center', padding: '60px 24px', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px'
            }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '16px', opacity: 0.6 }}>🧾</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>Nenhuma busca realizada</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                Informe o CPF do cliente e clique em "Buscar Fatura"
              </div>
            </div>
          )}

          {loading && (
            <div className="card animate-fade-in">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '20px' }}>
                Progresso da automação
              </div>
              {ETAPAS.map((etapa, idx) => {
                const status = idx < etapaAtual ? 'done' : idx === etapaAtual ? 'active' : 'pending';
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: idx < ETAPAS.length - 1 ? '18px' : 0 }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem',
                      background: status === 'done' ? 'var(--success-bg)' : status === 'active' ? 'rgba(255,107,0,0.15)' : 'var(--bg-input)',
                      border: `1px solid ${status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--orange-primary)' : 'var(--border-color)'}`,
                      color: status === 'done' ? 'var(--success)' : status === 'active' ? 'var(--orange-primary)' : 'var(--text-muted)',
                      animation: status === 'active' ? 'pulse 1.2s ease-in-out infinite' : 'none'
                    }}>
                      {status === 'done' ? '✓' : etapa.icon}
                    </div>
                    <div style={{
                      color: status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                      fontSize: '0.88rem', fontWeight: status === 'active' ? '600' : '400'
                    }}>
                      {etapa.label}
                    </div>
                  </div>
                );
              })}
              <div style={{
                marginTop: '20px', height: '4px', borderRadius: '2px', background: 'var(--bg-input)', overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', borderRadius: '2px', background: 'var(--orange-gradient)',
                  width: `${Math.min(((etapaAtual + 1) / ETAPAS.length) * 100, 95)}%`, transition: 'width 0.6s ease'
                }} />
              </div>
            </div>
          )}

          {!loading && erro && (
            <div className="card animate-fade-in" style={{ borderColor: 'rgba(255,23,68,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', background: 'var(--error-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0
                }}>⚠️</div>
                <div>
                  <div style={{ color: 'var(--error)', fontWeight: '600', marginBottom: '4px' }}>Não foi possível concluir a busca</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>{erro}</div>
                </div>
              </div>
            </div>
          )}

          {!loading && resultado && !erro && (
            <div className="card animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px', background: 'var(--orange-gradient)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#FFF', flexShrink: 0
                }}>
                  {resultado.cliente.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{resultado.cliente.nome}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{resultado.cliente.cpf}</div>
                </div>
              </div>

              {resultado.semFaturaPendente ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', fontWeight: '500' }}>
                  <span className="badge badge-success">✅ Em dia</span>
                  Nenhuma fatura pendente encontrada no portal
                </div>
              ) : (
                <>
                  <div className="grid-3" style={{ gap: '12px', marginBottom: '18px' }}>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Fatura</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>#{resultado.fatura.numero}</div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Vencimento</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{resultado.fatura.vencimento}</div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Valor</div>
                      <div style={{ color: 'var(--success)', fontWeight: '700' }}>{resultado.fatura.valor?.replace(/\s+/g, ' ').trim()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span className={`badge ${resultado.clienteVinculado ? 'badge-success' : 'badge-warning'}`}>
                      {resultado.clienteVinculado ? '🔗 Vinculada ao cliente' : '⚠️ Cliente não cadastrado'}
                    </span>
                    <span className="badge badge-info">📁 Salva em Arquivos</span>
                  </div>

                  <a href={resultado.arquivo.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'flex', width: '100%' }}>
                    📄 Abrir PDF da Fatura
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuscarFatura;
