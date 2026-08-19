import { ROLES, USER_STATUS } from './constants/auth';
import type { Collaborator, User } from './types/domain';

// Base oficial da Equipe de Relacionamento (Single Source of Truth)
export const OFFICIAL_USERS: User[] = [
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
  },
  {
    id: 'usr-7',
    email: 'admin@mouraleite.com.br',
    login: 'admin.homolog',
    password: 'Admin@123',
    name: 'Administrador (Homologação)',
    role: ROLES.ADMIN,
    cargo: 'Administrador do Sistema',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-05T09:15:00Z',
    photoUrl: ''
  }
];

export const OFFICIAL_COLLABORATORS: Collaborator[] = [
  { id: 'usr-1', email: 'aline@mouraleite.com.br', name: 'Aline Oliveira Verneck', cargo: 'Backoffice de Relacionamento e Monitora da Qualidade', active: true, areaId: 'area-1' },
  { id: 'usr-3', email: 'nathalia@mouraleite.com.br', name: 'Nathalia Perger Oyan', cargo: 'Front Office de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'usr-4', email: 'allanis@mouraleite.com.br', name: 'Allanis Maquea Silva', cargo: 'Front Office de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'usr-5', email: 'susana@mouraleite.com.br', name: 'Susana Nascimento', cargo: 'Backoffice de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'usr-6', email: 'anacarla@mouraleite.com.br', name: 'Ana Carla', cargo: 'Assistente de Gestão de Contratos', active: true, areaId: 'area-1' }
];

export const HOMOLOG_USERS = OFFICIAL_USERS;

// getSystemUsers/saveSystemUsers foram removidos na etapa 5 da F0-12: eram o segundo dono da
// chave pm2_users. O acesso passou a ser exclusivo de usersRepository, e este módulo voltou a
// ser apenas a base estática oficial da equipe.
