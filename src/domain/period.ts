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
 * Período deslocado em `meses`, para trás quando negativo (0.24.0).
 *
 * Existe para a defasagem de competência, que precisa recuar N meses e não exatamente um.
 * Passa pelo `Date` em vez de fazer a aritmética à mão porque o vai-um de ano precisa valer
 * para qualquer deslocamento, e não só para a passagem de janeiro para dezembro.
 */
export const shiftPeriod = ({ year, month }: Period, meses: number): Period => {
  const d = new Date(year, month + meses, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/**
 * Competência que a agenda de um mês de trabalho audita (0.24.0).
 *
 * Com defasagem 1, trabalhar em setembro é auditar agosto. Com 0, é auditar o próprio mês.
 *
 * Existe como nome, e não como `shiftPeriod` solto nas telas, porque a relação entre os dois
 * meses é o conceito que a 0.24.0 introduz — e um `-defasagem` repetido em cada chamada é
 * como as duas convenções de mês viraram armadilha antes da 0.22.0.
 */
export const competenciaDaAgenda = (mesDeTrabalho: Period, defasagemMeses: number): Period =>
  shiftPeriod(mesDeTrabalho, -defasagemMeses);

/**
 * Situação de uma competência em relação ao mês de trabalho (25/10/2026).
 *
 *   padrao        é a que a agenda audita agora (mês de trabalho − defasagem);
 *   encerrada     anterior à padrão: o mês em que devia ser monitorada já passou;
 *   em-andamento  posterior à padrão, mas os atendimentos dela já começaram (com defasagem 1,
 *                 é o próprio mês corrente: outubro é monitorado em novembro);
 *   futura        nenhum atendimento dela aconteceu ainda.
 *
 * Até aqui a fila tratava tudo o que não era a padrão como "encerrada" — inclusive outubro,
 * que estava em curso. `monitoradaEm` é o mês de trabalho previsto para a competência.
 */
export const situacaoDaCompetencia = (
  competencia: Period,
  mesDeTrabalho: Period,
  defasagemMeses: number,
): { situacao: 'padrao' | 'encerrada' | 'em-andamento' | 'futura'; monitoradaEm: Period } => {
  const c = periodToCompetencia(competencia);
  const padrao = periodToCompetencia(competenciaDaAgenda(mesDeTrabalho, defasagemMeses));
  const monitoradaEm = shiftPeriod(competencia, defasagemMeses);
  if (c === padrao) return { situacao: 'padrao', monitoradaEm };
  if (c < padrao) return { situacao: 'encerrada', monitoradaEm };
  return { situacao: c <= periodToCompetencia(mesDeTrabalho) ? 'em-andamento' : 'futura', monitoradaEm };
};

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

// ---------------------------------------------------------------------------
// Competência gravada na monitoria (0.22.0)
// ---------------------------------------------------------------------------
//
// DUAS CONVENÇÕES DE MÊS, e a conversão entre elas acontece só aqui.
//
// `Period.month` é 0-indexado porque as metas já estão gravadas assim desde antes da 2A.1 —
// mudar deslocaria toda meta existente em um mês, em silêncio.
//
// `Monitoring.competencia` é 'YYYY-MM' com mês 1-indexado, porque '2026-08' precisa significar
// agosto para qualquer pessoa que abra o armazenamento. String também porque é comparável
// direto e ordenável, e porque não atravessa fuso: `periodOf` precisa de tratamento especial
// para não devolver julho no dia 1º de agosto, e a competência não tem esse problema.

/** Period -> 'YYYY-MM'. */
export const periodToCompetencia = ({ year, month }: Period): string =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

/** 'YYYY-MM' -> Period. Entrada inválida devolve o período corrente, nunca uma data impossível. */
export const competenciaToPeriod = (competencia: string): Period => {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia || '');
  if (!m) return getCurrentPeriod();
  return { year: Number(m[1]), month: Number(m[2]) - 1 };
};

/** Competência a que uma data pertence. Usada pela migração e pelo padrão do formulário. */
export const competenciaDe = (dateStr: string): string =>
  periodToCompetencia(periodOf(dateStr));

/** Rótulo de uma competência gravada: "Agosto de 2026". */
export const competenciaLabel = (competencia: string): string =>
  periodLabel(competenciaToPeriod(competencia));

/** A monitoria pertence a este período? Substitui `isInPeriod(m.date, period)`. */
export const naCompetencia = (competencia: string, period: Period): boolean =>
  competencia === periodToCompetencia(period);
