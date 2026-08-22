import { isInPeriod } from '../../domain/period';
import { countsForCarteiraGoal, isValidated } from '../../domain/monitoringRules';

export const PlanningScreen = ({
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  colaboradorGoals = /** @type {import('../../types/domain').ColaboradorGoal[]} */ ([]),
  periodoAtual,
  periodoLabel,
  newCGoalVal,
  setNewCGoalVal,
  onUpdateColabGoal,
  getMonitors,
  getCollaborators,
  renderUserAvatar
}) => (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1 className="page-title">Planejamento e Metas Operacionais</h1>
                <p className="page-subtitle">Defina quantas monitorias cada colaboradora deve receber na competência de {periodoLabel}.</p>
              </div>
            </div>

            <div className="allocation-manager-grid">
              
              {/* Goal configurations */}
              <div className="section-card">
                {/* 2A.4: havia aqui um formulário de "Meta Global (Volume Mensal)" por
                    monitor. Ele concorria com a meta por colaboradora e o sistema resolvia o
                    conflito escolhendo a maior das duas, sem dizer qual. Com a meta por
                    colaboradora como fonte única, o formulário saiu: pedir um número que o
                    sistema não usa é pior do que não pedir nada. */}
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                  Meta por colaboradora — {periodoLabel}
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
                    Salvar meta de {periodoLabel}
                  </button>
                </form>
              </div>

              {/* Meta list panel */}
              <div className="section-card">
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                  Quadro de Metas Ativo ({periodoLabel})
                </h3>

                {colaboradorGoals.filter(g => g.year === periodoAtual.year && g.month === periodoAtual.month).length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 1rem' }}>
                    Sem meta definida para o período.
                  </p>
                )}

                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Monitor</th>
                        <th>Colaborador</th>
                        <th>Meta</th>
                        <th>Realizadas</th>
                        <th>Validadas</th>
                        <th>Pendentes</th>
                        <th>Progresso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colaboradorGoals
                        .filter(goal => goal.year === periodoAtual.year && goal.month === periodoAtual.month)
                        .map(goal => {
                        const mon = users.find(u => u.id === goal.monitorId)?.name || 'N/A';
                        const col = users.find(u => u.id === goal.colaboradorId)?.name || 'N/A';

                        // Feito conta no envio; validado aparece à parte, na coluna ao lado.
                        const feitas = monitorings.filter(m =>
                          m.monitorId === goal.monitorId
                          && m.colaboradorId === goal.colaboradorId
                          && isInPeriod(m.date, periodoAtual)
                          && countsForCarteiraGoal(m)
                        );
                        const completed = feitas.length;
                        const validadas = feitas.filter(isValidated).length;

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
                            <td style={{ color: 'var(--text-muted)' }}>{validadas}</td>
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
