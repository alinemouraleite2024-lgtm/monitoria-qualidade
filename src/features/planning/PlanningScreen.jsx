import { SeletorCompetencia } from '../../shared/components/SeletorCompetencia';
import { Trash2 } from 'lucide-react';
import { getEscopoProgresso, getMetaDaColaboradora, assertMetasConsistentes } from '../../domain/goalService';
import { CANAIS, canalLabel } from '../../constants/canais';
import { competenciaLabel } from '../../domain/period';

// Planejamento de metas.
//
// 2A.4 removeu daqui o formulário de "Meta Global (Volume Mensal)" por monitor: ele concorria
// com a meta por colaboradora e o sistema resolvia o conflito escolhendo a maior das duas, sem
// dizer qual.
//
// 2A.6.3 introduz o ESCOPO. Uma colaboradora tem meta geral (qualquer canal atende) ou metas
// por canal (5 de WhatsApp e 5 de Ligação, por exemplo) — nunca as duas. O quadro passa a
// agrupar por colaboradora, porque a unidade de leitura da gestora é a pessoa, e cada linha de
// meta é um escopo dentro dela.
//
// A exclusão nasce aqui por necessidade, não por conveniência: sem ela, trocar uma colaboradora
// de meta geral para meta por canal seria impossível pela tela — ela ficaria com as duas, que é
// exatamente o estado que a regra proíbe.

export const PlanningScreen = ({
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  collaborators = /** @type {import('../../types/domain').Collaborator[]} */ ([]),
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  colaboradorGoals = /** @type {import('../../types/domain').ColaboradorGoal[]} */ ([]),
  periodoAtual,
  onPeriodoChange,
  periodoLabel,
  newCGoalVal,
  setNewCGoalVal,
  onUpdateColabGoal,
  onRemoveColabGoal,
  onAjustarDelta,
  onVoltarAoEscopoDoPlano,
  onVoltarAoPlano,
  onSemMeta,

  semMeta = /** @type {import('../../domain/planoMetasService').SemMetaEfetiva[]} */ ([]),
  planoVigente = /** @type {import('../../types/domain').PlanoMetas | null} */ (null),
  getMonitors,
  getCollaborators,
  renderUserAvatar
}) => {
  // 0.23.0 — `colaboradorGoals` chega já RESOLVIDO para esta competência: o plano vigente com
  // as exceções do mês por cima (ver domain/planoMetasService). O filtro por ano/mês some, e
  // com ele o motivo pelo qual esta tela precisava conhecer a forma do registro gravado.
  const doPeriodo = colaboradorGoals;

  const nomeDe = (id) =>
    collaborators.find(c => c.id === id)?.name ?? users.find(u => u.id === id)?.name ?? 'N/A';

  // Agrupamento por colaboradora, preservando a ordem em que as metas foram cadastradas.
  const grupos = [];
  for (const goal of doPeriodo) {
    const chave = `${goal.monitorId}::${goal.colaboradorId}`;
    let grupo = grupos.find(g => g.chave === chave);
    if (!grupo) {
      grupo = { chave, monitorId: goal.monitorId, colaboradorId: goal.colaboradorId, linhas: [] };
      grupos.push(grupo);
    }
    grupo.linhas.push(goal);
  }

  // Escopo que o formulário está prestes a gravar, para avisar antes do envio em vez de
  // recusar depois.
  const metaAtual = newCGoalVal.colaboradorId
    ? getMetaDaColaboradora(colaboradorGoals, newCGoalVal.monitorId, newCGoalVal.colaboradorId, periodoAtual)
    : { tipo: 'nenhuma' };
  const conflito =
    (newCGoalVal.canal && metaAtual.tipo === 'geral' && 'geral') ||
    (!newCGoalVal.canal && metaAtual.tipo === 'por-canal' && 'por-canal') ||
    null;

  // Rede de proteção sobre o dado já gravado, para o caso de um estado proibido ter entrado
  // por outro caminho. Mesmo padrão de assertRouteAccessIsConsistent.
  const inconsistencias = assertMetasConsistentes(colaboradorGoals, periodoAtual);

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Metas</h1>
          <p className="page-subtitle">
            Defina quantas monitorias cada colaboradora deve receber na competência de {periodoLabel}.
          </p>
        </div>
        {/* 0.22.0 — a tela respondia sempre sobre o mês corrente, o que tornava impossível
            cadastrar meta retroativa. Sem meta na competência, o progresso daquele mês fica
            sem denominador, e é isso que o histórico desde janeiro precisa ter. */}
        <SeletorCompetencia
          periodo={periodoAtual}
          onChange={onPeriodoChange}
          titulo="Competência"
        />
      </div>

      {/* Faixa do plano vigente (0.23.0). Fica no topo de toda competência coberta: é a
          explicação de por que as metas aparecem sem ninguém ter cadastrado nada neste mês.

          0.25.0 — virou leitura. O plano passou a ser da Administração, e o botão de editar
          saiu daqui. A faixa continua, e mais necessária do que antes: ajustar sem enxergar
          de onde se está partindo seria ajustar no escuro. */}
      <div className="section-card" style={{
        marginBottom: '1.5rem',
        borderLeft: `3px solid ${planoVigente ? 'var(--primary)' : 'var(--border-color)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        {planoVigente ? (
          <span style={{ fontSize: '0.88rem' }}>
            <strong>{planoVigente.nome}</strong>
            <span style={{ color: 'var(--text-muted)' }}>
              {' '}— vigência de {competenciaLabel(planoVigente.vigenciaInicio)} a {competenciaLabel(planoVigente.vigenciaFim)}
              {' · '}{planoVigente.linhas.length} {planoVigente.linhas.length === 1 ? 'colaboradora' : 'colaboradoras'}
            </span>
          </span>
        ) : (
          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Nenhum plano cobre {periodoLabel}. Sem plano não há de que ajustar: as metas deste mês
            precisam ser lançadas uma a uma, abaixo.
          </span>
        )}
        {planoVigente && (
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            definido pela Administração
          </span>
        )}
      </div>

      {inconsistencias.length > 0 && (
        <div className="section-card" style={{ borderLeft: '3px solid var(--danger)', marginBottom: '1.5rem' }}>
          <strong style={{ color: 'var(--danger)' }}>Metas inconsistentes neste período</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {inconsistencias.map(msg => <li key={msg}>{msg}</li>)}
          </ul>
        </div>
      )}

      <div className="allocation-manager-grid">

        {/* Lançamento direto, só quando NENHUM plano cobre a competência (0.25.0).

            Com plano, a gestão ajusta em passos sobre o que o plano manda — e um formulário de
            valor absoluto ao lado dos botões de passo ofereceria dois caminhos para a mesma
            decisão, com significados diferentes: um guarda a intenção, o outro só o número.

            Sem plano não há de que ser relativo, e o formulário continua sendo a única forma de
            a competência ter denominador. Tirá-lo aqui deixaria o mês descoberto à espera da
            Administração, que é o problema que o plano nasceu para resolver, invertido. */}
        {!planoVigente && (
        <div className="section-card">
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
                {getMonitors().map(m => (
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
              <label className="form-label">Escopo da meta</label>
              <select
                className="form-control"
                value={newCGoalVal.canal}
                onChange={(e) => setNewCGoalVal({ ...newCGoalVal, canal: e.target.value })}
              >
                <option value="">Meta geral (qualquer canal atende)</option>
                {CANAIS.map(c => (
                  <option key={c} value={c}>Somente {canalLabel(c)}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Meta geral e meta por canal não podem coexistir para a mesma colaboradora.
              </span>
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

            {conflito && (
              <p style={{
                fontSize: '0.8rem', color: 'var(--danger)', backgroundColor: 'var(--danger-light)',
                border: '1px solid var(--danger)', borderRadius: 'var(--border-radius-sm)',
                padding: '0.6rem 0.75rem', marginBottom: '1rem'
              }}>
                {nomeDe(newCGoalVal.colaboradorId)} já tem{' '}
                {conflito === 'geral' ? 'uma meta geral' : 'metas por canal'} em {periodoLabel}.
                Remova {conflito === 'geral' ? 'a meta geral' : 'as metas por canal'} no quadro ao
                lado antes de salvar esta.
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', opacity: conflito ? 0.5 : 1 }}
              disabled={Boolean(conflito)}
            >
              Salvar meta de {periodoLabel}
            </button>
          </form>
        </div>
        )}

        <div className="section-card">
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
            {planoVigente ? `Ajustes de ${periodoLabel}` : `Quadro de Metas Ativo (${periodoLabel})`}
          </h3>
          {planoVigente && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-0.85rem', marginBottom: '1.25rem' }}>
              As metas vêm do plano. Use − e + para ajustar esta competência, ou declare que a
              colaboradora fica sem meta neste mês.
            </p>
          )}

          {grupos.length === 0 && semMeta.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 1rem' }}>
              Sem meta definida para o período.
            </p>
          )}

          {/* "Sem meta neste mês" (0.23.0). A linha continua visível, com o motivo no lugar do
              escopo: férias é uma decisão, e uma decisão que some da tela não pode ser revista.
              Fora do quadro de progresso porque não há alvo contra o qual medir. */}
          {semMeta.length > 0 && (
            <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {semMeta.map(s => (
                <div
                  key={`${s.monitorId}::${s.colaboradorId}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '1rem', flexWrap: 'wrap',
                    padding: '0.6rem 0.75rem',
                    border: '1px dashed var(--border-color)',
                    borderRadius: 'var(--border-radius-sm)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>
                      {nomeDe(s.colaboradorId)}
                    </span>
                    <span className="badge-pill" style={{
                      fontSize: '0.68rem', border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)', background: 'transparent',
                    }}>
                      Sem meta neste mês
                    </span>
                    {s.motivo && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>· {s.motivo}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onVoltarAoPlano(s.monitorId, s.colaboradorId)}
                  >
                    Voltar ao plano
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Colaboradora / escopo</th>
                  <th>Meta</th>
                  <th>Realizadas</th>
                  <th>Validadas</th>
                  <th>Faltam</th>
                  <th>Progresso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(grupo => {
                  const escopos = grupo.linhas.map(g => ({
                    goal: g,
                    e: getEscopoProgresso(g, monitorings, periodoAtual),
                  }));
                  const alvo = escopos.reduce((s, x) => s + x.goal.targetQty, 0);
                  const cobertura = escopos.reduce((s, x) => s + x.e.cobertura, 0);
                  const falta = escopos.reduce((s, x) => s + x.e.falta, 0);
                  const porCanal = escopos.length > 1 || Boolean(grupo.linhas[0].canal);

                  return [
                    <tr key={grupo.chave} style={{ backgroundColor: 'var(--bg-app)' }}>
                      <td colSpan={7}>
                        <div className="user-cell-wrapper">
                          {renderUserAvatar(nomeDe(grupo.colaboradorId))}
                          <span style={{ fontWeight: '700' }}>{nomeDe(grupo.colaboradorId)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            · {nomeDe(grupo.monitorId)} · {porCanal ? 'meta por canal' : 'meta geral'}
                            {' · '}{cobertura} de {alvo}
                            {falta > 0 ? ` · faltam ${falta}` : ' · completa'}
                          </span>
                          {/* Chip de origem (0.23.0): é o que o gestor lê primeiro para saber
                              se este mês foi tocado ou se veio do plano.

                              0.25.0 — o ajuste virou delta, e o chip mostra o delta. "Ajustada"
                              sozinho dizia que alguém mexeu; "Ajustada +3 · plano 5" diz o que
                              foi decidido, que é a informação que sobrevive a uma mudança do
                              plano. */}
                          {grupo.linhas[0].origem === 'ajuste' ? (
                            <span className="badge-pill badge-warning" style={{ fontSize: '0.68rem' }}>
                              Ajustada {grupo.linhas[0].ajuste > 0 ? `+${grupo.linhas[0].ajuste}` : grupo.linhas[0].ajuste}
                              {typeof grupo.linhas[0].alvoDoPlano === 'number'
                                && ` · plano ${grupo.linhas[0].alvoDoPlano}`}
                            </span>
                          ) : grupo.linhas[0].origem === 'excecao' ? (
                            <span className="badge-pill badge-warning" style={{ fontSize: '0.68rem' }}>
                              Lançada neste mês
                            </span>
                          ) : grupo.linhas[0].origem === 'plano' ? (
                            <span className="badge-pill badge-info" style={{ fontSize: '0.68rem' }}>
                              Do plano
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>,
                    ...escopos.map(({ goal, e }) => (
                      <tr key={goal.id}>
                        <td style={{ paddingLeft: '2.5rem' }}>
                          {goal.canal ? canalLabel(goal.canal) : 'Qualquer canal'}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{goal.targetQty}</td>
                        <td style={{ fontWeight: 'bold' }}>
                          {e.entregues}
                          {e.excedente > 0 && (
                            <span style={{ fontWeight: '500', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {' '}({e.excedente} além da meta)
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{e.validadas}</td>
                        <td>{e.falta}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="progress-container" style={{ width: '80px', margin: 0, height: '4px' }}>
                              {/* Progresso pela COBERTURA: entregar além do alvo não passa de 100%. */}
                              <div className="progress-fill" style={{
                                width: `${Math.round((e.cobertura / goal.targetQty) * 100)}%`,
                                backgroundColor: e.falta === 0 ? '#10b981' : 'var(--primary)'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                              {Math.round((e.cobertura / goal.targetQty) * 100)}%
                            </span>
                          </div>
                        </td>
                        {/* Ações por origem. Uma linha herdada não tem "remover": ela não é
                            registro gravado, é o plano sendo lido.

                            0.25.0 — o ajuste deixou de ser um formulário com valor absoluto e
                            virou dois botões de passo. A gestão pensa em "uma a mais neste
                            mês", não em "o alvo dela agora é oito": digitar o resultado exigia
                            recalcular de cabeça o que o plano já sabe. O passo age por ESCOPO,
                            que é onde o delta pousa — mexer no WhatsApp não toca a Ligação. */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                            {planoVigente && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={goal.targetQty <= 1}
                                  title={goal.targetQty <= 1
                                    ? 'A meta não vai a zero por ajuste — para isso existe "Sem meta"'
                                    : 'Uma monitoria a menos neste mês'}
                                  onClick={() => onAjustarDelta(grupo.monitorId, grupo.colaboradorId, goal.canal, -1)}
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  title="Uma monitoria a mais neste mês"
                                  onClick={() => onAjustarDelta(grupo.monitorId, grupo.colaboradorId, goal.canal, 1)}
                                >
                                  +
                                </button>
                              </div>
                            )}
                            {goal.origem === 'ajuste' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Desfazer o ajuste e voltar ao valor do plano"
                                onClick={() => onVoltarAoEscopoDoPlano(goal.id)}
                              >
                                Voltar ao plano
                              </button>
                            )}
                            {goal.origem === 'excecao' && planoVigente && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Desfazer e voltar ao valor do plano"
                                onClick={() => onVoltarAoPlano(grupo.monitorId, grupo.colaboradorId)}
                              >
                                Voltar ao plano
                              </button>
                            )}
                            {goal.origem !== 'excecao' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Férias, afastamento ou outra razão para esta colaboradora não ter meta nesta competência"
                                onClick={() => onSemMeta(grupo.monitorId, grupo.colaboradorId)}
                              >
                                Sem meta
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                                title="Remover este ajuste"
                                onClick={() => onRemoveColabGoal(goal.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
