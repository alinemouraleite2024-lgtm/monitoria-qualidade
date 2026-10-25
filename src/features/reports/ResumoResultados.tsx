import type { Monitoring } from '../../types/domain';
import { resumirNotas, resultadosPorColaboradora } from '../../domain/resultadosService';

// Resumo de Relatórios (25/10/2026): quantidade por situação, nota média e resultado por
// colaboradora, sobre EXATAMENTE os registros da tabela e da exportação — recebe o conjunto já
// filtrado, nunca filtra por conta própria (mesma regra de historyFilter).

const fmt = (n: number | null) => (n === null ? '—' : `${n.toFixed(2).replace('.', ',')}%`);

interface Props {
  monitorias: Monitoring[];
  nomeDe: (colaboradorId: string) => string | undefined;
  periodoLabel: string;
}

export const ResumoResultados = ({ monitorias, nomeDe, periodoLabel }: Props) => {
  const r = resumirNotas(monitorias);
  const linhas = resultadosPorColaboradora(monitorias, nomeDe);
  const situacoes = Object.entries(r.porStatus).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));

  return (
    <div className="section-card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>
        Resultados de {periodoLabel}
      </h3>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.85rem' }}>
        <span><strong>{r.total}</strong> {r.total === 1 ? 'monitoria' : 'monitorias'}</span>
        <span><strong>{r.consideradas}</strong> na média</span>
        <span>Média geral <strong>{fmt(r.media)}</strong></span>
        <span>Menor <strong>{fmt(r.menor)}</strong> · Maior <strong>{fmt(r.maior)}</strong></span>
        {r.zeradas > 0 && <span><strong>{r.zeradas}</strong> zerada(s) por eliminatório</span>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {situacoes.map(([status, n]) => (
          <span key={status} className="badge-pill" style={{ fontSize: '0.72rem', border: '1px solid var(--border-color)' }}>
            {status}: {n}
          </span>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>
        Entram na média as monitorias entregues (Pendente, Validada, Concluída). Rascunho ainda não
        tem nota; Reprovada e Cancelada não são resultado válido.
      </p>
      {linhas.length > 0 && (
        <div className="table-responsive">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Colaboradora</th>
                <th>Registradas</th>
                <th>Na média</th>
                <th>Média</th>
                <th>Menor</th>
                <th>Maior</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.colaboradorId || 'sem-colaboradora'}>
                  <td style={{ fontWeight: 600 }}>{l.nome}</td>
                  <td>{l.total}</td>
                  <td>{l.consideradas}</td>
                  <td style={{ fontWeight: 'bold' }}>{fmt(l.media)}</td>
                  <td>{fmt(l.menor)}</td>
                  <td>{fmt(l.maior)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
