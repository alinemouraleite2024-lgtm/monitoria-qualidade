import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getAuditLogs } from '../../auth';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLogs(getAuditLogs());
  }, []);

  const filteredLogs = logs.filter(l => 
    l.userEmail?.toLowerCase().includes(search.toLowerCase()) || 
    l.eventType?.toLowerCase().includes(search.toLowerCase()) ||
    l.actionDetails?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="section-card animate-fade-in">
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
          Registro de acessos e ações
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
          Entradas, saídas, trocas de perfil e alterações de cadastro.
        </p>
      </div>

      <div>
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
          <div className="search-box" style={{ flex: 1, maxWidth: '400px', display: 'flex', alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1rem' }}>
            <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
            <input type="text" placeholder="Buscar em logs (email, evento, detalhes)..." style={{ border: 'none', background: 'transparent', flex: 1, color: 'var(--text-main)', outline: 'none' }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Data / Hora</th>
                <th style={{ padding: '1rem' }}>Usuário</th>
                <th style={{ padding: '1rem' }}>Ação / Evento</th>
                <th style={{ padding: '1rem' }}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>
                      {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{log.userName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.userEmail}{log.userRole && log.userRole !== 'N/A' ? ` · ${log.userRole}` : ''}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge-pill ${log.eventType.includes('BLOCK') || log.eventType.includes('DELETE') ? 'badge-danger' : log.eventType.includes('CREATE') ? 'badge-success' : 'badge-primary'}`}>
                      {log.eventType}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{log.actionDetails || '-'}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum log encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
