import { FileSpreadsheet, CheckCircle2, AlertTriangle, Layers, Award, TrendingUp, Clock } from 'lucide-react';
import { isInPeriod } from '../../domain/period';
import { countsForCarteiraGoal } from '../../domain/monitoringRules';

export const DashboardScreen = ({
  settings,
  areas = /** @type {import('../../types/domain').Area[]} */ ([]),
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  colaboradorGoals = /** @type {import('../../types/domain').ColaboradorGoal[]} */ ([]),
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  currentUser,
  dashboardAreaId,
  setDashboardAreaId,
  onNavigate,
  setShowDetailModal,
  setSelectedMonitoringDetail,
  renderUserAvatar,
  getCollaborators,
  getMonitors,
  getMonitorStats,
  getActiveMonitorForColab,
  getUnmonitoredCollaborators,
  businessDaysRemaining,
  hoje,
  periodoAtual,
  periodoLabel
}) => (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1 className="page-title">
                  {currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN' ? 'Dashboard Executivo de Qualidade' : 'Painel Operacional do Monitor'}
                </h1>
                <p className="page-subtitle">Produtividade, cumprimento de metas e fluxo das avaliações — competência de {periodoLabel}.</p>
              </div>
              { (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Filtrar por Área:</label>
                  <select 
                    className="form-control"
                    value={dashboardAreaId}
                    onChange={(e) => setDashboardAreaId(e.target.value)}
                    style={{ width: 'auto', minWidth: '200px' }}
                  >
                    <option value="ALL">Visão Global (Todas)</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Approval Queue Slider Notification */}
            {settings.requireGestorValidation && (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && monitorings.some(m => m.status === 'Concluída') && (
              <div className="section-card animate-fade-in" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--primary-light)' }}>
                <h3 className="section-card-title" style={{ color: 'var(--primary)', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={18} /> Há avaliações pendentes de validação operacional!
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={() => onNavigate('monitorings')} style={{ padding: '0.25rem 0.75rem' }}>
                    Ver Fila de Validação
                  </button>
                </h3>
              </div>
            )}

            {(() => {
              // Common data fetch
              const isGestor = currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN';
              
              // Calculate KPIs
              let totalRealizadas = 0;
              let totalMeta = 0;
              let unmonitoredCount = 0;
              let pace = 0;
              
              if (isGestor) {
                // Gestor stats across all monitors, filtered by area if selected
                let allMonitors = getMonitors().filter(m => m.role === 'MONITOR');
                if (dashboardAreaId !== 'ALL') {
                  const area = areas.find(a => a.id === dashboardAreaId);
                  if (area && area.monitorId) {
                    allMonitors = allMonitors.filter(m => m.id === area.monitorId);
                  }
                }
                
                allMonitors.forEach(m => {
                  const s = getMonitorStats(m.id);
                  totalRealizadas += s.completed;
                  totalMeta += s.target;
                });
                
                let colabs = getUnmonitoredCollaborators();
                if (dashboardAreaId !== 'ALL') {
                  colabs = colabs.filter(c => c.areaId === dashboardAreaId);
                }
                unmonitoredCount = colabs.length;
                pace = Math.ceil((totalMeta - totalRealizadas) / Math.max(businessDaysRemaining, 1));
              } else {
                const stats = getMonitorStats(currentUser.id);
                totalRealizadas = stats.completed;
                totalMeta = stats.target;
                // Monitor's unmonitored colabs
                const myColabs = getCollaborators().filter(c => {
                  const { monitor } = getActiveMonitorForColab(c.id, hoje);
                  return monitor && monitor.id === currentUser.id;
                });
                const myUnmonitored = myColabs.filter(c => {
                  const done = monitorings.filter(m => m.colaboradorId === c.id && m.monitorId === currentUser.id && isInPeriod(m.date, periodoAtual) && countsForCarteiraGoal(m));
                  return done.length === 0;
                });
// eslint-disable-next-line no-unused-vars
                unmonitoredCount = myUnmonitored.length;
                pace = stats.pace;
              }
              
              const pendentes = Math.max(0, totalMeta - totalRealizadas);
              const cobertura = totalMeta > 0 ? Math.min(100, Math.round((totalRealizadas / totalMeta) * 100)) : 0;
              
              // 1. KPI Cards Row
              return (
                <div className="dashboard-main">
                  <div className="kpi-grid-5">
                    <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="card-horiz-info">
                          <span className="card-horiz-title">Realizadas</span>
                          <span className="card-horiz-value">{totalRealizadas}</span>
                        </div>
                        <div className="card-horiz-icon success"><CheckCircle2 size={18} /></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          <span>{totalRealizadas} / {totalMeta} concluídas</span>
                          <span>{cobertura}%</span>
                        </div>
                        <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                          <div className="progress-fill" style={{ width: `${cobertura}%`, backgroundColor: 'var(--success)' }} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="card-horiz-info">
                          <span className="card-horiz-title">Meta Mensal</span>
                          <span className="card-horiz-value">{totalMeta}</span>
                        </div>
                        <div className="card-horiz-icon info"><TrendingUp size={18} /></div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        Projeção de meta do ciclo.
                      </div>
                    </div>
                    
                    <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="card-horiz-info">
                          <span className="card-horiz-title">Pendentes</span>
                          <span className="card-horiz-value">{pendentes}</span>
                        </div>
                        <div className="card-horiz-icon warning"><AlertTriangle size={18} /></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          <span>Restantes no mês</span>
                          <span>{100 - cobertura}%</span>
                        </div>
                        <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                          <div className="progress-fill" style={{ width: `${100 - cobertura}%`, backgroundColor: 'var(--warning)' }} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="card-horiz-info">
                          <span className="card-horiz-title">Ritmo Diário</span>
                          <span className="card-horiz-value">{pace}/dia</span>
                        </div>
                        <div className="card-horiz-icon primary"><Clock size={18} /></div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        Para bater a meta no prazo.
                      </div>
                    </div>
                    
                    <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="card-horiz-info">
                          <span className="card-horiz-title">Cobertura</span>
                          <span className="card-horiz-value">{cobertura}%</span>
                        </div>
                        <div className="card-horiz-icon primary"><Layers size={18} /></div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        Progresso total da equipe.
                      </div>
                    </div>
                  </div>

                  {/* 2. Multipanel Split Screen */}
                  <div className="dashboard-split">
                    
                    {/* Left Column (Charts and Table) */}
                    <div className="dashboard-main">
                      
                      <div className="charts-row">
                        {/* Evolução Mensal Line Area Chart */}
                        <div className="section-card" style={{ display: 'flex', flexDirection: 'column' }}>
                          <h2 className="section-card-title"><TrendingUp size={18} /> Evolução Mensal</h2>
                          <div style={{ flex: 1, position: 'relative', height: '180px', marginTop: '1rem' }}>
                            <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path d="M 0,90 Q 50,40 100,50 T 200,20 T 300,30 L 300,100 L 0,100 Z" fill="url(#areaGradient)" />
                              <path d="M 0,90 Q 50,40 100,50 T 200,20 T 300,30" fill="none" stroke="var(--primary)" strokeWidth="3" />
                              <circle cx="200" cy="20" r="4" fill="var(--primary)" stroke="#fff" strokeWidth="2" />
                              <circle cx="300" cy="30" r="4" fill="var(--primary)" stroke="#fff" strokeWidth="2" />
                            </svg>
                          </div>
                        </div>
                        
                        {/* Cumprimento Meta Horizontal Stacked Chart */}
                        <div className="section-card" style={{ display: 'flex', flexDirection: 'column' }}>
                          <h2 className="section-card-title"><Award size={18} /> Progresso x Meta Total</h2>
                          <div style={{ flex: 1, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{totalRealizadas}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monitorias Concluídas</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{totalMeta}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Meta do Ciclo</div>
                              </div>
                            </div>
                            
                            <div>
                              <div style={{ width: '100%', height: '24px', backgroundColor: 'var(--bg-hover)', borderRadius: '12px', overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${cobertura}%`, backgroundColor: 'var(--primary)', height: '100%', transition: 'width 1s ease' }}></div>
                                <div style={{ width: `${100 - cobertura}%`, backgroundColor: 'var(--warning-light)', height: '100%', transition: 'width 1s ease' }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: '600' }}>
                                <span style={{ color: 'var(--primary)' }}>{cobertura}% Atingido</span>
                                <span style={{ color: 'var(--warning-dark)' }}>{pendentes} Faltantes</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Planejamento */}
                      <div className="section-card">
                        <h2 className="section-card-title">
                          <FileSpreadsheet size={18} /> Planejamento do Mês
                        </h2>
                        <div className="table-responsive">
                          <table className="table-premium">
                            <thead>
                              <tr>
                                <th>{isGestor ? 'Monitor' : 'Colaborador'}</th>
                                <th>Meta</th>
                                <th>Realizadas</th>
                                <th>Pendentes</th>
                                <th>Progresso</th>
                              </tr>
                            </thead>
                            <tbody>
                              {isGestor ? (
                                getMonitors().filter(m => m.role === 'MONITOR').map(monitor => {
                                  const s = getMonitorStats(monitor.id);
                                  return (
                                    <tr key={monitor.id}>
                                      <td>
                                        <div className="user-cell-wrapper">
                                          {renderUserAvatar(monitor.name)}
                                          <span style={{ fontWeight: '600' }}>{monitor.name}</span>
                                        </div>
                                      </td>
                                      {s.hasGoal ? (
                                        <>
                                          <td style={{ fontWeight: 'bold' }}>{s.target}</td>
                                          <td style={{ fontWeight: 'bold' }}>
                                            {s.completed}
                                            {s.completed > 0 && (
                                              <span style={{ fontWeight: '500', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                                                ({s.validated} validadas)
                                              </span>
                                            )}
                                          </td>
                                          <td>{s.remaining}</td>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <div className="progress-container" style={{ width: '80px', margin: 0, height: '5px' }}>
                                                <div className="progress-fill" style={{ width: `${s.progressPct}%`, backgroundColor: 'var(--primary)' }} />
                                              </div>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{s.progressPct}%</span>
                                            </div>
                                          </td>
                                        </>
                                      ) : (
                                        <td colSpan={4} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                          Sem meta definida para o período
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })
                              ) : (
                                getCollaborators().filter(c => {
                                  const { monitor } = getActiveMonitorForColab(c.id, hoje);
                                  return monitor && monitor.id === currentUser.id;
                                }).map(c => {
                                  const completed = monitorings.filter(m => m.colaboradorId === c.id && m.monitorId === currentUser.id && isInPeriod(m.date, periodoAtual) && countsForCarteiraGoal(m)).length;
                                  // 2A.2: sem `|| 5`. A ausência de meta é informada, não preenchida com um número.
                                  const goal = colaboradorGoals.find(g => g.monitorId === currentUser.id && g.colaboradorId === c.id && g.year === periodoAtual.year && g.month === periodoAtual.month);
                                  const goalVal = goal ? goal.targetQty : null;
                                  const prog = goalVal ? Math.min(100, Math.round((completed / goalVal) * 100)) : 0;
                                  return (
                                    <tr key={c.id}>
                                      <td>
                                        <div className="user-cell-wrapper">
                                          {renderUserAvatar(c.name)}
                                          <span style={{ fontWeight: '600' }}>{c.name}</span>
                                        </div>
                                      </td>
                                      {goalVal === null ? (
                                        <td colSpan={4} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                          Sem meta definida para o período
                                          {completed > 0 && ` — ${completed} monitoria(s) já registrada(s)`}
                                        </td>
                                      ) : (
                                        <>
                                          <td style={{ fontWeight: 'bold' }}>{goalVal}</td>
                                          <td style={{ fontWeight: 'bold' }}>{completed}</td>
                                          <td>{Math.max(0, goalVal - completed)}</td>
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <div className="progress-container" style={{ width: '80px', margin: 0, height: '4px' }}>
                                                <div className="progress-fill" style={{ width: `${prog}%`, backgroundColor: prog >= 100 ? '#10b981' : 'var(--primary)' }} />
                                              </div>
                                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{prog}%</span>
                                            </div>
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>

                    {/* Right Column (Timeline) */}
                    <div className="dashboard-sidebar">
                      <div className="section-card" style={{ flex: 1 }}>
                        <h2 className="section-card-title">
                          <Clock size={18} /> Últimas Monitorias
                        </h2>
                        
                        <ul className="timeline-root" style={{ marginTop: '1.5rem' }}>
                          {(() => {
                            let recentMon = isGestor 
                              ? [...monitorings]
                              : monitorings.filter(m => m.monitorId === currentUser.id);
                            recentMon.sort((a,b) => new Date(b.date) - new Date(a.date));
                            
                            if (recentMon.length === 0) {
                              return <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sem atividades recentes.</li>;
                            }
                            
                            return recentMon.slice(0, 5).map(m => {
                              const colName = users.find(u => u.id === m.colaboradorId)?.name || 'N/A';
                              const isHigh = m.finalScore >= 95;
                              const isLow = m.finalScore < 75;
                              const nodeClass = isHigh ? 'success' : (isLow ? 'danger' : 'warning');
                              
                              return (
                                <li key={m.id} className="timeline-item">
                                  <div className={`timeline-node ${nodeClass}`}></div>
                                  <div className="timeline-content" style={{ cursor: 'pointer' }} onClick={() => {
                                    setSelectedMonitoringDetail(m);
                                    setShowDetailModal(true);
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{colName}</div>
                                      <div style={{ fontWeight: '800', color: isHigh ? 'var(--primary)' : (isLow ? 'var(--danger)' : 'var(--warning)') }}>
                                        {m.finalScore.toFixed(2)}%
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                      Status: <strong style={{ color: 'var(--text-main)' }}>{m.status}</strong> • Canal: {m.canal}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                      {new Date(m.date).toLocaleString('pt-BR')}
                                    </div>
                                  </div>
                                </li>
                              );
                            });
                          })()}
                        </ul>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })()}
          </div>
);
