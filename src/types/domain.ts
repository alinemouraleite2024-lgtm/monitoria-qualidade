// Tipos de domínio compartilhados (F0-15).
//
// Descrevem as formas que os dados já têm em runtime — este arquivo documenta o modelo
// existente, não propõe um novo. Onde o código atual diverge de si mesmo, a divergência está
// registrada em comentário em vez de ser silenciosamente corrigida: unificar formatos é
// mudança de comportamento e tem história própria.

// ---------------------------------------------------------------------------
// Papéis, permissões e status de usuário
// ---------------------------------------------------------------------------

/** Papéis com menu e permissões declaradas. */
export type Role = 'ADMIN' | 'GESTOR' | 'MONITOR';

/**
 * Quem não acessa o portal tem `perfis: []` — a lista vazia é o próprio registro de que não há
 * acesso. Até a 0.19.0 isso era um papel 'COLABORADOR' que o login recusava caso a caso; a
 * ausência de perfil diz a mesma coisa sem depender de um valor especial, e some junto o
 * `AnyRole`, que existia só para acomodá-lo.
 */

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type Permission =
  | 'VIEW_DASHBOARD' | 'VIEW_PLANNING' | 'VIEW_MONITORINGS'
  | 'VIEW_CSAT' | 'VIEW_NPS' | 'VIEW_REPORTS' | 'VIEW_COLLABORATORS'
  | 'VIEW_MY_PROFILE' | 'VIEW_MONITORING_FORM' | 'VIEW_ADMINISTRATION'
  | 'CREATE_MONITORING' | 'EDIT_MONITORING' | 'DELETE_MONITORING' | 'APPROVE_MONITORING'
  | 'EXPORT_REPORTS' | 'MANAGE_USERS' | 'MANAGE_INTEGRATIONS' | 'LANCAR_RETROATIVO';

/**
 * Registro de usuário. Dois formatos coexistem no mesmo array (débito 5 da Sprint 0):
 * UserManagement grava o registro completo; UserModal grava apenas o núcleo. Por isso tudo
 * além de id/name/email/role é opcional — é o que o dado realmente garante.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  /**
   * Perfis concedidos. Substitui o `role` singular na 0.20.0.
   *
   * Uma pessoa pode acumular perfis — administrar e monitorar, por exemplo — sem precisar de
   * duas contas. O que ela *é agora* não vive aqui: é o perfil ativo da sessão. Guardar o
   * perfil ativo no usuário faria a escolha de contexto de uma pessoa mudar como todas as
   * outras a enxergam nas listas.
   */
  perfis: Role[];
  active?: boolean;
  team?: string;
  login?: string;
  password?: string;
  status?: UserStatus;
  provider?: string;
  cargo?: string;
  area?: string;
  gestor?: string | null;
  lastAccess?: string;
  photoUrl?: string;
  observacoes?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  cargo: string;
  areaId: string;
  active: boolean;
}

export interface Area {
  id: string;
  name: string;
  /** Gestor responsável. Define o escopo do que ele valida e acompanha — ver `getEquipeDoGestor`. */
  gestorId: string;
  /**
   * Monitores da área. Era `monitorId: string` até a 0.16.0, e o singular limitava a área a um
   * monitor — o filtro do Dashboard chegava a colapsar a equipe inteira em uma pessoa.
   */
  monitorIds: string[];
  active: boolean;
}

// ---------------------------------------------------------------------------
// Critérios de avaliação
// ---------------------------------------------------------------------------

/**
 * Tipos de resposta de um critério.
 *
 * Cada um tem renderização própria no MonitoringForm desde a 0.16.0:
 * - `ESCALA_4` e `FAIXA_TEMPO` usam a escala pontuável (valores diferentes, mesmo widget).
 * - `CHECKLIST_SIM_NAO` abre uma linha Sim/Não por sub-pergunta.
 * - `SIM_NAO` é dos eliminatórios, com os rótulos "Não ocorreu" / "Sim, ocorreu" — tratado
 *   pela flag `eliminatorio`, que vem antes do tipo na decisão de renderização.
 * - `MULTIPLA_ESCOLHA` é classificação pura: lista as `opcoes` do critério, não pontua e não
 *   pede justificativa. Até a 0.15.0 caía no fallback da escala e aparecia como 2/1/0/N/A,
 *   o que fazia o motivo do contato ser exibido como se fosse nota.
 */
export type TipoResposta =
  | 'ESCALA_4' | 'CHECKLIST_SIM_NAO' | 'FAIXA_TEMPO' | 'MULTIPLA_ESCOLHA' | 'SIM_NAO';

export type Canal = 'WhatsApp' | 'Telefone' | 'Teams' | 'Presencial' | 'E-mail' | 'Chat';

export interface SubPergunta {
  id: string;
  texto: string;
  /** Régua da sub-pergunta: quando responder SIM. Cadastrado na 3A.0. */
  criterioSim?: string;
  /** Idem para NÃO. */
  criterioNao?: string;
}

export interface Criterion {
  id: string;
  numero: number | null;
  category: string;
  name: string;
  description: string;
  orientacao: string;
  tipoResposta: TipoResposta;
  eliminatorio: boolean;
  /** Peso 0 marca critério de classificação: não entra no denominador da nota. */
  weight: number;
  active: boolean;
  channels: Canal[];
  subPerguntas?: SubPergunta[];
  /**
   * Opções de um critério `MULTIPLA_ESCOLHA`. Antes da 0.16.0 elas só existiam em prosa,
   * dentro do texto de `orientacao` — não havia onde a tela buscá-las, e por isso o critério
   * caía na escala pontuável.
   */
  opcoes?: string[];
  /**
   * A régua de decisão, indexada pela resposta como ela é gravada em `MonitoringScore.score`
   * — '2' | '1' | '0' na escala, '2' | '1.33' | '0.67' | '0' na faixa de tempo, o texto da
   * opção na classificação. Checklist não usa: a régua dele é por sub-pergunta.
   *
   * É o que separa "orientação" de "critério de decisão". A orientação é prosa para quem lê;
   * a âncora diz o que cada valor significa, e é dela que o `instructionBuilder` (3A.1) monta
   * a instrução — sem precisar interpretar texto livre.
   */
  ancoras?: Record<string, string>;
  /** Quando marcar N/A. Só faz sentido onde N/A é resposta possível. */
  quandoNA?: string;
}

// ---------------------------------------------------------------------------
// Monitorias
// ---------------------------------------------------------------------------

/**
 * Status de monitoria.
 *
 * DIVERGÊNCIA REGISTRADA (débito da Sprint 0): apenas seis destes são efetivamente
 * produzidos — Rascunho, Pendente, Concluída, Validada, Reprovada e Cancelada. Os valores
 * Aprovada e "Aguardando Aprovação" são apenas lidos: aparecem no filtro e nos badges de
 * MonitoringList e na condição de aprovação de MonitoringHistory, mas nenhum caminho do
 * código os grava. Mantidos no tipo porque o código ainda os compara — removê-los seria
 * mudança de comportamento.
 */
export type MonitoringStatus =
  | 'Rascunho' | 'Pendente' | 'Concluída' | 'Validada' | 'Reprovada' | 'Cancelada'
  | 'Aprovada' | 'Aguardando Aprovação'
  /** Devolvida pelo supervisor para ajustes (script 21): entregue, aguardando a correção da monitora. */
  | 'Em reavaliação';

/** Tipos oficiais. Fluxo e "Fluxo / Processo" são migrados para Processo no carregamento. */
export type TipoMonitoria = 'Regular' | 'Direcionada' | 'Processo' | 'Calibração';

/**
 * Resposta de um critério.
 *
 * `score` carrega quatro coisas diferentes, por tipo de critério:
 * - **número** (0 a 2, fracionário em checklist e faixa de tempo) — critérios pontuáveis;
 * - **`'N/A'`** — não se aplica: sai do denominador, não penaliza nem premia;
 * - **`''`** — ainda não respondido, ou checklist incompleto;
 * - **texto da opção** — critérios `MULTIPLA_ESCOLHA`, desde a 0.16.0.
 *
 * O texto não corrompe a nota porque os três critérios de classificação têm peso 0, e a
 * aritmética do cálculo está toda dentro de `if (weight > 0)`. Foi por isso que a mudança
 * coube sem tocar no cálculo.
 */
export interface MonitoringScore {
  criterionId: string;
  score: number | string;
  lowScoreReason: string;
  subRespostas: Record<string, 'SIM' | 'NAO'> | null;
}

export interface Monitoring {
  id: string;
  /**
   * Mês a que o trabalho pertence, no formato `'YYYY-MM'`. É o eixo de metas, fila e
   * relatórios.
   *
   * Até a 0.21.0 essa função era exercida por `date`, um campo rotulado apenas "Data" na tela.
   * Quem avaliava em setembro um atendimento de agosto precisava adivinhar qual das duas datas
   * o campo queria — e a escolha errada movia a monitoria de competência em silêncio. Havia um
   * aviso quando o mês divergia de `inicioAtendimento`, mas avisar sobre um campo ambíguo não
   * o torna claro.
   *
   * String, e não `{ year, month }`: é comparável direto, ordenável, e não atravessa fuso —
   * `periodOf` precisa de tratamento especial para não devolver julho no dia 1º de agosto.
   */
  competencia: string;
  /**
   * Data do atendimento avaliado. Desde a 0.22.0 **não decide mais a competência** — descreve
   * quando o atendimento aconteceu, e só isso.
   */
  date: string;
  monitorId: string;
  colaboradorId: string;
  canal: Canal;
  tipo: TipoMonitoria;
  status: MonitoringStatus;
  /** Escala 0-100. Dados anteriores em 0-10 são migrados no carregamento. */
  finalScore: number;
  scores: MonitoringScore[];
  comments?: string;
  /**
   * Legado. Deixou de ser preenchido na 0.14.0, quando o campo saiu da tela de Nova Monitoria.
   * O valor gravado em registros anteriores é preservado de propósito — nunca foi lido fora do
   * formulário, então remover a coluna não ganharia nada e apagar dado é irreversível.
   */
  empreendimento?: string;
  categoriaAtendimento?: string;

  // Identificadores do atendimento. São três coisas diferentes na operação, e os três entram
  // na busca do Histórico e da Fila. `protocolo` é o mais antigo (0.9.0); os outros dois
  // nasceram na 0.14.0, então registros anteriores não os têm.
  numeroAtendimento?: string;
  protocolo?: string;
  numeroTitulo?: string;

  /**
   * Legado. Até a 0.13.0 a duração era digitada à mão como texto livre ("00:05"). Substituído
   * na 0.14.0 por inicioAtendimento/fimAtendimento com duracaoMinutos calculado. Continua
   * sendo exibido quando duracaoMinutos não existe — ver formatarDuracao em domain/duracao.
   */
  tempo?: string;
  /** Data e hora locais do início do atendimento, formato de datetime-local: "2026-08-25T14:20". */
  inicioAtendimento?: string;
  /** Idem para o encerramento. Pode cair em outro dia — atendimento de WhatsApp atravessa o dia. */
  fimAtendimento?: string;
  /** Duração em minutos, derivada do par acima. Calculada pelo sistema; nunca editável. */
  duracaoMinutos?: number;

  gestorId?: string;
  /** Campos de feedback livre. Os nomes são em inglês no dado, embora os rótulos da UI
   *  sejam "Pontos Fortes" e "Oportunidades" — mantidos como estão. */
  strengths?: string;
  opportunities?: string;

  // Blocos narrativos do relatório (0.18.0). Junto com strengths e opportunities, completam
  // os seis blocos do `Padrão Relatório de Monitoria` — ver §7 da metodologia. São o destino
  // do que o assistente da 3A.3 vai escrever; sem eles a sugestão não teria onde ser colada.
  // Opcionais: monitoria registrada antes desta versão simplesmente não os tem.
  /** Relatório Completo: HTML limpo, colado do Word. Complementar: não entra na nota. */
  relatorioCompleto?: string;
  /** Concluída e guardada na área privada, ainda não enviada para validação (script 19). */
  aguardandoLiberacao?: boolean;
  /** Última conclusão válida. Ausente em monitorias anteriores ao script 19. */
  concluidaEm?: string;
  /** Primeiro envio para validação: a data real de disponibilização. */
  enviadoEm?: string;
  criadoEm?: string;
  /** Narrativa factual e cronológica do atendimento, sem juízo de valor. */
  contexto?: string;
  /** O que os critérios, somados, revelam sobre a condução. Conecta, não repete. */
  leituraTecnica?: string;
  /** Só quando houver. Alimentado pelas falhas graves do tipo de atendimento. */
  errosIdentificados?: string;
  /** Nível do atendimento, impacto na experiência e direcionamento. */
  conclusao?: string;
  evidencias?: unknown[];
  links?: unknown[];
  evidenciaObservacoes?: string;
  /** F0-08: eliminatório sinalizado, aguardando decisão de Gestor/Admin. */
  eliminatoryPending?: boolean;
  zerada?: boolean;
  eliminatoryConfirmedBy?: string;
  eliminatoryConfirmedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Motivo preservado quando o gestor devolve a monitoria como Rascunho. */
  adjustmentReason?: string;
  /**
   * Lançamento retroativo (0.22.0): monitoria de competência passada, registrada para
   * reconstruir histórico. Nasce `Validada` porque a fila de validação é recortada pela
   * competência corrente — lançada como `Pendente`, uma monitoria de janeiro não apareceria
   * em fila nenhuma e ficaria aguardando validação para sempre.
   *
   * Presente só nesses registros, e é o que sustenta o selo na interface: uma monitoria que
   * não passou por validação real não pode ser indistinguível de uma que passou.
   */
  lancamentoRetroativo?: { por: string; em: string };

  // Modo compartilhado (banco Supabase). Presentes só nas monitorias lidas do banco.
  /** Versão do registro no banco: toda gravação informa a versão lida (concorrência, 00). */
  versao?: number;
  /** 'portal' (registrada no banco) ou 'migracao' (veio do portal antigo). */
  origem?: 'portal' | 'migracao';
  /** Versão da régua fixada no primeiro envio (E2/E3). Nula em rascunho e em migrada não reenviada. */
  reguaVersaoId?: string | null;
  /** Migrada: nota gravada no portal antigo, preservada (E4b). */
  notaHistorica?: number;
  /** Conta das respostas feita pelo banco; o zeramento muda só `finalScore` (E5). */
  notaCalculada?: number;
  /** Motivo da reprovação (D5). */
  motivoReprovacao?: string;
  /**
   * Histórico de calibração (Etapa B). Ausente = ambiente sem histórico (banco sem o script 14,
   * ou monitoria local anterior a ele); lista vazia = histórico ativo, ainda sem eventos.
   */
  historico?: EventoCalibracao[];
  /**
   * Chave da requisição de criação (uuid gerado uma vez por formulário novo). Vai só na
   * criação: repetir a mesma chave devolve a monitoria já criada, sem criar outra (script 15).
   */
  chaveCriacao?: string;
  /** Cancelada por duplicidade: a monitoria original, da qual esta era cópia (script 15). */
  duplicataDe?: string;
  /** Motivo do cancelamento pelo ADMIN (D7). */
  motivoCancelamento?: string;
}

export type TipoEventoCalibracao =
  | 'ENVIO' | 'REENVIO' | 'VALIDACAO' | 'DEVOLUCAO' | 'REPROVACAO'
  | 'ZERAMENTO_CONFIRMADO' | 'ELIMINATORIO_AFASTADO' | 'CANCELAMENTO' | 'OBSERVACAO';

/** Um acontecimento do histórico de calibração. Só de acréscimo: nunca é alterado nem removido. */
export interface EventoCalibracao {
  id: string;
  tipo: TipoEventoCalibracao;
  /** 1 no primeiro envio; cada reenvio abre uma rodada nova. */
  rodada: number;
  statusResultante: MonitoringStatus;
  /** Nota da monitoria no momento do evento. */
  nota: number | null;
  consideracoes?: string | null;
  /** Zeramento/afastamento: os eliminatórios envolvidos. */
  criterios?: { id: string; numero: number | null; nome: string }[] | null;
  responsavelId: string;
  /** ISO 8601. */
  ocorridoEm: string;
  /** 'reconstituido' = recuperado da auditoria, sem texto que não existia na época. */
  origem: 'portal' | 'reconstituido';
}

/**
 * Forma de uma monitoria como pode estar gravada por versões anteriores da aplicação.
 *
 * Existe para dar nome à fronteira de migração: `migrateMonitorings` recebe dados que, por
 * definição, ainda NÃO satisfazem `Monitoring` — a nota pode estar na escala 0-10 e o tipo
 * pode ser 'Fluxo' ou 'Fluxo / Processo'. Sem este tipo, a única saída seria silenciar o
 * compilador na função que menos pode errar do sistema.
 */
export interface LegacyMonitoringScore extends Omit<MonitoringScore, 'score'> {
  score: number;
}

export interface LegacyMonitoring extends Omit<Monitoring, 'tipo' | 'scores'> {
  tipo: TipoMonitoria | 'Fluxo' | 'Fluxo / Processo';
  scores?: LegacyMonitoringScore[];
}

// ---------------------------------------------------------------------------
// Alocações, metas e configuração
// ---------------------------------------------------------------------------

export interface Allocation {
  id: string;
  monitorId: string;
  colaboradorId: string;
  startDate: string;
  /** Nulo significa vigência em aberto. */
  endDate: string | null;
  active: boolean;
}

export interface AllocationHistoryEntry {
  id: string;
  allocationId: string;
  actionType: 'INSERT' | 'TERMINATE';
  changedBy: string;
  changedAt: string;
  details: string;
}

export interface Holiday {
  id: string;
  originalMonitorId: string;
  substituteMonitorId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface MonitorGoal {
  id: string;
  monitorId: string;
  year: number;
  month: number;
  targetQty: number;
}

/**
 * Meta de uma colaboradora num período.
 *
 * `canal` ausente significa META GERAL: qualquer canal atende. Presente, a meta vale só para
 * aquele canal, e a colaboradora passa a ter uma linha por canal.
 *
 * O campo é opcional de propósito — todo registro gravado antes da 2A.6 é, por definição, uma
 * meta geral. Nenhuma migração, nenhuma reescrita de dado, DATABASE_VERSION intocado.
 *
 * REGRA: geral e por canal são mutuamente exclusivas para a mesma colaboradora no mesmo
 * período. Ter as duas não tem resposta certa — o canal abateria a geral ou somaria a ela? A
 * exclusividade é defendida no goalService e bloqueada no Planejamento.
 */
export interface ColaboradorGoal extends MonitorGoal {
  colaboradorId: string;
  canal?: Canal;
  /**
   * "Sem meta neste mês" (0.23.0): férias, afastamento ou situação especial. É diferente de
   * não ter meta cadastrada — aqui alguém decidiu, e a decisão fica visível na tela.
   *
   * Não é `targetQty: 0`: zero somaria ao total da carteira e faria `hasGoal` verdadeiro, ou
   * seja, "está de férias" apareceria como "tem meta zero". A régua de `hasGoal` existe desde a
   * 2A.2 justamente para não confundir ausência com zero.
   */
  semMeta?: boolean;
  /** Por que ficou sem meta. Exibido no lugar do escopo. */
  motivo?: string;
}

/**
 * Plano de metas recorrentes (0.23.0).
 *
 * Antes, a meta era cadastrada mês a mês: cinco colaboradoras × doze competências = sessenta
 * cadastros por ano para dizer a mesma coisa. O plano declara o padrão uma vez, com vigência, e
 * a meta de cada competência passa a ser herdada.
 *
 * `ColaboradorGoal` não mudou de forma: passou a ser a **exceção** — o mês em que a operação
 * fugiu do padrão. Por isso não houve migração: o que já estava gravado continua valendo, agora
 * lido como exceção.
 *
 * EDIÇÃO NÃO REESCREVE O PASSADO. Alterar um plano em curso não muda meses já decorridos: o
 * plano corrente é encerrado na competência anterior e um novo nasce da competência atual em
 * diante (ver `sucederPlano`). Sem isso, mudar a meta em dezembro reavaliaria agosto,
 * setembro e outubro contra um alvo que não valia quando o trabalho foi feito.
 */
export interface PlanoMetasLinha {
  monitorId: string;
  colaboradorId: string;
  canal?: Canal;
  targetQty: number;
  /**
   * Competência a partir da qual a linha vale, `'YYYY-MM'`. Ausente = desde o início da
   * vigência. Existe para quem entra na operação no meio do plano: em vez de virar uma exceção
   * repetida todo mês, a pessoa entra no plano com a data em que começou.
   */
  entraEm?: string;
}

export interface PlanoMetas {
  id: string;
  nome: string;
  /** 'YYYY-MM', inclusivo. */
  vigenciaInicio: string;
  /** 'YYYY-MM', inclusivo. */
  vigenciaFim: string;
  linhas: PlanoMetasLinha[];
  criadoPor: string;
  criadoEm: string;
}

export interface BrandConfig {
  id: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
}

export interface SystemSettings {
  requireGestorValidation: boolean;
  /**
   * Quantos meses a monitoria fica atrás do atendimento que ela audita (0.24.0).
   *
   * Nesta operação a monitoria de agosto é realizada em setembro, então o valor é 1 e a
   * agenda de setembro aponta para agosto. `0` significa avaliar o mês corrente.
   *
   * É parâmetro e não constante porque descreve o calendário de uma operação, não uma regra
   * do sistema — e um "menos um mês" escrito no código é o tipo de decisão que ninguém
   * encontra quando ela precisar mudar.
   *
   * Bases anteriores à 0.24.0 não têm o campo; o carregamento preenche com 1, que é o
   * comportamento que a operação já praticava à mão.
   */
  defasagemCompetencia: number;
  /**
   * Competência (AAAA-MM) a partir da qual cada supervisor valida, pelo id do perfil. Pendentes de
   * competência anterior saem da fila e dos contadores dele, sem mudar de situação, e seguem em
   * Relatórios. Supervisor sem entrada vê tudo, como antes.
   */
  validacaoDesdePorGestor?: Record<string, string>;
}

/** Sessão persistida: grava só o par mínimo, o usuário completo é re-resolvido na leitura. */
export interface AuthSession {
  email: string;
  /**
   * Perfil sob o qual a pessoa está trabalhando agora. Fica na sessão, não no usuário: é
   * escolha do momento e de cada navegador. É revalidado no carregamento — um perfil revogado
   * pelo Admin não pode continuar ativo (ver `perfilAtivoValido`).
   */
  perfilAtivo: Role;
}

export interface AuthLogEntry {
  id: string;
  eventType: string;
  userEmail: string;
  userName: string;
  userRole: string;
  actionDetails: string;
  timestamp: string;
  /**
   * Registros anteriores à 0.21.0 trazem `ip`, gerado com `Math.random()` e exibido numa coluna
   * rotulada "IP (Simulado)". Um endereço inventado numa trilha de auditoria é pior que nenhum:
   * dá aparência de rastreabilidade a algo que não rastreia. O campo deixou de ser gravado e
   * de ser exibido; sem backend não há IP real a registrar.
   */
  ip?: string;
}
