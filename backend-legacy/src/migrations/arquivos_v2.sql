-- ============================================================
-- MIGRATION: ARQUIVOS V2 - Estrutura Completa
-- ============================================================

-- Tabela principal de arquivos (com campos estendidos)
CREATE TABLE IF NOT EXISTS arquivos (
    id SERIAL PRIMARY KEY,
    nome_original VARCHAR(500) NOT NULL,
    nome_arquivo VARCHAR(500) NOT NULL,
    caminho TEXT NOT NULL,
    tamanho BIGINT DEFAULT 0,
    tipo VARCHAR(100) NOT NULL,
    categoria VARCHAR(50) DEFAULT 'outro',
    descricao TEXT,
    tags TEXT[],
    pagamento_id INTEGER,
    cliente_id INTEGER,
    usuario_id INTEGER NOT NULL,
    downloads INTEGER DEFAULT 0,
    versao INTEGER DEFAULT 1,
    arquivo_pai_id INTEGER,
    publico BOOLEAN DEFAULT false,
    favorito BOOLEAN DEFAULT false,
    destaque BOOLEAN DEFAULT false,
    data_expiracao TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id) ON DELETE SET NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (arquivo_pai_id) REFERENCES arquivos(id) ON DELETE SET NULL
);

-- Tabela de pastas/diretórios virtuais
CREATE TABLE IF NOT EXISTS pastas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    pasta_pai_id INTEGER,
    usuario_id INTEGER NOT NULL,
    cor VARCHAR(7) DEFAULT '#FF6B00',
    icone VARCHAR(10) DEFAULT '📁',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pasta_pai_id) REFERENCES pastas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de relacionamento arquivo-pasta
CREATE TABLE IF NOT EXISTS arquivo_pasta (
    arquivo_id INTEGER NOT NULL,
    pasta_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (arquivo_id, pasta_id),
    FOREIGN KEY (arquivo_id) REFERENCES arquivos(id) ON DELETE CASCADE,
    FOREIGN KEY (pasta_id) REFERENCES pastas(id) ON DELETE CASCADE
);

-- Tabela de compartilhamentos (estendida)
CREATE TABLE IF NOT EXISTS compartilhamentos (
    id SERIAL PRIMARY KEY,
    arquivo_id INTEGER NOT NULL,
    usuario_id INTEGER,
    token VARCHAR(50) UNIQUE NOT NULL,
    data_expiracao TIMESTAMP,
    permissoes VARCHAR(20) DEFAULT 'visualizar',
    max_downloads INTEGER DEFAULT 0,
    downloads_atual INTEGER DEFAULT 0,
    senha VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (arquivo_id) REFERENCES arquivos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabela de histórico de versões
CREATE TABLE IF NOT EXISTS versoes_arquivo (
    id SERIAL PRIMARY KEY,
    arquivo_id INTEGER NOT NULL,
    nome_original VARCHAR(500) NOT NULL,
    nome_arquivo VARCHAR(500) NOT NULL,
    caminho TEXT NOT NULL,
    tamanho BIGINT DEFAULT 0,
    tipo VARCHAR(100),
    usuario_id INTEGER NOT NULL,
    versao INTEGER NOT NULL,
    changelog TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (arquivo_id) REFERENCES arquivos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Tabela de favoritos por usuário
CREATE TABLE IF NOT EXISTS favoritos_arquivo (
    arquivo_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (arquivo_id, usuario_id),
    FOREIGN KEY (arquivo_id) REFERENCES arquivos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_arquivos_categoria ON arquivos(categoria);
CREATE INDEX IF NOT EXISTS idx_arquivos_tipo ON arquivos(tipo);
CREATE INDEX IF NOT EXISTS idx_arquivos_usuario_id ON arquivos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_pagamento_id ON arquivos(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_cliente_id ON arquivos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_created_at ON arquivos(created_at);
CREATE INDEX IF NOT EXISTS idx_arquivos_favorito ON arquivos(favorito);
CREATE INDEX IF NOT EXISTS idx_arquivos_destaque ON arquivos(destaque);
CREATE INDEX IF NOT EXISTS idx_arquivos_nome_original_trgm ON arquivos USING gin (nome_original gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_arquivos_descricao_trgm ON arquivos USING gin (descricao gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_compartilhamentos_token ON compartilhamentos(token);
CREATE INDEX IF NOT EXISTS idx_compartilhamentos_data_expiracao ON compartilhamentos(data_expiracao);
CREATE INDEX IF NOT EXISTS idx_pastas_pai ON pastas(pasta_pai_id);
CREATE INDEX IF NOT EXISTS idx_versoes_arquivo_id ON versoes_arquivo(arquivo_id);

-- ============================================================
-- FUNÇÃO PARA ATUALIZAR UPDATED_AT AUTOMATICAMENTE
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_arquivos_updated_at ON arquivos;
CREATE TRIGGER update_arquivos_updated_at
    BEFORE UPDATE ON arquivos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pastas_updated_at ON pastas;
CREATE TRIGGER update_pastas_updated_at
    BEFORE UPDATE ON pastas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();