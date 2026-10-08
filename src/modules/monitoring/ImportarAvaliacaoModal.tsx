import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, ShieldAlert, X } from 'lucide-react';
import { canalLabel } from '../../constants/canais';
import { competenciaLabel } from '../../domain/period';
import { getScoreConcept } from '../../scoreUtils';
import {
  SCHEMA_IMPORTACAO,
  validarImportacao,
  type ContextoImportacao,
  type ResultadoImportacao,
} from '../../domain/importacaoChatGPT';

/**
 * Janela de importação da avaliação feita no ChatGPT.
 *
 * Três momentos, sempre nesta ordem: colar, validar, aplicar. Validar não toca no formulário;
 * aplicar só escreve no estado da tela. Nada aqui grava monitoria — o registro nasce quando a
 * monitora conclui as cinco etapas, pelo salvamento de sempre.
 */
interface Props {
  contexto: ContextoImportacao;
  /** Campos do formulário já preenchidos que a importação substituiria. */
  camposASubstituir: (r: ResultadoImportacao) => string[];
  onAplicar: (r: ResultadoImportacao) => void;
  onClose: () => void;
}

const CORES_CONFIANCA: Record<string, { cor: string; bg: string }> = {
  ALTA: { cor: '#166534', bg: '#dcfce7' },
  MEDIA: { cor: '#92400e', bg: '#fef3c7' },
  BAIXA: { cor: '#991b1b', bg: '#fee2e2' },
};

const exibirScore = (score: number | string, eliminatorio: boolean) => {
  if (eliminatorio && score === 2) return 'Não ocorreu';
  if (eliminatorio && score === 0) return 'Sim, ocorreu';
  return String(score);
};

export const ImportarAvaliacaoModal = ({ contexto, camposASubstituir, onAplicar, onClose }: Props) => {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [revisados, setRevisados] = useState<Record<string, boolean>>({});
  const [confirmaDuplicidade, setConfirmaDuplicidade] = useState(false);
  const [confirmaSubstituicao, setConfirmaSubstituicao] = useState(false);

  const validar = () => {
    setResultado(validarImportacao(texto, contexto));
    setRevisados({});
    setConfirmaDuplicidade(false);
    setConfirmaSubstituicao(false);
  };

  const substituidos = useMemo(
    () => (resultado && !resultado.erros.length ? camposASubstituir(resultado) : []),
    [resultado, camposASubstituir],
  );

  const ok = !!resultado && resultado.erros.length === 0;
  const faltaRevisar = ok ? resultado.revisoes.filter((r) => !revisados[r.criterionId]).length : 0;
  const podeAplicar =
    ok &&
    faltaRevisar === 0 &&
    (resultado.duplicidades.length === 0 || confirmaDuplicidade) &&
    (substituidos.length === 0 || confirmaSubstituicao);

  const conceito = resultado?.notaCalculada != null ? getScoreConcept(resultado.notaCalculada) : null;
  const qtdNA = resultado?.itens.filter((i) => i.score === 'N/A').length ?? 0;
  const qtdChecklist = resultado?.itens.filter((i) => i.tipoResposta === 'CHECKLIST_SIM_NAO').length ?? 0;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="importar-titulo">
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
        <div className="modal-header" style={{ marginBottom: '1rem' }}>
          <h3 id="importar-titulo" className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <ClipboardPaste size={20} style={{ color: '#008443' }} /> Importar avaliação do ChatGPT
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          Cole o bloco JSON gerado pelo agente de qualidade (formato <code>{SCHEMA_IMPORTACAO}</code>). A importação
          <b> só preenche o formulário</b>: nada é salvo até você revisar as cinco etapas e concluir. A nota é
          recalculada pelo MonitorIA.
        </p>

        <textarea
          className="form-control"
          rows={resultado ? 4 : 12}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setResultado(null); }}
          placeholder={'{\n  "schema": "monitoria-chatgpt/1",\n  "atendimento": { ... },\n  "criterios": [ ... ],\n  "relatorio": { ... }\n}'}
          style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.78rem', backgroundColor: '#f9fafb' }}
          aria-label="JSON da avaliação"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={validar} disabled={!texto.trim()}>
            Validar conteúdo
          </button>
        </div>

        {resultado && (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {resultado.erros.length > 0 && (
              <div style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={18} /> Importação bloqueada — {resultado.erros.length} problema(s) a corrigir
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.84rem', color: '#7f1d1d', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
                <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '0.6rem' }}>
                  Nada foi aplicado ao formulário. Corrija no ChatGPT, gere o JSON de novo e cole aqui.
                </div>
              </div>
            )}

            {ok && resultado.dados && (
              <div style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.85rem', color: '#14532d', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={16} /> Conteúdo válido — prévia do que será preenchido
                    </div>
                    <div><b>Colaborador:</b> {resultado.dados.colaboradorNome}</div>
                    <div><b>Canal:</b> {canalLabel(resultado.dados.canal)} · <b>Categoria:</b> {resultado.dados.categoriaAtendimento} · <b>Tipo:</b> {resultado.dados.tipo}</div>
                    <div><b>Atendimento:</b> {resultado.dados.numeroAtendimento} · <b>Título:</b> {resultado.dados.numeroTitulo}</div>
                    <div><b>Competência:</b> {competenciaLabel(resultado.dados.competencia)} · <b>Início:</b> {resultado.dados.inicioAtendimento.replace('T', ' ')} · <b>Fim:</b> {resultado.dados.fimAtendimento.replace('T', ' ')}</div>
                    <div>{resultado.itens.length} critérios · {qtdNA} N/A · {qtdChecklist} checklists · 6 blocos do relatório</div>
                    {resultado.revisadoPor && <div><b>Revisado no ChatGPT por:</b> {resultado.revisadoPor}</div>}
                  </div>
                  {conceito && (
                    <div style={{ textAlign: 'center', minWidth: '150px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#4b5563', fontWeight: 600, textTransform: 'uppercase' }}>Nota calculada pelo MonitorIA</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: conceito.color }}>{resultado.notaCalculada!.toFixed(2).replace('.', ',')}</div>
                      <div style={{ fontWeight: 700, color: '#374151' }}>{conceito.label}</div>
                      {resultado.notaEsperada != null && (
                        <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '0.25rem' }}>
                          Confere com o ChatGPT ({resultado.notaEsperada.toFixed(2).replace('.', ',')})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {resultado.avisos.length > 0 && (
              <div style={{ border: '1px solid #fde68a', backgroundColor: '#fffbeb', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.4rem', fontSize: '0.88rem' }}>Avisos ({resultado.avisos.length})</div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {resultado.avisos.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {ok && resultado.revisoes.length > 0 && (
              <div style={{ border: '1px solid #fca5a5', backgroundColor: '#fff', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <ShieldAlert size={18} /> Revisão obrigatória — confirme cada item ({resultado.revisoes.length - faltaRevisar}/{resultado.revisoes.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {resultado.revisoes.map((r) => {
                    const item = resultado.itens.find((i) => i.criterionId === r.criterionId);
                    return (
                      <label key={r.criterionId} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer', backgroundColor: r.grave ? '#fee2e2' : '#f9fafb', border: `1px solid ${r.grave ? '#f87171' : '#e5e7eb'}` }}>
                        <input
                          type="checkbox"
                          checked={!!revisados[r.criterionId]}
                          onChange={(e) => setRevisados({ ...revisados, [r.criterionId]: e.target.checked })}
                          style={{ marginTop: '3px' }}
                        />
                        <span style={{ fontSize: '0.82rem', color: '#111827' }}>
                          <b>{r.titulo}</b> — resposta: <b>{item ? exibirScore(item.score, item.eliminatorio) : '—'}</b>
                          <br />
                          <span style={{ color: r.grave ? '#991b1b' : '#6b7280' }}>{r.motivo}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {ok && resultado.duplicidades.length > 0 && (
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', border: '1px solid #fdba74', backgroundColor: '#fff7ed', borderRadius: '10px', padding: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmaDuplicidade} onChange={(e) => setConfirmaDuplicidade(e.target.checked)} style={{ marginTop: '3px' }} />
                <span style={{ fontSize: '0.84rem', color: '#7c2d12' }}>
                  <b>Atendimento já monitorado:</b>{' '}
                  {resultado.duplicidades.map((m) => `${m.protocolo || m.id} (${m.status})`).join(', ')}.
                  {' '}Confirmo que se trata de uma <b>nova</b> monitoria deste atendimento (reavaliação ou calibração).
                  A monitoria existente não será alterada.
                </span>
              </label>
            )}

            {ok && substituidos.length > 0 && (
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', border: '1px solid #fdba74', backgroundColor: '#fff7ed', borderRadius: '10px', padding: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={confirmaSubstituicao} onChange={(e) => setConfirmaSubstituicao(e.target.checked)} style={{ marginTop: '3px' }} />
                <span style={{ fontSize: '0.84rem', color: '#7c2d12' }}>
                  <b>O formulário já tem conteúdo.</b> Serão substituídos: {substituidos.join(', ')}. Confirmo a substituição.
                </span>
              </label>
            )}

            {resultado.itens.length > 0 && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 1rem', backgroundColor: '#f8fafc', fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>
                  Respostas por critério
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#6b7280', position: 'sticky', top: 0, backgroundColor: '#fff' }}>
                        <th style={{ padding: '0.4rem 0.75rem' }}>Critério</th>
                        <th style={{ padding: '0.4rem 0.5rem' }}>Resposta</th>
                        <th style={{ padding: '0.4rem 0.5rem' }}>Confiança</th>
                        <th style={{ padding: '0.4rem 0.75rem' }}>Justificativa / evidência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.itens.map((it) => {
                        const cor = it.confianca ? CORES_CONFIANCA[it.confianca] : null;
                        return (
                          <tr key={it.criterionId} style={{ borderTop: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                            <td style={{ padding: '0.45rem 0.75rem', color: '#111827' }}>
                              <span style={{ color: '#6b7280' }}>{it.criterionId}</span> {it.nome}
                              {it.eliminatorio && <span style={{ marginLeft: '0.35rem', color: '#b91c1c', fontWeight: 700 }}>· eliminatório</span>}
                            </td>
                            <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {exibirScore(it.score, it.eliminatorio)}
                              {it.bloqueadoPor && <div style={{ fontWeight: 400, color: '#2563eb' }}>pelo {it.bloqueadoPor}</div>}
                            </td>
                            <td style={{ padding: '0.45rem 0.5rem' }}>
                              {cor ? (
                                <span style={{ padding: '2px 8px', borderRadius: '999px', fontWeight: 700, fontSize: '0.7rem', color: cor.cor, backgroundColor: cor.bg }}>
                                  {it.confianca}
                                </span>
                              ) : <span style={{ color: '#9ca3af' }}>—</span>}
                              {it.revisaoHumana && <div style={{ color: '#b45309', fontSize: '0.7rem', marginTop: '2px' }}>revisão pedida</div>}
                            </td>
                            <td style={{ padding: '0.45rem 0.75rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{it.justificativa || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ok && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {podeAplicar
                    ? 'Aplicar preenche o formulário. Você ainda revisa e pode editar tudo antes de salvar.'
                    : 'Conclua as confirmações acima para aplicar.'}
                </span>
                <button type="button" className="btn btn-primary" disabled={!podeAplicar} onClick={() => onAplicar(resultado)}>
                  Aplicar ao formulário
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
