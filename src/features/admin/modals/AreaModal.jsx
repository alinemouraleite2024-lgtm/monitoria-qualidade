export const AreaModal = ({
  users = /** @type {import('../../../types/domain').User[]} */ ([]),
  newArea,
  setNewArea,
  setShowAreaModal,
  onSave
}) => (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '450px' }}>
      <div className="modal-header">
        <h3 className="modal-title">{newArea.id ? 'Editar Área' : 'Cadastrar Nova Área'}</h3>
        <button className="modal-close" onClick={() => setShowAreaModal(false)}>&times;</button>
      </div>

      <form onSubmit={onSave}>
        <div className="form-group">
          <label className="form-label">Nome da Área*</label>
          <input 
            type="text" 
            className="form-control"
            value={newArea.name}
            onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Gestor Responsável</label>
          <select 
            className="form-control"
            value={newArea.gestorId}
            onChange={(e) => setNewArea({ ...newArea, gestorId: e.target.value })}
          >
            <option value="">Selecione...</option>
            {users.filter(u => u.role === 'GESTOR' || u.role === 'ADMIN').map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Monitor Principal</label>
          <select 
            className="form-control"
            value={newArea.monitorId}
            onChange={(e) => setNewArea({ ...newArea, monitorId: e.target.value })}
          >
            <option value="">Selecione...</option>
            {users.filter(u => u.role === 'MONITOR' || u.role === 'ADMIN').map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="switch-group">
          <label className="form-label" style={{ margin: 0 }}>Área Ativa</label>
          <input 
            type="checkbox"
            style={{ height: '18px', width: '18px', cursor: 'pointer' }}
            checked={newArea.active}
            onChange={(e) => setNewArea({ ...newArea, active: e.target.checked })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowAreaModal(false)}>
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
