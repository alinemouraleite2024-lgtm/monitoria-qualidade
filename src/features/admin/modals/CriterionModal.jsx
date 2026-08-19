import { CRITERION_CATEGORIES, RESPONSE_TYPES, CHANNELS } from '../../../constants/criteria';

export const CriterionModal = ({
  newCriterion,
  setNewCriterion,
  setShowCriterionModal,
  onSave
}) => (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '500px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          {newCriterion.id ? 'Editar Critério' : 'Cadastrar Novo Critério'}
        </h3>
        <button className="modal-close" onClick={() => setShowCriterionModal(false)}>&times;</button>
      </div>

      <form onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: '120px' }}>
            <label className="form-label">Nº</label>
            <input
              type="number"
              min="1"
              max="28"
              className="form-control"
              placeholder="1-28"
              value={newCriterion.numero || ''}
              onChange={(e) => setNewCriterion({ ...newCriterion, numero: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria*</label>
            <select
              className="form-control"
              value={newCriterion.category || ''}
              onChange={(e) => setNewCriterion({ ...newCriterion, category: e.target.value })}
              required
            >
              <option value="" disabled>Selecione...</option>
              {CRITERION_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nome do Critério*</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ex: Comunicação"
            value={newCriterion.name}
            onChange={(e) => setNewCriterion({ ...newCriterion, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea
            rows="3"
            className="form-control"
            placeholder="Descreva o escopo do critério..."
            value={newCriterion.description}
            onChange={(e) => setNewCriterion({ ...newCriterion, description: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Orientação (rubrica oficial para o monitor)</label>
          <textarea
            rows="4"
            className="form-control"
            placeholder="Texto de orientação exibido ao monitor durante a avaliação..."
            value={newCriterion.orientacao || ''}
            onChange={(e) => setNewCriterion({ ...newCriterion, orientacao: e.target.value })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tipo de Resposta*</label>
            <select
              className="form-control"
              value={newCriterion.tipoResposta || 'ESCALA_4'}
              onChange={(e) => setNewCriterion({ ...newCriterion, tipoResposta: e.target.value })}
              required
            >
              {RESPONSE_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div className="switch-group" style={{ alignSelf: 'flex-end' }}>
            <label className="form-label" style={{ margin: 0 }}>Critério Eliminatório</label>
            <input
              type="checkbox"
              style={{ height: '18px', width: '18px', cursor: 'pointer' }}
              checked={!!newCriterion.eliminatorio}
              onChange={(e) => setNewCriterion({ ...newCriterion, eliminatorio: e.target.checked })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nota Mínima Esperada</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              className="form-control"
              value={newCriterion.minExpectedScore}
              onChange={(e) => setNewCriterion({ ...newCriterion, minExpectedScore: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Peso do Critério</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="form-control"
              value={newCriterion.weight}
              onChange={(e) => setNewCriterion({ ...newCriterion, weight: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Canais Aplicáveis</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
            {CHANNELS.map(chan => {
              const isChecked = newCriterion.channels.includes(chan);
              return (
                <label key={chan} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const updatedChans = isChecked 
                        ? newCriterion.channels.filter(c => c !== chan) 
                        : [...newCriterion.channels, chan];
                      setNewCriterion({ ...newCriterion, channels: updatedChans });
                    }}
                  />
                  {chan}
                </label>
              );
            })}
          </div>
        </div>

        <div className="switch-group">
          <label className="form-label" style={{ margin: 0 }}>Critério Ativo</label>
          <input 
            type="checkbox"
            style={{ height: '18px', width: '18px', cursor: 'pointer' }}
            checked={newCriterion.active}
            onChange={(e) => setNewCriterion({ ...newCriterion, active: e.target.checked })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowCriterionModal(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar Critério
          </button>
        </div>
      </form>
    </div>
  </div>
);
