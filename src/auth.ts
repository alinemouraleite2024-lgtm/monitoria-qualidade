// Estrutura de Autenticação Preparada para Integração Futura (Homologação)

import { ROLES, USER_STATUS, PERMISSIONS } from './constants/auth';
import type { AuthLogEntry, Permission, Role, User } from './types/domain';

export { ROLES, USER_STATUS, PERMISSIONS };

// Verificação de permissão.
//
// 0.20.0 — o argumento passou a ser o **perfil ativo**, não o papel do cadastro. Quem acumula
// perfis não recebe a união deles: recebe o que o contexto atual permite, e troca de contexto
// para fazer o resto. É o que faz a restrição valer também para quem digita a URL na mão.
export const hasPermission = (perfilAtivo: Role | null | undefined, permissionKey: Permission): boolean => {
  if (!perfilAtivo) return false;
  const allowedRoles = PERMISSIONS[permissionKey];
  if (!allowedRoles) return false;
  return (allowedRoles as readonly string[]).includes(perfilAtivo);
};

// Estrutura de logs de eventos avançada
//
// `perfilAtivo` passou a ser explícito na 0.20.0: com perfis acumulados, "quem fez" já não
// basta para reconstruir uma ação — a mesma pessoa pode ter agido como monitora ou como
// administradora. Registros anteriores a esta versão guardam o papel do cadastro em
// `userRole`, que era a única leitura possível então.
export const logAuthEvent = (
  eventType: string,
  user: User | null | undefined,
  details = '',
  perfilAtivo: Role | null = null,
): void => {
  // eventType: LOGIN, LOGOUT, SWITCH_PROFILE, CHANGE_PASSWORD, CREATE_USER, BLOCK_USER, ...
  const logEntry: AuthLogEntry = {
    id: Date.now().toString(),
    eventType,
    userEmail: user?.email || 'N/A',
    userName: user?.name || 'Sistema',
    userRole: perfilAtivo || 'N/A',
    actionDetails: details,
    timestamp: new Date().toISOString(),
    ip: '192.168.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) // IP simulado
  };
  
  const existingLogs: AuthLogEntry[] = JSON.parse(localStorage.getItem('pm2_auth_logs') || '[]');
  existingLogs.unshift(logEntry); // add at start
  localStorage.setItem('pm2_auth_logs', JSON.stringify(existingLogs));
  
  console.log(`[AUDIT]: ${eventType} - ${logEntry.userEmail} - ${details}`);
};

export const getAuditLogs = (): AuthLogEntry[] => {
  return JSON.parse(localStorage.getItem('pm2_auth_logs') || '[]');
};
