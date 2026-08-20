import { UserCheck, PlusCircle, Activity, ClipboardList, BarChart3, Search } from 'lucide-react';
import { getScoreConcept } from '../../scoreUtils';

// Home do Monitor.
//
// Ajuste de honestidade dos indicadores, feito antes da entrada em operação: a tela exibia
// seis blocos com dados que não vinham de lugar nenhum. Foram removidos ou ocultados:
//
//   - "Produtividade 95% / Dentro do SLA": o número era literal no código, nunca calculado.
//   - "Meu Desempenho": gráfico com array fixo [80,85,92,88,95,98] e rótulos Jan–Jun fixos.
//   - "Avisos da Equipe": três avisos escritos à mão sobre eventos de julho.
//   - "Agenda do Dia": lia a semente de junho/2026 e formatava item.date (sem hora) em vez de
//     item.time, então todo compromisso aparecia às 21:00. Volta quando houver agenda real.
//
// Nada foi substituído por outro dado inventado — a tela ficou menor, e é isso que se
// pretendia. A reformulação da Home fica para depois dos pilotos, com base no uso real.
export const HomeMonitor = ({ currentUser, demands, monitorings, collaborators, onNavigate }) => {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
  const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Calculations
  const myMonitorings = monitorings.filter(m => m.monitorId === currentUser.id);
  const currentMonth = new Date().getMonth();
  const monthMonitorings = myMonitorings.filter(m => new Date(m.date).getMonth() === currentMonth);
  const temMonitoriasNoMes = monthMonitorings.length > 0;
  const avgScore = temMonitoriasNoMes
    ? monthMonitorings.reduce((acc, m) => acc + m.finalScore, 0) / monthMonitorings.length
    : 0;

  // Os campos consultados aqui eram `assigneeId` e `dueDate`, que não existem no registro de
  // demanda — os nomes reais são `assignedTo` e `deadline`. O filtro nunca casava, então a
  // contagem era sempre zero e o card dizia "Tudo limpo" mesmo havendo demandas em aberto.
  const pendingDemands = demands.filter(d => d.assignedTo === currentUser.id && d.status !== 'Concluída');
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
          {temMonitoriasNoMes ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>{avgScore.toFixed(2)}%</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600' }}>{getScoreConcept(avgScore).label}</span>
            </div>
          ) : (
            // Sem monitoria no mês não há média. Antes exibia 0,00% com o conceito "Crítico",
            // ou seja, acusava a monitora de desempenho crítico antes do primeiro registro.
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-muted)' }}>—</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sem dados neste mês</div>
            </div>
          )}
        </div>
        <div className="executive-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pendências</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>{pendingDemands.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aguardando ação</div>
        </div>
      </div>

      {/* Atalhos Rápidos */}
      <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {/* Caminho completo, e não um id de aba: onNavigate prefixa com '/', então
            'monitorings/new' abre o formulário. Antes este botão levava à listagem. */}
        <button className="btn btn-primary" onClick={() => onNavigate('monitorings/new')}><PlusCircle size={16} /> Nova Monitoria</button>
        <button className="btn btn-outline" onClick={() => onNavigate('monitorings')}><Search size={16} /> Pesquisar</button>
        <button className="btn btn-outline" onClick={() => onNavigate('reports')}><BarChart3 size={16} /> Relatórios</button>
        <button className="btn btn-outline" onClick={() => onNavigate('profile')}><UserCheck size={16} /> Meu Perfil</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* Demandas Prioritárias */}
        <div className="section-card" style={{ padding: '1.25rem' }}>
          <h2 className="section-card-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}><ClipboardList size={16} /> Demandas Prioritárias</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingDemands.length > 0 ? pendingDemands.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input type="checkbox" style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>{d.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prazo: {new Date(d.deadline).toLocaleDateString('pt-BR')}</div>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>Nenhuma demanda em aberto.</div>
            )}
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
                    </tr>
                  )
                })}
                {lastMonitorings.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma monitoria registrada ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
