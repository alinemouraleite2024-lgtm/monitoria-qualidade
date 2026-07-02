// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar as CalendarIcon,
  FileSpreadsheet,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
// eslint-disable-next-line no-unused-vars
  ArrowRight,
// eslint-disable-next-line no-unused-vars
  Settings,
  Download,
  LogOut,
// eslint-disable-next-line no-unused-vars
  ChevronLeft,
// eslint-disable-next-line no-unused-vars
  ChevronRight,
// eslint-disable-next-line no-unused-vars
  RefreshCw,
  Layers,
  ShieldAlert,
  Award,
  TrendingUp,
// eslint-disable-next-line no-unused-vars
  HelpCircle,
  Clock,
// eslint-disable-next-line no-unused-vars
  UserX,
// eslint-disable-next-line no-unused-vars
  Sparkles,
// eslint-disable-next-line no-unused-vars
  Info,
  Menu,
// eslint-disable-next-line no-unused-vars
  Check,
// eslint-disable-next-line no-unused-vars
  X,
  Plus,
// eslint-disable-next-line no-unused-vars
  Trash2,
  Edit,
// eslint-disable-next-line no-unused-vars
  Eye,
  Settings2,
  Home,
  Bell,
  Activity,
// eslint-disable-next-line no-unused-vars
  Zap,
  ClipboardList,
  BarChart3,
  FileText,
  Plug,
  Search
} from 'lucide-react';
import {
  DEFAULT_BRAND_CONFIG,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_AREAS,
  INITIAL_USERS,
  INITIAL_COLLABORATORS,
  INITIAL_CRITERIA,
  INITIAL_ALLOCATIONS,
  INITIAL_ALLOCATION_HISTORY,
  INITIAL_MONITOR_GOALS,
  INITIAL_COLABORADOR_GOALS,
  INITIAL_MONITORINGS,
  INITIAL_HOLIDAYS,
  INITIAL_DEMANDS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AGENDA
} from './mockData';

import {
  HOMOLOG_USERS,
  logAuthEvent,
  hasPermission,
// eslint-disable-next-line no-unused-vars
  ROLES
} from './auth';

import { UserManagement } from './modules/admin/UserManagement';
import { RolesManagement } from './modules/admin/RolesManagement';
import { AuditLogs } from './modules/admin/AuditLogs';
import { MyProfile } from './modules/profile/MyProfile';

import { MonitoringList } from './modules/monitoring/MonitoringList';
import { MonitoringForm } from './modules/monitoring/MonitoringForm';
import { MonitoringHistory } from './modules/monitoring/MonitoringHistory';

// Simulated current system date
const SYSTEM_TODAY = '2026-06-05';

const tabPermissionMap = {
  home: null,
  dashboard: 'VIEW_DASHBOARD',
  planning: 'VIEW_PLANNING',
  demands: 'VIEW_CENTRAL_DEMANDS',
  roles: 'VIEW_ROLES',
  'audit-logs': 'VIEW_AUDIT_LOGS',
  monitorings: 'VIEW_MONITORINGS',
  surveys: 'VIEW_SURVEYS',
  reports: 'VIEW_REPORTS',
  allocations: 'VIEW_COLLABORATORS',
  'my-demands': 'VIEW_MY_DEMANDS',
  calendar: 'VIEW_CALENDAR',
  'op-calendar': 'VIEW_OPERATIONAL_CALENDAR',
  profile: 'VIEW_MY_PROFILE',
  users: 'VIEW_USERS',
  admin: 'VIEW_ADMINISTRATION',
  settings: 'VIEW_SETTINGS',
  integrations: 'VIEW_INTEGRATIONS',
  history: 'VIEW_VERSION_HISTORY',
};

const NotImplementedScreen = ({ title }) => (
  <div className="animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed var(--border-color)', margin: '2rem' }}>
    <Settings2 size={64} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '1.5rem' }} />
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{title || 'Em Desenvolvimento'}</h2>
    <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
      Este módulo ainda não foi implementado. Estamos trabalhando para disponibilizar esta funcionalidade nas próximas atualizações da plataforma.
    </p>
  </div>
);

const AccessDeniedScreen = () => (
  <div className="animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', margin: '2rem' }}>
    <ShieldAlert size={64} style={{ color: 'var(--danger)', marginBottom: '1.5rem' }} />
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acesso Negado</h2>
    <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
      Você não possui permissão para acessar este módulo. Caso acredite que isto seja um erro, contate o administrador do sistema.
    </p>
  </div>
);

// eslint-disable-next-line no-unused-vars
const MyProfileScreen = ({ currentUser }) => (
  <div className="animate-fade-in" style={{ padding: '2rem' }}>
    <div className="page-header" style={{ marginBottom: '2rem' }}>
      <h1 className="page-title">Meu Perfil</h1>
      <p className="page-subtitle">Informações da sua conta (Sincronizado com Microsoft 365)</p>
    </div>
    
    <div className="section-card" style={{ maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          backgroundColor: 'var(--primary)', 
          color: 'white', 
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          fontWeight: 'bold'
        }}>
          {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{currentUser.name}</h2>
          <span className="badge-pill badge-primary">{currentUser.role}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>E-mail</span>
          <span style={{ color: 'var(--text-main)' }}>{currentUser.email}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Cargo</span>
          <span style={{ color: 'var(--text-main)' }}>{currentUser.cargo || 'Não especificado'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Área</span>
          <span style={{ color: 'var(--text-main)' }}>{currentUser.area || 'Não especificada'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', paddingBottom: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Integração</span>
          <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
             Conta pronta para M365 <CheckCircle2 size={16} />
          </span>
        </div>
      </div>
    </div>
  </div>
);

// --- HOME COMPONENTS PER PROFILE --- //
// eslint-disable-next-line no-unused-vars
const HomeAdmin = ({ currentUser }) => (
  <div className="animate-fade-in" style={{ padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Centro de Operações (Admin)
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Visão geral de saúde do sistema e integrações.</p>
      </div>
    </div>
    
    <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Usuários Ativos</div>
          <Users size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>24</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>+3</span> esta semana</div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Integrações</div>
          <Plug size={20} style={{ color: 'var(--info)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>3</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Microsoft, Slack, ERP</span></div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Versão Atual</div>
          <Settings2 size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>v2.0.0</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Ambiente de Homologação</span></div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Status do Sistema</div>
          <CheckCircle2 size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginTop: '0.5rem' }}>Operacional</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Uptime 99.9%</span></div>
      </div>
    </div>

    <div className="grid-cols-2">
      <div className="section-card">
        <h2 className="section-card-title"><ShieldAlert size={18} /> Alertas de Segurança & Logs</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px' }}>
            <div style={{ fontWeight: '600', color: '#ca8a04', marginBottom: '0.25rem' }}>Tentativa de Acesso Inválido</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>IP 192.168.1.100 tentou acessar /admin há 2 horas.</div>
          </div>
          <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Backup Automático Concluído</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sincronização com o Azure finalizada com sucesso.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// eslint-disable-next-line no-unused-vars
const HomeGestor = ({ currentUser, demands, users }) => (
  <div className="animate-fade-in" style={{ padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Gestão Operacional (Gestor)
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Acompanhe sua equipe e aprovações pendentes.</p>
      </div>
    </div>

    <div className="grid-cols-3" style={{ marginBottom: '2rem' }}>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Monitorias da Equipe</div>
          <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>18</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>5 pendentes</span> de validação</div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Demandas Críticas</div>
          <AlertCircle size={20} style={{ color: 'var(--danger)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>
          {demands.filter(d => d.priority === 'Alta' && d.status !== 'Concluída').length}
        </div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Na central de demandas</span></div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Membros da Equipe</div>
          <Users size={20} style={{ color: 'var(--info)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>
          {users.filter(u => u.role === 'MONITOR').length}
        </div>
        <div className="executive-card-meta"><span style={{ color: 'var(--primary)' }}>Todos ativos</span></div>
      </div>
    </div>
    
    <div className="grid-2-1">
      <div className="section-card">
        <h2 className="section-card-title"><Clock size={18} /> Próximas Aprovações (Mock)</h2>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="executive-card" style={{ padding: '1rem', flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600' }}>Revisão de Monitoria - Atendente Allanis</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Solicitado por Nathalia - Prazo: Hoje</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Recusar</button>
              <button className="btn btn-primary btn-sm">Aprovar</button>
            </div>
          </div>
          <div className="executive-card" style={{ padding: '1rem', flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600' }}>Nova Demanda: Ajuste de Script</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Solicitado por Aline - Prazo: Amanhã</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>Recusar</button>
              <button className="btn btn-primary btn-sm">Aprovar</button>
            </div>
          </div>
        </div>
      </div>
      <div className="section-card">
        <h2 className="section-card-title"><CalendarIcon size={18} /> Calendário Rápido</h2>
        <div style={{ marginTop: '1rem', height: '200px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
          Nenhum evento agendado para hoje.
        </div>
      </div>
    </div>
  </div>
);

const HomeMonitor = ({ currentUser, agenda, demands, monitorings, collaborators, setActiveTab }) => {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Calculations
  const myMonitorings = monitorings.filter(m => m.monitorId === currentUser.id);
  const currentMonth = new Date().getMonth();
  const monthMonitorings = myMonitorings.filter(m => new Date(m.date).getMonth() === currentMonth);
  const avgScore = monthMonitorings.length > 0 
    ? monthMonitorings.reduce((acc, m) => acc + m.finalScore, 0) / monthMonitorings.length 
    : 0;

  const getScoreConcept = (score) => {
    if (score >= 95) return 'Excelente';
    if (score >= 85) return 'Muito Bom';
    if (score >= 75) return 'Bom';
    if (score >= 50) return 'Atenção';
    return 'Crítico';
  };

  const pendingDemands = demands.filter(d => d.assigneeId === currentUser.id && d.status !== 'Concluída');
  const criticalDemandsCount = pendingDemands.filter(d => d.priority === 'Alta').length;

  const lastMonitorings = [...myMonitorings].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  return (
    <div className="animate-fade-in" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 1. Intelligent Greeting */}
      <div style={{ backgroundColor: 'var(--primary)', color: '#fff', padding: '1.5rem 2rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '0.5rem' }}>{greeting}, {currentUser.name.split(' ')[0]}! 👋</h1>
          <p style={{ fontSize: '1rem', opacity: 0.9 }}>Hoje é {todayStr}.</p>
        </div>
        <div style={{ textAlign: 'right', opacity: 0.9, fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div><strong>{agenda.length}</strong> compromissos na agenda</div>
          <div><strong>{pendingDemands.length}</strong> pendências no total</div>
          <div><strong>{criticalDemandsCount > 0 ? criticalDemandsCount : 'nenhuma'}</strong> demanda crítica</div>
        </div>
      </div>

      {/* 2. Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="executive-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Monitorias no Mês</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>{monthMonitorings.length}</div>
        </div>
        <div className="executive-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--secondary)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Nota Média</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>{avgScore.toFixed(2)}%</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>{getScoreConcept(avgScore)}</span>
          </div>
        </div>
        <div className="executive-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pendências</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>{pendingDemands.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aguardando ação</div>
        </div>
        <div className="executive-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Produtividade</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>95%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dentro do SLA</div>
        </div>
      </div>

      {/* Grid Layout Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Coluna Esquerda/Centro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Atalhos Rápidos */}
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <button className="btn btn-primary" onClick={() => setActiveTab('monitorias')}><PlusCircle size={16} /> Nova Monitoria</button>
            <button className="btn btn-outline" onClick={() => setActiveTab('monitorias')}><Search size={16} /> Pesquisar</button>
            <button className="btn btn-outline" onClick={() => setActiveTab('reports')}><BarChart3 size={16} /> Relatórios</button>
            <button className="btn btn-outline" onClick={() => setActiveTab('my-profile')}><UserCheck size={16} /> Meu Perfil</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Agenda do Dia */}
            <div className="section-card" style={{ padding: '1.25rem' }}>
              <h2 className="section-card-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}><CalendarIcon size={16} /> Agenda do Dia</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {agenda.length > 0 ? agenda.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        {new Date(item.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} - {item.title}
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>Iniciar</button>
                  </div>
                )) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Sem agenda para hoje.</div>
                )}
              </div>
            </div>

            {/* Demandas Prioritárias */}
            <div className="section-card" style={{ padding: '1.25rem' }}>
              <h2 className="section-card-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}><ClipboardList size={16} /> Demandas Prioritárias</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingDemands.length > 0 ? pendingDemands.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <input type="checkbox" style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }} />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>{d.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prazo: {new Date(d.dueDate).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Tudo limpo por aqui! 🎉</div>
                )}
              </div>
            </div>
          </div>

          {/* Últimas Monitorias */}
          <div className="section-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="section-card-title" style={{ fontSize: '1rem', margin: 0 }}><Activity size={16} /> Últimas Monitorias</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('monitorias')}>Ver todas</button>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cód</th>
                    <th>Colaborador</th>
                    <th>Canal</th>
                    <th>Nota</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lastMonitorings.map(m => {
                    const col = collaborators.find(c => c.id === m.colaboradorId);
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--primary)' }}>{m.id}</td>
                        <td style={{ fontSize: '0.85rem' }}>{col ? col.name : m.colaboradorId}</td>
                        <td><span className="badge-pill badge-info">{m.canal}</span></td>
                        <td style={{ fontWeight: '700', color: m.finalScore >= 75 ? 'var(--primary)' : 'var(--danger)' }}>{m.finalScore.toFixed(2)}%</td>
                        <td><button className="btn btn-outline btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Visualizar</button></td>
                      </tr>
                    )
                  })}
                  {lastMonitorings.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma monitoria recente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Coluna Direita */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Meu Desempenho */}
          <div className="section-card" style={{ padding: '1.25rem' }}>
            <h2 className="section-card-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}><TrendingUp size={16} /> Meu Desempenho</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Média dos últimos meses</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '120px', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              {/* Mock de 6 meses */}
              {[80, 85, 92, 88, 95, 98].map((val, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{ width: '100%', backgroundColor: 'var(--primary)', height: `${val}%`, borderRadius: '4px 4px 0 0', opacity: idx === 5 ? 1 : 0.6 }}></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((mes, idx) => (
                <div key={idx} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: idx === 5 ? '700' : '500' }}>{mes}</div>
              ))}
            </div>
          </div>

          {/* Avisos da Equipe */}
          <div className="section-card" style={{ padding: '1.25rem' }}>
            <h2 className="section-card-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}><Bell size={16} /> Avisos da Equipe</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1d4ed8' }}>📢 Calibração dia 05/07</div>
                <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>Link enviado no e-mail corporativo.</div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '8px', borderLeft: '3px solid #22c55e' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#15803d' }}>📢 Manual Atualizado</div>
                <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.25rem' }}>Procedimentos de contingência revistos.</div>
              </div>
              <div style={{ padding: '0.75rem', backgroundColor: '#fefce8', borderRadius: '8px', borderLeft: '3px solid #eab308' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#a16207' }}>📢 Nova Campanha de Retenção</div>
                <div style={{ fontSize: '0.75rem', color: '#eab308', marginTop: '0.25rem' }}>Atentar-se ao script promocional de julho.</div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

function App() {
  // Brand Configuration & System settings
  useEffect(() => {
    if (!localStorage.getItem('pm2_data_v5')) {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('pm2_data_v5', 'true');
      window.location.reload();
    }
  }, []);
  const [brand, setBrand] = useState(() => {
    const saved = localStorage.getItem('pm2_brand');
    return saved ? JSON.parse(saved) : DEFAULT_BRAND_CONFIG;
  });
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('pm2_settings');
    return saved ? JSON.parse(saved) : INITIAL_SYSTEM_SETTINGS;
  });

  // State Management representing local database V2
  const [areas, setAreas] = useState(() => {
    const saved = localStorage.getItem('pm2_areas');
    return saved ? JSON.parse(saved) : INITIAL_AREAS;
  });
  const [collaborators, setCollaborators] = useState(() => {
    const saved = localStorage.getItem('pm2_collaborators');
    return saved ? JSON.parse(saved) : INITIAL_COLLABORATORS;
  });
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('pm2_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });
  const [criteria, setCriteria] = useState(() => {
    const saved = localStorage.getItem('pm2_criteria');
    return saved ? JSON.parse(saved) : INITIAL_CRITERIA;
  });
  const [allocations, setAllocations] = useState(() => {
    const saved = localStorage.getItem('pm2_allocations');
    return saved ? JSON.parse(saved) : INITIAL_ALLOCATIONS;
  });
  const [allocationHistory, setAllocationHistory] = useState(() => {
    const saved = localStorage.getItem('pm2_alloc_history');
    return saved ? JSON.parse(saved) : INITIAL_ALLOCATION_HISTORY;
  });
  const [monitorGoals, setMonitorGoals] = useState(() => {
    const saved = localStorage.getItem('pm2_mgoals');
    return saved ? JSON.parse(saved) : INITIAL_MONITOR_GOALS;
  });
  const [colaboradorGoals, setColaboradorGoals] = useState(() => {
    const saved = localStorage.getItem('pm2_cgoals');
    return saved ? JSON.parse(saved) : INITIAL_COLABORADOR_GOALS;
  });
  const [monitorings, setMonitorings] = useState(() => {
    const saved = localStorage.getItem('pm2_monitorings');
    if (saved) {
      let parsed = JSON.parse(saved);
      if (parsed.some(m => m.finalScore <= 10 && m.finalScore > 0)) {
        parsed = parsed.map(m => {
          if (m.finalScore <= 10) {
            m.finalScore = m.finalScore * 10;
            if (m.scores) {
              m.scores = m.scores.map(s => ({ ...s, score: s.score <= 10 ? s.score * 10 : s.score }));
            }
          }
          return m;
        });
        localStorage.setItem('pm2_monitorings', JSON.stringify(parsed));
      }
      return parsed;
    }
    return INITIAL_MONITORINGS;
  });
// eslint-disable-next-line no-unused-vars
  const [holidays, setHolidays] = useState(() => {
    const saved = localStorage.getItem('pm2_holidays');
    return saved ? JSON.parse(saved) : INITIAL_HOLIDAYS;
  });
// eslint-disable-next-line no-unused-vars
  const [demands, setDemands] = useState(() => {
    const saved = localStorage.getItem('pm2_demands');
    return saved ? JSON.parse(saved) : INITIAL_DEMANDS;
  });
// eslint-disable-next-line no-unused-vars
  const [announcements, setAnnouncements] = useState(() => {
    const saved = localStorage.getItem('pm2_announcements');
    return saved ? JSON.parse(saved) : INITIAL_ANNOUNCEMENTS;
  });
// eslint-disable-next-line no-unused-vars
  const [agenda, setAgenda] = useState(() => {
    const saved = localStorage.getItem('pm2_agenda');
    return saved ? JSON.parse(saved) : INITIAL_AGENDA;
  });

  // Configuração Dinâmica de Menu por Perfil (Sprint 1)
  const MENU_CONFIG = {
    ADMIN: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
      { id: 'planning', label: 'Planejamento', icon: Layers },
      { id: 'demands', label: 'Central de Demandas', icon: ClipboardList },
      { id: 'monitorings', label: 'Monitorias', icon: FileSpreadsheet },
      { id: 'surveys', label: 'Pesquisas', icon: BarChart3 },
      { id: 'reports', label: 'Relatórios', icon: FileText },
      { id: 'allocations', label: 'Colaboradores', icon: Users },
      { id: 'users', label: 'Usuários', icon: UserCheck },
      { id: 'roles', label: 'Perfis e Permissões', icon: ShieldAlert },
      { id: 'audit-logs', label: 'Logs de Acesso', icon: Activity },
      { id: 'settings', label: 'Configurações', icon: Settings2 },
      { id: 'integrations', label: 'Integrações', icon: Plug },
      { id: 'history', label: 'Histórico de Versões', icon: Clock },
    ],
    GESTOR: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
      { id: 'planning', label: 'Planejamento', icon: Layers },
      { id: 'demands', label: 'Central de Demandas', icon: ClipboardList },
      { id: 'monitorings', label: 'Monitorias', icon: FileSpreadsheet },
      { id: 'surveys', label: 'Pesquisas', icon: BarChart3 },
      { id: 'reports', label: 'Relatórios', icon: FileText },
      { id: 'allocations', label: 'Colaboradores', icon: Users },
      { id: 'op-calendar', label: 'Calendário Operacional', icon: CalendarIcon },
    ],
    MONITOR: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'my-demands', label: 'Minhas Demandas', icon: ClipboardList },
      { id: 'monitorings', label: 'Minhas Monitorias', icon: FileSpreadsheet },
      { id: 'surveys', label: 'Pesquisas', icon: BarChart3 },
      { id: 'calendar', label: 'Calendário', icon: CalendarIcon },
      { id: 'reports', label: 'Relatórios', icon: FileText },
      { id: 'profile', label: 'Meu Perfil', icon: UserCheck },
    ],
  };

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pm2_auth_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      const user = HOMOLOG_USERS.find(u => u.email === parsed.email);
      return user || null;
    }
    return null;
  });

  // Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showDevTools, setShowDevTools] = useState(false);

  const [activeTab, setActiveTab] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardAreaId, setDashboardAreaId] = useState('ALL');

  // Modals & Dynamic Wizards
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [editingMonitoring, setEditingMonitoring] = useState(null);
 
// eslint-disable-next-line no-unused-vars
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMonitoringDetail, setSelectedMonitoringDetail] = useState(null);

  // Administration view sub-tabs
  const [adminSubTab, setAdminSubTab] = useState('criteria');

  // Form States (Admin & Management)
  const [selectedAllocationMonitor, setSelectedAllocationMonitor] = useState('usr-1');
  const [newAllocColaboradorId, setNewAllocColaboradorId] = useState('');
  const [newAllocStartDate, setNewAllocStartDate] = useState(SYSTEM_TODAY);
  const [newAllocEndDate, setNewAllocEndDate] = useState('');

 
// eslint-disable-next-line no-unused-vars
  const [newHoliday, setNewHoliday] = useState({
    originalMonitorId: 'usr-1',
    substituteMonitorId: 'usr-2',
    startDate: SYSTEM_TODAY,
    endDate: '2026-06-12'
  });

  const [newCriterion, setNewCriterion] = useState({
    id: '',
    name: '',
    description: '',
    minExpectedScore: 7.5,
    weight: 1.0,
    channels: ['Chat', 'WhatsApp'],
    active: true
  });

  const [newArea, setNewArea] = useState({ id: '', name: '', gestorId: '', monitorId: '', active: true });
  const [newCollaborator, setNewCollaborator] = useState({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });

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

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('pm2_brand', JSON.stringify(brand));
    localStorage.setItem('pm2_settings', JSON.stringify(settings));
    localStorage.setItem('pm2_areas', JSON.stringify(areas));
    localStorage.setItem('pm2_collaborators', JSON.stringify(collaborators));
    localStorage.setItem('pm2_users', JSON.stringify(users));
    localStorage.setItem('pm2_criteria', JSON.stringify(criteria));
    localStorage.setItem('pm2_allocations', JSON.stringify(allocations));
    localStorage.setItem('pm2_alloc_history', JSON.stringify(allocationHistory));
    localStorage.setItem('pm2_mgoals', JSON.stringify(monitorGoals));
    localStorage.setItem('pm2_cgoals', JSON.stringify(colaboradorGoals));
    localStorage.setItem('pm2_monitorings', JSON.stringify(monitorings));
    localStorage.setItem('pm2_holidays', JSON.stringify(holidays));
    localStorage.setItem('pm2_demands', JSON.stringify(demands));
    localStorage.setItem('pm2_announcements', JSON.stringify(announcements));
    localStorage.setItem('pm2_agenda', JSON.stringify(agenda));
  }, [brand, settings, areas, collaborators, users, criteria, allocations, allocationHistory, monitorGoals, colaboradorGoals, monitorings, holidays, demands, announcements, agenda]);

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

  // Check active allocations for a specific date (validity check)
  const isAllocationActiveForDate = (alloc, dateStr) => {
    const target = new Date(dateStr);
    const start = new Date(alloc.startDate);
    const end = alloc.endDate ? new Date(alloc.endDate) : null;
    
    return alloc.active && target >= start && (!end || target <= end);
  };

  // Get active monitor for a collaborator at a specific date, resolving holiday substitution
  const getActiveMonitorForColab = (colaboradorId, dateStr = SYSTEM_TODAY) => {
    const alloc = allocations.find(a => a.colaboradorId === colaboradorId && isAllocationActiveForDate(a, dateStr));
    if (!alloc) return { monitor: null, isSubstitute: false, originalMonitor: null };

    const targetDate = new Date(dateStr);
    const holidaySub = holidays.find(h => {
      if (!h.isActive) return false;
      const start = new Date(h.startDate);
      const end = new Date(h.endDate);
      return h.originalMonitorId === alloc.monitorId && targetDate >= start && targetDate <= end;
    });

    if (holidaySub) {
      const substitute = users.find(u => u.id === holidaySub.substituteMonitorId);
      const original = users.find(u => u.id === alloc.monitorId);
      return { monitor: substitute, isSubstitute: true, originalMonitor: original };
    }

    const monitor = users.find(u => u.id === alloc.monitorId);
    return { monitor, isSubstitute: false, originalMonitor: null };
  };

  // Business day helpers (June 2026)
  const getBusinessDaysInMonth = (year, month) => {
    let count = 0;
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  };

  const getBusinessDaysRemaining = (year, month, currentDayStr) => {
    const today = new Date(currentDayStr);
    let count = 0;
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    while (date.getMonth() === month) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  };

  const businessDaysTotal = getBusinessDaysInMonth(2026, 5); // June 2026
  const businessDaysRemaining = getBusinessDaysRemaining(2026, 5, SYSTEM_TODAY);
  const businessDaysElapsed = Math.max(0, businessDaysTotal - businessDaysRemaining);

  // Authenticate homologation account
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const user = HOMOLOG_USERS.find(u => u.email.toLowerCase() === loginEmail.toLowerCase() && u.password === loginPassword);
    
    if (user) {
      setCurrentUser(user);
      setActiveTab('home');
      localStorage.setItem('pm2_auth_session', JSON.stringify({ email: user.email, role: user.role }));
      logAuthEvent('LOGIN', user);
    } else {
      setLoginError('E-mail ou senha inválidos.');
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      logAuthEvent('LOGOUT', currentUser);
    }
    setCurrentUser(null);
    localStorage.removeItem('pm2_auth_session');
    setLoginEmail('');
    setLoginPassword('');
  };

  // Get active criteria list filtered by channel
  const getCriteriaForChannel = (channel) => {
    return criteria.filter(c => c.active && c.channels.includes(channel));
  };

  // Create or save monitoring form entry
  const handleSaveFormMonitoring = (formData, formScores) => {
    const { monitor } = getActiveMonitorForColab(formData.colaboradorId, formData.date);

    let resolvedStatus = formData.status;
    if (resolvedStatus === 'Concluída') {
      if (!settings.requireGestorValidation || currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') {
        resolvedStatus = 'Validada';
      }
    }

    const applicable = getCriteriaForChannel(formData.canal);
    let weightedSum = 0;
    let weightTotal = 0;
    applicable.forEach(c => {
      const item = formScores[c.id];
      const val = item ? parseFloat(item.score) : 10;
      weightedSum += val * c.weight;
      weightTotal += c.weight;
    });
    const finalCalculated = weightTotal > 0 ? parseFloat((weightedSum / weightTotal).toFixed(2)) : 0;

    const monitoringObj = {
      ...formData,
      id: formData.id || `mon-${Date.now()}`,
      monitorId: monitor && !formData.id ? monitor.id : (formData.id ? formData.monitorId : currentUser.id),
      status: resolvedStatus,
      date: new Date(formData.date).toISOString(),
      finalScore: finalCalculated,
      scores: Object.keys(formScores).map(cid => ({
        criterionId: cid,
        score: parseFloat(formScores[cid].score),
        lowScoreReason: formScores[cid].lowScoreReason
      }))
    };

    if (formData.id) {
      setMonitorings(monitorings.map(m => m.id === formData.id ? monitoringObj : m));
    } else {
      setMonitorings([monitoringObj, ...monitorings]);
    }
    
    setShowWizardModal(false);
    setEditingMonitoring(null);
  };

  // Handle allocations adjustments (Vigência V2)
  const handleCreateAllocation = (e) => {
    e.preventDefault();
    if (!newAllocColaboradorId) {
      alert('Selecione um colaborador.');
      return;
    }

    const existingIndex = allocations.findIndex(
      a => a.colaboradorId === newAllocColaboradorId && a.active && (!a.endDate || new Date(SYSTEM_TODAY) <= new Date(a.endDate))
    );

    let updatedAllocations = [...allocations];
    let resolvedHistory = [...allocationHistory];

    if (existingIndex > -1) {
      const oldAlloc = updatedAllocations[existingIndex];
      oldAlloc.endDate = SYSTEM_TODAY;
      oldAlloc.active = false;

      resolvedHistory.push({
        id: `log-${Date.now()}-term`,
        allocationId: oldAlloc.id,
        actionType: 'TERMINATE',
        changedBy: currentUser.id,
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
      changedBy: currentUser.id,
      changedAt: new Date().toISOString(),
      details: `${users.find(u => u.id === newAllocColaboradorId)?.name} alocado(a) para ${users.find(u => u.id === selectedAllocationMonitor)?.name}. Vigência: ${newAllocStartDate} a ${newAllocEndDate || 'indeterminado'}.`
    });

    setAllocations(updatedAllocations);
    setAllocationHistory(resolvedHistory);
    
    setNewAllocColaboradorId('');
    setNewAllocEndDate('');
  };

  const handleTerminateAllocation = (allocId) => {
    if (confirm('Deseja realmente encerrar a vigência desta alocação?')) {
      const updated = allocations.map(a => {
        if (a.id === allocId) {
          return { ...a, endDate: SYSTEM_TODAY, active: false };
        }
        return a;
      });

      const alloc = allocations.find(a => a.id === allocId);
      const colName = users.find(u => u.id === alloc.colaboradorId)?.name;

      setAllocations(updated);
      setAllocationHistory([
        ...allocationHistory,
        {
          id: `log-${Date.now()}-term-man`,
          allocationId: allocId,
          actionType: 'TERMINATE',
          changedBy: currentUser.id,
          changedAt: new Date().toISOString(),
          details: `Alocação de ${colName} terminada em ${SYSTEM_TODAY} por ação do Gestor.`
        }
      ]);
    }
  };

  // Dynamic Criteria Admin settings management
  const handleSaveCriterion = (e) => {
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
            name: newCriterion.name,
            description: newCriterion.description,
            minExpectedScore: parseFloat(newCriterion.minExpectedScore),
            weight: parseFloat(newCriterion.weight),
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
        name: newCriterion.name,
        description: newCriterion.description,
        minExpectedScore: parseFloat(newCriterion.minExpectedScore),
        weight: parseFloat(newCriterion.weight),
        channels: newCriterion.channels,
        active: newCriterion.active
      };
      setCriteria([...criteria, newObj]);
    }
    setShowCriterionModal(false);
    setNewCriterion({ id: '', name: '', description: '', minExpectedScore: 7.5, weight: 1.0, channels: ['Chat', 'WhatsApp'], active: true });
  };

  const handleSaveArea = (e) => {
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

  const handleSaveCollaborator = (e) => {
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
  const handleUpdateMonitorGoal = (e) => {
    e.preventDefault();
    const existingIndex = monitorGoals.findIndex(g => g.monitorId === newMGoalVal.monitorId && g.year === 2026 && g.month === 5);
    if (existingIndex > -1) {
      const updated = [...monitorGoals];
      updated[existingIndex].targetQty = parseInt(newMGoalVal.targetQty);
      setMonitorGoals(updated);
    } else {
      setMonitorGoals([...monitorGoals, {
        id: `mgoal-${Date.now()}`,
        monitorId: newMGoalVal.monitorId,
        year: 2026,
        month: 5,
        targetQty: parseInt(newMGoalVal.targetQty)
      }]);
    }
    alert('Meta de carteira do monitor atualizada com sucesso!');
  };

  const handleUpdateColabGoal = (e) => {
    e.preventDefault();
    const existingIndex = colaboradorGoals.findIndex(
      g => g.monitorId === newCGoalVal.monitorId && g.colaboradorId === newCGoalVal.colaboradorId && g.year === 2026 && g.month === 5
    );
    if (existingIndex > -1) {
      const updated = [...colaboradorGoals];
      updated[existingIndex].targetQty = parseInt(newCGoalVal.targetQty);
      setColaboradorGoals(updated);
    } else {
      setColaboradorGoals([...colaboradorGoals, {
        id: `cgoal-${Date.now()}`,
        monitorId: newCGoalVal.monitorId,
        colaboradorId: newCGoalVal.colaboradorId,
        year: 2026,
        month: 5,
        targetQty: parseInt(newCGoalVal.targetQty)
      }]);
    }
    alert('Meta individual de colaborador atualizada com sucesso!');
  };

  const handleApproveMonitoring = (monId) => {
    const updated = monitorings.map(m => {
      if (m.id === monId) return { ...m, status: 'Validada' };
      return m;
    });
    setMonitorings(updated);
  };

  const handleCancelMonitoring = (monId) => {
    if (confirm('Deseja realmente cancelar esta monitoria?')) {
      const updated = monitorings.map(m => {
        if (m.id === monId) return { ...m, status: 'Cancelada' };
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
        areaMatch = colab && colab.areaId === historyFilters.areaId;
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
// eslint-disable-next-line no-unused-vars
  const getCoveragePercentage = () => {
    const totalCols = getCollaborators().length;
    if (totalCols === 0) return 0;

    const monitoredThisMonthCount = getCollaborators().filter(c => {
      const monCount = monitorings.filter(m => {
        const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
        return m.colaboradorId === c.id && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
      }).length;
      return monCount > 0;
    }).length;

    return Math.round((monitoredThisMonthCount / totalCols) * 100);
  };

  const getUnmonitoredCollaborators = () => {
    return getCollaborators().filter(c => {
      const monCount = monitorings.filter(m => {
        const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
        return m.colaboradorId === c.id && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
      }).length;
      return monCount === 0;
    });
  };

  // Monitorias em Atraso (Delays count)
// eslint-disable-next-line no-unused-vars
  const getInArrearsCount = () => {
    let arrearsCount = 0;
    const progressProportion = businessDaysElapsed / businessDaysTotal;

    colaboradorGoals.forEach(g => {
      const completed = monitorings.filter(m => {
        const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
        return m.monitorId === g.monitorId && m.colaboradorId === g.colaboradorId && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
      }).length;

      const expected = Math.floor(g.targetQty * progressProportion);
      if (completed < expected) {
        arrearsCount += (expected - completed);
      }
    });

    return arrearsCount;
  };

  // Calculate statistics per Monitor for Gestor dashboard V2
  const getMonitorStats = (monitorId) => {
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
      const cleanComments = m.comments.replace(/"/g, '""');
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

    printWindow.document.write(`
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
    printWindow.document.close();
  };

  // Helper to draw user initials inside a circular badge with consistent palette color
  const renderUserAvatar = (name) => {
    if (!name) return null;
    const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('');
    const colors = [
      'hsl(151, 80%, 25%)', // Primary green
      'hsl(160, 84%, 39%)', // Accent mint
      'hsl(210, 100%, 40%)', // Blue
      'hsl(280, 75%, 45%)', // Purple
      'hsl(36, 100%, 40%)', // Amber
      'hsl(350, 80%, 50%)', // Red
    ];
    // Simple hash to select color
    const colorIndex = Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;
    const resolvedColor = colors[colorIndex];

    return (
      <div className="avatar-circle" style={{ backgroundColor: resolvedColor }}>
        {initials}
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* 1. SSO LOGIN */}
      {!currentUser && (
        <div className="login-container" style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="login-card animate-scale-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '420px', backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ 
                height: '60px', 
                width: '60px', 
                backgroundColor: 'rgba(0,132,67,0.08)', 
                color: 'var(--primary)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '1.75rem',
                fontWeight: 'bold'
              }}>
                ML
              </div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                Plataforma de Gestão da Qualidade
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>v2.0.0</span>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04', borderRadius: '12px', fontWeight: '500' }}>Ambiente de Homologação</span>
              </div>
            </div>

            {loginError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={16} />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Usuário</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="Seu e-mail de acesso..."
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Senha</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.95rem' }}>
                Entrar
              </button>
            </form>

            <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OU</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            </div>

            <button type="button" className="microsoft-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => alert('Integração com Microsoft 365 em desenvolvimento.')}>
              <div className="microsoft-icon">
                <div className="ms-block ms-r"></div>
                <div className="ms-block ms-g"></div>
                <div className="ms-block ms-b"></div>
                <div className="ms-block ms-y"></div>
              </div>
              Entrar com Microsoft
            </button>


            <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                <Clock size={14} />
                <span>Simulação Comercial: 05 de Junho, 2026</span>
              </div>
              
              {/* Dev Tools Toggle */}
              <div style={{ marginTop: '1rem' }}>
                <button 
                  onClick={() => setShowDevTools(!showDevTools)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                >
                  {showDevTools ? 'Esconder Ferramentas Dev' : 'Ferramentas Dev (Mock Login)'}
                </button>
              </div>

              {showDevTools && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('admin@homolog.local'); setLoginPassword('Admin@123'); }}>Preencher Admin</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('raquel@homolog.local'); setLoginPassword('Gestor@123'); }}>Preencher Gestor (Raquel)</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('aline@homolog.local'); setLoginPassword('Monitor@123'); }}>Preencher Monitor (Aline)</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. AUTHENTICATED SaaS LAYOUT */}
      {currentUser && (
        <div className="layout-wrapper">
          
          {/* Collapsible Left Sidebar */}
          <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
              <a href="#" className="sidebar-brand" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>
                <img src={brand.logoUrl} className="sidebar-logo" alt={brand.name} />
                <span className="sidebar-title sidebar-brand-text" style={{ marginLeft: '0.5rem' }}>{brand.name}</span>
              </a>
              <button className="btn-toggle-sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                <Menu size={16} />
              </button>
            </div>

            <nav className="sidebar-menu">
              {MENU_CONFIG[currentUser.role]?.map((item) => {
                const Icon = item.icon;
                return (
                  <a 
                    key={item.id}
                    href="#" 
                    className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); setActiveTab(item.id); }}
                  >
                    <Icon size={18} />
                    <span className="sidebar-link-text">{item.label}</span>
                  </a>
                );
              })}
            </nav>

            <div className="sidebar-footer">
              <div className="sidebar-user">
                {!sidebarCollapsed && (
                  <div className="sidebar-user-details">
                    <span className="sidebar-user-name">{currentUser.name}</span>
                    <span className="sidebar-user-role">{currentUser.role}</span>
                  </div>
                )}
                <button className="btn-sidebar-logout" onClick={handleLogout} title="Sair">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </aside>

          {/* Main workspace layout */}
          <div className="app-container">
            
            <header className="app-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div className="breadcrumb">
                  <span className="breadcrumb-item">Workspace</span>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span className="breadcrumb-item active">
                    {MENU_CONFIG[currentUser.role]?.find(m => m.id === activeTab)?.label || 'Dashboard'}
                  </span>
                </div>
              </div>

              <div className="global-search" style={{ margin: '0 auto', maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <input type="text" placeholder="Pesquisar em toda a plataforma (Ctrl+K)..." disabled />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative' }}>
                  <Bell size={20} />
                  <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', backgroundColor: 'var(--danger)', borderRadius: '50%' }}></span>
                </button>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer'
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.2' }}>{currentUser.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '600' }}>{currentUser.role}</div>
                  </div>
                  {renderUserAvatar(currentUser.name)}
                </div>
              </div>
            </header>

            <main className="main-content">
              {(() => {
                const reqPerm = tabPermissionMap[activeTab];
                if (reqPerm && !hasPermission(currentUser.role, reqPerm)) {
                  return <AccessDeniedScreen />;
                }
                
                const isUnimplemented = ['settings', 'history', 'op-calendar', 'demands', 'my-demands', 'surveys', 'integrations', 'calendar'].includes(activeTab);
                
                if (activeTab === 'profile') {
                  return <MyProfile currentUser={currentUser} />;
                }
                
                if (activeTab === 'users') {
                  return <UserManagement currentUser={currentUser} />;
                }
                
                if (activeTab === 'roles') {
                  return <RolesManagement />;
                }
                
                if (activeTab === 'audit-logs') {
                  return <AuditLogs />;
                }
                
                if (isUnimplemented) {
                  const menuLabel = MENU_CONFIG[currentUser.role]?.find(m => m.id === activeTab)?.label;
                  return <NotImplementedScreen title={menuLabel} />;
                }

                return (
                  <>
              {/* TAB: INÍCIO (HOME HUB V2) */}
              {activeTab === 'home' && (
                <div className="animate-fade-in">
                  {currentUser.role === 'ADMIN' && <HomeAdmin currentUser={currentUser} />}
                  {currentUser.role === 'GESTOR' && <HomeGestor currentUser={currentUser} demands={demands} users={users} />}
                  {currentUser.role === 'MONITOR' && <HomeMonitor currentUser={currentUser} agenda={agenda} demands={demands} monitorings={monitorings} collaborators={collaborators} setActiveTab={setActiveTab} />}
                </div>
              )}

              {/* TAB: DEMANDAS (Central de Demandas) */}
              {activeTab === 'demands' && (
                <div className="animate-fade-in" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ClipboardList size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h2 style={{ fontFamily: 'var(--font-heading)' }}>Central de Demandas</h2>
                  <p>Funcionalidade de Gestão de Demandas prevista para as próximas Sprints.</p>
                </div>
              )}

              {/* TAB: MINHAS DEMANDAS */}
              {activeTab === 'my-demands' && (
                <div className="animate-fade-in" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ClipboardList size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h2 style={{ fontFamily: 'var(--font-heading)' }}>Minhas Demandas</h2>
                  <p>Suas pendências e filas estarão disponíveis aqui na próxima Sprint.</p>
                </div>
              )}

              {/* TAB: PESQUISAS */}
              {activeTab === 'surveys' && (
                <div className="animate-fade-in" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <BarChart3 size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h2 style={{ fontFamily: 'var(--font-heading)' }}>Módulo de Pesquisas</h2>
                  <p>Criação e acompanhamento de formulários previsto para a próxima Sprint.</p>
                </div>
              )}

              {/* TAB: INTEGRAÇÕES */}
              {activeTab === 'integrations' && (
                <div className="animate-fade-in" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Plug size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h2 style={{ fontFamily: 'var(--font-heading)' }}>Hub de Integrações</h2>
                  <p>Módulo de configuração de APIs REST e Webhooks previsto para as próximas Sprints.</p>
                </div>
              )}

              {/* TAB: MEU PERFIL */}
              {activeTab === 'profile' && (
                <div className="animate-fade-in" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <UserCheck size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <h2 style={{ fontFamily: 'var(--font-heading)' }}>Meu Perfil</h2>
                  <p>Configurações da sua conta Microsoft 365 e preferências de notificação.</p>
                </div>
              )}

              {/* TAB: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="animate-fade-in">
                  <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h1 className="page-title">
                        {currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN' ? 'Dashboard Executivo de Qualidade' : 'Painel Operacional do Monitor'}
                      </h1>
                      <p className="page-subtitle">Acompanhe a produtividade, cumprimento de metas e o fluxo das avaliações mensais.</p>
                    </div>
                    { (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Filtrar por Área:</label>
                        <select 
                          className="form-control"
                          value={dashboardAreaId}
                          onChange={(e) => setDashboardAreaId(e.target.value)}
                          style={{ width: 'auto', minWidth: '200px' }}
                        >
                          <option value="ALL">Visão Global (Todas)</option>
                          {areas.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Approval Queue Slider Notification */}
                  {settings.requireGestorValidation && (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && monitorings.some(m => m.status === 'Concluída') && (
                    <div className="section-card animate-fade-in" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--primary-light)' }}>
                      <h3 className="section-card-title" style={{ color: 'var(--primary)', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={18} /> Há avaliações pendentes de validação operacional!
                        </span>
                        <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('monitorings')} style={{ padding: '0.25rem 0.75rem' }}>
                          Ver Fila de Validação
                        </button>
                      </h3>
                    </div>
                  )}

                  {(() => {
                    // Common data fetch
                    const isGestor = currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN';
                    
                    // Calculate KPIs
                    let totalRealizadas = 0;
                    let totalMeta = 0;
                    let unmonitoredCount = 0;
                    let pace = 0;
                    
                    if (isGestor) {
                      // Gestor stats across all monitors, filtered by area if selected
                      let allMonitors = getMonitors().filter(m => m.role === 'MONITOR');
                      if (dashboardAreaId !== 'ALL') {
                        const area = areas.find(a => a.id === dashboardAreaId);
                        if (area && area.monitorId) {
                          allMonitors = allMonitors.filter(m => m.id === area.monitorId);
                        }
                      }
                      
                      allMonitors.forEach(m => {
                        const s = getMonitorStats(m.id);
                        totalRealizadas += s.completed;
                        totalMeta += s.target;
                      });
                      
                      let colabs = getUnmonitoredCollaborators();
                      if (dashboardAreaId !== 'ALL') {
                        colabs = colabs.filter(c => c.areaId === dashboardAreaId);
                      }
                      unmonitoredCount = colabs.length;
                      pace = Math.ceil((totalMeta - totalRealizadas) / Math.max(businessDaysRemaining, 1));
                    } else {
                      const stats = getMonitorStats(currentUser.id);
                      totalRealizadas = stats.completed;
                      totalMeta = stats.target;
                      // Monitor's unmonitored colabs
                      const myColabs = getCollaborators().filter(c => {
                        const { monitor } = getActiveMonitorForColab(c.id, SYSTEM_TODAY);
                        return monitor && monitor.id === currentUser.id;
                      });
                      const myUnmonitored = myColabs.filter(c => {
                        const done = monitorings.filter(m => m.colaboradorId === c.id && m.monitorId === currentUser.id && new Date(m.date).getMonth() === 5 && (m.status === 'Validada' || m.status === 'Concluída'));
                        return done.length === 0;
                      });
// eslint-disable-next-line no-unused-vars
                      unmonitoredCount = myUnmonitored.length;
                      pace = stats.pace;
                    }
                    
                    const pendentes = Math.max(0, totalMeta - totalRealizadas);
                    const cobertura = totalMeta > 0 ? Math.min(100, Math.round((totalRealizadas / totalMeta) * 100)) : 0;
                    
                    // 1. KPI Cards Row
                    return (
                      <div className="dashboard-main">
                        <div className="kpi-grid-5">
                          <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="card-horiz-info">
                                <span className="card-horiz-title">Realizadas</span>
                                <span className="card-horiz-value">{totalRealizadas}</span>
                              </div>
                              <div className="card-horiz-icon success"><CheckCircle2 size={18} /></div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                <span>{totalRealizadas} / {totalMeta} concluídas</span>
                                <span>{cobertura}%</span>
                              </div>
                              <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                                <div className="progress-fill" style={{ width: `${cobertura}%`, backgroundColor: 'var(--success)' }} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="card-horiz-info">
                                <span className="card-horiz-title">Meta Mensal</span>
                                <span className="card-horiz-value">{totalMeta}</span>
                              </div>
                              <div className="card-horiz-icon info"><TrendingUp size={18} /></div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                              Projeção de meta do ciclo.
                            </div>
                          </div>
                          
                          <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="card-horiz-info">
                                <span className="card-horiz-title">Pendentes</span>
                                <span className="card-horiz-value">{pendentes}</span>
                              </div>
                              <div className="card-horiz-icon warning"><AlertTriangle size={18} /></div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                <span>Restantes no mês</span>
                                <span>{100 - cobertura}%</span>
                              </div>
                              <div className="progress-container" style={{ margin: 0, height: '4px' }}>
                                <div className="progress-fill" style={{ width: `${100 - cobertura}%`, backgroundColor: 'var(--warning)' }} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="card-horiz-info">
                                <span className="card-horiz-title">Ritmo Diário</span>
                                <span className="card-horiz-value">{pace}/dia</span>
                              </div>
                              <div className="card-horiz-icon primary"><Clock size={18} /></div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                              Para bater a meta no prazo.
                            </div>
                          </div>
                          
                          <div className="card-horizontal" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="card-horiz-info">
                                <span className="card-horiz-title">Cobertura</span>
                                <span className="card-horiz-value">{cobertura}%</span>
                              </div>
                              <div className="card-horiz-icon primary"><Layers size={18} /></div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                              Progresso total da equipe.
                            </div>
                          </div>
                        </div>

                        {/* 2. Multipanel Split Screen */}
                        <div className="dashboard-split">
                          
                          {/* Left Column (Charts and Table) */}
                          <div className="dashboard-main">
                            
                            <div className="charts-row">
                              {/* Evolução Mensal Line Area Chart */}
                              <div className="section-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 className="section-card-title"><TrendingUp size={18} /> Evolução Mensal</h2>
                                <div style={{ flex: 1, position: 'relative', height: '180px', marginTop: '1rem' }}>
                                  <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
                                    <defs>
                                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                      </linearGradient>
                                    </defs>
                                    <path d="M 0,90 Q 50,40 100,50 T 200,20 T 300,30 L 300,100 L 0,100 Z" fill="url(#areaGradient)" />
                                    <path d="M 0,90 Q 50,40 100,50 T 200,20 T 300,30" fill="none" stroke="var(--primary)" strokeWidth="3" />
                                    <circle cx="200" cy="20" r="4" fill="var(--primary)" stroke="#fff" strokeWidth="2" />
                                    <circle cx="300" cy="30" r="4" fill="var(--primary)" stroke="#fff" strokeWidth="2" />
                                  </svg>
                                </div>
                              </div>
                              
                              {/* Cumprimento Meta Horizontal Stacked Chart */}
                              <div className="section-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 className="section-card-title"><Award size={18} /> Progresso x Meta Total</h2>
                                <div style={{ flex: 1, marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div>
                                      <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{totalRealizadas}</div>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Monitorias Concluídas</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'var(--font-heading)' }}>{totalMeta}</div>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Meta do Ciclo</div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div style={{ width: '100%', height: '24px', backgroundColor: 'var(--bg-hover)', borderRadius: '12px', overflow: 'hidden', display: 'flex' }}>
                                      <div style={{ width: `${cobertura}%`, backgroundColor: 'var(--primary)', height: '100%', transition: 'width 1s ease' }}></div>
                                      <div style={{ width: `${100 - cobertura}%`, backgroundColor: 'var(--warning-light)', height: '100%', transition: 'width 1s ease' }}></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: '600' }}>
                                      <span style={{ color: 'var(--primary)' }}>{cobertura}% Atingido</span>
                                      <span style={{ color: 'var(--warning-dark)' }}>{pendentes} Faltantes</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Tabela de Planejamento */}
                            <div className="section-card">
                              <h2 className="section-card-title">
                                <FileSpreadsheet size={18} /> Planejamento do Mês
                              </h2>
                              <div className="table-responsive">
                                <table className="table-premium">
                                  <thead>
                                    <tr>
                                      <th>{isGestor ? 'Monitor' : 'Colaborador'}</th>
                                      <th>Meta</th>
                                      <th>Realizadas</th>
                                      <th>Pendentes</th>
                                      <th>Progresso</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {isGestor ? (
                                      getMonitors().filter(m => m.role === 'MONITOR').map(monitor => {
                                        const s = getMonitorStats(monitor.id);
                                        return (
                                          <tr key={monitor.id}>
                                            <td>
                                              <div className="user-cell-wrapper">
                                                {renderUserAvatar(monitor.name)}
                                                <span style={{ fontWeight: '600' }}>{monitor.name}</span>
                                              </div>
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>{s.target}</td>
                                            <td style={{ fontWeight: 'bold' }}>{s.completed}</td>
                                            <td>{Math.max(0, s.target - s.completed)}</td>
                                            <td>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div className="progress-container" style={{ width: '80px', margin: 0, height: '5px' }}>
                                                  <div className="progress-fill" style={{ width: `${s.progressPct}%`, backgroundColor: 'var(--primary)' }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{s.progressPct}%</span>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      getCollaborators().filter(c => {
                                        const { monitor } = getActiveMonitorForColab(c.id, SYSTEM_TODAY);
                                        return monitor && monitor.id === currentUser.id;
                                      }).map(c => {
                                        const completed = monitorings.filter(m => m.colaboradorId === c.id && m.monitorId === currentUser.id && new Date(m.date).getMonth() === 5 && (m.status === 'Validada' || m.status === 'Concluída')).length;
                                        const goalVal = colaboradorGoals.find(g => g.monitorId === currentUser.id && g.colaboradorId === c.id && g.year === 2026 && g.month === 5)?.targetQty || 5;
                                        const prog = Math.min(100, Math.round((completed / goalVal) * 100));
                                        return (
                                          <tr key={c.id}>
                                            <td>
                                              <div className="user-cell-wrapper">
                                                {renderUserAvatar(c.name)}
                                                <span style={{ fontWeight: '600' }}>{c.name}</span>
                                              </div>
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>{goalVal}</td>
                                            <td style={{ fontWeight: 'bold' }}>{completed}</td>
                                            <td>{Math.max(0, goalVal - completed)}</td>
                                            <td>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div className="progress-container" style={{ width: '80px', margin: 0, height: '4px' }}>
                                                  <div className="progress-fill" style={{ width: `${prog}%`, backgroundColor: prog >= 100 ? '#10b981' : 'var(--primary)' }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{prog}%</span>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                          </div>

                          {/* Right Column (Timeline) */}
                          <div className="dashboard-sidebar">
                            <div className="section-card" style={{ flex: 1 }}>
                              <h2 className="section-card-title">
                                <Clock size={18} /> Últimas Monitorias
                              </h2>
                              
                              <ul className="timeline-root" style={{ marginTop: '1.5rem' }}>
                                {(() => {
                                  let recentMon = isGestor 
                                    ? [...monitorings]
                                    : monitorings.filter(m => m.monitorId === currentUser.id);
                                  recentMon.sort((a,b) => new Date(b.date) - new Date(a.date));
                                  
                                  if (recentMon.length === 0) {
                                    return <li style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sem atividades recentes.</li>;
                                  }
                                  
                                  return recentMon.slice(0, 5).map(m => {
                                    const colName = users.find(u => u.id === m.colaboradorId)?.name || 'N/A';
                                    const isHigh = m.finalScore >= 95;
                                    const isLow = m.finalScore < 75;
                                    const nodeClass = isHigh ? 'success' : (isLow ? 'danger' : 'warning');
                                    
                                    return (
                                      <li key={m.id} className="timeline-item">
                                        <div className={`timeline-node ${nodeClass}`}></div>
                                        <div className="timeline-content" style={{ cursor: 'pointer' }} onClick={() => {
                                          setSelectedMonitoringDetail(m);
                                          setShowDetailModal(true);
                                        }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{colName}</div>
                                            <div style={{ fontWeight: '800', color: isHigh ? 'var(--primary)' : (isLow ? 'var(--danger)' : 'var(--warning)') }}>
                                              {m.finalScore.toFixed(2)}%
                                            </div>
                                          </div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Status: <strong style={{ color: 'var(--text-main)' }}>{m.status}</strong> • Canal: {m.canal}
                                          </div>
                                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            {new Date(m.date).toLocaleString('pt-BR')}
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  });
                                })()}
                              </ul>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB: PLANEJAMENTO MENSAL */}
              {activeTab === 'planning' && (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && (
                <div className="animate-fade-in">
                  <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h1 className="page-title">Planejamento e Metas Operacionais</h1>
                      <p className="page-subtitle">Configure as metas globais dos monitores e os volumes individuais dos colaboradores.</p>
                    </div>
                  </div>

                  <div className="allocation-manager-grid">
                    
                    {/* Goal configurations */}
                    <div className="section-card">
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                        Configurar Metas de Carteira
                      </h3>

                      <form onSubmit={handleUpdateMonitorGoal} style={{ marginBottom: '2rem' }}>
                        <div className="form-group">
                          <label className="form-label">Monitor Avaliador</label>
                          <select 
                            className="form-control"
                            value={newMGoalVal.monitorId}
                            onChange={(e) => setNewMGoalVal({ ...newMGoalVal, monitorId: e.target.value })}
                          >
                            {getMonitors().filter(m => m.role === 'MONITOR').map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Meta Global (Volume Mensal)</label>
                          <input 
                            type="number" 
                            className="form-control"
                            value={newMGoalVal.targetQty}
                            onChange={(e) => setNewMGoalVal({ ...newMGoalVal, targetQty: e.target.value })}
                            min="1"
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Atualizar Meta Carteira
                        </button>
                      </form>

                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', margin: '2rem 0 1.25rem', fontWeight: 'bold', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        Configurar Metas Individuais (Colaborador)
                      </h3>

                      <form onSubmit={handleUpdateColabGoal}>
                        <div className="form-group">
                          <label className="form-label">Monitor Responsável</label>
                          <select 
                            className="form-control"
                            value={newCGoalVal.monitorId}
                            onChange={(e) => setNewCGoalVal({ ...newCGoalVal, monitorId: e.target.value })}
                          >
                            {getMonitors().filter(m => m.role === 'MONITOR').map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Colaborador</label>
                          <select 
                            className="form-control"
                            value={newCGoalVal.colaboradorId}
                            onChange={(e) => setNewCGoalVal({ ...newCGoalVal, colaboradorId: e.target.value })}
                          >
                            {getCollaborators().map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Volume de Monitorias Exigido</label>
                          <input 
                            type="number" 
                            className="form-control"
                            value={newCGoalVal.targetQty}
                            onChange={(e) => setNewCGoalVal({ ...newCGoalVal, targetQty: e.target.value })}
                            min="1"
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Atualizar Meta Colaborador
                        </button>
                      </form>
                    </div>

                    {/* Meta list panel */}
                    <div className="section-card">
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                        Quadro de Metas Ativo (Junho/2026)
                      </h3>

                      <div className="table-responsive">
                        <table className="table-premium">
                          <thead>
                            <tr>
                              <th>Monitor</th>
                              <th>Colaborador</th>
                              <th>Meta</th>
                              <th>Realizadas</th>
                              <th>Pendentes</th>
                              <th>Progresso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {colaboradorGoals.map(goal => {
                              const mon = users.find(u => u.id === goal.monitorId)?.name || 'N/A';
                              const col = users.find(u => u.id === goal.colaboradorId)?.name || 'N/A';

                              const completed = monitorings.filter(m => {
                                const isThisMonth = new Date(m.date).getMonth() === 5 && new Date(m.date).getFullYear() === 2026;
                                return m.monitorId === goal.monitorId && m.colaboradorId === goal.colaboradorId && isThisMonth && (m.status === 'Validada' || m.status === 'Concluída');
                              }).length;

                              return (
                                <tr key={goal.id}>
                                  <td>
                                    <div className="user-cell-wrapper">
                                      {renderUserAvatar(mon)}
                                      <span>{mon}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="user-cell-wrapper">
                                      {renderUserAvatar(col)}
                                      <span>{col}</span>
                                    </div>
                                  </td>
                                  <td style={{ fontWeight: 'bold' }}>{goal.targetQty}</td>
                                  <td style={{ fontWeight: 'bold' }}>{completed}</td>
                                  <td>{Math.max(0, goal.targetQty - completed)}</td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div className="progress-container" style={{ width: '80px', margin: 0, height: '4px' }}>
                                        <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((completed/goal.targetQty)*100))}%`, backgroundColor: completed >= goal.targetQty ? '#10b981' : 'var(--primary)' }} />
                                      </div>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>{Math.min(100, Math.round((completed/goal.targetQty)*100))}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB: CALENDÁRIO OPERACIONAL */}
              {activeTab === 'calendar' && (
                <div className="animate-fade-in">
                  <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h1 className="page-title">Cronograma Operacional de Avaliações</h1>
                      <p className="page-subtitle">Acompanhe a distribuição linear e ritmo de trabalho diário das metas.</p>
                    </div>
                  </div>

                  <div className="calendar-wrapper">
                    <div className="calendar-header-actions" style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', fontWeight: '800' }}>Junho 2026</span>
                      
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '3px' }}></span>
                          Meta Cumprida
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '3px' }}></span>
                          Pendente
                        </span>
                      </div>
                    </div>

                    <div className="calendar-grid-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <div>D</div>
                      <div>S</div>
                      <div>T</div>
                      <div>Q</div>
                      <div>Q</div>
                      <div>S</div>
                      <div>S</div>
                    </div>

                    <div className="calendar-grid-body">
                      {/* 31 May */}
                      <div className="calendar-day-cell other-month">
                        <span className="calendar-day-number">31</span>
                        <span style={{ fontSize: '0.6rem', color: '#ccc' }}>Maio</span>
                      </div>

                      {/* June Days 1 to 30 */}
                      {Array.from({ length: 30 }).map((_, i) => {
                        const dayNum = i + 1;
                        const dayOfWeek = (dayNum) % 7;
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                        const dayMonitorings = monitorings.filter(m => {
                          const mDate = new Date(m.date);
                          return m.monitorId === currentUser.id && 
                                 mDate.getFullYear() === 2026 && 
                                 mDate.getMonth() === 5 && 
                                 mDate.getDate() === dayNum && 
                                 (m.status === 'Validada' || m.status === 'Concluída');
                        });

                        let bgClass = '';
                        if (isWeekend) {
                          bgClass = 'other-month';
                        } else if (dayMonitorings.length > 0) {
                          bgClass = 'success-day';
                        } else if (dayNum < 5) {
                          bgClass = 'danger-day';
                        } else {
                          bgClass = 'warning-day';
                        }

                        return (
                          <div key={dayNum} className={`calendar-day-cell ${bgClass}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="calendar-day-number">{dayNum}</span>
                              {dayNum === 5 && (
                                <span style={{ fontSize: '0.55rem', padding: '1px 3px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '3px', fontWeight: 'bold' }}>
                                  HOJE
                                </span>
                              )}
                            </div>

                            <div className="calendar-day-data" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '0.25rem' }}>
                              {dayMonitorings.map(dm => {
                                const initials = users.find(u => u.id === dm.colaboradorId)?.name.split(' ').map(n => n[0]).join('') || 'N/A';
                                return (
                                  <span key={dm.id} className="calendar-mini-badge" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                                    {initials}: {dm.finalScore.toFixed(2)}%
                                  </span>
                                );
                              })}
                              {!isWeekend && dayMonitorings.length === 0 && (
                                <span className="calendar-mini-badge" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: MONITORIAS (Central de Monitorias) */}
              {activeTab === 'monitorings' && (
                <MonitoringList 
                  monitorings={monitorings}
                  users={users}
                  collaborators={getCollaborators()}
                  onNewMonitoring={() => {
                    setEditingMonitoring(null);
                    setShowWizardModal(true);
                  }}
                  onView={(m) => {
                    setSelectedMonitoringDetail(m);
                    setShowDetailModal(true);
                  }}
                  onEdit={(m) => {
                    setEditingMonitoring(m);
                    setShowWizardModal(true);
                  }}
                  onDelete={handleCancelMonitoring}
                />
              )}

              {/* TAB: RELATÓRIOS */}
              {activeTab === 'reports' && (
                <div className="animate-fade-in">
                  <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h1 className="page-title">Relatórios e Exportações de Qualidade</h1>
                      <p className="page-subtitle">Gere relatórios formatados em PDF ou exporte planilhas Excel.</p>
                    </div>
                  </div>

                  <div className="tab-row">
                    <button className="tab-btn active">Relatórios Rápidos</button>
                    <button className="tab-btn" onClick={() => alert('Disponível na V3 do Portal de Monitoria.')}>
                      Relatórios Executivos (Futuro)
                    </button>
                  </div>

                  <div className="section-card">
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                      Gerar Documento Consolidado
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      O relatório respeitará os filtros dinâmicos selecionados na aba **Monitorias**.
                    </p>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button className="btn btn-secondary" onClick={handleExportExcel}>
                        <FileSpreadsheet size={16} style={{ color: 'var(--primary)' }} /> Exportar Planilha Excel (CSV)
                      </button>
                      <button className="btn btn-primary" onClick={handleExportPDF}>
                        <Download size={16} /> Exportar Relatório em PDF
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: COLABORADORES (Vigência alocações V2) */}
              {activeTab === 'allocations' && (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && (
                <div className="animate-fade-in">
                  <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h1 className="page-title">Vigência de Carteira e Alocações</h1>
                      <p className="page-subtitle">Configure o vínculo operacional temporário entre monitores e agentes.</p>
                    </div>
                  </div>

                  <div className="allocation-manager-grid">
                    
                    {/* Allocation creation panel */}
                    <div className="section-card">
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                        Vincular Carteira com Vigência
                      </h3>

                      <form onSubmit={handleCreateAllocation}>
                        <div className="form-group">
                          <label className="form-label">Monitor Responsável</label>
                          <select 
                            className="form-control"
                            value={selectedAllocationMonitor}
                            onChange={(e) => setSelectedAllocationMonitor(e.target.value)}
                          >
                            {getMonitors().filter(m => m.role === 'MONITOR').map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Colaborador (Agente)</label>
                          <select 
                            className="form-control"
                            value={newAllocColaboradorId}
                            onChange={(e) => setNewAllocColaboradorId(e.target.value)}
                            required
                          >
                            <option value="">Selecione...</option>
                            {getCollaborators().map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label className="form-label">Data Início</label>
                            <input 
                              type="date" 
                              className="form-control"
                              value={newAllocStartDate}
                              onChange={(e) => setNewAllocStartDate(e.target.value)}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">Data Término (Opcional)</label>
                            <input 
                              type="date" 
                              className="form-control"
                              value={newAllocEndDate}
                              onChange={(e) => setNewAllocEndDate(e.target.value)}
                            />
                          </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Adicionar Vínculo
                        </button>
                      </form>
                    </div>

                    {/* Active allocations and history */}
                    <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                          Vínculos Ativos Vigentes
                        </h3>

                        <div className="table-responsive" style={{ maxHeight: '200px' }}>
                          <table className="table-premium">
                            <thead>
                              <tr>
                                <th>Monitor</th>
                                <th>Colaborador</th>
                                <th>Início</th>
                                <th>Término</th>
                                <th>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allocations.filter(a => a.active).map(a => {
                                const mon = users.find(u => u.id === a.monitorId)?.name || 'N/A';
                                const col = users.find(u => u.id === a.colaboradorId)?.name || 'N/A';
                                return (
                                  <tr key={a.id}>
                                    <td>
                                      <div className="user-cell-wrapper">
                                        {renderUserAvatar(mon)}
                                        <span>{mon}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <div className="user-cell-wrapper">
                                        {renderUserAvatar(col)}
                                        <span>{col}</span>
                                      </div>
                                    </td>
                                    <td>{new Date(a.startDate).toLocaleDateString('pt-BR')}</td>
                                    <td>{a.endDate ? new Date(a.endDate).toLocaleDateString('pt-BR') : 'Indeterminado'}</td>
                                    <td>
                                      <button className="btn btn-danger btn-sm" onClick={() => handleTerminateAllocation(a.id)}>
                                        Terminar
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Log History */}
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                          Histórico de Auditoria de Carteiras
                        </h3>
                        <div className="log-audit-list">
                          {allocationHistory.slice().reverse().map(log => {
                            const authorObj = users.find(u => u.id === log.changedBy);
                            const author = authorObj ? authorObj.name : 'Sistema';
                            return (
                              <div key={log.id} className="log-audit-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                  <span>Operação: {log.actionType} | Autor: {author}</span>
                                  <span>{new Date(log.changedAt).toLocaleString('pt-BR')}</span>
                                </div>
                                <div style={{ marginTop: '0.15rem', color: 'var(--text-main)', fontSize: '0.78rem' }}>{log.details}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* TAB: ADMIN */}
              {activeTab === 'admin' && currentUser.role === 'ADMIN' && (
                <div className="animate-fade-in">
                  <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                    <div>
                      <h1 className="page-title">Personalização e Controles Administrativos</h1>
                      <p className="page-subtitle">Configure regras gerais de negócio, White Label e critérios dinâmicos.</p>
                    </div>
                  </div>

                  <div className="tab-row">
                    <button 
                      className={`tab-btn ${adminSubTab === 'areas' ? 'active' : ''}`}
                      onClick={() => setAdminSubTab('areas')}
                    >
                      Áreas
                    </button>
                    <button 
                      className={`tab-btn ${adminSubTab === 'collaborators' ? 'active' : ''}`}
                      onClick={() => setAdminSubTab('collaborators')}
                    >
                      Colaboradores
                    </button>
                    <button 
                      className={`tab-btn ${adminSubTab === 'criteria' ? 'active' : ''}`}
                      onClick={() => setAdminSubTab('criteria')}
                    >
                      Critérios de Avaliação
                    </button>
                    <button 
                      className={`tab-btn ${adminSubTab === 'settings' ? 'active' : ''}`}
                      onClick={() => setAdminSubTab('settings')}
                    >
                      Configurações do Fluxo
                    </button>
                    <button 
                      className={`tab-btn ${adminSubTab === 'users' ? 'active' : ''}`}
                      onClick={() => setAdminSubTab('users')}
                    >
                      Usuários do Portal
                    </button>
                  </div>

                  {/* Sub-tab: Areas */}
                  {adminSubTab === 'areas' && (
                    <div className="section-card animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                          Áreas Cadastradas
                        </h3>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setNewArea({ id: '', name: '', gestorId: '', monitorId: '', active: true });
                          setShowAreaModal(true);
                        }}>
                          <Plus size={15} /> Adicionar Área
                        </button>
                      </div>

                      <div className="table-responsive">
                        <table className="table-premium">
                          <thead>
                            <tr>
                              <th>Nome da Área</th>
                              <th>Gestor Responsável</th>
                              <th>Monitor Responsável</th>
                              <th>Status</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {areas.map(a => (
                              <tr key={a.id}>
                                <td style={{ fontWeight: '600' }}>{a.name}</td>
                                <td>{users.find(u => u.id === a.gestorId)?.name || 'N/A'}</td>
                                <td>{users.find(u => u.id === a.monitorId)?.name || 'N/A'}</td>
                                <td>
                                  <span className={`badge-pill ${a.active ? 'badge-success' : 'badge-danger'}`}>
                                    {a.active ? 'Ativo' : 'Inativo'}
                                  </span>
                                </td>
                                <td>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setNewArea(a);
                                    setShowAreaModal(true);
                                  }}>
                                    <Edit size={12} /> Editar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab: Collaborators */}
                  {adminSubTab === 'collaborators' && (
                    <div className="section-card animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                          Colaboradores Avaliados
                        </h3>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setNewCollaborator({ id: '', email: '', name: '', cargo: '', areaId: '', active: true });
                          setShowCollaboratorModal(true);
                        }}>
                          <Plus size={15} /> Adicionar Colaborador
                        </button>
                      </div>

                      <div className="table-responsive">
                        <table className="table-premium">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>E-mail</th>
                              <th>Cargo</th>
                              <th>Área</th>
                              <th>Status</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {collaborators.map(c => (
                              <tr key={c.id}>
                                <td style={{ fontWeight: '600' }}>{c.name}</td>
                                <td>{c.email}</td>
                                <td>{c.cargo}</td>
                                <td>{areas.find(a => a.id === c.areaId)?.name || 'N/A'}</td>
                                <td>
                                  <span className={`badge-pill ${c.active ? 'badge-success' : 'badge-danger'}`}>
                                    {c.active ? 'Ativo' : 'Inativo'}
                                  </span>
                                </td>
                                <td>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setNewCollaborator(c);
                                    setShowCollaboratorModal(true);
                                  }}>
                                    <Edit size={12} /> Editar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab: Criteria configuration */}
                  {adminSubTab === 'criteria' && (
                    <div className="section-card animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                          Critérios de Avaliação Cadastrados
                        </h3>
                        <button className="btn btn-primary btn-sm" onClick={() => {
                          setNewCriterion({
                            id: '',
                            name: '',
                            description: '',
                            minExpectedScore: 7.5,
                            weight: 1.0,
                            channels: ['Chat', 'WhatsApp'],
                            active: true
                          });
                          setShowCriterionModal(true);
                        }}>
                          <Plus size={15} /> Adicionar Critério
                        </button>
                      </div>

                      <div className="table-responsive">
                        <table className="table-premium">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>Descrição</th>
                              <th>Nota Mínima Esperada</th>
                              <th>Canais de Aplicação</th>
                              <th>Status</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {criteria.map(c => (
                              <tr key={c.id}>
                                <td style={{ fontWeight: '600' }}>{c.name}</td>
                                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {c.description}
                                </td>
                                <td style={{ fontWeight: 'bold' }}>{c.minExpectedScore.toFixed(1)}</td>
                                <td>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                    {c.channels.map(chan => (
                                      <span key={chan} className="badge-pill badge-info" style={{ fontSize: '0.62rem' }}>
                                        {chan}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge-pill ${c.active ? 'badge-success' : 'badge-danger'}`}>
                                    {c.active ? 'Ativo' : 'Inativo'}
                                  </span>
                                </td>
                                <td>
                                  <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setNewCriterion(c);
                                    setShowCriterionModal(true);
                                  }}>
                                    <Edit size={12} /> Editar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab: settings */}
                  {adminSubTab === 'settings' && (
                    <div className="allocation-manager-grid animate-fade-in">
                      
                      {/* Workflow configuration V2 */}
                      <div className="section-card">
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                          Workflow e Validações
                        </h3>

                        <div className="switch-group">
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Exigir Validação Gerencial</div>
                            <div className="switch-label-desc">
                              Se ativo, as avaliações feitas por monitores requerem aprovação gerencial para constarem nos KPIs do dashboard.
                            </div>
                          </div>
                          <input 
                            type="checkbox" 
                            style={{ height: '18px', width: '18px', cursor: 'pointer' }}
                            checked={settings.requireGestorValidation}
                            onChange={(e) => setSettings({ ...settings, requireGestorValidation: e.target.checked })}
                          />
                        </div>
                      </div>

                      {/* Brand configuration */}
                      <div className="section-card">
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', marginBottom: '1.25rem', fontWeight: 'bold' }}>
                          White Label Brand Config
                        </h3>

                        <div className="form-group">
                          <label className="form-label">Nome da Empresa</label>
                          <input 
                            type="text" 
                            className="form-control"
                            value={brand.name}
                            onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Cores Institucionais</label>
                          <div className="color-picker-group">
                            <div className="color-input-container">
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Primária</span>
                              <input 
                                type="color" 
                                className="color-input-picker"
                                value={brand.primaryColor}
                                onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                              />
                            </div>
                            <div className="color-input-container">
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Secundária</span>
                              <input 
                                type="color" 
                                className="color-input-picker"
                                value={brand.secondaryColor}
                                onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', marginTop: '1rem' }}
                          onClick={() => {
                            setBrand(DEFAULT_BRAND_CONFIG);
                          }}
                        >
                          Restaurar Moura Leite
                        </button>
                      </div>

                    </div>
                  )}

                  {/* Sub-tab: users management */}
                  {adminSubTab === 'users' && (
                    <div className="section-card animate-fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
                          Controle de Contas e Acessos Corporativos
                        </h3>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>
                          <PlusCircle size={15} /> Adicionar Usuário
                        </button>
                      </div>

                      <div className="table-responsive">
                        <table className="table-premium">
                          <thead>
                            <tr>
                              <th>Nome</th>
                              <th>E-mail</th>
                              <th>Papel (Role)</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.id}>
                                <td>
                                  <div className="user-cell-wrapper">
                                    {renderUserAvatar(u.name)}
                                    <span style={{ fontWeight: '600' }}>{u.name}</span>
                                  </div>
                                </td>
                                <td>{u.email}</td>
                                <td>
                                  <span className={`badge-pill role-${u.role.toLowerCase()}`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge-pill badge-success">Ativo</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}

                  </>
                );
              })()}
            </main>
          </div>



        </div>
      )}

      {/* 3. WIZARDS AND MODALS IN V2 */}

      {/* MODALS */}
      {showWizardModal && (
        <MonitoringForm
          initialData={editingMonitoring}
          users={users}
          collaborators={getCollaborators()}
          criteria={criteria}
          currentUser={currentUser}
          onClose={() => {
            setShowWizardModal(false);
            setEditingMonitoring(null);
          }}
          onSave={handleSaveFormMonitoring}
        />
      )}

      {showDetailModal && selectedMonitoringDetail && (
        <MonitoringHistory
          monitoring={selectedMonitoringDetail}
          users={users}
          collaborators={getCollaborators()}
          criteria={criteria}
          currentUser={currentUser}
          onClose={() => setShowDetailModal(false)}
          onApprove={handleApproveMonitoring}
          onCancel={handleCancelMonitoring}
        />
      )}

      {/* MODAL: Criar / Editar Critério Dinâmico */}
      {showCriterionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {newCriterion.id ? 'Editar Critério' : 'Cadastrar Novo Critério'}
              </h3>
              <button className="modal-close" onClick={() => setShowCriterionModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveCriterion}>
              <div className="form-group">
                <label className="form-label">Nome do Critério*</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: Comunicação"
                  value={newCriterion.name}
                  onChange={(e) => setNewCriterion({ ...newCriterion, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea 
                  rows="3" 
                  className="form-control"
                  placeholder="Descreva o escopo do critério..."
                  value={newCriterion.description}
                  onChange={(e) => setNewCriterion({ ...newCriterion, description: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nota Mínima Esperada</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0" 
                    max="10" 
                    className="form-control"
                    value={newCriterion.minExpectedScore}
                    onChange={(e) => setNewCriterion({ ...newCriterion, minExpectedScore: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Peso do Critério</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0.1" 
                    className="form-control"
                    value={newCriterion.weight}
                    onChange={(e) => setNewCriterion({ ...newCriterion, weight: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Canais Aplicáveis</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial'].map(chan => {
                    const isChecked = newCriterion.channels.includes(chan);
                    return (
                      <label key={chan} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const updatedChans = isChecked 
                              ? newCriterion.channels.filter(c => c !== chan) 
                              : [...newCriterion.channels, chan];
                            setNewCriterion({ ...newCriterion, channels: updatedChans });
                          }}
                        />
                        {chan}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="switch-group">
                <label className="form-label" style={{ margin: 0 }}>Critério Ativo</label>
                <input 
                  type="checkbox"
                  style={{ height: '18px', width: '18px', cursor: 'pointer' }}
                  checked={newCriterion.active}
                  onChange={(e) => setNewCriterion({ ...newCriterion, active: e.target.checked })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCriterionModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Critério
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Usuário */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Registrar Novo Usuário</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>&times;</button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newUser.email || !newUser.name) {
                alert('Preencha os campos obrigatórios.');
                return;
              }
              setUsers([...users, {
                id: `usr-${Date.now()}`,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                team: newUser.role === 'COLABORADOR' ? newUser.team : '',
                active: true
              }]);
              setShowUserModal(false);
              setNewUser({ email: '', name: '', role: 'MONITOR', team: '' });
            }}>
              <div className="form-group">
                <label className="form-label">Nome Completo*</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-mail Corporativo M365*</label>
                <input 
                  type="email" 
                  className="form-control"
                  placeholder="nome@mouraleite.com.br"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nível de Acesso (Role)</label>
                  <select 
                    className="form-control"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="MONITOR">Monitor</option>
                    <option value="GESTOR">Gestor</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="COLABORADOR">Colaborador (Agente)</option>
                  </select>
                </div>

                {newUser.role === 'COLABORADOR' && (
                  <div className="form-group">
                    <label className="form-label">Equipe</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: Vendas"
                      value={newUser.team}
                      onChange={(e) => setNewUser({ ...newUser, team: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Registrar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Adicionar Área */}
      {showAreaModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{newArea.id ? 'Editar Área' : 'Cadastrar Nova Área'}</h3>
              <button className="modal-close" onClick={() => setShowAreaModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveArea}>
              <div className="form-group">
                <label className="form-label">Nome da Área*</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={newArea.name}
                  onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gestor Responsável</label>
                <select 
                  className="form-control"
                  value={newArea.gestorId}
                  onChange={(e) => setNewArea({ ...newArea, gestorId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {users.filter(u => u.role === 'GESTOR' || u.role === 'ADMIN').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Monitor Principal</label>
                <select 
                  className="form-control"
                  value={newArea.monitorId}
                  onChange={(e) => setNewArea({ ...newArea, monitorId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {users.filter(u => u.role === 'MONITOR' || u.role === 'ADMIN').map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="switch-group">
                <label className="form-label" style={{ margin: 0 }}>Área Ativa</label>
                <input 
                  type="checkbox"
                  style={{ height: '18px', width: '18px', cursor: 'pointer' }}
                  checked={newArea.active}
                  onChange={(e) => setNewArea({ ...newArea, active: e.target.checked })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAreaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Colaborador */}
      {showCollaboratorModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{newCollaborator.id ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}</h3>
              <button className="modal-close" onClick={() => setShowCollaboratorModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveCollaborator}>
              <div className="form-group">
                <label className="form-label">Nome Completo*</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={newCollaborator.name}
                  onChange={(e) => setNewCollaborator({ ...newCollaborator, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">E-mail Corporativo</label>
                <input 
                  type="email" 
                  className="form-control"
                  value={newCollaborator.email}
                  onChange={(e) => setNewCollaborator({ ...newCollaborator, email: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Cargo</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={newCollaborator.cargo}
                    onChange={(e) => setNewCollaborator({ ...newCollaborator, cargo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Área*</label>
                  <select 
                    className="form-control"
                    value={newCollaborator.areaId}
                    onChange={(e) => setNewCollaborator({ ...newCollaborator, areaId: e.target.value })}
                    required
                  >
                    <option value="">Selecione...</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="switch-group">
                <label className="form-label" style={{ margin: 0 }}>Colaborador Ativo</label>
                <input 
                  type="checkbox"
                  style={{ height: '18px', width: '18px', cursor: 'pointer' }}
                  checked={newCollaborator.active}
                  onChange={(e) => setNewCollaborator({ ...newCollaborator, active: e.target.checked })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCollaboratorModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
