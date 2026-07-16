import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const Usuarios = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    usuario: '',
    email: '',
    senha: '',
    perfil: 'FUNCIONARIO',
    ativo: true
  });

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const response = await api.get('/usuarios');
      setUsuarios(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      showToast('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.usuario || !formData.email) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    if (!editingUser && (!formData.senha || formData.senha.length < 6)) {
      showToast('A senha deve ter pelo menos 6 caracteres', 'error');
      return;
    }

    try {
      if (editingUser) {
        await api.put(`/usuarios/${editingUser.id}`, {
          nome: formData.nome,
          email: formData.email,
          perfil: formData.perfil,
          ativo: formData.ativo
        });
        showToast('✅ Usuário atualizado com sucesso!', 'success');
      } else {
        await api.post('/usuarios', {
          nome: formData.nome,
          usuario: formData.usuario,
          email: formData.email,
          senha: formData.senha,
          perfil: formData.perfil
        });
        showToast('✅ Usuário criado com sucesso!', 'success');
      }
      
      setShowModal(false);
      setEditingUser(null);
      setFormData({ nome: '', usuario: '', email: '', senha: '', perfil: 'FUNCIONARIO', ativo: true });
      fetchUsuarios();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      const message = error.response?.data?.message || 'Erro ao salvar usuário';
      showToast(message, 'error');
    }
  };

  const handleEdit = (usuario) => {
    setEditingUser(usuario);
    setFormData({
      nome: usuario.nome,
      usuario: usuario.usuario,
      email: usuario.email,
      senha: '',
      perfil: usuario.perfil,
      ativo: usuario.ativo
    });
    setShowModal(true);
  };

  const handleResetPassword = async (id) => {
    const novaSenha = prompt('Digite a nova senha (mínimo 6 caracteres):');
    if (novaSenha && novaSenha.length >= 6) {
      try {
        await api.put(`/usuarios/${id}/reset-password`, { nova_senha: novaSenha });
        showToast('✅ Senha alterada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast('Erro ao alterar senha', 'error');
      }
    } else if (novaSenha !== null) {
      showToast('A senha deve ter pelo menos 6 caracteres', 'error');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <span className="loading-pulse" style={{ color: '#B0B8C8' }}>Carregando usuários...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">Gerencie os usuários do sistema</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ nome: '', usuario: '', email: '', senha: '', perfil: 'FUNCIONARIO', ativo: true });
            setShowModal(true);
          }}
          className="btn-primary"
        >
          ➕ Novo Usuário
        </button>
      </div>

      <div className="table-container animate-fade-in">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Usuário</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              usuarios.map((u, index) => (
                <tr key={u.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                  <td>
                    <div style={{ fontWeight: '500', color: '#FFFFFF' }}>{u.nome}</div>
                  </td>
                  <td style={{ color: '#B0B8C8' }}>@{u.usuario}</td>
                  <td style={{ color: '#B0B8C8' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.perfil === 'ADMIN' ? 'badge-warning' : 'badge-info'}`}>
                      {u.perfil}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.ativo ? 'badge-success' : 'badge-error'}`}>
                      <span className={`status-dot ${u.ativo ? 'success' : 'error'}`}></span>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleEdit(u)}
                        style={{
                          padding: '4px 14px',
                          borderRadius: '6px',
                          background: 'rgba(255, 107, 0, 0.15)',
                          color: '#FF6B00',
                          fontSize: '0.8rem',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 107, 0, 0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 107, 0, 0.15)'}
                      >
                        ✏️ Editar
                      </button>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          style={{
                            padding: '4px 14px',
                            borderRadius: '6px',
                            background: 'rgba(41, 121, 255, 0.15)',
                            color: '#2979FF',
                            fontSize: '0.8rem',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.25)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(41, 121, 255, 0.15)'}
                        >
                          🔑 Reset Senha
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
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
          <div className="card animate-fade-in" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '20px', color: '#FFFFFF' }}>
              {editingUser ? '✏️ Editar Usuário' : '➕ Novo Usuário'}
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div className="input-group">
                <label>Usuário *</label>
                <input
                  type="text"
                  value={formData.usuario}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  placeholder="Nome de usuário"
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div className="input-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              {!editingUser && (
                <div className="input-group">
                  <label>Senha *</label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength="6"
                  />
                </div>
              )}

              <div className="input-group">
                <label>Perfil</label>
                <select
                  value={formData.perfil}
                  onChange={(e) => setFormData({ ...formData, perfil: e.target.value })}
                >
                  <option value="FUNCIONARIO">Funcionário</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              {editingUser && (
                <div className="input-group">
                  <label>Status</label>
                  <select
                    value={formData.ativo ? 'true' : 'false'}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.value === 'true' })}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    setFormData({ nome: '', usuario: '', email: '', senha: '', perfil: 'FUNCIONARIO', ativo: true });
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? '💾 Atualizar' : '💾 Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;