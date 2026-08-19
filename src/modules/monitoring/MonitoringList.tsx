import { useState } from 'react';
import { Search, Filter, Plus, Edit, Eye, Trash2, Calendar, FileSpreadsheet } from 'lucide-react';
import { getScoreConcept } from '../../scoreUtils';
import type { Collaborator, Monitoring, User } from '../../types/domain';

interface MonitoringListProps {
  monitorings?: Monitoring[];
  users?: User[];
  collaborators?: Collaborator[];
  onNewMonitoring: () => void;
  onView: (m: Monitoring) => void;
  onEdit: (m: Monitoring) => void;
  onDelete: (id: string) => void;
}

export const MonitoringList = ({
  monitorings = [],
  users = [],
  collaborators = [],
  onNewMonitoring,
  onView,
  onEdit,
  onDelete
}: MonitoringListProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonitor, setFilterMonitor] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCanal, setFilterCanal] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  // Derived data based on filters
  const filteredData = monitorings.filter(m => {
    if (filterMonitor !== 'ALL' && m.monitorId !== filterMonitor) return false;
    if (filterStatus !== 'ALL' && m.status !== filterStatus) return false;
    if (filterCanal !== 'ALL' && m.canal !== filterCanal) return false;
    if (filterDate && !m.date.startsWith(filterDate)) return false;

    if (searchTerm) {
      const colab = collaborators.find(c => c.id === m.colaboradorId);
      const colabName = colab ? colab.name.toLowerCase() : '';
      const code = m.id.toLowerCase();
      if (!colabName.includes(searchTerm.toLowerCase()) && !code.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  const getUserName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? u.name : 'Desconhecido';
  };

  const getColabName = (id: string) => {
    const c = collaborators.find(c => c.id === id);
    return c ? c.name : 'Desconhecido';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Rascunho': return 'badge-pill badge-info';
      case 'Pendente': return 'badge-pill badge-warning';
      case 'Em andamento': return 'badge-pill badge-warning';
      case 'Aguardando Aprovação': return 'badge-pill badge-warning';
      case 'Aprovada': return 'badge-pill badge-success';
      case 'Validada': return 'badge-pill badge-success';
      case 'Concluída': return 'badge-pill badge-success';
      case 'Reprovada': return 'badge-pill badge-danger';
      case 'Cancelada': return 'badge-pill badge-danger';
      default: return 'badge-pill badge-info';
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '1rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title"><FileSpreadsheet size={24} style={{ display: 'inline', marginRight: '8px' }} /> Central de Monitorias</h1>
          <p className="page-subtitle">Acompanhe, filtre e gerencie as avaliações de qualidade.</p>
        </div>
        <button className="btn btn-primary" onClick={onNewMonitoring}>
          <Plus size={16} /> Nova Monitoria
        </button>
      </div>

      <div className="section-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
            <label className="form-label">Pesquisa</label>
            <div className="global-search" style={{ width: '100%', padding: '0.45rem 1rem' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Código ou Colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Monitor</label>
            <select className="form-control" value={filterMonitor} onChange={(e) => setFilterMonitor(e.target.value)}>
              <option value="ALL">Todos os Monitores</option>
              {users.filter(u => u.role === 'MONITOR' || u.role === 'GESTOR').map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Canal</label>
            <select className="form-control" value={filterCanal} onChange={(e) => setFilterCanal(e.target.value)}>
              <option value="ALL">Todos os Canais</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Telefone">Telefone</option>
              <option value="Teams">Teams</option>
              <option value="Presencial">Presencial</option>
              <option value="E-mail">E-mail</option>
              <option value="Chat">Chat</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Status</label>
            <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ALL">Todos os Status</option>
              <option value="Rascunho">Rascunho</option>
              <option value="Pendente">Pendente</option>
              <option value="Aguardando Aprovação">Aguardando Aprovação</option>
              <option value="Aprovada">Aprovada</option>
              <option value="Validada">Validada</option>
              <option value="Concluída">Concluída</option>
              <option value="Reprovada">Reprovada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
            <label className="form-label">Data</label>
            <input 
              type="date" 
              className="form-control" 
              value={filterDate} 
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          
          <button className="btn btn-secondary" style={{ padding: '0.6rem 1rem' }} onClick={() => {
            setSearchTerm('');
            setFilterMonitor('ALL');
            setFilterStatus('ALL');
            setFilterCanal('ALL');
            setFilterDate('');
          }}>
            <Filter size={16} /> Limpar
          </button>
        </div>
      </div>

      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-premium">
            <thead>
              <tr>
                <th>Código</th>
                <th>Colaborador Avaliado</th>
                <th>Monitor</th>
                <th>Canal</th>
                <th>Data</th>
                <th>Nota</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: '600' }}>{m.id.toUpperCase()}</td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{getColabName(m.colaboradorId)}</div>
                  </td>
                  <td>{getUserName(m.monitorId)}</td>
                  <td>{m.canal}</td>
                  <td>{new Date(m.date).toLocaleDateString('pt-BR')}</td>
                  <td>
                    {m.status !== 'Rascunho' ? (
                      <div>
                        <div style={{ fontWeight: '700', color: m.finalScore >= 75 ? 'var(--primary)' : 'var(--danger)' }}>
                          {m.finalScore.toFixed(2)}%
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{getScoreConcept(m.finalScore).label}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    <span className={getStatusBadge(m.status)}>{m.status}</span>
                    {m.zerada && (
                      <span className="badge-pill badge-danger" style={{ marginLeft: '0.25rem' }}>Zerada</span>
                    )}
                    {!m.zerada && m.eliminatoryPending && (
                      <span className="badge-pill badge-danger" style={{ marginLeft: '0.25rem' }}>Elim. Pendente</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => onView(m)} title="Visualizar">
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => onEdit(m)} title="Editar">
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }} onClick={() => onDelete(m.id)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Nenhuma monitoria encontrada com os filtros atuais.
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
