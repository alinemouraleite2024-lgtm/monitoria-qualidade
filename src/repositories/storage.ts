// Primitiva única de acesso ao localStorage.
// Nenhum outro arquivo da camada de repositório deve chamar localStorage diretamente.

// As chaves são declaradas com o nome completo (incluindo o prefixo pm2_) para que sejam
// idênticas, caractere a caractere, às usadas antes da F0-12 — o prefixo também é o que
// initializeDatabase() usa para limpar o armazenamento em uma troca de DATABASE_VERSION.
export const KEYS = {
  brand: 'pm2_brand',
  settings: 'pm2_settings',
  areas: 'pm2_areas',
  collaborators: 'pm2_collaborators',
  users: 'pm2_users',
  criteria: 'pm2_criteria',
  allocations: 'pm2_allocations',
  allocationHistory: 'pm2_alloc_history',
  monitorGoals: 'pm2_mgoals',
  colaboradorGoals: 'pm2_cgoals',
  monitorings: 'pm2_monitorings',
  holidays: 'pm2_holidays',
  demands: 'pm2_demands',
  announcements: 'pm2_announcements',
  agenda: 'pm2_agenda',
  catalogEmpreendimentos: 'pm2_catalog_empreendimentos',
  catalogCategorias: 'pm2_catalog_categorias',
  // Versão do catálogo de categorias, deliberadamente separada de DATABASE_VERSION: trocar o
  // vocabulário do catálogo não pode disparar a limpeza geral do armazenamento.
  catalogCategoriasVersion: 'pm2_catalog_categorias_version',
  // Mesma ideia da versão do catálogo, e pelo mesmo motivo: alcançar critérios já gravados
  // sem recorrer a DATABASE_VERSION, que apagaria a base inteira para corrigir um campo.
  criteriaVersion: 'pm2_criteria_version',
  authSession: 'pm2_auth_session',
} as const;

// Devolve o valor armazenado ou o fallback. Reproduz o comportamento anterior
// (`saved ? JSON.parse(saved) : SEED`), inclusive para conteúdo inválido.
export const read = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const write = <T,>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const remove = (key: string): void => {
  localStorage.removeItem(key);
};
