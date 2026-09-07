// Metas e progresso de carteira num período de competência.
//
// A meta por colaboradora é a ÚNICA fonte da verdade. Existia também uma meta global por
// monitor, e o alvo era `Math.max(metaGlobal, somaDasMetasPorColaboradora)` — duas metas
// concorrentes resolvidas escolhendo a maior, sem que nada na tela dissesse qual venceu. A
// leitura saiu na 2A.2; o formulário que a alimentava saiu na 2A.4.
//
// 2A.6.2 — META POR CANAL. Uma colaboradora pode ter meta GERAL (qualquer canal atende) ou
// meta POR CANAL (5 de WhatsApp e 5 de Ligação, por exemplo). As duas formas são mutuamente
// exclusivas: ter as duas não tem resposta certa, porque o canal abateria a geral ou somaria
// a ela, e o sistema não deve escolher sozinho.
//
// A CONSEQUÊNCIA MENOS ÓBVIA é aritmética: com meta por canal, excedente num canal não pode
// cobrir déficit em outro. Meta 5+5, realizado 6 de WhatsApp e 0 de Ligação:
//
//   errado:   faltam 10 - 6 = 4      e progresso 6/10 = 60%
//   correto:  faltam  0 + 5 = 5      e progresso 5/10 = 50%
//
// Por isso `completed` deixou de existir como número único e virou dois:
//
//   entregues  — o que a pessoa fez, sem teto. No exemplo, 6.
//   cobertura  — quanto disso fecha meta, com teto por escopo. No exemplo, 5.
//
// Os dois precisam existir juntos. Só cobertura faria a sexta monitoria de WhatsApp sumir da
// tela, e trabalho que some é o defeito que a 2A vem corrigindo desde o começo.
//
// Regra que atravessa o módulo: sem meta cadastrada, a resposta é a AUSÊNCIA de meta, nunca
// um número. Foi um fallback `|| 5` no Dashboard que motivou esta separação.

import type { Canal, ColaboradorGoal, Monitoring } from '../types/domain';
import type { Period } from './period';
import { naCompetencia } from './period';
import {
  countsForCarteiraGoal,
  countsOutsideCarteira,
  isValidated,
  isAwaitingValidation,
} from './monitoringRules';

// ---------------------------------------------------------------------------
// Leitura de metas
// ---------------------------------------------------------------------------

/** Metas de um monitor no período. Uma linha por escopo: geral, ou uma por canal. */
export const getGoalsForPeriod = (
  goals: ColaboradorGoal[],
  monitorId: string,
  period: Period
): ColaboradorGoal[] =>
  goals.filter(
    (g) => g.monitorId === monitorId && g.year === period.year && g.month === period.month
  );

/** Metas de uma colaboradora no período. */
export const getGoalsDaColaboradora = (
  goals: ColaboradorGoal[],
  monitorId: string,
  colaboradorId: string,
  period: Period
): ColaboradorGoal[] =>
  getGoalsForPeriod(goals, monitorId, period).filter((g) => g.colaboradorId === colaboradorId);

/**
 * Forma da meta de uma colaboradora.
 *
 * União discriminada de propósito: não é possível representar "geral + por canal" neste tipo,
 * então a regra de exclusividade deixa de depender de disciplina e passa a depender do
 * compilador. E 'nenhuma' torna impossível confundir ausência de meta com meta zero.
 */
export type MetaColaboradora =
  | { tipo: 'nenhuma' }
  | { tipo: 'geral'; alvo: number }
  | { tipo: 'por-canal'; porCanal: { canal: Canal; alvo: number }[]; alvo: number };

export const getMetaDaColaboradora = (
  goals: ColaboradorGoal[],
  monitorId: string,
  colaboradorId: string,
  period: Period
): MetaColaboradora => {
  const linhas = getGoalsDaColaboradora(goals, monitorId, colaboradorId, period);
  if (linhas.length === 0) return { tipo: 'nenhuma' };

  const porCanal = linhas.filter((g) => Boolean(g.canal));

  // Estado proibido, defendido por assertMetasConsistentes. Se chegar aqui mesmo assim, a
  // meta por canal prevalece: é a mais específica, e ignorá-la faria a fila apontar o canal
  // errado — pior do que ignorar um total.
  if (porCanal.length > 0) {
    return {
      tipo: 'por-canal',
      porCanal: porCanal.map((g) => ({ canal: g.canal as Canal, alvo: g.targetQty })),
      alvo: porCanal.reduce((soma, g) => soma + g.targetQty, 0),
    };
  }

  return { tipo: 'geral', alvo: linhas.reduce((soma, g) => soma + g.targetQty, 0) };
};

/** Total da carteira no período: a soma de todas as linhas de meta, gerais ou por canal. */
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

// ---------------------------------------------------------------------------
// Progresso por escopo
// ---------------------------------------------------------------------------

/** Progresso de um escopo de meta: um canal específico, ou o geral. */
export interface EscopoProgresso {
  /** null quando a meta é geral: qualquer canal atende. */
  canal: Canal | null;
  alvo: number;
  /** O que foi entregue neste escopo, sem teto. */
  entregues: number;
  /** Quanto disso fecha meta: min(entregues, alvo). */
  cobertura: number;
  /** Quanto ainda falta: max(0, alvo − entregues). */
  falta: number;
  /** Entregue além do alvo. Não cobre déficit de outro canal, mas não some da tela. */
  excedente: number;
  validadas: number;
  aguardando: number;
}

/** As monitorias que abatem um escopo de meta. */
const doEscopo = (
  monitorings: Monitoring[],
  goal: ColaboradorGoal,
  period: Period
): Monitoring[] =>
  monitorings.filter(
    (m) =>
      m.monitorId === goal.monitorId &&
      m.colaboradorId === goal.colaboradorId &&
      naCompetencia(m.competencia, period) &&
      countsForCarteiraGoal(m) &&
      (!goal.canal || m.canal === goal.canal)
  );

/** Progresso de uma linha de meta. Usado tanto pelo quadro de metas quanto pela fila. */
export const getEscopoProgresso = (
  goal: ColaboradorGoal,
  monitorings: Monitoring[],
  period: Period
): EscopoProgresso => {
  const feitas = doEscopo(monitorings, goal, period);
  const entregues = feitas.length;
  const alvo = goal.targetQty;

  return {
    canal: goal.canal ?? null,
    alvo,
    entregues,
    cobertura: Math.min(entregues, alvo),
    falta: Math.max(0, alvo - entregues),
    excedente: Math.max(0, entregues - alvo),
    validadas: feitas.filter(isValidated).length,
    aguardando: feitas.filter(isAwaitingValidation).length,
  };
};

/** Escopos de uma colaboradora, na ordem em que as metas foram cadastradas. */
export const getEscoposDaColaboradora = (
  goals: ColaboradorGoal[],
  monitorings: Monitoring[],
  monitorId: string,
  colaboradorId: string,
  period: Period
): EscopoProgresso[] =>
  getGoalsDaColaboradora(goals, monitorId, colaboradorId, period).map((g) =>
    getEscopoProgresso(g, monitorings, period)
  );

// ---------------------------------------------------------------------------
// Progresso da carteira
// ---------------------------------------------------------------------------

export interface CarteiraProgress {
  /** Soma das metas do período. 0 quando não há meta — distinga por hasGoal. */
  target: number;
  hasGoal: boolean;
  /** Trabalho entregue na carteira, sem teto. Inclui excedente e canal sem meta. */
  entregues: number;
  /** Quanto do entregue fecha meta. Excedente de um canal NÃO cobre déficit de outro. */
  cobertura: number;
  /** Soma dos déficits por escopo. Nunca `target − entregues`. */
  remaining: number;
  validated: number;
  awaiting: number;
  /** Entregue além do alvo de algum escopo. */
  excedente: number;
  /** Entregue em canal sem meta, ou de colaboradora sem meta. Não abate quota. */
  outOfGoal: number;
  /** Direcionadas e calibrações. Não abatem quota. */
  outOfCarteira: number;
  /** cobertura / target. */
  progressPct: number;
}

export const getCarteiraProgress = (
  goals: ColaboradorGoal[],
  monitorings: Monitoring[],
  monitorId: string,
  period: Period
): CarteiraProgress => {
  const { target, hasGoal } = getCarteiraTarget(goals, monitorId, period);

  const doPeriodo = monitorings.filter(
    (m) => m.monitorId === monitorId && naCompetencia(m.competencia, period)
  );
  const daCarteira = doPeriodo.filter(countsForCarteiraGoal);

  const linhas = getGoalsForPeriod(goals, monitorId, period);
  const escopos = linhas.map((g) => getEscopoProgresso(g, monitorings, period));

  const soma = (f: (e: EscopoProgresso) => number) => escopos.reduce((s, e) => s + f(e), 0);

  const cobertura = soma((e) => e.cobertura);
  const excedente = soma((e) => e.excedente);

  // Identidade que mantém tudo somando: nada entregue fica sem classificação.
  //   entregues = cobertura + excedente + outOfGoal
  const outOfGoal = Math.max(0, daCarteira.length - cobertura - excedente);

  return {
    target,
    hasGoal,
    entregues: daCarteira.length,
    cobertura,
    remaining: soma((e) => e.falta),
    validated: daCarteira.filter(isValidated).length,
    awaiting: daCarteira.filter(isAwaitingValidation).length,
    excedente,
    outOfGoal,
    outOfCarteira: doPeriodo.filter(countsOutsideCarteira).length,
    progressPct: target > 0 ? Math.min(100, Math.round((cobertura / target) * 100)) : 0,
  };
};

// ---------------------------------------------------------------------------
// Consistência
// ---------------------------------------------------------------------------

/**
 * Verifica se as metas do período são cadastráveis.
 *
 * Devolve a lista de violações, vazia quando está tudo certo. Mesmo padrão de
 * `assertRouteAccessIsConsistent`, criado na F0-14 para que um erro de cadastro não vire
 * regra silenciosa: aqui, uma colaboradora com meta geral e por canal ao mesmo tempo faria
 * a fila apontar um alvo que ninguém definiu.
 */
export const assertMetasConsistentes = (
  goals: ColaboradorGoal[],
  period: Period
): string[] => {
  const doPeriodo = goals.filter((g) => g.year === period.year && g.month === period.month);
  const porColaboradora = new Map<string, ColaboradorGoal[]>();

  for (const g of doPeriodo) {
    const chave = `${g.monitorId}::${g.colaboradorId}`;
    porColaboradora.set(chave, [...(porColaboradora.get(chave) ?? []), g]);
  }

  const violacoes: string[] = [];

  for (const [chave, linhas] of porColaboradora) {
    const [, colaboradorId] = chave.split('::');
    const gerais = linhas.filter((g) => !g.canal);
    const canais = linhas.filter((g) => Boolean(g.canal));

    if (gerais.length > 0 && canais.length > 0) {
      violacoes.push(
        `${colaboradorId}: tem meta geral e meta por canal no mesmo período — as duas formas são mutuamente exclusivas`
      );
    }
    if (gerais.length > 1) {
      violacoes.push(`${colaboradorId}: tem ${gerais.length} metas gerais no mesmo período`);
    }

    const vistos = new Set<string>();
    for (const g of canais) {
      const canal = g.canal as string;
      if (vistos.has(canal)) {
        violacoes.push(`${colaboradorId}: tem mais de uma meta para o canal ${canal}`);
      }
      vistos.add(canal);
    }
  }

  return violacoes;
};
