import { useState } from 'react';
import { X, FileText, Check, AlertCircle } from 'lucide-react';
import { getScoreConcept } from '../../scoreUtils';
import { canalLabel } from '../../constants/canais';
import { exibirDuracao } from '../../domain/duracao';
import { podeValidar } from '../../domain/validacaoService';
import type { Collaborator, Criterion, Monitoring, Role, User } from '../../types/domain';

interface MonitoringHistoryProps {
  monitoring: Monitoring;
  users?: User[];
  collaborators?: Collaborator[];
  criteria?: Criterion[];
  currentUser?: User | null;
  /** Perfil ativo: validar é ato do contexto GESTOR, não de quem apenas possui o perfil. */
  perfilAtivo?: Role | null;
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
  perfilAtivo = null,
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


  // 0.20.0 — quem pode validar deixou de ser uma pergunta sobre o papel de quem está olhando e
  // passou a incluir de quem é a monitoria: ninguém valida a própria. `motivo` existe para que
  // o controle não simplesmente desapareça — some o botão, fica a explicação.
  const validacao = podeValidar(currentUser, perfilAtivo, monitoring);
  const aguardandoValidacao = monitoring.status === 'Pendente' || monitoring.status === 'Aguardando Aprovação';

  const canApprove = validacao.pode && aguardandoValidacao;
  const motivoBloqueio = !validacao.pode && aguardandoValidacao ? validacao.motivo : null;

  // F0-08: confirmação de zerada é um fluxo independente da aprovação de conteúdo acima —
  // só depende de haver uma sinalização pendente, não do status da monitoria.
  const canConfirmZerada = validacao.pode && monitoring.eliminatoryPending === true;
  const getCriterionName = (id: string) => criteria.find(c => c.id === id)?.name || id;
  const triggeredCriteriaNames = (monitoring.scores || [])
    .filter(s => {
      const crit = criteria.find(c => c.id === s.criterionId);
      // Comparação estrita, e não `Number(s.score) === 0`: `Number('')` também é 0, então a
      // versão anterior lia "não respondido" como "Sim, ocorreu" e listava o eliminatório como
      // sinalizado. Só o zero literal — que é o que o botão "Sim, ocorreu" grava — conta.
      return crit?.eliminatorio && s.score === 0;
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

          {/* Identificação do atendimento — bloco correspondente ao "🔎 Identificação" do
              Padrão Relatório de Monitoria, que até a 0.13.0 não existia em tela nenhuma.
              Campo ausente aparece como "—": registro anterior à 0.14.0 não tem os
              identificadores nem a janela de atendimento, e mentir um valor seria pior. */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} style={{ color: 'var(--text-muted)' }} /> Identificação do Atendimento
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', backgroundColor: '#fafbfc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Nº do Atendimento</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{monitoring.numeroAtendimento || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Nº do Protocolo</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{monitoring.protocolo || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Nº do Título</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{monitoring.numeroTitulo || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Início</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                  {monitoring.inicioAtendimento ? new Date(monitoring.inicioAtendimento).toLocaleString('pt-BR') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Encerramento</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                  {monitoring.fimAtendimento ? new Date(monitoring.fimAtendimento).toLocaleString('pt-BR') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Tempo de atendimento</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{exibirDuracao(monitoring.duracaoMinutos, monitoring.tempo)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Categoria</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{monitoring.categoriaAtendimento || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Tipo</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{monitoring.tipo}</div>
              </div>
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
                  {/* '' é "não respondido" e renderizaria uma célula vazia, indistinguível de
                      falha de tela. Diz-se que não foi respondido. */}
                  <div style={{ fontWeight: '700', color: s.score === '' ? 'var(--text-muted)' : undefined }}>
                    {s.score === '' ? 'não respondido' : s.score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relatório — os seis blocos do Padrão Relatório de Monitoria, na ordem em que ele
              os define. Até a 0.18.0 só três existiam aqui, e os outros eram escritos à mão
              fora do sistema. Bloco vazio é dito, não escondido: monitoria anterior a esta
              versão não tem os campos novos, e omiti-los faria parecer que o relatório está
              completo. */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Relatório</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { rotulo: 'Contexto do Atendimento', valor: monitoring.contexto, cor: 'var(--text-muted)' },
                { rotulo: 'Pontos Positivos', valor: monitoring.strengths, cor: 'var(--primary)' },
                { rotulo: 'Pontos de Atenção', valor: monitoring.opportunities, cor: 'var(--warning)' },
                { rotulo: 'Leitura Técnica', valor: monitoring.leituraTecnica, cor: 'var(--info)' },
                { rotulo: 'Erros Identificados', valor: monitoring.errosIdentificados, cor: 'var(--danger)' },
                { rotulo: 'Conclusão', valor: monitoring.conclusao, cor: 'var(--primary)' },
              ].map((b) => (
                <div key={b.rotulo}>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: b.cor }}>{b.rotulo}</div>
                  <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', color: b.valor ? undefined : 'var(--text-muted)' }}>
                    {b.valor || 'Não preenchido.'}
                  </div>
                </div>
              ))}
            </div>

            {monitoring.comments && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Observações internas</div>
                <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{monitoring.comments}</div>
              </div>
            )}
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
        {/* Quando a validação está bloqueada, o motivo ocupa o lugar dos botões. Um rodapé que
            simplesmente não aparece deixaria a gestora procurando o que fazer; dizer por que
            não há o que fazer ali encerra a pergunta. */}
        {motivoBloqueio && (
          <div className="slide-over-footer" style={{ flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {motivoBloqueio}
              </div>
            </div>
          </div>
        )}

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
