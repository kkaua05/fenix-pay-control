import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';

const GerenciadorArquivos = () => {
  const { pagamento_id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { socket, connected } = useSocket();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [arquivos, setArquivos] = useState([]);
  const [categorias] = useState([
    'comprovante', 'documento', 'contrato', 'nota_fiscal', 'recibo', 'outro'
  ]);
  const [filtros, setFiltros] = useState({
    search: '',
    categoria: '',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0
  });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalArquivo, setModalArquivo] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [shareData, setShareData] = useState({
    usuario_id: '',
    data_expiracao: '',
    permissoes: 'visualizar'
  });
  // Estado para o modal de visualização
  const [viewArquivo, setViewArquivo] = useState(null);

  const fetchArquivos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', filtros.page);
      params.append('limit', filtros.limit);
      if (filtros.search) params.append('search', filtros.search);
      if (filtros.categoria) params.append('categoria', filtros.categoria);
      if (pagamento_id) params.append('pagamento_id', pagamento_id);

      const response = await api.get(`/arquivos?${params}`);
      setArquivos(response.data.data || []);
      setPagination(response.data.pagination || { total: 0, pages: 0 });
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      if (error.response?.status !== 404) {
        showToast('Erro ao carregar arquivos', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArquivos();
  }, [filtros.page, filtros.search, filtros.categoria, pagamento_id]);

  useEffect(() => {
    if (!connected) return;

    const handleArquivoUploaded = () => {
      fetchArquivos();
    };

    const handleArquivoDeleted = () => {
      fetchArquivos();
    };

    socket.on('arquivo:uploaded', handleArquivoUploaded);
    socket.on('arquivo:deleted', handleArquivoDeleted);

    return () => {
      socket.off('arquivo:uploaded', handleArquivoUploaded);
      socket.off('arquivo:deleted', handleArquivoDeleted);
    };
  }, [connected, socket]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Selecione um arquivo', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', selectedFile);
      formData.append('categoria', document.getElementById('categoria_upload').value || 'comprovante');
      formData.append('descricao', document.getElementById('descricao_upload').value || '');
      formData.append('tags', document.getElementById('tags_upload').value || '');
      if (pagamento_id) formData.append('pagamento_id', pagamento_id);

      await api.post('/arquivos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('✅ Arquivo enviado com sucesso!', 'success');
      setSelectedFile(null);
      setShowUploadModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchArquivos();
    } catch (error) {
      console.error('Erro no upload:', error);
      showToast('Erro ao enviar arquivo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id, nome) => {
    try {
      const response = await api.get(`/arquivos/${id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast('📥 Download iniciado', 'success');
    } catch (error) {
      console.error('Erro no download:', error);
      showToast('Erro ao baixar arquivo', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este arquivo?')) return;

    try {
      await api.delete(`/arquivos/${id}`);
      showToast('✅ Arquivo excluído com sucesso!', 'success');
      fetchArquivos();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showToast('Erro ao excluir arquivo', 'error');
    }
  };

  const handleCompartilhar = async (id) => {
    try {
      const response = await api.post(`/arquivos/${id}/compartilhar`, shareData);
      setShareLink(response.data.data.url);
      showToast('🔗 Link gerado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      showToast('Erro ao compartilhar arquivo', 'error');
    }
  };

  // Função para abrir visualização
  const handleVisualizar = (arquivo) => {
    setViewArquivo(arquivo);
  };

  // Função para fechar visualização
  const handleFecharVisualizacao = () => {
    setViewArquivo(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getIconByType = (tipo) => {
    if (!tipo) return '📎';
    if (tipo.includes('image')) return '🖼️';
    if (tipo.includes('pdf')) return '📄';
    if (tipo.includes('word') || tipo.includes('document')) return '📝';
    if (tipo.includes('excel') || tipo.includes('sheet')) return '📊';
    if (tipo.includes('text')) return '📃';
    return '📎';
  };

  const getCategoriaBadge = (categoria) => {
    const colors = {
      comprovante: { bg: 'rgba(255, 107, 0, 0.15)', color: '#FF6B00' },
      documento: { bg: 'rgba(41, 121, 255, 0.15)', color: '#2979FF' },
      contrato: { bg: 'rgba(255, 171, 0, 0.15)', color: '#FFAB00' },
      nota_fiscal: { bg: 'rgba(0, 230, 118, 0.15)', color: '#00E676' },
      recibo: { bg: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' },
      outro: { bg: 'rgba(255, 255, 255, 0.05)', color: '#B0B8C8' }
    };
    const style = colors[categoria] || colors.outro;
    return (
      <span style={{
        padding: '2px 12px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        background: style.bg,
        color: style.color,
        fontWeight: '600'
      }}>
        {categoria || 'outro'}
      </span>
    );
  };

  // Verificar se o arquivo é uma imagem
  const isImage = (tipo) => {
    return tipo && tipo.includes('image');
  };

  // Verificar se o arquivo é PDF
  const isPDF = (tipo) => {
    return tipo && tipo.includes('pdf');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">📁 Gerenciador de Arquivos</h1>
          <p className="page-subtitle">
            Gerencie todos os documentos e comprovantes do sistema
            {pagamento_id && ` - Pagamento #${pagamento_id}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {pagamento_id && (
            <button
              onClick={() => navigate(`/pagamentos/${pagamento_id}`)}
              className="btn-secondary"
            >
              ↩️ Voltar ao Pagamento
            </button>
          )}
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-primary"
          >
            📤 Novo Arquivo
          </button>
        </div>
      </div>

      {/* Modal de Upload */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: '#FFFFFF' }}>📤 Upload de Arquivo</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="input-group">
                <label>Arquivo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  required
                />
                {selectedFile && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#00E676' }}>
                    ✅ {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>

              <div className="input-group">
                <label>Categoria</label>
                <select id="categoria_upload" defaultValue="comprovante">
                  {categorias.map(cat => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Descrição</label>
                <input id="descricao_upload" placeholder="Descrição do arquivo" />
              </div>

              <div className="input-group">
                <label>Tags</label>
                <input id="tags_upload" placeholder="Tag1, Tag2, Tag3" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={uploading || !selectedFile}
                  style={{ flex: 1 }}
                >
                  {uploading ? '⏳ Enviando...' : '📤 Enviar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card animate-fade-in" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar por nome, descrição..."
              value={filtros.search}
              onChange={(e) => setFiltros(prev => ({ ...prev, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <select
              value={filtros.categoria}
              onChange={(e) => setFiltros(prev => ({ ...prev, categoria: e.target.value, page: 1 }))}
            >
              <option value="">Todas categorias</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setFiltros({ search: '', categoria: '', page: 1, limit: 20 });
            }}
            className="btn-secondary"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Lista de Arquivos */}
      <div className="animate-fade-in">
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="loading-pulse" style={{ color: '#B0B8C8' }}>
              Carregando arquivos...
            </div>
          </div>
        ) : arquivos.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📂</div>
            <div style={{ color: '#B0B8C8', fontSize: '1.1rem' }}>
              Nenhum arquivo encontrado
            </div>
            <div style={{ color: '#6B7280', marginTop: '8px' }}>
              Clique em "Novo Arquivo" para fazer upload
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {arquivos.map((arquivo) => (
              <div key={arquivo.id} className="card animate-fade-in" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '2rem' }}>{getIconByType(arquivo.tipo)}</span>
                    <div>
                      <div style={{ color: '#FFFFFF', fontWeight: '500', fontSize: '0.9rem' }}>
                        {arquivo.nome_original}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                        {formatFileSize(arquivo.tamanho)} • {new Date(arquivo.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div>{getCategoriaBadge(arquivo.categoria)}</div>
                </div>

                {arquivo.descricao && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#B0B8C8' }}>
                    {arquivo.descricao}
                  </div>
                )}

                {arquivo.tags && arquivo.tags.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {arquivo.tags.map((tag, i) => (
                      <span key={i} style={{
                        padding: '1px 8px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        color: '#6B7280'
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {/* Botão Visualizar */}
                  {(isImage(arquivo.tipo) || isPDF(arquivo.tipo)) && (
                    <button
                      onClick={() => handleVisualizar(arquivo)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        background: 'rgba(41, 121, 255, 0.15)',
                        color: '#2979FF',
                        fontSize: '0.75rem',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.15)'}
                    >
                      👁️ Visualizar
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(arquivo.id, arquivo.nome_original)}
                    className="btn-primary"
                    style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                  >
                    📥 Baixar
                  </button>
                  <button
                    onClick={() => {
                      setModalArquivo(arquivo);
                      setShareLink('');
                    }}
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                  >
                    🔗 Compartilhar
                  </button>
                  {(isAdmin || arquivo.usuario_id === user?.id) && (
                    <button
                      onClick={() => handleDelete(arquivo.id)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '4px',
                        background: 'rgba(255, 23, 68, 0.15)',
                        color: '#FF1744',
                        fontSize: '0.75rem',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Excluir
                    </button>
                  )}
                </div>

                {arquivo.downloads > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#6B7280' }}>
                    📥 {arquivo.downloads} downloads
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {pagination.pages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '20px'
          }}>
            <button
              onClick={() => setFiltros(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={filtros.page === 1}
              className="btn-secondary"
              style={{ padding: '6px 16px' }}
            >
              ←
            </button>
            <span style={{
              padding: '6px 16px',
              background: '#161A22',
              borderRadius: '4px',
              color: '#FFFFFF'
            }}>
              {filtros.page} / {pagination.pages}
            </span>
            <button
              onClick={() => setFiltros(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
              disabled={filtros.page === pagination.pages}
              className="btn-secondary"
              style={{ padding: '6px 16px' }}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Modal Compartilhar */}
      {modalArquivo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFFFFF' }}>🔗 Compartilhar Arquivo</h3>
              <button
                onClick={() => {
                  setModalArquivo(null);
                  setShareLink('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#B0B8C8', fontSize: '0.85rem' }}>
                Compartilhando: <span style={{ color: '#FFFFFF', fontWeight: '500' }}>
                  {modalArquivo.nome_original}
                </span>
              </div>
            </div>

            {shareLink ? (
              <div>
                <div style={{
                  padding: '12px',
                  background: 'rgba(0, 230, 118, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 230, 118, 0.2)',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#6B7280', marginBottom: '4px' }}>
                    Link de compartilhamento gerado:
                  </div>
                  <div style={{ color: '#00E676', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                    {shareLink}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    showToast('📋 Link copiado!', 'success');
                  }}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  📋 Copiar Link
                </button>
              </div>
            ) : (
              <div>
                <div className="input-group">
                  <label>Usuário (opcional)</label>
                  <input
                    placeholder="ID do usuário para compartilhar"
                    value={shareData.usuario_id}
                    onChange={(e) => setShareData(prev => ({ ...prev, usuario_id: e.target.value }))}
                  />
                </div>

                <div className="input-group">
                  <label>Data de Expiração (opcional)</label>
                  <input
                    type="datetime-local"
                    value={shareData.data_expiracao}
                    onChange={(e) => setShareData(prev => ({ ...prev, data_expiracao: e.target.value }))}
                  />
                </div>

                <div className="input-group">
                  <label>Permissões</label>
                  <select
                    value={shareData.permissoes}
                    onChange={(e) => setShareData(prev => ({ ...prev, permissoes: e.target.value }))}
                  >
                    <option value="visualizar">Visualizar</option>
                    <option value="editar">Editar</option>
                  </select>
                </div>

                <button
                  onClick={() => handleCompartilhar(modalArquivo.id)}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  🔗 Gerar Link
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Visualização de Arquivo - PROFISSIONAL */}
      {viewArquivo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '90%',
            maxHeight: '90%',
            background: '#161A22',
            borderRadius: '16px',
            border: '1px solid #2A3040',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '900px'
          }}>
            {/* Header do Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #2A3040',
              background: 'rgba(22, 26, 34, 0.95)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.5rem' }}>{getIconByType(viewArquivo.tipo)}</span>
                <div>
                  <div style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '1rem' }}>
                    {viewArquivo.nome_original}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                    {formatFileSize(viewArquivo.tamanho)} • {new Date(viewArquivo.created_at).toLocaleString('pt-BR')}
                    {viewArquivo.descricao && ` • ${viewArquivo.descricao}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleDownload(viewArquivo.id, viewArquivo.nome_original)}
                  className="btn-primary"
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  📥 Baixar
                </button>
                <button
                  onClick={handleFecharVisualizacao}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 23, 68, 0.15)',
                    color: '#FF1744',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 23, 68, 0.15)'}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{
              padding: '24px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '300px',
              maxHeight: '70vh',
              overflow: 'auto',
              background: 'rgba(0,0,0,0.3)'
            }}>
              {isImage(viewArquivo.tipo) ? (
                <img
                  src={`/uploads/arquivos/${viewArquivo.categoria}/${viewArquivo.nome_arquivo}`}
                  alt={viewArquivo.nome_original}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '60vh',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = `
                      <div style="text-align: center; color: #6B7280; padding: 40px;">
                        <div style="font-size: 3rem; margin-bottom: 16px;">🖼️</div>
                        <div>Não foi possível carregar a imagem</div>
                        <div style="font-size: 0.85rem; margin-top: 8px;">${viewArquivo.nome_original}</div>
                      </div>
                    `;
                  }}
                />
              ) : isPDF(viewArquivo.tipo) ? (
                <iframe
                  src={`/uploads/arquivos/${viewArquivo.categoria}/${viewArquivo.nome_arquivo}`}
                  style={{
                    width: '100%',
                    height: '60vh',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#FFFFFF'
                  }}
                  title={viewArquivo.nome_original}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#6B7280', padding: '40px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
                  <div>Visualização não disponível para este tipo de arquivo</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '8px' }}>
                    {viewArquivo.tipo || 'Tipo desconhecido'}
                  </div>
                  <button
                    onClick={() => handleDownload(viewArquivo.id, viewArquivo.nome_original)}
                    className="btn-primary"
                    style={{ marginTop: '16px' }}
                  >
                    📥 Baixar Arquivo
                  </button>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #2A3040',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(22, 26, 34, 0.95)'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                {viewArquivo.downloads > 0 && `📥 ${viewArquivo.downloads} downloads`}
                {viewArquivo.tags && viewArquivo.tags.length > 0 && (
                  <span style={{ marginLeft: '12px' }}>
                    🏷️ {viewArquivo.tags.join(', ')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                {getCategoriaBadge(viewArquivo.categoria)}
              </div>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default GerenciadorArquivos;