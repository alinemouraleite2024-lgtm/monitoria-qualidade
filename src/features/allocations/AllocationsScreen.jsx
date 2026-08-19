export const AllocationsScreen = ({
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  allocations = /** @type {import('../../types/domain').Allocation[]} */ ([]),
  allocationHistory = /** @type {import('../../types/domain').AllocationHistoryEntry[]} */ ([]),
  selectedAllocationMonitor,
  setSelectedAllocationMonitor,
  newAllocColaboradorId,
  setNewAllocColaboradorId,
  newAllocStartDate,
  setNewAllocStartDate,
  newAllocEndDate,
  setNewAllocEndDate,
  onCreateAllocation,
  onTerminateAllocation,
  getMonitors,
  getCollaborators,
  renderUserAvatar
}) => (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1 className="page-title">Vigência de Carteira e Alocações</h1>
                <p className="page-subtitle">Configure o vínculo operacional temporário entre monitores e agentes.</p>
              </div>
            </div>

            <div className="allocation-manager-grid">
              
              {/* Allocation creation panel */}
              <div className="section-card">
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                  Vincular Carteira com Vigência
                </h3>

                <form onSubmit={onCreateAllocation}>
                  <div className="form-group">
                    <label className="form-label">Monitor Responsável</label>
                    <select 
                      className="form-control"
                      value={selectedAllocationMonitor}
                      onChange={(e) => setSelectedAllocationMonitor(e.target.value)}
                    >
                      {getMonitors().filter(m => m.role === 'MONITOR').map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Colaborador (Agente)</label>
                    <select 
                      className="form-control"
                      value={newAllocColaboradorId}
                      onChange={(e) => setNewAllocColaboradorId(e.target.value)}
                      required
                    >
                      <option value="">Selecione...</option>
                      {getCollaborators().map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Data Início</label>
                      <input 
                        type="date" 
                        className="form-control"
                        value={newAllocStartDate}
                        onChange={(e) => setNewAllocStartDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Data Término (Opcional)</label>
                      <input 
                        type="date" 
                        className="form-control"
                        value={newAllocEndDate}
                        onChange={(e) => setNewAllocEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Adicionar Vínculo
                  </button>
                </form>
              </div>

              {/* Active allocations and history */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                    Vínculos Ativos Vigentes
                  </h3>

                  <div className="table-responsive" style={{ maxHeight: '200px' }}>
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th>Monitor</th>
                          <th>Colaborador</th>
                          <th>Início</th>
                          <th>Término</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.filter(a => a.active).map(a => {
                          const mon = users.find(u => u.id === a.monitorId)?.name || 'N/A';
                          const col = users.find(u => u.id === a.colaboradorId)?.name || 'N/A';
                          return (
                            <tr key={a.id}>
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
                              <td>{new Date(a.startDate).toLocaleDateString('pt-BR')}</td>
                              <td>{a.endDate ? new Date(a.endDate).toLocaleDateString('pt-BR') : 'Indeterminado'}</td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => onTerminateAllocation(a.id)}>
                                  Terminar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Log History */}
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                    Histórico de Auditoria de Carteiras
                  </h3>
                  <div className="log-audit-list">
                    {allocationHistory.slice().reverse().map(log => {
                      const authorObj = users.find(u => u.id === log.changedBy);
                      const author = authorObj ? authorObj.name : 'Sistema';
                      return (
                        <div key={log.id} className="log-audit-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            <span>Operação: {log.actionType} | Autor: {author}</span>
                            <span>{new Date(log.changedAt).toLocaleString('pt-BR')}</span>
                          </div>
                          <div style={{ marginTop: '0.15rem', color: 'var(--text-main)', fontSize: '0.78rem' }}>{log.details}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>
);
