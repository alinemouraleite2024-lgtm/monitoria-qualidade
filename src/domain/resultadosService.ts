// Resultados de qualidade — quantidades e notas de um conjunto de monitorias (25/10/2026).
//
// Até aqui o portal não tinha média nenhuma: o Painel mostrava só quantidade contra meta, e o
// gráfico "Evolução Mensal" era um desenho fixo, igual para qualquer equipe e qualquer mês.
// Para o acompanhamento gerencial, as notas precisam sair dos registros, com uma regra só.
//
// A REGRA DA MÉDIA é a mesma da contagem de meta (`countsTowardGoal`): entra o trabalho
// entregue — Pendente, Validada, Concluída. Rascunho ainda não tem nota (o banco calcula no
// envio), e Reprovada e Cancelada não são resultado válido. Monitoria zerada por eliminatório
// entra com a nota que tem: é resultado real, e tirá-la inflaria a média.
//
// Nada aqui decide escopo nem filtro: quem chama entrega o conjunto (a competência, os filtros
// de Relatórios, a equipe do gestor), e o mesmo conjunto alimenta tela e exportação.

import type { Monitoring } from '../types/domain';
import { statusParaExibir } from './areaPrivada';
import { countsTowardGoal } from './monitoringRules';
import type { Period } from './period';
import { naCompetencia, periodLabel, previousPeriod } from './period';

const arred = (n: number) => Math.round(n * 100) / 100;

/** A monitoria entra na média? Mesma régua da contagem de meta. */
export const entraNaMedia = (m: Monitoring): boolean =>
  countsTowardGoal(m) && typeof m.finalScore === 'number' && Number.isFinite(m.finalScore);

export interface ResumoNotas {
  /** Todas as monitorias do conjunto, em qualquer situação. */
  total: number;
  /** As que entram na média. */
  consideradas: number;
  /** `null` quando nenhuma entra — ausência de nota não é nota zero. */
  media: number | null;
  menor: number | null;
  maior: number | null;
  zeradas: number;
  porStatus: Record<string, number>;
}

export const resumirNotas = (monitorias: Monitoring[]): ResumoNotas => {
  const validas = monitorias.filter(entraNaMedia);
  const notas = validas.map((m) => m.finalScore);
  const porStatus: Record<string, number> = {};
  for (const m of monitorias) { const s = statusParaExibir(m); porStatus[s] = (porStatus[s] ?? 0) + 1; }
  return {
    total: monitorias.length,
    consideradas: validas.length,
    media: notas.length ? arred(notas.reduce((s, n) => s + n, 0) / notas.length) : null,
    menor: notas.length ? Math.min(...notas) : null,
    maior: notas.length ? Math.max(...notas) : null,
    zeradas: validas.filter((m) => m.zerada === true).length,
    porStatus,
  };
};

export interface ResultadoColaboradora extends ResumoNotas {
  colaboradorId: string;
  nome: string;
}

/** Resultados por colaboradora, em ordem alfabética. Quem não tem nome cadastrado aparece pelo id. */
export const resultadosPorColaboradora = (
  monitorias: Monitoring[],
  nomeDe: (colaboradorId: string) => string | undefined,
): ResultadoColaboradora[] => {
  const grupos = new Map<string, Monitoring[]>();
  for (const m of monitorias) grupos.set(m.colaboradorId, [...(grupos.get(m.colaboradorId) ?? []), m]);
  return [...grupos.entries()]
    .map(([colaboradorId, ms]) => ({
      colaboradorId,
      nome: nomeDe(colaboradorId) ?? (colaboradorId || 'Sem colaboradora'),
      ...resumirNotas(ms),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
};

export interface PontoEvolucao {
  periodo: Period;
  rotulo: string;
  consideradas: number;
  media: number | null;
}

/** As `meses` competências até `ate` (inclusive), da mais antiga para a mais recente. */
export const evolucaoMensal = (monitorias: Monitoring[], ate: Period, meses = 6): PontoEvolucao[] => {
  const periodos: Period[] = [];
  let p = ate;
  for (let i = 0; i < meses; i += 1) { periodos.unshift(p); p = previousPeriod(p); }
  return periodos.map((periodo) => {
    const r = resumirNotas(monitorias.filter((m) => naCompetencia(m.competencia, periodo)));
    return { periodo, rotulo: periodLabel(periodo), consideradas: r.consideradas, media: r.media };
  });
};

/** Nota para exibição: rascunho ainda não tem nota, e mostrar "0,00%" diria que tem. */
export const notaParaExibir = (m: Monitoring): string =>
  m.status === 'Rascunho' ? '—' : `${m.finalScore.toFixed(2)}%`;
