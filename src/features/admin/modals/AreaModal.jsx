import { temPerfil } from '../../../domain/perfis';

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
            {users.filter(u => temPerfil(u, 'GESTOR')).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Era um select único ("Monitor Principal") até a 0.16.0. Uma área pode ter vários
            monitores, e o singular chegava a colapsar a equipe inteira no filtro do Dashboard. */}
        <div className="form-group">
          <label className="form-label">Monitores da Área</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
            {users.filter(u => temPerfil(u, 'MONITOR')).map(u => {
              const marcado = (newArea.monitorIds || []).includes(u.id);
              return (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => setNewArea({
                      ...newArea,
                      monitorIds: marcado
                        ? (newArea.monitorIds || []).filter(id => id !== u.id)
                        : [...(newArea.monitorIds || []), u.id],
                    })}
                  />
                  {u.name}
                </label>
              );
            })}
            {users.filter(u => temPerfil(u, 'MONITOR')).length === 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Nenhum monitor cadastrado. Cadastre em Usuários antes de compor a área.
              </span>
            )}
          </div>
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
