import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';

// ============================================================
// CONSTANTES
// ============================================================
const CATEGORIAS = [
  { value: 'todos', label: '📂 Todos', color: '#B0B8C8' },
  { value: 'comprovante', label: '🧾 Comprovante', color: '#FF6B00' },
  { value: 'fatura', label: '💰 Fatura', color: '#00C853' },
  { value: 'boleto', label: '🧾 Boleto', color: '#2196F3' },
  { value: 'documento', label: '📄 Documento', color: '#2979FF' },
  { value: 'contrato', label: '📋 Contrato', color: '#FFAB00' },
  { value: 'nota_fiscal', label: '📑 Nota Fiscal', color: '#00E676' },
  { value: 'recibo', label: '📃 Recibo', color: '#8B5CF6' },
  { value: 'imagem', label: '🖼️ Imagem', color: '#EC407A' },
  { value: 'pdf', label: '📕 PDF', color: '#F44336' },
  { value: 'planilha', label: '📊 Planilha', color: '#26A69A' },
  { value: 'outro', label: '📎 Outro', color: '#6B7280' }
];

const ORDERNACOES = [
  { value: 'a.created_at DESC', label: '📅 Mais recentes' },
  { value: 'a.created_at ASC', label: '📅 Mais antigos' },
  { value: 'a.nome_original ASC', label: '🔤 A-Z' },
  { value: 'a.tamanho DESC', label: '📦 Maior tamanho' },
  { value: 'a.downloads DESC', label: '📥 Mais baixados' }
];

const ICONES_TIPO = {
  image: '🖼️', pdf: '📕', word: '📄', excel: '📊',
  text: '📃', zip: '📦', default: '📎'
};

const getIconByType = (tipo) => {
  if (!tipo) return ICONES_TIPO.default;
  if (tipo.includes('image')) return ICONES_TIPO.image;
  if (tipo.includes('pdf')) return ICONES_TIPO.pdf;
  if (tipo.includes('word') || tipo.includes('document')) return ICONES_TIPO.word;
  if (tipo.includes('excel') || tipo.includes('sheet')) return ICONES_TIPO.excel;
  if (tipo.includes('text')) return ICONES_TIPO.text;
  if (tipo.includes('zip') || tipo.includes('rar')) return ICONES_TIPO.zip;
  return ICONES_TIPO.default;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Agora mesmo';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  if (diff < 172800000) return 'Ontem';
  return d.toLocaleDateString('pt-BR');
};

const EXTENSIONS = {
  image: '.jpg,.jpeg,.png,.gif,.webp,.svg',
  document: '.pdf,.doc,.docx,.txt,.rtf,.odt',
  spreadsheet: '.xls,.xlsx,.csv',
  all: '.jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.zip,.rar'
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const GerenciadorArquivos = () => {
  const { pagamento_id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { socket, connected } = useSocket();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [arquivos, setArquivos] = useState([]);
  const [pastas, setPastas] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 0, totalSize: 0 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewMode, setViewMode] = useState('grid');

  // Filtros
  const [filtros, setFiltros] = useState({
    search: '', categoria: '', orderBy: 'a.created_at DESC',
    page: 1, limit: 24, pasta_id: ''
  });

  // Modais
  const [showUpload, setShowUpload] = useState(false);
  const [showPasta, setShowPasta] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewArquivo, setViewArquivo] = useState(null);
  const [editArquivo, setEditArquivo] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState([]);

  const [formData, setFormData] = useState({
    descricao: '', categoria: 'auto', tags: '',
    cliente_id: '', pagamento_id: pagamento_id || ''
  });

  const [pastaData, setPastaData] = useState({
    nome: '', descricao: '', cor: '#FF6B00', icone: '📁', pasta_pai_id: ''
  });

  const [shareData, setShareData] = useState({
    data_expiracao: '', permissoes: 'visualizar', max_downloads: 0
  });

  // Stats
  const [stats, setStats] = useState(null);

  // ============================================================
  // CARREGAR DADOS
  // ============================================================
  const fetchArquivos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', filtros.page);
      params.append('limit', filtros.limit);
      if (filtros.search) params.append('search', filtros.search);
      if (filtros.categoria && filtros.categoria !== 'todos') params.append('categoria', filtros.categoria);
      if (filtros.orderBy) params.append('orderBy', filtros.orderBy);
      if (filtros.pasta_id) params.append('pasta_id', filtros.pasta_id);

      const response = await api.get(`/arquivos?${params}`);
      setArquivos(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 0,
        totalSize: response.data.pagination?.totalSize || 0
      }));
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  const fetchPastas = useCallback(async () => {
    try {
      const response = await api.get('/arquivos/pastas/listar');
      setPastas(response.data.data || []);
    } catch (error) { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/arquivos/estatisticas');
      setStats(response.data.data);
    } catch (error) { /* silent */ }
  }, []);

  useEffect(() => {
    fetchArquivos();
    fetchPastas();
    fetchStats();
  }, [fetchArquivos, fetchPastas, fetchStats]);

  // Socket
  useEffect(() => {
    if (!connected) return;
    const hUp = () => { fetchArquivos(); fetchStats(); };
    const hDel = () => { fetchArquivos(); fetchStats(); };
    socket.on('arquivo:uploaded', hUp);
    socket.on('arquivo:deleted', hDel);
    return () => { socket.off('arquivo:uploaded', hUp); socket.off('arquivo:deleted', hDel); };
  }, [connected, socket, fetchArquivos, fetchStats]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleSearch = (e) => {
    setFiltros(prev => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === arquivos.length) setSelectedIds([]);
    else setSelectedIds(arquivos.map(a => a.id));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile && filesToUpload.length === 0) {
      showToast('Selecione um arquivo', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      if (filesToUpload.length > 1) {
        // Upload múltiplo
        const form = new FormData();
        filesToUpload.forEach(f => form.append('arquivos', f));
        form.append('categoria', document.getElementById('cat_upload')?.value || 'auto');
        form.append('descricao', document.getElementById('desc_upload')?.value || '');
        if (pagamento_id) form.append('pagamento_id', pagamento_id);

        await api.post('/arquivos/multiplo', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded / e.total) * 100))
        });
        showToast(`✅ ${filesToUpload.length} arquivos enviados!`, 'success');
      } else {
        // Upload único
        const form = new FormData();
        form.append('arquivo', selectedFile);
        form.append('categoria', document.getElementById('cat_upload')?.value || 'auto');
        form.append('descricao', document.getElementById('desc_upload')?.value || '');
        form.append('tags', document.getElementById('tags_upload')?.value || '');
        if (pagamento_id) form.append('pagamento_id', pagamento_id);

        await api.post('/arquivos', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded / e.total) * 100))
        });
        showToast('✅ Arquivo enviado!', 'success');
      }

      setShowUpload(false);
      setSelectedFile(null);
      setFilesToUpload([]);
      setUploadProgress(0);
      fetchArquivos();
      fetchStats();
    } catch (error) {
      showToast('Erro ao enviar', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id, nome) => {
    try {
      const response = await api.get(`/arquivos/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('📥 Download iniciado', 'success');
      fetchStats();
    } catch (error) {
      showToast('Erro ao baixar', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este arquivo?')) return;
    try {
      await api.delete(`/arquivos/${id}`);
      showToast('🗑️ Excluído!', 'success');
      fetchArquivos();
      fetchStats();
    } catch (error) {
      showToast('Erro ao excluir', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Excluir ${selectedIds.length} arquivos?`)) return;
    try {
      await api.post('/arquivos/bulk-delete', { ids: selectedIds });
      showToast(`🗑️ ${selectedIds.length} excluídos!`, 'success');
      setSelectedIds([]);
      setShowBulk(false);
      fetchArquivos();
      fetchStats();
    } catch (error) {
      showToast('Erro', 'error');
    }
  };

  const handleFavoritar = async (id) => {
    try {
      const response = await api.post(`/arquivos/${id}/favoritar`);
      fetchArquivos();
      fetchStats();
    } catch (error) {
      showToast('Erro', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editArquivo) return;
    try {
      await api.put(`/arquivos/${editArquivo.id}`, {
        descricao: editArquivo.descricao,
        tags: editArquivo.tags,
        categoria: editArquivo.categoria,
        destaque: editArquivo.destaque,
        publico: editArquivo.publico
      });
      showToast('✅ Atualizado!', 'success');
      setShowEdit(false);
      fetchArquivos();
    } catch (error) {
      showToast('Erro', 'error');
    }
  };

  const handleShare = async (id) => {
    try {
      const response = await api.post(`/arquivos/${id}/compartilhar`, shareData);
      setShareLink(response.data.data.url);
      showToast('🔗 Link gerado!', 'success');
    } catch (error) {
      showToast('Erro', 'error');
    }
  };

  const handlePasta = async (e) => {
    e.preventDefault();
    try {
      await api.post('/arquivos/pastas', {
        ...pastaData,
        pasta_pai_id: pastaData.pasta_pai_id || null
      });
      showToast('📁 Pasta criada!', 'success');
      setShowPasta(false);
      setPastaData({ nome: '', descricao: '', cor: '#FF6B00', icone: '📁', pasta_pai_id: '' });
      fetchPastas();
    } catch (error) {
      showToast('Erro ao criar pasta', 'error');
    }
  };

  const handleVisualizar = (arquivo) => {
    if (arquivo.tipo?.includes('image') || arquivo.tipo?.includes('pdf')) {
      setViewArquivo(arquivo);
      setShowViewer(true);
    } else {
      handleDownload(arquivo.id, arquivo.nome_original);
    }
  };

  const isImage = (t) => t && t.includes('image');
  const isPDF = (t) => t && t.includes('pdf');
  const isPreviewable = (t) => isImage(t) || isPDF(t);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="page-container">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            📁 Gerenciador de Arquivos
            {pagamento_id && <span style={{ fontSize: '0.9rem', color: '#6B7280', marginLeft: '12px' }}>Pagamento #{pagamento_id}</span>}
          </h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>{pagination.total} arquivos • {formatFileSize(pagination.totalSize)}</span>
            {connected && <span style={{ color: '#00E676', fontSize: '0.75rem' }}>🟢 Tempo Real</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {pagamento_id && (
            <button onClick={() => navigate(`/pagamentos/${pagamento_id}`)} className="btn-secondary">
              ↩️ Voltar
            </button>
          )}
          <button onClick={() => setShowPasta(true)} className="btn-secondary">
            📁 Nova Pasta
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            📤 Upload
          </button>
        </div>
      </div>

      {/* STATS BAR */}
      {stats && (
        <div className="card animate-fade-in" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#B0B8C8', fontSize: '0.8rem' }}>
              📦 <strong style={{ color: '#FF6B00' }}>{stats.geral?.total_arquivos || 0}</strong> arquivos
            </span>
            <span style={{ color: '#B0B8C8', fontSize: '0.8rem' }}>
              💾 <strong style={{ color: '#00E676' }}>{formatFileSize(stats.geral?.tamanho_total || 0)}</strong>
            </span>
            <span style={{ color: '#B0B8C8', fontSize: '0.8rem' }}>
              📥 <strong style={{ color: '#2979FF' }}>{stats.geral?.total_downloads || 0}</strong> downloads
            </span>
            <span style={{ color: '#B0B8C8', fontSize: '0.8rem' }}>
              ⭐ <strong style={{ color: '#FFAB00' }}>{stats.geral?.favoritos || 0}</strong> favoritos
            </span>
            <span style={{ color: '#B0B8C8', fontSize: '0.8rem' }}>
              📅 Esta semana: <strong>{stats.geral?.arquivos_semana || 0}</strong>
            </span>
          </div>
        </div>
      )}

      {/* FILTROS + AÇÕES EM MASSA */}
      <div className="card animate-fade-in" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Busca */}
          <div className="input-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
            <input
              type="text" placeholder="🔍 Buscar arquivos..." value={filtros.search}
              onChange={handleSearch}
            />
          </div>

          {/* Categoria */}
          <div className="input-group" style={{ marginBottom: 0, width: '160px' }}>
            <select value={filtros.categoria} onChange={e => setFiltros(prev => ({ ...prev, categoria: e.target.value, page: 1 }))}>
              {CATEGORIAS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div className="input-group" style={{ marginBottom: 0, width: '180px' }}>
            <select value={filtros.orderBy} onChange={e => setFiltros(prev => ({ ...prev, orderBy: e.target.value, page: 1 }))}>
              {ORDERNACOES.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* View Mode */}
          <div style={{ display: 'flex', gap: '4px', background: '#161A22', borderRadius: '8px', padding: '2px', border: '1px solid #2A3040' }}>
            <button onClick={() => setViewMode('grid')} style={{
              padding: '6px 10px', borderRadius: '6px',
              background: viewMode === 'grid' ? 'rgba(255,107,0,0.15)' : 'transparent',
              color: viewMode === 'grid' ? '#FF6B00' : '#6B7280', border: 'none', cursor: 'pointer', fontSize: '0.9rem'
            }}>🔲</button>
            <button onClick={() => setViewMode('list')} style={{
              padding: '6px 10px', borderRadius: '6px',
              background: viewMode === 'list' ? 'rgba(255,107,0,0.15)' : 'transparent',
              color: viewMode === 'list' ? '#FF6B00' : '#6B7280', border: 'none', cursor: 'pointer', fontSize: '0.9rem'
            }}>📋</button>
          </div>

          {/* Ações em massa */}
          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ color: '#FF6B00', fontSize: '0.8rem', fontWeight: '600' }}>
                {selectedIds.length} selecionados
              </span>
              <button onClick={() => setShowBulk(true)} className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                🗑️ Excluir
              </button>
              <button onClick={() => setSelectedIds([])} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                Limpar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONTEÚDO */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: '40px', height: '40px', margin: '0 auto 16px', border: '3px solid #2A3040', borderTop: '3px solid #FF6B00', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div className="loading-pulse" style={{ color: '#B0B8C8' }}>Carregando arquivos...</div>
        </div>
      ) : arquivos.length === 0 ? (
        <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📂</div>
          <div style={{ color: '#B0B8C8', fontSize: '1.2rem', fontWeight: '500' }}>Nenhum arquivo encontrado</div>
          <div style={{ color: '#6B7280', marginTop: '8px', marginBottom: '20px' }}>
            {filtros.search ? 'Tente alterar os filtros de busca' : 'Clique em "Upload" para adicionar arquivos'}
          </div>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            📤 Novo Upload
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* VIEW GRID */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {arquivos.map((arquivo, idx) => (
            <div key={arquivo.id} className={`card animate-fade-in ${selectedIds.includes(arquivo.id) ? 'selected' : ''}`}
              style={{
                padding: '14px', cursor: 'pointer', position: 'relative',
                border: selectedIds.includes(arquivo.id) ? '1px solid #FF6B00' : '1px solid #2A3040',
                animationDelay: `${idx * 0.03}s`
              }}
              onClick={() => handleSelect(arquivo.id)}
            >
              {/* Checkbox */}
              <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2 }}>
                <input type="checkbox" checked={selectedIds.includes(arquivo.id)} readOnly
                  style={{ accentColor: '#FF6B00', width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </div>

              {/* Ícone + Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{getIconByType(arquivo.tipo)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#FFFFFF', fontWeight: '500', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {arquivo.nome_original}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', display: 'flex', gap: '8px' }}>
                    <span>{formatFileSize(arquivo.tamanho)}</span>
                    <span>•</span>
                    <span>{formatDate(arquivo.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Descrição */}
              {arquivo.descricao && (
                <div style={{ fontSize: '0.75rem', color: '#B0B8C8', marginBottom: '6px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {arquivo.descricao}
                </div>
              )}

              {/* Tags + Categoria */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {(() => {
                  const cat = CATEGORIAS.find(c => c.value === arquivo.categoria);
                  return cat ? (
                    <span style={{ padding: '1px 8px', borderRadius: '4px', fontSize: '0.65rem', background: `${cat.color}20`, color: cat.color, fontWeight: '600' }}>
                      {cat.label.split(' ')[1] || arquivo.categoria}
                    </span>
                  ) : null;
                })()}
                    {Array.isArray(arquivo.tags) && arquivo.tags.slice(0, 2).map((tag, i) => (
                      <span key={i} style={{ padding: '1px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.6rem', color: '#6B7280' }}>
                        #{tag}
                      </span>
                    ))}
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {isPreviewable(arquivo.tipo) && (
                  <button onClick={(e) => { e.stopPropagation(); handleVisualizar(arquivo); }}
                    style={smallBtn('#2979FF')}>👁️</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleDownload(arquivo.id, arquivo.nome_original); }}
                  style={smallBtn('#00E676')}>📥</button>
                <button onClick={(e) => { e.stopPropagation(); setEditArquivo(arquivo); setShowEdit(true); }}
                  style={smallBtn('#FFAB00')}>✏️</button>
                <button onClick={(e) => { e.stopPropagation(); handleFavoritar(arquivo.id); }}
                  style={smallBtn('#FF6B00')}>⭐</button>
                <button onClick={(e) => { e.stopPropagation(); setShareLink(''); setEditArquivo(arquivo); setShowShare(true); }}
                  style={smallBtn('#8B5CF6')}>🔗</button>
                {(isAdmin || arquivo.usuario_id === user?.id) && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(arquivo.id); }}
                    style={smallBtn('#FF1744')}>🗑️</button>
                )}
              </div>

              {/* Downloads count */}
              {arquivo.downloads > 0 && (
                <div style={{ marginTop: '6px', fontSize: '0.65rem', color: '#6B7280' }}>
                  📥 {arquivo.downloads} downloads
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* VIEW LISTA */
        <div className="table-container animate-fade-in">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === arquivos.length && arquivos.length > 0}
                    style={{ accentColor: '#FF6B00' }} />
                </th>
                <th>Arquivo</th>
                <th>Categoria</th>
                <th>Tamanho</th>
                <th>Data</th>
                <th>Downloads</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {arquivos.map((a, idx) => (
                <tr key={a.id} className={`animate-fade-in ${selectedIds.includes(a.id) ? 'selected-row' : ''}`}
                  style={{ animationDelay: `${idx * 0.02}s`, cursor: 'pointer' }}
                  onClick={() => handleSelect(a.id)}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(a.id)} readOnly style={{ accentColor: '#FF6B00' }} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{getIconByType(a.tipo)}</span>
                      <div>
                        <div style={{ fontWeight: '500', color: '#FFFFFF', fontSize: '0.85rem' }}>{a.nome_original}</div>
                        {a.descricao && <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>{a.descricao}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const cat = CATEGORIAS.find(c => c.value === a.categoria);
                      return cat ? (
                        <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '0.7rem', background: `${cat.color}20`, color: cat.color, fontWeight: '600' }}>
                          {cat.label.split(' ')[1] || a.categoria}
                        </span>
                      ) : <span style={{ color: '#6B7280', fontSize: '0.8rem' }}>{a.categoria}</span>;
                    })()}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{formatFileSize(a.tamanho)}</td>
                  <td style={{ fontSize: '0.8rem', color: '#B0B8C8' }}>{formatDate(a.created_at)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{a.downloads || 0}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {isPreviewable(a.tipo) && (
                        <button onClick={() => handleVisualizar(a)} style={smallBtn('#2979FF')}>👁️</button>
                      )}
                      <button onClick={() => handleDownload(a.id, a.nome_original)} style={smallBtn('#00E676')}>📥</button>
                      <button onClick={() => { setEditArquivo(a); setShowEdit(true); }} style={smallBtn('#FFAB00')}>✏️</button>
                      {(isAdmin || a.usuario_id === user?.id) && (
                        <button onClick={() => handleDelete(a.id)} style={smallBtn('#FF1744')}>🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINAÇÃO */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '20px', alignItems: 'center' }}>
          <button onClick={() => setFiltros(prev => ({ ...prev, page: prev.page - 1 }))} disabled={filtros.page <= 1}
            className="btn-secondary" style={{ padding: '6px 16px' }}>←</button>
          <span style={{ padding: '6px 16px', background: '#161A22', borderRadius: '6px', color: '#FFFFFF', fontSize: '0.9rem' }}>
            {filtros.page} / {pagination.pages}
          </span>
          <button onClick={() => setFiltros(prev => ({ ...prev, page: prev.page + 1 }))} disabled={filtros.page >= pagination.pages}
            className="btn-secondary" style={{ padding: '6px 16px' }}>→</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DE UPLOAD */}
      {/* ============================================================ */}
      {showUpload && (
        <Modal onClose={() => setShowUpload(false)} title="📤 Upload de Arquivo">
          <form onSubmit={handleUpload}>
            <div className="input-group">
              <label>Arquivo(s)</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  setSelectedFile(e.target.files[0]);
                  setFilesToUpload(Array.from(e.target.files));
                }}
                required
                accept={EXTENSIONS.all}
              />
              {filesToUpload.length > 1 && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#00E676' }}>
                  ✅ {filesToUpload.length} arquivos selecionados
                </div>
              )}
              {filesToUpload.length === 1 && selectedFile && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#00E676' }}>
                  ✅ {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              )}
            </div>

            <div className="input-group">
              <label>Categoria</label>
              <select id="cat_upload" defaultValue="auto">
                <option value="auto">🔍 Detectar automaticamente</option>
                {CATEGORIAS.filter(c => c.value !== 'todos').map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Descrição</label>
              <input id="desc_upload" placeholder="Descrição do arquivo..." />
            </div>

            <div className="input-group">
              <label>Tags</label>
              <input id="tags_upload" placeholder="Tag1, Tag2, Tag3" />
            </div>

            {uploadProgress > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#B0B8C8', marginBottom: '4px' }}>
                  <span>Enviando...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#2A3040', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #FF6B00, #FF9A2F)', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn-primary" disabled={uploading || (!selectedFile && filesToUpload.length === 0)} style={{ flex: 1 }}>
                {uploading ? `⏳ ${uploadProgress}%` : filesToUpload.length > 1 ? `📤 Enviar ${filesToUpload.length} arquivos` : '📤 Enviar'}
              </button>
              <button type="button" onClick={() => { setShowUpload(false); setSelectedFile(null); setFilesToUpload([]); }} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL DE PASTA */}
      {/* ============================================================ */}
      {showPasta && (
        <Modal onClose={() => setShowPasta(false)} title="📁 Nova Pasta">
          <form onSubmit={handlePasta}>
            <div className="input-group">
              <label>Nome da Pasta *</label>
              <input value={pastaData.nome} onChange={e => setPastaData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Contratos 2024" required />
            </div>
            <div className="input-group">
              <label>Descrição</label>
              <input value={pastaData.descricao} onChange={e => setPastaData(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label>Ícone</label>
                <select value={pastaData.icone} onChange={e => setPastaData(prev => ({ ...prev, icone: e.target.value }))}>
                  <option value="📁">📁 Pasta</option>
                  <option value="📂">📂 Aberta</option>
                  <option value="📄">📄 Documento</option>
                  <option value="📊">📊 Planilha</option>
                  <option value="📸">📸 Imagem</option>
                  <option value="🔒">🔒 Privado</option>
                  <option value="⭐">⭐ Importante</option>
                </select>
              </div>
              <div className="input-group">
                <label>Cor</label>
                <input type="color" value={pastaData.cor} onChange={e => setPastaData(prev => ({ ...prev, cor: e.target.value }))}
                  style={{ height: '42px', padding: '4px' }} />
              </div>
            </div>
            {pastas.length > 0 && (
              <div className="input-group">
                <label>Pasta pai (opcional)</label>
                <select value={pastaData.pasta_pai_id} onChange={e => setPastaData(prev => ({ ...prev, pasta_pai_id: e.target.value }))}>
                  <option value="">Nenhuma (raiz)</option>
                  {pastas.map(p => (
                    <option key={p.id} value={p.id}>{p.icone} {p.nome}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>📁 Criar Pasta</button>
              <button type="button" onClick={() => setShowPasta(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL DE EDIÇÃO */}
      {/* ============================================================ */}
      {showEdit && editArquivo && (
        <Modal onClose={() => setShowEdit(false)} title={`✏️ Editar: ${editArquivo.nome_original}`}>
          <div className="input-group">
            <label>Descrição</label>
            <textarea value={editArquivo.descricao || ''} onChange={e => setEditArquivo(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descrição do arquivo..." rows="3" />
          </div>
          <div className="input-group">
            <label>Categoria</label>
            <select value={editArquivo.categoria} onChange={e => setEditArquivo(prev => ({ ...prev, categoria: e.target.value }))}>
              {CATEGORIAS.filter(c => c.value !== 'todos').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Tags (separadas por vírgula)</label>
            <input value={Array.isArray(editArquivo.tags) ? editArquivo.tags.join(', ') : editArquivo.tags || ''}
              onChange={e => setEditArquivo(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()) }))}
              placeholder="Tag1, Tag2, Tag3" />
          </div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B0B8C8', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={editArquivo.destaque || false}
                onChange={e => setEditArquivo(prev => ({ ...prev, destaque: e.target.checked }))}
                style={{ accentColor: '#FF6B00' }} />
              ⭐ Destacar
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B0B8C8', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={editArquivo.publico || false}
                onChange={e => setEditArquivo(prev => ({ ...prev, publico: e.target.checked }))}
                style={{ accentColor: '#FF6B00' }} />
              🌍 Público
            </label>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleUpdate} className="btn-primary" style={{ flex: 1 }}>💾 Salvar</button>
            <button onClick={() => setShowEdit(false)} className="btn-secondary">Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL DE COMPARTILHAMENTO */}
      {/* ============================================================ */}
      {showShare && editArquivo && (
        <Modal onClose={() => setShowShare(false)} title={`🔗 Compartilhar: ${editArquivo.nome_original}`}>
          {shareLink ? (
            <div>
              <div style={{ padding: '12px', background: 'rgba(0,230,118,0.05)', borderRadius: '8px', border: '1px solid rgba(0,230,118,0.2)', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: '4px' }}>Link gerado:</div>
                <div style={{ color: '#00E676', wordBreak: 'break-all', fontSize: '0.85rem' }}>{shareLink}</div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(shareLink); showToast('📋 Copiado!', 'success'); }}
                className="btn-primary" style={{ width: '100%' }}>📋 Copiar Link</button>
            </div>
          ) : (
            <div>
              <div className="input-group">
                <label>Data de expiração (opcional)</label>
                <input type="datetime-local" value={shareData.data_expiracao}
                  onChange={e => setShareData(prev => ({ ...prev, data_expiracao: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Permissões</label>
                <select value={shareData.permissoes} onChange={e => setShareData(prev => ({ ...prev, permissoes: e.target.value }))}>
                  <option value="visualizar">👁️ Apenas visualizar</option>
                  <option value="editar">✏️ Pode editar</option>
                </select>
              </div>
              <div className="input-group">
                <label>Limite de downloads (0 = ilimitado)</label>
                <input type="number" min="0" value={shareData.max_downloads}
                  onChange={e => setShareData(prev => ({ ...prev, max_downloads: e.target.value }))} />
              </div>
              <button onClick={() => handleShare(editArquivo.id)} className="btn-primary" style={{ width: '100%' }}>
                🔗 Gerar Link
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL DE EXCLUSÃO EM MASSA */}
      {/* ============================================================ */}
      {showBulk && (
        <Modal onClose={() => setShowBulk(false)} title="🗑️ Confirmar Exclusão">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
            <div style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: '500' }}>
              Excluir {selectedIds.length} arquivo(s)?
            </div>
            <div style={{ color: '#6B7280', fontSize: '0.85rem', marginTop: '8px' }}>
              Esta ação não pode ser desfeita.<br />
              Os arquivos serão removidos permanentemente.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleBulkDelete} className="btn-danger" style={{ flex: 1 }}>
              🗑️ Excluir {selectedIds.length} arquivos
            </button>
            <button onClick={() => setShowBulk(false)} className="btn-secondary">Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ============================================================ */}
      {/* MODAL DE VISUALIZAÇÃO */}
      {/* ============================================================ */}
      {showViewer && viewArquivo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px', animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            position: 'relative', maxWidth: '95%', maxHeight: '95%',
            background: '#161A22', borderRadius: '16px', border: '1px solid #2A3040',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)', overflow: 'hidden', width: '100%', maxWidth: '1000px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #2A3040' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>{getIconByType(viewArquivo.tipo)}</span>
                <div>
                  <div style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '1rem' }}>{viewArquivo.nome_original}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                    {formatFileSize(viewArquivo.tamanho)} • {new Date(viewArquivo.created_at).toLocaleString('pt-BR')}
                    {viewArquivo.descricao && ` • ${viewArquivo.descricao}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleDownload(viewArquivo.id, viewArquivo.nome_original)}
                  className="btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                  📥 Download
                </button>
                <button onClick={() => setShowViewer(false)}
                  style={{ padding: '6px 16px', borderRadius: '8px', background: 'rgba(255,23,68,0.15)', color: '#FF1744', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', maxHeight: '70vh', overflow: 'auto', background: 'rgba(0,0,0,0.3)' }}>
              {isImage(viewArquivo.tipo) ? (
                <img src={viewArquivo.url}
                  alt={viewArquivo.nome_original}
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:#6B7280">🖼️<br>Imagem indisponível</div>'; }}
                />
              ) : isPDF(viewArquivo.tipo) ? (
                <iframe src={viewArquivo.url}
                  style={{ width: '100%', height: '60vh', border: 'none', borderRadius: '8px', background: '#FFF' }}
                  title={viewArquivo.nome_original} />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
                  <div>Visualização não disponível</div>
                  <button onClick={() => handleDownload(viewArquivo.id, viewArquivo.nome_original)}
                    className="btn-primary" style={{ marginTop: '16px' }}>
                    📥 Download
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// COMPONENTE MODAL REUTILIZÁVEL
// ============================================================
const Modal = ({ onClose, title, children }) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px'
  }}>
    <div className="card animate-fade-in" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6B7280', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ============================================================
// HELPER
// ============================================================
const smallBtn = (color) => ({
  padding: '3px 8px', borderRadius: '4px',
  background: `${color}15`, color, fontSize: '0.75rem',
  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
  lineHeight: 1.4
});

export default GerenciadorArquivos;