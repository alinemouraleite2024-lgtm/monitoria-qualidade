// Mapa único entre os ids de aba (herdados do roteamento manual) e os paths reais.
//
// Decisão da F0-13: o path é idêntico ao id, sem tradução. Isso mantém MENU_CONFIG e
// tabPermissionMap funcionando sem camada de conversão — o id continua sendo a chave de
// permissão e de destaque de menu, e passa a ser também o segmento da URL.
//
// As duas exceções são as telas do formulário, que não vivem no menu e ganham hierarquia
// real sob /monitorings.

export const TABS: string[] = [
  'home', 'dashboard', 'planning', 'demands', 'my-demands', 'monitorings',
  'surveys', 'reports', 'allocations', 'users', 'roles', 'audit-logs',
  'admin', 'settings', 'integrations', 'history', 'calendar', 'op-calendar', 'profile',
];

export const MONITORING_NEW = 'monitoring-new';
export const MONITORING_EDIT = 'monitoring-edit';

// Rota de autenticação (F0-14). Fora de TABS de propósito: não é destino de menu nem tem
// entrada em tabPermissionMap — é a porta de entrada, avaliada antes do guard.
export const PATH_LOGIN = '/login';

export const PATH_MONITORING_NEW = '/monitorings/new';
export const PATH_MONITORING_EDIT = '/monitorings/:id/edit';

// id da aba -> path. `monitoringId` só é usado por monitoring-edit.
/** Resolução de um path para a aba correspondente. tab nulo significa rota inexistente. */
export interface TabFromPath {
  tab: string | null;
  monitoringId: string | null;
}

export const tabToPath = (tab: string, monitoringId: string | null = null): string => {
  if (tab === MONITORING_NEW) return PATH_MONITORING_NEW;
  if (tab === MONITORING_EDIT) {
    return monitoringId ? `/monitorings/${encodeURIComponent(monitoringId)}/edit` : '/monitorings';
  }
  return `/${tab}`;
};

// path -> { tab, monitoringId }. Devolve tab null quando a rota não existe (NotFound).
export const pathToTab = (pathname: string): TabFromPath => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '') return { tab: 'home', monitoringId: null };
  if (clean === PATH_MONITORING_NEW) return { tab: MONITORING_NEW, monitoringId: null };

  const edit = clean.match(/^\/monitorings\/([^/]+)\/edit$/);
  if (edit) return { tab: MONITORING_EDIT, monitoringId: decodeURIComponent(edit[1]) };

  const segment = clean.slice(1);
  if (TABS.includes(segment)) return { tab: segment, monitoringId: null };

  return { tab: null, monitoringId: null };
};
