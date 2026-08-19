export const PlanningScreen = ({
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  colaboradorGoals = /** @type {import('../../types/domain').ColaboradorGoal[]} */ ([]),
  newMGoalVal,
  setNewMGoalVal,
  newCGoalVal,
  setNewCGoalVal,
  onUpdateMonitorGoal,
  onUpdateColabGoal,
  getMonitors,
  getCollaborators,
  renderUserAvatar
}) => (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1 className="page-title">Planejamento e Metas Operacionais</h1>
                <p className="page-subtitle">Configure as metas globais dos monitores e os volumes individuais dos colaboradores.</p>
              </div>
            </div>

            <div className="allocation-manager-grid">
              
              {/* Goal configurations */}
              <div className="section-card">
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                  Configurar Metas de Carteira
                </h3>

                <form onSubmit={onUpdateMonitorGoal} style={{ marginBottom: '2rem' }}>
                  <div className="form-group">
                    <label className="form-label">Monitor Avaliador</label>
                    <select 
                      className="form-control"
                      value={newMGoalVal.monitorId}
                      onChange={(e) => setNewMGoalVal({ ...newMGoalVal, monitorId: e.target.value })}
                    >
                      {getMonitors().filter(m => m.role === 'MONITOR').map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Meta Global (Volume Mensal)</label>
                    <input 
                      type="number" 
                      className="form-control"
                      value={newMGoalVal.targetQty}
                      onChange={(e) => setNewMGoalVal({ ...newMGoalVal, targetQty: e.target.value })}
                      min="1"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Atualizar Meta Carteira
                  </button>
                </form>

                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: '2rem 0 1.25rem', fontWeight: 'bold', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  Configurar Metas Individuais (Colaborador)
                </h3>

                <form onSubmit={onUpdateColabGoal}>
                  <div className="form-group">
                    <label className="form-label">Monitor Responsável</label>
                    <select 
                      className="form-control"
                      value={newCGoalVal.monitorId}
                      onChange={(e) => setNewCGoalVal({ ...newCGoalVal, monitorId: e.target.value })}
                    >
                      {getMonitors().filter(m => m.role === 'MONITOR').map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Colaborador</label>
                    <select 
                      className="form-control"
                      value={newCGoalVal.colaboradorId}
                      onChange={(e) => setNewCGoalVal({ ...newCGoalVal, colaboradorId: e.target.value })}
                    >
                      {getCollaborators().map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Volume de Monitorias Exigido</label>
                    <input 
                      type="number" 
                      className="form-control"
                      value={newCGoalVal.targetQty}
                      onChange={(e) => setNewCGoalVal({ ...newCGoalVal, targetQty: e.target.value })}
                      min="1"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Atualizar Meta Colaborador
                  </button>
                </form>
              </div>

              {/* Meta list panel */}
              <div className="section-card">
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                  Quadro de Metas Ativo (Junho/2026)
                </h3>

                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Monitor</th>
                        <th>Colaborador</th>
                        <th>Meta</th>
                        <th>Realizadas</th>
                        <th>Pendentes</th>
                        <th>Progresso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradorGoals.map(goal => {
                        const mon = users.find(u => u.id === goal.monitorId)?.name || 'N/A';
                        const col = users.find(u => u.id === goal.colaboradorId)?.name || 'N/A';

                        const completed = monitorings.filter(m => {
                          const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
                          return m.monitorId === goal.monitorId && m.colaboradorId === goal.colaboradorId && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
                        }).length;

                        return (
                          <tr key={goal.id}>
                            <td>
                              <div className="user-cell-wrapper">
                                {renderUserAvatar(mon)}
                                <span>{mon}</span>
                              </div>
                            </td>
                            <td>
                              <div className="user-cell-wrapper">
                                {renderUserAvatar(col)}
                                <span>{col}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 'bold' }}>{goal.targetQty}</td>
                            <td style={{ fontWeight: 'bold' }}>{completed}</td>
                            <td>{Math.max(0, goal.targetQty - completed)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="progress-container" style={{ width: '80px', margin: 0, height: '4px' }}>
                                  <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((completed/goal.targetQty)*100))}%`, backgroundColor: completed >= goal.targetQty ? '#10b981' : 'var(--primary)' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{Math.min(100, Math.round((completed/goal.targetQty)*100))}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
);
