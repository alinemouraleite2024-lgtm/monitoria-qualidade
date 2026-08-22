// A fila operacional do mês — o que a tela de Monitorias precisa responder.
//
// Este módulo NÃO tem regra própria. Ele compõe os quatro serviços da Fatia 2A:
//
//   period            que mês é este, e o que cai dentro dele
//   monitoringRules   o que conta, o que conta à parte, o que não conta
//   allocationService de quem é esta colaboradora
//   goalService       qual a meta, e quanto dela já está coberto
//
// O contrato combinado para a 2B é que nenhuma regra viva nos componentes React. Ordenação
// entra nesse contrato: a ordem em que a fila apresenta as colaboradoras É o produto — é ela
// que responde "o que eu preciso fazer agora" em vez de "o que existe". Por isso a ordenação
// mora aqui, e não numa chamada a .sort() dentro de um componente.
//
// A pergunta da tela mudou de "quem falta monitorar" para "o que falta monitorar dessa
// pessoa": com meta por canal, a unidade de trabalho é o par (colaboradora, canal).

import type { Canal, Collaborator, Holiday, Monitoring, User } from '../types/domain';
import type { Period } from './period';
import { isInPeriod, parseData } from './period';
import { getCarteira } from './allocationService';
import {
  countsForCarteiraGoal,
  countsOutsideCarteira,
  isAwaitingValidation,
} from './monitoringRules';
import {
  getMetaDaColaboradora,
  getEscoposDaColaboradora,
  type EscopoProgresso,
  type MetaColaboradora,
} from './goalService';
import type { ColaboradorGoal } from '../types/domain';

/** Coleções que a fila precisa consultar. Passadas por parâmetro, nunca lidas por closure. */
export interface FilaContexto {
  monitorings: Monitoring[];
  goals: ColaboradorGoal[];
  collaborators: Collaborator[];
  allocations?: import('../types/domain').Allocation[];
  holidays?: Holiday[];
  users?: User[];
}

// ---------------------------------------------------------------------------
// Zona 2 — quem falta monitorar, e de que canal
// ---------------------------------------------------------------------------

export interface LinhaDaFila {
  colaborador: Collaborator;
  meta: MetaColaboradora;
  /** Escopos ordenados por lacuna: o primeiro é a próxima ação. */
  escopos: EscopoProgresso[];
  alvo: number;
  cobertura: number;
  falta: number;
  /** Data da última monitoria que conta, em ISO. Null quando nunca houve. */
  ultimaEm: string | null;
  /** Canal a monitorar em seguida. `null` com meta geral; indefinido quando em dia. */
  proximaAcao: { canal: Canal | null } | undefined;
  emDia: boolean;
}

const dataDaUltima = (
  monitorings: Monitoring[],
  monitorId: string,
  colaboradorId: string,
  period: Period
): string | null => {
  const datas = monitorings
    .filter(
      (m) =>
        m.monitorId === monitorId &&
        m.colaboradorId === colaboradorId &&
        isInPeriod(m.date, period) &&
        countsForCarteiraGoal(m)
    )
    .map((m) => m.date)
    .sort();
  return datas.length > 0 ? datas[datas.length - 1] : null;
};

/**
 * A fila da carteira, ordenada por urgência.
 *
 * A ordem é a resposta da tela, nesta precedência:
 *   1. quem não tem nenhuma monitoria válida no mês;
 *   2. quem tem a maior lacuna;
 *   3. quem está há mais tempo sem ser avaliada;
 *   4. quem está em dia, por último.
 *
 * Colaboradora sem meta cadastrada entra na fila com `meta.tipo === 'nenhuma'`: a tela precisa
 * dizer que falta meta, e não escondê-la nem inventar um alvo.
 */
export const getFilaDaCarteira = (
  ctx: FilaContexto,
  monitorId: string,
  period: Period,
  dateStr: string
): LinhaDaFila[] => {
  const { monitorings, goals, collaborators, allocations = [], holidays = [], users = [] } = ctx;

  const carteira = getCarteira({ allocations, holidays, users }, collaborators, monitorId, dateStr);

  const linhas: LinhaDaFila[] = carteira.map((colaborador) => {
    const meta = getMetaDaColaboradora(goals, monitorId, colaborador.id, period);
    const escopos = getEscoposDaColaboradora(
      goals,
      monitorings,
      monitorId,
      colaborador.id,
      period
    ).sort((a, b) => b.falta - a.falta);

    const alvo = escopos.reduce((s, e) => s + e.alvo, 0);
    const cobertura = escopos.reduce((s, e) => s + e.cobertura, 0);
    const falta = escopos.reduce((s, e) => s + e.falta, 0);
    const proximo = escopos.find((e) => e.falta > 0);

    return {
      colaborador,
      meta,
      escopos,
      alvo,
      cobertura,
      falta,
      ultimaEm: dataDaUltima(monitorings, monitorId, colaborador.id, period),
      proximaAcao: proximo ? { canal: proximo.canal } : undefined,
      emDia: meta.tipo !== 'nenhuma' && falta === 0,
    };
  });

  return linhas.sort((a, b) => {
    if (a.emDia !== b.emDia) return a.emDia ? 1 : -1;

    const aZerada = a.cobertura === 0;
    const bZerada = b.cobertura === 0;
    if (aZerada !== bZerada) return aZerada ? -1 : 1;

    if (a.falta !== b.falta) return b.falta - a.falta;

    // Há mais tempo sem avaliação primeiro; nunca avaliada vem antes de todas.
    if (a.ultimaEm === null && b.ultimaEm !== null) return -1;
    if (b.ultimaEm === null && a.ultimaEm !== null) return 1;
    if (a.ultimaEm && b.ultimaEm && a.ultimaEm !== b.ultimaEm) {
      return a.ultimaEm < b.ultimaEm ? -1 : 1;
    }
    return a.colaborador.name.localeCompare(b.colaborador.name, 'pt-BR');
  });
};

// ---------------------------------------------------------------------------
// Zona 3 — o que precisa da ação da monitora
// ---------------------------------------------------------------------------

export interface Pendencias {
  /** Devolvidas pela gestora: voltaram a Rascunho COM motivo registrado. */
  devolvidas: Monitoring[];
  /** Rascunhos comuns: começados e não terminados. */
  rascunhos: Monitoring[];
}

const foiDevolvida = (m: Monitoring): boolean =>
  m.status === 'Rascunho' && Boolean(m.adjustmentReason && m.adjustmentReason.trim());

/**
 * Separa devolvida de rascunho comum.
 *
 * As duas têm o mesmo status no dado — a devolução reutiliza `Rascunho` de propósito, para não
 * inventar vocabulário de status. O que as distingue é o motivo registrado pela gestora, e é
 * essa distinção que faz a tela dizer "corrigir" em vez de "retomar".
 */
export const getPendencias = (
  monitorings: Monitoring[],
  monitorId: string,
  period: Period
): Pendencias => {
  const minhas = monitorings.filter(
    (m) => m.monitorId === monitorId && isInPeriod(m.date, period)
  );
  return {
    devolvidas: minhas.filter(foiDevolvida),
    rascunhos: minhas.filter((m) => m.status === 'Rascunho' && !foiDevolvida(m)),
  };
};

// ---------------------------------------------------------------------------
// Zona 4 — aguardando validação
// ---------------------------------------------------------------------------

export interface NaFilaDeValidacao {
  monitoring: Monitoring;
  /** Dias corridos desde a referência abaixo. */
  dias: number;
  /**
   * A referência é exata? Hoje o registro não guarda a data de envio, só a data do
   * atendimento. Enquanto não houver `submittedAt`, a contagem parte da data do atendimento
   * e este campo diz à tela para não afirmar "enviada há N dias" como se fosse exato.
   */
  referenciaExata: boolean;
}

const diasEntre = (deISO: string, ateISO: string): number => {
  const de = parseData(deISO);
  const ate = parseData(ateISO);
  const ms = ate.setHours(0, 0, 0, 0) - de.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86400000));
};

const paraFila = (m: Monitoring, hojeISO: string): NaFilaDeValidacao => ({
  monitoring: m,
  dias: diasEntre(m.date, hojeISO),
  referenciaExata: false,
});

/** Monitorias de um monitor esperando a gestora, das mais antigas para as mais recentes. */
export const getAguardandoValidacao = (
  monitorings: Monitoring[],
  monitorId: string,
  period: Period,
  hojeISO: string
): NaFilaDeValidacao[] =>
  monitorings
    .filter((m) => m.monitorId === monitorId && isInPeriod(m.date, period) && isAwaitingValidation(m))
    .map((m) => paraFila(m, hojeISO))
    .sort((a, b) => b.dias - a.dias);

/** A fila da gestora: tudo que espera validação no período, de todos os monitores. */
export const getFilaDeValidacao = (
  monitorings: Monitoring[],
  period: Period,
  hojeISO: string
): NaFilaDeValidacao[] =>
  monitorings
    .filter((m) => isInPeriod(m.date, period) && isAwaitingValidation(m))
    .map((m) => paraFila(m, hojeISO))
    .sort((a, b) => b.dias - a.dias);

// ---------------------------------------------------------------------------
// Trabalho fora da quota
// ---------------------------------------------------------------------------

export interface ForaDaQuota {
  /** Direcionadas e calibrações: contam à parte por decisão de produto. */
  outroTipo: Monitoring[];
  /** Canal sem meta, ou colaboradora sem meta: entregue, mas não abate quota de ninguém. */
  semMeta: Monitoring[];
}

/**
 * O que foi entregue e não abate quota.
 *
 * Existe para que nenhum trabalho desapareça da tela — o mesmo princípio que fez `entregues` e
 * `cobertura` serem dois números no goalService. Uma direcionada da Allanis não fecha a quota
 * dela, mas foi feita, e a tela precisa poder explicar por que o número não fechou.
 */
export const getForaDaQuota = (
  ctx: FilaContexto,
  monitorId: string,
  period: Period
): ForaDaQuota => {
  const { monitorings, goals } = ctx;
  const doPeriodo = monitorings.filter(
    (m) => m.monitorId === monitorId && isInPeriod(m.date, period)
  );

  const semMeta = doPeriodo.filter((m) => {
    if (!countsForCarteiraGoal(m)) return false;
    const meta = getMetaDaColaboradora(goals, monitorId, m.colaboradorId, period);
    if (meta.tipo === 'nenhuma') return true;
    if (meta.tipo === 'geral') return false;
    return !meta.porCanal.some((p) => p.canal === m.canal);
  });

  return {
    outroTipo: doPeriodo.filter(countsOutsideCarteira),
    semMeta,
  };
};

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

/**
 * Busca discreta da fila: protocolo, código e colaboradora.
 *
 * O protocolo vem primeiro de propósito — é a chave que liga a monitoria ao atendimento e,
 * adiante, ao CSAT e ao NPS. A busca existe na fila para que a monitora não precise ir a
 * Relatórios só para localizar um protocolo.
 */
export const matchesBusca = (
  m: Monitoring,
  termo: string,
  nomeColaboradora?: string
): boolean => {
  const t = termo.trim().toLowerCase();
  if (!t) return true;
  return (
    (m.protocolo ?? '').toLowerCase().includes(t) ||
    m.id.toLowerCase().includes(t) ||
    (nomeColaboradora ?? '').toLowerCase().includes(t)
  );
};
