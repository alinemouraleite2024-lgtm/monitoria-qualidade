// Mock Data — Plataforma de Gestão da Qualidade
import { REGUA_VALIDADA } from './constants/regua';
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
  // A monitoria de agosto é realizada em setembro: a agenda do mês corrente aponta para o
  // anterior. Ver SystemSettings.defasagemCompetencia.
  defasagemCompetencia: 1,
};

// A área nasce sem gestor e sem monitores: são vínculos de pessoas, e pessoa não se declara em
// código. O Admin atribui em Administração assim que houver quem atribuir.
export const INITIAL_AREAS: Area[] = [
  { id: 'area-1', name: 'Relacionamento', gestorId: '', monitorIds: [], active: true },
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
  { id: 'crit-01', numero: 1, category: 'FORMAS DO CONTATO', name: 'Qual o motivo do contato?', description: 'Identifica o motivo que originou o contato do cliente.', orientacao: 'Classificar o contato entre Informação, Solicitação, Reclamação ou Sugestão. Campo de classificação, não avalia desempenho do atendente.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, active: true, channels: ALL_CHANNELS,
    opcoes: ['Informação', 'Solicitação', 'Reclamação', 'Sugestão'] },
  { id: 'crit-02', numero: 2, category: 'FORMAS DO CONTATO', name: 'Atendimento ativo ou receptivo?', description: 'Identifica se o contato foi originado pela empresa (ativo) ou pelo cliente (receptivo).', orientacao: 'Classificar a origem do contato. Campo de classificação, não avalia desempenho do atendente.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, active: true, channels: ALL_CHANNELS,
    opcoes: ['Ativo', 'Receptivo'] },
  // Inativo desde a 0.16.0: o Canal já é campo obrigatório da etapa 1 — e é ele que decide
  // quais critérios aparecem na etapa 3, via `channels.includes(canal)`. Perguntá-lo de novo
  // dentro da lista que ele mesmo filtrou é redundância. O critério permanece cadastrado, com
  // as opções, para que reativá-lo pelo Admin continue sendo uma decisão de uma tela só.
  { id: 'crit-03', numero: 3, category: 'FORMAS DO CONTATO', name: 'Atendimento realizado por qual canal?', description: 'Identifica o canal utilizado no atendimento.', orientacao: 'Registrar o canal do atendimento (WhatsApp, Telefone, Presencial ou E-mail). Campo de classificação, não avalia desempenho.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, active: false, channels: ALL_CHANNELS,
    opcoes: ['WhatsApp', 'Telefone', 'Presencial', 'E-mail'] },

  // ABERTURA
  { id: 'crit-04', numero: 4, category: 'ABERTURA', name: 'Cumprimentos / identificação', description: 'Verifica se o agente realizou cumprimento e identificação adequados.', orientacao: 'Checklist: realizou o cumprimento e identificação? Cumprimentou de forma adequada e profissional? Demonstrou postura profissional e cortês? Apresentou escuta ativa, empatia e profissionalismo? Inicie com saudação adequada, apresente-se pelo nome e pergunte como pode ajudar, evitando gírias.', tipoResposta: 'CHECKLIST_SIM_NAO', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS,
    subPerguntas: [
      { id: 'sub-04-1', texto: 'O agente realizou o cumprimento e identificação?' },
      { id: 'sub-04-2', texto: 'Cumprimentou o cliente de forma adequada e profissional?' },
      { id: 'sub-04-3', texto: 'Demonstrou postura profissional e cortês?' },
      { id: 'sub-04-4', texto: 'Apresentou escuta ativa, empatia e profissionalismo?' },
    ] },
  { id: 'crit-05', numero: 5, category: 'ABERTURA', name: 'Rapidez para atender a ligação', description: 'Mede o tempo de resposta ao cliente.', orientacao: 'Excelente: atendeu em menos de 5 minutos. Bom: entre 5 e 15 minutos. Regular: acima de 15 minutos. Ruim: pediu um momento no início do atendimento. Esteja sempre preparado para iniciar o atendimento imediatamente.', tipoResposta: 'FAIXA_TEMPO', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },

  // COMUNICAÇÃO
  { id: 'crit-06', numero: 6, category: 'COMUNICAÇÃO', name: 'Demonstrou interesse e empatia com o pedido do cliente?', description: 'Avalia empatia e interesse genuíno pelo pedido do cliente.', orientacao: 'Faça perguntas pertinentes, demonstre curiosidade genuína, reconheça os sentimentos do cliente e use tom de voz calmo e acolhedor.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 2.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-07', numero: 7, category: 'COMUNICAÇÃO', name: 'Avisou que ia buscar informações antes de deixar o cliente em espera?', description: 'Verifica aviso prévio antes de colocar o cliente em espera.', orientacao: "Antes de se ausentar, explique que precisa de um momento para buscar informações. Use frases como 'Vou verificar essa informação, por favor aguarde um momento'.", tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-08', numero: 8, category: 'COMUNICAÇÃO', name: 'Ao retomar o contato agradeceu o tempo de espera?', description: 'Verifica agradecimento ao retomar o atendimento após espera.', orientacao: "Ao retornar, agradeça com frases como 'Obrigado por aguardar' ou 'Agradeço sua paciência'.", tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-09', numero: 9, category: 'COMUNICAÇÃO', name: 'Teve didática para explicar?', description: 'Avalia clareza didática nas explicações.', orientacao: 'Use linguagem simples, estruture a explicação em etapas, exemplifique de forma prática e confirme o entendimento do cliente ao longo da explicação.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-10', numero: 10, category: 'COMUNICAÇÃO', name: 'Fez argumentações pertinentes?', description: 'Avalia se as respostas foram diretamente relacionadas à necessidade do cliente.', orientacao: 'Baseie as respostas em fatos verificáveis e mantenha o foco no problema do cliente, evitando informações desnecessárias.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-11', numero: 11, category: 'COMUNICAÇÃO', name: 'Lidando com objeções?', description: 'Avalia a condução de objeções apresentadas pelo cliente.', orientacao: 'Escute ativamente, demonstre empatia, responda com informação clara, use perguntas de sondeio e proponha soluções mantendo a calma.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, active: true, channels: ALL_CHANNELS },
  { id: 'crit-12', numero: 12, category: 'COMUNICAÇÃO', name: 'Comunicação clara e transparente?', description: 'Avalia clareza e transparência na comunicação.', orientacao: 'Use linguagem simples e direta, organize a informação em ordem lógica e seja honesto sobre o que pode ou não ser feito.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, active: true, channels: ALL_CHANNELS },
  { id: 'crit-13', numero: 13, category: 'COMUNICAÇÃO', name: 'Gramática escrita e falada?', description: 'Avalia correção gramatical na escrita e na fala.', orientacao: 'Utilize a língua portuguesa corretamente, evitando erros de concordância e vocabulário informal, para transmitir profissionalismo e credibilidade.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-14', numero: 14, category: 'COMUNICAÇÃO', name: 'Tom de voz Moura Leite?', description: 'Avalia aderência ao tom de voz institucional da marca.', orientacao: 'Manter tom de voz alinhado à identidade da Moura Leite: profissional, cordial e acolhedor, evitando informalidade excessiva.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },

  // CONHECIMENTO DO PRODUTO/SERVIÇO
  { id: 'crit-15', numero: 15, category: 'CONHECIMENTO DO PRODUTO/SERVIÇO', name: 'O agente demonstrou habilidades de negociação eficazes?', description: 'Avalia habilidade de negociação em cobranças/condições.', orientacao: 'Explique valores e condições de forma clara, ofereça opções flexíveis de pagamento e busque um meio-termo que atenda cliente e empresa.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, active: true, channels: ALL_CHANNELS },
  { id: 'crit-16', numero: 16, category: 'CONHECIMENTO DO PRODUTO/SERVIÇO', name: 'Forneceu informações precisas e relevantes para resolver o problema do cliente?', description: 'Avalia precisão e relevância das informações fornecidas.', orientacao: 'Compreenda completamente o problema antes de responder, forneça apenas informação verificada e mantenha o foco no que foi perguntado.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 2.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-17', numero: 17, category: 'CONHECIMENTO DO PRODUTO/SERVIÇO', name: 'Ofereceu uma solução que atendesse às necessidades do cliente?', description: 'Avalia adequação da solução oferecida à necessidade do cliente.', orientacao: 'A solução final deve responder diretamente ao pedido inicial do cliente, evitando respostas genéricas ou automáticas.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, active: true, channels: ALL_CHANNELS },

  // PRECISÃO DAS INFORMAÇÕES
  { id: 'crit-18', numero: 18, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'O agente evitou desinformação ou engano?', description: 'Avalia se houve desinformação ou engano ao cliente.', orientacao: 'Verifique a precisão de qualquer informação antes de repassá-la; se não tiver certeza, comprometa-se a buscar e confirmar antes de responder.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 2.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-19', numero: 19, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'Resolução no Primeiro Contato - FCR?', description: 'Avalia se o problema foi resolvido já no primeiro contato.', orientacao: 'FCR: resolver a questão do cliente sem necessidade de novo contato. Prepare-se com informações e recursos necessários antes de iniciar o atendimento.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.5, active: true, channels: ALL_CHANNELS },
  { id: 'crit-20', numero: 20, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'Demonstrou paciência e profissionalismo?', description: 'Avalia paciência e postura profissional durante o atendimento.', orientacao: 'Mantenha a calma mesmo sob pressão, separe questões pessoais do atendimento e foque na resolução eficaz do problema.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-21', numero: 21, category: 'PRECISÃO DAS INFORMAÇÕES', name: 'Aplicou a técnicas de desescalada?', description: 'Avalia uso de técnicas de desescalada em situações de tensão.', orientacao: 'Use tom calmo, valide os sentimentos do cliente, escute sem interromper e proponha soluções claras para reduzir a tensão. Aplicável apenas quando houver tensão no atendimento.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },

  // ENCERRAMENTO
  { id: 'crit-22', numero: 22, category: 'ENCERRAMENTO', name: 'Verificou se o cliente entendeu as informações repassadas?', description: 'Verifica confirmação de entendimento antes de encerrar.', orientacao: 'Faça um breve resumo dos pontos discutidos e pergunte se o cliente tem dúvidas antes de encerrar.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-23', numero: 23, category: 'ENCERRAMENTO', name: 'Construção de Relacionamento?', description: 'Avalia a construção de relacionamento ao longo de todo o atendimento.', orientacao: 'Cumprimente e identifique-se, escute ativamente, demonstre empatia, ofereça soluções personalizadas e agradeça o cliente ao longo da interação.', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-24', numero: 24, category: 'ENCERRAMENTO', name: 'Encerrou o contato corretamente?', description: 'Verifica encerramento correto, incluindo script obrigatório por canal.', orientacao: "Checklist: perguntou se o cliente possui mais alguma dúvida? Despediu-se de forma correta? Mensagem obrigatória para WhatsApp: 'Fico feliz em ter conseguido te auxiliar. Se surgir qualquer nova necessidade, é só nos chamar. Seguimos à disposição!'. Para telefone/presencial, seguir o script de encerramento institucional equivalente.", tipoResposta: 'CHECKLIST_SIM_NAO', eliminatorio: false, weight: 1.5, active: true, channels: ALL_CHANNELS,
    subPerguntas: [
      { id: 'sub-24-1', texto: 'Perguntou se o cliente possui mais alguma dúvida?' },
      { id: 'sub-24-2', texto: 'Despediu-se de forma correta?' },
      { id: 'sub-24-3', texto: 'Realizou incentivo à pesquisa de satisfação?' },
    ] },

  // MANDOU MAL (eliminatórios — zeram a monitoria)
  { id: 'crit-25', numero: 25, category: 'MANDOU MAL', name: 'Confirmação de dados de segurança insuficiente', description: 'Verifica se houve confirmação adequada de dados de segurança antes de repassar informação sensível.', orientacao: 'Antes de fornecer qualquer informação sensível, confirme a identidade do cliente com perguntas de segurança (CPF, e-mail, data de nascimento, etc.), conforme a LGPD. Item eliminatório: se insuficiente, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-26', numero: 26, category: 'MANDOU MAL', name: 'Faltou com respeito ao cliente', description: 'Verifica tratamento desrespeitoso ao cliente.', orientacao: 'Qualquer tratamento rude, deselegante ou não profissional ao cliente. Item eliminatório: se ocorrer, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-27', numero: 27, category: 'MANDOU MAL', name: 'Ligação derrubada ou atendimento encerrado sem atendimento do cliente?', description: 'Verifica se a ligação foi derrubada ou encerrada sem atendimento efetivo.', orientacao: 'Contato interrompido ou finalizado sem que o cliente tenha sido efetivamente atendido. Item eliminatório: se ocorrer, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, active: true, channels: ALL_CHANNELS },
  { id: 'crit-28', numero: 28, category: 'MANDOU MAL', name: 'Promessa de produto/serviço inexistente', description: 'Verifica promessas de produtos/condições inexistentes.', orientacao: 'Não prometa ao cliente produto, condição ou serviço que não existe ou não é praticado pela empresa. Item eliminatório: se ocorrer, zera a monitoria.', tipoResposta: 'SIM_NAO', eliminatorio: true, weight: 0, active: true, channels: ALL_CHANNELS },

  // Criado na 0.18.0, a partir de um achado da validação da régua: o critério 25 acionava
  // eliminatório em atendimento correto, porque nada registrava que a autenticação já havia
  // ocorrido antes da interação humana. Fica no bloco de classificação por ser contexto — e
  // governa o 25 (ver domain/criterionGating).
  { id: 'crit-29', numero: 29, category: 'FORMAS DO CONTATO', name: 'Cliente chegou autenticado?', description: 'Identifica se o canal reconheceu o cliente antes de a atendente assumir a conversa.', orientacao: 'O roteiro do Blip tem duas aberturas: AUTENTICADO cumprimenta pelo nome, SEM AUTENTICAÇÃO pede o nome. O que separa as duas é o contato vir do número cadastrado — número diferente dispara a bateria de confirmação. A prova está nas primeiras mensagens da conversa. Em canais sem pré-autenticação (telefone, presencial), a resposta é Não.', tipoResposta: 'MULTIPLA_ESCOLHA', eliminatorio: false, weight: 0, active: true, channels: ALL_CHANNELS,
    opcoes: ['Sim', 'Não', 'Não identificável'] },
];

// A régua validada entra aqui, e não copiada linha a linha acima: os mesmos textos precisam
// alimentar o seed e a migração de bases já gravadas (ver migrateCriterios). Uma fonte só.
INITIAL_CRITERIA.forEach((c) => {
  const regua = REGUA_VALIDADA[c.id];
  if (!regua) return;
  if (regua.orientacao) c.orientacao = regua.orientacao;
  if (regua.ancoras) c.ancoras = regua.ancoras;
  if (regua.quandoNA) c.quandoNA = regua.quandoNA;
  if (regua.subPerguntas && c.subPerguntas) {
    c.subPerguntas = c.subPerguntas.map((sp) => {
      const r = regua.subPerguntas!.find((x: { id: string }) => x.id === sp.id);
      return r ? { ...sp, criterioSim: r.criterioSim, criterioNao: r.criterioNao } : sp;
    });
  }
});

// Vínculos, metas e histórico nascem vazios desde a 0.17.0.
//
// Todos eles são relações entre pessoas — quem monitora quem, quanto cada um entrega. Declarar
// isso em código foi o que prendeu o sistema a uma equipe específica: quando a supervisora saiu,
// quatro carteiras, cinco metas e a área inteira apontavam para um usuário que não existia mais.
//
// A estrutura operacional passa a ser montada em Administração e Equipe, pelo Admin, quando
// houver gestores e monitores cadastrados. Base vazia é um sistema pedindo configuração; base
// semeada com nomes é um sistema afirmando algo falso.
export const INITIAL_ALLOCATIONS: Allocation[] = [];

export const INITIAL_ALLOCATION_HISTORY: AllocationHistoryEntry[] = [];

/** Meta Nível 1: metas mensais por carteira do monitor. */
export const INITIAL_MONITOR_GOALS: MonitorGoal[] = [];

/** Meta Nível 2: metas individuais por colaborador. */
export const INITIAL_COLABORADOR_GOALS: ColaboradorGoal[] = [];

// Evaluation records (Seeded - limpo para evitar inconsistência com novos critérios)
export const INITIAL_MONITORINGS: Monitoring[] = [];

// INITIAL_SURVEYS foi removido junto com o item "Pesquisas". Era código morto — nenhum
// repositório o carregava — e modelava cada resposta como nota sobre o colaborador
// (collaboratorId), que é justamente o entendimento abandonado: a resposta é do CLIENTE.
// O modelo de CSAT e NPS será desenhado com o cliente como sujeito.

// Substituições por férias: também são relação entre pessoas, e a única que existia apontava
// para um monitor que deixou de existir. Cadastradas em Equipe quando houver afastamento.
export const INITIAL_HOLIDAYS: Holiday[] = [];


// Demandas, avisos e agenda nascem vazios desde a 0.17.0.
//
// Os três eram povoados com conteúdo inventado — contestações que ninguém abriu, avisos de
// mudanças que não aconteceram e uma semana de junho inteira de compromissos — tudo atribuído
// a um usuário que deixou de existir. Um gestor novo abria o sistema e via trabalho fictício
// com nome de gente real.
//
// A estrutura de demandas é preservada de propósito (ver docs/VISAO-PRODUTO.md): ela já tem a
// forma da tratativa de NPS. O que sai é o conteúdo de exemplo, não o modelo.
export const INITIAL_DEMANDS = [];

export const INITIAL_ANNOUNCEMENTS = [];

export const INITIAL_AGENDA = [];
