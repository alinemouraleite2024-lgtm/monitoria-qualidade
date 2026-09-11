import { Plus, Pencil } from 'lucide-react';
import { SeletorCompetencia } from '../../shared/components/SeletorCompetencia';
import { competenciaLabel, periodToCompetencia } from '../../domain/period';
import { canalLabel } from '../../constants/canais';

/**
 * Plano de metas, na Administração (0.25.0).
 *
 * O plano saiu da tela da gestão. Quem declara o padrão do ano não é quem reage ao mês: o
 * ADMIN define o plano, a gestão ajusta a competência. Eram dois atos de naturezas diferentes
 * convivendo na mesma tela, sob o mesmo botão.
 *
 * Duas coisas que só existem aqui:
 *
 * A LISTA. Até a 0.24.0 nenhuma tela listava planos — a faixa mostrava apenas o que cobria a
 * competência aberta, e o plano encerrado por sucessão ficava invisível mesmo continuando a
 * governar o passado. Quem precisasse saber qual era a meta em março não tinha onde olhar.
 *
 * O EFEITO NA COMPETÊNCIA. É o que fecha o ciclo entre os dois donos: sem ele o ADMIN declara
 * 35 no vazio e nunca descobre que a operação está entregando 33. Mostra o que a gestão fez
 * com o plano, em leitura, sem exigir acesso à tela dela.
 */
export const PlanoMetasAdmin = ({
  planos,
  periodo,
  onPeriodo,
  metasDoPeriodo,
  nomeDe,
  onNovoPlano,
  onEditarPlano,
}) => {
  const competencia = periodToCompetencia(periodo);

  const statusDe = (p) => {
    if (p.vigenciaFim < competencia) return { rotulo: 'Encerrado', cor: 'var(--text-muted)' };
    if (p.vigenciaInicio > competencia) return { rotulo: 'Futuro', cor: 'var(--warning)' };
    return { rotulo: 'Vigente', cor: 'var(--primary)' };
  };

  const ordenados = [...planos].sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio));
  const totalMensal = (p) => p.linhas.reduce((s, l) => s + Number(l.targetQty || 0), 0);

  const { metas, semMeta } = metasDoPeriodo;
  const efetivas = metas.reduce((s, m) => s + m.targetQty, 0);

  // O previsto sai das LINHAS DO PLANO, e não das metas resolvidas: quem saiu por "sem meta"
  // não aparece entre as metas, e somar só o que sobrou faria o plano parecer menor do que é.
  // Com 35 previstas e 21 efetivas, a diferença é a conta que o ADMIN precisa enxergar.
  const planoDaCompetencia = planos.find(
    (p) => p.vigenciaInicio <= competencia && competencia <= p.vigenciaFim,
  );
  const previstoPeloPlano = (planoDaCompetencia?.linhas ?? [])
    .filter((l) => !(l.entraEm && l.entraEm > competencia))
    .reduce((s, l) => s + Number(l.targetQty || 0), 0);

  return (
    <div className="animate-fade-in">

      <div className="section-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem',
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
            Planos cadastrados
          </h3>
          <button type="button" className="btn btn-primary btn-sm" onClick={onNovoPlano}>
            <Plus size={15} /> Novo plano
          </button>
        </div>

        <div className="table-responsive">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Plano</th>
                <th>Vigência</th>
                <th>Colaboradoras</th>
                <th>Por mês</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhum plano cadastrado. Sem plano, a meta de cada competência precisa ser
                    lançada uma a uma pela gestão.
                  </td>
                </tr>
              )}
              {ordenados.map((p) => {
                const st = statusDe(p);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.nome}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {competenciaLabel(p.vigenciaInicio)} a {competenciaLabel(p.vigenciaFim)}
                    </td>
                    <td>{new Set(p.linhas.map((l) => l.colaboradorId)).size}</td>
                    <td style={{ fontWeight: 'bold' }}>{totalMensal(p)}</td>
                    <td style={{ color: st.cor, fontWeight: 600, fontSize: '0.82rem' }}>{st.rotulo}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEditarPlano(p)}>
                        <Pencil size={14} /> Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-card">
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '1rem', flexWrap: 'wrap', marginBottom: '0.35rem',
        }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
            Efeito na competência
          </h3>
          <SeletorCompetencia periodo={periodo} onChange={onPeriodo} />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          O que a gestão fez com o plano neste mês. Leitura — os ajustes são feitos em Metas,
          pelo gestor da área.
        </p>

        <div className="table-responsive">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Colaboradora</th>
                <th>Escopo</th>
                <th>Meta efetiva</th>
                <th>Origem</th>
                <th>Ajustado por</th>
              </tr>
            </thead>
            <tbody>
              {metas.length === 0 && semMeta.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhuma meta em {competenciaLabel(competencia)}.
                  </td>
                </tr>
              )}

              {metas.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{nomeDe(m.colaboradorId)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {m.canal ? canalLabel(m.canal) : 'Qualquer canal'}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{m.targetQty}</td>
                  <td>
                    {m.origem === 'ajuste' ? (
                      <span className="badge-pill badge-warning">
                        Ajustada {m.ajuste > 0 ? `+${m.ajuste}` : m.ajuste} · plano {m.alvoDoPlano}
                      </span>
                    ) : m.origem === 'excecao' ? (
                      <span className="badge-pill badge-info">Lançada pela gestão</span>
                    ) : (
                      <span className="badge-pill badge-info">Do plano</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {m.ajustadoPor
                      ? `${nomeDe(m.ajustadoPor)}${m.ajustadoEm ? ` · ${new Date(m.ajustadoEm).toLocaleDateString('pt-BR')}` : ''}`
                      : '—'}
                  </td>
                </tr>
              ))}

              {semMeta.map((s) => (
                <tr key={`sem-${s.colaboradorId}`}>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{nomeDe(s.colaboradorId)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>—</td>
                  <td style={{ color: 'var(--text-muted)' }}>—</td>
                  <td>
                    <span className="badge-pill badge-warning">
                      Sem meta neste mês{s.motivo ? ` · ${s.motivo}` : ''}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(metas.length > 0 || semMeta.length > 0) && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            <strong style={{ color: 'var(--text-main)' }}>{efetivas}</strong> monitorias efetivas
            {previstoPeloPlano > 0 && efetivas !== previstoPeloPlano && <> · {previstoPeloPlano} previstas pelo plano</>}
            {semMeta.length > 0 && <> · {semMeta.length} sem meta neste mês</>}
          </p>
        )}
      </div>

    </div>
  );
};
