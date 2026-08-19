export const UserModal = ({
  users = /** @type {import('../../../types/domain').User[]} */ ([]),
  setUsers,
  newUser,
  setNewUser,
  setShowUserModal
}) => (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '450px' }}>
      <div className="modal-header">
        <h3 className="modal-title">Registrar Novo Usuário</h3>
        <button className="modal-close" onClick={() => setShowUserModal(false)}>&times;</button>
      </div>

      <form onSubmit={(e) => {
        e.preventDefault();
        if (!newUser.email || !newUser.name) {
          alert('Preencha os campos obrigatórios.');
          return;
        }
        setUsers([...users, {
          id: `usr-${Date.now()}`,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          team: newUser.role === 'COLABORADOR' ? newUser.team : '',
          active: true
        }]);
        setShowUserModal(false);
        setNewUser({ email: '', name: '', role: 'MONITOR', team: '' });
      }}>
        <div className="form-group">
          <label className="form-label">Nome Completo*</label>
          <input 
            type="text" 
            className="form-control"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">E-mail Corporativo M365*</label>
          <input 
            type="email" 
            className="form-control"
            placeholder="nome@mouraleite.com.br"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nível de Acesso (Role)</label>
            <select 
              className="form-control"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="MONITOR">Monitor</option>
              <option value="GESTOR">Gestor</option>
              <option value="ADMIN">Administrador</option>
              <option value="COLABORADOR">Colaborador (Agente)</option>
            </select>
          </div>

          {newUser.role === 'COLABORADOR' && (
            <div className="form-group">
              <label className="form-label">Equipe</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Ex: Vendas"
                value={newUser.team}
                onChange={(e) => setNewUser({ ...newUser, team: e.target.value })}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Registrar Usuário
          </button>
        </div>
      </form>
    </div>
  </div>
);
