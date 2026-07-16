<h1 align="center">
  <img src="frontend/src/assets/mascote.png" alt="Fênix Pay Control" width="64" style="vertical-align: middle; margin-right: 12px;">
  Fênix Pay Control
</h1>

<p align="center">
  <strong>Sistema de Controle de Pagamentos em Loja</strong><br>
  <em>Moderno, rápido e intuitivo — desenvolvido para provedoras de internet</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 18.2">
  <img src="https://img.shields.io/badge/Node.js-18.0-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 18">
  <img src="https://img.shields.io/badge/Express-4.18-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 4.18">
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL Neon">
  <img src="https://img.shields.io/badge/Socket.IO-4.7-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.IO 4.7">
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT Auth">
  <img src="https://img.shields.io/badge/status-production-brightgreen?style=for-the-badge" alt="Status: Production">
</p>

---

## 📋 Índice

- [📖 Sobre o Projeto](#-sobre-o-projeto)
- [🎯 Contexto Real](#-contexto-real)
- [✨ Funcionalidades](#-funcionalidades)
- [🛠️ Stack Tecnológica](#️-stack-tecnológica)
- [📸 Screenshots](#-screenshots)
- [🏗️ Arquitetura do Sistema](#️-arquitetura-do-sistema)
- [🚀 Como Executar](#-como-executar)
  - [Pré-requisitos](#pré-requisitos)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [🗄️ Estrutura do Projeto](#️-estrutura-do-projeto)
- [📊 Modelagem do Banco](#-modelagem-do-banco)
- [🔌 WebSocket em Tempo Real](#-websocket-em-tempo-real)
- [📱 API REST](#-api-rest)
- [🔒 Segurança](#-segurança)
- [🧠 Lições Técnicas](#-lições-técnicas)
- [👨‍💻 Autor](#-autor)
- [📄 Licença](#-licença)

---

## 📖 Sobre o Projeto

**Fênix Pay Control** é um sistema full-stack de controle de pagamentos presenciais desenvolvido para provedoras de internet. Ele substitui o método manual de anotar IDs de clientes em papéis (vias de cartão) por uma plataforma digital completa com **dashboard em tempo real**, **gerenciamento de clientes**, **upload de comprovantes**, **relatórios exportáveis** e **auditoria completa**.

O sistema foi construído com foco em **usabilidade para equipe de loja**, **performance em tempo real** e **organização financeira**, eliminando completamente o uso de papéis e planilhas manuais.

---

## 🎯 Contexto Real

> *"Trabalho em uma provedora de internet e percebi um problema simples, mas crítico: clientes idosos chegam na loja para pagar com cartão de crédito ou débito na maquininha. Nós entregamos a via do cliente + uma via para guardar na loja, onde escrevemos à mão o ID do cliente. Era assim que funcionava — frágil, propenso a erros e sem nenhum controle digital."*

**O problema:**
- ✅ Vias de cartão perdidas ou ilegíveis
- ✅ ID do cliente escrito manualmente (passível de erro)
- ✅ Sem histórico digital de pagamentos presenciais
- ✅ Dificuldade em gerar relatórios ou fazer auditoria
- ✅ Nenhum backup dos comprovantes

**A solução — Fênix Pay Control:**
- ✅ Registro digital completo de pagamentos presenciais
- ✅ Upload de fotos/comprovantes da via do cartão
- ✅ Dashboard em tempo real com métricas diárias
- ✅ Relatórios filtrados por período, funcionário, forma de pagamento
- ✅ Auditoria completa de todas as ações
- ✅ Controle de acesso com perfis ADMIN e FUNCIONARIO

---

## ✨ Funcionalidades

### 📊 **Dashboard Inteligente**
- Métricas em tempo real: pagamentos hoje, total geral
- Gráfico de evolução dos últimos 7 dias (Área Chart)
- Distribuição por forma de pagamento (Pizza Chart)
- Top 5 clientes mais frequentes
- Últimos pagamentos em tempo real
- Atualização automática a cada 60 segundos

### 💳 **Gestão de Pagamentos**
- Registro rápido com busca de cliente por ID, CPF ou Nome
- Suporte a Crédito, Débito e PIX
- Upload de comprovante (imagem ou PDF)
- Visualização detalhada com abas de Detalhes, Auditoria e Comprovante
- Filtros avançados por data, forma de pagamento e cliente
- Paginação e busca textual

### 👥 **Cadastro de Clientes**
- Busca integrada por ID, CPF ou Nome
- Máscara automática de CPF (000.000.000-00)
- Suporte a ID customizado ou automático
- Controle de permissões (apenas ADMIN cria/altera)

### 📁 **Gerenciador de Arquivos**
- Upload de múltiplos tipos (PDF, imagens, documentos)
- Categorização: comprovante, documento, contrato, nota fiscal, recibo
- Visualizador integrado de imagens e PDFs
- Sistema de compartilhamento com link e expiração
- Preview profissional com modal dedicado
- Download tracking

### 📈 **Relatórios Detalhados**
- Filtros combinados: período, funcionário, forma de pagamento, cliente
- Cards de resumo: total de registros, valor total, ticket médio
- Visão detalhada e resumida (agrupada por forma de pagamento)
- Exportação para **CSV** e **HTML/PDF**
- Barras de progresso com percentuais

### 🔍 **Auditoria Completa**
- Log de todas as ações: login, CRUD de pagamentos, clientes, usuários
- Filtros por usuário, ação e período
- Captura de IP, navegador e sistema operacional
- Trilha de auditoria por pagamento individual
- Apenas ADMIN pode acessar

### 👥 **Gestão de Usuários**
- Perfis: ADMIN e FUNCIONARIO
- Reset de senha individual
- Ativação/desativação de usuários
- Apenas ADMIN gerencia

### 🔌 **Tempo Real com WebSocket**
- Atualização instantânea ao criar/editar/excluir pagamentos
- Notificações em tempo real para todos os usuários conectados
- Indicador visual de conexão ativa
- Sala separada para dashboard e listagem de pagamentos

---

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| **Frontend** | React + Vite | 18.2 / 5.x |
| **UI/UX** | CSS Modules + Design System Próprio | — |
| **Gráficos** | Recharts | 2.x |
| **Backend** | Node.js + Express | 18 / 4.18 |
| **Banco** | PostgreSQL (Neon) | 15 |
| **ORM/Query** | pg (raw SQL) | 8.11 |
| **Autenticação** | JWT + bcrypt | 9.x / 5.x |
| **WebSocket** | Socket.IO | 4.7 |
| **Upload** | Multer | 1.4 |
| **Segurança** | Helmet + express-rate-limit | 7.x / 7.x |
| **Logs** | Winston | 3.11 |
| **Proxy** | Vite Proxy (dev) | — |

---

## 📸 Screenshots

> *Nota: As imagens abaixo são placeholders representando o layout real do sistema.*

<div align="center">
  <table>
    <tr>
      <td align="center">
        <img src="frontend/src/assets/screenshots/dashboard.png" alt="Dashboard" width="400" style="border-radius: 12px; border: 1px solid #333;">
        <br>
        <em>Dashboard com métricas em tempo real</em>
      </td>
      <td align="center">
        <img src="frontend/src/assets/screenshots/pagamentos.png" alt="Pagamentos" width="400" style="border-radius: 12px; border: 1px solid #333;">
        <br>
        <em>Listagem de pagamentos com filtros</em>
      </td>
    </tr>
    <tr>
      <td align="center">
        <img src="frontend/src/assets/screenshots/detalhes.png" alt="Detalhes Pagamento" width="400" style="border-radius: 12px; border: 1px solid #333;">
        <br>
        <em>Detalhes do pagamento com auditoria</em>
      </td>
      <td align="center">
        <img src="frontend/src/assets/screenshots/relatorios.png" alt="Relatórios" width="400" style="border-radius: 12px; border: 1px solid #333;">
        <br>
        <em>Relatórios detalhados com exportação</em>
      </td>
    </tr>
  </table>
</div>

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Fênix Pay Control                         │
│                                                             │
│  ┌──────────────────┐        ┌──────────────────────────┐  │
│  │    Frontend       │        │       Backend            │  │
│  │    React + Vite   │◄──────►│    Express + Socket.IO  │  │
│  │    Port 5173      │  HTTP  │       Port 5000          │  │
│  └────────┬─────────┘   │    └───────────┬──────────────┘  │
│           │             │                │                 │
│           │       WebSocket              │                 │
│           │◄══════════════════════════════╝                 │
│           │                                                 │
│  ┌────────▼─────────┐        ┌──────────────────────────┐  │
│  │    Contexts       │        │     PostgreSQL (Neon)    │  │
│  │  • AuthContext    │        │    • usuarios            │  │
│  │  • SocketContext  │◄──────►│    • clientes            │  │
│  │  • ToastContext   │  SQL   │    • pagamentos          │  │
│  └──────────────────┘        │    • logs                 │  │
│                              │    • arquivos             │  │
│  ┌──────────────────┐        │    • compartilhamentos    │  │
│  │   Services        │        └──────────────────────────┘  │
│  │  • API (axios)    │                                       │
│  │  • Socket         │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 Fluxo de Dados

1. **Usuário faz login** → JWT gerado e armazenado no localStorage
2. **Cada requisição** → Interceptor do Axios adiciona `Bearer Token`
3. **Socket.IO** → Conecta automaticamente após login, autentica via token
4. **Operações CRUD** → API REST → Validação → Query SQL → Resposta
5. **Eventos emitidos** → Socket.IO propaga para todos os usuários conectados
6. **Dashboard atualiza** → Tempo real via WebSocket + polling a cada 60s

---

## 🚀 Como Executar

### Pré-requisitos

- Node.js >= 18
- NPM ou Yarn
- Conta [Neon](https://neon.tech) (PostgreSQL serverless) — ou qualquer PostgreSQL
- Um pouco de ☕

### Backend

```bash
# 1. Acessar a pasta do backend
cd backend

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
# Copie .env.example para .env e preencha os valores
cp .env.example .env

# 4. Executar migrations (cria as tabelas no banco)
npm run migrate

# 5. Iniciar servidor (desenvolvimento)
npm run dev

# Servidor rodando em: http://localhost:5000
```

### Frontend

```bash
# 1. Acessar a pasta do frontend
cd frontend

# 2. Instalar dependências
npm install

# 3. Iniciar servidor de desenvolvimento
npm run dev

# Frontend rodando em: http://localhost:5173
```

> **💡 Dica:** O Vite já faz proxy das requisições `/api` para o backend, então nenhuma configuração extra é necessária.

---

## 🗄️ Estrutura do Projeto

```
fenix-pay-control/
├── backend/                          # API REST
│   ├── src/
│   │   ├── config/                   # Conexão com banco (Neon PostgreSQL)
│   │   ├── controllers/              # Lógica das rotas
│   │   │   ├── authController.js     # Login, verificação de token
│   │   │   ├── pagamentoController.js# CRUD pagamentos + dashboard
│   │   │   ├── clienteController.js  # CRUD clientes
│   │   │   ├── usuarioController.js  # CRUD usuários + reset senha
│   │   │   ├── relatorioController.js# Geração de relatórios
│   │   │   ├── arquivoController.js  # Upload, download, compartilhamento
│   │   │   └── logController.js      # Auditoria
│   │   ├── middlewares/              # Autenticação, rate limit, upload
│   │   ├── migrations/               # SQL de criação das tabelas
│   │   ├── models/                   # Queries SQL parametrizadas
│   │   ├── routes/                   # Definição de rotas REST
│   │   ├── services/                 # Socket.IO, automação
│   │   ├── scripts/                  # Utilitários (listar usuários, etc)
│   │   └── utils/                    # Logger (Winston)
│   ├── uploads/                      # Comprovantes e arquivos
│   ├── server.js                     # Entry point
│   └── package.json
│
├── frontend/                         # React + Vite
│   ├── src/
│   │   ├── assets/                   # Imagens, ícones
│   │   ├── components/common/        # PrivateRoute, LoadingSpinner
│   │   ├── contexts/                 # Auth, Socket, Toast
│   │   ├── hooks/                    # useAuth, useToast
│   │   ├── layouts/                  # MainLayout (sidebar + header)
│   │   ├── pages/                    # Todas as páginas do sistema
│   │   │   ├── Login.jsx             # Tela de login com animações
│   │   │   ├── Dashboard.jsx         # Dashboard com gráficos
│   │   │   ├── Pagamentos.jsx        # Listagem + filtros
│   │   │   ├── NovoPagamento.jsx     # Formulário de registro
│   │   │   ├── DetalhesPagamento.jsx # Detalhes + auditoria
│   │   │   ├── Clientes.jsx          # CRUD clientes
│   │   │   ├── GerenciadorArquivos.jsx # Upload + compartilhamento
│   │   │   ├── Relatorios.jsx        # Relatórios + exportação
│   │   │   ├── Usuarios.jsx          # Gestão de usuários
│   │   │   └── Auditoria.jsx         # Logs do sistema
│   │   ├── services/                 # API (axios) + Socket Service
│   │   └── styles/                   # CSS global + temas
│   ├── vite.config.js                # Proxy para backend
│   └── package.json
│
├── .gitignore                        # Arquivos ignorados
└── README.md                         # Você está aqui 🎯
```

---

## 📊 Modelagem do Banco

```sql
-- Tabelas principais:

usuarios      → id, nome, usuario, email, senha, perfil, ativo, created_at
clientes      → id, nome_completo, cpf, created_at, updated_at
pagamentos    → id, cliente_id, cliente_nome, valor, forma_pagamento,
                observacoes, comprovante, usuario_id, created_at, updated_at
logs          → id, usuario_id, usuario, acao, descricao, ip, navegador,
                sistema, pagamento_id, created_at
arquivos      → id, nome_original, nome_arquivo, caminho, tamanho, tipo,
                categoria, descricao, tags, pagamento_id, cliente_id,
                usuario_id, downloads, versao, publico, created_at
compartilhamentos → id, arquivo_id, usuario_id, token, data_expiracao,
                    permissoes, created_at
```

> 🔗 **Relações:** `pagamentos → clientes (FK)`, `pagamentos → usuarios (FK)`, `logs → pagamentos (FK opcional)`

---

## 🔌 WebSocket em Tempo Real

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `pagamento:created` | Server → Client | Novo pagamento registrado |
| `pagamento:updated` | Server → Client | Pagamento atualizado |
| `pagamento:deleted` | Server → Client | Pagamento excluído |
| `dashboard:update` | Server → Client | Dashboard precisa atualizar |
| `cliente:created` | Server → Client | Novo cliente cadastrado |
| `cliente:updated` | Server → Client | Cliente atualizado |
| `cliente:deleted` | Server → Client | Cliente excluído |
| `arquivo:uploaded` | Server → Client | Novo arquivo enviado |
| `arquivo:deleted` | Server → Client | Arquivo excluído |
| `users:online` | Server → Client | Lista de usuários online |
| `notification:received` | Server → Client | Notificações gerais |

---

## 📱 API REST

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Login (rate limit: 5 tentativas/h) |
| `GET` | `/api/auth/verify` | Verificar token atual |

### Pagamentos

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/pagamentos` | Listar (filtros: search, data_inicio, data_fim, forma_pagamento) |
| `GET` | `/api/pagamentos/dashboard` | Dados do dashboard |
| `GET` | `/api/pagamentos/:id` | Detalhes + logs |
| `POST` | `/api/pagamentos` | Criar (multipart: comprovante) |
| `PUT` | `/api/pagamentos/:id` | Atualizar |
| `DELETE` | `/api/pagamentos/:id` | Excluir (admin only) |

### Clientes

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/clientes` | Listar (paginado) |
| `GET` | `/api/clientes/search?q=` | Buscar por nome, CPF ou ID |
| `GET` | `/api/clientes/:id` | Detalhes |
| `POST` | `/api/clientes` | Criar (admin only) |
| `PUT` | `/api/clientes/:id` | Atualizar (admin only) |
| `DELETE` | `/api/clientes/:id` | Excluir (admin only) |

### Relatórios

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/relatorios` | Gerar relatório (filtros: periodo, funcionario, forma, cliente) |

### Arquivos

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/arquivos` | Listar |
| `POST` | `/api/arquivos` | Upload (multipart) |
| `GET` | `/api/arquivos/:id` | Detalhes |
| `GET` | `/api/arquivos/:id/download` | Download |
| `PUT` | `/api/arquivos/:id` | Atualizar metadados |
| `DELETE` | `/api/arquivos/:id` | Excluir |
| `POST` | `/api/arquivos/:id/compartilhar` | Gerar link compartilhável |
| `GET` | `/api/arquivos/compartilhar/:token` | Acessar compartilhado |

> 🔒 **Todas as rotas (exceto login) exigem token JWT no header:** `Authorization: Bearer <token>`

---

## 🔒 Segurança

- ✅ **Autenticação JWT** com expiry de 24h
- ✅ **Senhas hasheadas** com bcrypt (salt rounds = 10)
- ✅ **Rate Limiting** global (100 req/15min) + login (5 req/hora)
- ✅ **Helmet** para headers de segurança (CSP, XSS, etc)
- ✅ **CORS** restrito ao frontend configurado
- ✅ **Proteção contra XSS** via escape automático do React
- ✅ **Upload seguro** com validação de tipo e tamanho
- ✅ **SQL Injection** prevenido com queries parametrizadas (`$1`, `$2`, ...)
- ✅ **Controle de acesso** por perfil (ADMIN vs FUNCIONARIO)
- ✅ **Auditoria** de todas as ações sensíveis

---

## 🧠 Lições Técnicas

### Desafios e Soluções

| Desafio | Solução |
|---------|---------|
| **Pagamentos em tempo real** | Socket.IO com salas separadas (`pagamentos` e `dashboard`) |
| **Upload de comprovantes** | Multer com storage em disco + UUID para nomes únicos |
| **Performance do dashboard** | Queries paralelas com `Promise.all` + queries agregadas |
| **Filtros dinâmicos** | WHERE clauses montadas programaticamente com parâmetros seguros |
| **Gráficos responsivos** | Recharts com `ResponsiveContainer` |
| **Busca de clientes** | `ILIKE` para busca case-insensitive + índice no banco |
| **WebSocket e autenticação** | Middleware Socket.IO que valida JWT na handshake |

### Diferenciais

- **100% SQL parametrizado** — sem ORM, performance máxima
- **UX premium** — tema escuro, animações, mascote Fênix
- **Auditoria completa** — cada ação registrada com IP, navegador, sistema
- **Código limpo** — funções coesas, nomes descritivos, tratamento de erro consistente

---

## 👨‍💻 Autor

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/kkaua05">
        <img src="https://avatars.githubusercontent.com/kkaua05" width="100px" style="border-radius: 50%;" alt="kkaua05"/>
        <br>
        <sub><b>Kauã</b></sub>
      </a>
      <br>
      <sub>Full Stack Developer</sub>
    </td>
    <td>
      <strong>📧 Contato:</strong> <a href="mailto:kkaua05@github.com">kkaua05@github.com</a><br>
      <strong>🐙 GitHub:</strong> <a href="https://github.com/kkaua05">@kkaua05</a><br>
      <strong>💼 Projeto:</strong> <a href="https://github.com/kkaua05/fenix-pay-control">Fênix Pay Control</a>
    </td>
  </tr>
</table>

---

## 📄 Licença

Este projeto é **open source** e está sob a licença MIT.

---

<p align="center">
  <strong>Fênix Pay Control</strong> — Transformando o controle de pagamentos em loja<br>
  <em>Feito com 💜 por quem entende o dia a dia de uma provedora de internet</em>
</p>

<p align="center">
  <img src="frontend/src/assets/mascote.png" alt="Mascote Fênix" width="48">
</p>