// Estrutura de Autenticação Preparada para Integração Futura (Homologação)

export const ROLES = {
  ADMIN: 'ADMIN',
  GESTOR: 'GESTOR',
  MONITOR: 'MONITOR'
};

export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED'
};

export const PERMISSIONS = {
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

// Usuários de Homologação Iniciais (Simulando o Banco)
export const HOMOLOG_USERS = [
  {
    id: 'usr-5',
    email: 'admin@homolog.local',
    login: 'admin',
    password: 'Admin@123',
    name: 'Administrador Sistema',
    role: ROLES.ADMIN,
    cargo: 'Administrador',
    area: 'TI',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-05T08:00:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-1',
    email: 'aline@homolog.local',
    login: 'aline.verneck',
    password: 'Gestor@123',
    name: 'Aline Oliveira Verneck',
    role: ROLES.GESTOR,
    cargo: 'Gestora de Qualidade',
    area: 'Relacionamento',
    gestor: 'admin',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T15:30:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-2',
    email: 'lucelia@homolog.local',
    login: 'lucelia.mendes',
    password: 'Monitor@123',
    name: 'Lucélia Mendes',
    role: ROLES.MONITOR,
    cargo: 'Monitora de Qualidade',
    area: 'Relacionamento',
    gestor: 'aline.verneck',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-05T09:15:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-6',
    email: 'raquel@homolog.local',
    login: 'raquel.lopes',
    password: 'Monitor@123',
    name: 'Raquel Lopes',
    role: ROLES.MONITOR,
    cargo: 'Monitora de Qualidade',
    area: 'Relacionamento',
    gestor: 'aline.verneck',
    status: USER_STATUS.INACTIVE,
    provider: 'INTERNAL',
    lastAccess: null,
    photoUrl: ''
  }
];

export const getSystemUsers = () => {
  const stored = localStorage.getItem('pm2_users');
  if (stored) return JSON.parse(stored);
  localStorage.setItem('pm2_users', JSON.stringify(HOMOLOG_USERS));
  return HOMOLOG_USERS;
};

export const saveSystemUsers = (users) => {
  localStorage.setItem('pm2_users', JSON.stringify(users));
};

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
