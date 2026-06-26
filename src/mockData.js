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
  { id: 'area-1', name: 'Relacionamento', gestorId: 'usr-1', monitorId: 'usr-1', active: true },
];

export const INITIAL_USERS = [
  { id: 'usr-1', email: 'aline@mouraleite.com.br', name: 'Aline Oliveira Verneck', role: 'GESTOR', active: true },
  { id: 'usr-2', email: 'lucelia@mouraleite.com.br', name: 'Lucélia Mendes', role: 'MONITOR', active: true },
  { id: 'usr-3', email: 'carlos@mouraleite.com.br', name: 'Carlos Ramos', role: 'MONITOR', active: true },
  { id: 'usr-4', email: 'joao@mouraleite.com.br', name: 'João Silva', role: 'GESTOR', active: true },
  { id: 'usr-5', email: 'admin@mouraleite.com.br', name: 'Admin Moura Leite', role: 'ADMIN', active: true },
];

export const INITIAL_COLLABORATORS = [
  { id: 'ag-1', email: 'nathalia@mouraleite.com.br', name: 'Nathalia Perger Oyan', cargo: 'Assistente de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'ag-2', email: 'allanis@mouraleite.com.br', name: 'Allanis Maquea Silva', cargo: 'Assistente de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'ag-3', email: 'susana@mouraleite.com.br', name: 'Susana Nascimento', cargo: 'Auxiliar de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'ag-4', email: 'lucelia_colab@mouraleite.com.br', name: 'Lucélia Justo', cargo: 'Auxiliar de Relacionamento', active: true, areaId: 'area-1' },
  { id: 'ag-5', email: 'raquel@mouraleite.com.br', name: 'Raquel Lopes', cargo: 'Auxiliar de Relacionamento', active: true, areaId: 'area-1' },
];

// Initial dynamic evaluation criteria (flexible configurations)
export const INITIAL_CRITERIA = [
  {
    id: 'crit-1',
    name: 'Comunicação',
    description: 'Clareza, tom de voz, uso correto da gramática e vocabulário adequado.',
    weight: 1.0,
    minExpectedScore: 7.5,
    active: true,
    channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone']
  },
  {
    id: 'crit-2',
    name: 'Empatia',
    description: 'Escuta ativa, acolhimento, cordialidade e tratamento personalizado.',
    weight: 1.0,
    minExpectedScore: 8.0,
    active: true,
    channels: ['Chat', 'WhatsApp', 'Telefone', 'Presencial']
  },
  {
    id: 'crit-3',
    name: 'Didática',
    description: 'Capacidade de transmitir a informação de forma compreensível e ritmada.',
    weight: 1.0,
    minExpectedScore: 7.0,
    active: true,
    channels: ['Telefone', 'Presencial']
  },
  {
    id: 'crit-4',
    name: 'Solução',
    description: 'Assertividade na resposta, resolução do problema e conformidade técnica.',
    weight: 1.0,
    minExpectedScore: 8.0,
    active: true,
    channels: ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial']
  },
  {
    id: 'crit-5',
    name: 'Tempo de Resposta',
    description: 'Agilidade na interação e cumprimento do SLA estabelecido.',
    weight: 1.0,
    minExpectedScore: 7.5,
    active: true,
    channels: ['Chat', 'WhatsApp', 'E-mail']
  }
];

// Allocations with Start and End Dates (Vigência)
export const INITIAL_ALLOCATIONS = [
  { id: 'alloc-1', monitorId: 'usr-1', colaboradorId: 'ag-1', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-2', monitorId: 'usr-1', colaboradorId: 'ag-2', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-3', monitorId: 'usr-1', colaboradorId: 'ag-3', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-4', monitorId: 'usr-1', colaboradorId: 'ag-4', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-5', monitorId: 'usr-2', colaboradorId: 'ag-5', startDate: '2026-01-01', endDate: null, active: true },
];

// Audit logs for allocation operations
export const INITIAL_ALLOCATION_HISTORY = [
  { id: 'log-1', allocationId: 'alloc-1', actionType: 'INSERT', changedBy: 'usr-4', changedAt: '2026-01-01T09:00:00Z', details: 'Nathalia Perger Oyan alocada para Aline Oliveira Verneck. Vigência: 01/01/2026.' },
  { id: 'log-2', allocationId: 'alloc-2', actionType: 'INSERT', changedBy: 'usr-4', changedAt: '2026-01-01T09:05:00Z', details: 'Allanis Maquea Silva alocada para Aline Oliveira Verneck. Vigência: 01/01/2026.' },
  { id: 'log-3', allocationId: 'alloc-3', actionType: 'INSERT', changedBy: 'usr-4', changedAt: '2026-01-01T09:10:00Z', details: 'Susana Nascimento alocada para Aline Oliveira Verneck. Vigência: 01/01/2026.' },
  { id: 'log-4', allocationId: 'alloc-4', actionType: 'INSERT', changedBy: 'usr-4', changedAt: '2026-01-01T09:15:00Z', details: 'Lucélia Justo alocada para Aline Oliveira Verneck. Vigência: 01/01/2026.' },
  { id: 'log-5', allocationId: 'alloc-5', actionType: 'INSERT', changedBy: 'usr-4', changedAt: '2026-01-01T09:20:00Z', details: 'Raquel Lopes alocada para Lucélia Mendes. Vigência: 01/01/2026.' },
];

// Meta Nível 1: Metas Mensais por Carteira do Monitor
export const INITIAL_MONITOR_GOALS = [
  { id: 'mgoal-1', monitorId: 'usr-1', year: 2026, month: 5, targetQty: 30 },
  { id: 'mgoal-2', monitorId: 'usr-2', year: 2026, month: 5, targetQty: 5 },
];

// Meta Nível 2: Metas Individuais por Colaborador
export const INITIAL_COLABORADOR_GOALS = [
  { id: 'cgoal-1', monitorId: 'usr-1', colaboradorId: 'ag-1', year: 2026, month: 5, targetQty: 10 },
  { id: 'cgoal-2', monitorId: 'usr-1', colaboradorId: 'ag-2', year: 2026, month: 5, targetQty: 10 },
  { id: 'cgoal-3', monitorId: 'usr-1', colaboradorId: 'ag-3', year: 2026, month: 5, targetQty: 5 },
  { id: 'cgoal-4', monitorId: 'usr-1', colaboradorId: 'ag-4', year: 2026, month: 5, targetQty: 5 },
  { id: 'cgoal-5', monitorId: 'usr-2', colaboradorId: 'ag-5', year: 2026, month: 5, targetQty: 5 },
];

// Evaluation records (Seeded)
export const INITIAL_MONITORINGS = [
  {
    id: 'mon-1',
    monitorId: 'usr-1',
    colaboradorId: 'ag-1',
    canal: 'Chat',
    status: 'Validada',
    tipo: 'Regular',
    date: '2026-06-01T10:30:00Z',
    finalScore: 9.25,
    comments: 'Nathalia demonstrou excelente cordialidade e agilidade na resolução da dúvida técnica do cliente.',
    strengths: 'Rapidez na consulta à base de conhecimento e empatia.',
    opportunities: 'Reduzir levemente o uso de gerúndios.',
    scores: [
      { criterionId: 'crit-1', score: 9.5, lowScoreReason: '' },
      { criterionId: 'crit-2', score: 9.0, lowScoreReason: '' },
      { criterionId: 'crit-4', score: 9.5, lowScoreReason: '' },
      { criterionId: 'crit-5', score: 9.0, lowScoreReason: '' },
    ]
  },
  {
    id: 'mon-2',
    monitorId: 'usr-1',
    colaboradorId: 'ag-2',
    canal: 'Telefone',
    status: 'Validada',
    tipo: 'Regular',
    date: '2026-06-02T14:15:00Z',
    finalScore: 7.25,
    comments: 'Allanis foi atenciosa, mas falhou no cumprimento do roteiro de segurança da conta.',
    strengths: 'Tom de voz firme, clareza e empatia demonstrada.',
    opportunities: 'Realizar todas as perguntas obrigatórias de confirmação cadastral.',
    scores: [
      { criterionId: 'crit-1', score: 8.0, lowScoreReason: '' },
      { criterionId: 'crit-2', score: 8.5, lowScoreReason: '' },
      { criterionId: 'crit-3', score: 6.5, lowScoreReason: 'Apresentou dificuldades em explicar as taxas tarifárias de forma didática.' },
      { criterionId: 'crit-4', score: 6.0, lowScoreReason: 'Não confirmou os três dados de segurança previstos em script.' },
    ]
  },
  {
    id: 'mon-3',
    monitorId: 'usr-1',
    colaboradorId: 'ag-3',
    canal: 'WhatsApp',
    status: 'Concluída',
    tipo: 'Direcionada',
    date: '2026-06-03T09:00:00Z',
    finalScore: 9.38,
    comments: 'Avaliação excelente. Resposta rápida e alinhada às expectativas corporativas.',
    strengths: 'Escrita impecável, uso correto de negritos e emojis moderados.',
    opportunities: 'Nenhuma crítica identificada. Continuar com essa excelência de fluxo.',
    scores: [
      { criterionId: 'crit-1', score: 9.5, lowScoreReason: '' },
      { criterionId: 'crit-2', score: 9.5, lowScoreReason: '' },
      { criterionId: 'crit-4', score: 9.5, lowScoreReason: '' },
      { criterionId: 'crit-5', score: 9.0, lowScoreReason: '' },
    ]
  },
  {
    id: 'mon-4',
    monitorId: 'usr-2',
    colaboradorId: 'ag-5',
    canal: 'E-mail',
    status: 'Validada',
    tipo: 'Regular',
    date: '2026-06-02T16:45:00Z',
    finalScore: 8.5,
    comments: 'Raquel respondeu o e-mail de forma técnica e formal, porém o tempo de envio estourou o SLA interno.',
    strengths: 'Exatidão da resposta técnica.',
    opportunities: 'Gerenciamento da fila de emails.',
    scores: [
      { criterionId: 'crit-1', score: 9.0, lowScoreReason: '' },
      { criterionId: 'crit-4', score: 9.0, lowScoreReason: '' },
      { criterionId: 'crit-5', score: 7.5, lowScoreReason: '' },
    ]
  },
];

export const INITIAL_HOLIDAYS = [
  {
    id: 'hol-1',
    originalMonitorId: 'usr-1',
    substituteMonitorId: 'usr-2',
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
    description: 'A colaboradora Allanis Maquea Silva contestou a nota 6.0 no critério Solução da monitoria MON-2. Alega que seguiu o roteiro corretamente.',
    type: 'Revisão',
    assignedTo: 'usr-1',
    createdBy: 'usr-4',
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
    assignedTo: 'usr-1',
    createdBy: 'usr-4',
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
    assignedTo: 'usr-2',
    createdBy: 'usr-1',
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
    description: 'Raquel Lopes estourou o SLA em 2 dos últimos 3 atendimentos por e-mail. Definir plano de ação com a gestão imediata.',
    type: 'Ação Corretiva',
    assignedTo: 'usr-2',
    createdBy: 'usr-1',
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
    assignedTo: 'usr-1',
    createdBy: 'usr-4',
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
  { id: 'ag-evt-1', title: 'Monitoria — Nathalia (Chat)', date: '2026-06-02', time: '09:00', assignedTo: 'usr-1', type: 'monitoria', done: true },
  { id: 'ag-evt-2', title: 'Calibração Empatia', date: '2026-06-02', time: '14:00', assignedTo: 'usr-1', type: 'reuniao', done: true },
  { id: 'ag-evt-3', title: 'Monitoria — Allanis (Tel)', date: '2026-06-03', time: '10:00', assignedTo: 'usr-1', type: 'monitoria', done: true },
  { id: 'ag-evt-4', title: 'Feedback Susana', date: '2026-06-03', time: '15:30', assignedTo: 'usr-1', type: 'feedback', done: false },
  { id: 'ag-evt-5', title: 'Monitoria — Lucélia J. (WA)', date: '2026-06-04', time: '09:30', assignedTo: 'usr-2', type: 'monitoria', done: false },
  { id: 'ag-evt-6', title: 'Reunião de equipe', date: '2026-06-04', time: '11:00', assignedTo: 'usr-1', type: 'reuniao', done: false },
  { id: 'ag-evt-7', title: 'Monitoria — Raquel (E-mail)', date: '2026-06-05', time: '08:30', assignedTo: 'usr-2', type: 'monitoria', done: false },
  { id: 'ag-evt-8', title: 'Revisão contestação Allanis', date: '2026-06-05', time: '14:00', assignedTo: 'usr-1', type: 'demanda', done: false },
  { id: 'ag-evt-9', title: 'Treinamento Taxas', date: '2026-06-06', time: '10:00', assignedTo: 'usr-1', type: 'treinamento', done: false },
  { id: 'ag-evt-10', title: 'Monitoria — Nathalia (WA)', date: '2026-06-06', time: '14:00', assignedTo: 'usr-1', type: 'monitoria', done: false },
];
