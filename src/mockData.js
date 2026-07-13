// Mock Data — Plataforma de Gestão da Qualidade

export const DEFAULT_BRAND_CONFIG = {
  id: 'moura-leite',
  name: 'Moura Leite',
  logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=100&h=100&q=80',
  primaryColor: '#008443',
  secondaryColor: '#004d26',
  backgroundColor: '#f4f7f6',
  textColor: '#1f2937'
};

// System configurations for validation workflow
export const INITIAL_SYSTEM_SETTINGS = {
  requireGestorValidation: true, // Se true, monitorias criadas por monitores precisam ser validadas pelo gestor
};

export const INITIAL_AREAS = [
  { id: 'area-1', name: 'Relacionamento', gestorId: 'usr-2', monitorId: 'usr-2', active: true },
];

import { OFFICIAL_USERS, OFFICIAL_COLLABORATORS } from './teamData';

export const INITIAL_USERS = OFFICIAL_USERS;

export const INITIAL_COLLABORATORS = OFFICIAL_COLLABORATORS;

// Initial dynamic evaluation criteria (flexible configurations)
export const INITIAL_CRITERIA = [
  // COMUNICAÇÃO
  { id: 'crit-com-1', category: 'COMUNICAÇÃO', name: 'Saudação', description: 'Realizou a saudação inicial corretamente.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-com-2', category: 'COMUNICAÇÃO', name: 'Clareza', description: 'Foi claro e objetivo na comunicação.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-com-3', category: 'COMUNICAÇÃO', name: 'Linguagem adequada', description: 'Utilizou vocabulário e tom de voz adequados.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  
  // ATENDIMENTO
  { id: 'crit-atd-1', category: 'ATENDIMENTO', name: 'Escuta ativa', description: 'Demonstrou atenção plena ao relato do cliente.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-atd-2', category: 'ATENDIMENTO', name: 'Empatia', description: 'Acolheu a dor ou necessidade do cliente com empatia.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-atd-3', category: 'ATENDIMENTO', name: 'Personalização', description: 'Tratou o cliente de forma única e personalizada.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },

  // PROCESSO
  { id: 'crit-pro-1', category: 'PROCESSO', name: 'Seguiu procedimento', description: 'Adotou as regras e POPs exigidos para a tratativa.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-pro-2', category: 'PROCESSO', name: 'Validou informações', description: 'Realizou validação de dados de segurança/cadastro.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-pro-3', category: 'PROCESSO', name: 'Registrou corretamente', description: 'Tabulou ou registrou o atendimento no sistema corretamente.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },

  // ENCERRAMENTO
  { id: 'crit-enc-1', category: 'ENCERRAMENTO', name: 'Confirmou resolução', description: 'Confirmou se a dúvida/problema foi resolvido.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-enc-2', category: 'ENCERRAMENTO', name: 'Informou próximos passos', description: 'Deixou claro as próximas etapas, prazos ou SLA.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] },
  { id: 'crit-enc-3', category: 'ENCERRAMENTO', name: 'Finalizou adequadamente', description: 'Despediu-se cordialmente e finalizou o contato.', weight: 1.0, minExpectedScore: 2, active: true, channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'] }
];

// Allocations with Start and End Dates (Vigência)
export const INITIAL_ALLOCATIONS = [
  { id: 'alloc-1', monitorId: 'usr-2', colaboradorId: 'usr-3', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-2', monitorId: 'usr-2', colaboradorId: 'usr-4', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-3', monitorId: 'usr-2', colaboradorId: 'usr-5', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-4', monitorId: 'usr-2', colaboradorId: 'usr-1', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-5', monitorId: 'usr-1', colaboradorId: 'usr-6', startDate: '2026-01-01', endDate: null, active: true },
];

// Audit logs for allocation operations
export const INITIAL_ALLOCATION_HISTORY = [
  { id: 'log-1', allocationId: 'alloc-1', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:00:00Z', details: 'Nathalia Perger alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-2', allocationId: 'alloc-2', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:05:00Z', details: 'Allanis Maquea alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-3', allocationId: 'alloc-3', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:10:00Z', details: 'Susana Nascimento alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-4', allocationId: 'alloc-4', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:15:00Z', details: 'Aline Oliveira Verneck alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-5', allocationId: 'alloc-5', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:20:00Z', details: 'Raquel Lopes alocada para Raquel Lopes. Vigência: 01/01/2026.' },
];

// Meta Nível 1: Metas Mensais por Carteira do Monitor
export const INITIAL_MONITOR_GOALS = [
  { id: 'mgoal-1', monitorId: 'usr-2', year: 2026, month: 5, targetQty: 30 },
  { id: 'mgoal-2', monitorId: 'usr-1', year: 2026, month: 5, targetQty: 5 },
];

// Meta Nível 2: Metas Individuais por Colaborador
export const INITIAL_COLABORADOR_GOALS = [
  { id: 'cgoal-1', monitorId: 'usr-2', colaboradorId: 'usr-3', year: 2026, month: 5, targetQty: 10 },
  { id: 'cgoal-2', monitorId: 'usr-2', colaboradorId: 'usr-4', year: 2026, month: 5, targetQty: 10 },
  { id: 'cgoal-3', monitorId: 'usr-2', colaboradorId: 'usr-5', year: 2026, month: 5, targetQty: 5 },
  { id: 'cgoal-4', monitorId: 'usr-2', colaboradorId: 'usr-1', year: 2026, month: 5, targetQty: 5 },
  { id: 'cgoal-5', monitorId: 'usr-1', colaboradorId: 'usr-6', year: 2026, month: 5, targetQty: 5 },
];

// Evaluation records (Seeded - limpo para evitar inconsistência com novos critérios)
export const INITIAL_MONITORINGS = [];

// Pesquisas de Satisfação (Mock)
export const INITIAL_SURVEYS = [
  { id: 'surv-1', type: 'NPS', date: '2026-06-01', score: 100, comment: 'Excelente atendimento, rápido e prático.', collaboratorId: 'usr-3' },
  { id: 'surv-2', type: 'NPS', date: '2026-06-02', score: 60, comment: 'Demorou muito para me transferir.', collaboratorId: 'usr-4' },
  { id: 'surv-3', type: 'CSAT', date: '2026-06-03', score: 50, comment: 'Problema resolvido na hora.', collaboratorId: 'usr-3' },
  { id: 'surv-4', type: 'SAT', date: '2026-06-05', score: 40, comment: 'Atendente muito educada, mas o sistema estava fora do ar.', collaboratorId: 'usr-1' },
  { id: 'surv-5', type: 'NPS', date: '2026-06-10', score: 90, comment: '', collaboratorId: 'usr-5' }
];

export const INITIAL_HOLIDAYS = [
  {
    id: 'hol-1',
    originalMonitorId: 'usr-2',
    substituteMonitorId: 'usr-1',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    isActive: true,
  }
];

// Central de Demandas — Mock Data
export const INITIAL_DEMANDS = [
  {
    id: 'dem-1',
    title: 'Revisar monitoria contestada — Allanis',
    description: 'A colaboradora Allanis Maquea contestou a nota 6.0 no critério Solução da monitoria MON-2. Alega que seguiu o roteiro corretamente.',
    type: 'Revisão',
    assignedTo: 'usr-2',
    createdBy: 'usr-2',
    priority: 'Alta',
    deadline: '2026-06-10',
    status: 'Aberta',
    origin: 'Monitoria',
    createdAt: '2026-06-03T11:00:00Z',
    updatedAt: null,
    relatedId: 'mon-2',
  },
  {
    id: 'dem-2',
    title: 'Calibração mensal — Critério Empatia',
    description: 'Agendar sessão de calibração com monitores para alinhar pontuação do critério Empatia. Disparidade detectada entre avaliadores.',
    type: 'Calibração',
    assignedTo: 'usr-2',
    createdBy: 'usr-2',
    priority: 'Média',
    deadline: '2026-06-15',
    status: 'Em Andamento',
    origin: 'Manual',
    createdAt: '2026-06-01T09:00:00Z',
    updatedAt: '2026-06-04T14:30:00Z',
    relatedId: null,
  },
  {
    id: 'dem-3',
    title: 'Feedback individual — Nathalia Perger',
    description: 'Elaborar plano de desenvolvimento individual com base nos resultados de excelência contínua da colaboradora.',
    type: 'Feedback',
    assignedTo: 'usr-1',
    createdBy: 'usr-2',
    priority: 'Baixa',
    deadline: '2026-06-20',
    status: 'Aberta',
    origin: 'Monitoria',
    createdAt: '2026-06-02T08:30:00Z',
    updatedAt: null,
    relatedId: 'mon-1',
  },
  {
    id: 'dem-4',
    title: 'Ação corretiva — SLA de e-mails',
    description: 'Ana Carla estourou o SLA em 2 dos últimos 3 atendimentos por e-mail. Definir plano de ação com a gestão imediata.',
    type: 'Ação Corretiva',
    assignedTo: 'usr-1',
    createdBy: 'usr-2',
    priority: 'Alta',
    deadline: '2026-06-08',
    status: 'Aberta',
    origin: 'Monitoria',
    createdAt: '2026-06-03T17:00:00Z',
    updatedAt: null,
    relatedId: 'mon-4',
  },
  {
    id: 'dem-5',
    title: 'Treinamento técnico — Taxas tarifárias',
    description: 'Organizar capacitação sobre taxas tarifárias para a equipe de Relacionamento, após identificação de gaps em monitorias.',
    type: 'Treinamento',
    assignedTo: 'usr-2',
    createdBy: 'usr-2',
    priority: 'Média',
    deadline: '2026-06-25',
    status: 'Concluída',
    origin: 'Monitoria',
    createdAt: '2026-05-28T10:00:00Z',
    updatedAt: '2026-06-04T16:00:00Z',
    relatedId: null,
  },
];

// Avisos do sistema
export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Critério de Empatia Atualizado',
    message: 'A partir de hoje, o peso do critério "Empatia e Cordialidade" sobe para 2.0. Verifique o manual.',
    type: 'info',
    date: '2026-06-05',
    read: false,
  },
  {
    id: 'ann-2',
    title: 'CYF será descontinuado',
    message: 'O CYF será totalmente descontinuado em 30 de Junho. Todas as avaliações devem ser migradas para esta plataforma.',
    type: 'warning',
    date: '2026-06-04',
    read: false,
  },
  {
    id: 'ann-3',
    title: 'Nova versão da Plataforma disponível',
    message: 'A Sprint 1 da Plataforma de Gestão da Qualidade foi publicada com Central de Demandas e Home redesenhada.',
    type: 'success',
    date: '2026-06-05',
    read: false,
  },
];

// Agenda semanal (Semana de 02 a 06 de Junho 2026)
export const INITIAL_AGENDA = [
  { id: 'ag-evt-1', title: 'Monitoria — Nathalia (Chat)', date: '2026-06-02', time: '09:00', assignedTo: 'usr-2', type: 'monitoria', done: true },
  { id: 'ag-evt-2', title: 'Calibração Empatia', date: '2026-06-02', time: '14:00', assignedTo: 'usr-2', type: 'reuniao', done: true },
  { id: 'ag-evt-3', title: 'Monitoria — Allanis (Tel)', date: '2026-06-03', time: '10:00', assignedTo: 'usr-2', type: 'monitoria', done: true },
  { id: 'ag-evt-4', title: 'Feedback Susana', date: '2026-06-03', time: '15:30', assignedTo: 'usr-2', type: 'feedback', done: false },
  { id: 'ag-evt-5', title: 'Monitoria — Aline (WA)', date: '2026-06-04', time: '09:30', assignedTo: 'usr-1', type: 'monitoria', done: false },
  { id: 'ag-evt-6', title: 'Reunião de equipe', date: '2026-06-04', time: '11:00', assignedTo: 'usr-2', type: 'reuniao', done: false },
  { id: 'ag-evt-7', title: 'Monitoria — Ana Carla (E-mail)', date: '2026-06-05', time: '08:30', assignedTo: 'usr-1', type: 'monitoria', done: false },
  { id: 'ag-evt-8', title: 'Revisão contestação Allanis', date: '2026-06-05', time: '14:00', assignedTo: 'usr-2', type: 'demanda', done: false },
  { id: 'ag-evt-9', title: 'Treinamento Taxas', date: '2026-06-06', time: '10:00', assignedTo: 'usr-2', type: 'treinamento', done: false },
  { id: 'ag-evt-10', title: 'Monitoria — Nathalia (WA)', date: '2026-06-06', time: '14:00', assignedTo: 'usr-2', type: 'monitoria', done: false },
  { id: 'ag-evt-11', title: 'Comitê de Qualidade', date: '2026-06-10', time: '09:00', assignedTo: 'usr-2', type: 'reuniao', done: false },
  { id: 'ag-evt-12', title: 'Calibração', date: '2026-06-12', time: '15:00', assignedTo: 'usr-1', type: 'reuniao', done: false },
  { id: 'ag-evt-13', title: 'Feedback Allanis (Trimestral)', date: '2026-06-15', time: '10:30', assignedTo: 'usr-2', type: 'feedback', done: false },
];
