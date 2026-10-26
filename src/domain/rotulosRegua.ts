// Rótulo de uma resposta na régua — o que o gestor lê no painel de análise (Etapa A, 26/10/2026).
//
// Até aqui o detalhe da monitoria mostrava o valor cru ("2", "0", "1.33"): quem valida precisava
// lembrar que 2 num eliminatório é "não ocorreu" e 0 é "ocorreu", o oposto da leitura intuitiva.
// Os rótulos são os MESMOS do formulário de avaliação (MonitoringForm, getScaleOptions e os
// botões do eliminatório) — o gestor lê a monitoria nas palavras em que ela foi feita.
//
// Só leitura: nada aqui calcula nota nem altera resposta.

import type { Criterion, MonitoringScore } from '../types/domain';

const ESCALA: Record<string, string> = { '2': 'Excelente', '1': 'Parcial', '0': 'Não realizou' };
const FAIXA_TEMPO: Record<string, string> = {
  '2': '<5min · Excelente', '1.33': '5-15min · Bom', '0.67': '>15min · Regular', '0': 'Ruim',
};

/** "2 · Excelente", "Não ocorreu", "N/A · Não se aplica", "Solicitação" — ou "não respondido". */
export const rotuloDaResposta = (criterio: Criterion | undefined, score: MonitoringScore['score']): string => {
  if (score === '' || score === null || score === undefined) return 'não respondido';
  const v = String(score);
  if (v === 'N/A') return 'N/A · Não se aplica';
  if (!criterio) return v;
  if (criterio.eliminatorio) {
    if (score === 2 || v === '2') return 'Não ocorreu';
    if (score === 0 || v === '0') return 'Sim, ocorreu';
    return v;
  }
  if (criterio.tipoResposta === 'MULTIPLA_ESCOLHA' || criterio.tipoResposta === 'SIM_NAO') return v;
  if (criterio.tipoResposta === 'FAIXA_TEMPO') return FAIXA_TEMPO[v] ? `${v} · ${FAIXA_TEMPO[v]}` : v;
  if (criterio.tipoResposta === 'CHECKLIST_SIM_NAO') return `${Number(score).toFixed(2).replace(/\.?0+$/, '')} de 2`;
  return ESCALA[v] ? `${v} · ${ESCALA[v]}` : v;
};

/** Tom de cor do rótulo: máxima, intermediária, mínima/ocorreu, neutra. */
export const tomDaResposta = (criterio: Criterion | undefined, score: MonitoringScore['score']): 'ok' | 'meio' | 'ruim' | 'neutro' => {
  if (score === '' || score === null || score === undefined || score === 'N/A') return 'neutro';
  // Eliminatório antes do tipo: os quatro (crit-25..28) são SIM_NAO, e "Sim, ocorreu" precisa
  // aparecer em vermelho — é exatamente o que o gestor não pode deixar passar.
  if (criterio?.eliminatorio) return Number(score) === 0 ? 'ruim' : Number(score) === 2 ? 'ok' : 'neutro';
  if (criterio?.tipoResposta === 'MULTIPLA_ESCOLHA' || criterio?.tipoResposta === 'SIM_NAO') return 'neutro';
  const n = Number(score);
  if (!Number.isFinite(n)) return 'neutro';
  if (n >= 2) return 'ok';
  if (n <= 0) return 'ruim';
  return 'meio';
};

/** Respostas do checklist na ordem da régua: [{ texto, resposta }]. Sub-resposta ausente é dita. */
export const respostasDoChecklist = (
  criterio: Criterion | undefined,
  sub: MonitoringScore['subRespostas'],
): { id: string; texto: string; resposta: 'SIM' | 'NÃO' | 'não respondida' }[] => {
  const perguntas = criterio?.subPerguntas ?? [];
  const valores = (sub ?? {}) as Record<string, string>;
  const ids = perguntas.length ? perguntas.map((p) => p.id) : Object.keys(valores);
  return ids.map((id) => {
    const r = valores[id];
    return {
      id,
      texto: perguntas.find((p) => p.id === id)?.texto ?? id,
      resposta: r === 'SIM' ? 'SIM' : r === 'NAO' || r === 'NÃO' ? 'NÃO' : 'não respondida',
    };
  });
};
