-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) DEFAULT 'FUNCIONARIO',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nome_completo VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    cliente_nome VARCHAR(200) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(20) NOT NULL,
    observacoes TEXT,
    comprovante VARCHAR(255),
    usuario_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Criar tabela de logs
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER,
    usuario VARCHAR(100) NOT NULL,
    acao VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    ip VARCHAR(45),
    navegador TEXT,
    sistema VARCHAR(100),
    pagamento_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente_id ON pagamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_created_at ON pagamentos(created_at);
CREATE INDEX IF NOT EXISTS idx_pagamentos_usuario_id ON pagamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON clientes(cpf);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome_completo);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);

-- Inserir usuário admin (senha: admin123)
INSERT INTO usuarios (nome, usuario, email, senha, perfil)
SELECT 'Administrador', 'admin', 'admin@fenix.com', 
'$2b$10$K7lN5tV4Z8nP2qR3sW6xY1vB9cD2eF3gH4jK5lM6nP7qR8sT9uV0w', 
'ADMIN'
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE usuario = 'admin');