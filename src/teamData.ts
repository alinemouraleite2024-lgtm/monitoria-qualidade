import { ROLES, USER_STATUS } from './constants/auth';
import type { Collaborator, User } from './types/domain';

// Base oficial da Equipe de Relacionamento (Single Source of Truth)
//
// 0.17.0 — limpeza de estrutura antes da entrada em operação.
//
// O que mudou e por quê: até aqui o seed descrevia uma equipe específica, e uma pessoa (a
// supervisora) aparecia como gestora da área E como monitora de quatro das cinco carteiras.
// Remover essa pessoa quebrava vínculos, metas e dashboards de uma vez — sinal de que a
// estrutura estava presa a quem a ocupava, e não aos papéis.
//
// A regra agora é: **o seed traz apenas o que o sistema não consegue existir sem**. Uma conta
// de administração, para configurar tudo o mais, e as colaboradoras avaliadas, que são o objeto
// da monitoria. Gestores e monitores são cadastrados pelo Admin, quantos forem necessários —
// nenhum papel tem titular fixo no código.
export const OFFICIAL_USERS: User[] = [
  {
    id: 'usr-1',
    email: 'aline@mouraleite.com.br',
    login: 'aline.verneck',
    password: 'Admin@123',
    name: 'Aline Oliveira Verneck',
    // Administra e monitora. Até a 0.19.0 isso dependia de `getMonitors()` incluir ADMIN por
    // regra — o que fazia *todo* administrador contar como monitor. Agora está no dado: ela
    // recebe carteira, meta e fila porque tem o perfil MONITOR, e não por ser ADMIN. Consta
    // também em OFFICIAL_COLLABORATORS: faz atendimento e é avaliada como as demais.
    perfis: [ROLES.ADMIN, ROLES.MONITOR],
    cargo: 'Backoffice de Relacionamento e Monitora da Qualidade',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '',
    photoUrl: ''
  },
  {
    id: 'usr-3',
    email: 'nathalia@mouraleite.com.br',
    login: 'nathalia.oyan',
    password: 'User@123',
    name: 'Nathalia Perger Oyan',
    perfis: [],
    cargo: 'Front Office de Relacionamento',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '',
    photoUrl: ''
  },
  {
    id: 'usr-4',
    email: 'allanis@mouraleite.com.br',
    login: 'allanis.silva',
    password: 'User@123',
    name: 'Allanis Maquea Silva',
    perfis: [],
    cargo: 'Front Office de Relacionamento',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '',
    photoUrl: ''
  },
  {
    id: 'usr-5',
    email: 'susana@mouraleite.com.br',
    login: 'susana.nascimento',
    password: 'User@123',
    name: 'Susana Nascimento',
    perfis: [],
    cargo: 'Backoffice de Relacionamento',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '',
    photoUrl: ''
  },
  {
    id: 'usr-6',
    email: 'anacarla@mouraleite.com.br',
    login: 'ana.carla',
    password: 'User@123',
    name: 'Ana Carla',
    perfis: [],
    cargo: 'Assistente de Gestão de Contratos',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '',
    photoUrl: ''
  },
  {
    id: 'usr-7',
    email: 'admin@mouraleite.com.br',
    login: 'admin.sistema',
    password: 'Admin@123',
    name: 'Administrador do Sistema',
    // Conta de administração pura: configura o sistema, não monitora. É a diferença que a
    // 0.20.0 torna possível expressar — antes, todo ADMIN era monitor por consequência.
    perfis: [ROLES.ADMIN],
    cargo: 'Administrador do Sistema',
    area: 'Relacionamento',
    gestor: null,
    status: USER_STATUS.ACTIVE,
    provider: 'INTERNAL',
    lastAccess: '',
    photoUrl: ''
  }
];

// Colaboradoras avaliadas. A Aline consta aqui e também em OFFICIAL_USERS: ela monitora e é
// monitorada, e os dois lados são registros diferentes de propósito — `User` é quem acessa,
// `Collaborator` é quem é avaliado.
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
