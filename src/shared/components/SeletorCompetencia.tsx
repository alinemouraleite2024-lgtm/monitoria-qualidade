import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  competenciaToPeriod,
  periodToCompetencia,
  periodLabel,
  previousPeriod,
  nextPeriod,
} from '../../domain/period';
import type { Period } from '../../domain/period';

/**
 * Seletor de competência — um só, usado por Metas, Painel e Relatórios (0.22.0).
 *
 * Até a 0.21.0, Metas e Painel respondiam sempre sobre `getCurrentPeriod()`: não havia como
 * cadastrar meta de agosto em setembro, nem consultar o mês fechado. Relatórios navegava, mas
 * só com setas — chegar a janeiro a partir de setembro custava oito cliques, e o histórico
 * desde janeiro é justamente o que a operação vai reconstruir.
 *
 * Setas **e** campo de mês: as setas servem ao passo curto (mês anterior, mês seguinte) e o
 * campo ao salto longo. Um sem o outro deixaria um dos dois usos caro.
 */
interface SeletorCompetenciaProps {
  periodo: Period;
  onChange: (p: Period) => void;
  /** Rótulo à esquerda. Omitido, não ocupa espaço. */
  titulo?: string;
}

export const SeletorCompetencia = ({ periodo, onChange, titulo }: SeletorCompetenciaProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
    {titulo && (
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {titulo}
      </span>
    )}

    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange(previousPeriod(periodo))}
        aria-label={`Ir para ${periodLabel(previousPeriod(periodo))}`}
        title={periodLabel(previousPeriod(periodo))}
      >
        <ChevronLeft size={15} />
      </button>

      <input
        type="month"
        className="form-control"
        style={{ width: '160px', textAlign: 'center' }}
        value={periodToCompetencia(periodo)}
        onChange={(e) => {
          // Campo de mês limpo não vira "período nenhum": a tela precisa sempre responder
          // sobre algum mês, e um estado vazio deixaria metas e indicadores sem eixo.
          if (e.target.value) onChange(competenciaToPeriod(e.target.value));
        }}
        aria-label="Competência"
      />

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onChange(nextPeriod(periodo))}
        aria-label={`Ir para ${periodLabel(nextPeriod(periodo))}`}
        title={periodLabel(nextPeriod(periodo))}
      >
        <ChevronRight size={15} />
      </button>
    </div>

    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
      {periodLabel(periodo)}
    </span>
  </div>
);
