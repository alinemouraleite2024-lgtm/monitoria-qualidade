// Mapa único entre os ids de aba (herdados do roteamento manual) e os paths reais.
//
// Decisão da F0-13: o path é idêntico ao id, sem tradução. Isso mantém MENU_CONFIG e
// tabPermissionMap funcionando sem camada de conversão — o id continua sendo a chave de
// permissão e de destaque de menu, e passa a ser também o segmento da URL.
//
// As exceções são as telas do formulário, que não vivem no menu e ganham hierarquia real sob
// /monitorings, e as três seções da Administração, que ganham hierarquia sob /admin.

export const TABS: string[] = [
  'monitorings', 'reports', 'dashboard', 'planning', 'allocations',
  'admin-criterios', 'admin-acessos', 'admin-sistema', 'admin-plano-metas',
  'csat', 'nps', 'profile',
];

export const MONITORING_NEW = 'monitoring-new';
/** Lançamento retroativo (0.22.0): mesmo formulário, permissão e destino próprios. */
export const MONITORING_RETROATIVA = 'monitoring-retroativa';
export const MONITORING_EDIT = 'monitoring-edit';

/**
 * Onde cada perfil entra. A 0.19.0 removeu a tela de Início: nenhuma das três trazia
 * informação que a tela de trabalho não desse melhor, e duas delas exibiam números fixos no
 * código. Todo perfil entra onde trabalha, e `/monitorings` já se bifurca por papel — a fila
 * de validação para a gestão, a carteira para quem monitora.
 */
export const PATH_ENTRADA = '/monitorings';

/**
 * Onde cada perfil entra ao fazer login ou ao trocar de contexto (0.20.0).
 *
 * O ADMIN passou a ter destino próprio porque deixou de ter acesso a `/monitorings`: com
 * permissão estrita por perfil ativo, mandá-lo para a tela de monitorias seria mandá-lo para
 * um "acesso negado". As entradas de MONITOR e GESTOR ainda coincidem — a tela se bifurca por
 * dentro — e passam a divergir quando a 0.21.0 separar as experiências.
 */
export const ENTRADA_POR_PERFIL: Record<string, string> = {
  MONITOR: PATH_ENTRADA,
  GESTOR: PATH_ENTRADA,
  ADMIN: '/admin/criterios',
};

// Rota de autenticação (F0-14). Fora de TABS de propósito: não é destino de menu nem tem
// entrada em tabPermissionMap — é a porta de entrada, avaliada antes do guard.
export const PATH_LOGIN = '/login';

export const PATH_MONITORING_NEW = '/monitorings/new';
export const PATH_MONITORING_RETROATIVA = '/monitorings/retroativa';
export const PATH_MONITORING_EDIT = '/monitorings/:id/edit';

/**
 * Seção da Administração por id de aba. Até a 0.18.0 havia uma rota `/admin` só, com oito abas
 * internas e a seleção guardada em estado — o endereço não dizia onde você estava, contra a
 * decisão da F0-13. E os Critérios, que a 3A.0 tornou cadastro frequente, ficavam a dois
 * cliques de distância.
 */
export const ADMIN_SECOES: Record<string, string> = {
  'admin-criterios': 'criteria',
  // 0.21.0: era 'users' — a aba "Usuários do Portal", que duplicava esta em pior estado
  // (status fixo no código, sem edição). A entrada da seção passa a ser a tela completa.
  'admin-acessos': 'accounts',
  'admin-sistema': 'areas',
  // 0.25.0: o plano de metas recorrentes, que até a 0.24.0 vivia na tela da gestão.
  'admin-plano-metas': 'plano',
};

/** Resolução de um path para a aba correspondente. tab nulo significa rota inexistente. */
export interface TabFromPath {
  tab: string | null;
  monitoringId: string | null;
}

export const tabToPath = (tab: string, monitoringId: string | null = null): string => {
  if (tab === MONITORING_NEW) return PATH_MONITORING_NEW;
  if (tab === MONITORING_RETROATIVA) return PATH_MONITORING_RETROATIVA;
  if (tab === MONITORING_EDIT) {
    return monitoringId ? `/monitorings/${encodeURIComponent(monitoringId)}/edit` : '/monitorings';
  }
  if (tab in ADMIN_SECOES) return `/admin/${tab.replace('admin-', '')}`;
  return `/${tab}`;
};

// path -> { tab, monitoringId }. Devolve tab null quando a rota não existe (NotFound).
export const pathToTab = (pathname: string): TabFromPath => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  // `/` e `/home` levam à entrada. `/home` continua sendo resolvido porque endereços antigos
  // circulam — em favorito, em histórico de navegador — e devolver "rota inexistente" para
  // quem tinha a Home salva seria trocar uma tela removida por um erro.
  if (clean === '/' || clean === '' || clean === '/home') {
    return { tab: 'monitorings', monitoringId: null };
  }
  if (clean === PATH_MONITORING_NEW) return { tab: MONITORING_NEW, monitoringId: null };
  if (clean === PATH_MONITORING_RETROATIVA) return { tab: MONITORING_RETROATIVA, monitoringId: null };

  const edit = clean.match(/^\/monitorings\/([^/]+)\/edit$/);
  if (edit) return { tab: MONITORING_EDIT, monitoringId: decodeURIComponent(edit[1]) };

  // O segmento aceita hífen desde a 0.25.0: 'admin-plano-metas' é a primeira seção de nome
  // composto, e sem isso /admin/plano-metas caía em rota inexistente com o item no menu.
  const admin = clean.match(/^\/admin\/([a-z-]+)$/);
  if (admin) {
    const tab = `admin-${admin[1]}`;
    return { tab: TABS.includes(tab) ? tab : null, monitoringId: null };
  }

  const segment = clean.slice(1);
  if (TABS.includes(segment)) return { tab: segment, monitoringId: null };

  return { tab: null, monitoringId: null };
};
