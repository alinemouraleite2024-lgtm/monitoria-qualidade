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
 * Papel presente na base de usuários mas sem menu nem permissão de rota. Desde a F0-14 o
 * login é recusado para ele; o valor continua existindo nos dados.
 */
export type NonOperationalRole = 'COLABORADOR';

export type AnyRole = Role | NonOperationalRole;

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type Permission =
  | 'VIEW_DASHBOARD' | 'VIEW_PLANNING' | 'VIEW_CENTRAL_DEMANDS' | 'VIEW_MONITORINGS'
  | 'VIEW_CSAT' | 'VIEW_NPS' | 'VIEW_REPORTS' | 'VIEW_COLLABORATORS'
  | 'VIEW_MY_MONITORINGS' | 'VIEW_OPERATIONAL_CALENDAR' | 'VIEW_MY_PROFILE'
  | 'VIEW_MONITORING_FORM'
  | 'VIEW_USERS' | 'VIEW_ADMINISTRATION' | 'VIEW_ROLES' | 'VIEW_AUDIT_LOGS'
  | 'VIEW_SETTINGS' | 'VIEW_INTEGRATIONS' | 'VIEW_VERSION_HISTORY'
  | 'CREATE_MONITORING' | 'EDIT_MONITORING' | 'DELETE_MONITORING' | 'APPROVE_MONITORING'
  | 'EXPORT_REPORTS' | 'MANAGE_USERS' | 'MANAGE_INTEGRATIONS';

/**
 * Registro de usuário. Dois formatos coexistem no mesmo array (débito 5 da Sprint 0):
 * UserManagement grava o registro completo; UserModal grava apenas o núcleo. Por isso tudo
 * além de id/name/email/role é opcional — é o que o dado realmente garante.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: AnyRole;
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
  gestorId: string;
  monitorId: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Critérios de avaliação
// ---------------------------------------------------------------------------

/**
 * Tipos de resposta de um critério.
 *
 * MULTIPLA_ESCOLHA e SIM_NAO não têm renderização própria no MonitoringForm: caem no
 * fallback da escala padrão. MULTIPLA_ESCOLHA é usado pelos 3 critérios de classificação
 * (peso 0) e SIM_NAO pelos 4 eliminatórios — ambos funcionam, mas pela escala genérica.
 */
export type TipoResposta =
  | 'ESCALA_4' | 'CHECKLIST_SIM_NAO' | 'FAIXA_TEMPO' | 'MULTIPLA_ESCOLHA' | 'SIM_NAO';

export type Canal = 'WhatsApp' | 'Telefone' | 'Teams' | 'Presencial' | 'E-mail' | 'Chat';

export interface SubPergunta {
  id: string;
  texto: string;
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
  minExpectedScore: number;
  active: boolean;
  channels: Canal[];
  subPerguntas?: SubPergunta[];
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
  | 'Aprovada' | 'Aguardando Aprovação';

/** Tipos oficiais. Fluxo e "Fluxo / Processo" são migrados para Processo no carregamento. */
export type TipoMonitoria = 'Regular' | 'Direcionada' | 'Processo' | 'Calibração';

/** Resposta de um critério. score é '' enquanto o checklist estiver incompleto. */
export interface MonitoringScore {
  criterionId: string;
  score: number | 'N/A' | '';
  lowScoreReason: string;
  subRespostas: Record<string, 'SIM' | 'NAO'> | null;
}

export interface Monitoring {
  id: string;
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
  empreendimento?: string;
  categoriaAtendimento?: string;
  protocolo?: string;
  tempo?: string;
  gestorId?: string;
  /** Campos de feedback livre. Os nomes são em inglês no dado, embora os rótulos da UI
   *  sejam "Pontos Fortes" e "Oportunidades" — mantidos como estão. */
  strengths?: string;
  opportunities?: string;
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
}

/** Sessão persistida: grava só o par mínimo, o usuário completo é re-resolvido na leitura. */
export interface AuthSession {
  email: string;
  role: AnyRole;
}

export interface AuthLogEntry {
  id: string;
  eventType: string;
  userEmail: string;
  userName: string;
  userRole: string;
  actionDetails: string;
  timestamp: string;
  ip: string;
}
