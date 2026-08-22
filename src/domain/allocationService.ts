import type { Allocation, Collaborator, Holiday, User } from '../types/domain';

/** Resultado da resolução do monitor responsável, incluindo substituição por férias. */
export interface MonitorResolution {
  monitor: User | null | undefined;
  isSubstitute: boolean;
  originalMonitor: User | null | undefined;
}

// Regras de vigência de alocação e substituição por férias.
// Extraídas do App.jsx na F0-12 sem alteração de regra: as funções passaram a receber
// as coleções por parâmetro em vez de lê-las por closure do componente.

// Uma alocação está vigente na data se estiver ativa e a data cair dentro do período
// (endDate nulo significa vigência em aberto).
export const isAllocationActiveForDate = (alloc: Allocation, dateStr: string): boolean => {
  const target = new Date(dateStr);
  const start = new Date(alloc.startDate);
  const end = alloc.endDate ? new Date(alloc.endDate) : null;

  return alloc.active && target >= start && (!end || target <= end);
};

// Resolve o monitor responsável por um colaborador em uma data, considerando
// substituição por férias quando houver.
/**
 * Carteira vigente de um monitor numa data: as colaboradoras por quem ele responde.
 *
 * 2A.3: esta regra já existia, escrita inline em dois pontos do Dashboard, e faltava
 * exatamente onde mais importava — `getUnmonitoredCollaborators` varria TODAS as
 * colaboradoras cadastradas, de modo que "quem falta monitorar" listava gente que não é da
 * carteira de ninguém. É a base da futura fila operacional: uma fila que não é escopada não
 * é uma fila, é uma lista.
 *
 * Respeita substituição por férias, porque delega a `getActiveMonitorForColab`: durante o
 * período de férias, a carteira responde ao monitor substituto.
 */
export const getCarteira = (
  ctx: { allocations?: Allocation[]; holidays?: Holiday[]; users?: User[] },
  collaborators: Collaborator[],
  monitorId: string,
  dateStr: string
): Collaborator[] =>
  collaborators.filter((c) => {
    const { monitor } = getActiveMonitorForColab(ctx, c.id, dateStr);
    return Boolean(monitor && monitor.id === monitorId);
  });

/** Colaboradoras sem vínculo vigente — não entram em carteira nem em meta nenhuma. */
export const getSemVinculo = (
  ctx: { allocations?: Allocation[]; holidays?: Holiday[]; users?: User[] },
  collaborators: Collaborator[],
  dateStr: string
): Collaborator[] =>
  collaborators.filter((c) => !getActiveMonitorForColab(ctx, c.id, dateStr).monitor);

export const getActiveMonitorForColab = (
  { allocations = [], holidays = [], users = [] }: {
    allocations?: Allocation[];
    holidays?: Holiday[];
    users?: User[];
  },
  colaboradorId: string,
  dateStr: string
): MonitorResolution => {
  const alloc = allocations.find(
    (a) => a.colaboradorId === colaboradorId && isAllocationActiveForDate(a, dateStr)
  );
  if (!alloc) return { monitor: null, isSubstitute: false, originalMonitor: null };

  const targetDate = new Date(dateStr);
  const holidaySub = holidays.find((h) => {
    if (!h.isActive) return false;
    const start = new Date(h.startDate);
    const end = new Date(h.endDate);
    return h.originalMonitorId === alloc.monitorId && targetDate >= start && targetDate <= end;
  });

  if (holidaySub) {
    const substitute = users.find((u) => u.id === holidaySub.substituteMonitorId);
    const original = users.find((u) => u.id === alloc.monitorId);
    return { monitor: substitute, isSubstitute: true, originalMonitor: original };
  }

  const monitor = users.find((u) => u.id === alloc.monitorId);
  return { monitor, isSubstitute: false, originalMonitor: null };
};
