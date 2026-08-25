// Mock Data — Plataforma de Gestão da Qualidade
import type {
  Allocation, AllocationHistoryEntry, Area, BrandConfig, ColaboradorGoal,
  Canal, Criterion, Holiday, Monitoring, MonitorGoal, SystemSettings,
} from './types/domain';

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  id: 'moura-leite',
  name: 'Moura Leite',
  logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=100&h=100&q=80',
  primaryColor: '#008443',
  secondaryColor: '#004d26',
  backgroundColor: '#f4f7f6',
  textColor: '#1f2937'
};

// System configurations for validation workflow
export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  requireGestorValidation: true, // Se true, monitorias criadas por monitores precisam ser validadas pelo gestor
};

export const INITIAL_AREAS: Area[] = [
  { id: 'area-1', name: 'Relacionamento', gestorId: 'usr-2', monitorId: 'usr-2', active: true },
];

import { OFFICIAL_USERS, OFFICIAL_COLLABORATORS } from './teamData';

export const INITIAL_USERS = OFFICIAL_USERS;

export const INITIAL_COLLABORATORS = OFFICIAL_COLLABORATORS;

// Critérios oficiais de monitoria (CYF: 24 critérios + 4 eliminatórios).
// Substitui o conjunto mock anterior (F0-05). Canais aplicáveis a todos: os 6 canais suportados
// pela plataforma — nenhuma diferenciação por canal foi especificada nos materiais oficiais.
const ALL_CHANNELS: Canal[] = ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'];

export const INITIAL_CRITERIA: Criterion[] = [
  // FORMAS DO CONTATO (classificação — não pontua, peso 0)
  { id: 'crit-01', numero: 1, category: 'FORMAS DO CONTATO', name: 'Qual o motivo do contato?', description: 'Identifica o motivo que originou o contato do cliente.', orientacao: 'Classificar o contato entre Informação, Solicitação, Reclamação ou Sugestão. Campo de classificação, não avalia desempenho do atendente.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, minExpectedScore: 0, active: true, channels: ALL_CHANNELS,
    opcoes: ['Informação', 'Solicitação', 'Reclamação', 'Sugestão'] },
  { id: 'crit-02', numero: 2, category: 'FORMAS DO CONTATO', name: 'Atendimento ativo ou receptivo?', description: 'Identifica se o contato foi originado pela empresa (ativo) ou pelo cliente (receptivo).', orientacao: 'Classificar a origem do contato. Campo de classificação, não avalia desempenho do atendente.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, minExpectedScore: 0, active: true, channels: ALL_CHANNELS,
    opcoes: ['Ativo', 'Receptivo'] },
  // Inativo desde a 0.16.0: o Canal já é campo obrigatório da etapa 1 — e é ele que decide
  // quais critérios aparecem na etapa 3, via `channels.includes(canal)`. Perguntá-lo de novo
  // dentro da lista que ele mesmo filtrou é redundância. O critério permanece cadastrado, com
  // as opções, para que reativá-lo pelo Admin continue sendo uma decisão de uma tela só.
  { id: 'crit-03', numero: 3, category: 'FORMAS DO CONTATO', name: 'Atendimento realizado por qual canal?', description: 'Identifica o canal utilizado no atendimento.', orientacao: 'Registrar o canal do atendimento (WhatsApp, Telefone, Presencial ou E-mail). Campo de classificação, não avalia desempenho.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, minExpectedScore: 0, active: false, channels: ALL_CHANNELS,
    opcoes: ['WhatsApp', 'Telefone', 'Presencial', 'E-mail'] },

  // ABERTURA
  { id: 'crit-04', numero: 4, category: 'ABERTURA', name: 'Cumprimentos / identificação', description: 'Verifica se o agente realizou cumprimento e identificação adequados.', orientacao: 'Checklist: realizou o cumprimento e identificação? Cumprimentou de forma adequada e profissional? Demonstrou postura profissional e cortês? Apresentou escuta ativa, empatia e profissionalismo? Inicie com saudação adequada, apresente-se pelo nome e pergunte como pode ajudar, evitando gírias.', tipoResposta: 'CHECKLIST_SIM_NAO', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS,
    subPerguntas: [
      { id: 'sub-04-1', texto: 'O agente realizou o cumprimento e identificação?' },
      { id: 'sub-04-2', texto: 'Cumprimentou o cliente de forma adequada e profissional?' },
      { id: 'sub-04-3', texto: 'Demonstrou postura profissional e cortês?' },
      { id: 'sub-04-4', texto: 'Apresentou escuta ativa, empatia e profissionalismo?' },
    ] },
  { id: 'crit-05', numero: 5, category: 'ABERTURA', name: 'Rapidez para atender a ligação', description: 'Mede o tempo de resposta ao cliente.', orientacao: 'Excelente: atendeu em menos de 5 minutos. Bom: entre 5 e 15 minutos. Regular: acima de 15 minutos. Ruim: pediu um momento no início do atendimento. Esteja sempre preparado para iniciar o atendimento imediatamente.', tipoResposta: 'FAIXA_TEMPO', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },

  // COMUNICAÇÃO
  { id: 'crit-06', numero: 6, category: 'COMUNICAÇÃO', name: 'Demonstrou interesse e empatia com o pedido do cliente?', description: 'Avalia empatia e interesse genuíno pelo pedido do cliente.', orientacao: 'Faça perguntas pertinentes, demonstre curiosidade genuína, reconheça os sentimentos do cliente e use tom de voz calmo e acolhedor.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 2.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-07', numero: 7, category: 'COMUNICAÇÃO', name: 'Avisou que ia buscar informações antes de deixar o cliente em espera?', description: 'Verifica aviso prévio antes de colocar o cliente em espera.', orientacao: "Antes de se ausentar, explique que precisa de um momento para buscar informações. Use frases como 'Vou verificar essa informação, por favor aguarde um momento'.", tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-08', numero: 8, category: 'COMUNICAÇÃO', name: 'Ao retomar o contato agradeceu o tempo de espera?', description: 'Verifica agradecimento ao retomar o atendimento após espera.', orientacao: "Ao retornar, agradeça com frases como 'Obrigado por aguardar' ou 'Agradeço sua paciência'.", tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-09', numero: 9, category: 'COMUNICAÇÃO', name: 'Teve didática para explicar?', description: 'Avalia clareza didática nas explicações.', orientacao: 'Use linguagem simples, estruture a explicação em etapas, exemplifique de forma prática e confirme o entendimento do cliente ao longo da explicação.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-10', numero: 10, category: 'COMUNICAÇÃO', name: 'Fez argumentações pertinentes?', description: 'Avalia se as respostas foram diretamente relacionadas à necessidade do cliente.', orientacao: 'Baseie as respostas em fatos verificáveis e mantenha o foco no problema do cliente, evitando informações desnecessárias.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-11', numero: 11, category: 'COMUNICAÇÃO', name: 'Lidando com objeções?', description: 'Avalia a condução de objeções apresentadas pelo cliente.', orientacao: 'Escute ativamente, demonstre empatia, responda com informação clara, use perguntas de sondeio e proponha soluções mantendo a calma.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-12', numero: 12, category: 'COMUNICAÇÃO', name: 'Comunicação clara e transparente?', description: 'Avalia clareza e transparência na comunicação.', orientacao: 'Use linguagem simples e direta, organize a informação em ordem lógica e seja honesto sobre o que pode ou não ser feito.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-13', numero: 13, category: 'COMUNICAÇÃO', name: 'Gramática escrita e falada?', description: 'Avalia correção gramatical na escrita e na fala.', orientacao: 'Utilize a língua portuguesa corretamente, evitando erros de concordância e vocabulário informal, para transmitir profissionalismo e credibilidade.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-14', numero: 14, category: 'COMUNICAÇÃO', name: 'Tom de voz Moura Leite?', description: 'Avalia aderência ao tom de voz institucional da marca.', orientacao: 'Manter tom de voz alinhado à identidade da Moura Leite: profissional, cordial e acolhedor, evitando informalidade excessiva.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },

  // CONHECIMENTO DO PRODUTO/SERVIÇO
  { id: 'crit-15', numero: 15, category: 'CONHECIMENTO DO PRODUTO/SERVIÇO', name: 'O agente demonstrou habilidades de negociação eficazes?', description: 'Avalia habilidade de negociação em cobranças/condições.', orientacao: 'Explique valores e condições de forma clara, ofereça opções flexíveis de pagamento e busque um meio-termo que atenda cliente e empresa.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-16', numero: 16, category: 'CONHECIMENTO DO PRODUTO/SERVIÇO', name: 'Forneceu informações precisas e relevantes para resolver o problema do cliente?', description: 'Avalia precisão e relevância das informações fornecidas.', orientacao: 'Compreenda completamente o problema antes de responder, forneça apenas informação verificada e mantenha o foco no que foi perguntado.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 2.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-17', numero: 17, category: 'CONHECIMENTO DO PRODUTO/SERVIÇO', name: 'Ofereceu uma solução que atendesse às necessidades do cliente?', description: 'Avalia adequação da solução oferecida à necessidade do cliente.', orientacao: 'A solução final deve responder diretamente ao pedido inicial do cliente, evitando respostas genéricas ou automáticas.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },

  // PRECISÃO DAS INFORMAÇÕES
  { id: 'crit-18', numero: 18, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'O agente evitou desinformação ou engano?', description: 'Avalia se houve desinformação ou engano ao cliente.', orientacao: 'Verifique a precisão de qualquer informação antes de repassá-la; se não tiver certeza, comprometa-se a buscar e confirmar antes de responder.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 2.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-19', numero: 19, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'Resolução no Primeiro Contato - FCR?', description: 'Avalia se o problema foi resolvido já no primeiro contato.', orientacao: 'FCR: resolver a questão do cliente sem necessidade de novo contato. Prepare-se com informações e recursos necessários antes de iniciar o atendimento.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-20', numero: 20, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'Demonstrou paciência e profissionalismo?', description: 'Avalia paciência e postura profissional durante o atendimento.', orientacao: 'Mantenha a calma mesmo sob pressão, separe questões pessoais do atendimento e foque na resolução eficaz do problema.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-21', numero: 21, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'Aplicou a técnicas de desescalada?', description: 'Avalia uso de técnicas de desescalada em situações de tensão.', orientacao: 'Use tom calmo, valide os sentimentos do cliente, escute sem interromper e proponha soluções claras para reduzir a tensão. Aplicável apenas quando houver tensão no atendimento.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },

  // ENCERRAMENTO
  { id: 'crit-22', numero: 22, category: 'ENCERRAMENTO', name: 'Verificou se o cliente entendeu as informações repassadas?', description: 'Verifica confirmação de entendimento antes de encerrar.', orientacao: 'Faça um breve resumo dos pontos discutidos e pergunte se o cliente tem dúvidas antes de encerrar.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-23', numero: 23, category: 'ENCERRAMENTO', name: 'Construção de Relacionamento?', description: 'Avalia a construção de relacionamento ao longo de todo o atendimento.', orientacao: 'Cumprimente e identifique-se, escute ativamente, demonstre empatia, ofereça soluções personalizadas e agradeça o cliente ao longo da interação.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, minExpectedScore: 2, active: true, channels: ALL_CHANNELS },
  { id: 'crit-24', numero: 24, category: 'ENCERRAMENTO', name: 'Encerrou o contato corretamente?', description: 'Verifica encerramento correto, incluindo script obrigatório por canal.', orientacao: "Checklist: perguntou se o cliente possui mais alguma dúvida? Despediu-se de forma correta? Mensagem obrigatória para WhatsApp: 'Fico feliz em ter conseguido te auxiliar. Se surgir qualquer nova necessidade, é só nos chamar. Seguimos à disposição!'. Para telefone/presencial, seguir o script de encerramento institucional equivalente.", tipoResposta: 'CHECKLIST_SIM_NAO', eliminatorio: false, weight: 1.5, minExpectedScore: 2, active: true, channels: ALL_CHANNELS,
    subPerguntas: [
      { id: 'sub-24-1', texto: 'Perguntou se o cliente possui mais alguma dúvida?' },
      { id: 'sub-24-2', texto: 'Despediu-se de forma correta?' },
      { id: 'sub-24-3', texto: 'Realizou incentivo à pesquisa de satisfação?' },
    ] },

  // MANDOU MAL (eliminatórios — zeram a monitoria)
  { id: 'crit-25', numero: 25, category: 'MANDOU MAL', name: 'Confirmação de dados de segurança insuficiente', description: 'Verifica se houve confirmação adequada de dados de segurança antes de repassar informação sensível.', orientacao: 'Antes de fornecer qualquer informação sensível, confirme a identidade do cliente com perguntas de segurança (CPF, e-mail, data de nascimento, etc.), conforme a LGPD. Item eliminatório: se insuficiente, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, minExpectedScore: 0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-26', numero: 26, category: 'MANDOU MAL', name: 'Faltou com respeito ao cliente', description: 'Verifica tratamento desrespeitoso ao cliente.', orientacao: 'Qualquer tratamento rude, deselegante ou não profissional ao cliente. Item eliminatório: se ocorrer, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, minExpectedScore: 0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-27', numero: 27, category: 'MANDOU MAL', name: 'Ligação derrubada ou atendimento encerrado sem atendimento do cliente?', description: 'Verifica se a ligação foi derrubada ou encerrada sem atendimento efetivo.', orientacao: 'Contato interrompido ou finalizado sem que o cliente tenha sido efetivamente atendido. Item eliminatório: se ocorrer, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, minExpectedScore: 0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-28', numero: 28, category: 'MANDOU MAL', name: 'Promessa de produto/serviço inexistente', description: 'Verifica promessas de produtos/condições inexistentes.', orientacao: 'Não prometa ao cliente produto, condição ou serviço que não existe ou não é praticado pela empresa. Item eliminatório: se ocorrer, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, minExpectedScore: 0, active: true, channels: ALL_CHANNELS },
];

// Allocations with Start and End Dates (Vigência)
export const INITIAL_ALLOCATIONS: Allocation[] = [
  { id: 'alloc-1', monitorId: 'usr-2', colaboradorId: 'usr-3', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-2', monitorId: 'usr-2', colaboradorId: 'usr-4', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-3', monitorId: 'usr-2', colaboradorId: 'usr-5', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-4', monitorId: 'usr-2', colaboradorId: 'usr-1', startDate: '2026-01-01', endDate: null, active: true },
  { id: 'alloc-5', monitorId: 'usr-1', colaboradorId: 'usr-6', startDate: '2026-01-01', endDate: null, active: true },
];

// Audit logs for allocation operations
export const INITIAL_ALLOCATION_HISTORY: AllocationHistoryEntry[] = [
  { id: 'log-1', allocationId: 'alloc-1', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:00:00Z', details: 'Nathalia Perger alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-2', allocationId: 'alloc-2', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:05:00Z', details: 'Allanis Maquea alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-3', allocationId: 'alloc-3', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:10:00Z', details: 'Susana Nascimento alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-4', allocationId: 'alloc-4', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:15:00Z', details: 'Aline Oliveira Verneck alocada para Raquel Lopes. Vigência: 01/01/2026.' },
  { id: 'log-5', allocationId: 'alloc-5', actionType: 'INSERT', changedBy: 'usr-2', changedAt: '2026-01-01T09:20:00Z', details: 'Raquel Lopes alocada para Raquel Lopes. Vigência: 01/01/2026.' },
];

// Meta Nível 1: Metas Mensais por Carteira do Monitor
export const INITIAL_MONITOR_GOALS: MonitorGoal[] = [
  { id: 'mgoal-1', monitorId: 'usr-2', year: 2026, month: 5, targetQty: 30 },
  { id: 'mgoal-2', monitorId: 'usr-1', year: 2026, month: 5, targetQty: 5 },
];

// Meta Nível 2: Metas Individuais por Colaborador
export const INITIAL_COLABORADOR_GOALS: ColaboradorGoal[] = [
  { id: 'cgoal-1', monitorId: 'usr-2', colaboradorId: 'usr-3', year: 2026, month: 5, targetQty: 10 },
  { id: 'cgoal-2', monitorId: 'usr-2', colaboradorId: 'usr-4', year: 2026, month: 5, targetQty: 10 },
  { id: 'cgoal-3', monitorId: 'usr-2', colaboradorId: 'usr-5', year: 2026, month: 5, targetQty: 5 },
  { id: 'cgoal-4', monitorId: 'usr-2', colaboradorId: 'usr-1', year: 2026, month: 5, targetQty: 5 },
  { id: 'cgoal-5', monitorId: 'usr-1', colaboradorId: 'usr-6', year: 2026, month: 5, targetQty: 5 },
];

// Evaluation records (Seeded - limpo para evitar inconsistência com novos critérios)
export const INITIAL_MONITORINGS: Monitoring[] = [];

// INITIAL_SURVEYS foi removido junto com o item "Pesquisas". Era código morto — nenhum
// repositório o carregava — e modelava cada resposta como nota sobre o colaborador
// (collaboratorId), que é justamente o entendimento abandonado: a resposta é do CLIENTE.
// O modelo de CSAT e NPS será desenhado com o cliente como sujeito.

export const INITIAL_HOLIDAYS: Holiday[] = [
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
