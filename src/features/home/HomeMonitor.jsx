import { UserCheck, PlusCircle, TrendingUp, Bell, Activity, ClipboardList, BarChart3, Search, Calendar as CalendarIcon } from 'lucide-react';
import { getScoreConcept } from '../../scoreUtils';

export const HomeMonitor = ({ currentUser, agenda, demands, monitorings, collaborators, onNavigate }) => {
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
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>{getScoreConcept(avgScore).label}</span>
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
            <button className="btn btn-primary" onClick={() => onNavigate('monitorings')}><PlusCircle size={16} /> Nova Monitoria</button>
            <button className="btn btn-outline" onClick={() => onNavigate('monitorings')}><Search size={16} /> Pesquisar</button>
            <button className="btn btn-outline" onClick={() => onNavigate('reports')}><BarChart3 size={16} /> Relatórios</button>
            <button className="btn btn-outline" onClick={() => onNavigate('profile')}><UserCheck size={16} /> Meu Perfil</button>
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
              <button className="btn btn-outline btn-sm" onClick={() => onNavigate('monitorings')}>Ver todas</button>
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
