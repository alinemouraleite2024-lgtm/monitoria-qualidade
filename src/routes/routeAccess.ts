// Política de acesso por rota — fonte única.
//
// A chave continua sendo o id de aba, que desde a F0-13 é também o segmento da URL. Um valor
// null significa rota aberta a qualquer usuário autenticado; ausência de entrada significava,
// até a F0-14, o mesmo que null — e era esse o buraco por onde as rotas do formulário passavam.
import { PERMISSIONS } from '../constants/auth';
import type { Permission } from '../types/domain';

export const tabPermissionMap: Record<string, Permission | null> = {
  home: null,
  dashboard: 'VIEW_DASHBOARD',
  planning: 'VIEW_PLANNING',
  demands: 'VIEW_CENTRAL_DEMANDS',
  roles: 'VIEW_ROLES',
  'audit-logs': 'VIEW_AUDIT_LOGS',
  monitorings: 'VIEW_MONITORINGS',
  surveys: 'VIEW_SURVEYS',
  reports: 'VIEW_REPORTS',
  allocations: 'VIEW_COLLABORATORS',
  'my-demands': 'VIEW_MY_DEMANDS',
  calendar: 'VIEW_CALENDAR',
  'op-calendar': 'VIEW_OPERATIONAL_CALENDAR',
  profile: 'VIEW_MY_PROFILE',
  users: 'VIEW_USERS',
  admin: 'VIEW_ADMINISTRATION',
  settings: 'VIEW_SETTINGS',
  integrations: 'VIEW_INTEGRATIONS',
  history: 'VIEW_VERSION_HISTORY',
  'monitoring-new': 'VIEW_MONITORING_FORM',
  'monitoring-edit': 'VIEW_MONITORING_FORM',
};

// Rede de proteção: garante que toda permissão referenciada acima existe de fato em PERMISSIONS.
// Sem isso, um erro de digitação vira rota liberada em silêncio — exatamente a classe de falha
// que a F0-14 veio fechar.
export const assertRouteAccessIsConsistent = (): string[] => {
  const invalidas = Object.entries(tabPermissionMap)
    .filter(([, perm]) => perm !== null && !PERMISSIONS[perm])
    .map(([rota, perm]) => `${rota} -> ${perm}`);
  return invalidas;
};
