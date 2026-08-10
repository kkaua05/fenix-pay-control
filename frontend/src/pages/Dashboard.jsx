import { useState, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import AnimatedNumber from '../components/common/AnimatedNumber';

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    today: { total: 0, valor_total: 0 },
    totals: { 
      total: 0, 
      valor_total: 0, 
      credito: { count: 0, valor: 0 },
      debito: { count: 0, valor: 0 },
      pix: { count: 0, valor: 0 }
    },
    last_payment: null,
    dailyData: [],
    topClients: [],
    recentPayments: []
  });
  const [pieData, setPieData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard');
      const data = response.data.data;

      setDashboardData({
        today: data.today || { total: 0, valor_total: 0 },
        totals: data.totals || { 
          total: 0, 
          valor_total: 0, 
          credito: { count: 0, valor: 0 },
          debito: { count: 0, valor: 0 },
          pix: { count: 0, valor: 0 }
        },
        last_payment: data.last_payment || null,
        dailyData: data.daily || [],
        topClients: data.top_clients || [],
        recentPayments: data.recent_payments || []
      });

      const totals = data.totals || {};
      const creditoValor = totals.credito?.valor || 0;
      const debitoValor = totals.debito?.valor || 0;
      const pixValor = totals.pix?.valor || 0;
      
      const pieDataArray = [];
      if (creditoValor > 0) pieDataArray.push({ name: 'Crédito', value: creditoValor, color: '#FF6B00' });
      if (debitoValor > 0) pieDataArray.push({ name: 'Débito', value: debitoValor, color: '#00E676' });
      if (pixValor > 0) pieDataArray.push({ name: 'PIX', value: pixValor, color: '#2979FF' });
      
      if (pieDataArray.length === 0) {
        pieDataArray.push({ name: 'Sem dados', value: 1, color: '#6B7280' });
      }
      
      setPieData(pieDataArray);
      setDailyData(data.daily || []);
      setTopClients(data.top_clients || []);
      setRecentPayments(data.recent_payments || []);

      setLoading(false);
    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error);
      setLoading(false);
    }
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

  const formatDateShort = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR');
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

  const COLORS = ['#FF6B00', '#00E676', '#2979FF', '#FFAB00'];

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
            Carregando dashboard...
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

  const { today, totals, last_payment } = dashboardData;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Bem-vindo, {user?.nome || 'Usuário'}</p>
        </div>
      </div>

      {/* Cards Principais */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card animate-fade-in" style={{ borderBottom: '3px solid #FF6B00' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Pagamentos Hoje
              </div>
              <div className="stat-value" style={{ marginTop: '4px' }}>
                <AnimatedNumber value={today?.total || 0} />
              </div>
              <div style={{ color: '#00E676', fontSize: '0.95rem', fontWeight: '500' }}>
                {formatCurrency(today?.valor_total || 0)}
              </div>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255, 107, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              📊
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#6B7280' }}>
            {today?.total > 0 ? `+${today.total} registros hoje` : 'Nenhum registro hoje'}
          </div>
        </div>

        <div className="card animate-fade-in" style={{ borderBottom: '3px solid #00E676', animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Geral
              </div>
              <div className="stat-value" style={{ marginTop: '4px' }}>
                <AnimatedNumber value={totals?.total || 0} />
              </div>
              <div style={{ color: '#FF6B00', fontSize: '0.95rem', fontWeight: '500' }}>
                {formatCurrency(totals?.valor_total || 0)}
              </div>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(0, 230, 118, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              💰
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#6B7280' }}>
            Ticket médio: {formatCurrency(totals?.total > 0 ? (totals?.valor_total || 0) / (totals?.total || 1) : 0)}
          </div>
        </div>

        <div className="card animate-fade-in" style={{ borderBottom: '3px solid #2979FF', animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Crédito
              </div>
              <div className="stat-value" style={{ marginTop: '4px' }}>
                <AnimatedNumber value={totals?.credito?.count || 0} />
              </div>
              <div style={{ color: '#2979FF', fontSize: '0.95rem', fontWeight: '500' }}>
                {formatCurrency(totals?.credito?.valor || 0)}
              </div>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(41, 121, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              💳
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#6B7280' }}>
            {totals?.total > 0 ? `${((totals?.credito?.count || 0) / (totals?.total || 1) * 100).toFixed(1)}% do total` : '0% do total'}
          </div>
        </div>

        <div className="card animate-fade-in" style={{ borderBottom: '3px solid #FFAB00', animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Débito
              </div>
              <div className="stat-value" style={{ marginTop: '4px' }}>
                <AnimatedNumber value={totals?.debito?.count || 0} />
              </div>
              <div style={{ color: '#FFAB00', fontSize: '0.95rem', fontWeight: '500' }}>
                {formatCurrency(totals?.debito?.valor || 0)}
              </div>
            </div>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255, 171, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              💳
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#6B7280' }}>
            {totals?.total > 0 ? `${((totals?.debito?.count || 0) / (totals?.total || 1) * 100).toFixed(1)}% do total` : '0% do total'}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>
              📈 Evolução de Pagamentos
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              Últimos {dailyData.length} dias
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData.length > 0 ? dailyData : []}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#FF6B00" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3040" />
              <XAxis dataKey="dia" stroke="#6B7280" tick={{ fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} tickFormatter={(value) => `R$ ${value}`} />
              <Tooltip 
                contentStyle={{ 
                  background: '#161A22', 
                  border: '1px solid #2A3040',
                  borderRadius: '10px',
                  color: '#FFFFFF'
                }}
                labelStyle={{ color: '#B0B8C8' }}
                formatter={(value) => [`R$ ${(value || 0).toFixed(2)}`, 'Valor']}
              />
              <Area type="monotone" dataKey="valor" stroke="#FF6B00" fillOpacity={1} fill="url(#colorValor)" />
            </AreaChart>
          </ResponsiveContainer>
          {dailyData.every(d => d.valor === 0) && (
            <div style={{ textAlign: 'center', color: '#6B7280', marginTop: '-20px', fontSize: '0.9rem' }}>
              Nenhum pagamento registrado no período
            </div>
          )}
        </div>

        <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>
              🍩 Distribuição por Forma
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              Total: {formatCurrency(totals?.valor_total || 0)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                labelLine={false}
                label={({ name, percent }) => {
                  const pct = (percent * 100).toFixed(0);
                  return pct > 5 ? `${name} ${pct}%` : '';
                }}
                outerRadius={90}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`R$ ${(value || 0).toFixed(2)}`, 'Valor']}
                contentStyle={{ 
                  background: '#161A22', 
                  border: '1px solid #2A3040',
                  borderRadius: '10px',
                  color: '#FFFFFF'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span style={{ color: '#B0B8C8', fontSize: '0.85rem' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          {pieData.every(d => d.value === 0 || d.value === 1) && (
            <div style={{ textAlign: 'center', color: '#6B7280', marginTop: '-20px', fontSize: '0.9rem' }}>
              Nenhum pagamento registrado
            </div>
          )}
        </div>
      </div>

      {/* Top Clientes e Últimos Pagamentos */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="card animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>
              🏆 Top Clientes
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              Mais frequentes
            </span>
          </div>
          {topClients.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topClients.map((client, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}, ${COLORS[(index + 1) % COLORS.length]})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      color: '#FFFFFF'
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ color: '#FFFFFF', fontWeight: '500', fontSize: '0.9rem' }}>
                        {client.cliente_nome}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                        {client.total_pagamentos} pagamentos
                      </div>
                    </div>
                  </div>
                  <div style={{ color: '#FF6B00', fontWeight: '600', fontSize: '0.95rem' }}>
                    {formatCurrency(client.valor_total)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6B7280', padding: '30px 0' }}>
              Nenhum cliente com pagamentos
            </div>
          )}
        </div>

        <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>
              📋 Últimos Pagamentos
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              Recentes
            </span>
          </div>
          {recentPayments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentPayments.map((payment, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid #2A3040'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#00E676'
                    }} />
                    <div>
                      <div style={{ color: '#FFFFFF', fontSize: '0.85rem', fontWeight: '500' }}>
                        {payment.cliente_nome}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>
                        {formatDateShort(payment.created_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {getFormaBadge(payment.forma_pagamento)}
                    <div style={{ color: '#FF6B00', fontWeight: '600', fontSize: '0.95rem' }}>
                      {formatCurrency(payment.valor)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#6B7280', padding: '30px 0' }}>
              Nenhum pagamento recente
            </div>
          )}
        </div>
      </div>

      {/* Último Pagamento - SEM BANDEIRA */}
      {last_payment ? (
        <div className="card animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>
              🔄 Último Pagamento
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
              #{last_payment.id}
            </span>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: '16px',
            padding: '8px 0'
          }}>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cliente
              </div>
              <div style={{ fontWeight: '500', color: '#FFFFFF', fontSize: '1rem' }}>
                {last_payment.cliente_nome}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>ID: {last_payment.cliente_id}</div>
            </div>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Valor
              </div>
              <div style={{ fontWeight: '600', color: '#FF6B00', fontSize: '1.3rem' }}>
                {formatCurrency(last_payment.valor)}
              </div>
            </div>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Forma
              </div>
              <div style={{ color: '#FFFFFF' }}>
                {getFormaBadge(last_payment.forma_pagamento)}
              </div>
            </div>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Data
              </div>
              <div style={{ color: '#FFFFFF', fontSize: '0.9rem' }}>
                {formatDate(last_payment.created_at)}
              </div>
            </div>
            <div>
              <div style={{ color: '#6B7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Usuário
              </div>
              <div style={{ color: '#FFFFFF' }}>{last_payment.usuario_nome || '—'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card animate-fade-in" style={{ animationDelay: '0.2s', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
          <div style={{ color: '#6B7280' }}>Nenhum pagamento registrado ainda</div>
          <div style={{ color: '#6B7280', fontSize: '0.85rem', marginTop: '4px' }}>
            Comece registrando seu primeiro pagamento
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;