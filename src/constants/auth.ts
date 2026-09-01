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

export const PERMISSIONS: Record<Permission, Role[]> = {
  // Módulos principais
  VIEW_DASHBOARD: ['ADMIN', 'GESTOR'],
  VIEW_PLANNING: ['ADMIN', 'GESTOR'],
  VIEW_MONITORINGS: ['ADMIN', 'GESTOR', 'MONITOR'],
  // CSAT e NPS substituem a antiga VIEW_SURVEYS. A simetria entre eles é aparente: CSAT é
  // indicador, NPS é processo operacional — a Monitora entra no NPS para trabalhar o caso
  // (analisar histórico e monitorias, refazer monitoria, contatar o cliente, registrar a
  // tratativa), não apenas para consultar nota. Por isso os três papéis enxergam os dois.
  VIEW_CSAT: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_NPS: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_REPORTS: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_COLLABORATORS: ['ADMIN', 'GESTOR'],
  VIEW_MY_PROFILE: ['MONITOR', 'GESTOR', 'ADMIN'],

  // F0-14: as rotas do formulário de monitoria não tinham permissão declarada e passavam para
  // qualquer papel autenticado. Esta chave reproduz exatamente quem já criava monitorias antes
  // da história — CREATE_MONITORING não serve aqui porque exclui o GESTOR, que cria hoje.
  VIEW_MONITORING_FORM: ['ADMIN', 'GESTOR', 'MONITOR'],

  // Administração. Uma permissão só, cobrindo as três seções — Critérios, Usuários e Acessos,
  // e Sistema. Havia sete chaves aqui até a 0.18.0; cinco não tinham rota no menu e três
  // apontavam para telas duplicadas, que a 0.19.0 removeu.
  VIEW_ADMINISTRATION: ['ADMIN'],

  // Permissões Granulares (Exemplos)
  CREATE_MONITORING: ['MONITOR', 'ADMIN'],
  EDIT_MONITORING: ['MONITOR', 'ADMIN'],
  DELETE_MONITORING: ['ADMIN'],
  APPROVE_MONITORING: ['GESTOR', 'ADMIN'],
  EXPORT_REPORTS: ['GESTOR', 'MONITOR', 'ADMIN'],
  MANAGE_USERS: ['ADMIN'],
  MANAGE_INTEGRATIONS: ['ADMIN'],
};
