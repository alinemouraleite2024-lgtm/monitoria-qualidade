import type { Allocation, Holiday, User } from '../types/domain';

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
