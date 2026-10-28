import { useState } from 'react';
import { Send, RotateCcw, Check, X, AlertCircle, ShieldOff, Ban, MessageSquare, History } from 'lucide-react';
import {
  ROTULO_EVENTO, autoriaDoEvento, contagemConsideracoes, ordenarEventos, variacoesDeNota,
} from '../../domain/historicoCalibracao';
import type { EventoCalibracao, TipoEventoCalibracao, User } from '../../types/domain';

// Histórico de calibração (Etapa B, 26/10/2026) — a linha do tempo da monitoria: o que a
// monitora enviou (com a nota de cada rodada) e o que o gestor decidiu ou observou. Usado no
// painel de análise do gestor e no formulário da monitora; quem vê o quê é decidido antes de
// chegar aqui (RLS no banco, escopo no modo local). Só leitura, exceto a observação.

const ICONE: Record<TipoEventoCalibracao, typeof Send> = {
  ENVIO: Send, REENVIO: Send, VALIDACAO: Check, DEVOLUCAO: RotateCcw, REPROVACAO: X,
  ZERAMENTO_CONFIRMADO: AlertCircle, ELIMINATORIO_AFASTADO: ShieldOff, CANCELAMENTO: Ban, OBSERVACAO: MessageSquare,
};
const COR: Record<TipoEventoCalibracao, string> = {
  ENVIO: 'var(--info)', REENVIO: 'var(--info)', VALIDACAO: 'var(--primary)', DEVOLUCAO: 'var(--warning)',
  REPROVACAO: 'var(--danger)', ZERAMENTO_CONFIRMADO: 'var(--danger)', ELIMINATORIO_AFASTADO: 'var(--warning)',
  CANCELAMENTO: 'var(--text-muted)', OBSERVACAO: 'var(--text-muted)',
};
const QUEM = { monitora: 'Monitora', gestor: 'Gestor', observacao: 'Gestor · observação' } as const;

const nota = (n: number | null | undefined) => (typeof n === 'number' ? n.toFixed(2).replace('.', ',') : '—');
const quando = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };
// Uma chave por observação em preparo (https e localhost têm crypto.randomUUID).
const novaChave = () => crypto.randomUUID();

interface Props {
  /** Ausente = histórico indisponível neste ambiente (banco sem o script 14). */
  eventos: EventoCalibracao[] | undefined;
  users: User[];
  /** Gestor da equipe que pode acrescentar observação (não muda decisão nem situação). */
  podeObservar?: boolean;
  /** `chave` identifica a requisição: a mesma chave numa nova tentativa não duplica. `true` = gravada. */
  onObservar?: (texto: string, chave: string) => Promise<boolean>;
}

export const HistoricoCalibracao = ({ eventos, users, podeObservar = false, onObservar }: Props) => {
  const [rascunho, setRascunho] = useState<{ texto: string; chave: string } | null>(null);
  const [gravando, setGravando] = useState(false);

  if (eventos === undefined) {
    return <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>O histórico de calibração não está disponível para esta monitoria.</div>;
  }
  const lista = ordenarEventos(eventos);
  const variacao = variacoesDeNota(lista);
  const nome = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const contagem = contagemConsideracoes(rascunho?.texto ?? '');
  const podeGravar = !!rascunho && contagem.usados > 0 && !contagem.excedeu && !gravando;

  const gravar = async () => {
    if (!rascunho || !onObservar) return;
    setGravando(true);
    const ok = await onObservar(rascunho.texto.trim(), rascunho.chave);
    setGravando(false);
    if (ok) setRascunho(null);   // falhou: o texto e a MESMA chave ficam para a nova tentativa
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {lista.length === 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum evento registrado ainda.</div>
      )}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {lista.map((e) => {
          const autoria = autoriaDoEvento(e.tipo);
          const Icone = ICONE[e.tipo] ?? History;
          const delta = variacao.get(String(e.id));
          const daMonitora = autoria === 'monitora';
          return (
            <li key={e.id} data-autoria={autoria} style={{
              display: 'flex', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', borderLeft: `4px solid ${COR[e.tipo]}`,
              backgroundColor: daMonitora ? 'var(--info-light)' : autoria === 'observacao' ? 'transparent' : 'var(--bg-card)',
              marginLeft: daMonitora ? 0 : '1.25rem',
            }}>
              <Icone size={16} style={{ color: COR[e.tipo], flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: COR[e.tipo] }}>{ROTULO_EVENTO[e.tipo] ?? e.tipo}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rodada {e.rodada}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Nota {nota(e.nota)}
                    {typeof delta === 'number' && delta !== 0 && (
                      <span style={{ marginLeft: '0.3rem', color: delta > 0 ? 'var(--primary)' : 'var(--danger)' }}>
                        ({delta > 0 ? '+' : ''}{nota(delta)} em relação ao envio anterior)
                      </span>
                    )}
                    {delta === 0 && <span style={{ marginLeft: '0.3rem', color: 'var(--text-muted)' }}>(sem alteração de nota)</span>}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {QUEM[autoria]}: {nome(e.responsavelId)} · {quando(e.ocorridoEm)}
                  {e.origem === 'reconstituido' && (
                    <span className="badge-pill" title="Recuperado da trilha de auditoria; sem texto que não existia na época."
                      style={{ marginLeft: '0.4rem', fontSize: '0.62rem', border: '1px solid var(--border-color)' }}>
                      reconstituído da auditoria
                    </span>
                  )}
                </div>
                {e.criterios && e.criterios.length > 0 && (
                  <div style={{ fontSize: '0.8rem' }}>
                    Critério: {e.criterios.map((c) => `${c.numero ? `${String(c.numero).padStart(2, '0')} · ` : ''}${c.nome}`).join('; ')}
                  </div>
                )}
                {e.consideracoes && (
                  <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{e.consideracoes}</div>
                )}
                {!e.consideracoes && e.tipo === 'VALIDACAO' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem considerações.</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {podeObservar && onObservar && !rascunho && (
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => setRascunho({ texto: '', chave: novaChave() })}>
            <MessageSquare size={14} /> Adicionar observação
          </button>
        </div>
      )}
      {podeObservar && rascunho && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label className="form-label" htmlFor="observacao-complementar" style={{ margin: 0 }}>
            Observação complementar — não altera a decisão, a nota nem a situação da monitoria
          </label>
          <textarea id="observacao-complementar" className="form-control" rows={3} value={rascunho.texto}
            onChange={(ev) => setRascunho({ ...rascunho, texto: ev.target.value })} />
          <ContadorConsideracoes texto={rascunho.texto} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" disabled={gravando} onClick={() => setRascunho(null)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={!podeGravar} style={{ opacity: podeGravar ? 1 : 0.5 }} onClick={() => void gravar()}>
              <MessageSquare size={14} /> {gravando ? 'Registrando…' : 'Registrar observação'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** "123/2000", em vermelho quando passa do limite. */
export const ContadorConsideracoes = ({ texto }: { texto: string }) => {
  const c = contagemConsideracoes(texto);
  return (
    <div aria-live="polite" style={{ alignSelf: 'flex-end', fontSize: '0.72rem', color: c.excedeu ? 'var(--danger)' : 'var(--text-muted)', fontWeight: c.excedeu ? 700 : 400 }}>
      {c.rotulo}{c.excedeu && ' — acima do limite'}
    </div>
  );
};
