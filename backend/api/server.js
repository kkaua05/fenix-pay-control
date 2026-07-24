// ============================================================
// FENIX PAY CONTROL - Vercel Serverless Entry Point
// ============================================================
// This is a completely self-contained serverless function
// that works reliably on Vercel's Node.js runtime.

const express = require('express');
const cors = require('cors');

// Load env vars (Vercel provides them via dashboard)
try { require('dotenv').config(); } catch(e) { /* ignore */ }

const app = express();

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple logger
const log = (msg, data) => {
  console.log(`[${new Date().toISOString()}] ${msg}`, data || '');
};

// ============================================================
// DATABASE CONNECTION
// ============================================================
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

async function query(text, params) {
  const client = getPool();
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    log(`Query OK (${Date.now() - start}ms): ${text.substring(0, 80)}`);
    return res;
  } catch (error) {
    log(`Query ERROR: ${error.message}`, { text: text.substring(0, 100) });
    throw error;
  }
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
  }
}

function isAdmin(req, res, next) {
  if (req.user.perfil !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Acesso restrito a administradores' });
  }
  next();
}

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// ============================================================
// AUTH ROUTES
// ============================================================
const bcrypt = require('bcryptjs');

app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
      return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios' });
    }

    const result = await query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    if (!user.ativo) {
      return res.status(401).json({ success: false, message: 'Usuário desativado' });
    }

    const validPassword = await bcrypt.compare(senha, user.senha);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, nome: user.nome, perfil: user.perfil, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log the login
    try {
      await query(
        `INSERT INTO logs (usuario, usuario_id, acao, descricao, ip, navegador, sistema)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.nome, user.id, 'LOGIN', 'Login realizado com sucesso', req.ip, req.headers['user-agent'], req.headers['sec-ch-ua-platform'] || 'Unknown']
      );
    } catch(e) { /* ignore log errors */ }

    res.json({
      success: true,
      token,
      user: { id: user.id, nome: user.nome, usuario: user.usuario, email: user.email, perfil: user.perfil }
    });
  } catch (error) {
    log('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

app.get('/api/auth/verify', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ============================================================
// DASHBOARD
// ============================================================
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [todayRes, totalRes, creditoRes, debitoRes, pixRes, dailyRes, topClientsRes, recentRes] = await Promise.all([
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM pagamentos WHERE created_at >= $1 AND created_at < $2`, [today, tomorrow]),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM pagamentos`),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM pagamentos WHERE forma_pagamento = 'CREDITO'`),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM pagamentos WHERE forma_pagamento = 'DEBITO'`),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor), 0) as valor_total FROM pagamentos WHERE forma_pagamento = 'PIX'`),
      query(`SELECT DATE(created_at) as data, TO_CHAR(created_at, 'Dy') as dia, COUNT(*) as quantidade, COALESCE(SUM(valor), 0) as valor FROM pagamentos WHERE created_at >= $1 AND created_at < $2 GROUP BY DATE(created_at), TO_CHAR(created_at, 'Dy') ORDER BY data`, [sevenDaysAgo, tomorrow]),
      query(`SELECT cliente_id, cliente_nome, COUNT(*) as total_pagamentos, COALESCE(SUM(valor), 0) as valor_total FROM pagamentos GROUP BY cliente_id, cliente_nome ORDER BY total_pagamentos DESC LIMIT 5`),
      query(`SELECT p.*, u.nome as usuario_nome FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id = u.id ORDER BY p.created_at DESC LIMIT 5`)
    ]);

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dailyMap = {};
    (dailyRes.rows || []).forEach(d => { dailyMap[d.dia] = d; });
    const filledDaily = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(date.getDate() + i);
      const dayName = dayNames[date.getDay()];
      const dayData = dailyMap[dayName] || { dia: dayName, data: date.toISOString().split('T')[0], quantidade: 0, valor: 0 };
      filledDaily.push(dayData);
    }

    res.json({
      success: true,
      data: {
        today: { total: parseInt(todayRes.rows[0]?.total) || 0, valor_total: parseFloat(todayRes.rows[0]?.valor_total) || 0 },
        totals: {
          total: parseInt(totalRes.rows[0]?.total) || 0,
          valor_total: parseFloat(totalRes.rows[0]?.valor_total) || 0,
          credito: { count: parseInt(creditoRes.rows[0]?.total) || 0, valor: parseFloat(creditoRes.rows[0]?.valor_total) || 0 },
          debito: { count: parseInt(debitoRes.rows[0]?.total) || 0, valor: parseFloat(debitoRes.rows[0]?.valor_total) || 0 },
          pix: { count: parseInt(pixRes.rows[0]?.total) || 0, valor: parseFloat(pixRes.rows[0]?.valor_total) || 0 }
        },
        daily: filledDaily,
        top_clients: (topClientsRes.rows || []).map(r => ({ cliente_id: r.cliente_id, cliente_nome: r.cliente_nome, total_pagamentos: parseInt(r.total_pagamentos) || 0, valor_total: parseFloat(r.valor_total) || 0 })),
        recent_payments: (recentRes.rows || []).map(r => ({ ...r, valor: parseFloat(r.valor) || 0 }))
      }
    });
  } catch (error) {
    log('Dashboard error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao carregar dashboard' });
  }
});

// ============================================================
// PAGAMENTOS
// ============================================================
app.get('/api/pagamentos', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, data_inicio, data_fim, forma_pagamento } = req.query;

    let where = [];
    let values = [];
    let pc = 1;

    if (search) {
      where.push(`(CAST(cliente_id AS TEXT) ILIKE $${pc} OR cliente_nome ILIKE $${pc})`);
      values.push(`%${search}%`);
      pc++;
    }
    if (data_inicio && data_fim) {
      where.push(`created_at BETWEEN $${pc} AND $${pc+1}`);
      values.push(data_inicio, data_fim);
      pc += 2;
    }
    if (forma_pagamento) {
      where.push(`forma_pagamento = $${pc}`);
      values.push(forma_pagamento);
      pc++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [result, countRes] = await Promise.all([
      query(`SELECT p.*, u.nome as usuario_nome, u.usuario as usuario_login FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id = u.id ${whereClause} ORDER BY p.created_at DESC LIMIT $${pc} OFFSET $${pc+1}`, [...values, limit, offset]),
      query(`SELECT COUNT(*) as total FROM pagamentos p ${whereClause}`, values)
    ]);

    res.json({
      success: true,
      data: result.rows || [],
      pagination: { page, limit, total: parseInt(countRes.rows[0]?.total || 0), pages: Math.ceil(parseInt(countRes.rows[0]?.total || 0) / limit) }
    });
  } catch (error) {
    log('List pagamentos error:', error.message);
    res.status(500).json({ success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
  }
});

app.post('/api/pagamentos', auth, async (req, res) => {
  try {
    const { cliente_id, cliente_nome, valor, forma_pagamento, bandeira, parcelas, observacoes, comprovante } = req.body;
    
    if (!cliente_id || !cliente_nome || !valor || !forma_pagamento) {
      return res.status(400).json({ success: false, message: 'Campos obrigatórios: cliente_id, cliente_nome, valor, forma_pagamento' });
    }

    const result = await query(
      `INSERT INTO pagamentos (cliente_id, cliente_nome, valor, forma_pagamento, bandeira, parcelas, observacoes, comprovante, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [String(cliente_id), String(cliente_nome), parseFloat(valor), String(forma_pagamento), bandeira || 'VISA', parseInt(parcelas) || 1, observacoes || null, comprovante || null, parseInt(req.user.id)]
    );

    try {
      await query(`INSERT INTO logs (usuario, usuario_id, acao, descricao) VALUES ($1, $2, $3, $4)`,
        [req.user.nome, req.user.id, 'CREATE_PAGAMENTO', `Criou pagamento #${result.rows[0].id} para ${cliente_nome}`]);
    } catch(e) {}

    res.status(201).json({ success: true, data: result.rows[0], message: 'Pagamento criado com sucesso!' });
  } catch (error) {
    log('Create pagamento error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao criar pagamento' });
  }
});

app.get('/api/pagamentos/:id', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.nome as usuario_nome, u.usuario as usuario_login, u.email as usuario_email
       FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Pagamento não encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    log('Get pagamento error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao buscar pagamento' });
  }
});

app.put('/api/pagamentos/:id', auth, async (req, res) => {
  try {
    const { cliente_id, cliente_nome, valor, forma_pagamento, bandeira, parcelas, observacoes, comprovante } = req.body;
    const fields = [];
    const values = [];
    let pc = 1;

    if (cliente_id !== undefined) { fields.push(`cliente_id = $${pc}`); values.push(String(cliente_id)); pc++; }
    if (cliente_nome !== undefined) { fields.push(`cliente_nome = $${pc}`); values.push(String(cliente_nome)); pc++; }
    if (valor !== undefined) { fields.push(`valor = $${pc}`); values.push(parseFloat(valor)); pc++; }
    if (forma_pagamento !== undefined) { fields.push(`forma_pagamento = $${pc}`); values.push(String(forma_pagamento)); pc++; }
    if (bandeira !== undefined) { fields.push(`bandeira = $${pc}`); values.push(bandeira); pc++; }
    if (parcelas !== undefined) { fields.push(`parcelas = $${pc}`); values.push(parseInt(parcelas)); pc++; }
    if (observacoes !== undefined) { fields.push(`observacoes = $${pc}`); values.push(observacoes); pc++; }
    if (comprovante !== undefined) { fields.push(`comprovante = $${pc}`); values.push(comprovante); pc++; }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(parseInt(req.params.id));

    const result = await query(
      `UPDATE pagamentos SET ${fields.join(', ')} WHERE id = $${pc} RETURNING *`,
      values
    );

    res.json({ success: true, data: result.rows[0], message: 'Pagamento atualizado com sucesso!' });
  } catch (error) {
    log('Update pagamento error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao atualizar pagamento' });
  }
});

app.delete('/api/pagamentos/:id', auth, async (req, res) => {
  try {
    const result = await query('DELETE FROM pagamentos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Pagamento não encontrado' });
    }
    res.json({ success: true, message: 'Pagamento excluído com sucesso!' });
  } catch (error) {
    log('Delete pagamento error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao excluir pagamento' });
  }
});

// ============================================================
// CLIENTES
// ============================================================
app.get('/api/clientes', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [result, countRes] = await Promise.all([
      query('SELECT * FROM clientes ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]),
      query('SELECT COUNT(*) as total FROM clientes')
    ]);

    res.json({
      success: true,
      data: result.rows || [],
      pagination: { page, limit, total: parseInt(countRes.rows[0]?.total || 0), pages: Math.ceil(parseInt(countRes.rows[0]?.total || 0) / limit) }
    });
  } catch (error) {
    log('List clientes error:', error.message);
    res.status(500).json({ success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
  }
});

app.get('/api/clientes/search', auth, async (req, res) => {
  try {
    const term = req.query.q || req.query.term || '';
    if (!term) {
      return res.json({ success: true, data: [] });
    }
    const result = await query(
      `SELECT * FROM clientes WHERE nome_completo ILIKE $1 OR cpf ILIKE $1 OR CAST(id AS TEXT) ILIKE $1 ORDER BY nome_completo LIMIT 20`,
      [`%${term}%`]
    );
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    log('Search clientes error:', error.message);
    res.status(500).json({ success: false, data: [] });
  }
});

app.get('/api/clientes/:id', auth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM clientes WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    log('Get cliente error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao buscar cliente' });
  }
});

app.post('/api/clientes', auth, isAdmin, async (req, res) => {
  try {
    const { id, nome_completo, cpf } = req.body;
    if (!nome_completo) {
      return res.status(400).json({ success: false, message: 'Nome do cliente é obrigatório' });
    }

    let queryText, params;
    if (id) {
      queryText = `INSERT INTO clientes (id, nome_completo, cpf) VALUES ($1, $2, $3) RETURNING *`;
      params = [id, nome_completo, cpf || null];
    } else {
      queryText = `INSERT INTO clientes (nome_completo, cpf) VALUES ($1, $2) RETURNING *`;
      params = [nome_completo, cpf || null];
    }

    const result = await query(queryText, params);
    res.status(201).json({ success: true, data: result.rows[0], message: 'Cliente criado com sucesso!' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Já existe um cliente com este ID' });
    }
    log('Create cliente error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao criar cliente' });
  }
});

app.put('/api/clientes/:id', auth, isAdmin, async (req, res) => {
  try {
    const { nome_completo, cpf } = req.body;
    const result = await query(
      'UPDATE clientes SET nome_completo = $1, cpf = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [nome_completo, cpf, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
    }
    res.json({ success: true, data: result.rows[0], message: 'Cliente atualizado com sucesso!' });
  } catch (error) {
    log('Update cliente error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao atualizar cliente' });
  }
});

app.delete('/api/clientes/:id', auth, isAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM clientes WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
    }
    res.json({ success: true, message: 'Cliente excluído com sucesso!' });
  } catch (error) {
    log('Delete cliente error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao excluir cliente' });
  }
});

// ============================================================
// USUÁRIOS
// ============================================================
app.get('/api/usuarios', auth, isAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id, nome, usuario, email, perfil, ativo, created_at FROM usuarios WHERE ativo = true ORDER BY nome');
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    log('List usuarios error:', error.message);
    res.status(500).json({ success: false, data: [] });
  }
});

app.post('/api/usuarios', auth, isAdmin, async (req, res) => {
  try {
    const { nome, usuario, email, senha, perfil } = req.body;
    if (!nome || !usuario || !email || !senha) {
      return res.status(400).json({ success: false, message: 'Campos obrigatórios: nome, usuario, email, senha' });
    }
    const hashedPassword = await bcrypt.hash(senha, 10);
    const result = await query(
      `INSERT INTO usuarios (nome, usuario, email, senha, perfil) VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, usuario, email, perfil, ativo, created_at`,
      [nome, usuario, email, hashedPassword, perfil || 'FUNCIONARIO']
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Usuário criado com sucesso!' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Usuário ou email já existe' });
    }
    log('Create usuario error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao criar usuário' });
  }
});

app.put('/api/usuarios/:id', auth, isAdmin, async (req, res) => {
  try {
    const { nome, email, perfil, ativo } = req.body;
    const result = await query(
      `UPDATE usuarios SET nome = $1, email = $2, perfil = $3, ativo = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id, nome, usuario, email, perfil, ativo`,
      [nome, email, perfil, ativo !== undefined ? ativo : true, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    res.json({ success: true, data: result.rows[0], message: 'Usuário atualizado com sucesso!' });
  } catch (error) {
    log('Update usuario error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao atualizar usuário' });
  }
});

app.post('/api/usuarios/:id/reset-password', auth, isAdmin, async (req, res) => {
  try {
    const { nova_senha } = req.body;
    if (!nova_senha || nova_senha.length < 6) {
      return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres' });
    }
    const hashedPassword = await bcrypt.hash(nova_senha, 10);
    await query('UPDATE usuarios SET senha = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, req.params.id]);
    res.json({ success: true, message: 'Senha alterada com sucesso!' });
  } catch (error) {
    log('Reset password error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao alterar senha' });
  }
});

// ============================================================
// RELATÓRIOS
// ============================================================
app.get('/api/relatorios', auth, async (req, res) => {
  try {
    const { periodo_inicio, periodo_fim, funcionario, forma_pagamento, cliente } = req.query;
    let where = [];
    let values = [];
    let pc = 1;

    if (periodo_inicio && periodo_fim) {
      where.push(`p.created_at BETWEEN $${pc} AND $${pc+1}`);
      values.push(periodo_inicio, periodo_fim);
      pc += 2;
    }
    if (funcionario) {
      where.push(`u.nome ILIKE $${pc}`);
      values.push(`%${funcionario}%`);
      pc++;
    }
    if (forma_pagamento) {
      where.push(`p.forma_pagamento = $${pc}`);
      values.push(forma_pagamento);
      pc++;
    }
    if (cliente) {
      where.push(`(CAST(p.cliente_id AS TEXT) ILIKE $${pc} OR p.cliente_nome ILIKE $${pc})`);
      values.push(`%${cliente}%`);
      pc++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(
      `SELECT p.*, u.nome as usuario_nome, u.usuario as usuario_login FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id = u.id ${whereClause} ORDER BY p.created_at DESC`,
      values
    );

    const rows = result.rows || [];
    const summary = {
      total_registros: rows.length,
      valor_total: rows.reduce((s, p) => s + parseFloat(p.valor || 0), 0),
      valor_medio: rows.length > 0 ? rows.reduce((s, p) => s + parseFloat(p.valor || 0), 0) / rows.length : 0,
      creditos: rows.filter(p => p.forma_pagamento === 'CREDITO').length,
      debitos: rows.filter(p => p.forma_pagamento === 'DEBITO').length,
      pix: rows.filter(p => p.forma_pagamento === 'PIX').length,
      valor_credito: rows.filter(p => p.forma_pagamento === 'CREDITO').reduce((s, p) => s + parseFloat(p.valor || 0), 0),
      valor_debito: rows.filter(p => p.forma_pagamento === 'DEBITO').reduce((s, p) => s + parseFloat(p.valor || 0), 0),
      valor_pix: rows.filter(p => p.forma_pagamento === 'PIX').reduce((s, p) => s + parseFloat(p.valor || 0), 0)
    };

    res.json({ success: true, data: { registros: rows, summary, filtros: req.query, total_registros: rows.length, data_geracao: new Date().toISOString() } });
  } catch (error) {
    log('Relatorios error:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao gerar relatório' });
  }
});

// ============================================================
// LOGS
// ============================================================
app.get('/api/logs', auth, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { usuario, acao, data_inicio, data_fim } = req.query;

    let where = [];
    let values = [];
    let pc = 1;

    if (usuario) { where.push(`usuario ILIKE $${pc}`); values.push(`%${usuario}%`); pc++; }
    if (acao) { where.push(`acao = $${pc}`); values.push(acao); pc++; }
    if (data_inicio && data_fim) { where.push(`created_at BETWEEN $${pc} AND $${pc+1}`); values.push(data_inicio, data_fim); pc += 2; }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [result, countRes] = await Promise.all([
      query(`SELECT * FROM logs ${whereClause} ORDER BY created_at DESC LIMIT $${pc} OFFSET $${pc+1}`, [...values, limit, offset]),
      query(`SELECT COUNT(*) as total FROM logs ${whereClause}`, values)
    ]);

    res.json({
      success: true,
      data: result.rows || [],
      pagination: { page, limit, total: parseInt(countRes.rows[0]?.total || 0), pages: Math.ceil(parseInt(countRes.rows[0]?.total || 0) / limit) }
    });
  } catch (error) {
    log('List logs error:', error.message);
    res.status(500).json({ success: false, data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } });
  }
});

// ============================================================
// ARQUIVOS
// ============================================================
app.get('/api/arquivos', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, categoria, pagamento_id } = req.query;

    let where = [];
    let values = [];
    let pc = 1;

    if (search) { where.push(`(nome_original ILIKE $${pc} OR descricao ILIKE $${pc} OR categoria ILIKE $${pc})`); values.push(`%${search}%`); pc++; }
    if (categoria) { where.push(`categoria = $${pc}`); values.push(categoria); pc++; }
    if (pagamento_id) { where.push(`pagamento_id = $${pc}`); values.push(parseInt(pagamento_id)); pc++; }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [result, countRes] = await Promise.all([
      query(`SELECT a.*, u.nome as usuario_nome, u.usuario as usuario_login FROM arquivos a LEFT JOIN usuarios u ON a.usuario_id = u.id ${whereClause} ORDER BY a.created_at DESC LIMIT $${pc} OFFSET $${pc+1}`, [...values, limit, offset]),
      query(`SELECT COUNT(*) as total FROM arquivos a ${whereClause}`, values)
    ]);

    res.json({
      success: true,
      data: result.rows || [],
      pagination: { page, limit, total: parseInt(countRes.rows[0]?.total || 0), pages: Math.ceil(parseInt(countRes.rows[0]?.total || 0) / limit) }
    });
  } catch (error) {
    log('List arquivos error:', error.message);
    res.status(500).json({ success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
  }
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' });
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  log('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Erro interno do servidor' });
});

// ============================================================
// EXPORT for Vercel
// ============================================================
module.exports = app;