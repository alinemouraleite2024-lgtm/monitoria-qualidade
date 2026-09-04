// Single Source of Truth para constantes de autenticação e permissões
import type { Permission, Role } from '../types/domain';

export const ROLES = {
  ADMIN: 'ADMIN',
  GESTOR: 'GESTOR',
  MONITOR: 'MONITOR'
} as const;

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED'
} as const;

/**
 * Matriz de permissões por perfil.
 *
 * 0.20.0 — a chave passou a ser o **perfil ativo**, não o papel do cadastro. Isso muda o que a
 * matriz significa: até a 0.19.0 o ADMIN aparecia em quase toda linha, e "permissão estrita"
 * não teria efeito algum sobre ele. Agora cada perfil recebe apenas o que pertence ao seu
 * contexto, e quem acumula perfis alterna entre eles em vez de ver a união.
 *
 * Duas exceções deliberadas na coluna do ADMIN, decididas com a operação: **Relatórios** e
 * **Painel** permanecem, porque governança precisa de leitura — e porque `DELETE_MONITORING`
 * é exclusiva do ADMIN e a ação vive dentro de Relatórios.
 */
export const PERMISSIONS: Record<Permission, Role[]> = {
  // Módulos principais
  VIEW_DASHBOARD: ['ADMIN', 'GESTOR'],
  // Metas e Equipe e Carteiras são trabalho de gestão da equipe, não de configuração do
  // sistema — por isso não acompanham o ADMIN.
  VIEW_PLANNING: ['GESTOR'],
  // O ADMIN sai daqui: no contexto de administração não se monitora nem se valida. Quem
  // administra e também monitora troca de perfil, que é o mecanismo que a 0.20.0 introduz.
  VIEW_MONITORINGS: ['GESTOR', 'MONITOR'],
  // CSAT e NPS substituem a antiga VIEW_SURVEYS. A simetria entre eles é aparente: CSAT é
  // indicador, NPS é processo operacional — a Monitora entra no NPS para trabalhar o caso
  // (analisar histórico e monitorias, refazer monitoria, contatar o cliente, registrar a
  // tratativa), não apenas para consultar nota. Por isso os três papéis enxergam os dois.
  VIEW_CSAT: ['GESTOR', 'MONITOR'],
  VIEW_NPS: ['GESTOR', 'MONITOR'],
  VIEW_REPORTS: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_COLLABORATORS: ['GESTOR'],
  VIEW_MY_PROFILE: ['MONITOR', 'GESTOR', 'ADMIN'],

  // F0-14 declarou esta chave para as rotas do formulário, que passavam sem permissão alguma.
  // Ela reproduzia quem criava monitorias então — incluindo o GESTOR. A 0.17.0 decidiu que
  // gestor valida e não avalia, mas o formulário continuou aberto a ele até aqui; a 0.20.0
  // fecha a divergência e deixa a criação com quem monitora.
  VIEW_MONITORING_FORM: ['MONITOR'],

  // Administração. Uma permissão só, cobrindo as três seções — Critérios, Usuários e Acessos,
  // e Sistema. Havia sete chaves aqui até a 0.18.0; cinco não tinham rota no menu e três
  // apontavam para telas duplicadas, que a 0.19.0 removeu.
  VIEW_ADMINISTRATION: ['ADMIN'],

  // Permissões granulares. O ADMIN saiu de criar e editar pelo mesmo motivo do formulário:
  // administrar não é monitorar. Saiu também de APPROVE_MONITORING — validar é ato de gestão,
  // e mantê-lo ali reintroduziria pela porta dos fundos o acúmulo que a 0.20.0 desfaz.
  CREATE_MONITORING: ['MONITOR'],
  EDIT_MONITORING: ['MONITOR'],
  DELETE_MONITORING: ['ADMIN'],
  APPROVE_MONITORING: ['GESTOR'],
  EXPORT_REPORTS: ['GESTOR', 'MONITOR', 'ADMIN'],
  MANAGE_USERS: ['ADMIN'],
  MANAGE_INTEGRATIONS: ['ADMIN'],
};
