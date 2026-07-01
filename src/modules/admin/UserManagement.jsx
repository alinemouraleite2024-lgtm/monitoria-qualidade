import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, ShieldAlert, Lock, Unlock, Search, CheckCircle2 } from 'lucide-react';
import { getSystemUsers, saveSystemUsers, logAuthEvent, USER_STATUS, ROLES } from '../../auth';

export const UserManagement = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', login: '', password: '', confirmPassword: '',
    role: ROLES.MONITOR, cargo: '', area: '', gestor: '', status: USER_STATUS.ACTIVE,
    photoUrl: '', observacoes: ''
  });

  useEffect(() => {
    setUsers(getSystemUsers());
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("As senhas não coincidem!");
      return;
    }
    
    let newUsers = [...users];
    if (editingUser) {
      newUsers = newUsers.map(u => u.id === editingUser.id ? { ...u, ...formData, id: editingUser.id } : u);
      logAuthEvent('EDIT_USER', currentUser, `Editou o usuário: ${formData.login}`);
    } else {
      const newUser = {
        ...formData,
        id: `usr-${Date.now()}`,
        provider: 'INTERNAL',
        lastAccess: null
      };
      newUsers.push(newUser);
      logAuthEvent('CREATE_USER', currentUser, `Criou o usuário: ${formData.login}`);
    }
    
    setUsers(newUsers);
    saveSystemUsers(newUsers);
    setShowModal(false);
  };

  const handleToggleBlock = (user) => {
    const isBlocked = user.status === USER_STATUS.BLOCKED;
    const newStatus = isBlocked ? USER_STATUS.ACTIVE : USER_STATUS.BLOCKED;
    const newUsers = users.map(u => u.id === user.id ? { ...u, status: newStatus } : u);
    setUsers(newUsers);
    saveSystemUsers(newUsers);
    logAuthEvent(isBlocked ? 'UNBLOCK_USER' : 'BLOCK_USER', currentUser, `Usuário ${user.login} ${isBlocked ? 'desbloqueado' : 'bloqueado'}`);
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.login?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Gestão de Usuários</h1>
          <p className="page-subtitle">Controle de acesso à plataforma (Login Interno)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingUser(null); setFormData({name: '', email: '', login: '', password: '', confirmPassword: '', role: ROLES.MONITOR, cargo: '', area: '', gestor: '', status: USER_STATUS.ACTIVE, photoUrl: '', observacoes: ''}); setShowModal(true); }}>
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div className="section-card">
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
          <div className="search-box" style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1rem' }}>
            <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
            <input type="text" placeholder="Buscar usuários..." style={{ border: 'none', background: 'transparent', flex: 1, color: 'var(--text-main)', outline: 'none' }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Usuário</th>
                <th style={{ padding: '1rem' }}>Login</th>
                <th style={{ padding: '1rem' }}>Perfil</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Último Acesso</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{user.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{user.email}</div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{user.login}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className="badge-pill badge-info">{user.role}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {user.status === USER_STATUS.ACTIVE ? <span className="badge-pill badge-success">Ativo</span> : 
                     user.status === USER_STATUS.INACTIVE ? <span className="badge-pill badge-warning">Inativo</span> : 
                     <span className="badge-pill badge-danger">Bloqueado</span>}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {user.lastAccess ? new Date(user.lastAccess).toLocaleString('pt-BR') : 'Nunca acessou'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => { setEditingUser(user); setFormData({...user, password: '', confirmPassword: ''}); setShowModal(true); }}>
                      <Edit size={16} />
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem', color: user.status === USER_STATUS.BLOCKED ? 'var(--success)' : 'var(--danger)' }} onClick={() => handleToggleBlock(user)}>
                      {user.status === USER_STATUS.BLOCKED ? <Unlock size={16} /> : <Lock size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div><label className="form-label">Nome Completo</label><input required className="form-control" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div><label className="form-label">E-mail</label><input type="email" required className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div><label className="form-label">Login</label><input required className="form-control" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} /></div>
                <div><label className="form-label">Status</label>
                  <select className="form-control" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value={USER_STATUS.ACTIVE}>Ativo</option>
                    <option value={USER_STATUS.INACTIVE}>Inativo</option>
                    <option value={USER_STATUS.BLOCKED}>Bloqueado</option>
                  </select>
                </div>
                <div><label className="form-label">Senha {editingUser && '(deixe em branco para manter)'}</label><input type="password" required={!editingUser} className="form-control" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                <div><label className="form-label">Confirmar Senha</label><input type="password" required={!editingUser} className="form-control" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} /></div>
                <div><label className="form-label">Perfil</label>
                  <select className="form-control" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Gestor Responsável</label><input className="form-control" value={formData.gestor} onChange={e => setFormData({...formData, gestor: e.target.value})} /></div>
                <div><label className="form-label">Cargo</label><input className="form-control" value={formData.cargo} onChange={e => setFormData({...formData, cargo: e.target.value})} /></div>
                <div><label className="form-label">Área</label><input className="form-control" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} /></div>
              </div>
              <div>
                <label className="form-label">Observações</label>
                <textarea className="form-control" rows="3" value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
