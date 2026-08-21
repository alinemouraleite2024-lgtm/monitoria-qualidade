// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { pathToTab, PATH_LOGIN } from './routes/paths';
import type { FormEvent, ReactNode } from 'react';
import type {
  AnyRole, Area, Collaborator, Criterion, Monitoring,
} from './types/domain';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileSpreadsheet,
  Smile,
  HeartHandshake,
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
  Home,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  Zap,
  FileText
} from 'lucide-react';
// Os seeds de todas as coleções vivem em src/repositories (F0-12).

import {
  logAuthEvent,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  ROLES
} from './auth';

import { HOMOLOG_USERS } from './teamData';
import { USER_STATUS } from './constants/auth';
import { DATABASE_VERSION } from './config';

const initializeDatabase = () => {
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

import { UserManagement } from './modules/admin/UserManagement';
import { RolesManagement } from './modules/admin/RolesManagement';
import { AuditLogs } from './modules/admin/AuditLogs';
import { MyProfile } from './modules/profile/MyProfile';

import { MonitoringList } from './modules/monitoring/MonitoringList';
import { MonitoringForm } from './modules/monitoring/MonitoringForm';
import { MonitoringHistory } from './modules/monitoring/MonitoringHistory';

import { NotImplementedScreen } from './shared/components/NotImplementedScreen';
import { ReportsScreen } from './features/reports/ReportsScreen';
import { LoginScreen } from './features/auth/LoginScreen';
import { HomeAdmin } from './features/home/HomeAdmin';
import { HomeGestor } from './features/home/HomeGestor';
import { HomeMonitor } from './features/home/HomeMonitor';
import { PlanningScreen } from './features/planning/PlanningScreen';
import { AllocationsScreen } from './features/allocations/AllocationsScreen';
import { AdminScreen } from './features/admin/AdminScreen';
import { CriterionModal } from './features/admin/modals/CriterionModal';
import { UserModal } from './features/admin/modals/UserModal';
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
  holidaysRepository,
  demandsRepository,
  announcementsRepository,
  agendaRepository,
  catalogEmpreendimentosRepository,
  catalogCategoriasRepository,
  monitoringsRepository,
  sessionRepository,
} from './repositories';
import { UserAvatar } from './shared/components/UserAvatar';
import { getBusinessDaysRemaining } from './shared/utils/businessDays';
import { getActiveMonitorForColab as resolveActiveMonitorForColab } from './domain/allocationService';
import { isManagerRole as isManagerUser } from './domain/authorizationService';

// Simulated current system date
const SYSTEM_TODAY = '2026-06-05';



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
const MENU_CONFIG: MenuConfig = {
  ADMIN: [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
    { id: 'planning', label: 'Planejamento', icon: Layers },
    { id: 'monitorings', label: 'Monitorias', icon: FileSpreadsheet },
    { id: 'csat', label: 'CSAT', icon: Smile },
    { id: 'nps', label: 'NPS', icon: HeartHandshake },
    { id: 'allocations', label: 'Equipe', icon: Users },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'admin', label: 'Administração', icon: Settings },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck },
  ],
  GESTOR: [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
    { id: 'planning', label: 'Planejamento', icon: Layers },
    { id: 'monitorings', label: 'Monitorias', icon: FileSpreadsheet },
    { id: 'csat', label: 'CSAT', icon: Smile },
    { id: 'nps', label: 'NPS', icon: HeartHandshake },
    { id: 'allocations', label: 'Equipe', icon: Users },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'profile', label: 'Meu Perfil', icon: UserCheck },
  ],
  MONITOR: [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'monitorings', label: 'Monitorias', icon: FileSpreadsheet },
    { id: 'csat', label: 'CSAT', icon: Smile },
    { id: 'nps', label: 'NPS', icon: HeartHandshake },
    { id: 'reports', label: 'Relatórios', icon: FileText },
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
// 'csat' e 'nps' entram aqui como placeholder explicado por PLACEHOLDER_DESCRIPTIONS: estão
// no menu por decisão de produto, e não por já existirem.
//
// Saíram 'my-demands', 'surveys' e 'calendar' junto com suas rotas. O CalendarScreen continua
// no repositório, agora desligado — o débito 6 da Sprint 0 deixa de ser "implementado e
// inalcançável" e passa a ser "implementado e sem rota".
const UNIMPLEMENTED_TABS = ['settings', 'history', 'op-calendar', 'demands', 'integrations', 'csat', 'nps'];

// Envelope de rota. A decisão de acesso é do RouteGuard (F0-14); aqui resta apenas a
// precedência remanescente do dispatcher: autorizado -> "não implementado" -> tela.
const Screen = ({ tab, role, children }: { tab: string; role: AnyRole; children?: ReactNode }) => (
  <RouteGuard tab={tab} role={role}>
    {UNIMPLEMENTED_TABS.includes(tab)
      ? <NotImplementedScreen
          title={MENU_CONFIG[role]?.find((m) => m.id === tab)?.label}
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
  const [monitorGoals, setMonitorGoals] = useState(() => monitorGoalsRepository.load());
  const [colaboradorGoals, setColaboradorGoals] = useState(() => colaboradorGoalsRepository.load());
  // As migrações de dados legados (escala 0-10 -> 0-100 e Fluxo -> Processo) foram
  // transferidas para monitoringsRepository na F0-12, sem alteração de regra.
  const [monitorings, setMonitorings] = useState(() => monitoringsRepository.load());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [holidays, setHolidays] = useState(() => holidaysRepository.load());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [demands, setDemands] = useState(() => demandsRepository.load());

  const [catalogEmpreendimentos, setCatalogEmpreendimentos] = useState(
    () => catalogEmpreendimentosRepository.load()
  );

  const [catalogCategorias, setCatalogCategorias] = useState(
    () => catalogCategoriasRepository.load()
  );

  const handleAddEmpreendimento = (novo: string) => {
    const next = [...catalogEmpreendimentos, novo];
    setCatalogEmpreendimentos(next);
    catalogEmpreendimentosRepository.save(next);
  };

  const handleAddCategoria = (nova: string) => {
    const next = [...catalogCategorias, nova];
    setCatalogCategorias(next);
    catalogCategoriasRepository.save(next);
  };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [announcements, setAnnouncements] = useState(() => announcementsRepository.load());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [agenda, setAgenda] = useState(() => agendaRepository.load());


  const [currentUser, setCurrentUser] = useState(() => sessionRepository.load());

  // Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  // Intenção de retorno pós-login. Desligada no logout: sair de uma tela não deve fazer o
  // próximo login — possivelmente de outra pessoa — cair nela.
  const [captureIntent, setCaptureIntent] = useState(true);
  const [showDevTools, setShowDevTools] = useState(false);

  // F0-13: a URL é a fonte da verdade da navegação. `activeTab` deixou de ser estado e passou
  // a ser derivado do path — continua alimentando o destaque do menu (igualdade exata) e o
  // breadcrumb, com os mesmos valores de antes.
  const location = useLocation();
  const navigate = useNavigate();
  const { tab: routeTab, monitoringId: routeMonitoringId } = pathToTab(location.pathname);
  const activeTab = routeTab || '';
  const navigateToTab = (tab: string) => navigate(`/${tab}`);
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
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMonitoringDetail, setSelectedMonitoringDetail] = useState<Monitoring | null>(null);

  // Administration view sub-tabs
  const [adminSubTab, setAdminSubTab] = useState('criteria');

  // Form States (Admin & Management)
  const [selectedAllocationMonitor, setSelectedAllocationMonitor] = useState('usr-1');
  const [newAllocColaboradorId, setNewAllocColaboradorId] = useState('');
  const [newAllocStartDate, setNewAllocStartDate] = useState(SYSTEM_TODAY);
  const [newAllocEndDate, setNewAllocEndDate] = useState('');

 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [newHoliday, setNewHoliday] = useState({
    originalMonitorId: 'usr-1',
    substituteMonitorId: 'usr-2',
    startDate: SYSTEM_TODAY,
    endDate: '2026-06-12'
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
    minExpectedScore: number | string;
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
    minExpectedScore: 7.5,
    weight: 1.0,
    channels: ['Chat', 'WhatsApp'],
    active: true
  });

  const [newArea, setNewArea] = useState<Area>({ id: '', name: '', gestorId: '', monitorId: '', active: true });
  const [newCollaborator, setNewCollaborator] = useState<Collaborator>({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });

  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'MONITOR',
    team: ''
  });

  const [newMGoalVal, setNewMGoalVal] = useState({ monitorId: 'usr-1', targetQty: 30 });
  const [newCGoalVal, setNewCGoalVal] = useState({ monitorId: 'usr-1', colaboradorId: 'ag-1', targetQty: 5 });

  // Monitoring List Filters state
  const [historyFilters, /* setHistoryFilters */] = useState({
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    monitorId: 'ALL',
    areaId: 'ALL',
    colaboradorId: 'ALL',
    canal: 'ALL',
    status: 'ALL',
    scoreFilter: 'ALL'
  });

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
  // Fora do escopo desta etapa (Opção A): handleLogin e sessionRepository seguem resolvendo
  // contra HOMOLOG_USERS estático. Um usuário criado aqui, portanto, ainda não consegue entrar,
  // e o status BLOCKED não impede login. Ver docs/STATUS-SPRINT-0.md, seção 3-A.
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
  const getMonitors = () => users.filter(u => u.role === 'MONITOR' || u.role === 'GESTOR');
  const getCollaborators = () => collaborators;

  // Resolve o monitor responsável por um colaborador na data, delegando a regra de
  // vigência/substituição ao serviço de domínio (F0-12).
  const getActiveMonitorForColab = (colaboradorId: string, dateStr: string = SYSTEM_TODAY) =>
    resolveActiveMonitorForColab({ allocations, holidays, users }, colaboradorId, dateStr);

  // businessDaysTotal/Elapsed eram usados apenas por getInArrearsCount, removido na F0-12
  // por ser órfão. Mantido apenas o valor efetivamente consumido pelo Dashboard.
  const businessDaysRemaining = getBusinessDaysRemaining(2026, 5, SYSTEM_TODAY);

  // Authenticate homologation account
  //
  // F0-14: a autenticação continua sendo feita contra HOMOLOG_USERS estático — unificar login e
  // usersRepository segue fora de escopo. A única leitura do repositório aqui é o `status`, e
  // ela é obrigatória: o bloqueio é gravado em pm2_users pela tela de Usuários e nunca chega ao
  // array estático, de modo que checar user.status não barraria ninguém.
  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    const user = HOMOLOG_USERS.find(u => u.email.toLowerCase() === loginEmail.toLowerCase() && u.password === loginPassword);

    if (!user) {
      setLoginError('E-mail ou senha inválidos.');
      return;
    }

    // COLABORADOR não tem menu nem permissão de rota alguma: autenticá-lo produzia apenas um
    // shell vazio. Mensagem genérica, por decisão registrada.
    if (!MENU_CONFIG[user.role]) {
      logAuthEvent('LOGIN_DENIED', user, `Perfil ${user.role} não tem acesso à plataforma`);
      setLoginError('E-mail ou senha inválidos.');
      return;
    }

    const persistido = usersRepository.load().find(u => u.email === user.email);
    if ((persistido?.status || user.status) === USER_STATUS.BLOCKED) {
      logAuthEvent('LOGIN_DENIED', user, 'Usuário bloqueado');
      setLoginError('Usuário bloqueado. Procure o administrador do sistema.');
      return;
    }

    setCurrentUser(user);
    setCaptureIntent(true);
    sessionRepository.save(user);
    logAuthEvent('LOGIN', user);
    // Não navega aqui: o destino é resolvido pela rota /login da árvore autenticada, que lê
    // location.state.from. Navegar daqui competia com aquele redirecionamento e perdia.
  };

  const handleLogout = () => {
    if (currentUser) {
      logAuthEvent('LOGOUT', currentUser);
    }
    setCurrentUser(null);
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
    const isEdit = Boolean(monitoringData.id && monitorings.some(m => m.id === monitoringData.id));
    const { monitor } = getActiveMonitorForColab(monitoringData.colaboradorId, monitoringData.date);

    let resolvedStatus = monitoringData.status;
    if (resolvedStatus === 'Concluída') {
      if (!settings.requireGestorValidation || currentUser!.role === 'GESTOR' || currentUser!.role === 'ADMIN') {
        resolvedStatus = 'Validada';
      }
    }

    const monitoringObj = {
      ...monitoringData,
      monitorId: isEdit ? monitoringData.monitorId : (monitor ? monitor.id : currentUser!.id),
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
    if (!newAllocColaboradorId) {
      alert('Selecione um colaborador.');
      return;
    }

    const existingIndex = allocations.findIndex(
      a => a.colaboradorId === newAllocColaboradorId && a.active && (!a.endDate || new Date(SYSTEM_TODAY) <= new Date(a.endDate))
    );

    const updatedAllocations = [...allocations];
    const resolvedHistory = [...allocationHistory];

    if (existingIndex > -1) {
      const oldAlloc = updatedAllocations[existingIndex];
      oldAlloc.endDate = SYSTEM_TODAY;
      oldAlloc.active = false;

      resolvedHistory.push({
        id: `log-${Date.now()}-term`,
        allocationId: oldAlloc.id,
        actionType: 'TERMINATE',
        changedBy: currentUser!.id,
        changedAt: new Date().toISOString(),
        details: `Alocação do Colaborador ID ${newAllocColaboradorId} terminada em ${SYSTEM_TODAY}.`
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
    if (confirm('Deseja realmente encerrar a vigência desta alocação?')) {
      const updated = allocations.map(a => {
        if (a.id === allocId) {
          return { ...a, endDate: SYSTEM_TODAY, active: false };
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
          details: `Alocação de ${colName} terminada em ${SYSTEM_TODAY} por ação do Gestor.`
        }
      ]);
    }
  };

  // Dynamic Criteria Admin settings management
  const handleSaveCriterion = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCriterion.name) {
      alert('Nome do critério é obrigatório.');
      return;
    }

    if (newCriterion.id) {
      const updated = criteria.map(c => {
        if (c.id === newCriterion.id) {
          return {
            ...c,
            numero: newCriterion.numero ? parseInt(String(newCriterion.numero)) : null,
            category: newCriterion.category,
            name: newCriterion.name,
            description: newCriterion.description,
            orientacao: newCriterion.orientacao,
            tipoResposta: newCriterion.tipoResposta,
            eliminatorio: newCriterion.eliminatorio,
            minExpectedScore: parseFloat(String(newCriterion.minExpectedScore)),
            weight: parseFloat(String(newCriterion.weight)),
            channels: newCriterion.channels,
            active: newCriterion.active
          };
        }
        return c;
      });
      setCriteria(updated);
    } else {
      const newObj = {
        id: `crit-${Date.now()}`,
        numero: newCriterion.numero ? parseInt(String(newCriterion.numero)) : null,
        category: newCriterion.category,
        name: newCriterion.name,
        description: newCriterion.description,
        orientacao: newCriterion.orientacao,
        tipoResposta: newCriterion.tipoResposta,
        eliminatorio: newCriterion.eliminatorio,
        minExpectedScore: parseFloat(String(newCriterion.minExpectedScore)),
        weight: parseFloat(String(newCriterion.weight)),
        channels: newCriterion.channels,
        active: newCriterion.active
      };
      setCriteria([...criteria, newObj]);
    }
    setShowCriterionModal(false);
    setNewCriterion({ id: '', numero: '', category: '', name: '', description: '', orientacao: '', tipoResposta: 'ESCALA_4', eliminatorio: false, minExpectedScore: 7.5, weight: 1.0, channels: ['Chat', 'WhatsApp'], active: true });
  };

  const handleSaveArea = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newArea.name) return alert('Nome da área obrigatório.');
    if (newArea.id) {
      setAreas(areas.map(a => a.id === newArea.id ? newArea : a));
    } else {
      setAreas([...areas, { ...newArea, id: `area-${Date.now()}` }]);
    }
    setShowAreaModal(false);
    setNewArea({ id: '', name: '', gestorId: '', monitorId: '', active: true });
  };

  const handleSaveCollaborator = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCollaborator.name || !newCollaborator.areaId) return alert('Nome e Área são obrigatórios.');
    if (newCollaborator.id) {
      setCollaborators(collaborators.map(c => c.id === newCollaborator.id ? newCollaborator : c));
    } else {
      setCollaborators([...collaborators, { ...newCollaborator, id: `ag-${Date.now()}` }]);
    }
    setShowCollaboratorModal(false);
    setNewCollaborator({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });
  };

  // Two levels goals forms
  const handleUpdateMonitorGoal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const existingIndex = monitorGoals.findIndex(g => g.monitorId === newMGoalVal.monitorId && g.year === 2026 && g.month === 5);
    if (existingIndex > -1) {
      const updated = [...monitorGoals];
      updated[existingIndex].targetQty = parseInt(String(newMGoalVal.targetQty));
      setMonitorGoals(updated);
    } else {
      setMonitorGoals([...monitorGoals, {
        id: `mgoal-${Date.now()}`,
        monitorId: newMGoalVal.monitorId,
        year: 2026,
        month: 5,
        targetQty: parseInt(String(newMGoalVal.targetQty))
      }]);
    }
    alert('Meta de carteira do monitor atualizada com sucesso!');
  };

  const handleUpdateColabGoal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const existingIndex = colaboradorGoals.findIndex(
      g => g.monitorId === newCGoalVal.monitorId && g.colaboradorId === newCGoalVal.colaboradorId && g.year === 2026 && g.month === 5
    );
    if (existingIndex > -1) {
      const updated = [...colaboradorGoals];
      updated[existingIndex].targetQty = parseInt(String(newCGoalVal.targetQty));
      setColaboradorGoals(updated);
    } else {
      setColaboradorGoals([...colaboradorGoals, {
        id: `cgoal-${Date.now()}`,
        monitorId: newCGoalVal.monitorId,
        colaboradorId: newCGoalVal.colaboradorId,
        year: 2026,
        month: 5,
        targetQty: parseInt(String(newCGoalVal.targetQty))
      }]);
    }
    alert('Meta individual de colaborador atualizada com sucesso!');
  };

  // Aplica uma mutação a uma monitoria e mantém o painel de detalhe (que guarda um
  // snapshot próprio em selectedMonitoringDetail) sincronizado — sem isso, o gestor
  // aciona uma ação e o painel aberto continua exibindo o estado anterior.
  const updateMonitoringById = (monId: string, mutate: (m: Monitoring) => Monitoring) => {
    const updated = monitorings.map(m => (m.id === monId ? mutate(m) : m));
    setMonitorings(updated);
    setSelectedMonitoringDetail(prev => (prev && prev.id === monId ? (updated.find(m => m.id === monId) ?? null) : prev));
  };

  const isManagerRole = () => isManagerUser(currentUser);

  const handleApproveMonitoring = (monId: string) => {
    if (!isManagerRole()) return;
    updateMonitoringById(monId, m => ({
      ...m,
      status: 'Validada',
      approvedBy: currentUser!.id,
      approvedAt: new Date().toISOString()
    }));
  };

  const handleRejectMonitoring = (monId: string) => {
    if (!isManagerRole()) return;
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
    if (!isManagerRole()) return;
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
    if (!isManagerRole()) return;
    updateMonitoringById(monId, m => ({
      ...m,
      finalScore: 0,
      zerada: true,
      eliminatoryPending: false,
      eliminatoryConfirmedBy: currentUser!.id,
      eliminatoryConfirmedAt: new Date().toISOString()
    }));
  };

  const handleCancelMonitoring = (monId: string) => {
    if (confirm('Deseja realmente cancelar esta monitoria?')) {
      const updated = monitorings.map(m => {
        if (m.id === monId) return { ...m, status: 'Cancelada' as Monitoring['status'] };
        return m;
      });
      setMonitorings(updated);
    }
  };

  // Filter monitorings list for view
  const getFilteredMonitorings = () => {
    return monitorings.filter(m => {
      const monMatch = historyFilters.monitorId === 'ALL' || m.monitorId === historyFilters.monitorId;
      const colMatch = historyFilters.colaboradorId === 'ALL' || m.colaboradorId === historyFilters.colaboradorId;
      const canalMatch = historyFilters.canal === 'ALL' || m.canal === historyFilters.canal;
      const statusMatch = historyFilters.status === 'ALL' || m.status === historyFilters.status;

      let areaMatch = true;
      if (historyFilters.areaId && historyFilters.areaId !== 'ALL') {
        const colab = collaborators.find(c => c.id === m.colaboradorId);
        areaMatch = Boolean(colab && colab.areaId === historyFilters.areaId);
      }
      
      let scoreMatch = true;
      if (historyFilters.scoreFilter === 'LOW') {
        scoreMatch = m.finalScore < 75;
      } else if (historyFilters.scoreFilter === 'HIGH') {
        scoreMatch = m.finalScore >= 95;
      } else if (historyFilters.scoreFilter === 'MID') {
        scoreMatch = m.finalScore >= 75 && m.finalScore < 95;
      }

      const mDate = new Date(m.date);
      const filterStart = new Date(historyFilters.startDate + 'T00:00:00Z');
      const filterEnd = new Date(historyFilters.endDate + 'T23:59:59Z');
      const dateMatch = mDate >= filterStart && mDate <= filterEnd;

      return monMatch && colMatch && canalMatch && statusMatch && scoreMatch && dateMatch && areaMatch;
    });
  };

  // Calculations for Gestor Dashboard
  const getUnmonitoredCollaborators = () => {
    return getCollaborators().filter(c => {
      const monCount = monitorings.filter(m => {
        const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
        return m.colaboradorId === c.id && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
      }).length;
      return monCount === 0;
    });
  };

  // Calculate statistics per Monitor for Gestor dashboard V2
  const getMonitorStats = (monitorId: string) => {
    const mGoal = monitorGoals.find(g => g.monitorId === monitorId && g.year === 2026 && g.month === 5)?.targetQty || 0;
    const colabGoalsSum = colaboradorGoals.filter(g => g.monitorId === monitorId && g.year === 2026 && g.month === 5).reduce((sum, g) => sum + g.targetQty, 0);

    const completed = monitorings.filter(m => {
      const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
      return m.monitorId === monitorId && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
    }).length;

    const target = Math.max(mGoal, colabGoalsSum);
    const remaining = Math.max(0, target - completed);
    const pace = businessDaysRemaining > 0 ? (remaining / businessDaysRemaining).toFixed(1) : 0;

    return {
      mGoal,
      colabGoalsSum,
      target,
      completed,
      remaining,
      pace,
      progressPct: target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
    };
  };

  // Export handlers
  const handleExportExcel = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Data,Monitor,Colaborador,Canal,Tipo,Status,Nota Final,Comentarios\n';
    const filtered = getFilteredMonitorings();
    filtered.forEach(m => {
      const mon = users.find(u => u.id === m.monitorId)?.name || 'N/A';
      const col = users.find(u => u.id === m.colaboradorId)?.name || 'N/A';
      const formattedDate = new Date(m.date).toLocaleDateString('pt-BR');
      const cleanComments = (m.comments ?? '').replace(/"/g, '""');
      csvContent += `"${m.id}","${formattedDate}","${mon}","${col}","${m.canal}","${m.tipo}","${m.status}","${m.finalScore.toFixed(2)}%","${cleanComments}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_monitorias_v2_${SYSTEM_TODAY}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    const filtered = getFilteredMonitorings();
    let rowsHtml = '';
    filtered.forEach(m => {
      const mon = users.find(u => u.id === m.monitorId)?.name || 'N/A';
      const col = users.find(u => u.id === m.colaboradorId)?.name || 'N/A';
      rowsHtml += `
        <tr>
          <td>${new Date(m.date).toLocaleDateString('pt-BR')}</td>
          <td>${mon}</td>
          <td>${col}</td>
          <td>${m.canal} (${m.tipo})</td>
          <td>${m.status}</td>
          <td style="font-weight: bold; color: ${m.finalScore >= 95 ? '#008443' : m.finalScore >= 75 ? '#f59e0b' : '#ef4444'}">${m.finalScore.toFixed(2)}%</td>
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
          <div><strong>Branding:</strong> ${brand.name} | <strong>Emitido em:</strong> ${new Date(SYSTEM_TODAY).toLocaleDateString('pt-BR')}</div>
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
          activeTab={activeTab}
          onNavigate={navigateToTab}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          menuConfig={MENU_CONFIG}
          onLogout={handleLogout}
          renderUserAvatar={renderUserAvatar}
        >
          <Routes>

            <Route path="/" element={<Navigate to="/home" replace />} />

            {/* Já autenticado em /login: devolve à rota pretendida antes do login, quando houver.
                É também o passo final do fluxo de autenticação — ver handleLogin. */}
            <Route path={PATH_LOGIN} element={<Navigate to={location.state?.from || '/home'} replace />} />

            <Route path="/home" element={
              <Screen tab="home" role={currentUser.role}>
                  <div className="animate-fade-in">
                    {currentUser.role === 'ADMIN' && <HomeAdmin currentUser={currentUser} />}
                    {currentUser.role === 'GESTOR' && <HomeGestor currentUser={currentUser} demands={demands} users={users} />}
                    {currentUser.role === 'MONITOR' && <HomeMonitor currentUser={currentUser} demands={demands} monitorings={monitorings} collaborators={collaborators} onNavigate={navigateToTab} />}
                  </div>
              </Screen>
            } />

            <Route path="/dashboard" element={
              <Screen tab="dashboard" role={currentUser.role}>
                  <DashboardScreen
                    settings={settings}
                    areas={areas}
                    users={users}
                    colaboradorGoals={colaboradorGoals}
                    monitorings={monitorings}
                    currentUser={currentUser}
                    dashboardAreaId={dashboardAreaId}
                    setDashboardAreaId={setDashboardAreaId}
                    onNavigate={navigateToTab}
                    setShowDetailModal={setShowDetailModal}
                    setSelectedMonitoringDetail={setSelectedMonitoringDetail}
                    renderUserAvatar={renderUserAvatar}
                    getCollaborators={getCollaborators}
                    getMonitors={getMonitors}
                    getMonitorStats={getMonitorStats}
                    getActiveMonitorForColab={getActiveMonitorForColab}
                    getUnmonitoredCollaborators={getUnmonitoredCollaborators}
                    businessDaysRemaining={businessDaysRemaining}
                    SYSTEM_TODAY={SYSTEM_TODAY}
                  />
              </Screen>
            } />

            <Route path="/planning" element={
              <Screen tab="planning" role={currentUser.role}>
                  <PlanningScreen
                    users={users}
                    monitorings={monitorings}
                    colaboradorGoals={colaboradorGoals}
                    newMGoalVal={newMGoalVal}
                    setNewMGoalVal={setNewMGoalVal}
                    newCGoalVal={newCGoalVal}
                    setNewCGoalVal={setNewCGoalVal}
                    onUpdateMonitorGoal={handleUpdateMonitorGoal}
                    onUpdateColabGoal={handleUpdateColabGoal}
                    getMonitors={getMonitors}
                    getCollaborators={getCollaborators}
                    renderUserAvatar={renderUserAvatar}
                  />
              </Screen>
            } />

            <Route path="/monitorings" element={
              <Screen tab="monitorings" role={currentUser.role}>
                  <MonitoringList 
                    monitorings={monitorings}
                    users={users}
                    collaborators={getCollaborators()}
                    onNewMonitoring={() => navigate('/monitorings/new')}
                    onView={(m) => {
                      setSelectedMonitoringDetail(m);
                      setShowDetailModal(true);
                    }}
                    onEdit={(m) => navigate(`/monitorings/${m.id}/edit`)}
                    onDelete={handleCancelMonitoring}
                  />
              </Screen>
            } />

            <Route path="/monitorings/new" element={
              <Screen tab="monitoring-new" role={currentUser.role}>
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                    <MonitoringForm
                      initialData={editingMonitoring}
                      users={users}
                      collaborators={getCollaborators()}
                      criteria={criteria}
                      currentUser={currentUser}
                      catalogEmpreendimentos={catalogEmpreendimentos}
                      catalogCategorias={catalogCategorias}
                      onAddEmpreendimento={handleAddEmpreendimento}
                      onAddCategoria={handleAddCategoria}
                      onClose={() => navigate('/monitorings')}
                      onSave={handleSaveFormMonitoring}
                    />
                  </div>
              </Screen>
            } />

            <Route path="/monitorings/:id/edit" element={
              <Screen tab="monitoring-edit" role={currentUser.role}>
                {editingMonitoring ? (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                      <MonitoringForm
                        initialData={editingMonitoring}
                        users={users}
                        collaborators={getCollaborators()}
                        criteria={criteria}
                        currentUser={currentUser}
                        catalogEmpreendimentos={catalogEmpreendimentos}
                        catalogCategorias={catalogCategorias}
                        onAddEmpreendimento={handleAddEmpreendimento}
                        onAddCategoria={handleAddCategoria}
                        onClose={() => navigate('/monitorings')}
                        onSave={handleSaveFormMonitoring}
                      />
                    </div>
                ) : <NotFoundScreen />}
              </Screen>
            } />

            <Route path="/reports" element={
              <Screen tab="reports" role={currentUser.role}>
                  <ReportsScreen
                    onExportExcel={handleExportExcel}
                    onExportPDF={handleExportPDF}
                  />
              </Screen>
            } />

            <Route path="/allocations" element={
              <Screen tab="allocations" role={currentUser.role}>
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

            <Route path="/admin" element={
              <Screen tab="admin" role={currentUser.role}>
                  <AdminScreen
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
                    setShowUserModal={setShowUserModal}
                    setShowAreaModal={setShowAreaModal}
                    setShowCollaboratorModal={setShowCollaboratorModal}
                    renderUserAvatar={renderUserAvatar}
                  />
              </Screen>
            } />

            <Route path="/profile" element={<Screen tab="profile" role={currentUser.role}><MyProfile currentUser={currentUser} /></Screen>} />

            <Route path="/users" element={<Screen tab="users" role={currentUser.role}><UserManagement users={users} onUsersChange={setUsers} /></Screen>} />

            <Route path="/roles" element={<Screen tab="roles" role={currentUser.role}><RolesManagement /></Screen>} />

            <Route path="/audit-logs" element={<Screen tab="audit-logs" role={currentUser.role}><AuditLogs /></Screen>} />

            {/* Telas ainda não implementadas: Screen resolve para NotImplementedScreen,
                exatamente como a lista isUnimplemented fazia no dispatcher anterior. */}

            <Route path="/demands" element={<Screen tab="demands" role={currentUser.role} />} />

            <Route path="/csat" element={<Screen tab="csat" role={currentUser.role} />} />

            <Route path="/nps" element={<Screen tab="nps" role={currentUser.role} />} />

            <Route path="/integrations" element={<Screen tab="integrations" role={currentUser.role} />} />

            <Route path="/settings" element={<Screen tab="settings" role={currentUser.role} />} />

            <Route path="/history" element={<Screen tab="history" role={currentUser.role} />} />

            <Route path="/op-calendar" element={<Screen tab="op-calendar" role={currentUser.role} />} />

            <Route path="*" element={<NotFoundScreen />} />

          </Routes>
        </AppShell>
      )}

      {/* 3. WIZARDS AND MODALS IN V2 */}

      {/* MODALS */}


      {showDetailModal && selectedMonitoringDetail && (
        <MonitoringHistory
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

      {/* MODAL: Adicionar Usuário */}
      {showUserModal && (
        <UserModal
          users={users}
          setUsers={setUsers}
          newUser={newUser}
          setNewUser={setNewUser}
          setShowUserModal={setShowUserModal}
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
