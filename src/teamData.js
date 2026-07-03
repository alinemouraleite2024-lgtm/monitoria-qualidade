import { ROLES, USER_STATUS } from './constants/auth';

// Base oficial da Equipe de Relacionamento (Single Source of Truth)
export const OFFICIAL_USERS = [
  {
    id: 'usr-1',
    email: 'aline@mouraleite.com.br',
    login: 'aline.verneck',
    password: 'Monitor@123',
    name: 'Aline Oliveira Verneck',
    role: ROLES.MONITOR,
    cargo: 'Backoffice de Relacionamento e Monitora da Qualidade',
    area: 'Relacionamento',
    gestor: 'raquel.lopes',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-05T09:15:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-2',
    email: 'raquel@mouraleite.com.br',
    login: 'raquel.lopes',
    password: 'Gestor@123',
    name: 'Raquel Lopes',
    role: ROLES.GESTOR,
    cargo: 'Supervisora de Relacionamento',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T15:30:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-3',
    email: 'nathalia@mouraleite.com.br',
    login: 'nathalia.oyan',
    password: 'User@123',
    name: 'Nathalia Perger Oyan',
    role: 'COLABORADOR',
    cargo: 'Front Office de Relacionamento',
    area: 'Relacionamento',
    gestor: 'raquel.lopes',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T10:00:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-4',
    email: 'allanis@mouraleite.com.br',
    login: 'allanis.silva',
    password: 'User@123',
    name: 'Allanis Maquea Silva',
    role: 'COLABORADOR',
    cargo: 'Front Office de Relacionamento',
    area: 'Relacionamento',
    gestor: 'raquel.lopes',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T10:00:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-5',
    email: 'susana@mouraleite.com.br',
    login: 'susana.nascimento',
    password: 'User@123',
    name: 'Susana Nascimento',
    role: 'COLABORADOR',
    cargo: 'Backoffice de Relacionamento',
    area: 'Relacionamento',
    gestor: 'raquel.lopes',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T10:00:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-6',
    email: 'anacarla@mouraleite.com.br',
    login: 'ana.carla',
    password: 'User@123',
    name: 'Ana Carla',
    role: 'COLABORADOR',
    cargo: 'Assistente de Gestão de Contratos',
    area: 'Relacionamento',
    gestor: 'raquel.lopes',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T10:00:00Z',
    photoUrl: ''
  }
];

export const OFFICIAL_COLLABORATORS = [
  { id: 'usr-1', email: 'aline@mouraleite.com.br', name: 'Aline Oliveira Verneck', cargo: 'Backoffice de Relacionamento e Monitora da Qualidade', active: true, areaId: 'area-1' },
  { id: 'usr-3', email: 'nathalia@mouraleite.com.br', name: 'Nathalia Perger Oyan', cargo: 'Front Office de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'usr-4', email: 'allanis@mouraleite.com.br', name: 'Allanis Maquea Silva', cargo: 'Front Office de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'usr-5', email: 'susana@mouraleite.com.br', name: 'Susana Nascimento', cargo: 'Backoffice de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'usr-6', email: 'anacarla@mouraleite.com.br', name: 'Ana Carla', cargo: 'Assistente de Gestão de Contratos', active: true, areaId: 'area-1' }
];

export const HOMOLOG_USERS = OFFICIAL_USERS;

export const getSystemUsers = () => {
  const stored = localStorage.getItem('pm2_users');
  if (stored) return JSON.parse(stored);
  localStorage.setItem('pm2_users', JSON.stringify(HOMOLOG_USERS));
  return HOMOLOG_USERS;
};

export const saveSystemUsers = (users) => {
  localStorage.setItem('pm2_users', JSON.stringify(users));
};
