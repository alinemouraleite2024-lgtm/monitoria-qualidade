export const CollaboratorModal = ({
  areas = /** @type {import('../../../types/domain').Area[]} */ ([]),
  newCollaborator,
  setNewCollaborator,
  setShowCollaboratorModal,
  onSave
}) => (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '450px' }}>
      <div className="modal-header">
        <h3 className="modal-title">{newCollaborator.id ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}</h3>
        <button className="modal-close" onClick={() => setShowCollaboratorModal(false)}>&times;</button>
      </div>

      <form onSubmit={onSave}>
        <div className="form-group">
          <label className="form-label">Nome Completo*</label>
          <input 
            type="text" 
            className="form-control"
            value={newCollaborator.name}
            onChange={(e) => setNewCollaborator({ ...newCollaborator, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">E-mail Corporativo</label>
          <input 
            type="email" 
            className="form-control"
            value={newCollaborator.email}
            onChange={(e) => setNewCollaborator({ ...newCollaborator, email: e.target.value })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Cargo</label>
            <input 
              type="text" 
              className="form-control"
              value={newCollaborator.cargo}
              onChange={(e) => setNewCollaborator({ ...newCollaborator, cargo: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Área*</label>
            <select 
              className="form-control"
              value={newCollaborator.areaId}
              onChange={(e) => setNewCollaborator({ ...newCollaborator, areaId: e.target.value })}
              required
            >
              <option value="">Selecione...</option>
              {areas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="switch-group">
          <label className="form-label" style={{ margin: 0 }}>Colaborador Ativo</label>
          <input 
            type="checkbox"
            style={{ height: '18px', width: '18px', cursor: 'pointer' }}
            checked={newCollaborator.active}
            onChange={(e) => setNewCollaborator({ ...newCollaborator, active: e.target.checked })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowCollaboratorModal(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    </div>
  </div>
);
