// Área privada da monitora: rascunhos e monitorias guardadas, de qualquer competência, e o envio para
// validação, uma a uma ou em lote. Só apresentação: as regras estão em domain/areaPrivada, e quem
// decide cada envio é o banco (api.liberar_monitorias).
import { useMemo, useRef, useState } from 'react';
import { Eye, Lock, Pencil, Send } from 'lucide-react';
import { canalLabel } from '../../constants/canais';
import { competenciaLabel } from '../../domain/period';
import {
  conferirLote, competenciaIniciada, dataBR, inicioDaCompetencia, MAXIMO_POR_LOTE, ORIENTACAO_SEM_PRAZO, separarAreaPrivada,
} from '../../domain/areaPrivada';
import type { Collaborator, Monitoring } from '../../types/domain';

export type ResultadoDoEnvio = { liberadas: string[]; ja_enviadas: string[] } | { erro: string };

interface Props {
  monitorings: Monitoring[];
  collaborators: Collaborator[];
  monitorId: string;
  hoje: string;
  onEditar: (m: Monitoring) => void;
  onVisualizar: (m: Monitoring) => void;
  onLiberar: (itens: Monitoring[]) => Promise<ResultadoDoEnvio>;
}

const dataHora = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

const Aba = ({ ativa, rotulo, n, onClick }: { ativa: boolean; rotulo: string; n: number; onClick: () => void }) => (
  <button type="button" role="tab" aria-selected={ativa} className={`btn ${ativa ? 'btn-primary' : 'btn-secondary'}`} onClick={onClick}>
    {rotulo} ({n})
  </button>
);

export const AreaPrivadaScreen = ({ monitorings, collaborators, monitorId, hoje, onEditar, onVisualizar, onLiberar }: Props) => {
  const [aba, setAba] = useState<'guardadas' | 'rascunhos'>('guardadas');
  const [competencia, setCompetencia] = useState('');
  const [colaborador, setColaborador] = useState('');
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState<Monitoring[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const travaRef = useRef(false);

  const { rascunhos, guardadas } = useMemo(() => separarAreaPrivada(monitorings, monitorId), [monitorings, monitorId]);
  const nomeDe = (id: string) => collaborators.find((c) => c.id === id)?.name ?? '—';
  const daAba = aba === 'guardadas' ? guardadas : rascunhos;
  const competencias = [...new Set(daAba.map((m) => m.competencia).filter(Boolean))].sort();
  const colaboradoras = [...new Set(daAba.map((m) => m.colaboradorId).filter(Boolean))].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'));
  const linhas = daAba.filter((m) => (!competencia || m.competencia === competencia) && (!colaborador || m.colaboradorId === colaborador));
  const selecionaveis = aba === 'guardadas' ? linhas.filter((m) => competenciaIniciada(m.competencia, hoje)) : [];
  const selecionadas = guardadas.filter((m) => marcadas.has(m.id));
  const todasMarcadas = selecionaveis.length > 0 && selecionaveis.every((m) => marcadas.has(m.id));
  const conferencia = confirmando ? conferirLote(confirmando, hoje) : null;

  const marcar = (id: string) => setMarcadas((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const marcarTodas = () => setMarcadas((a) => {
    const n = new Set(a);
    for (const m of selecionaveis) { if (todasMarcadas) n.delete(m.id); else n.add(m.id); }
    return n;
  });
  const trocarAba = (a: typeof aba) => { setAba(a); setCompetencia(''); setColaborador(''); setAviso(null); };

  const enviar = async () => {
    if (!conferencia || travaRef.current) return;
    travaRef.current = true;
    setEnviando(true);
    try {
      const r = await onLiberar(conferencia.podem);
      setConfirmando(null);
      if ('erro' in r) {
        setAviso({ tipo: 'erro', texto: r.erro });
        return;
      }
      setMarcadas(new Set());
      const ja = r.ja_enviadas.length ? ` ${r.ja_enviadas.length} já estava${r.ja_enviadas.length > 1 ? 'm' : ''} enviada${r.ja_enviadas.length > 1 ? 's' : ''}: ${r.ja_enviadas.join(', ')}.` : '';
      setAviso({ tipo: 'ok', texto: `${r.liberadas.length} ${r.liberadas.length === 1 ? 'monitoria enviada' : 'monitorias enviadas'} para validação.${ja}` });
    } finally {
      travaRef.current = false;
      setEnviando(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', margin: 0 }}>
          <Lock size={20} /> Área privada
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
          Só você vê estas monitorias. Elas não entram na fila, nas metas nem nos relatórios do supervisor até você enviar.
        </p>
        <p role="note" style={{ fontSize: '0.9rem', margin: '0.5rem 0 0', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-panel)' }}>
          {ORIENTACAO_SEM_PRAZO}
        </p>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Aba ativa={aba === 'guardadas'} rotulo="Aguardando liberação" n={guardadas.length} onClick={() => trocarAba('guardadas')} />
        <Aba ativa={aba === 'rascunhos'} rotulo="Rascunhos" n={rascunhos.length} onClick={() => trocarAba('rascunhos')} />
      </div>

      {aviso && (
        <div role={aviso.tipo === 'erro' ? 'alert' : 'status'} style={{
          padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.88rem',
          border: `1px solid ${aviso.tipo === 'erro' ? 'var(--danger)' : 'var(--primary)'}`,
          backgroundColor: aviso.tipo === 'erro' ? 'var(--danger-light)' : '#f0fdf4',
        }}>{aviso.texto}</div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ width: 'auto' }} aria-label="Competência" value={competencia} onChange={(e) => setCompetencia(e.target.value)}>
          <option value="">Todas as competências</option>
          {competencias.map((c) => <option key={c} value={c}>{competenciaLabel(c)}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }} aria-label="Colaboradora" value={colaborador} onChange={(e) => setColaborador(e.target.value)}>
          <option value="">Todas as colaboradoras</option>
          {colaboradoras.map((c) => <option key={c} value={c}>{nomeDe(c)}</option>)}
        </select>
        {aba === 'guardadas' && (
          <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }}
            disabled={selecionadas.length === 0 || selecionadas.length > MAXIMO_POR_LOTE} onClick={() => { setAviso(null); setConfirmando(selecionadas); }}>
            <Send size={15} /> Enviar selecionadas ({selecionadas.length})
          </button>
        )}
      </div>

      <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table-premium">
            <thead>
              <tr>
                {aba === 'guardadas' && (
                  <th><input type="checkbox" aria-label="Selecionar todas" checked={todasMarcadas} disabled={selecionaveis.length === 0} onChange={marcarTodas} /></th>
                )}
                <th>Código</th>
                <th>Colaboradora</th>
                <th>Canal</th>
                <th>Competência</th>
                <th>Nota</th>
                <th>Criada em</th>
                {aba === 'guardadas' && <th>Guardada em</th>}
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {aba === 'guardadas' ? 'Nenhuma monitoria aguardando liberação.' : 'Nenhum rascunho.'}
                </td></tr>
              )}
              {linhas.map((m) => {
                const iniciada = competenciaIniciada(m.competencia, hoje);
                return (
                  <tr key={m.id}>
                    {aba === 'guardadas' && (
                      <td><input type="checkbox" aria-label={`Selecionar ${m.id}`} checked={marcadas.has(m.id)} disabled={!iniciada} onChange={() => marcar(m.id)} /></td>
                    )}
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{m.id}</td>
                    <td>{nomeDe(m.colaboradorId)}</td>
                    <td>{m.canal ? canalLabel(m.canal) : '—'}</td>
                    <td>
                      {m.competencia ? competenciaLabel(m.competencia) : '—'}
                      {/* Competência futura: o envio só abre no primeiro dia dela (regra do 19, não é prazo). */}
                      {m.competencia && !iniciada && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>envio a partir de {dataBR(inicioDaCompetencia(m.competencia))}</div>
                      )}
                    </td>
                    <td>{aba === 'guardadas'
                      ? <span style={{ fontWeight: 700 }}>{m.finalScore.toFixed(2).replace('.', ',')}%</span>
                      : <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} title="A nota é fixada ao concluir">—</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{dataHora(m.criadoEm)}</td>
                    {aba === 'guardadas' && <td style={{ fontSize: '0.8rem' }}>{dataHora(m.concluidaEm)}</td>}
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm" title="Visualizar" aria-label={`Visualizar ${m.id}`} onClick={() => onVisualizar(m)}><Eye size={14} /></button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" title="Editar" aria-label={`Editar ${m.id}`} onClick={() => onEditar(m)}><Pencil size={14} /></button>{' '}
                      {aba === 'guardadas' && (
                        <button type="button" className="btn btn-primary btn-sm" disabled={!iniciada} title={iniciada ? 'Enviar para validação' : 'A competência ainda não começou'}
                          onClick={() => { setAviso(null); setConfirmando([m]); }}>
                          <Send size={14} /> Enviar para validação
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmando && conferencia && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="enviar-titulo">
          <div className="modal-content" style={{ maxWidth: '520px', width: '95%' }}>
            <h3 id="enviar-titulo" className="modal-title" style={{ marginTop: 0 }}>
              Enviar {conferencia.podem.length} {conferencia.podem.length === 1 ? 'monitoria' : 'monitorias'} para validação
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Depois do envio, elas ficam visíveis ao supervisor e não voltam para a área privada. É tudo ou nada: se uma tiver problema, nenhuma é enviada.
            </p>
            <ul style={{ fontSize: '0.88rem', margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
              {conferencia.porCompetencia.map((c) => <li key={c.competencia}>{competenciaLabel(c.competencia)}: {c.quantidade}</li>)}
            </ul>
            {conferencia.bloqueadas.length > 0 && (
              <div role="alert" style={{ fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                Corrija antes de enviar: {conferencia.bloqueadas.map((b) => `${b.monitoria.id} (${b.motivo})`).join(', ')}.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => setConfirmando(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={enviando || conferencia.podem.length === 0 || conferencia.bloqueadas.length > 0} aria-busy={enviando} onClick={enviar}>
                {enviando ? 'Enviando…' : 'Confirmar envio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
