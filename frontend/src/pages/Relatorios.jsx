import { useState } from 'react';
import { useToast } from '../hooks/useToast';
import api from '../services/api';

const Relatorios = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [activeTab, setActiveTab] = useState('detalhado');
  const [filtros, setFiltros] = useState({
    periodo_inicio: '',
    periodo_fim: '',
    funcionario: '',
    forma_pagamento: '',
    cliente: ''
  });
  const [resumo, setResumo] = useState({
    total_registros: 0,
    valor_total: 0,
    valor_medio: 0,
    creditos: 0,
    debitos: 0,
    pix: 0,
    valor_credito: 0,
    valor_debito: 0,
    valor_pix: 0
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const gerarRelatorio = async (e) => {
    e.preventDefault();
    
    if (filtros.periodo_inicio && filtros.periodo_fim) {
      if (new Date(filtros.periodo_inicio) > new Date(filtros.periodo_fim)) {
        showToast('Data inicial não pode ser maior que a data final', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.keys(filtros).forEach(key => {
        if (filtros[key]) {
          params.append(key, filtros[key]);
        }
      });

      const response = await api.get(`/relatorios?${params}`);
      
      if (response.data.success) {
        setRelatorio(response.data.data);
        setResumo(response.data.data.summary || {
          total_registros: 0,
          valor_total: 0,
          valor_medio: 0,
          creditos: 0,
          debitos: 0,
          pix: 0,
          valor_credito: 0,
          valor_debito: 0,
          valor_pix: 0
        });
        showToast(`✅ Relatório gerado com ${response.data.data.registros?.length || 0} registros!`, 'success');
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      showToast('Erro ao gerar relatório', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = async () => {
    if (!relatorio || !relatorio.registros || relatorio.registros.length === 0) {
      showToast('Nenhum dado para exportar', 'warning');
      return;
    }

    setExportLoading(true);
    try {
      const headers = ['ID', 'Cliente', 'Valor', 'Forma', 'Data', 'Usuário'];
      const rows = relatorio.registros.map(r => [
        r.id,
        r.cliente_nome,
        r.valor,
        r.forma_pagamento,
        new Date(r.created_at).toLocaleString('pt-BR'),
        r.usuario_nome || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      showToast('✅ Arquivo exportado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      showToast('Erro ao exportar arquivo', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const exportarPDF = () => {
    if (!relatorio || !relatorio.registros || relatorio.registros.length === 0) {
      showToast('Nenhum dado para exportar', 'warning');
      return;
    }

    const conteudo = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #FF6B00; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #FF6B00; color: white; padding: 8px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #ddd; }
            .resumo { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .resumo-item { background: #f5f5f5; padding: 15px; border-radius: 8px; flex: 1; min-width: 150px; }
            .resumo-item strong { display: block; font-size: 1.2em; color: #FF6B00; }
          </style>
        </head>
        <body>
          <h1>📊 Relatório de Pagamentos</h1>
          <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          
          <div class="resumo">
            <div class="resumo-item">
              <strong>${resumo.total_registros}</strong>
              Total de Registros
            </div>
            <div class="resumo-item">
              <strong>R$ ${resumo.valor_total.toFixed(2)}</strong>
              Valor Total
            </div>
            <div class="resumo-item">
              <strong>R$ ${resumo.valor_medio.toFixed(2)}</strong>
              Ticket Médio
            </div>
            <div class="resumo-item">
              <strong>${resumo.creditos} / ${resumo.debitos}</strong>
              Crédito / Débito
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Valor</th>
                <th>Forma</th>
                <th>Data</th>
                <th>Usuário</th>
              </tr>
            </thead>
            <tbody>
              ${relatorio.registros.map(r => `
                <tr>
                  <td>#${r.id}</td>
                  <td>${r.cliente_nome}</td>
                  <td>R$ ${parseFloat(r.valor).toFixed(2)}</td>
                  <td>${r.forma_pagamento}</td>
                  <td>${new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td>${r.usuario_nome || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([conteudo], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    
    showToast('✅ PDF gerado com sucesso!', 'success');
  };

  const limparFiltros = () => {
    setFiltros({
      periodo_inicio: '',
      periodo_fim: '',
      funcionario: '',
      forma_pagamento: '',
      cliente: ''
    });
    setRelatorio(null);
    setResumo({
      total_registros: 0,
      valor_total: 0,
      valor_medio: 0,
      creditos: 0,
      debitos: 0,
      pix: 0,
      valor_credito: 0,
      valor_debito: 0,
      valor_pix: 0
    });
    showToast('Filtros limpos', 'info');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
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
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Gere relatórios detalhados de pagamentos com filtros avançados</p>
        </div>
        {relatorio && relatorio.registros && relatorio.registros.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              onClick={exportarCSV} 
              className="btn-success" 
              disabled={exportLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {exportLoading ? '⏳ Exportando...' : '📥 CSV'}
            </button>
            <button 
              onClick={exportarPDF} 
              className="btn-primary" 
              disabled={exportLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📄 PDF
            </button>
          </div>
        )}
      </div>

      {/* Filtros - SEM BANDEIRA E SEM MAQUININHA */}
      <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
            🔍 Filtros Avançados
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
            {Object.values(filtros).some(v => v) ? 'Filtros ativos' : 'Nenhum filtro aplicado'}
          </span>
        </div>

        <form onSubmit={gerarRelatorio}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px' 
          }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#B0B8C8', fontSize: '0.75rem', fontWeight: '500' }}>
                📅 Período Início
              </label>
              <input
                type="date"
                name="periodo_inicio"
                value={filtros.periodo_inicio}
                onChange={handleFilterChange}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#B0B8C8', fontSize: '0.75rem', fontWeight: '500' }}>
                📅 Período Fim
              </label>
              <input
                type="date"
                name="periodo_fim"
                value={filtros.periodo_fim}
                onChange={handleFilterChange}
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#B0B8C8', fontSize: '0.75rem', fontWeight: '500' }}>
                👤 Funcionário
              </label>
              <input
                type="text"
                name="funcionario"
                value={filtros.funcionario}
                onChange={handleFilterChange}
                placeholder="Nome do funcionário"
                style={{ padding: '10px 14px' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#B0B8C8', fontSize: '0.75rem', fontWeight: '500' }}>
                💰 Forma de Pagamento
              </label>
              <select 
                name="forma_pagamento" 
                value={filtros.forma_pagamento} 
                onChange={handleFilterChange}
                style={{ padding: '10px 14px' }}
              >
                <option value="">Todas</option>
                <option value="CREDITO">Crédito</option>
                <option value="DEBITO">Débito</option>
                <option value="PIX">PIX</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ color: '#B0B8C8', fontSize: '0.75rem', fontWeight: '500' }}>
                👤 Cliente
              </label>
              <input
                type="text"
                name="cliente"
                value={filtros.cliente}
                onChange={handleFilterChange}
                placeholder="Nome ou ID do cliente"
                style={{ padding: '10px 14px' }}
              />
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginTop: '20px',
            flexWrap: 'wrap'
          }}>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
              style={{ 
                padding: '12px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #FFFFFF',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Gerando...
                </>
              ) : (
                '📊 Gerar Relatório'
              )}
            </button>
            
            <button
              type="button"
              onClick={limparFiltros}
              className="btn-secondary"
              style={{ padding: '12px 24px' }}
            >
              🗑️ Limpar Filtros
            </button>
          </div>
        </form>
      </div>

      {/* Resumo - Cards */}
      {relatorio && relatorio.registros && relatorio.registros.length > 0 && (
        <div className="animate-fade-in">
          <div className="grid-4" style={{ marginBottom: '24px' }}>
            <div className="card" style={{ borderBottom: '3px solid #FF6B00' }}>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total de Registros
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '4px', color: '#FFFFFF' }}>
                {resumo.total_registros}
              </div>
            </div>

            <div className="card" style={{ borderBottom: '3px solid #00E676' }}>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Valor Total
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '4px', color: '#FF6B00' }}>
                {formatCurrency(resumo.valor_total)}
              </div>
            </div>

            <div className="card" style={{ borderBottom: '3px solid #2979FF' }}>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Ticket Médio
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '4px', color: '#00E676' }}>
                {formatCurrency(resumo.valor_medio)}
              </div>
            </div>

            <div className="card" style={{ borderBottom: '3px solid #FFAB00' }}>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Crédito / Débito / PIX
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', marginTop: '4px', color: '#FFFFFF' }}>
                {resumo.creditos} / {resumo.debitos} / {resumo.pix}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                Crédito: {formatCurrency(resumo.valor_credito)} | Débito: {formatCurrency(resumo.valor_debito)} | PIX: {formatCurrency(resumo.valor_pix)}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '16px',
            borderBottom: '1px solid #2A3040',
            paddingBottom: '8px'
          }}>
            <button
              onClick={() => setActiveTab('detalhado')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: activeTab === 'detalhado' ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
                color: activeTab === 'detalhado' ? '#FF6B00' : '#B0B8C8',
                border: activeTab === 'detalhado' ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
            >
              📋 Detalhado
            </button>
            <button
              onClick={() => setActiveTab('resumido')}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: activeTab === 'resumido' ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
                color: activeTab === 'resumido' ? '#FF6B00' : '#B0B8C8',
                border: activeTab === 'resumido' ? '1px solid rgba(255, 107, 0, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
            >
              📊 Resumido
            </button>
          </div>

          {/* Tabela Detalhada - SEM BANDEIRA */}
          {activeTab === 'detalhado' && (
            <div className="card">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{ color: '#FFFFFF', fontSize: '1rem' }}>
                  📋 Resultados Detalhados
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  {relatorio.registros.length} registros encontrados
                </span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Valor</th>
                      <th>Forma</th>
                      <th>Data/Hora</th>
                      <th>Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.registros.map((pagamento, index) => (
                      <tr key={pagamento.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.02}s` }}>
                        <td style={{ fontWeight: '600', color: '#FF6B00' }}>#{pagamento.id}</td>
                        <td>
                          <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{pagamento.cliente_nome}</div>
                          <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>ID: {pagamento.cliente_id}</div>
                        </td>
                        <td style={{ fontWeight: '600', color: '#FF6B00' }}>
                          {formatCurrency(pagamento.valor)}
                        </td>
                        <td>{getFormaBadge(pagamento.forma_pagamento)}</td>
                        <td style={{ fontSize: '0.8rem' }}>{formatDate(pagamento.created_at)}</td>
                        <td style={{ fontSize: '0.85rem' }}>{pagamento.usuario_nome || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela Resumida */}
          {activeTab === 'resumido' && (
            <div className="card">
              <h3 style={{ marginBottom: '16px', color: '#FFFFFF', fontSize: '1rem' }}>
                📊 Resumo por Forma de Pagamento
              </h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Forma de Pagamento</th>
                      <th>Quantidade</th>
                      <th>Valor Total</th>
                      <th>Ticket Médio</th>
                      <th>Percentual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { forma: 'CREDITO', count: resumo.creditos, valor: resumo.valor_credito },
                      { forma: 'DEBITO', count: resumo.debitos, valor: resumo.valor_debito },
                      { forma: 'PIX', count: resumo.pix, valor: resumo.valor_pix }
                    ].filter(item => item.count > 0).map((item, index) => {
                      const percentual = resumo.valor_total > 0 
                        ? (item.valor / resumo.valor_total) * 100 
                        : 0;
                      return (
                        <tr key={index}>
                          <td>{getFormaBadge(item.forma)}</td>
                          <td style={{ fontWeight: '500' }}>{item.count}</td>
                          <td style={{ fontWeight: '600', color: '#FF6B00' }}>
                            {formatCurrency(item.valor)}
                          </td>
                          <td>{formatCurrency(item.count > 0 ? item.valor / item.count : 0)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '100px',
                                height: '6px',
                                background: '#2A3040',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${percentual}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #FF6B00, #FF9A2F)',
                                  borderRadius: '3px',
                                  transition: 'width 0.5s ease'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.85rem', color: '#B0B8C8' }}>
                                {percentual.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {resumo.creditos === 0 && resumo.debitos === 0 && resumo.pix === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#6B7280' }}>
                          Nenhum dado para resumir
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {!relatorio && !loading && (
        <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📊</div>
          <div style={{ color: '#B0B8C8', fontSize: '1.2rem', fontWeight: '500' }}>
            Aplique os filtros e clique em "Gerar Relatório"
          </div>
          <div style={{ color: '#6B7280', fontSize: '0.95rem', marginTop: '8px' }}>
            Selecione o período desejado para visualizar os dados
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            justifyContent: 'center', 
            marginTop: '24px',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              padding: '12px 20px', 
              borderRadius: '8px',
              border: '1px solid #2A3040'
            }}>
              <span style={{ color: '#6B7280' }}>📅 Período</span>
            </div>
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              padding: '12px 20px', 
              borderRadius: '8px',
              border: '1px solid #2A3040'
            }}>
              <span style={{ color: '#6B7280' }}>👤 Funcionário</span>
            </div>
            <div style={{ 
              background: 'rgba(255,255,255,0.03)', 
              padding: '12px 20px', 
              borderRadius: '8px',
              border: '1px solid #2A3040'
            }}>
              <span style={{ color: '#6B7280' }}>💳 Forma de Pagamento</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Relatorios;