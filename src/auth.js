// Estrutura de Autenticação Preparada para Integração Futura (Homologação)

import { ROLES, USER_STATUS, PERMISSIONS } from './constants/auth';

export { ROLES, USER_STATUS, PERMISSIONS };

// Helper para verificar permissão
export const hasPermission = (userRole, permissionKey) => {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permissionKey];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole);
};

// Estrutura de logs de eventos avançada
export const logAuthEvent = (eventType, user, details = '') => {
  // eventType: LOGIN, LOGOUT, CHANGE_PASSWORD, CREATE_USER, BLOCK_USER, UNBLOCK_USER, CHANGE_PERMISSIONS
  const logEntry = {
    id: Date.now().toString(),
    eventType,
    userEmail: user?.email || 'N/A',
    userName: user?.name || 'Sistema',
    userRole: user?.role || 'N/A',
    actionDetails: details,
    timestamp: new Date().toISOString(),
    ip: '192.168.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) // IP simulado
  };
  
  const existingLogs = JSON.parse(localStorage.getItem('pm2_auth_logs') || '[]');
  existingLogs.unshift(logEntry); // add at start
  localStorage.setItem('pm2_auth_logs', JSON.stringify(existingLogs));
  
  console.log(`[AUDIT]: ${eventType} - ${logEntry.userEmail} - ${details}`);
};

export const getAuditLogs = () => {
  return JSON.parse(localStorage.getItem('pm2_auth_logs') || '[]');
};
