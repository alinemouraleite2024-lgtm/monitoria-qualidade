// Política de acesso por rota — fonte única.
//
// A chave continua sendo o id de aba, que desde a F0-13 é também o segmento da URL. Um valor
// null significa rota aberta a qualquer usuário autenticado; ausência de entrada significava,
// até a F0-14, o mesmo que null — e era esse o buraco por onde as rotas do formulário passavam.
import { PERMISSIONS } from '../constants/auth';
import type { Permission } from '../types/domain';

export const tabPermissionMap: Record<string, Permission | null> = {
  // Operação
  monitorings: 'VIEW_MONITORINGS',
  'monitoring-new': 'VIEW_MONITORING_FORM',
  'monitoring-edit': 'VIEW_MONITORING_FORM',
  reports: 'VIEW_REPORTS',

  // Gestão
  dashboard: 'VIEW_DASHBOARD',
  allocations: 'VIEW_COLLABORATORS',
  planning: 'VIEW_PLANNING',

  // Configuração — as três seções compartilham a mesma permissão de propósito: quem administra
  // administra tudo, e separar aqui criaria papéis intermediários que o produto não tem.
  'admin-criterios': 'VIEW_ADMINISTRATION',
  'admin-acessos': 'VIEW_ADMINISTRATION',
  'admin-sistema': 'VIEW_ADMINISTRATION',

  // Fora do menu desde a 0.19.0, mas com rota e permissão mantidas: o rumo está registrado em
  // docs/VISAO-PRODUTO.md, e o menu é ferramenta de trabalho — não vitrine de roadmap.
  csat: 'VIEW_CSAT',
  nps: 'VIEW_NPS',

  profile: 'VIEW_MY_PROFILE',
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
