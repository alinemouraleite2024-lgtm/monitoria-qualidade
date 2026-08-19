export const CalendarScreen = ({
  monitorings = /** @type {import('../../types/domain').Monitoring[]} */ ([]),
  users = /** @type {import('../../types/domain').User[]} */ ([]),
  currentUser = /** @type {import('../../types/domain').User | null} */ (null),
}) => (
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
);
