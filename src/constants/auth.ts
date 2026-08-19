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
  VIEW_CENTRAL_DEMANDS: ['ADMIN', 'GESTOR'],
  VIEW_MONITORINGS: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_SURVEYS: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_REPORTS: ['ADMIN', 'GESTOR', 'MONITOR'],
  VIEW_COLLABORATORS: ['ADMIN', 'GESTOR'],
  VIEW_MY_DEMANDS: ['MONITOR'],
  VIEW_MY_MONITORINGS: ['MONITOR'],
  VIEW_CALENDAR: ['MONITOR'],
  VIEW_OPERATIONAL_CALENDAR: ['GESTOR'],
  VIEW_MY_PROFILE: ['MONITOR', 'GESTOR', 'ADMIN'],

  // F0-14: as rotas do formulário de monitoria não tinham permissão declarada e passavam para
  // qualquer papel autenticado. Esta chave reproduz exatamente quem já criava monitorias antes
  // da história — CREATE_MONITORING não serve aqui porque exclui o GESTOR, que cria hoje.
  VIEW_MONITORING_FORM: ['ADMIN', 'GESTOR', 'MONITOR'],

  // Módulos Administrativos (Novo)
  VIEW_USERS: ['ADMIN'],
  VIEW_ADMINISTRATION: ['ADMIN'],
  VIEW_ROLES: ['ADMIN'],
  VIEW_AUDIT_LOGS: ['ADMIN'],
  VIEW_SETTINGS: ['ADMIN'],
  VIEW_INTEGRATIONS: ['ADMIN'],
  VIEW_VERSION_HISTORY: ['ADMIN'],

  // Permissões Granulares (Exemplos)
  CREATE_MONITORING: ['MONITOR', 'ADMIN'],
  EDIT_MONITORING: ['MONITOR', 'ADMIN'],
  DELETE_MONITORING: ['ADMIN'],
  APPROVE_MONITORING: ['GESTOR', 'ADMIN'],
  EXPORT_REPORTS: ['GESTOR', 'MONITOR', 'ADMIN'],
  MANAGE_USERS: ['ADMIN'],
  MANAGE_INTEGRATIONS: ['ADMIN'],
};
