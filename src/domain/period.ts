// Período de competência — o mês a que um número operacional se refere.
//
// Antes da 2A.1 não existia essa noção: a data corrente era a constante
// `SYSTEM_TODAY = '2026-06-05'` e o mês aparecia como literal `5` espalhado por seis pontos
// diferentes do código. Meta, progresso, dias úteis e "quem falta" respondiam todos sobre
// junho de 2026, em agosto, sem que nenhuma tela dissesse isso.
//
// CONVENÇÃO CRÍTICA: `month` é 0-indexado (janeiro = 0, junho = 5, agosto = 7), porque é
// assim que os dados já estão gravados — `MonitorGoal.month` e `ColaboradorGoal.month` usam
// `5` para junho, e o código antigo comparava com `new Date(...).getMonth()`. Trocar para
// 1-indexado deslocaria todas as metas existentes em um mês, em silêncio. Toda função aqui
// mantém a convenção do dado.

import { getBusinessDaysRemaining } from '../shared/utils/businessDays';

/** Mês de competência. `month` é 0-indexado, como em `Date.prototype.getMonth`. */
export interface Period {
  year: number;
  month: number;
}

/** Data de hoje no formato ISO curto (YYYY-MM-DD), que é o formato usado nos registros. */
export const todayISO = (): string => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
};

/** Período de competência corrente. */
export const getCurrentPeriod = (): Period => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
};

/**
 * Converte uma data do sistema em Date, no fuso LOCAL.
 *
 * `new Date('2026-08-01')` é interpretado pelo JavaScript como meia-noite UTC — que em
 * Brasília (UTC-3) é 31 de julho às 21h. Sem este tratamento, `periodOf('2026-08-01')`
 * devolve julho, `isInPeriod` recusa o primeiro dia do mês e os dias úteis restantes zeram
 * no dia 1º. As monitorias escapam por acaso, porque são gravadas com `T12:00:00Z` e meio-dia
 * UTC cai no mesmo dia do calendário em qualquer fuso do Brasil; as datas puras, não.
 *
 * String com hora é entregue ao construtor como está; `YYYY-MM-DD` é montada componente a
 * componente, que é a única forma de obter meia-noite local.
 */
export const parseData = (dateStr: string): Date => {
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!soData) return new Date(dateStr);
  return new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]));
};

/** Período a que uma data pertence. Aceita tanto `YYYY-MM-DD` quanto ISO com hora. */
export const periodOf = (dateStr: string): Period => {
  const d = parseData(dateStr);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const samePeriod = (a: Period, b: Period): boolean =>
  a.year === b.year && a.month === b.month;

/**
 * A data cai no período?
 *
 * Confere ano E mês. A checagem só por mês, que existia na Home do monitor, faz agosto de
 * 2025 contar junto com agosto de 2026 — o erro fica invisível no primeiro ano de uso.
 */
export const isInPeriod = (dateStr: string, period: Period): boolean =>
  samePeriod(periodOf(dateStr), period);

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Rótulo de exibição: "Agosto de 2026". */
export const periodLabel = (period: Period): string =>
  `${MESES[period.month]} de ${period.year}`;

/** Rótulo curto, para seletores: "Agosto". */
export const monthLabel = (period: Period): string => MESES[period.month];

/** Período anterior, atravessando a virada de ano. */
export const previousPeriod = ({ year, month }: Period): Period =>
  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };

/** Período seguinte, atravessando a virada de ano. */
export const nextPeriod = ({ year, month }: Period): Period =>
  month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

/**
 * Primeiro e último dia do período, em YYYY-MM-DD.
 *
 * Usa `new Date(year, month + 1, 0)` para o último dia, que resolve fevereiro e ano
 * bissexto sem tabela de dias por mês.
 */
export const periodRange = ({ year, month }: Period): { startDate: string; endDate: string } => {
  const mm = String(month + 1).padStart(2, '0');
  const ultimoDia = new Date(year, month + 1, 0).getDate();
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
  };
};

/**
 * Dias úteis restantes no período, a partir de (mas sem incluir) a data informada.
 *
 * Devolve 0 quando a data está fora do período — perguntar quantos dias úteis restam de
 * julho estando em agosto não tem resposta útil, e devolver o mês inteiro seria pior.
 */
export const businessDaysRemainingIn = (
  period: Period,
  fromDateStr: string = todayISO()
): number => {
  if (!isInPeriod(fromDateStr, period)) return 0;
  return getBusinessDaysRemaining(period.year, period.month, fromDateStr);
};
