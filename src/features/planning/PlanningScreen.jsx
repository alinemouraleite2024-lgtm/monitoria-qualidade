import { Trash2 } from 'lucide-react';
import { getEscopoProgresso, getMetaDaColaboradora, assertMetasConsistentes } from '../../domain/goalService';
import { CANAIS, canalLabel } from '../../constants/canais';

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
  periodoLabel,
  newCGoalVal,
  setNewCGoalVal,
  onUpdateColabGoal,
  onRemoveColabGoal,
  getMonitors,
  getCollaborators,
  renderUserAvatar
}) => {
  const doPeriodo = colaboradorGoals.filter(
    g => g.year === periodoAtual.year && g.month === periodoAtual.month
  );

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
          <h1 className="page-title">Planejamento e Metas Operacionais</h1>
          <p className="page-subtitle">
            Defina quantas monitorias cada colaboradora deve receber na competência de {periodoLabel}.
          </p>
        </div>
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

        <div className="section-card">
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
            Quadro de Metas Ativo ({periodoLabel})
          </h3>

          {grupos.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 1rem' }}>
              Sem meta definida para o período.
            </p>
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
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                            title="Remover esta meta"
                            onClick={() => onRemoveColabGoal(goal.id)}
                          >
                            <Trash2 size={14} />
                          </button>
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
