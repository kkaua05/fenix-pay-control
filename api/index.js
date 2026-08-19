// ============================================================
// FENIX PAY CONTROL - Vercel Serverless Entry Point
// ============================================================
// Este arquivo contém TODAS as rotas da API em um único arquivo
// para funcionar perfeitamente no Vercel (serverless functions).
// 
// O frontend estático é servido pelo próprio Vercel via outputDirectory.
// Basta configurar DATABASE_URL e JWT_SECRET no Vercel Dashboard.

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { put, del } = require('@vercel/blob');

try { require('dotenv').config(); } catch(e) { /* Vercel fornece env vars via dashboard */ }

const app = express();
app.set('trust proxy', true);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const log = (msg, data) => {
  console.log(`[${new Date().toISOString()}] ${msg}`, data || '');
};

// ============================================================
// DATABASE (Neon PostgreSQL)
// ============================================================
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não configurada no Vercel Dashboard');
    pool = new Pool({
      connectionString: url,
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
    return res;
  } catch (error) {
    log(`Query ERROR: ${error.message}`);
    throw error;
  }
}

// ============================================================
// JWT & BCRYPT
// ============================================================
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
  }
}

function isAdmin(req, res, next) {
  if (req.user.perfil !== 'ADMIN')
    return res.status(403).json({ success: false, message: 'Acesso restrito a administradores' });
  next();
}

// ============================================================
// ROTAS
// ============================================================

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// DB Check
app.get('/api/db-check', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as time, current_database() as db, version() as version');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Setup (cria tabelas + admin)
app.post('/api/setup', async (req, res) => {
  try {
    log('Iniciando setup...');
    if (!process.env.DATABASE_URL)
      return res.status(500).json({ success: false, message: 'DATABASE_URL não configurada.' });

    await query(`CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, usuario VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, senha VARCHAR(255) NOT NULL, perfil VARCHAR(50) DEFAULT 'FUNCIONARIO', ativo BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS clientes (id SERIAL PRIMARY KEY, nome_completo VARCHAR(255) NOT NULL, cpf VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS pagamentos (id SERIAL PRIMARY KEY, cliente_id VARCHAR(50) NOT NULL, cliente_nome VARCHAR(255) NOT NULL, valor DECIMAL(10,2) NOT NULL, forma_pagamento VARCHAR(50) NOT NULL, bandeira VARCHAR(50) DEFAULT 'VISA', parcelas INTEGER DEFAULT 1, observacoes TEXT, comprovante TEXT, usuario_id INTEGER REFERENCES usuarios(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, usuario VARCHAR(255), usuario_id INTEGER, acao VARCHAR(100), descricao TEXT, ip VARCHAR(50), navegador TEXT, sistema VARCHAR(100), pagamento_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await query(`CREATE TABLE IF NOT EXISTS arquivos (id SERIAL PRIMARY KEY, nome_original VARCHAR(255), nome_arquivo VARCHAR(255), caminho TEXT, tamanho INTEGER DEFAULT 0, tipo VARCHAR(100), categoria VARCHAR(100), descricao TEXT, tags TEXT, pagamento_id INTEGER, cliente_id INTEGER, usuario_id INTEGER, versao INTEGER DEFAULT 1, arquivo_pai_id INTEGER, publico BOOLEAN DEFAULT false, downloads INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await query("DELETE FROM usuarios WHERE usuario = 'admin'");
    const hash = await bcrypt.hash('admin123', 10);
    await query(`INSERT INTO usuarios (nome, usuario, email, senha, perfil) VALUES ($1,$2,$3,$4,$5)`,
      ['Administrador', 'admin', 'admin@fenixpay.com', hash, 'ADMIN']);

    res.json({ success: true, message: 'Setup concluído! Login: admin / admin123' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios' });

    const result = await query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    if (!user.ativo) return res.status(401).json({ success: false, message: 'Usuário desativado' });

    const valid = await bcrypt.compare(senha, user.senha);
    if (!valid) return res.status(401).json({ success: false, message: 'Credenciais inválidas' });

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, nome: user.nome, perfil: user.perfil, email: user.email },
      process.env.JWT_SECRET, { expiresIn: '24h' }
    );

    res.json({ success: true, token, user: { id: user.id, nome: user.nome, usuario: user.usuario, email: user.email, perfil: user.perfil } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro interno: ' + error.message });
  }
});

app.get('/api/auth/verify', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Dashboard
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-6);

    const [t, tot, cred, deb, pix, daily, top, recent] = await Promise.all([
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor),0) as valor_total FROM pagamentos WHERE created_at>=$1 AND created_at<$2`,[today,tomorrow]),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor),0) as valor_total FROM pagamentos`),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor),0) as valor_total FROM pagamentos WHERE forma_pagamento='CREDITO'`),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor),0) as valor_total FROM pagamentos WHERE forma_pagamento='DEBITO'`),
      query(`SELECT COUNT(*) as total, COALESCE(SUM(valor),0) as valor_total FROM pagamentos WHERE forma_pagamento='PIX'`),
      query(`SELECT DATE(created_at) as data, TO_CHAR(created_at,'Dy') as dia, COUNT(*) as qtd, COALESCE(SUM(valor),0) as valor FROM pagamentos WHERE created_at>=$1 AND created_at<$2 GROUP BY 1,2 ORDER BY 1`,[sevenDaysAgo,tomorrow]),
      query(`SELECT cliente_id,cliente_nome,COUNT(*) as total_pagamentos,COALESCE(SUM(valor),0) as valor_total FROM pagamentos GROUP BY 1,2 ORDER BY 3 DESC LIMIT 5`),
      query(`SELECT p.*,u.nome as usuario_nome FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id=u.id ORDER BY p.created_at DESC LIMIT 5`)
    ]);

    const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const map = {};
    (daily.rows||[]).forEach(d => map[d.dia]=d);
    const filled = [];
    for(let i=0;i<7;i++){
      const dt = new Date(sevenDaysAgo); dt.setDate(dt.getDate()+i);
      const nome = dias[dt.getDay()];
      filled.push(map[nome]||{dia:nome,data:dt.toISOString().split('T')[0],quantidade:0,valor:0});
    }

    res.json({
      success:true,
      data:{
        today:{total:parseInt(t.rows[0]?.total)||0,valor_total:parseFloat(t.rows[0]?.valor_total)||0},
        totals:{total:parseInt(tot.rows[0]?.total)||0,valor_total:parseFloat(tot.rows[0]?.valor_total)||0,
          credito:{count:parseInt(cred.rows[0]?.total)||0,valor:parseFloat(cred.rows[0]?.valor_total)||0},
          debito:{count:parseInt(deb.rows[0]?.total)||0,valor:parseFloat(deb.rows[0]?.valor_total)||0},
          pix:{count:parseInt(pix.rows[0]?.total)||0,valor:parseFloat(pix.rows[0]?.valor_total)||0}},
        daily:filled,
        top_clients:(top.rows||[]).map(r=>({cliente_id:r.cliente_id,cliente_nome:r.cliente_nome,total_pagamentos:parseInt(r.total_pagamentos)||0,valor_total:parseFloat(r.valor_total)||0})),
        recent_payments:(recent.rows||[]).map(r=>({...r,valor:parseFloat(r.valor)||0}))
      }
    });
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao carregar dashboard'});
  }
});

// Listar Pagamentos
app.get('/api/pagamentos', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page)||1, limit = parseInt(req.query.limit)||20, offset=(page-1)*limit;
    const {search,data_inicio,data_fim,forma_pagamento}=req.query;
    let where=[], values=[], pc=1;
    if(search){where.push(`(CAST(cliente_id AS TEXT)ILIKE $${pc} OR cliente_nome ILIKE $${pc})`);values.push(`%${search}%`);pc++;}
    if(data_inicio&&data_fim){where.push(`created_at BETWEEN $${pc} AND $${pc+1}`);values.push(data_inicio,data_fim);pc+=2;}
    if(forma_pagamento){where.push(`forma_pagamento=$${pc}`);values.push(forma_pagamento);pc++;}
    const w = where.length?`WHERE ${where.join(' AND ')}`:'';
    const [result,count]=await Promise.all([
      query(`SELECT p.*,u.nome as usuario_nome,u.usuario as usuario_login FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id=u.id ${w} ORDER BY p.created_at DESC LIMIT $${pc} OFFSET $${pc+1}`,[...values,limit,offset]),
      query(`SELECT COUNT(*) as total FROM pagamentos p ${w}`,values)
    ]);
    res.json({success:true,data:result.rows||[],pagination:{page,limit,total:parseInt(count.rows[0]?.total||0),pages:Math.ceil(parseInt(count.rows[0]?.total||0)/limit)}});
  } catch(error){
    res.status(500).json({success:false,data:[],pagination:{page:1,limit:20,total:0,pages:0}});
  }
});

// Criar Pagamento
app.post('/api/pagamentos', auth, upload.single('comprovante'), async (req, res) => {
  try {
    const {cliente_id,cliente_nome,valor,forma_pagamento,bandeira,parcelas,observacoes}=req.body;
    let comprovante = req.body.comprovante || null;
    if (req.file) comprovante = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    if(!cliente_id||!cliente_nome||!valor||!forma_pagamento) return res.status(400).json({success:false,message:'Campos obrigatórios faltando'});
    const result = await query(`INSERT INTO pagamentos (cliente_id,cliente_nome,valor,forma_pagamento,bandeira,parcelas,observacoes,comprovante,usuario_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [String(cliente_id),String(cliente_nome),parseFloat(valor),String(forma_pagamento),bandeira||'VISA',parseInt(parcelas)||1,observacoes||null,comprovante||null,parseInt(req.user.id)]);
    try{await query(`INSERT INTO logs(usuario,usuario_id,acao,descricao) VALUES($1,$2,$3,$4)`,[req.user.nome,req.user.id,'CREATE_PAGAMENTO',`Criou pagamento #${result.rows[0].id} para ${cliente_nome}`]);}catch(e){}
    res.status(201).json({success:true,data:result.rows[0],message:'Pagamento criado!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao criar pagamento'});
  }
});

// Get Pagamento por ID
app.get('/api/pagamentos/:id', auth, async (req, res) => {
  try {
    const result = await query(`SELECT p.*,u.nome as usuario_nome,u.usuario as usuario_login,u.email as usuario_email FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id=u.id WHERE p.id=$1`,[req.params.id]);
    if(!result.rows[0]) return res.status(404).json({success:false,message:'Pagamento não encontrado'});
    res.json({success:true,data:result.rows[0]});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao buscar pagamento'});
  }
});

// Atualizar Pagamento
app.put('/api/pagamentos/:id', auth, async (req, res) => {
  try {
    const {cliente_id,cliente_nome,valor,forma_pagamento,bandeira,parcelas,observacoes,comprovante}=req.body;
    const fields=[],values=[]; let pc=1;
    if(cliente_id!==undefined){fields.push(`cliente_id=$${pc}`);values.push(String(cliente_id));pc++;}
    if(cliente_nome!==undefined){fields.push(`cliente_nome=$${pc}`);values.push(String(cliente_nome));pc++;}
    if(valor!==undefined){fields.push(`valor=$${pc}`);values.push(parseFloat(valor));pc++;}
    if(forma_pagamento!==undefined){fields.push(`forma_pagamento=$${pc}`);values.push(String(forma_pagamento));pc++;}
    if(bandeira!==undefined){fields.push(`bandeira=$${pc}`);values.push(bandeira);pc++;}
    if(parcelas!==undefined){fields.push(`parcelas=$${pc}`);values.push(parseInt(parcelas));pc++;}
    if(observacoes!==undefined){fields.push(`observacoes=$${pc}`);values.push(observacoes);pc++;}
    if(comprovante!==undefined){fields.push(`comprovante=$${pc}`);values.push(comprovante);pc++;}
    if(!fields.length) return res.status(400).json({success:false,message:'Nenhum campo para atualizar'});
    fields.push('updated_at=CURRENT_TIMESTAMP');
    values.push(parseInt(req.params.id));
    const result = await query(`UPDATE pagamentos SET ${fields.join(',')} WHERE id=$${pc} RETURNING *`,values);
    res.json({success:true,data:result.rows[0],message:'Pagamento atualizado!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao atualizar pagamento'});
  }
});

// Deletar Pagamento
app.delete('/api/pagamentos/:id', auth, async (req, res) => {
  try {
    const result = await query('DELETE FROM pagamentos WHERE id=$1 RETURNING id',[req.params.id]);
    if(!result.rows[0]) return res.status(404).json({success:false,message:'Pagamento não encontrado'});
    res.json({success:true,message:'Pagamento excluído!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao excluir pagamento'});
  }
});

// CLIENTES
app.get('/api/clientes', auth, async (req, res) => {
  try {
    const page=parseInt(req.query.page)||1,limit=parseInt(req.query.limit)||20,offset=(page-1)*limit;
    const [result,count]=await Promise.all([
      query('SELECT * FROM clientes ORDER BY id LIMIT $1 OFFSET $2',[limit,offset]),
      query('SELECT COUNT(*) as total FROM clientes')
    ]);
    res.json({success:true,data:result.rows||[],pagination:{page,limit,total:parseInt(count.rows[0]?.total||0),pages:Math.ceil(parseInt(count.rows[0]?.total||0)/limit)}});
  } catch(error){
    res.status(500).json({success:false,data:[],pagination:{page:1,limit:20,total:0,pages:0}});
  }
});

app.get('/api/clientes/search', auth, async (req, res) => {
  try {
    const term=req.query.q||req.query.term||'';
    if(!term) return res.json({success:true,data:[]});
    // Busca por CPF/telefone digitados sem pontuacao (ex: so numeros) precisa
    // comparar contra o CPF salvo tambem sem pontuacao, senao "06055997002"
    // nunca bate com "060.559.970-02" guardado no banco.
    const termDigits = term.replace(/\D/g, '');
    let sql = `SELECT * FROM clientes WHERE nome_completo ILIKE $1 OR cpf ILIKE $1 OR CAST(id AS TEXT) ILIKE $1 OR CAST(ixc_id AS TEXT) ILIKE $1`;
    const params = [`%${term}%`];
    if (termDigits) {
      sql += ` OR regexp_replace(COALESCE(cpf,''), '[^0-9]', '', 'g') LIKE $2`;
      params.push(`%${termDigits}%`);
    }
    sql += ` ORDER BY nome_completo LIMIT 20`;
    const result = await query(sql, params);
    res.json({success:true,data:result.rows||[]});
  } catch(error){
    res.status(500).json({success:false,data:[]});
  }
});

app.get('/api/clientes/:id', auth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM clientes WHERE id=$1',[req.params.id]);
    if(!result.rows[0]) return res.status(404).json({success:false,message:'Cliente não encontrado'});
    res.json({success:true,data:result.rows[0]});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao buscar cliente'});
  }
});

app.post('/api/clientes', auth, isAdmin, async (req, res) => {
  try {
    const {id,nome_completo,cpf}=req.body;
    if(!nome_completo) return res.status(400).json({success:false,message:'Nome é obrigatório'});
    let qt, par;
    if(id){qt=`INSERT INTO clientes(id,nome_completo,cpf) VALUES($1,$2,$3) RETURNING *`;par=[id,nome_completo,cpf||null];}
    else{qt=`INSERT INTO clientes(nome_completo,cpf) VALUES($1,$2) RETURNING *`;par=[nome_completo,cpf||null];}
    const result = await query(qt,par);
    res.status(201).json({success:true,data:result.rows[0],message:'Cliente criado!'});
  } catch(error){
    if(error.code==='23505') return res.status(400).json({success:false,message:'Já existe cliente com este ID'});
    res.status(500).json({success:false,message:'Erro ao criar cliente'});
  }
});

app.put('/api/clientes/:id', auth, isAdmin, async (req, res) => {
  try {
    const {nome_completo,cpf}=req.body;
    const result = await query('UPDATE clientes SET nome_completo=$1,cpf=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *',[nome_completo,cpf,req.params.id]);
    if(!result.rows[0]) return res.status(404).json({success:false,message:'Cliente não encontrado'});
    res.json({success:true,data:result.rows[0],message:'Cliente atualizado!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao atualizar cliente'});
  }
});

app.delete('/api/clientes/:id', auth, isAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM clientes WHERE id=$1 RETURNING id',[req.params.id]);
    if(!result.rows[0]) return res.status(404).json({success:false,message:'Cliente não encontrado'});
    res.json({success:true,message:'Cliente excluído!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao excluir cliente'});
  }
});

// USUÁRIOS
app.get('/api/usuarios', auth, isAdmin, async (req, res) => {
  try {
    const result = await query('SELECT id,nome,usuario,email,perfil,ativo,created_at FROM usuarios WHERE ativo=true ORDER BY nome');
    res.json({success:true,data:result.rows||[]});
  } catch(error){
    res.status(500).json({success:false,data:[]});
  }
});

app.post('/api/usuarios', auth, isAdmin, async (req, res) => {
  try {
    const {nome,usuario,email,senha,perfil}=req.body;
    if(!nome||!usuario||!email||!senha) return res.status(400).json({success:false,message:'Campos obrigatórios faltando'});
    const hash = await bcrypt.hash(senha,10);
    const result = await query(`INSERT INTO usuarios(nome,usuario,email,senha,perfil) VALUES($1,$2,$3,$4,$5) RETURNING id,nome,usuario,email,perfil,ativo,created_at`,
      [nome,usuario,email,hash,perfil||'FUNCIONARIO']);
    res.status(201).json({success:true,data:result.rows[0],message:'Usuário criado!'});
  } catch(error){
    if(error.code==='23505') return res.status(400).json({success:false,message:'Usuário ou email já existe'});
    res.status(500).json({success:false,message:'Erro ao criar usuário'});
  }
});

app.put('/api/usuarios/:id', auth, isAdmin, async (req, res) => {
  try {
    const {nome,email,perfil,ativo}=req.body;
    const result = await query(`UPDATE usuarios SET nome=$1,email=$2,perfil=$3,ativo=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$5 RETURNING id,nome,usuario,email,perfil,ativo`,
      [nome,email,perfil,ativo!==undefined?ativo:true,req.params.id]);
    if(!result.rows[0]) return res.status(404).json({success:false,message:'Usuário não encontrado'});
    res.json({success:true,data:result.rows[0],message:'Usuário atualizado!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao atualizar usuário'});
  }
});

app.put('/api/usuarios/:id/reset-password', auth, isAdmin, async (req, res) => {
  try {
    const {nova_senha}=req.body;
    if(!nova_senha||nova_senha.length<6) return res.status(400).json({success:false,message:'Senha deve ter 6+ caracteres'});
    const hash = await bcrypt.hash(nova_senha,10);
    await query('UPDATE usuarios SET senha=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2',[hash,req.params.id]);
    res.json({success:true,message:'Senha alterada!'});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao alterar senha'});
  }
});

// RELATÓRIOS
app.get('/api/relatorios', auth, async (req, res) => {
  try {
    const {periodo_inicio,periodo_fim,funcionario,forma_pagamento,cliente}=req.query;
    let where=[],values=[],pc=1;
    if(periodo_inicio&&periodo_fim){where.push(`p.created_at BETWEEN $${pc} AND $${pc+1}`);values.push(periodo_inicio,periodo_fim);pc+=2;}
    if(funcionario){where.push(`u.nome ILIKE $${pc}`);values.push(`%${funcionario}%`);pc++;}
    if(forma_pagamento){where.push(`p.forma_pagamento=$${pc}`);values.push(forma_pagamento);pc++;}
    if(cliente){where.push(`(CAST(p.cliente_id AS TEXT)ILIKE $${pc} OR p.cliente_nome ILIKE $${pc})`);values.push(`%${cliente}%`);pc++;}
    const w = where.length?`WHERE ${where.join(' AND ')}`:'';
    const result = await query(`SELECT p.*,u.nome as usuario_nome,u.usuario as usuario_login FROM pagamentos p LEFT JOIN usuarios u ON p.usuario_id=u.id ${w} ORDER BY p.created_at DESC`,values);
    const rows=result.rows||[];
    res.json({success:true,data:{
      registros:rows,
      summary:{
        total_registros:rows.length,valor_total:rows.reduce((s,p)=>s+parseFloat(p.valor||0),0),
        valor_medio:rows.length?rows.reduce((s,p)=>s+parseFloat(p.valor||0),0)/rows.length:0,
        creditos:rows.filter(p=>p.forma_pagamento==='CREDITO').length,
        debitos:rows.filter(p=>p.forma_pagamento==='DEBITO').length,
        pix:rows.filter(p=>p.forma_pagamento==='PIX').length,
        valor_credito:rows.filter(p=>p.forma_pagamento==='CREDITO').reduce((s,p)=>s+parseFloat(p.valor||0),0),
        valor_debito:rows.filter(p=>p.forma_pagamento==='DEBITO').reduce((s,p)=>s+parseFloat(p.valor||0),0),
        valor_pix:rows.filter(p=>p.forma_pagamento==='PIX').reduce((s,p)=>s+parseFloat(p.valor||0),0)
      },filtros:req.query,total_registros:rows.length,data_geracao:new Date().toISOString()
    }});
  } catch(error){
    res.status(500).json({success:false,message:'Erro ao gerar relatório'});
  }
});

// LOGS
app.get('/api/logs', auth, isAdmin, async (req, res) => {
  try {
    const page=parseInt(req.query.page)||1,limit=parseInt(req.query.limit)||50,offset=(page-1)*limit;
    const {usuario,acao,data_inicio,data_fim}=req.query;
    let where=[],values=[],pc=1;
    if(usuario){where.push(`usuario ILIKE $${pc}`);values.push(`%${usuario}%`);pc++;}
    if(acao){where.push(`acao=$${pc}`);values.push(acao);pc++;}
    if(data_inicio&&data_fim){where.push(`created_at BETWEEN $${pc} AND $${pc+1}`);values.push(data_inicio,data_fim);pc+=2;}
    const w = where.length?`WHERE ${where.join(' AND ')}`:'';
    const [result,count]=await Promise.all([
      query(`SELECT * FROM logs ${w} ORDER BY created_at DESC LIMIT $${pc} OFFSET $${pc+1}`,[...values,limit,offset]),
      query(`SELECT COUNT(*) as total FROM logs ${w}`,values)
    ]);
    res.json({success:true,data:result.rows||[],pagination:{page,limit,total:parseInt(count.rows[0]?.total||0),pages:Math.ceil(parseInt(count.rows[0]?.total||0)/limit)}});
  } catch(error){
    res.status(500).json({success:false,data:[],pagination:{page:1,limit:50,total:0,pages:0}});
  }
});

// ARQUIVOS
let arquivosSchemaReady = false;
async function ensureArquivosSchema() {
  if (arquivosSchemaReady) return;
  await query(`CREATE TABLE IF NOT EXISTS pastas (id SERIAL PRIMARY KEY, nome VARCHAR(255) NOT NULL, descricao TEXT, cor VARCHAR(20) DEFAULT '#FF6B00', icone VARCHAR(10) DEFAULT '📁', pasta_pai_id INTEGER REFERENCES pastas(id) ON DELETE SET NULL, usuario_id INTEGER REFERENCES usuarios(id), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await query(`CREATE TABLE IF NOT EXISTS compartilhamentos (id SERIAL PRIMARY KEY, arquivo_id INTEGER REFERENCES arquivos(id) ON DELETE CASCADE, token VARCHAR(64) UNIQUE NOT NULL, data_expiracao TIMESTAMP, permissoes VARCHAR(20) DEFAULT 'visualizar', max_downloads INTEGER DEFAULT 0, downloads_count INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await query(`ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS pasta_id INTEGER REFERENCES pastas(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS destaque BOOLEAN DEFAULT false`);
  await query(`ALTER TABLE compartilhamentos ADD COLUMN IF NOT EXISTS max_downloads INTEGER DEFAULT 0`);
  await query(`ALTER TABLE compartilhamentos ADD COLUMN IF NOT EXISTS downloads_count INTEGER DEFAULT 0`);
  await query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ixc_id INTEGER`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clientes_ixc_id ON clientes(ixc_id)`);
  arquivosSchemaReady = true;
}

const formatarCpf = (digits) => {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length !== 11) return digits || null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

// Encontra o cliente local pelo CPF (ou pelo ID do IXC, se ja vinculado antes) e,
// se nao existir, cadastra automaticamente com os dados trazidos pela automacao.
async function garantirClienteLocal({ nome, cpf, ixcId }) {
  const cpfDigits = String(cpf || '').replace(/\D/g, '');
  const ixcIdNum = ixcId ? parseInt(ixcId, 10) : null;
  const existente = await query(
    `SELECT id, ixc_id FROM clientes WHERE regexp_replace(COALESCE(cpf,''), '[^0-9]', '', 'g') = $1 OR (ixc_id IS NOT NULL AND ixc_id = $2) LIMIT 1`,
    [cpfDigits, ixcIdNum]
  );
  if (existente.rows[0]) {
    if (ixcIdNum && !existente.rows[0].ixc_id) {
      await query('UPDATE clientes SET ixc_id=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [ixcIdNum, existente.rows[0].id]);
    }
    return { clienteId: existente.rows[0].id, criado: false };
  }
  const novo = await query(
    `INSERT INTO clientes (nome_completo, cpf, ixc_id) VALUES ($1,$2,$3) RETURNING id`,
    [nome || `Cliente ${formatarCpf(cpfDigits)}`, formatarCpf(cpfDigits), ixcIdNum]
  );
  return { clienteId: novo.rows[0].id, criado: true };
}
app.use('/api/arquivos', async (req, res, next) => {
  try { await ensureArquivosSchema(); next(); }
  catch (error) { res.status(500).json({ success: false, message: 'Erro ao preparar armazenamento: ' + error.message }); }
});
app.use('/api/compartilhado', async (req, res, next) => {
  try { await ensureArquivosSchema(); next(); }
  catch (error) { res.status(500).json({ success: false, message: 'Erro interno' }); }
});

const ORDER_WHITELIST = ['a.created_at DESC','a.created_at ASC','a.nome_original ASC','a.tamanho DESC','a.downloads DESC'];
const detectCategoria = (mimetype, filename) => {
  const m = mimetype || '', f = (filename || '').toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('image')) return 'imagem';
  if (m.includes('sheet') || m.includes('excel') || /\.(xlsx|xls|csv)$/.test(f)) return 'planilha';
  return 'documento';
};
const toTagsArray = (tags) => {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
};
const mapArquivo = (row) => ({
  ...row,
  tags: Array.isArray(row.tags) ? row.tags : [],
  url: row.caminho || null
});
const uploadToBlob = async (file) => {
  const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
  const blob = await put(`arquivos/${Date.now()}-${safeName}`, file.buffer, { access: 'public', contentType: file.mimetype, addRandomSuffix: true });
  return blob;
};

// Pastas
app.get('/api/arquivos/pastas/listar', auth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM pastas ORDER BY nome');
    res.json({ success: true, data: result.rows || [] });
  } catch (error) {
    res.status(500).json({ success: false, data: [] });
  }
});

app.post('/api/arquivos/pastas', auth, async (req, res) => {
  try {
    const { nome, descricao, cor, icone, pasta_pai_id } = req.body;
    if (!nome) return res.status(400).json({ success: false, message: 'Nome da pasta é obrigatório' });
    const result = await query(
      `INSERT INTO pastas (nome,descricao,cor,icone,pasta_pai_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nome, descricao || null, cor || '#FF6B00', icone || '📁', pasta_pai_id || null, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Pasta criada!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao criar pasta' });
  }
});

// Estatísticas
app.get('/api/arquivos/estatisticas', auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [geral] = await Promise.all([
      query(`SELECT COUNT(*) as total_arquivos, COALESCE(SUM(tamanho),0) as tamanho_total, COALESCE(SUM(downloads),0) as total_downloads, COUNT(*) FILTER (WHERE destaque=true) as favoritos, COUNT(*) FILTER (WHERE created_at>=$1) as arquivos_semana FROM arquivos`, [sevenDaysAgo])
    ]);
    const g = geral.rows[0] || {};
    res.json({ success: true, data: { geral: {
      total_arquivos: parseInt(g.total_arquivos) || 0,
      tamanho_total: parseInt(g.tamanho_total) || 0,
      total_downloads: parseInt(g.total_downloads) || 0,
      favoritos: parseInt(g.favoritos) || 0,
      arquivos_semana: parseInt(g.arquivos_semana) || 0
    } } });
  } catch (error) {
    res.status(500).json({ success: false, data: null });
  }
});

// Upload múltiplo
app.post('/api/arquivos/multiplo', auth, upload.array('arquivos', 20), async (req, res) => {
  try {
    if (!req.files || !req.files.length) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    const { categoria, descricao, pagamento_id } = req.body;
    const criados = [];
    for (const file of req.files) {
      const blob = await uploadToBlob(file);
      const cat = (categoria && categoria !== 'auto') ? categoria : detectCategoria(file.mimetype, file.originalname);
      const result = await query(
        `INSERT INTO arquivos (nome_original,nome_arquivo,caminho,tamanho,tipo,categoria,descricao,pagamento_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [file.originalname, blob.pathname, blob.url, file.size, file.mimetype, cat, descricao || null, pagamento_id ? parseInt(pagamento_id) : null, req.user.id]
      );
      criados.push(result.rows[0]);
    }
    res.status(201).json({ success: true, data: criados.map(mapArquivo), message: `${criados.length} arquivos enviados!` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao enviar arquivos: ' + error.message });
  }
});

// Exclusão em massa
app.post('/api/arquivos/bulk-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ success: false, message: 'Nenhum arquivo selecionado' });
    const result = await query('SELECT * FROM arquivos WHERE id = ANY($1)', [ids]);
    const deletableIds = [];
    for (const arquivo of result.rows) {
      if (req.user.perfil !== 'ADMIN' && arquivo.usuario_id !== req.user.id) continue;
      try { await del(arquivo.caminho); } catch (e) { /* já removido do blob */ }
      deletableIds.push(arquivo.id);
    }
    if (deletableIds.length) await query('DELETE FROM arquivos WHERE id = ANY($1)', [deletableIds]);
    res.json({ success: true, message: `${deletableIds.length} arquivo(s) excluído(s)!` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao excluir arquivos' });
  }
});

// Listar
app.get('/api/arquivos', auth, async (req, res) => {
  try {
    const page=parseInt(req.query.page)||1,limit=parseInt(req.query.limit)||20,offset=(page-1)*limit;
    const {search,categoria,pagamento_id,pasta_id,orderBy}=req.query;
    let where=[],values=[],pc=1;
    if(search){where.push(`(nome_original ILIKE $${pc} OR descricao ILIKE $${pc} OR categoria ILIKE $${pc})`);values.push(`%${search}%`);pc++;}
    if(categoria){where.push(`categoria=$${pc}`);values.push(categoria);pc++;}
    if(pagamento_id){where.push(`pagamento_id=$${pc}`);values.push(parseInt(pagamento_id));pc++;}
    if(pasta_id){where.push(`pasta_id=$${pc}`);values.push(parseInt(pasta_id));pc++;}
    const w = where.length?`WHERE ${where.join(' AND ')}`:'';
    const order = ORDER_WHITELIST.includes(orderBy) ? orderBy : 'a.created_at DESC';
    const [result,count,sizeRes]=await Promise.all([
      query(`SELECT a.*,u.nome as usuario_nome,u.usuario as usuario_login FROM arquivos a LEFT JOIN usuarios u ON a.usuario_id=u.id ${w} ORDER BY ${order} LIMIT $${pc} OFFSET $${pc+1}`,[...values,limit,offset]),
      query(`SELECT COUNT(*) as total FROM arquivos a ${w}`,values),
      query(`SELECT COALESCE(SUM(tamanho),0) as total_size FROM arquivos a ${w}`,values)
    ]);
    res.json({success:true,data:(result.rows||[]).map(mapArquivo),pagination:{page,limit,total:parseInt(count.rows[0]?.total||0),pages:Math.ceil(parseInt(count.rows[0]?.total||0)/limit),totalSize:parseInt(sizeRes.rows[0]?.total_size||0)}});
  } catch(error){
    res.status(500).json({success:false,data:[],pagination:{page:1,limit:20,total:0,pages:0}});
  }
});

// Upload único
app.post('/api/arquivos', auth, upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    const { categoria, descricao, tags, pagamento_id, cliente_id } = req.body;
    const blob = await uploadToBlob(req.file);
    const cat = (categoria && categoria !== 'auto') ? categoria : detectCategoria(req.file.mimetype, req.file.originalname);
    const result = await query(
      `INSERT INTO arquivos (nome_original,nome_arquivo,caminho,tamanho,tipo,categoria,descricao,tags,pagamento_id,cliente_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.file.originalname, blob.pathname, blob.url, req.file.size, req.file.mimetype, cat, descricao || null, toTagsArray(tags), pagamento_id ? parseInt(pagamento_id) : null, cliente_id ? parseInt(cliente_id) : null, req.user.id]
    );
    res.status(201).json({ success: true, data: mapArquivo(result.rows[0]), message: 'Arquivo enviado!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao enviar arquivo: ' + error.message });
  }
});

// Download (proxy do blob, mantém nome original e conta o download)
app.get('/api/arquivos/:id/download', auth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM arquivos WHERE id=$1', [req.params.id]);
    const arquivo = result.rows[0];
    if (!arquivo) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    const blobRes = await fetch(arquivo.caminho);
    if (!blobRes.ok) return res.status(404).json({ success: false, message: 'Arquivo indisponível no armazenamento' });
    const buffer = Buffer.from(await blobRes.arrayBuffer());
    await query('UPDATE arquivos SET downloads=downloads+1 WHERE id=$1', [req.params.id]);
    res.set('Content-Type', arquivo.tipo || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(arquivo.nome_original)}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao baixar arquivo' });
  }
});

// Favoritar / destacar
app.post('/api/arquivos/:id/favoritar', auth, async (req, res) => {
  try {
    const result = await query('UPDATE arquivos SET destaque = NOT COALESCE(destaque,false) WHERE id=$1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    res.json({ success: true, data: mapArquivo(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao favoritar' });
  }
});

// Compartilhar
app.post('/api/arquivos/:id/compartilhar', auth, async (req, res) => {
  try {
    const arquivoResult = await query('SELECT id FROM arquivos WHERE id=$1', [req.params.id]);
    if (!arquivoResult.rows[0]) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    const { data_expiracao, permissoes, max_downloads } = req.body;
    const token = crypto.randomBytes(24).toString('hex');
    await query(
      `INSERT INTO compartilhamentos (arquivo_id,token,data_expiracao,permissoes,max_downloads) VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, token, data_expiracao || null, permissoes || 'visualizar', parseInt(max_downloads) || 0]
    );
    const url = `${req.protocol}://${req.get('host')}/api/compartilhado/${token}`;
    res.json({ success: true, data: { url, token } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao gerar link de compartilhamento' });
  }
});

// Acesso público via link compartilhado (sem autenticação)
app.get('/api/compartilhado/:token', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, a.nome_original, a.tipo, a.caminho FROM compartilhamentos c JOIN arquivos a ON a.id=c.arquivo_id WHERE c.token=$1`,
      [req.params.token]
    );
    const share = result.rows[0];
    if (!share) return res.status(404).json({ success: false, message: 'Link inválido' });
    if (share.data_expiracao && new Date(share.data_expiracao) < new Date()) return res.status(410).json({ success: false, message: 'Link expirado' });
    if (share.max_downloads > 0 && share.downloads_count >= share.max_downloads) return res.status(410).json({ success: false, message: 'Limite de downloads atingido' });
    const blobRes = await fetch(share.caminho);
    if (!blobRes.ok) return res.status(404).json({ success: false, message: 'Arquivo indisponível' });
    const buffer = Buffer.from(await blobRes.arrayBuffer());
    await query('UPDATE compartilhamentos SET downloads_count=downloads_count+1 WHERE id=$1', [share.id]);
    res.set('Content-Type', share.tipo || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(share.nome_original)}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao acessar link' });
  }
});

// Atualizar metadados
app.put('/api/arquivos/:id', auth, async (req, res) => {
  try {
    const { descricao, tags, categoria, destaque, publico } = req.body;
    const fields = [], values = []; let pc = 1;
    if (descricao !== undefined) { fields.push(`descricao=$${pc}`); values.push(descricao); pc++; }
    if (tags !== undefined) { fields.push(`tags=$${pc}`); values.push(toTagsArray(tags)); pc++; }
    if (categoria !== undefined) { fields.push(`categoria=$${pc}`); values.push(categoria); pc++; }
    if (destaque !== undefined) { fields.push(`destaque=$${pc}`); values.push(!!destaque); pc++; }
    if (publico !== undefined) { fields.push(`publico=$${pc}`); values.push(!!publico); pc++; }
    if (!fields.length) return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    fields.push('updated_at=CURRENT_TIMESTAMP');
    values.push(req.params.id);
    const result = await query(`UPDATE arquivos SET ${fields.join(',')} WHERE id=$${pc} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    res.json({ success: true, data: mapArquivo(result.rows[0]), message: 'Arquivo atualizado!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao atualizar arquivo' });
  }
});

// Excluir
app.delete('/api/arquivos/:id', auth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM arquivos WHERE id=$1', [req.params.id]);
    const arquivo = result.rows[0];
    if (!arquivo) return res.status(404).json({ success: false, message: 'Arquivo não encontrado' });
    if (req.user.perfil !== 'ADMIN' && arquivo.usuario_id !== req.user.id) return res.status(403).json({ success: false, message: 'Sem permissão para excluir este arquivo' });
    try { await del(arquivo.caminho); } catch (e) { /* já removido do blob */ }
    await query('DELETE FROM arquivos WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Arquivo excluído!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao excluir arquivo' });
  }
});

// FATURAS - Automacao do Portal do Cliente (fenixwireless)
app.post('/api/faturas/buscar-portal', auth, async (req, res) => {
  try {
    await ensureArquivosSchema();
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ success: false, message: 'CPF é obrigatório' });

    const { buscarFaturaPortal } = require('./faturasPortal');
    const resultado = await buscarFaturaPortal(cpf);

    if (resultado.semFaturaPendente) {
      return res.json({ success: true, semFaturaPendente: true, cliente: resultado.cliente });
    }

    const { clienteId, criado: clienteCriado } = await garantirClienteLocal({
      nome: resultado.cliente.nome,
      cpf: resultado.cliente.cpf,
      ixcId: resultado.cliente.id
    });

    const nomeArquivo = `Fatura ${resultado.fatura.numero || Date.now()}.pdf`;
    const blob = await put(`faturas/${Date.now()}-${nomeArquivo.replace(/[^\w.\-]+/g, '_')}`, resultado.pdfBuffer, {
      access: 'public', contentType: 'application/pdf', addRandomSuffix: true
    });

    const descricao = `Fatura ${resultado.fatura.numero || ''} · Venc. ${resultado.fatura.vencimento || '-'} · ${resultado.fatura.valor?.replace(/\s+/g, ' ').trim() || ''} · Cliente: ${resultado.cliente.nome}`;
    const insert = await query(
      `INSERT INTO arquivos (nome_original,nome_arquivo,caminho,tamanho,tipo,categoria,descricao,cliente_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nomeArquivo, blob.pathname, blob.url, resultado.pdfBuffer.length, 'application/pdf', 'fatura', descricao, clienteId, req.user.id]
    );

    res.status(201).json({
      success: true,
      semFaturaPendente: false,
      cliente: resultado.cliente,
      fatura: resultado.fatura,
      clienteVinculado: true,
      clienteCriado,
      arquivo: mapArquivo(insert.rows[0])
    });
  } catch (error) {
    res.status(502).json({ success: false, message: 'Falha ao buscar fatura no portal: ' + error.message });
  }
});

// BOLETOS - Automacao do Painel Administrativo IXC (conta de servico)
let automacaoSchemaReady = false;
async function ensureAutomacaoSchema() {
  if (automacaoSchemaReady) return;
  await query(`CREATE TABLE IF NOT EXISTS automacao_sessoes (chave VARCHAR(50) PRIMARY KEY, dados JSONB NOT NULL, atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  automacaoSchemaReady = true;
}

app.post('/api/faturas/buscar-ixc-boletos', auth, isAdmin, async (req, res) => {
  try {
    await ensureArquivosSchema();
    await ensureAutomacaoSchema();
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ success: false, message: 'CPF é obrigatório' });

    const sessaoRow = await query(`SELECT dados FROM automacao_sessoes WHERE chave = 'ixc_admin'`);
    const storageState = sessaoRow.rows[0]?.dados || null;

    const { buscarBoletosAbertos } = require('./ixcBoletos');
    // maxDuration da function e 60s (vercel.json); se deixarmos o Playwright
    // livre ate la, a Vercel mata o processo sem devolver resposta e o
    // usuario so ve "demorou demais". Com 52s damos tempo de responder com
    // mensagem clara antes disso (a sessao ja foi persistida antes do login
    // demorado, entao a proxima tentativa comeca reaproveitando-a).
    const timeoutMs = 52000;
    const resultado = await Promise.race([
      buscarBoletosAbertos(cpf, {
        storageState,
        onSessionUpdate: async (novoEstado) => {
          await query(
            `INSERT INTO automacao_sessoes (chave, dados, atualizado_em) VALUES ('ixc_admin', $1, CURRENT_TIMESTAMP)
             ON CONFLICT (chave) DO UPDATE SET dados = $1, atualizado_em = CURRENT_TIMESTAMP`,
            [JSON.stringify(novoEstado)]
          );
        }
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`Tempo limite (${timeoutMs / 1000}s) atingido no painel IXC. A sessão de login já foi salva - tente novamente.`)),
        timeoutMs
      ))
    ]);

    if (resultado.semBoletosPendentes) {
      return res.json({ success: true, semBoletosPendentes: true, cliente: resultado.cliente });
    }

    const cpfDigits = String(cpf).replace(/\D/g, '');
    const { clienteId, criado: clienteCriado } = await garantirClienteLocal({
      nome: resultado.cliente.nome,
      cpf: resultado.cliente.cpf,
      ixcId: resultado.cliente.id
    });

    const nomeArquivo = `Boletos ${resultado.cliente.nome || cpfDigits} ${Date.now()}.pdf`;
    const blob = await put(`boletos/${Date.now()}-${nomeArquivo.replace(/[^\w.\-]+/g, '_')}`, resultado.pdfBuffer, {
      access: 'public', contentType: 'application/pdf', addRandomSuffix: true
    });

    const totalValor = resultado.titulos.reduce((s, t) => s + (parseFloat((t.valor || '0').replace('.', '').replace(',', '.')) || 0), 0);
    const descricao = `${resultado.titulos.length} boleto(s) em aberto · Total R$ ${totalValor.toFixed(2)} · Cliente: ${resultado.cliente.nome} (IXC #${resultado.cliente.id})`;
    const insert = await query(
      `INSERT INTO arquivos (nome_original,nome_arquivo,caminho,tamanho,tipo,categoria,descricao,cliente_id,usuario_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nomeArquivo, blob.pathname, blob.url, resultado.pdfBuffer.length, 'application/pdf', 'boleto', descricao, clienteId, req.user.id]
    );

    res.status(201).json({
      success: true,
      semBoletosPendentes: false,
      cliente: resultado.cliente,
      titulos: resultado.titulos,
      totalValor,
      clienteVinculado: true,
      clienteCriado,
      arquivo: mapArquivo(insert.rows[0])
    });
  } catch (error) {
    res.status(502).json({ success: false, message: 'Falha ao buscar boletos no IXC: ' + error.message });
  }
});

// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// ============================================================
// Error Handler
// ============================================================
app.use((err, req, res, next) => {
  log('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Erro interno do servidor' });
});

// ============================================================
// EXPORT (Vercel serverless)
// ============================================================
module.exports = app;