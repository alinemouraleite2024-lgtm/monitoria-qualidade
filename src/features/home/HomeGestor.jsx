import { Users, AlertCircle, Clock, ClipboardList, Calendar as CalendarIcon } from 'lucide-react';

// eslint-disable-next-line no-unused-vars
export const HomeGestor = ({ currentUser, demands, users }) => (
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
        {/* 0.17.0: este bloco era JSX fixo — duas aprovações inventadas, com nomes de pessoas
            reais e botões que não faziam nada. Um gestor novo abria a Home e via trabalho que
            não existe. A fila de validação de verdade mora em Monitorias; aqui fica só o
            caminho até ela. */}
        <h2 className="section-card-title"><Clock size={18} /> Aprovações pendentes</h2>
        <div style={{ marginTop: '1rem', height: '200px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', textAlign: 'center', padding: '1rem' }}>
          <span>A fila de validação da sua equipe fica em Monitorias.</span>
          <span style={{ fontSize: '0.8rem' }}>Lá aparece o que está aguardando você, em ordem de espera.</span>
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
