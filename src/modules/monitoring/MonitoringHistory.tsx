import { useState } from 'react';
import { X, CheckCircle2, User as UserIcon, Clock, FileText, Check, AlertCircle } from 'lucide-react';
import { getScoreConcept } from '../../scoreUtils';
import { canalLabel } from '../../constants/canais';
import type { Collaborator, Criterion, Monitoring, User } from '../../types/domain';

interface MonitoringHistoryProps {
  monitoring: Monitoring;
  users?: User[];
  collaborators?: Collaborator[];
  criteria?: Criterion[];
  currentUser?: User | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  /** Recebe o motivo informado pelo gestor além do id — contrato de BUG-03. */
  onRequestAdjustments: (id: string, reason: string) => void;
  onConfirmZerada: (id: string) => void;
}

export const MonitoringHistory = ({
  monitoring,
  users = [],
  collaborators = [],
  criteria = [],
  currentUser = null,
  onClose,
  onApprove,
  onReject,
  onRequestAdjustments,
  onConfirmZerada
}: MonitoringHistoryProps) => {
  const [adjustReason, setAdjustReason] = useState('');
  const [showAdjustInput, setShowAdjustInput] = useState(false);

  if (!monitoring) return null;

  const getUserName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? u.name : 'Desconhecido';
  };

  const getColabName = (id: string) => {
    const c = collaborators.find(c => c.id === id);
    return c ? c.name : 'Desconhecido';
  };

  // Mock History Logs
  const historyLogs = [
    { id: 1, type: 'CREATE', user: monitoring.monitorId, date: monitoring.date, details: 'Monitoria criada.' },
    { id: 2, type: 'STATUS', user: monitoring.monitorId, date: monitoring.date, details: `Status alterado para ${monitoring.status}.` }
  ];

  // Aprovação flow logic
  const canApprove = currentUser && (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN') && (monitoring.status === 'Pendente' || monitoring.status === 'Aguardando Aprovação');

  // F0-08: confirmação de zerada é um fluxo independente da aprovação de conteúdo acima —
  // só depende de haver uma sinalização pendente, não do status da monitoria.
  const isManager = currentUser && (currentUser.role === 'GESTOR' || currentUser.role === 'ADMIN');
  const canConfirmZerada = isManager && monitoring.eliminatoryPending === true;
  const getCriterionName = (id: string) => criteria.find(c => c.id === id)?.name || id;
  const triggeredCriteriaNames = (monitoring.scores || [])
    .filter(s => {
      const crit = criteria.find(c => c.id === s.criterionId);
      return crit?.eliminatorio && Number(s.score) === 0;
    })
    .map(s => getCriterionName(s.criterionId));

  return (
    <div className="slide-over-overlay">
      <div className="slide-over-panel" style={{ width: '600px' }}>
        <div className="slide-over-header">
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>
              Detalhes da Monitoria
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{monitoring.id.toUpperCase()} • {getColabName(monitoring.colaboradorId)}</div>
          </div>
          <button className="btn-sidebar-logout" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="slide-over-body" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* General info summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#fafbfc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Monitor</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{getUserName(monitoring.monitorId)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Canal</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{canalLabel(monitoring.canal)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Data</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{new Date(monitoring.date).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Status Atual</div>
              <span className={`badge-pill badge-${monitoring.status === 'Validada' ? 'success' : monitoring.status === 'Reprovada' ? 'danger' : 'warning'}`}>
                {monitoring.status}
              </span>
            </div>
          </div>

          {monitoring.adjustmentReason && (
            <div style={{ border: '1px solid var(--warning)', backgroundColor: 'rgba(234, 179, 8, 0.08)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: '700', color: '#a16207' }}>Ajustes solicitados pelo gestor</div>
              <div style={{ fontSize: '0.85rem', color: '#854d0e', marginTop: '0.25rem' }}>{monitoring.adjustmentReason}</div>
            </div>
          )}

          {/* F0-08: sinalização de eliminatório */}
          {monitoring.zerada && (
            <div style={{ border: '2px solid #ef4444', backgroundColor: '#fee2e2', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: '800', color: '#991b1b' }}>Monitoria zerada</div>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '0.25rem' }}>
                Critério eliminatório confirmado por {getUserName(monitoring.eliminatoryConfirmedBy ?? '')} em {monitoring.eliminatoryConfirmedAt ? new Date(monitoring.eliminatoryConfirmedAt).toLocaleString('pt-BR') : '-'}.
              </div>
            </div>
          )}
          {!monitoring.zerada && monitoring.eliminatoryPending && (
            <div style={{ border: '2px solid #ef4444', backgroundColor: '#fee2e2', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ fontWeight: '800', color: '#991b1b' }}>Critério eliminatório pendente de confirmação</div>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '0.25rem' }}>
                Item(ns) sinalizado(s): {triggeredCriteriaNames.join(', ') || 'não identificado'}. A nota só será zerada após confirmação de um Gestor ou Administrador.
              </div>
            </div>
          )}

          {/* Scores Overview */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Resumo da Avaliação</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: monitoring.finalScore >= 75 ? 'var(--primary)' : 'var(--danger)', lineHeight: 1 }}>
                {monitoring.finalScore?.toFixed(2)}%
              </div>
              <div>
                <div style={{ fontWeight: '600' }}>Nota Final</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{getScoreConcept(monitoring.finalScore).label}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {monitoring.scores?.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{getCriterionName(s.criterionId)}</div>
                    {s.lowScoreReason && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>"{s.lowScoreReason}"</div>}
                  </div>
                  <div style={{ fontWeight: '700' }}>{s.score}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Feedback</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--primary)' }}>Pontos Fortes</div>
                <div style={{ fontSize: '0.9rem' }}>{monitoring.strengths || 'Não preenchido.'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--warning)' }}>Oportunidades de Melhoria</div>
                <div style={{ fontSize: '0.9rem' }}>{monitoring.opportunities || 'Não preenchido.'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--info)' }}>Plano de Ação</div>
                <div style={{ fontSize: '0.9rem' }}>{monitoring.comments || 'Não preenchido.'}</div>
              </div>
            </div>
          </div>

          {/* History Logs */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Histórico (Logs)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border-color)' }}>
              {historyLogs.map(log => (
                <div key={log.id} style={{ position: 'relative', paddingLeft: '1rem' }}>
                  <div style={{ position: 'absolute', left: '-13px', top: '2px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-app)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={12} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleString('pt-BR')} • {getUserName(log.user)}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{log.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* F0-08: Footer de confirmação de zerada — independente do fluxo de aprovação de conteúdo */}
        {canConfirmZerada && (
          <div className="slide-over-footer" style={{ flexDirection: 'column', gap: '0.75rem', backgroundColor: '#fef2f2' }}>
            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#991b1b' }}>Confirmação de Critério Eliminatório</div>
            <div style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>
              Confirme apenas se, de fato, o critério sinalizado ocorreu. Esta ação zera a nota final e não pode ser desfeita por aqui.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                onClick={() => { if (confirm('Confirmar que o critério eliminatório realmente ocorreu? A nota desta monitoria será zerada.')) onConfirmZerada(monitoring.id); }}
              >
                <AlertCircle size={16} /> Confirmar Zerada
              </button>
            </div>
          </div>
        )}

        {/* Approval Footer for Managers */}
        {canApprove && (
          <div className="slide-over-footer" style={{ flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>Fluxo de Aprovação</div>
            
            {showAdjustInput ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea 
                  className="form-control" 
                  rows={2} 
                  placeholder="Motivo da solicitação de ajuste..."
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                ></textarea>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAdjustInput(false)}>Cancelar</button>
                  <button className="btn btn-primary btn-sm" onClick={() => { onRequestAdjustments(monitoring.id, adjustReason); setShowAdjustInput(false); }}>
                    Enviar Solicitação
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }} onClick={() => onReject(monitoring.id)}>
                  <X size={16} /> Reprovar
                </button>
                <button className="btn btn-secondary" style={{ color: 'var(--warning)', borderColor: 'var(--warning-light)' }} onClick={() => setShowAdjustInput(true)}>
                  <AlertCircle size={16} /> Solicitar Ajustes
                </button>
                <button className="btn btn-primary" onClick={() => onApprove(monitoring.id)}>
                  <Check size={16} /> Aprovar Monitoria
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
