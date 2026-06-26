// Estrutura de Autenticação Preparada para Integração Futura (Homologação)

export const ROLES = {
  ADMIN: 'ADMIN',
  GESTOR: 'GESTOR',
  MONITOR: 'MONITOR'
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

  // Módulos Administrativos
  VIEW_USERS: ['ADMIN'],
  VIEW_ADMINISTRATION: ['ADMIN'],
  VIEW_SETTINGS: ['ADMIN'],
  VIEW_INTEGRATIONS: ['ADMIN'],
  VIEW_VERSION_HISTORY: ['ADMIN'],
};

// Usuários de Homologação
export const HOMOLOG_USERS = [
  {
    id: 'usr-5',
    email: 'admin@homolog.local',
    password: 'Admin@123',
    name: 'Administrador Sistema',
    role: ROLES.ADMIN,
    cargo: 'Administrador',
    area: 'TI',
    active: true
  },
  {
    id: 'usr-1',
    email: 'aline@homolog.local',
    password: 'Gestor@123',
    name: 'Aline Oliveira Verneck',
    role: ROLES.GESTOR,
    cargo: 'Gestora de Qualidade',
    area: 'Relacionamento',
    active: true
  },
  {
    id: 'usr-2',
    email: 'lucelia@homolog.local',
    password: 'Monitor@123',
    name: 'Lucélia Mendes',
    role: ROLES.MONITOR,
    cargo: 'Monitora de Qualidade',
    area: 'Relacionamento',
    active: true
  },
  {
    id: 'usr-6',
    email: 'raquel@homolog.local',
    password: 'Monitor@123',
    name: 'Raquel Lopes',
    role: ROLES.MONITOR,
    cargo: 'Monitora de Qualidade',
    area: 'Relacionamento',
    active: true
  }
];

// Helper para verificar permissão
export const hasPermission = (userRole, permissionKey) => {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permissionKey];
  if (!allowedRoles) return false;
  return allowedRoles.includes(userRole);
};

// Estrutura de logs de eventos
export const logAuthEvent = (eventType, user) => {
  const logEntry = {
    eventType, // 'LOGIN' | 'LOGOUT'
    userEmail: user?.email || 'N/A',
    userRole: user?.role || 'N/A',
    timestamp: new Date().toISOString()
  };
  
  // Salvar no localStorage simulando um envio ao backend
  const existingLogs = JSON.parse(localStorage.getItem('pm2_auth_logs') || '[]');
  existingLogs.push(logEntry);
  localStorage.setItem('pm2_auth_logs', JSON.stringify(existingLogs));
  
  console.log(`[AUTH EVENT]: ${eventType} - ${logEntry.userEmail} (${logEntry.userRole}) at ${logEntry.timestamp}`);
};
