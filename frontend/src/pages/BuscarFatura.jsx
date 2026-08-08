import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

const formatCpf = (digits) => {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const FONTES = {
  portal: {
    label: 'Portal do Cliente',
    icon: '🏠',
    endpoint: '/faturas/buscar-portal',
    semPendenciaCampo: 'semFaturaPendente',
    comoFunciona: [
      { icon: '🔐', titulo: 'Login automático', texto: 'O CPF informado é usado como login e senha no Portal do Cliente Fênix Wireless.' },
      { icon: '🔎', titulo: 'Localiza a fatura', texto: 'O robô procura a fatura pendente mais recente na conta do cliente.' },
      { icon: '📁', titulo: 'Importa e cadastra', texto: 'O PDF é salvo no Gerenciador de Arquivos e o cliente é cadastrado automaticamente se ainda não existir.' }
    ],
    etapas: [
      { icon: '🔐', label: 'Conectando ao portal e autenticando com o CPF', at: 0 },
      { icon: '🔎', label: 'Verificando faturas pendentes', at: 6000 },
      { icon: '📄', label: 'Extraindo o PDF da fatura', at: 14000 },
      { icon: '☁️', label: 'Enviando para o Gerenciador de Arquivos', at: 24000 }
    ],
    tempoEstimado: '15 e 40 segundos',
    aviso: null
  },
  ixc: {
    label: 'Painel IXC (Admin)',
    icon: '🏢',
    endpoint: '/faturas/buscar-ixc-boletos',
    semPendenciaCampo: 'semBoletosPendentes',
    comoFunciona: [
      { icon: '🔐', titulo: 'Login no IXC', texto: 'Acessa o painel administrativo com a conta de serviço da empresa.' },
      { icon: '🧾', titulo: 'Seleciona os boletos', texto: 'Marca automaticamente todos os títulos "A receber" (a vencer, vencendo hoje ou vencidos).' },
      { icon: '📁', titulo: 'Gera e cadastra', texto: 'Emite o PDF combinado (3 por página + PIX), salva no Gerenciador de Arquivos e cadastra o cliente automaticamente se ainda não existir.' }
    ],
    etapas: [
      { icon: '🔐', label: 'Autenticando no painel IXC', at: 0 },
      { icon: '🔎', label: 'Localizando cliente e abrindo financeiro', at: 7000 },
      { icon: '🧾', label: 'Selecionando títulos em aberto', at: 14000 },
      { icon: '📄', label: 'Gerando PDF dos boletos', at: 20000 },
      { icon: '☁️', label: 'Enviando para o Gerenciador de Arquivos', at: 28000 }
    ],
    tempoEstimado: '20 e 45 segundos',
    aviso: 'Esta fonte usa a conta administrativa da empresa no IXC, que permite apenas uma sessão ativa por vez. Se alguém estiver logado no painel IXC com essa conta no momento da busca, a sessão será encerrada automaticamente.'
  }
};

const BuscarFatura = () => {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [fonte, setFonte] = useState('portal');
  const [cpfDigits, setCpfDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const timersRef = useRef([]);
  const intervalRef = useRef(null);

  const config = FONTES[fonte];
  const cpfValido = cpfDigits.length === 11;

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const trocarFonte = (novaFonte) => {
    if (loading) return;
    setFonte(novaFonte);
    setResultado(null);
    setErro(null);
  };

  const iniciarProgresso = (etapas) => {
    setEtapaAtual(0);
    setElapsed(0);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = etapas.slice(1).map((etapa, idx) =>
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
    iniciarProgresso(config.etapas);
    try {
      const response = await api.post(config.endpoint, { cpf: cpfDigits }, { timeout: 58000 });
      setResultado({ ...response.data, _fonte: fonte });
      const semPendencia = response.data[config.semPendenciaCampo];
      if (semPendencia) {
        showToast(`✅ ${response.data.cliente.nome} não tem pendências`, 'success');
      } else if (response.data.clienteCriado) {
        showToast('✅ Documento importado e cliente cadastrado automaticamente!', 'success');
      } else {
        showToast('✅ Documento importado para o Gerenciador de Arquivos!', 'success');
      }
    } catch (error) {
      const msg = error.response?.data?.message
        || (error.code === 'ECONNABORTED' ? 'A busca demorou demais para responder. Tente novamente.' : null)
        || 'Erro ao buscar documento';
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
          <h1 className="page-title">🤖 Buscar Fatura / Boletos</h1>
          <p className="page-subtitle">
            Automação que acessa o portal do cliente ou o painel administrativo e importa os documentos de cobrança pendentes
          </p>
        </div>
        <span className="badge badge-info">⚙️ Automação via Playwright</span>
      </div>

      {/* SELETOR DE FONTE */}
      <div className="card animate-fade-in" style={{ marginBottom: '20px', padding: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {Object.entries(FONTES)
            .filter(([key]) => key !== 'ixc' || isAdmin)
            .map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => trocarFonte(key)}
                disabled={loading}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid',
                  borderColor: fonte === key ? 'var(--orange-primary)' : 'var(--border-color)',
                  background: fonte === key ? 'rgba(255,107,0,0.12)' : 'transparent',
                  color: fonte === key ? 'var(--orange-primary)' : 'var(--text-secondary)',
                  fontWeight: fonte === key ? '600' : '500', fontSize: '0.9rem',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'var(--transition)'
                }}
              >
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            ))}
        </div>
      </div>

      {config.aviso && (
        <div className="card animate-fade-in" style={{ marginBottom: '20px', borderColor: 'rgba(255,171,0,0.3)' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>{config.aviso}</div>
          </div>
        </div>
      )}

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
                {loading ? `⏳ Buscando... (${elapsed}s)` : `🔍 Buscar em ${config.label}`}
              </button>
            </form>
          </div>

          <div className="card animate-fade-in" style={{ marginTop: '20px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '16px' }}>
              Como funciona · {config.label}
            </div>
            {config.comoFunciona.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '12px', marginBottom: idx < config.comoFunciona.length - 1 ? '16px' : 0 }}>
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
              ⏱️ O processo costuma levar entre {config.tempoEstimado}
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
                Informe o CPF do cliente e clique em "Buscar"
              </div>
            </div>
          )}

          {loading && (
            <div className="card animate-fade-in">
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', marginBottom: '20px' }}>
                Progresso da automação
              </div>
              {config.etapas.map((etapa, idx) => {
                const status = idx < etapaAtual ? 'done' : idx === etapaAtual ? 'active' : 'pending';
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: idx < config.etapas.length - 1 ? '18px' : 0 }}>
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
                  width: `${Math.min(((etapaAtual + 1) / config.etapas.length) * 100, 95)}%`, transition: 'width 0.6s ease'
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
                  {(resultado.cliente.nome || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{resultado.cliente.nome}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {resultado._fonte === 'ixc' ? `IXC #${resultado.cliente.id}` : resultado.cliente.cpf}
                  </div>
                </div>
                <span className="badge badge-info" style={{ flexShrink: 0 }}>{FONTES[resultado._fonte].icon} {FONTES[resultado._fonte].label}</span>
              </div>

              {resultado[FONTES[resultado._fonte].semPendenciaCampo] ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', fontWeight: '500' }}>
                  <span className="badge badge-success">✅ Em dia</span>
                  Nenhuma pendência encontrada
                </div>
              ) : resultado._fonte === 'portal' ? (
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <span className={`badge ${resultado.clienteCriado ? 'badge-success' : 'badge-info'}`}>
                      {resultado.clienteCriado ? '✨ Cliente cadastrado automaticamente' : '🔗 Cliente já cadastrado'}
                    </span>
                    <span className="badge badge-info">📁 Salva em Arquivos</span>
                  </div>

                  <a href={resultado.arquivo.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'flex', width: '100%' }}>
                    📄 Abrir PDF da Fatura
                  </a>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px', flex: 1 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Boletos</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{resultado.titulos.length}</div>
                    </div>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px', flex: 1 }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Total em aberto</div>
                      <div style={{ color: 'var(--success)', fontWeight: '700' }}>
                        R$ {resultado.totalValor.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px', maxHeight: '220px', overflowY: 'auto' }}>
                    {resultado.titulos.map((t) => (
                      <div key={t.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-input)', marginBottom: '6px'
                      }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>#{t.id} · venc. {t.vencimento}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.85rem' }}>R$ {t.valor}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <span className={`badge ${resultado.clienteCriado ? 'badge-success' : 'badge-info'}`}>
                      {resultado.clienteCriado ? '✨ Cliente cadastrado automaticamente' : '🔗 Cliente já cadastrado'}
                    </span>
                    <span className="badge badge-info">📁 Salvo em Arquivos</span>
                  </div>

                  <a href={resultado.arquivo.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'flex', width: '100%' }}>
                    📄 Abrir PDF dos Boletos
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
