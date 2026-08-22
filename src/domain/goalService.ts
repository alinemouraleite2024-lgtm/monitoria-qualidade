// Metas e progresso de carteira num período de competência.
//
// A meta por colaboradora é a ÚNICA fonte da verdade. Existia também uma meta global por
// monitor, e o alvo era `Math.max(metaGlobal, somaDasMetasPorColaboradora)` — duas metas
// concorrentes resolvidas escolhendo a maior, sem que nada na tela dissesse qual venceu. A
// leitura da meta global saiu na 2A.2; o formulário que a alimentava saiu na 2A.4.
//
// Regra que atravessa todo este módulo: quando não há meta cadastrada para o período, a
// resposta é a AUSÊNCIA de meta (`hasGoal: false`), nunca um número. Nenhuma função aqui
// inventa alvo — foi um fallback `|| 5` no Dashboard que motivou esta separação.

import type { ColaboradorGoal, Monitoring } from '../types/domain';
import type { Period } from './period';
import { isInPeriod } from './period';
import {
  countsForCarteiraGoal,
  countsOutsideCarteira,
  isValidated,
  isAwaitingValidation,
} from './monitoringRules';

/** Metas de um monitor no período. */
export const getGoalsForPeriod = (
  goals: ColaboradorGoal[],
  monitorId: string,
  period: Period
): ColaboradorGoal[] =>
  goals.filter(
    (g) => g.monitorId === monitorId && g.year === period.year && g.month === period.month
  );

/** Meta de uma colaboradora no período. `null` significa "não há meta" — nunca 0 nem 5. */
export const getGoalFor = (
  goals: ColaboradorGoal[],
  monitorId: string,
  colaboradorId: string,
  period: Period
): number | null => {
  const g = getGoalsForPeriod(goals, monitorId, period).find(
    (x) => x.colaboradorId === colaboradorId
  );
  return g ? g.targetQty : null;
};

/** Total da carteira no período: a soma das metas por colaboradora. */
export const getCarteiraTarget = (
  goals: ColaboradorGoal[],
  monitorId: string,
  period: Period
): { target: number; hasGoal: boolean } => {
  const metas = getGoalsForPeriod(goals, monitorId, period);
  return {
    target: metas.reduce((soma, g) => soma + g.targetQty, 0),
    hasGoal: metas.length > 0,
  };
};

export interface CarteiraProgress {
  /** Soma das metas por colaboradora no período. 0 quando não há meta — ver hasGoal. */
  target: number;
  /** Há ao menos uma meta cadastrada no período? Distingue "meta zero" de "sem meta". */
  hasGoal: boolean;
  /** Entregues que abatem quota. Conta no envio: Pendente entra junto com Validada. */
  completed: number;
  /** Subconjunto de completed já validado pela gestora. */
  validated: number;
  /** Subconjunto de completed ainda na fila da gestora. */
  awaiting: number;
  /** Direcionadas e calibrações entregues: contam à parte, sem abater quota. */
  outOfCarteira: number;
  remaining: number;
  progressPct: number;
}

/** Progresso de um monitor no período. */
export const getCarteiraProgress = (
  goals: ColaboradorGoal[],
  monitorings: Monitoring[],
  monitorId: string,
  period: Period
): CarteiraProgress => {
  const { target, hasGoal } = getCarteiraTarget(goals, monitorId, period);

  const doPeriodo = monitorings.filter(
    (m) => m.monitorId === monitorId && isInPeriod(m.date, period)
  );
  const daCarteira = doPeriodo.filter(countsForCarteiraGoal);

  const completed = daCarteira.length;

  return {
    target,
    hasGoal,
    completed,
    validated: daCarteira.filter(isValidated).length,
    awaiting: daCarteira.filter(isAwaitingValidation).length,
    outOfCarteira: doPeriodo.filter(countsOutsideCarteira).length,
    remaining: Math.max(0, target - completed),
    progressPct: target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0,
  };
};
