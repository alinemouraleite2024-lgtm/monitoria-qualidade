import { PlusCircle, Plus, Edit } from 'lucide-react';
import { DEFAULT_BRAND_CONFIG } from '../../mockData';
import { UserManagement } from '../../modules/admin/UserManagement';
import { RolesManagement } from '../../modules/admin/RolesManagement';
import { AuditLogs } from '../../modules/admin/AuditLogs';

// Tela de Administração.
//
// Com a reorganização do menu, "Usuários", "Perfis e Permissões" e "Logs de Acesso" deixaram
// de ser itens de primeiro nível. As três telas continuam existindo e passaram a ser sub-abas
// daqui — nenhuma funcionalidade pode ficar acessível apenas por URL.
//
// Duplicidade conhecida, herdada e NÃO resolvida aqui: "Usuários do Portal" (cadastro rápido
// via UserModal, grava só o núcleo do registro) e "Contas e Acessos" (UserManagement, grava o
// registro completo, bloqueia/desbloqueia e audita) fazem coisas parecidas por caminhos
// diferentes. A divergência já estava registrada no cabeçalho de UserManagement.jsx. Unificar
// as duas é mudança de regra e pertence à história do hub de Administração.
export const AdminScreen = ({
  brand,
  setBrand,
  settings,
  setSettings,
  areas = /** @type {import('../../types/domain').Area[]} */ ([]),
  collaborators = /** @type {import('../../types/domain').Collaborator[]} */ ([]),
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  criteria = /** @type {import('../../types/domain').Criterion[]} */ ([]),
  onUsersChange,
  adminSubTab,
  setAdminSubTab,
  setNewCriterion,
  setNewArea,
  setNewCollaborator,
  setShowCriterionModal,
  setShowUserModal,
  setShowAreaModal,
  setShowCollaboratorModal,
  renderUserAvatar
}) => (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1 className="page-title">Personalização e Controles Administrativos</h1>
                <p className="page-subtitle">Configure regras gerais de negócio, White Label e critérios dinâmicos.</p>
              </div>
            </div>

            <div className="tab-row">
              <button 
                className={`tab-btn ${adminSubTab === 'areas' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('areas')}
              >
                Áreas
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'collaborators' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('collaborators')}
              >
                Colaboradores
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'criteria' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('criteria')}
              >
                Critérios de Avaliação
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'settings' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('settings')}
              >
                Configurações do Fluxo
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'users' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('users')}
              >
                Usuários do Portal
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'accounts' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('accounts')}
              >
                Contas e Acessos
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'roles' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('roles')}
              >
                Perfis e Permissões
              </button>
              <button 
                className={`tab-btn ${adminSubTab === 'audit-logs' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('audit-logs')}
              >
                Logs de Acesso
              </button>
            </div>

            {/* Sub-tab: Areas */}
            {adminSubTab === 'areas' && (
              <div className="section-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                    Áreas Cadastradas
                  </h3>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setNewArea({ id: '', name: '', gestorId: '', monitorIds: [], active: true });
                    setShowAreaModal(true);
                  }}>
                    <Plus size={15} /> Adicionar Área
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Nome da Área</th>
                        <th>Gestor Responsável</th>
                        <th>Monitor Responsável</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areas.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: '600' }}>{a.name}</td>
                          <td>{users.find(u => u.id === a.gestorId)?.name || 'N/A'}</td>
                          <td>
                            {(a.monitorIds || []).length === 0
                              ? '—'
                              : (a.monitorIds || [])
                                  .map(id => users.find(u => u.id === id)?.name)
                                  .filter(Boolean)
                                  .join(', ')}
                          </td>
                          <td>
                            <span className={`badge-pill ${a.active ? 'badge-success' : 'badge-danger'}`}>
                              {a.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setNewArea(a);
                              setShowAreaModal(true);
                            }}>
                              <Edit size={12} /> Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab: Collaborators */}
            {adminSubTab === 'collaborators' && (
              <div className="section-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                    Colaboradores Avaliados
                  </h3>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setNewCollaborator({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });
                    setShowCollaboratorModal(true);
                  }}>
                    <Plus size={15} /> Adicionar Colaborador
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Cargo</th>
                        <th>Área</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collaborators.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: '600' }}>{c.name}</td>
                          <td>{c.email}</td>
                          <td>{c.cargo}</td>
                          <td>{areas.find(a => a.id === c.areaId)?.name || 'N/A'}</td>
                          <td>
                            <span className={`badge-pill ${c.active ? 'badge-success' : 'badge-danger'}`}>
                              {c.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setNewCollaborator(c);
                              setShowCollaboratorModal(true);
                            }}>
                              <Edit size={12} /> Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab: Criteria configuration */}
            {adminSubTab === 'criteria' && (
              <div className="section-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                    Critérios de Avaliação Cadastrados
                  </h3>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setNewCriterion({
                      id: '',
                      numero: '',
                      category: '',
                      name: '',
                      description: '',
                      orientacao: '',
                      tipoResposta: 'ESCALA_4',
                      eliminatorio: false,
                      minExpectedScore: 7.5,
                      weight: 1.0,
                      channels: ['Chat', 'WhatsApp'],
                      active: true
                    });
                    setShowCriterionModal(true);
                  }}>
                    <Plus size={15} /> Adicionar Critério
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Nº</th>
                        <th>Categoria</th>
                        <th>Nome</th>
                        <th>Descrição</th>
                        <th>Nota Mínima Esperada</th>
                        <th>Canais de Aplicação</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map(c => (
                        <tr key={c.id}>
                          <td>{c.numero || '—'}</td>
                          <td style={{ fontSize: '0.8rem' }}>{c.category || '—'}</td>
                          <td style={{ fontWeight: '600' }}>{c.name}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.description}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{c.minExpectedScore.toFixed(1)}</td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {c.channels.map(chan => (
                                <span key={chan} className="badge-pill badge-info" style={{ fontSize: '0.62rem' }}>
                                  {chan}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <span className={`badge-pill ${c.active ? 'badge-success' : 'badge-danger'}`}>
                              {c.active ? 'Ativo' : 'Inativo'}
                            </span>
                            {c.eliminatorio && (
                              <span className="badge-pill badge-danger" style={{ marginLeft: '0.25rem' }}>
                                Eliminatório
                              </span>
                            )}
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              setNewCriterion(c);
                              setShowCriterionModal(true);
                            }}>
                              <Edit size={12} /> Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-tab: settings */}
            {adminSubTab === 'settings' && (
              <div className="allocation-manager-grid animate-fade-in">
                
                {/* Workflow configuration V2 */}
                <div className="section-card">
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                    Workflow e Validações
                  </h3>

                  <div className="switch-group">
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Exigir Validação Gerencial</div>
                      <div className="switch-label-desc">
                        Se ativo, as avaliações feitas por monitores requerem aprovação gerencial para constarem nos KPIs do dashboard.
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      style={{ height: '18px', width: '18px', cursor: 'pointer' }}
                      checked={settings.requireGestorValidation}
                      onChange={(e) => setSettings({ ...settings, requireGestorValidation: e.target.checked })}
                    />
                  </div>
                </div>

                {/* Brand configuration */}
                <div className="section-card">
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                    White Label Brand Config
                  </h3>

                  <div className="form-group">
                    <label className="form-label">Nome da Empresa</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={brand.name}
                      onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cores Institucionais</label>
                    <div className="color-picker-group">
                      <div className="color-input-container">
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Primária</span>
                        <input 
                          type="color" 
                          className="color-input-picker"
                          value={brand.primaryColor}
                          onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                        />
                      </div>
                      <div className="color-input-container">
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Secundária</span>
                        <input 
                          type="color" 
                          className="color-input-picker"
                          value={brand.secondaryColor}
                          onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', marginTop: '1rem' }}
                    onClick={() => {
                      setBrand(DEFAULT_BRAND_CONFIG);
                    }}
                  >
                    Restaurar Moura Leite
                  </button>
                </div>

              </div>
            )}

            {/* Sub-tab: users management */}
            {adminSubTab === 'users' && (
              <div className="section-card animate-fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                    Controle de Contas e Acessos Corporativos
                  </h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>
                    <PlusCircle size={15} /> Adicionar Usuário
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Papel (Role)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="user-cell-wrapper">
                              {renderUserAvatar(u.name)}
                              <span style={{ fontWeight: '600' }}>{u.name}</span>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span className={`badge-pill role-${u.role.toLowerCase()}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className="badge-pill badge-success">Ativo</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-abas absorvidas do menu de primeiro nível */}
            {adminSubTab === 'accounts' && (
              <UserManagement users={users} onUsersChange={onUsersChange} />
            )}

            {adminSubTab === 'roles' && <RolesManagement />}

            {adminSubTab === 'audit-logs' && <AuditLogs />}

          </div>
);
