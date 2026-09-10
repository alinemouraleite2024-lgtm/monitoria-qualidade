import { SeletorCompetencia } from '../../shared/components/SeletorCompetencia';
import { FileSpreadsheet, CheckCircle2, AlertTriangle, Layers, Award, TrendingUp, Clock } from 'lucide-react';
import { getMetaDaColaboradora, getEscoposDaColaboradora } from '../../domain/goalService';
import { canalLabel } from '../../constants/canais';
import { getEquipeDoGestor } from '../../domain/scopeService';

export const DashboardScreen = ({
  settings,
  areas = /** @type {import('../../types/domain').Area[]} */ ([]),
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  colaboradorGoals = /** @type {import('../../types/domain').ColaboradorGoal[]} */ ([]),
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  currentUser,
  perfilAtivo,
  dashboardAreaId,
  setDashboardAreaId,
  onNavigate,
  setShowDetailModal,
  setSelectedMonitoringDetail,
  renderUserAvatar,
  getMonitors,
  getMonitorStats,
  getUnmonitoredCollaborators,
  getCarteiraDe,
  businessDaysRemaining,
  periodoAtual,
  periodoLabel,
  onPeriodoChange
}) => (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1 className="page-title">
                  {perfilAtivo === 'GESTOR' || perfilAtivo === 'ADMIN' ? 'Dashboard Executivo de Qualidade' : 'Painel Operacional do Monitor'}
                </h1>
                <p className="page-subtitle">Produtividade, cumprimento de metas e fluxo das avaliações — competência de {periodoLabel}.</p>
                {/* 0.22.0 — o Painel respondia sempre sobre o mês corrente. Com histórico
                    desde janeiro, comparar competências passa a ser o uso principal dele. */}
                <div style={{ marginTop: '0.75rem' }}>
                  <SeletorCompetencia periodo={periodoAtual} onChange={onPeriodoChange} />
                </div>
              </div>
              { (perfilAtivo === 'GESTOR' || perfilAtivo === 'ADMIN') && (
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
            {settings.requireGestorValidation && (perfilAtivo === 'GESTOR' || perfilAtivo === 'ADMIN') && monitorings.some(m => m.status === 'Concluída') && (
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
              const isGestor = perfilAtivo === 'GESTOR' || perfilAtivo === 'ADMIN';
              
              // Calculate KPIs
              let totalRealizadas = 0;
              let totalMeta = 0;
              let unmonitoredCount = 0;
              let pace = 0;
              
              if (isGestor) {
                // Gestor stats across all monitors, filtered by area if selected
                // getMonitors() já exclui o GESTOR desde a 0.17.0 — filtrar por role aqui de
                // novo excluiria também o ADMIN, que opera.
                let allMonitors = getMonitors();

                // Escopo: o GESTOR acompanha apenas os monitores das áreas em que é o gestor
                // responsável. `null` significa sem restrição (ADMIN).
                const equipe = getEquipeDoGestor(currentUser, areas, perfilAtivo);
                if (equipe !== null) {
                  allMonitors = allMonitors.filter(m => equipe.includes(m.id));
                }

                if (dashboardAreaId !== 'ALL') {
                  const area = areas.find(a => a.id === dashboardAreaId);
                  const daArea = area?.monitorIds || [];
                  allMonitors = allMonitors.filter(m => daArea.includes(m.id));
                }
                
                allMonitors.forEach(m => {
                  const s = getMonitorStats(m.id, periodoAtual);
                  totalRealizadas += s.cobertura;
                  totalMeta += s.target;
                });
                
                // A base já exclui quem não tem vínculo vigente: isso não é "falta
                // monitorar", é falta de carteira, e o conserto é em Equipe. O helper
                // getSemVinculo existe para a fila operacional exibir esse caso à parte.
                let colabs = getUnmonitoredCollaborators(null, periodoAtual);
                if (dashboardAreaId !== 'ALL') {
                  colabs = colabs.filter(c => c.areaId === dashboardAreaId);
                }
                unmonitoredCount = colabs.length;
                // Competência encerrada não tem "dias úteis restantes": o ritmo é nulo, e a
                // tela diz isso em vez de exibir um número que não significa nada.
                pace = businessDaysRemaining > 0
                  ? Math.ceil((totalMeta - totalRealizadas) / businessDaysRemaining)
                  : null;
              } else {
                const stats = getMonitorStats(currentUser.id, periodoAtual);
                totalRealizadas = stats.cobertura;
                totalMeta = stats.target;
                // Monitor's unmonitored colabs
                const myUnmonitored = getUnmonitoredCollaborators(currentUser.id, periodoAtual);
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
                          <span className="card-horiz-value">{pace === null ? '—' : `${pace}/dia`}</span>
                        </div>
                        <div className="card-horiz-icon primary"><Clock size={18} /></div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        {pace === null ? 'Competência encerrada.' : 'Para bater a meta no prazo.'}
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
                                getMonitors().filter(m => {
                                  const equipe = getEquipeDoGestor(currentUser, areas);
                                  return equipe === null || equipe.includes(m.id);
                                }).map(monitor => {
                                  const s = getMonitorStats(monitor.id, periodoAtual);
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
                                            {s.cobertura}
                                            {s.entregues > 0 && (
                                              <div style={{ fontWeight: '500', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {s.entregues} entregues · {s.validated} validadas
                                                {(s.excedente + s.outOfGoal) > 0 && ` · ${s.excedente + s.outOfGoal} fora da quota`}
                                              </div>
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
                                getCarteiraDe(currentUser.id).map(c => {
                                  // Sem `|| 5`: a ausência de meta é informada, não preenchida com um número.
                                  const meta = getMetaDaColaboradora(colaboradorGoals, currentUser.id, c.id, periodoAtual);
                                  const escopos = getEscoposDaColaboradora(colaboradorGoals, monitorings, currentUser.id, c.id, periodoAtual);
                                  const goalVal = meta.tipo === 'nenhuma' ? null : meta.alvo;
                                  // Cobertura, e não total entregue: excedente num canal não cobre déficit em outro.
                                  const completed = escopos.reduce((s, e) => s + e.cobertura, 0);
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
                            // O gestor vê a atividade da própria equipe; o ADMIN, de todos
                            // (getEquipeDoGestor devolve null para ele).
                            const escopoRecentes = getEquipeDoGestor(currentUser, areas);
                            let recentMon = isGestor
                              ? (escopoRecentes === null
                                  ? [...monitorings]
                                  : monitorings.filter(m => escopoRecentes.includes(m.monitorId)))
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
                                      Status: <strong style={{ color: 'var(--text-main)' }}>{m.status}</strong> • Canal: {canalLabel(m.canal)}
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
