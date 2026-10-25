// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { pathToTab, tabToPath, PATH_LOGIN, ADMIN_SECOES, ENTRADA_POR_PERFIL } from './routes/paths';
import { entradaDoPerfil, destinoAposEntrar } from './routes/entrada';
import type { FormEvent, ReactNode } from 'react';
import type {
  Area, Canal, Collaborator, Criterion, Monitoring, PlanoMetas, Role, User,
} from './types/domain';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileSpreadsheet,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  ArrowRight,
  Settings,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  ChevronLeft,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  ChevronRight,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  RefreshCw,
  Layers,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  HelpCircle,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  UserX,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Sparkles,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Info,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Check,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  X,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Trash2,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Eye,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Zap,
  FileText,
  ClipboardCheck,
  UserCog
} from 'lucide-react';
// Os seeds de todas as coleções vivem em src/repositories (F0-12).

import {
  logAuthEvent,
  hasPermission,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  ROLES
} from './auth';

import { USER_STATUS } from './constants/auth';
import { DATABASE_VERSION } from './config';
import { modoCompartilhado } from './shared/compartilhado/modo';
import { transporteSupabase, entrarComSenha, loginRestaurado, sairDoSupabase, estadoDoAcesso, aoRenovarSessao } from './shared/compartilhado/supabase';
import { etapaFinal } from './shared/compartilhado/mfa';
import {
  carregarDados, perfilDoLogin, salvarMonitoria, validarMonitoria, reprovarMonitoria, devolverMonitoria,
  confirmarZeramento, cancelarMonitoria, registrarAcesso, type ResultadoMonitoria, type DadosCompartilhados,
} from './shared/compartilhado/dados';
import { mensagemDoErro, ErroBanco } from './shared/compartilhado/transporte';
import { gravarColecao, type IndiceDocumentos } from './shared/compartilhado/documentos';

// Avaliado uma vez: o modo é definido pelas variáveis do build, não muda com a página aberta.
const COMPARTILHADO = modoCompartilhado();

const initializeDatabase = () => {
  // Modo compartilhado: NUNCA limpa o localStorage do portal antigo — ele é a origem da migração.
  if (modoCompartilhado()) return false;
  const currentVersion = localStorage.getItem('pm2_database_version');
  if (currentVersion !== String(DATABASE_VERSION)) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('pm2_')) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
    localStorage.setItem('pm2_database_version', String(DATABASE_VERSION));
    window.location.reload();
    return true;
  }
  return false;
};

import { MyProfile } from './modules/profile/MyProfile';

import { MonitoringQueueScreen } from './features/monitorings/MonitoringQueueScreen';
import { MonitoringList } from './modules/monitoring/MonitoringList';
import { MonitoringForm } from './modules/monitoring/MonitoringForm';
import { MonitoringHistory } from './modules/monitoring/MonitoringHistory';

import { NotImplementedScreen } from './shared/components/NotImplementedScreen';
import { ReportsScreen } from './features/reports/ReportsScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { MfaScreen } from './features/auth/MfaScreen';
import { PlanningScreen } from './features/planning/PlanningScreen';
import { PlanoMetasEditor } from './features/planning/PlanoMetasEditor';
import { ResumoResultados } from './features/reports/ResumoResultados';
import { notaParaExibir, resumirNotas } from './domain/resultadosService';
import { AllocationsScreen } from './features/allocations/AllocationsScreen';
import { AdminScreen } from './features/admin/AdminScreen';
import { CriterionModal } from './features/admin/modals/CriterionModal';
import { AreaModal } from './features/admin/modals/AreaModal';
import { CollaboratorModal } from './features/admin/modals/CollaboratorModal';
import { AppShell } from './layout/AppShell';
import type { MenuConfig } from './layout/Topbar';
import { NotFoundScreen } from './shared/components/NotFoundScreen';
import { RouteGuard } from './routes/RouteGuard';
import { DashboardScreen } from './features/dashboard/DashboardScreen';

import {
  brandRepository,
  settingsRepository,
  areasRepository,
  collaboratorsRepository,
  usersRepository,
  criteriaRepository,
  allocationsRepository,
  allocationHistoryRepository,
  monitorGoalsRepository,
  colaboradorGoalsRepository,
  planosMetasRepository,
  holidaysRepository,
  demandsRepository,
  announcementsRepository,
  agendaRepository,
  catalogCategoriasRepository,
  monitoringsRepository,
  sessionRepository,
} from './repositories';
import { UserAvatar } from './shared/components/UserAvatar';
import {
  getActiveMonitorForColab as resolveActiveMonitorForColab,
  getCarteira as resolveCarteira,
  getSemVinculo as resolveSemVinculo,
} from './domain/allocationService';
import {
  todayISO,
  getCurrentPeriod,
  naCompetencia,
  periodLabel,
  previousPeriod,
  nextPeriod,
  businessDaysRemainingIn,
  competenciaLabel,
  competenciaDaAgenda,
  periodToCompetencia,
  parseData,
} from './domain/period';
import type { Period } from './domain/period';
import { countsForCarteiraGoal } from './domain/monitoringRules';
import { getPlanoVigente, resolverMetasDoPeriodo, sucederPlano, vigenciaColide } from './domain/planoMetasService';
import {
  aplicaFiltrosDeHistorico,
  FILTROS_VAZIOS,
  type FiltrosHistorico,
} from './domain/historyFilter';
import { canalLabel } from './constants/canais';
import { CHANNELS } from './constants/criteria';
import { exibirDuracao } from './domain/duracao';
import { getCarteiraProgress } from './domain/goalService';
import { perfilAtivoValido, temPerfil } from './domain/perfis';
import { podeValidar, resolverStatusInicial, exigeReenvio, MOTIVO_REENVIO_MIGRADA } from './domain/validacaoService';

// 2A.1: a data corrente deixou de ser simulada.
//
// Aqui existia `const SYSTEM_TODAY = '2026-06-05'`, e era dela que saíam dias úteis
// restantes, ritmo necessário, vigência de carteira e as datas gravadas ao criar ou
// encerrar um vínculo. Com o sistema em operação desde agosto, todo número operacional
// respondia sobre junho — e as telas não diziam isso.
//
// Quem precisa de "hoje" agora chama `todayISO()`; quem precisa do mês de competência
// chama `getCurrentPeriod()`. Ver src/domain/period.ts.



// Configuração Dinâmica de Menu por Perfil (Sprint 1)
// Navegação da plataforma de qualidade.
//
// Decisão de produto: Monitorias, CSAT e NPS são os pilares e ficam no primeiro nível. O item
// genérico "Pesquisas" deixou de existir — CSAT e NPS não são duas variações de pesquisa: o
// CSAT é indicador e o NPS é processo operacional, com fila de casos e tratativa própria.
//
// Os três menus são encaixados um no outro (MONITOR ⊂ GESTOR ⊂ ADMIN): nenhum papel vê um
// item que o papel acima não veja, o que evita a pergunta "por que eu não enxergo isso?".
//
// Dashboard Executivo e Planejamento permanecem em GESTOR e ADMIN por decisão operacional:
// a operação assistida vai até 28/08 e a Gestora depende dos dois para acompanhar. A revisão
// desses dois itens acontece depois dessa data.
/**
 * Menu por perfil, agrupado por natureza do trabalho (0.19.0).
 *
 * Até a 0.18.0 eram três listas planas quase idênticas — ADMIN com 10 itens, GESTOR com 9,
 * diferindo só por "Administração", embora os papéis sejam opostos. E um terço do menu do
 * MONITOR levava a placeholders.
 *
 * Agora: **Operação** é o que se faz hoje, **Gestão** é o que se ajusta no mês, **Configuração**
 * é o que se mexe raramente. Cada perfil vê os grupos que lhe cabem.
 *
 * `/monitorings` é a mesma rota para os três, com rótulo diferente: a tela já se bifurca por
 * papel, e o rótulo passa a dizer que pergunta ela responde para cada um.
 */
const MENU_CONFIG: MenuConfig = {
  // 0.20.0 — o menu acompanha a matriz de permissões, e não o contrário. Um item que a
  // permissão nega vira um caminho para "acesso negado", que é pior que a ausência do item.
  //
  // O ADMIN perdeu Monitorias, Metas e Equipe e Carteiras: no contexto de administração não se
  // monitora, não se valida e não se gerencia equipe. Quem faz as duas coisas troca de perfil.
  // Ficaram Relatórios e Painel — governança precisa de leitura, e é de dentro de Relatórios
  // que sai o cancelamento de monitoria, permissão exclusiva do ADMIN.
  ADMIN: [
    { id: 'admin-criterios', label: 'Critérios de Avaliação', icon: ClipboardCheck, grupo: 'Configuração' },
    { id: 'admin-acessos', label: 'Usuários e Acessos', icon: UserCog },
    { id: 'admin-sistema', label: 'Sistema', icon: Settings },
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard, grupo: 'Governança' },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck },
  ],
  GESTOR: [
    { id: 'monitorings', label: 'Validação', icon: FileSpreadsheet, grupo: 'Operação' },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'dashboard', label: 'Painel da Equipe', icon: LayoutDashboard, grupo: 'Gestão' },
    { id: 'allocations', label: 'Equipe e Carteiras', icon: Users },
    { id: 'planning', label: 'Metas', icon: Layers },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck },
  ],
  MONITOR: [
    { id: 'monitorings', label: 'Monitorias', icon: FileSpreadsheet, grupo: 'Operação' },
    { id: 'reports', label: 'Meu Histórico', icon: FileText },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck },
  ],
};

// Texto do placeholder de cada módulo ainda não construído. Sem isto, CSAT e NPS abririam com
// o mesmo aviso genérico de "módulo não implementado" e não sustentariam a decisão de produto
// que os colocou no primeiro nível — placeholder mudo convida à pergunta "por que isso existe?".
const PLACEHOLDER_DESCRIPTIONS: Record<string, string> = {
  csat: 'Aqui ficará o acompanhamento da satisfação do cliente com cada atendimento: nota por período, evolução ao longo do tempo e leitura por equipe e por colaborador. O módulo entra depois que a base de monitorias com protocolo estiver formada.',
  nps: 'O NPS não é apenas um indicador: é um processo operacional. Este módulo receberá a fila de respostas de clientes e conduzirá cada caso do início ao fim — análise do histórico e das monitorias, nova monitoria quando necessário, contato com o cliente, registro da tratativa e acompanhamento até a conclusão.',
};

// Telas cujo módulo ainda não existe.
//
// Sobraram só 'csat' e 'nps': saíram do menu na 0.19.0 mas mantiveram rota, porque a decisão
// foi tirá-las do caminho diário — não descontinuá-las. As demais entradas caíram junto com
// suas rotas; um tab sem rota nunca chega aqui, e listá-lo só sugeria uma tela que não existe.
const UNIMPLEMENTED_TABS = ['csat', 'nps'];

// Envelope de rota. A decisão de acesso é do RouteGuard (F0-14); aqui resta apenas a
// precedência remanescente do dispatcher: autorizado -> "não implementado" -> tela.
const Screen = ({ tab, perfil, children }: { tab: string; perfil: Role | null; children?: ReactNode }) => (
  <RouteGuard tab={tab} perfil={perfil}>
    {UNIMPLEMENTED_TABS.includes(tab)
      ? <NotImplementedScreen
          title={perfil ? MENU_CONFIG[perfil]?.find((m) => m.id === tab)?.label : undefined}
          description={PLACEHOLDER_DESCRIPTIONS[tab]}
        />
      : (children ?? null)}
  </RouteGuard>
);

// Corpo da aplicação. Só é montado depois que a checagem de migração conclui —
// por isso pode declarar seus hooks sem nenhum retorno antecipado antes deles.
function AppContent() {

  // Brand Configuration & System settings
  const [brand, setBrand] = useState(() => brandRepository.load());
  const [settings, setSettings] = useState(() => settingsRepository.load());

  // State Management representing local database V2
  const [areas, setAreas] = useState(() => areasRepository.load());
  const [collaborators, setCollaborators] = useState(() => collaboratorsRepository.load());
  const [users, setUsers] = useState(() => usersRepository.load());
  const [criteria, setCriteria] = useState(() => criteriaRepository.load());
  const [allocations, setAllocations] = useState(() => allocationsRepository.load());
  const [allocationHistory, setAllocationHistory] = useState(() => allocationHistoryRepository.load());
  // Metas globais de monitor: nada mais as lê nem as grava desde a 2A.4. O estado permanece
  // apenas para que a persistência não apague os registros históricos de pm2_mgoals.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [monitorGoals, setMonitorGoals] = useState(() => monitorGoalsRepository.load());
  const [colaboradorGoals, setColaboradorGoals] = useState(() => colaboradorGoalsRepository.load());
  const [planosMetas, setPlanosMetas] = useState(() => planosMetasRepository.load());
  // Só no compartilhado: versão de cada meta/plano carregado, para gravar com controle de concorrência.
  const indiceDocumentos = useRef<IndiceDocumentos>({});
  // As migrações de dados legados (escala 0-10 -> 0-100 e Fluxo -> Processo) foram
  // transferidas para monitoringsRepository na F0-12, sem alteração de regra.
  const [monitorings, setMonitorings] = useState(() => monitoringsRepository.load());
  const [holidays, setHolidays] = useState(() => holidaysRepository.load());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [demands, setDemands] = useState(() => demandsRepository.load());

  // O catálogo de empreendimentos deixou de ser carregado na 0.14.0, quando o campo saiu da
  // tela de Nova Monitoria. O repositório e a chave continuam existindo, dormentes: o valor
  // gravado em monitorias anteriores permanece legível, e reativar o campo seria uma linha.

  const [catalogCategorias, setCatalogCategorias] = useState(
    () => catalogCategoriasRepository.load()
  );

  const handleAddCategoria = (nova: string) => {
    if (recusarNoCompartilhado()) return;
    const next = [...catalogCategorias, nova];
    setCatalogCategorias(next);
    catalogCategoriasRepository.save(next);
  };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [announcements, setAnnouncements] = useState(() => announcementsRepository.load());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [agenda, setAgenda] = useState(() => agendaRepository.load());


  // Sessão restaurada: quem está logado e sob qual perfil. Os dois vêm juntos do repositório
  // porque um sem o outro não descreve uma sessão — um usuário sem perfil ativo não sabe o
  // que pode fazer, e um perfil ativo sem dono não pertence a ninguém.
  const [currentUser, setCurrentUser] = useState<User | null>(() => sessionRepository.load().user);
  const [perfilAtivo, setPerfilAtivo] = useState<Role | null>(() => sessionRepository.load().perfilAtivo);

  // Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  // Intenção de retorno pós-login. Desligada no logout: sair de uma tela não deve fazer o
  // próximo login — possivelmente de outra pessoa — cair nela.
  const [captureIntent, setCaptureIntent] = useState(true);
  const [showDevTools, setShowDevTools] = useState(false);
  // Modo compartilhado: enquanto a sessão do Supabase é restaurada, não há login nem tela.
  const [carregandoBanco, setCarregandoBanco] = useState(COMPARTILHADO);
  // P2: sessão que precisa do segundo fator antes de abrir o portal (contas com MFA — o ADMIN).
  const [etapaMfa, setEtapaMfa] = useState<'cadastrar_mfa' | 'verificar_mfa' | null>(null);

  // F0-13: a URL é a fonte da verdade da navegação. `activeTab` deixou de ser estado e passou
  // a ser derivado do path — continua alimentando o destaque do menu (igualdade exata) e o
  // breadcrumb, com os mesmos valores de antes.
  const location = useLocation();
  const navigate = useNavigate();
  const { tab: routeTab, monitoringId: routeMonitoringId } = pathToTab(location.pathname);
  const activeTab = routeTab || '';
  // O destino vem de tabToPath, não de uma concatenação: desde a 0.19.0 o id da aba e o
  // segmento da URL deixaram de ser sempre iguais — as três seções da Administração vivem sob
  // /admin/:secao. Montar `/${tab}` à mão levava 'admin-criterios' para /admin-criterios, que
  // não é rota — o menu caía em "página não encontrada".
  const navigateToTab = (tab: string) => navigate(tabToPath(tab));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardAreaId, setDashboardAreaId] = useState('ALL');

  // Modals & Dynamic Wizards
  // Resolvido a partir de /monitorings/:id/edit. Sem estado próprio: recarregar a página na
  // tela de edição passa a reabrir a mesma monitoria, em vez de perder o formulário.
  const editingMonitoring = routeMonitoringId
    ? monitorings.find(m => m.id === routeMonitoringId) || null
    : null;
 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMonitoringDetail, setSelectedMonitoringDetail] = useState<Monitoring | null>(null);

  // Administration view sub-tabs
  const [adminSubTab, setAdminSubTab] = useState('criteria');

  // A seção da Administração passa a vir da URL (0.19.0). Antes era só estado: o endereço não
  // dizia onde você estava, e voltar ao menu recomeçava sempre na mesma aba. `ADMIN_SECOES`
  // traduz o item de menu para a aba interna; o usuário segue livre para trocar de aba dentro
  // da tela, e por isso isto é sincronização de entrada, não amarração.
  useEffect(() => {
    const secao = ADMIN_SECOES[activeTab];
    if (secao) setAdminSubTab(secao);
  }, [activeTab]);

  // Form States (Admin & Management)
  // Sem id fixo: um usuário semeado em código vira referência quebrada assim que a pessoa sai.
  // Vazio significa "nenhum selecionado", e a tela resolve isso pedindo a seleção.
  const [selectedAllocationMonitor, setSelectedAllocationMonitor] = useState('');
  const [newAllocColaboradorId, setNewAllocColaboradorId] = useState('');
  const [newAllocStartDate, setNewAllocStartDate] = useState(todayISO());
  const [newAllocEndDate, setNewAllocEndDate] = useState('');

 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHoliday, setNewHoliday] = useState({
    originalMonitorId: '',
    substituteMonitorId: '',
    startDate: todayISO(),
    endDate: ''
  });

  /** Rascunho do modal de critério: campos ainda como texto até o submit. */
  interface CriterionDraft {
    id: string;
    numero: string | number;
    category: string;
    name: string;
    description: string;
    orientacao: string;
    tipoResposta: Criterion['tipoResposta'];
    eliminatorio: boolean;
    weight: number | string;
    channels: Criterion['channels'];
    active: boolean;
  }

  const [newCriterion, setNewCriterion] = useState<CriterionDraft>({
    id: '',
    numero: '',
    category: '',
    name: '',
    description: '',
    orientacao: '',
    tipoResposta: 'ESCALA_4',
    eliminatorio: false,
    weight: 1.0,
    channels: ['Chat', 'WhatsApp'],
    active: true
  });

  const [newArea, setNewArea] = useState<Area>({ id: '', name: '', gestorId: '', monitorIds: [], active: true });
  const [newCollaborator, setNewCollaborator] = useState<Collaborator>({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });


  // `canal` vazio significa meta geral — o escopo padrão do formulário.
  // Contexto que a fila passa ao formulário: abrir já sabendo quem monitorar e de que canal.
  const [seedNovaMonitoria, setSeedNovaMonitoria] = useState<{ colaboradorId: string; canal: string }>({ colaboradorId: '', canal: '' });

  const [newCGoalVal, setNewCGoalVal] = useState({ monitorId: '', colaboradorId: '', canal: '', targetQty: 5 });

  // Filtros de Relatórios.
  //
  // 2A.5: o período estava fixo em 01/06/2026–30/06/2026 e o setter estava COMENTADO — não
  // havia como alterá-lo por nenhum caminho da interface. Efeito prático: os dois botões de
  // exportar devolviam apenas junho, sempre, e em agosto devolviam um arquivo vazio, sem
  // mensagem nenhuma. Era a mais silenciosa das cinco travas da Fatia 2A.
  //
  // O período agora é um Period de verdade, navegável, e a faixa de datas é derivada dele —
  // não há mais como a data exibida divergir da data consultada.
  // Cada tela tem o seu período. A fila de Monitorias fica de fora de propósito: ela responde
  // "o que eu preciso fazer agora", e navegar por competências ali transformaria a tela de
  // trabalho em tela de consulta — que é o papel de Relatórios.
  const [reportPeriod, setReportPeriod] = useState(() => getCurrentPeriod());
  const [planningPeriod, setPlanningPeriod] = useState(() => getCurrentPeriod());
  const [dashboardPeriod, setDashboardPeriod] = useState(() => getCurrentPeriod());
  /**
   * Competência da agenda (0.24.0). `null` significa "a padrão", e não "nenhuma".
   *
   * Guardar a escolha só depois que ela é feita mantém a tela colada ao parâmetro: mudar a
   * defasagem em Administração move a agenda na hora. Com um valor calculado na montagem, o
   * parâmetro só passaria a valer no próximo carregamento — e quem acabou de mudá-lo
   * concluiria que não funcionou.
   */
  const [monitoringsPeriod, setMonitoringsPeriod] = useState<Period | null>(null);
  const [showPlanoEditor, setShowPlanoEditor] = useState(false);
  // 2B.5: os filtros do histórico deixaram de ser estado interno da tabela e subiram para cá.
  // Enquanto viviam lá dentro, a exportação usava outro caminho e levava um conjunto diferente
  // do exibido — a tela mostrava 2 linhas e o botão exportava 4. Agora há um conjunto só.
  //
  // Saíram areaId, colaboradorId e scoreFilter: estavam na estrutura antiga, nunca tiveram
  // controle na tela e nunca foram usados por ninguém.
  const [historicoFiltros, setHistoricoFiltros] = useState<FiltrosHistorico>(FILTROS_VAZIOS);

  // Persistência granular por coleção (F0-12).
  // Antes, um único efeito reescrevia 15 chaves a cada mudança de qualquer uma delas.
  useEffect(() => { brandRepository.save(brand); }, [brand]);
  useEffect(() => { settingsRepository.save(settings); }, [settings]);
  useEffect(() => { areasRepository.save(areas); }, [areas]);
  useEffect(() => { collaboratorsRepository.save(collaborators); }, [collaborators]);
  useEffect(() => { criteriaRepository.save(criteria); }, [criteria]);
  useEffect(() => { allocationsRepository.save(allocations); }, [allocations]);
  useEffect(() => { allocationHistoryRepository.save(allocationHistory); }, [allocationHistory]);
  useEffect(() => { monitorGoalsRepository.save(monitorGoals); }, [monitorGoals]);
  useEffect(() => { colaboradorGoalsRepository.save(colaboradorGoals); }, [colaboradorGoals]);
  useEffect(() => { planosMetasRepository.save(planosMetas); }, [planosMetas]);
  useEffect(() => { holidaysRepository.save(holidays); }, [holidays]);
  useEffect(() => { demandsRepository.save(demands); }, [demands]);
  useEffect(() => { announcementsRepository.save(announcements); }, [announcements]);
  useEffect(() => { agendaRepository.save(agenda); }, [agenda]);

  // Etapa 4: monitorings passou a gravar pelo repositório. O efeito fica separado do bloco
  // acima para deixar explícito que a leitura correspondente (monitoringsRepository.load)
  // aplica as migrações de dados legados — ver migrateMonitorings em repositories/index.js.
  useEffect(() => { monitoringsRepository.save(monitorings); }, [monitorings]);

  // Etapa 5: users deixou de ter dois donos. UserManagement.jsx gravava esta mesma chave por
  // fora, via teamData.js, à revelia deste estado — o efeito abaixo podia sobrescrever a
  // alteração feita lá. Agora o App.jsx é a única fonte de verdade e o módulo escreve por prop.
  //
  // Resolvido na 0.20.0: handleLogin e sessionRepository passaram a resolver contra este
  // repositório, e não mais contra o array estático. Enquanto isso não valia, todo usuário
  // criado pela Administração era gravado mas nunca conseguia entrar.
  useEffect(() => { usersRepository.save(users); }, [users]);

  // Inject variables to style root element
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', brand.primaryColor);
    root.style.setProperty('--primary-hover', brand.primaryColor + 'ee');
    root.style.setProperty('--secondary', brand.secondaryColor);
    root.style.setProperty('--bg-app', brand.backgroundColor || '#f4f7f6');
  }, [brand]);

  // Helper utility functions
  /**
   * Quem realiza monitorias — recebe carteira, meta e fila.
   *
   * 0.17.0: o GESTOR saiu desta lista. Ele valida e acompanha; não avalia. Estava aqui porque a
   * mesma pessoa ocupava os dois papéis, e a lista imitava a pessoa em vez do papel.
   *
   * 0.20.0: o ADMIN também saiu — e ninguém perdeu a carteira. Ele estava aqui para acomodar
   * quem administra e monitora, o que fazia *todo* administrador contar como monitor. Com
   * perfis acumuláveis a pergunta virou direta: tem o perfil MONITOR? Quatro trechos do sistema
   * respondiam isso de quatro maneiras diferentes, e duas delas devolviam lista vazia.
   */
  const getMonitors = () => users.filter(u => temPerfil(u, 'MONITOR'));
  const getCollaborators = () => collaborators;

  // Resolve o monitor responsável por um colaborador na data, delegando a regra de
  // vigência/substituição ao serviço de domínio (F0-12).
  // Período de competência corrente. Todo número mensal desta tela responde sobre ele.
  const hoje = todayISO();
  const periodoAtual = getCurrentPeriod();

  /**
   * Metas efetivas de uma competência: o que o plano vigente prevê, com as exceções do mês por
   * cima. Ver `domain/planoMetasService`.
   *
   * Resolvido aqui, e três vezes, porque desde a 0.22.0 cada tela responde sobre um período
   * diferente — a fila sobre o mês corrente, o Painel e Metas sobre o que o gestor escolheu.
   * Resolver uma vez só devolveria a competência errada para duas das três.
   *
   * O resultado tem exatamente a forma que `goalService` já consumia, e é por isso que Painel,
   * Relatórios, fila e o goalService inteiro não precisaram de uma linha de alteração: nenhum
   * deles sabe que herança existe.
   */
  const metasDe = React.useCallback(
    (periodo: Period) => resolverMetasDoPeriodo(planosMetas, colaboradorGoals, periodo),
    [planosMetas, colaboradorGoals],
  );

  const competenciaDaFila = React.useMemo(
    () => monitoringsPeriod ?? competenciaDaAgenda(periodoAtual, settings.defasagemCompetencia),
    [monitoringsPeriod, periodoAtual, settings.defasagemCompetencia],
  );
  const metasDaFila = React.useMemo(() => metasDe(competenciaDaFila).metas, [metasDe, competenciaDaFila]);
  const metasDoPainel = React.useMemo(() => metasDe(dashboardPeriod).metas, [metasDe, dashboardPeriod]);
  const metasDoPlanejamento = React.useMemo(() => metasDe(planningPeriod), [metasDe, planningPeriod]);

  const getActiveMonitorForColab = (colaboradorId: string, dateStr: string = hoje) =>
    resolveActiveMonitorForColab({ allocations, holidays, users }, colaboradorId, dateStr);

  /** Colaboradoras pelas quais um monitor responde na data. */
  const getCarteiraDe = (monitorId: string, dateStr: string = hoje) =>
    resolveCarteira({ allocations, holidays, users }, collaborators, monitorId, dateStr);

  /**
   * Colaboradoras sem vínculo vigente: não são de ninguém e não entram em meta alguma.
   * Sem consumidor até a fila operacional (2B), onde vira um aviso próprio — o caso existe
   * hoje na base (a Aline é colaboradora e não tem monitora vinculada).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getSemVinculo = (dateStr: string = hoje) =>
    resolveSemVinculo({ allocations, holidays, users }, collaborators, dateStr);

  // Os dias úteis restantes deixaram de ser um valor único no App (0.22.1): cada tela calcula
  // os seus, a partir da competência que está exibindo. Enquanto era um só, fixo no mês
  // corrente, o Painel navegado para agosto media o ritmo de setembro.

  // Autenticação.
  //
  // 0.20.0 encerrou a divergência que a F0-14 registrou: login e repositório eram duas bases
  // diferentes, e por isso o bloqueio precisava ser lido à parte — ele é gravado em pm2_users
  // e nunca chegava ao array estático. Com uma fonte só, `status` vem do mesmo registro que
  // autenticou, e quem é cadastrado pela Administração passa a existir para o login.
  // ---- Modo compartilhado (banco Supabase) -----------------------------------------------
  //
  // Os dados vêm do banco, filtrados pela RLS do usuário logado, e toda gravação de monitoria
  // passa pelas operações do schema `api` (08) — que decidem quem pode, em que situação, com qual
  // régua e com qual nota. O portal não tem atalho: se o banco recusa, a tela mostra o motivo.
  const padroesDoCodigo = () => ({ settings: settingsRepository.load(), brand: brandRepository.load() });

  const aplicarDadosDoBanco = (d: DadosCompartilhados) => {
    setUsers(d.usuarios);
    setCollaborators(d.colaboradores);
    setAreas(d.areas);
    setAllocations(d.alocacoes);
    setCriteria(d.criterios);
    setMonitorings(d.monitorias);
    setCatalogCategorias(d.categorias);
    setColaboradorGoals(d.metasColaborador as typeof colaboradorGoals);
    setPlanosMetas(d.planosMetas);
    indiceDocumentos.current = d.indiceDocumentos;
    setHolidays(d.feriados as typeof holidays);
    setSettings(d.settings);
    setBrand(d.brand);
  };

  const recarregarDoBanco = async (): Promise<DadosCompartilhados> => {
    const d = await carregarDados(transporteSupabase(), padroesDoCodigo());
    aplicarDadosDoBanco(d);
    return d;
  };

  /** Esvazia a tela e pede o segundo fator. Os dados já não viriam: a RLS barra o ADMIN sem aal2. */
  const bloquearAteMfa = (etapa: 'cadastrar_mfa' | 'verificar_mfa') => {
    setMonitorings([]);
    setUsers([]);
    setCollaborators([]);
    setAreas([]);
    setCriteria([]);
    setAllocations([]);
    setCurrentUser(null);
    setPerfilAtivo(null);
    setEtapaMfa(etapa);
  };

  const abrirSessaoCompartilhada = async (login: { authUserId: string; nivel: string | null }) => {
    // P2: antes de carregar qualquer dado, o banco diz se esta sessão precisa do segundo fator
    // (api.estado_do_meu_acesso, 12). Sem o script 12 aplicado, segue o fluxo anterior — e o
    // banco continua barrando o ADMIN sem aal2. MONITOR e GESTOR sem fator: 'liberado'.
    const estado = await estadoDoAcesso(transporteSupabase());
    const etapa = estado ? etapaFinal(estado) : null;
    if (etapa === 'cadastrar_mfa' || etapa === 'verificar_mfa') {
      bloquearAteMfa(etapa);
      return;
    }
    setEtapaMfa(null);
    const d = await recarregarDoBanco();
    const user = perfilDoLogin(d, login.authUserId);
    // Sem perfil liberado a RLS não devolve nada — inclusive conta ADMIN sem MFA (07, R4).
    const perfilInicial = user ? perfilAtivoValido(user, null) : null;
    if (!user || !perfilInicial) {
      aplicarDadosDoBanco({ ...d, usuarios: [], colaboradores: [], areas: [], alocacoes: [], criterios: [], monitorias: [], categorias: [], metasColaborador: [], planosMetas: [], feriados: [] });
      await sairDoSupabase();
      throw new ErroBanco('SEM_PERFIL', 'Seu login ainda não está liberado no MonitorIA. Procure a administração do sistema.');
    }
    setCurrentUser(user);
    setPerfilAtivo(perfilInicial);
    setCaptureIntent(true);
    void registrarAcesso(transporteSupabase(), 'LOGIN', user, perfilInicial);
  };

  const entrarCompartilhado = async () => {
    try {
      await abrirSessaoCompartilhada(await entrarComSenha(loginEmail, loginPassword));
    } catch (e) {
      setLoginError(mensagemDoErro(e));
    }
  };

  // P2: a cada renovação do token, confere de novo o estado do acesso. O token renovado mantém o
  // nível (aal) da sessão; se por qualquer motivo a sessão deixar de ter o segundo fator exigido,
  // a tela é esvaziada e o código é pedido. Para quem não usa MFA a resposta é sempre 'liberado'.
  useEffect(() => {
    if (!COMPARTILHADO) return;
    return aoRenovarSessao(async () => {
      try {
        const estado = await estadoDoAcesso(transporteSupabase());
        const etapa = estado ? etapaFinal(estado) : null;
        if (etapa === 'cadastrar_mfa' || etapa === 'verificar_mfa') bloquearAteMfa(etapa);
      } catch {
        // falha de rede na conferência não derruba a sessão; a próxima chamada ao banco decide
      }
    });
  }, []); // uma assinatura só, na montagem

  // Restaura a sessão do Supabase ao abrir o portal.
  useEffect(() => {
    if (!COMPARTILHADO) return;
    let vivo = true;
    (async () => {
      try {
        const login = await loginRestaurado();
        if (login && vivo) await abrirSessaoCompartilhada(login);
      } catch (e) {
        if (vivo) setLoginError(mensagemDoErro(e));
      } finally {
        if (vivo) setCarregandoBanco(false);
      }
    })();
    return () => { vivo = false; };
  }, []); // a restauração roda uma vez, na montagem

  /** Cadastros ainda não gravam no banco: no modo compartilhado a alteração é recusada. */
  const recusarNoCompartilhado = (): boolean => {
    if (!COMPARTILHADO) return false;
    alert('No ambiente compartilhado, esta alteração ainda não está disponível pelo portal.\n\nNada foi alterado.');
    return true;
  };

  /**
   * Metas e planos (desde 25/10/2026 também no compartilhado). No modo local a lista nova vira o
   * estado e o repositório grava, como sempre. No compartilhado vai ao banco só a diferença
   * (documentos.ts) e a tela recarrega do banco — o que aparece é o que ficou gravado.
   * `true` = gravado; `false` = recusado, com o motivo já exibido.
   */
  const persistirColecao = async <T extends { id: string }>(
    colecao: 'metas_colaborador' | 'planos_metas', antes: T[], depois: T[], aplicarLocal: (v: T[]) => void,
  ): Promise<boolean> => {
    if (!COMPARTILHADO) { aplicarLocal(depois); return true; }
    try {
      await gravarColecao(transporteSupabase(), colecao, indiceDocumentos.current, antes, depois);
      await recarregarDoBanco();
      return true;
    } catch (e) {
      alert(`${mensagemDoErro(e)}\n\nNada além do informado foi alterado.`);
      await recarregarDoBanco().catch(() => undefined);
      return false;
    }
  };
  const persistirMetas = (novas: typeof colaboradorGoals) =>
    persistirColecao('metas_colaborador', colaboradorGoals, novas, setColaboradorGoals);
  const persistirPlanos = (novos: PlanoMetas[]) =>
    persistirColecao('planos_metas', planosMetas, novos, setPlanosMetas);

  const salvarNoBanco = async (m: Monitoring): Promise<ResultadoMonitoria | null> => {
    const jaNoBanco = monitorings.some((x) => x.id === m.id);
    try {
      const r = await salvarMonitoria(transporteSupabase(), m, criteria, jaNoBanco, m.status !== 'Rascunho');
      await recarregarDoBanco();
      navigate('/monitorings');
      return r;
    } catch (e) {
      alert(mensagemDoErro(e));
      if (e instanceof ErroBanco && e.codigo === 'MI409') await recarregarDoBanco().catch(() => undefined);
      return null;
    }
  };

  const acaoNoBanco = async (monId: string, executar: (m: Monitoring) => Promise<unknown>) => {
    const alvo = monitorings.find((m) => m.id === monId);
    if (!alvo) return;
    try {
      await executar(alvo);
    } catch (e) {
      alert(mensagemDoErro(e));
    }
    try {
      const d = await recarregarDoBanco();
      setSelectedMonitoringDetail((prev) => (prev && prev.id === monId ? (d.monitorias.find((x) => x.id === monId) ?? null) : prev));
    } catch (e) {
      alert(mensagemDoErro(e));
    }
  };

  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    if (COMPARTILHADO) {
      void entrarCompartilhado();
      return;
    }
    // 0.20.0 — a autenticação passou a olhar o repositório, e não mais o array estático do
    // código. Enquanto a busca era feita em HOMOLOG_USERS, um gestor ou monitor cadastrado
    // pela Administração era gravado mas nunca conseguia entrar: o login não sabia que ele
    // existia. HOMOLOG_USERS continua no projeto, agora só como seed do repositório.
    const user = usersRepository.load().find(
      u => u.email.toLowerCase() === loginEmail.toLowerCase() && u.password === loginPassword
    );

    if (!user) {
      setLoginError('E-mail ou senha inválidos.');
      return;
    }

    // Sem perfil não há acesso: é o registro explícito do que antes se deduzia da ausência de
    // menu para 'COLABORADOR'. Mensagem genérica, por decisão registrada.
    const perfilInicial = perfilAtivoValido(user, null);
    if (!perfilInicial) {
      logAuthEvent('LOGIN_DENIED', user, 'Usuário sem perfil de acesso');
      setLoginError('E-mail ou senha inválidos.');
      return;
    }

    const statusAtual = user.status;
    if (statusAtual === USER_STATUS.BLOCKED) {
      logAuthEvent('LOGIN_DENIED', user, 'Usuário bloqueado');
      setLoginError('Usuário bloqueado. Procure o administrador do sistema.');
      return;
    }
    // 0.17.0: até aqui só BLOCKED barrava o acesso, e "Inativo" era um rótulo sem efeito —
    // desligar alguém pelo Admin não impedia essa pessoa de continuar entrando.
    if (statusAtual === USER_STATUS.INACTIVE) {
      logAuthEvent('LOGIN_DENIED', user, 'Usuário inativo');
      setLoginError('Usuário inativo. Procure o administrador do sistema.');
      return;
    }

    setCurrentUser(user);
    setPerfilAtivo(perfilInicial);
    setCaptureIntent(true);
    sessionRepository.save(user, perfilInicial);
    logAuthEvent('LOGIN', user, '', perfilInicial);
    // Não navega aqui: o destino é resolvido pela rota /login da árvore autenticada, que lê
    // location.state.from. Navegar daqui competia com aquele redirecionamento e perdia.
  };

  /**
   * Troca do perfil ativo, para quem tem mais de um.
   *
   * Navega para a entrada do novo perfil em vez de permanecer na rota atual: sair do contexto
   * ADMIN estando em /admin/criterios deixaria a pessoa numa tela que o novo perfil não pode
   * abrir — a troca terminaria em "acesso negado", que é o oposto do que ela pediu.
   *
   * O evento vai para o log porque, com perfis acumulados, saber *quem* agiu deixou de bastar
   * para reconstruir o que aconteceu.
   */
  const handleTrocarPerfil = (novo: Role) => {
    if (!currentUser || !temPerfil(currentUser, novo) || novo === perfilAtivo) return;
    setPerfilAtivo(novo);
    sessionRepository.save(currentUser, novo);
    logAuthEvent('SWITCH_PROFILE', currentUser, `${perfilAtivo} -> ${novo}`, novo);
    navigate(ENTRADA_POR_PERFIL[novo], { replace: true });
  };

  const handleLogout = () => {
    if (COMPARTILHADO) {
      // Registra a saída enquanto a sessão ainda vale, depois encerra o login do Supabase.
      const quem = currentUser, perfil = perfilAtivo;
      void (quem ? registrarAcesso(transporteSupabase(), 'LOGOUT', quem, perfil) : Promise.resolve())
        .finally(() => { void sairDoSupabase(); });
      setMonitorings([]);
      setUsers([]);
      setCollaborators([]);
      setAreas([]);
      setCriteria([]);
      setAllocations([]);
    }
    if (currentUser) {
      logAuthEvent('LOGOUT', currentUser, '', perfilAtivo);
    }
    setCurrentUser(null);
    setPerfilAtivo(null);
    setCaptureIntent(false);
    sessionRepository.clear();
    setLoginEmail('');
    setLoginPassword('');
    setLoginError('');
    navigate(PATH_LOGIN, { replace: true });
  };

  // Persiste a monitoria montada pelo MonitoringForm.
  // Contrato: recebe UM objeto já completo (id, finalScore, scores[], status, flags de
  // eliminatório). O cálculo da nota é responsabilidade exclusiva do MonitoringForm —
  // aqui não se recalcula nem se remonta o array de scores, sob pena de descartar campos
  // que o formulário produz (ex.: subRespostas dos critérios de checklist).
  // Responsabilidades desta função: resolver o monitor responsável pela alocação vigente,
  // aplicar a regra de validação por gestor, persistir e navegar.
  const handleSaveFormMonitoring = (monitoringData: Monitoring) => {
    // Modo compartilhado: o banco decide monitor (quem está logado, D3), situação, régua e nota.
    if (COMPARTILHADO) return salvarNoBanco(monitoringData);
    const isEdit = Boolean(monitoringData.id && monitorings.some(m => m.id === monitoringData.id));
    const { monitor } = getActiveMonitorForColab(monitoringData.colaboradorId, monitoringData.date);

    // O dono da monitoria é resolvido antes do status porque o status depende dele: quem
    // valida é o gestor da área daquele monitor.
    const monitorId = isEdit ? monitoringData.monitorId : (monitor ? monitor.id : currentUser!.id);

    // 0.20.0 — a decisão deixou de olhar o papel de quem salva. Antes, a mesma monitoria
    // nascia 'Validada' ou 'Pendente' conforme o perfil de quem clicasse em salvar, o que
    // fazia a exigência de validação depender de quem estava logado em vez do fluxo desenhado.
    const resolvedStatus = monitoringData.status === 'Concluída'
      ? resolverStatusInicial({ isDraft: false, monitorId, areas, settings })
      : monitoringData.status;

    const monitoringObj = {
      ...monitoringData,
      monitorId,
      status: resolvedStatus
    };

    if (isEdit) {
      setMonitorings(monitorings.map(m => m.id === monitoringObj.id ? monitoringObj : m));
    } else {
      setMonitorings([monitoringObj, ...monitorings]);
    }

    navigate('/monitorings');
  };

  // Handle allocations adjustments (Vigência V2)
  const handleCreateAllocation = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (recusarNoCompartilhado()) return;
    if (!newAllocColaboradorId) {
      alert('Selecione um colaborador.');
      return;
    }

    const existingIndex = allocations.findIndex(
      a => a.colaboradorId === newAllocColaboradorId && a.active && (!a.endDate || new Date(hoje) <= new Date(a.endDate))
    );

    const updatedAllocations = [...allocations];
    const resolvedHistory = [...allocationHistory];

    if (existingIndex > -1) {
      const oldAlloc = updatedAllocations[existingIndex];
      oldAlloc.endDate = hoje;
      oldAlloc.active = false;

      resolvedHistory.push({
        id: `log-${Date.now()}-term`,
        allocationId: oldAlloc.id,
        actionType: 'TERMINATE',
        changedBy: currentUser!.id,
        changedAt: new Date().toISOString(),
        details: `Alocação do Colaborador ID ${newAllocColaboradorId} terminada em ${hoje}.`
      });
    }

    const newAllocId = `alloc-${Date.now()}`;
    const newAllocObj = {
      id: newAllocId,
      monitorId: selectedAllocationMonitor,
      colaboradorId: newAllocColaboradorId,
      startDate: newAllocStartDate,
      endDate: newAllocEndDate || null,
      active: true
    };

    updatedAllocations.push(newAllocObj);

    resolvedHistory.push({
      id: `log-${Date.now()}-ins`,
      allocationId: newAllocId,
      actionType: 'INSERT',
      changedBy: currentUser!.id,
      changedAt: new Date().toISOString(),
      details: `${users.find(u => u.id === newAllocColaboradorId)?.name} alocado(a) para ${users.find(u => u.id === selectedAllocationMonitor)?.name}. Vigência: ${newAllocStartDate} a ${newAllocEndDate || 'indeterminado'}.`
    });

    setAllocations(updatedAllocations);
    setAllocationHistory(resolvedHistory);
    
    setNewAllocColaboradorId('');
    setNewAllocEndDate('');
  };

  const handleTerminateAllocation = (allocId: string) => {
    if (recusarNoCompartilhado()) return;
    if (confirm('Deseja realmente encerrar a vigência desta alocação?')) {
      const updated = allocations.map(a => {
        if (a.id === allocId) {
          return { ...a, endDate: hoje, active: false };
        }
        return a;
      });

      const alloc = allocations.find(a => a.id === allocId);
      const colName = users.find(u => u.id === alloc?.colaboradorId)?.name;

      setAllocations(updated);
      setAllocationHistory([
        ...allocationHistory,
        {
          id: `log-${Date.now()}-term-man`,
          allocationId: allocId,
          actionType: 'TERMINATE',
          changedBy: currentUser!.id,
          changedAt: new Date().toISOString(),
          details: `Alocação de ${colName} terminada em ${hoje} por ação do Gestor.`
        }
      ]);
    }
  };

  // Dynamic Criteria Admin settings management
  const handleSaveCriterion = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (recusarNoCompartilhado()) return;
    if (!newCriterion.name) {
      alert('Nome do critério é obrigatório.');
      return;
    }

    // Campos numéricos vêm como texto do formulário; o resto sai do estado como está.
    //
    // 0.18.0: os dois caminhos passaram a partir de `...newCriterion` em vez de listar campo a
    // campo. A lista explícita silenciosamente descartava `opcoes`, `subPerguntas`, `ancoras` e
    // `quandoNA` — no caminho de criação, um critério de classificação nascia sem opções e sem
    // régua, e a tela de monitoria não tinha o que mostrar.
    const normalizado = {
      ...newCriterion,
      numero: newCriterion.numero ? parseInt(String(newCriterion.numero)) : null,
      weight: parseFloat(String(newCriterion.weight)),
    };

    if (newCriterion.id) {
      setCriteria(criteria.map(c => (c.id === newCriterion.id ? { ...c, ...normalizado } : c)));
    } else {
      setCriteria([...criteria, { ...normalizado, id: `crit-${Date.now()}` }]);
    }
    setShowCriterionModal(false);
    setNewCriterion({ id: '', numero: '', category: '', name: '', description: '', orientacao: '', tipoResposta: 'ESCALA_4', eliminatorio: false, weight: 1.0, channels: [...CHANNELS], active: true });
  };

  const handleSaveArea = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (recusarNoCompartilhado()) return;
    if (!newArea.name) return alert('Nome da área obrigatório.');
    if (newArea.id) {
      setAreas(areas.map(a => a.id === newArea.id ? newArea : a));
    } else {
      setAreas([...areas, { ...newArea, id: `area-${Date.now()}` }]);
    }
    setShowAreaModal(false);
    setNewArea({ id: '', name: '', gestorId: '', monitorIds: [], active: true });
  };

  const handleSaveCollaborator = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (recusarNoCompartilhado()) return;
    if (!newCollaborator.name || !newCollaborator.areaId) return alert('Nome e Área são obrigatórios.');
    if (newCollaborator.id) {
      setCollaborators(collaborators.map(c => c.id === newCollaborator.id ? newCollaborator : c));
    } else {
      setCollaborators([...collaborators, { ...newCollaborator, id: `ag-${Date.now()}` }]);
    }
    setShowCollaboratorModal(false);
    setNewCollaborator({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });
  };

  // 2A.4: existia aqui um segundo handler, handleUpdateMonitorGoal, que gravava uma "meta
  // global do monitor". Ela concorria com a meta por colaboradora e o sistema resolvia o
  // conflito escolhendo a maior das duas, em silêncio. Com a meta por colaboradora definida
  // como fonte única, o formulário que a alimentava saiu do Planejamento e o handler saiu
  // daqui. Os registros já gravados em pm2_mgoals permanecem intocados — nada os lê.
  //
  // A meta é gravada no período ESCOLHIDO na tela (0.22.0). Antes era sempre o mês corrente,
  // o que impedia cadastrar meta retroativa — e sem meta na competência, o progresso daquele
  // mês não tem denominador. Reconstruir o histórico desde janeiro depende disto.
  const handleUpdateColabGoal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // 25/10/2026 — o formulário começava com monitor e colaboradora vazios e a tela exibia o
    // primeiro nome da lista: quem salvava sem mexer gravava `monitorId: ''`. Foi assim que as
    // metas de agosto ficaram sem monitor e sumiram do Painel. Vazio agora não é gravado.
    if (!newCGoalVal.monitorId || !newCGoalVal.colaboradorId) {
      alert('Selecione a monitora responsável e a colaboradora antes de salvar a meta.\n\nNada foi alterado.');
      return;
    }
    const alvoInformado = parseInt(String(newCGoalVal.targetQty), 10);
    if (!Number.isFinite(alvoInformado) || alvoInformado < 1) {
      alert('Informe um volume de monitorias igual ou maior que 1.\n\nNada foi alterado.');
      return;
    }
    const { year, month } = planningPeriod;
    const canal = newCGoalVal.canal ? (newCGoalVal.canal as Canal) : undefined;

    // 2A.6.3: bloqueio da combinação proibida.
    //
    // Meta geral e meta por canal são mutuamente exclusivas: ter as duas não tem resposta
    // certa, porque o canal abateria a geral ou somaria a ela. O sistema não escolhe sozinho
    // — a tela recusa e explica qual é o caminho.
    const doPeriodo = colaboradorGoals.filter(
      g => g.monitorId === newCGoalVal.monitorId
        && g.colaboradorId === newCGoalVal.colaboradorId
        && g.year === year
        && g.month === month
    );
    const jaTemGeral = doPeriodo.some(g => !g.canal);
    const jaTemPorCanal = doPeriodo.some(g => Boolean(g.canal));
    const nome = collaborators.find(c => c.id === newCGoalVal.colaboradorId)?.name
      ?? users.find(u => u.id === newCGoalVal.colaboradorId)?.name
      ?? 'A colaboradora';

    if (canal && jaTemGeral) {
      alert(
        `${nome} já tem uma meta geral em ${periodLabel(planningPeriod)}.

`
        + 'Meta geral e meta por canal não podem coexistir: remova a meta geral no quadro ao '
        + 'lado antes de definir metas por canal.'
      );
      return;
    }
    if (!canal && jaTemPorCanal) {
      alert(
        `${nome} já tem metas por canal em ${periodLabel(planningPeriod)}.

`
        + 'Meta geral e meta por canal não podem coexistir: remova as metas por canal no '
        + 'quadro ao lado antes de definir uma meta geral.'
      );
      return;
    }

    // Atualização só acontece dentro do MESMO escopo: a meta de WhatsApp não sobrescreve a
    // de Ligação nem a geral.
    const existingIndex = colaboradorGoals.findIndex(
      g => g.monitorId === newCGoalVal.monitorId
        && g.colaboradorId === newCGoalVal.colaboradorId
        && g.year === year
        && g.month === month
        && (g.canal ?? undefined) === canal
    );
    // Cópia do item, nunca alteração no lugar: mexer no objeto do estado faria a lista "antes"
    // e a "depois" serem iguais, e a gravação por diferença não veria mudança nenhuma.
    const novas = existingIndex > -1
      ? colaboradorGoals.map((g, i) => (i === existingIndex ? { ...g, targetQty: alvoInformado } : g))
      : [...colaboradorGoals, {
        id: `cgoal-${Date.now()}`,
        monitorId: newCGoalVal.monitorId,
        colaboradorId: newCGoalVal.colaboradorId,
        year,
        month,
        ...(canal ? { canal } : {}),
        targetQty: alvoInformado
      }];
    if (!(await persistirMetas(novas))) return;
    const escopo = canal ? canalLabel(canal) : 'geral';
    alert(`Meta ${escopo} de ${nome} atualizada para ${periodLabel(planningPeriod)}.`);
  };

  // Exclusão de meta. Não existia: o formulário só criava e atualizava, então trocar uma
  // colaboradora de meta geral para meta por canal era impossível pela tela — ela ficaria com
  // as duas, que é justamente o estado proibido.
  const handleRemoveColabGoal = (goalId: string) => {
    const alvo = colaboradorGoals.find(g => g.id === goalId);
    if (!alvo) return;
    const nome = collaborators.find(c => c.id === alvo.colaboradorId)?.name
      ?? users.find(u => u.id === alvo.colaboradorId)?.name
      ?? 'a colaboradora';
    const escopo = alvo.canal ? canalLabel(alvo.canal) : 'geral';
    if (!confirm(`Remover a meta ${escopo} de ${nome} em ${periodLabel(planningPeriod)}?`)) return;
    void persistirMetas(colaboradorGoals.filter(g => g.id !== goalId));
  };

  // --- Plano de metas (0.23.0) ---------------------------------------------------------

  const nomeDaColaboradora = (id: string) =>
    collaborators.find(c => c.id === id)?.name ?? users.find(u => u.id === id)?.name ?? 'a colaboradora';

  /**
   * "Voltar ao plano": apaga a exceção da colaboradora naquela competência.
   *
   * É o único caminho de remoção que existe para uma linha herdada — ela não é um registro
   * gravado, e sim o plano sendo lido. Apagar a exceção devolve a leitura ao plano.
   */
  const handleVoltarAoPlano = (monitorId: string, colaboradorId: string) => {
    const { year, month } = planningPeriod;
    void persistirMetas(colaboradorGoals.filter(
      g => !(g.monitorId === monitorId && g.colaboradorId === colaboradorId
        && g.year === year && g.month === month)
    ));
  };

  /**
   * "Sem meta neste mês": férias, afastamento ou situação especial.
   *
   * Grava uma exceção marcada, e não uma meta zero — zero somaria ao total e faria `hasGoal`
   * verdadeiro, transformando "está de férias" em "tem meta zero".
   *
   * Substitui todas as linhas da colaboradora no mês: a sobreposição é por pessoa, senão uma
   * meta por canal do plano sobreviveria ao lado do afastamento.
   */
  const handleSemMeta = (monitorId: string, colaboradorId: string) => {
    const motivo = prompt(
      `Por que ${nomeDaColaboradora(colaboradorId)} fica sem meta em ${periodLabel(planningPeriod)}?`,
      'Férias',
    );
    if (motivo === null) return;

    const { year, month } = planningPeriod;
    const semAsAntigas = colaboradorGoals.filter(
      g => !(g.monitorId === monitorId && g.colaboradorId === colaboradorId
        && g.year === year && g.month === month)
    );
    void persistirMetas([...semAsAntigas, {
      id: `cgoal-${Date.now()}`,
      monitorId,
      colaboradorId,
      year,
      month,
      targetQty: 0,
      semMeta: true,
      motivo: motivo.trim() || undefined,
    }]);
  };

  /**
   * "Ajustar": pré-preenche o formulário de meta com o que o plano previa.
   *
   * Reaproveita o formulário que já existe, e com ele as validações de escopo da 2A.6.3 — a
   * exceção está sujeita às mesmas regras que a meta sempre esteve.
   */
  const handleAjustarMeta = (monitorId: string, colaboradorId: string, alvoAtual: number, canal?: Canal) => {
    setNewCGoalVal({
      monitorId,
      colaboradorId,
      canal: canal ?? '',
      targetQty: alvoAtual,
    });
  };

  /**
   * Salva o plano. Criação, ou sucessão quando a vigência já começou.
   *
   * A sucessão é o que faz a edição não reescrever o passado (ver `sucederPlano`): alterar a
   * meta em dezembro não pode reavaliar agosto contra um alvo que não valia quando o trabalho
   * foi feito.
   */
  const handleSalvarPlano = async (plano: PlanoMetas): Promise<boolean> => {
    const existente = planosMetas.find(p => p.id === plano.id);

    if (vigenciaColide(planosMetas, plano.vigenciaInicio, plano.vigenciaFim, plano.id)) {
      alert(
        'Já existe um plano cobrindo essa vigência.\n\n'
        + 'Dois planos ativos no mesmo mês deixariam a meta herdada dependendo de qual viesse '
        + 'primeiro na lista. Ajuste as datas ou encerre o plano anterior.'
      );
      return false;
    }

    if (!existente) {
      if (!(await persistirPlanos([...planosMetas, plano]))) return false;
      alert(`Plano "${plano.nome}" criado para ${competenciaLabel(plano.vigenciaInicio)} a ${competenciaLabel(plano.vigenciaFim)}.`);
      return true;
    }

    const { substitui, novo } = sucederPlano(existente, plano.linhas, periodoAtual, currentUser!.id);
    // Sucessão: o plano corrente é alterado (vigência encerrada) e o novo é incluído — duas
    // gravações, nessa ordem. Se a segunda for recusada, a tela recarrega e avisa.
    if (!(await persistirPlanos([...planosMetas.filter(p => p.id !== existente.id), substitui, ...(novo ? [novo] : [])]))) return false;

    alert(novo
      ? `Alteração registrada. Vale a partir de ${periodLabel(periodoAtual)}.\n\n`
        + `As competências até ${competenciaLabel(substitui.vigenciaFim)} mantêm os valores que tinham.`
      : `Plano "${plano.nome}" atualizado.`);
    return true;
  };

  // Aplica uma mutação a uma monitoria e mantém o painel de detalhe (que guarda um
  // snapshot próprio em selectedMonitoringDetail) sincronizado — sem isso, o gestor
  // aciona uma ação e o painel aberto continua exibindo o estado anterior.
  const updateMonitoringById = (monId: string, mutate: (m: Monitoring) => Monitoring) => {
    const updated = monitorings.map(m => (m.id === monId ? mutate(m) : m));
    setMonitorings(updated);
    setSelectedMonitoringDetail(prev => (prev && prev.id === monId ? (updated.find(m => m.id === monId) ?? null) : prev));
  };

  /**
   * Gate único dos quatro atos de validação: aprovar, reprovar, devolver e confirmar zerada.
   *
   * Antes era `isManagerRole()`, que só perguntava o papel de quem clicou. Agora a decisão
   * também olha **de quem é a monitoria** — ninguém valida a própria, quaisquer que sejam seus
   * perfis. Recebe o registro por isso: sem ele, a regra de imparcialidade não teria como ser
   * avaliada aqui, que é a última barreira antes da escrita.
   */
  const gateValidacao = (monId: string): boolean => {
    const alvo = monitorings.find(m => m.id === monId);
    return podeValidar(currentUser, perfilAtivo, alvo).pode;
  };

  /** Decisão final (validar, reprovar, zerar) numa migrada sem régua: só devolver (M1). */
  const recusarDecisaoFinal = (monId: string): boolean => {
    if (!exigeReenvio(monitorings.find(m => m.id === monId))) return false;
    alert(MOTIVO_REENVIO_MIGRADA);
    return true;
  };

  const handleApproveMonitoring = (monId: string) => {
    if (!gateValidacao(monId) || recusarDecisaoFinal(monId)) return;
    if (COMPARTILHADO) { void acaoNoBanco(monId, (m) => validarMonitoria(transporteSupabase(), m)); return; }
    updateMonitoringById(monId, m => ({
      ...m,
      status: 'Validada',
      approvedBy: currentUser!.id,
      approvedAt: new Date().toISOString()
    }));
  };

  const handleRejectMonitoring = (monId: string) => {
    if (!gateValidacao(monId) || recusarDecisaoFinal(monId)) return;
    if (COMPARTILHADO) {
      // Reprovação é final e exige motivo (D5); o banco também recusa sem motivo.
      const motivo = window.prompt('Motivo da reprovação (obrigatório). A reprovação é final:')?.trim();
      if (!motivo) return;
      void acaoNoBanco(monId, (m) => reprovarMonitoria(transporteSupabase(), m, motivo));
      return;
    }
    updateMonitoringById(monId, m => ({
      ...m,
      status: 'Reprovada',
      reviewedBy: currentUser!.id,
      reviewedAt: new Date().toISOString()
    }));
  };

  // Devolve a monitoria ao monitor para edição (status Rascunho), preservando o motivo
  // informado pelo gestor. Reutiliza o vocabulário de status existente em vez de criar
  // um novo, evitando alterar filtros e badges da listagem nesta correção.
  const handleRequestAdjustments = (monId: string, reason: string) => {
    if (!gateValidacao(monId)) return;
    if (COMPARTILHADO) {
      void acaoNoBanco(monId, (m) => devolverMonitoria(transporteSupabase(), m, reason));
      setShowDetailModal(false);
      return;
    }
    updateMonitoringById(monId, m => ({
      ...m,
      status: 'Rascunho',
      adjustmentReason: reason || '',
      reviewedBy: currentUser!.id,
      reviewedAt: new Date().toISOString()
    }));
    setShowDetailModal(false);
  };

  // F0-08: zera a nota de uma monitoria com critério eliminatório confirmado.
  // Gated por papel na UI (MonitoringHistory só renderiza o botão para GESTOR/ADMIN);
  // aqui a checagem é repetida como segunda barreira, já que não há backend ainda
  // para impor isso de fato — limitação conhecida da arquitetura da Fase 0.
  const handleConfirmZerada = (monId: string) => {
    if (!gateValidacao(monId) || recusarDecisaoFinal(monId)) return;
    if (COMPARTILHADO) { void acaoNoBanco(monId, (m) => confirmarZeramento(transporteSupabase(), m)); return; }
    updateMonitoringById(monId, m => ({
      ...m,
      finalScore: 0,
      zerada: true,
      eliminatoryPending: false,
      eliminatoryConfirmedBy: currentUser!.id,
      eliminatoryConfirmedAt: new Date().toISOString()
    }));
  };

  // 2B.2: a ação aparecia para os três papéis, mas DELETE_MONITORING é ['ADMIN']. O botão
  // nunca foi barrado. Ao migrar para Relatórios, ganhou o gate que já deveria ter.
  const handleCancelMonitoring = (monId: string) => {
    if (COMPARTILHADO) {
      // Só ADMIN com MFA cancela (D7); o banco recusa os demais.
      const motivo = window.prompt('Motivo do cancelamento (obrigatório):')?.trim();
      if (!motivo) return;
      void acaoNoBanco(monId, (m) => cancelarMonitoria(transporteSupabase(), m, motivo));
      return;
    }
    if (confirm('Deseja realmente cancelar esta monitoria?')) {
      const updated = monitorings.map(m => {
        if (m.id === monId) return { ...m, status: 'Cancelada' as Monitoring['status'] };
        return m;
      });
      setMonitorings(updated);
    }
  };

  // Filter monitorings list for view
  /**
   * Registros da competência selecionada, antes dos filtros do usuário.
   *
   * 0.22.0 — era um intervalo de datas montado com `periodRange`, duas conversões para `Date` e
   * comparação em UTC. Toda essa aritmética existia para responder "esta monitoria é deste
   * mês?", que agora o próprio registro responde.
   */
  const monitoriasDoPeriodo = React.useMemo(
    () => monitorings.filter(m => naCompetencia(m.competencia, reportPeriod)),
    [monitorings, reportPeriod],
  );

  /**
   * O conjunto único de Relatórios.
   *
   * É exatamente isto que a tabela exibe, o CSV leva e o PDF imprime. A regra combinada com o
   * usuário: o que aparece na tela é o que será exportado.
   */
  const monitoriasFiltradas = React.useMemo(
    () => aplicaFiltrosDeHistorico(monitoriasDoPeriodo, historicoFiltros, collaborators),
    [monitoriasDoPeriodo, historicoFiltros, collaborators]
  );

  const getFilteredMonitorings = () => monitoriasFiltradas;

  /** Nome de colaboradora ou monitora: o cadastro de colaboradoras primeiro, depois as pessoas. */
  const nomeDaPessoa = (id: string) => collaborators.find(c => c.id === id)?.name ?? users.find(u => u.id === id)?.name;

  // Quem ainda não foi monitorada no período.
  //
  // 2A.3: passou a ser escopado. Antes varria TODAS as colaboradoras cadastradas, então
  // listava gente que não pertence à carteira de ninguém — inclusive quem não tem vínculo
  // vigente e por isso jamais poderia ser monitorada por quem estivesse olhando a lista.
  //
  // Sem `monitorId`, responde sobre todas as colaboradoras COM vínculo vigente (visão da
  // gestora). As sem vínculo saem daqui e ficam em `getSemVinculo`: não é falta de monitoria,
  // é falta de carteira, e o conserto é outro — resolver o vínculo em Equipe.
  // Período parametrizado na 0.22.1, pelo mesmo motivo de getMonitorStats: o Painel navega
  // por competência, e "quem falta monitorar" precisa responder sobre a que está na tela.
  const getUnmonitoredCollaborators = (monitorId: string | null = null, periodo: Period = periodoAtual) => {
    const base = monitorId
      ? getCarteiraDe(monitorId)
      : collaborators.filter(c => Boolean(getActiveMonitorForColab(c.id).monitor));

    return base.filter(c => !monitorings.some(m =>
      m.colaboradorId === c.id
      && naCompetencia(m.competencia, periodo)
      && countsForCarteiraGoal(m)
    ));
  };

  // Progresso de um monitor no período de competência corrente.
  //
  // 2A.2: a meta por colaboradora passou a ser a única fonte da verdade. Antes o alvo era
  // `Math.max(metaGlobalDoMonitor, somaDasMetasPorColaboradora)` — duas metas concorrentes
  // resolvidas escolhendo a maior, sem que nada na tela dissesse qual delas venceu.
  //
  // `hasGoal` existe para que a ausência de meta seja dita, e não preenchida com um número
  // inventado: sem meta no período, a tela informa a ausência em vez de exibir 0 ou 5.
  /**
   * Progresso de um monitor numa competência.
   *
   * 0.22.1 — o período era fixo em `periodoAtual`, o mês corrente. Quando a 0.22.0 deu um
   * seletor de competência ao Painel, o seletor passou a mover o subtítulo e a meta por
   * colaboradora, mas **não estes números**: o Painel em agosto exibia os KPIs de setembro sob
   * um cabeçalho que dizia agosto. Uma tela que mente sobre o próprio recorte é pior que uma
   * tela sem recorte.
   *
   * O ritmo diário só existe dentro da competência corrente: `businessDaysRemainingIn` devolve
   * 0 fora dela, e perguntar quantos dias úteis restam de um mês encerrado não tem resposta
   * útil. Em competência passada, o ritmo é `null` e a tela mostra a ausência.
   */
  const getMonitorStats = (monitorId: string, periodo: Period = periodoAtual) => {
    const progresso = getCarteiraProgress(metasDe(periodo).metas, monitorings, monitorId, periodo);
    const diasUteis = businessDaysRemainingIn(periodo, hoje);
    const pace = diasUteis > 0 ? (progresso.remaining / diasUteis).toFixed(1) : null;
    return { ...progresso, pace, diasUteis };
  };

  // Export handlers
  const handleExportExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    // 0.14.0: o CSV passou a levar os identificadores, a categoria e a janela do atendimento.
    // Até aqui ele exportava a monitoria sem nenhuma chave que a ligasse ao atendimento — quem
    // recebia a planilha não tinha como cruzá-la com nada.
    csvContent += 'ID,Competencia,Data do Atendimento,Monitor,Colaborador,No Atendimento,No Protocolo,No Titulo,Categoria,Canal,Tipo,Inicio,Encerramento,Duracao,Status,Nota Final,Comentarios\n';
    const filtered = getFilteredMonitorings();
    filtered.forEach(m => {
      const mon = users.find(u => u.id === m.monitorId)?.name || 'N/A';
      const col = nomeDaPessoa(m.colaboradorId) || 'N/A';
      const formattedDate = new Date(m.date).toLocaleDateString('pt-BR');
      const cleanComments = (m.comments ?? '').replace(/"/g, '""');
      const fmtDataHora = (v?: string) => (v ? new Date(v).toLocaleString('pt-BR') : '');
      csvContent += `"${m.id}","${m.competencia ?? ''}","${formattedDate}","${mon}","${col}","${m.numeroAtendimento ?? ''}","${m.protocolo ?? ''}","${m.numeroTitulo ?? ''}","${m.categoriaAtendimento ?? ''}","${canalLabel(m.canal)}","${m.tipo}","${fmtDataHora(m.inicioAtendimento)}","${fmtDataHora(m.fimAtendimento)}","${exibirDuracao(m.duracaoMinutos, m.tempo)}","${m.status}","${notaParaExibir(m)}","${cleanComments}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `monitorias_${reportPeriod.year}-${String(reportPeriod.month + 1).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    const filtered = getFilteredMonitorings();
    const resumoPdf = resumirNotas(filtered);
    let rowsHtml = '';
    filtered.forEach(m => {
      const mon = users.find(u => u.id === m.monitorId)?.name || 'N/A';
      const col = nomeDaPessoa(m.colaboradorId) || 'N/A';
      rowsHtml += `
        <tr>
          <td>${new Date(m.date).toLocaleDateString('pt-BR')}</td>
          <td>${mon}</td>
          <td>${col}</td>
          <td>${canalLabel(m.canal)} (${m.tipo})</td>
          <td>${m.status}</td>
          <td style="font-weight: bold; color: ${m.finalScore >= 95 ? '#008443' : m.finalScore >= 75 ? '#f59e0b' : '#ef4444'}">${notaParaExibir(m)}</td>
          <td>${m.comments}</td>
        </tr>
      `;
    });

    printWindow!.document.write(`
      <html>
        <head>
          <title>Relatório de Monitorias - V2</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { color: ${brand.primaryColor}; border-bottom: 2px solid ${brand.primaryColor}; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Relatório Executivo de Avaliações - V2</h1>
          <div><strong>Branding:</strong> ${brand.name} | <strong>Competência:</strong> ${periodLabel(reportPeriod)} | <strong>Emitido em:</strong> ${parseData(hoje).toLocaleDateString('pt-BR')}</div>
          <div style="margin-top: 6px"><strong>Monitorias:</strong> ${resumoPdf.total} | <strong>Na média:</strong> ${resumoPdf.consideradas} | <strong>Média geral:</strong> ${resumoPdf.media === null ? '—' : `${resumoPdf.media.toFixed(2)}%`} <span style="color:#666">(Pendente, Validada e Concluída; rascunho, reprovada e cancelada ficam fora da média)</span></div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Monitor</th>
                <th>Colaborador</th>
                <th>Canal / Tipo</th>
                <th>Status</th>
                <th>Nota</th>
                <th>Comentários</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWindow!.document.close();
  };

  // Helper to draw user initials inside a circular badge with consistent palette color
  // Mantido como função para preservar o contrato dos componentes que a recebem por prop
  // (Dashboard, Planning, Allocations, Admin, Topbar) — a marcação vive em UserAvatar.
  const renderUserAvatar = (name: string) => <UserAvatar name={name} />;

  // Modo compartilhado: aguarda a restauração da sessão antes de decidir entre login e portal.
  if (carregandoBanco) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.95rem' }}>
        Conectando ao MonitorIA…
      </div>
    );
  }

  // P2: segundo fator pendente — nada do portal aparece antes da verificação.
  if (COMPARTILHADO && etapaMfa && !currentUser) {
    return (
      <MfaScreen
        etapa={etapaMfa}
        onConcluido={(login) => {
          setEtapaMfa(null);
          setLoginError('');
          abrirSessaoCompartilhada(login).catch((e) => setLoginError(mensagemDoErro(e)));
        }}
        onSair={() => {
          setEtapaMfa(null);
          void sairDoSupabase();
        }}
      />
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* 1. SSO LOGIN — rota própria (F0-14).
           Sem sessão, qualquer endereço redireciona para /login carregando a rota pretendida
           em location.state.from, para onde o handleLogin devolve o usuário após autenticar. */}
      {!currentUser && (
        <Routes>
          <Route path={PATH_LOGIN} element={
            <LoginScreen
              loginEmail={loginEmail}
              setLoginEmail={setLoginEmail}
              loginPassword={loginPassword}
              setLoginPassword={setLoginPassword}
              loginError={loginError}
              showDevTools={showDevTools}
              setShowDevTools={setShowDevTools}
              onSubmit={handleLogin}
              ambienteCompartilhado={COMPARTILHADO}
            />
          } />
          <Route path="*" element={<Navigate to={PATH_LOGIN} state={captureIntent ? { from: location.pathname } : null} replace />} />
        </Routes>
      )}

      {/* 2. AUTHENTICATED SaaS LAYOUT */}
      {currentUser && (
        <AppShell
          brand={brand}
          currentUser={currentUser}
          perfilAtivo={perfilAtivo}
          onTrocarPerfil={handleTrocarPerfil}
          activeTab={activeTab}
          onNavigate={navigateToTab}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          menuConfig={MENU_CONFIG}
          onLogout={handleLogout}
          renderUserAvatar={renderUserAvatar}
        >
          <Routes>

            <Route path="/" element={<Navigate to={entradaDoPerfil(perfilAtivo)} replace />} />

            {/* Já autenticado em /login: devolve à rota pretendida antes do login, quando o perfil ATIVO
                pode abri-la; senão, à entrada do próprio perfil (ENTRADA_POR_PERFIL — o ADMIN não
                tem /monitorings). É também o passo final do fluxo de autenticação — ver handleLogin. */}
            <Route path={PATH_LOGIN} element={<Navigate to={destinoAposEntrar(perfilAtivo, location.state?.from)} replace />} />

            {/* Endereços antigos da Home continuam resolvendo: quem a tinha em favorito
                recebe a tela de trabalho, e não um erro de rota inexistente. */}
            <Route path="/home" element={<Navigate to={entradaDoPerfil(perfilAtivo)} replace />} />

            <Route path="/dashboard" element={
              <Screen tab="dashboard" perfil={perfilAtivo}>
                  <DashboardScreen
                    perfilAtivo={perfilAtivo}
                    settings={settings}
                    areas={areas}
                    users={users}
                    collaborators={collaborators}
                    colaboradorGoals={metasDoPainel}
                    monitorings={monitorings}
                    currentUser={currentUser}
                    dashboardAreaId={dashboardAreaId}
                    setDashboardAreaId={setDashboardAreaId}
                    onNavigate={navigateToTab}
                    setShowDetailModal={setShowDetailModal}
                    setSelectedMonitoringDetail={setSelectedMonitoringDetail}
                    renderUserAvatar={renderUserAvatar}
                    getMonitors={getMonitors}
                    getMonitorStats={getMonitorStats}
                    getUnmonitoredCollaborators={getUnmonitoredCollaborators}
                    getCarteiraDe={getCarteiraDe}
                    businessDaysRemaining={businessDaysRemainingIn(dashboardPeriod, hoje)}
                    periodoAtual={dashboardPeriod}
                    periodoLabel={periodLabel(dashboardPeriod)}
                    onPeriodoChange={setDashboardPeriod}
                  />
              </Screen>
            } />

            <Route path="/planning" element={
              <Screen tab="planning" perfil={perfilAtivo}>
                  <PlanningScreen
                    users={users}
                    collaborators={collaborators}
                    monitorings={monitorings}
                    colaboradorGoals={metasDoPlanejamento.metas}
                    periodoAtual={planningPeriod}
                    periodoLabel={periodLabel(planningPeriod)}
                    onPeriodoChange={setPlanningPeriod}
                    newCGoalVal={newCGoalVal}
                    setNewCGoalVal={setNewCGoalVal}
                    onUpdateColabGoal={handleUpdateColabGoal}
                    onRemoveColabGoal={handleRemoveColabGoal}
                    onAjustar={handleAjustarMeta}
                    onVoltarAoPlano={handleVoltarAoPlano}
                    onSemMeta={handleSemMeta}
                    onEditarPlano={() => setShowPlanoEditor(true)}
                    semMeta={metasDoPlanejamento.semMeta}
                    planoVigente={getPlanoVigente(planosMetas, planningPeriod)}
                    getMonitors={getMonitors}
                    getCollaborators={getCollaborators}
                    renderUserAvatar={renderUserAvatar}
                  />
              </Screen>
            } />

            <Route path="/monitorings" element={
              <Screen tab="monitorings" perfil={perfilAtivo}>
                  <MonitoringQueueScreen
                    currentUser={currentUser}
                    perfilAtivo={perfilAtivo}
                    areas={areas}
                    settings={settings}
                    periodo={competenciaDaFila}
                    onPeriodo={setMonitoringsPeriod}
                    monitorings={monitorings}
                    colaboradorGoals={metasDaFila}
                    collaborators={collaborators}
                    allocations={allocations}
                    holidays={holidays}
                    users={users}
                    onNovaMonitoria={(colaboradorId, canal) => {
                      setSeedNovaMonitoria({ colaboradorId: colaboradorId ?? '', canal: canal ?? '' });
                      navigate('/monitorings/new');
                    }}
                    onAbrir={(m) => {
                      setSelectedMonitoringDetail(m);
                      setShowDetailModal(true);
                    }}
                    onEditar={(m) => navigate(`/monitorings/${m.id}/edit`)}
                    onValidar={handleApproveMonitoring}
                    onVerRelatorios={() => navigate('/reports')}
                  />
              </Screen>
            } />

            {/* A Central de Monitorias saiu de /monitorings. A tabela, a busca e os cinco
                filtros passam a viver em Relatórios na 2B.2 — histórico e análise pertencem
                lá, não à agenda do dia. O componente segue no repositório, sem rota, até a
                migração fechar. */}

            <Route path="/monitorings/new" element={
              <Screen tab="monitoring-new" perfil={perfilAtivo}>
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                    <MonitoringForm
                      initialData={editingMonitoring}
                      colaboradorIdInicial={seedNovaMonitoria.colaboradorId}
                      canalInicial={seedNovaMonitoria.canal}
                      competenciaInicial={periodToCompetencia(competenciaDaFila)}
                      users={users}
                      collaborators={getCollaborators()}
                      criteria={criteria}
                      currentUser={currentUser}

                      monitorings={monitorings}
                      areas={areas}
                      settings={settings}
                      catalogCategorias={catalogCategorias}
                      onAddCategoria={handleAddCategoria}
                      onClose={() => navigate('/monitorings')}
                      onSave={handleSaveFormMonitoring}
                    />
                  </div>
              </Screen>
            } />

            {/* Lançamento retroativo (0.22.0). Mesmo formulário, mesma régua — o que muda é a
                permissão que abre a rota, o status final e a marca de origem. Rota própria, e
                não um parâmetro em /monitorings/new, porque a permissão é outra: quem monitora
                registra o mês corrente; reabrir um mês fechado é decisão de gestão. */}
            <Route path="/monitorings/retroativa" element={
              <Screen tab="monitoring-retroativa" perfil={perfilAtivo}>
                  {COMPARTILHADO ? (
                    <NotImplementedScreen
                      title="Lançamento retroativo indisponível"
                      description="No ambiente compartilhado o lançamento retroativo está desativado (decisão D8). Monitorias de competências anteriores são registradas normalmente e seguem para validação na fila do supervisor."
                    />
                  ) : (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                    <MonitoringForm
                      modoRetroativo
                      users={users}
                      collaborators={getCollaborators()}
                      criteria={criteria}
                      currentUser={currentUser}
                      monitorings={monitorings}
                      areas={areas}
                      settings={settings}
                      catalogCategorias={catalogCategorias}
                      onAddCategoria={handleAddCategoria}
                      onClose={() => navigate('/reports')}
                      onSave={handleSaveFormMonitoring}
                    />
                  </div>
                  )}
              </Screen>
            } />

            <Route path="/monitorings/:id/edit" element={
              <Screen tab="monitoring-edit" perfil={perfilAtivo}>
                {editingMonitoring ? (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                      <MonitoringForm
                        initialData={editingMonitoring}
                        users={users}
                        collaborators={getCollaborators()}
                        criteria={criteria}
                        currentUser={currentUser}

                        monitorings={monitorings}
                        areas={areas}
                        settings={settings}
                        catalogCategorias={catalogCategorias}
                        onAddCategoria={handleAddCategoria}
                        onClose={() => navigate('/monitorings')}
                        onSave={handleSaveFormMonitoring}
                      />
                    </div>
                ) : <NotFoundScreen />}
              </Screen>
            } />

            <Route path="/reports" element={
              <Screen tab="reports" perfil={perfilAtivo}>
                  <ReportsScreen
                    resumo={
                      <ResumoResultados
                        monitorias={monitoriasFiltradas}
                        nomeDe={nomeDaPessoa}
                        periodoLabel={periodLabel(reportPeriod)}
                      />
                    }
                    historico={
                      <MonitoringList
                        monitorings={monitoriasFiltradas}
                        users={users}
                        collaborators={getCollaborators()}
                        filtros={historicoFiltros}
                        onFiltrosChange={setHistoricoFiltros}
                        titulo={`Histórico de ${periodLabel(reportPeriod)}`}
                        subtitulo="Busque, filtre e abra qualquer monitoria da competência."
                        onView={(m) => {
                          setSelectedMonitoringDetail(m);
                          setShowDetailModal(true);
                        }}
                        onEdit={(m) => navigate(`/monitorings/${m.id}/edit`)}
                        onDelete={hasPermission(perfilAtivo, 'DELETE_MONITORING') ? handleCancelMonitoring : undefined}
                      />
                    }
                    periodo={reportPeriod}
                    onPeriodoChange={setReportPeriod}
                    periodoLabel={periodLabel(reportPeriod)}
                    periodoAnteriorLabel={periodLabel(previousPeriod(reportPeriod))}
                    periodoSeguinteLabel={periodLabel(nextPeriod(reportPeriod))}
                    onPeriodoAnterior={() => setReportPeriod(previousPeriod(reportPeriod))}
                    onPeriodoSeguinte={() => setReportPeriod(nextPeriod(reportPeriod))}
                    totalNoPeriodo={monitoriasDoPeriodo.length}
                    totalRegistros={monitoriasFiltradas.length}
                    onLancarRetroativa={hasPermission(perfilAtivo, 'LANCAR_RETROATIVO') ? () => navigate('/monitorings/retroativa') : undefined}
                    onExportExcel={handleExportExcel}
                    onExportPDF={handleExportPDF}
                  />
              </Screen>
            } />

            <Route path="/allocations" element={
              <Screen tab="allocations" perfil={perfilAtivo}>
                  <AllocationsScreen
                    users={users}
                    allocations={allocations}
                    allocationHistory={allocationHistory}
                    selectedAllocationMonitor={selectedAllocationMonitor}
                    setSelectedAllocationMonitor={setSelectedAllocationMonitor}
                    newAllocColaboradorId={newAllocColaboradorId}
                    setNewAllocColaboradorId={setNewAllocColaboradorId}
                    newAllocStartDate={newAllocStartDate}
                    setNewAllocStartDate={setNewAllocStartDate}
                    newAllocEndDate={newAllocEndDate}
                    setNewAllocEndDate={setNewAllocEndDate}
                    onCreateAllocation={handleCreateAllocation}
                    onTerminateAllocation={handleTerminateAllocation}
                    getMonitors={getMonitors}
                    getCollaborators={getCollaborators}
                    renderUserAvatar={renderUserAvatar}
                  />
              </Screen>
            } />

            <Route path="/admin/:secao" element={
              // Sem fallback de seção: /admin/algo-inexistente tem de cair no NotFound como
              // qualquer outro endereço inválido. Um fallback silencioso abriria a
              // Administração e faria um erro de digitação parecer uma tela legítima.
              activeTab && activeTab in ADMIN_SECOES ? (
              <Screen tab={activeTab} perfil={perfilAtivo}>
                  {COMPARTILHADO ? (
                    <NotImplementedScreen
                      title="Administração no ambiente compartilhado"
                      description="As telas de Administração ainda gravam só neste navegador e por isso estão desativadas no ambiente compartilhado. Cadastros e régua seguem pelo procedimento controlado (SQL Editor, com responsável declarado e auditoria) até a Administração com MFA ficar pronta."
                    />
                  ) : (
                  <AdminScreen
                    monitorings={monitorings}
                    brand={brand}
                    setBrand={setBrand}
                    settings={settings}
                    setSettings={setSettings}
                    areas={areas}
                    collaborators={collaborators}
                    users={users}
                    onUsersChange={setUsers}
                    criteria={criteria}
                    adminSubTab={adminSubTab}
                    setAdminSubTab={setAdminSubTab}
                    setNewCriterion={setNewCriterion}
                    setNewArea={setNewArea}
                    setNewCollaborator={setNewCollaborator}
                    setShowCriterionModal={setShowCriterionModal}
                    setShowAreaModal={setShowAreaModal}
                    setShowCollaboratorModal={setShowCollaboratorModal}
                  />
                  )}
              </Screen>
              ) : <NotFoundScreen />
            } />

            <Route path="/profile" element={<Screen tab="profile" perfil={perfilAtivo}><MyProfile currentUser={currentUser} /></Screen>} />




            {/* Telas ainda não implementadas: Screen resolve para NotImplementedScreen,
                exatamente como a lista isUnimplemented fazia no dispatcher anterior. */}


            <Route path="/csat" element={<Screen tab="csat" perfil={perfilAtivo} />} />

            <Route path="/nps" element={<Screen tab="nps" perfil={perfilAtivo} />} />





            <Route path="*" element={<NotFoundScreen />} />

          </Routes>
        </AppShell>
      )}

      {/* 3. WIZARDS AND MODALS IN V2 */}

      {/* MODALS */}


      {showDetailModal && selectedMonitoringDetail && (
        <MonitoringHistory
          perfilAtivo={perfilAtivo}
          monitoring={selectedMonitoringDetail}
          users={users}
          collaborators={getCollaborators()}
          criteria={criteria}
          currentUser={currentUser}
          onClose={() => setShowDetailModal(false)}
          onApprove={handleApproveMonitoring}
          onReject={handleRejectMonitoring}
          onRequestAdjustments={handleRequestAdjustments}
          onConfirmZerada={handleConfirmZerada}
        />
      )}

      {/* MODAL: Criar / Editar Critério Dinâmico */}
      {showCriterionModal && (
        <CriterionModal
          newCriterion={newCriterion}
          setNewCriterion={setNewCriterion}
          setShowCriterionModal={setShowCriterionModal}
          onSave={handleSaveCriterion}
        />
      )}

      {/* O modal de cadastro rápido de usuário saiu na 0.21.0, junto com a aba que o abria.
          Ele e a tela de Contas gravavam o mesmo registro por caminhos diferentes — e o rápido
          era o pior dos dois: não editava, não bloqueava, e a listagem que o acompanhava
          mostrava todo mundo como "Ativo" independentemente do status real. Sobrou uma tela. */}

      {/* O editor fecha só quando o plano foi de fato salvo. Recusada a vigência por colisão,
          ele permanece aberto com tudo o que foi digitado — é exatamente ali que a gestora
          precisa corrigir as datas, e fechar significaria remontar o plano inteiro. */}
      {showPlanoEditor && (
        <PlanoMetasEditor
          plano={getPlanoVigente(planosMetas, planningPeriod)}
          periodoAtual={periodoAtual}
          getMonitors={getMonitors}
          getCollaborators={getCollaborators}
          onSalvar={async (plano: PlanoMetas) => { if (await handleSalvarPlano(plano)) setShowPlanoEditor(false); }}
          onFechar={() => setShowPlanoEditor(false)}
        />
      )}

      {/* MODAL: Adicionar Área */}
      {showAreaModal && (
        <AreaModal
          users={users}
          newArea={newArea}
          setNewArea={setNewArea}
          setShowAreaModal={setShowAreaModal}
          onSave={handleSaveArea}
        />
      )}

      {/* MODAL: Adicionar Colaborador */}
      {showCollaboratorModal && (
        <CollaboratorModal
          areas={areas}
          newCollaborator={newCollaborator}
          setNewCollaborator={setNewCollaborator}
          setShowCollaboratorModal={setShowCollaboratorModal}
          onSave={handleSaveCollaborator}
        />
      )}

    </div>
  );
}

// Guarda de migração do armazenamento local.
// Fica isolada num componente próprio para que o retorno antecipado não preceda a
// declaração dos hooks de AppContent — o que violava as Regras de Hooks do React e,
// na prática, impedia o lint de sinalizar regressões (F0-12).
// Comportamento preservado: enquanto a migração ocorre, AppContent não é montado e
// nenhum hook (nem os efeitos de persistência) chega a executar.
function App() {
  const isMigrating = React.useMemo(() => initializeDatabase(), []);

  if (isMigrating) return null;

  return <AppContent />;
}

export default App;
