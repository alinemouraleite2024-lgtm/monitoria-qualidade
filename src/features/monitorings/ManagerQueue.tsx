// A fila da gestora — mesma rota de Monitorias, outra pergunta.
//
// Para a monitora a pergunta é "o que eu preciso monitorar agora". Para a gestora é "o que
// precisa da minha validação agora". Mesma estrutura, conteúdo diferente por papel.
//
// Só apresentação. Ordenação, contagem e progresso chegam prontos de queueService.

import { Search, Eye, AlertTriangle, Inbox } from 'lucide-react';
import type { Monitoring, User, Collaborator } from '../../types/domain';
import type { NaFilaDeValidacao, RitmoDoMonitor, RiscoDoMes } from '../../domain/queueService';
import { canalLabel } from '../../constants/canais';
import { competenciaLabel } from '../../domain/period';
import { getScoreConcept } from '../../scoreUtils';
import { exigeReenvio, MOTIVO_REENVIO_MIGRADA } from '../../domain/validacaoService';

interface ManagerQueueProps {
  fila: NaFilaDeValidacao[];
  ritmo: RitmoDoMonitor[];
  risco: RiscoDoMes;
  colaboradorasPorId: Record<string, Collaborator | undefined>;
  monitoresPorId: Record<string, User | undefined>;
  busca: string;
  onBusca: (termo: string) => void;
  /** Abre o painel de análise. É o ÚNICO caminho para validar, devolver ou reprovar (Etapa A). */
  onAbrir: (m: Monitoring) => void;
  onVerRelatorios: () => void;
}

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const ManagerQueue = ({
  fila,
  ritmo,
  risco,
  colaboradorasPorId,
  monitoresPorId,
  busca,
  onBusca,
  onAbrir,
  onVerRelatorios,
}: ManagerQueueProps) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

    {/* ---------------- Fila de validação ---------------- */}
    <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
      <Cabecalho titulo="Fila de validação" contador={fila.length} nota="Mais antigas primeiro" tom="warning" />

      {fila.length === 0 && (
        <div style={{
          padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
        }}>
          <Inbox size={28} style={{ opacity: 0.4 }} />
          Nada aguardando sua validação.
        </div>
      )}

      {fila.map(({ monitoring: m, dias }) => {
        const conceito = getScoreConcept(m.finalScore);
        const eliminatorio = Boolean(m.eliminatoryPending) && !m.zerada;
        return (
          <div
            key={m.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
              padding: '0.85rem 1.15rem', borderTop: '1px solid var(--border-color)',
              borderLeft: `3px solid ${eliminatorio ? 'var(--danger)' : 'transparent'}`,
              backgroundColor: eliminatorio ? 'var(--danger-light)' : undefined,
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: '190px' }}>
              <div style={{ fontWeight: 600 }}>
                {colaboradorasPorId[m.colaboradorId]?.name ?? m.colaboradorId}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{m.id}</span>
                {' · '}{monitoresPorId[m.monitorId]?.name ?? m.monitorId}
                {' · '}{canalLabel(m.canal)} · {m.tipo}
              </div>
            </div>

            <div style={{ flex: '0 1 150px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {/* A competência entrou na linha em 0.22.1, quando a fila deixou de ser recortada
                  por mês: com registros de competências diferentes lado a lado, ela passou a ser
                  a informação que distingue um do outro. */}
              {m.competencia && (
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                  {competenciaLabel(m.competencia)}
                </div>
              )}
              atendimento {dataCurta(m.date)}
              {dias > 0 && (
                <div style={{ fontSize: '0.74rem', color: dias >= 5 ? 'var(--warning)' : 'var(--text-muted)' }}>
                  na fila há {dias} dia{dias > 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div style={{ flex: '0 0 auto', minWidth: '110px' }}>
              <span style={{
                fontFamily: 'var(--font-heading)', fontWeight: 700,
                color: m.finalScore >= 75 ? 'var(--primary)' : 'var(--danger)',
              }}>
                {m.finalScore.toFixed(2)}%
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{conceito.label}</div>
            </div>

            <div style={{ flex: '0 0 auto', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {eliminatorio ? (
                // Critério eliminatório sinalizado não oferece "Validar": zerar a nota é
                // decisão da gestora e não pode sair de um clique de rotina numa fila.
                <button className="btn btn-primary btn-sm" onClick={() => onAbrir(m)}>
                  <AlertTriangle size={14} /> Analisar
                </button>
              ) : (
                <>
                  {exigeReenvio(m) && (
                    // Migrada sem régua (M1): o painel só oferece devolver, e a fila avisa antes.
                    <span title={MOTIVO_REENVIO_MIGRADA} style={{ fontSize: '0.74rem', color: 'var(--warning)', alignSelf: 'center', maxWidth: '220px' }}>
                      {MOTIVO_REENVIO_MIGRADA}
                    </span>
                  )}
                  {/* Etapa A (26/10/2026): a fila não decide mais. "Validar" direto aprovava sem
                      que a monitoria fosse aberta; validar é calibração e exige a leitura. Toda
                      decisão — validar, devolver, reprovar — acontece no painel de análise. */}
                  <button className="btn btn-primary btn-sm" onClick={() => onAbrir(m)}>
                    <Eye size={14} /> Analisar
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>

    {/* ---------------- Ritmo da equipe ---------------- */}
    <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
      <Cabecalho
        titulo="Ritmo da equipe"
        nota={ritmo[0] ? `${ritmo[0].diasUteis} ${ritmo[0].diasUteis === 1 ? 'dia útil restante' : 'dias úteis restantes'}` : undefined}
      />
      {ritmo.map(({ monitor, progresso, ritmo: porDia }) => (
        <div key={monitor.id} style={{
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          padding: '0.85rem 1.15rem', borderTop: '1px solid var(--border-color)',
        }}>
          <div style={{ flex: '1 1 200px', fontWeight: 600 }}>{monitor.name}</div>

          {progresso.hasGoal ? (
            <>
              <div style={{ flex: '0 0 90px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                {progresso.cobertura} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>de {progresso.target}</span>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <div className="progress-container" style={{ margin: 0, height: '6px' }}>
                  <div className="progress-fill" style={{
                    width: `${progresso.progressPct}%`,
                    backgroundColor: progresso.remaining === 0 ? '#10b981' : 'var(--primary)',
                  }} />
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  faltam {progresso.remaining}
                  {progresso.remaining > 0 && ` · precisa de ~${porDia.toFixed(1)} por dia`}
                </div>
              </div>
              <span className={`badge-pill ${porDia > 2 ? 'badge-danger' : porDia > 1 ? 'badge-warning' : 'badge-success'}`}>
                {progresso.remaining === 0 ? 'Meta cumprida' : porDia > 2 ? 'Atrasada' : porDia > 1 ? 'Atenção' : 'No ritmo'}
              </span>
            </>
          ) : (
            <span style={{ flex: '1 1 auto', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
              Sem meta definida para o período
            </span>
          )}
        </div>
      ))}
    </div>

    {/* ---------------- Risco do mês ---------------- */}
    {(risco.semCobertura.length > 0 || risco.semVinculo.length > 0) && (
      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <Cabecalho
          titulo="Risco do mês"
          contador={risco.semCobertura.length + risco.semVinculo.length}
          tom="danger"
        />

        {risco.semCobertura.map(({ colaborador, monitor, alvo }) => (
          <div key={colaborador.id} style={{
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            padding: '0.8rem 1.15rem', borderTop: '1px solid var(--border-color)',
            borderLeft: '3px solid var(--danger)', backgroundColor: 'var(--danger-light)',
          }}>
            <span className="badge-pill badge-danger">0 de {alvo}</span>
            <div style={{ flex: '1 1 300px', fontSize: '0.85rem' }}>
              <b>{colaborador.name}</b> — nenhuma monitoria válida no mês
              {monitor && <span style={{ color: 'var(--text-muted)' }}> · carteira de {monitor.name}</span>}
            </div>
          </div>
        ))}

        {risco.semVinculo.map((c) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            padding: '0.8rem 1.15rem', borderTop: '1px solid var(--border-color)',
          }}>
            <span className="badge-pill badge-warning">Sem carteira</span>
            <div style={{ flex: '1 1 300px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text-main)' }}>{c.name}</b> — sem monitora vinculada, então
              não entra em meta nenhuma. Resolver em Equipe.
            </div>
          </div>
        ))}
      </div>
    )}

    {/* ---------------- Rodapé ---------------- */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem', flexWrap: 'wrap', padding: '0 0.25rem',
    }}>
      <div className="global-search" style={{ minWidth: '280px', padding: '0.45rem 0.9rem' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por atendimento, protocolo, título ou colaboradora..."
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
        />
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onVerRelatorios}>
        Ver histórico completo em Relatórios →
      </button>
    </div>
  </div>
);

const Cabecalho = ({ titulo, contador, nota, tom }: {
  titulo: string; contador?: number; nota?: string; tom?: 'danger' | 'warning';
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    padding: '0.8rem 1.15rem', backgroundColor: 'var(--bg-app)',
  }}>
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      display: 'flex', alignItems: 'center', gap: '0.5rem',
    }}>
      {titulo}
      {contador !== undefined && (
        <span className={`badge-pill ${tom === 'danger' ? 'badge-danger' : tom === 'warning' ? 'badge-warning' : 'badge-info'}`}>
          {contador}
        </span>
      )}
    </span>
    {nota && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{nota}</span>}
  </div>
);
