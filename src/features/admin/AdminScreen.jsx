import { Fragment } from 'react';
import { Plus, Edit, AlertTriangle } from 'lucide-react';
import { CRITERION_CATEGORIES, CHANNELS } from '../../constants/criteria';
import { canalLabel } from '../../constants/canais';
import { DEFAULT_BRAND_CONFIG } from '../../mockData';
import { temGestorConfigurado } from '../../domain/validacaoService';
import { UserManagement } from '../../modules/admin/UserManagement';
import { RolesManagement } from '../../modules/admin/RolesManagement';
import { AuditLogs } from '../../modules/admin/AuditLogs';

// Tela de Administração.
//
// As telas de Usuários, Perfis e Logs não são itens de primeiro nível: vivem como abas daqui.
// A duplicidade entre "Usuários do Portal" e "Contas e Acessos", registrada desde a 0.19.0,
// foi resolvida na 0.21.0 — sobrou uma tela só.
/**
 * Seções da Administração e as abas de cada uma (0.21.0).
 *
 * Até a 0.20.0 as três entradas do menu — Critérios, Usuários e Acessos, Sistema — caíam no
 * MESMO painel de oito abas. O agrupamento do menu não simplificava nada: eram três portas
 * para a mesma sala, e o cabeçalho carregava a lista inteira em qualquer uma delas.
 *
 * Aqui cada seção mostra só o que é dela, e os rótulos são curtos porque o contexto já foi dado
 * pelo título da seção: dentro de "Usuários e Acessos", "Usuários" basta — "Contas e Acessos
 * Corporativos" repetia o cabeçalho dentro da aba.
 */
const SECOES = {
  criterios: {
    titulo: 'Critérios de Avaliação',
    subtitulo: 'A régua da monitoria: blocos, pesos, tipos de resposta e âncoras de decisão.',
    abas: [{ id: 'criteria', label: 'Critérios' }],
  },
  acessos: {
    titulo: 'Usuários e Acessos',
    subtitulo: 'Quem entra na plataforma, sob quais perfis, e o registro do que foi feito.',
    abas: [
      { id: 'accounts', label: 'Usuários' },
      { id: 'roles', label: 'Perfis' },
      { id: 'audit-logs', label: 'Logs' },
    ],
  },
  sistema: {
    titulo: 'Sistema',
    subtitulo: 'Estrutura da operação, regras de fluxo e identidade visual.',
    abas: [
      { id: 'areas', label: 'Áreas' },
      { id: 'collaborators', label: 'Colaboradores' },
      { id: 'settings', label: 'Fluxo' },
      { id: 'brand', label: 'Marca' },
    ],
  },
};

/** Seção a que uma aba pertence. Deriva do mapa acima para não haver segunda lista a manter. */
const SECAO_DA_ABA = Object.fromEntries(
  Object.entries(SECOES).flatMap(([nome, s]) => s.abas.map(a => [a.id, nome])),
);

/**
 * Critérios agrupados por bloco, na ordem oficial da metodologia.
 *
 * A ordem vem de CRITERION_CATEGORIES, e não da ordem de cadastro: o bloco é parte da régua —
 * ABERTURA vem antes de ENCERRAMENTO porque o atendimento acontece nessa ordem. Blocos fora da
 * taxonomia (cadastrados à mão) vão para o fim, visíveis em vez de descartados.
 */
const agruparPorBloco = (criteria) => {
  const porBloco = new Map();
  criteria.forEach((c) => {
    const bloco = c.category || 'SEM BLOCO';
    if (!porBloco.has(bloco)) porBloco.set(bloco, []);
    porBloco.get(bloco).push(c);
  });

  const ordem = (b) => {
    const i = CRITERION_CATEGORIES.indexOf(b);
    return i === -1 ? CRITERION_CATEGORIES.length : i;
  };

  return [...porBloco.entries()]
    .sort((a, b) => ordem(a[0]) - ordem(b[0]))
    .map(([bloco, itens]) => ({
      bloco,
      itens: [...itens].sort((x, y) => (x.numero || 0) - (y.numero || 0)),
    }));
};

/** Rótulos curtos por tipo de resposta. Os de RESPONSE_TYPES descrevem a escala inteira e não
 *  cabem numa célula — aqui basta identificar o tipo. */
const TIPO_CURTO = {
  ESCALA_4: 'Escala',
  SIM_NAO: 'Sim / Não',
  CHECKLIST_SIM_NAO: 'Checklist',
  FAIXA_TEMPO: 'Tempo',
  MULTIPLA_ESCOLHA: 'Classificação',
};

const rotuloTipo = (c) => TIPO_CURTO[c.tipoResposta] || c.tipoResposta || '—';

/**
 * Canais do critério, resumidos.
 *
 * Hoje os 29 critérios valem para os 6 canais: a coluna anterior desenhava 174 selos idênticos
 * para dizer "todos" 29 vezes. Só a exceção merece detalhe.
 */
const rotuloCanais = (c) => {
  const total = (c.channels || []).length;
  if (total === 0) return '—';
  if (total === CHANNELS.length) return 'Todos';
  return c.channels.map(canalLabel).join(', ');
};

/**
 * Completude da régua: âncoras e regra de N/A.
 *
 * É o que a 3A.0 passou a exigir de cada critério e o que o assistente da 3A.1 vai ler. Sem
 * isto, a lacuna só apareceria quando o agente errasse — e um critério sem âncora não tem como
 * ser avaliado de forma consistente nem por pessoa nem por máquina.
 *
 * Classificação e checklist não usam âncora por valor (a régua deles é a lista de opções e as
 * sub-perguntas), então cobrá-la ali seria inventar uma pendência que não existe.
 */
const selosDaRegua = (c) => {
  const usaAncora = c.tipoResposta !== 'MULTIPLA_ESCOLHA' && c.tipoResposta !== 'CHECKLIST_SIM_NAO';
  const selos = [];

  if (usaAncora) {
    selos.push(c.ancoras
      ? <span key="a" className="badge-pill badge-success" style={{ fontSize: '0.62rem' }}>Âncoras</span>
      : <span key="a" className="badge-pill badge-warning" style={{ fontSize: '0.62rem' }}>Sem âncoras</span>);
  }
  if (c.quandoNA) {
    selos.push(<span key="na" className="badge-pill badge-info" style={{ fontSize: '0.62rem' }}>N/A</span>);
  }

  if (selos.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>{selos}</div>;
};

export const AdminScreen = ({
  brand,
  setBrand,
  settings,
  setSettings,
  areas = /** @type {import('../../types/domain').Area[]} */ ([]),
  collaborators = /** @type {import('../../types/domain').Collaborator[]} */ ([]),
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  criteria = /** @type {import('../../types/domain').Criterion[]} */ ([]),
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  onUsersChange,
  adminSubTab,
  setAdminSubTab,
  setNewCriterion,
  setNewArea,
  setNewCollaborator,
  setShowCriterionModal,
  setShowAreaModal,
  setShowCollaboratorModal,
}) => {
  // Aba desconhecida cai em Critérios: é a entrada padrão da Administração e nunca deixa a
  // tela sem cabeçalho.
  const secao = SECOES[SECAO_DA_ABA[adminSubTab]] || SECOES.criterios;

  return (
          <div className="animate-fade-in">
            <div className="page-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h1 className="page-title">{secao.titulo}</h1>
                <p className="page-subtitle">{secao.subtitulo}</p>
              </div>
            </div>

            {/* Uma seção com aba única não mostra a barra: uma aba sozinha não oferece escolha,
                só ocupa altura. É o caso de Critérios, que é tela e não conjunto de telas. */}
            {secao.abas.length > 1 && (
              <div className="tab-row" role="tablist">
                {secao.abas.map(aba => (
                  <button
                    key={aba.id}
                    role="tab"
                    aria-selected={adminSubTab === aba.id}
                    className={`tab-btn ${adminSubTab === aba.id ? 'active' : ''}`}
                    onClick={() => setAdminSubTab(aba.id)}
                  >
                    {aba.label}
                  </button>
                ))}
              </div>
            )}

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
                        <th>Gestor</th>
                        <th>Monitores</th>
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
                      weight: 1.0,
                      channels: [...CHANNELS],
                      active: true
                    });
                    setShowCriterionModal(true);
                  }}>
                    <Plus size={15} /> Adicionar Critério
                  </button>
                </div>

                {/* Grade da régua (0.21.0).
                    Saíram três colunas: "Descrição" (truncada com reticências, ilegível — o
                    texto segue no modal e no formulário, onde é lido de verdade), "Nota Mínima
                    Esperada" (campo que nunca participou do cálculo) e "Categoria", que
                    repetia o mesmo texto em até 18 linhas seguidas e agora é cabeçalho de
                    grupo. Entraram Tipo, Peso e Régua — o que se administra desde a 3A.0. */}
                <div className="table-responsive">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th style={{ width: '48px' }}>Nº</th>
                        <th>Critério</th>
                        <th style={{ width: '120px' }}>Tipo</th>
                        <th style={{ width: '70px' }}>Peso</th>
                        <th style={{ width: '110px' }}>Canais</th>
                        <th style={{ width: '110px' }}>Régua</th>
                        <th style={{ width: '130px' }}>Status</th>
                        <th style={{ width: '90px' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agruparPorBloco(criteria).map(({ bloco, itens }) => (
                        <Fragment key={bloco}>
                          <tr>
                            <td colSpan={8} style={{ backgroundColor: 'var(--bg-main)', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem' }}>
                              {bloco} · {itens.length} {itens.length === 1 ? 'critério' : 'critérios'}
                            </td>
                          </tr>
                          {itens.map(c => (
                            <tr key={c.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{c.numero || '—'}</td>
                              <td style={{ fontWeight: '600' }}>{c.name}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rotuloTipo(c)}</td>
                              <td style={{ fontSize: '0.8rem' }}>
                                {/* Peso 0 não é "peso zero": é o que marca classificação, que
                                    não entra no denominador da nota. Mostrar o número faria
                                    parecer um critério que vale nada. */}
                                {c.weight === 0
                                  ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>não pontua</span>
                                  : <strong>{c.weight.toFixed(1)}</strong>}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rotuloCanais(c)}</td>
                              <td>{selosDaRegua(c)}</td>
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
                        </Fragment>
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
                    Regras de Validação
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

                  {/* Indicador de fluxo incompleto (0.20.0).
                      A exigência de validação só funciona se houver gestor respondendo pela
                      área do monitor. Quando não há, a monitoria nasce pendente e ninguém pode
                      liberá-la — o parâmetro fica ligado e sem efeito prático. Contar aqui é o
                      que impede isso de virar uma fila silenciosa: quem liga a chave é quem vê
                      o número. O aviso equivalente aparece no formulário, antes de salvar. */}
                  {settings.requireGestorValidation && (() => {
                    const presas = monitorings.filter(
                      (m) => m.status === 'Pendente' && !temGestorConfigurado(m.monitorId, areas)
                    ).length;
                    const semGestor = areas.filter((a) => a.active && !a.gestorId).length;
                    if (presas === 0 && semGestor === 0) return null;
                    return (
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.75rem 0.9rem', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
                        <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.55 }}>
                          {presas > 0 && (
                            <div>
                              <strong>{presas} {presas === 1 ? 'monitoria pendente' : 'monitorias pendentes'} sem gestor
                              para validar.</strong> Elas permanecerão paradas até que a área do monitor tenha um gestor.
                            </div>
                          )}
                          {semGestor > 0 && (
                            <div style={{ marginTop: presas > 0 ? '0.3rem' : 0 }}>
                              {semGestor === 1 ? '1 área ativa está' : `${semGestor} áreas ativas estão`} sem gestor
                              responsável. Vincule em <strong>Áreas</strong>.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}

            {/* Sub-tab: Marca (0.21.0).
                Saiu de dentro de "Configurações do Fluxo": identidade visual e regra de
                validação não têm relação, e mantê-las na mesma aba obrigava a percorrer o
                workflow para trocar uma cor. */}
            {adminSubTab === 'brand' && (
              <div className="animate-fade-in">
                <div className="section-card">
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                    Identidade Visual
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

            {/* Sub-abas absorvidas do menu de primeiro nível */}
            {adminSubTab === 'accounts' && (
              <UserManagement users={users} onUsersChange={onUsersChange} />
            )}

            {adminSubTab === 'roles' && <RolesManagement />}

            {adminSubTab === 'audit-logs' && <AuditLogs />}

          </div>
  );
};
