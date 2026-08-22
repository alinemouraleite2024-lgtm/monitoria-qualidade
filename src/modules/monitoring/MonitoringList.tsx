import { useState } from 'react';
import { Search, Filter, Plus, Edit, Eye, Trash2, Calendar, FileSpreadsheet } from 'lucide-react';
import { getScoreConcept } from '../../scoreUtils';
import { CANAIS, canalLabel } from '../../constants/canais';
import type { Collaborator, Monitoring, User } from '../../types/domain';

// A tabela, a busca e os cinco filtros que viviam em /monitorings.
//
// 2B.2: o componente não foi reescrito — mudou de endereço. Ele é o histórico de Relatórios,
// que é onde consulta e análise pertencem; a agenda do dia ficou em Monitorias. Reescrever a
// tabela custaria os detalhes que já estão certos aqui: os badges de Zerada e Eliminatório
// Pendente, o conceito abaixo da nota, o N/A para rascunho.
//
// O cabeçalho e as ações viraram opcionais para que a tela hospedeira decida o que faz sentido
// no contexto dela.
interface MonitoringListProps {
  monitorings?: Monitoring[];
  users?: User[];
  collaborators?: Collaborator[];
  titulo?: string;
  subtitulo?: string;
  /** Ausente esconde o botão: em Relatórios não se cria monitoria. */
  onNewMonitoring?: () => void;
  onView: (m: Monitoring) => void;
  onEdit: (m: Monitoring) => void;
  /** Ausente esconde a ação. Gate de DELETE_MONITORING é decisão de quem hospeda. */
  onDelete?: (id: string) => void;
}

export const MonitoringList = ({
  monitorings = [],
  users = [],
  collaborators = [],
  titulo = 'Central de Monitorias',
  subtitulo = 'Acompanhe, filtre e gerencie as avaliações de qualidade.',
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
      // O protocolo entrou na busca junto com a regra que o tornou obrigatório: é por ele que
      // se chega da resposta de um cliente até a monitoria do atendimento correspondente.
      const colab = collaborators.find(c => c.id === m.colaboradorId);
      const termo = searchTerm.toLowerCase();
      const colabName = colab ? colab.name.toLowerCase() : '';
      const code = m.id.toLowerCase();
      const protocolo = (m.protocolo || '').toLowerCase();
      if (!colabName.includes(termo) && !code.includes(termo) && !protocolo.includes(termo)) {
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
          <h1 className="page-title"><FileSpreadsheet size={24} style={{ display: 'inline', marginRight: '8px' }} /> {titulo}</h1>
          <p className="page-subtitle">{subtitulo}</p>
        </div>
        {onNewMonitoring && (
          <button className="btn btn-primary" onClick={onNewMonitoring}>
            <Plus size={16} /> Nova Monitoria
          </button>
        )}
      </div>

      <div className="section-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '200px' }}>
            <label className="form-label">Pesquisa</label>
            <div className="global-search" style={{ width: '100%', padding: '0.45rem 1rem' }}>
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Código, Colaborador ou Protocolo..."
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
              {CANAIS.map(c => (
                <option key={c} value={c}>{canalLabel(c)}</option>
              ))}
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
                  <td>{canalLabel(m.canal)}</td>
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
                      {onDelete && (
                        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }} onClick={() => onDelete(m.id)} title="Cancelar monitoria">
                          <Trash2 size={14} />
                        </button>
                      )}
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
