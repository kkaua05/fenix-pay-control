const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const pagamentoRoutes = require('./routes/pagamentoRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const logRoutes = require('./routes/logRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const arquivoRoutes = require('./routes/arquivoRoutes');
// const portalRoutes = require('./routes/portalRoutes'); // REMOVIDO
const { limiter } = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Middlewares de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS - allow multiple origins for dev and production
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://frontend-wine-zeta-62.vercel.app',
  'https://frontend-jjhmgu4jy-kkaua05s-projects.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in production for now
    }
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api', limiter);

// Arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// ROTAS DA API
// ============================================================

// Autenticação
app.use('/api/auth', authRoutes);

// Pagamentos
app.use('/api/pagamentos', pagamentoRoutes);

// Usuários
app.use('/api/usuarios', usuarioRoutes);

// Relatórios
app.use('/api/relatorios', relatorioRoutes);

// Logs
app.use('/api/logs', logRoutes);

// Clientes
app.use('/api/clientes', clienteRoutes);

// Arquivos
app.use('/api/arquivos', arquivoRoutes);

// Portal - Automação (REMOVIDO)
// app.use('/api/portal', portalRoutes);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use(errorHandler);

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

module.exports = app;