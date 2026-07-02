import { ROLES, USER_STATUS } from './auth';

// Base oficial da Equipe de Relacionamento (Single Source of Truth)
export const OFFICIAL_USERS = [
  {
    id: 'usr-admin',
    email: 'admin@mouraleite.com.br',
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
    id: 'usr-raquel',
    email: 'raquel@mouraleite.com.br',
    login: 'raquel.lopes',
    password: 'Gestor@123',
    name: 'Raquel Lopes',
    role: ROLES.GESTOR,
    cargo: 'Supervisora de Relacionamento',
    area: 'Relacionamento',
    gestor: 'admin',
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '2026-06-04T15:30:00Z',
    photoUrl: ''
  },
  {
    id: 'usr-aline',
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
  }
];

export const OFFICIAL_COLLABORATORS = [
  { id: 'colab-aline', email: 'aline@mouraleite.com.br', name: 'Aline Oliveira Verneck', cargo: 'Backoffice de Relacionamento e Monitora da Qualidade', active: true, areaId: 'area-1' },
  { id: 'colab-susana', email: 'susana@mouraleite.com.br', name: 'Susana Nascimento', cargo: 'Backoffice de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'colab-allanis', email: 'allanis@mouraleite.com.br', name: 'Allanis Maquea Silva', cargo: 'Front Office de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'colab-nathalia', email: 'nathalia@mouraleite.com.br', name: 'Nathalia Perger Oyan', cargo: 'Front Office de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'colab-anacarla', email: 'anacarla@mouraleite.com.br', name: 'Ana Carla', cargo: 'Assistente de Gestão de Contratos', active: true, areaId: 'area-1' }
];

