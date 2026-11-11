// Histórico de calibração (Etapa B, 26/10/2026).
//
// Cada monitoria guarda a sequência de acontecimentos: envios e reenvios da monitora, decisões
// do gestor e observações complementares — com a rodada, a nota daquele momento, quem e quando.
// No modo compartilhado quem grava é o banco (script 14, gatilho na tabela de monitorias); este
// módulo só lê. No modo local, `eventosDaTransicao` aplica as MESMAS regras do gatilho, para que
// os dois modos produzam o mesmo histórico.
//
// O histórico é só de acréscimo: nada aqui altera ou remove um evento já registrado.

import type { EventoCalibracao, Monitoring, TipoEventoCalibracao } from '../types/domain';

export const LIMITE_CONSIDERACOES = 2000;

/** Quem age no evento: a monitora (envia), o gestor (decide) ou o gestor em observação. */
export type AutoriaDoEvento = 'monitora' | 'gestor' | 'observacao';

const DO_MONITOR: TipoEventoCalibracao[] = ['ENVIO', 'REENVIO'];

export const autoriaDoEvento = (tipo: TipoEventoCalibracao): AutoriaDoEvento =>
  DO_MONITOR.includes(tipo) ? 'monitora' : tipo === 'OBSERVACAO' ? 'observacao' : 'gestor';

export const ROTULO_EVENTO: Record<TipoEventoCalibracao, string> = {
  ENVIO: 'Enviada para validação',
  REENVIO: 'Reenviada após correção',
  VALIDACAO: 'Validada',
  DEVOLUCAO: 'Devolvida para correção',
  REPROVACAO: 'Reprovada',
  ZERAMENTO_CONFIRMADO: 'Eliminatório confirmado — nota zerada',
  ELIMINATORIO_AFASTADO: 'Eliminatório afastado',
  CANCELAMENTO: 'Cancelada',
  OBSERVACAO: 'Observação complementar',
};

/** Contador "123/2000"; `excedeu` quando passa do limite. Conta como o banco (caracteres, sem as bordas). */
export const contagemConsideracoes = (texto: string): { usados: number; excedeu: boolean; rotulo: string } => {
  const usados = [...(texto ?? '').trim()].length;
  return { usados, excedeu: usados > LIMITE_CONSIDERACOES, rotulo: `${usados}/${LIMITE_CONSIDERACOES}` };
};

/** Eventos em ordem cronológica (empate: ordem de gravação). */
export const ordenarEventos = (eventos: EventoCalibracao[] | undefined): EventoCalibracao[] =>
  [...(eventos ?? [])].sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm) || String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true }));

/**
 * Nota de cada envio e a diferença para o envio anterior — o que mostra se a pontuação mudou
 * depois de uma devolução. Só ENVIO/REENVIO entram: a decisão repete a nota da rodada.
 */
export const variacoesDeNota = (eventos: EventoCalibracao[] | undefined): Map<string, number | null> => {
  const r = new Map<string, number | null>();
  let anterior: number | null = null;
  for (const e of ordenarEventos(eventos)) {
    if (!DO_MONITOR.includes(e.tipo) || typeof e.nota !== 'number') continue;
    r.set(String(e.id), anterior === null ? null : Math.round((e.nota - anterior) * 100) / 100);
    anterior = e.nota;
  }
  return r;
};

const jaEnviada = (m: Monitoring | undefined, eventos: EventoCalibracao[]): boolean =>
  eventos.some((e) => DO_MONITOR.includes(e.tipo)) || Boolean(m && m.status !== 'Rascunho');

const rodadaAtual = (eventos: EventoCalibracao[], jaFoi: boolean): number =>
  Math.max(0, ...eventos.filter((e) => DO_MONITOR.includes(e.tipo)).map((e) => e.rodada), jaFoi ? 1 : 0);

/**
 * Modo local: os eventos que uma mudança da monitoria produz (as regras do gatilho do 14).
 * `antes` ausente = monitoria nova. Rascunho salvo não gera evento.
 */
export const eventosDaTransicao = (
  antes: Monitoring | undefined,
  depois: Monitoring,
  ctx: { responsavelId: string; agora: string; consideracoes?: string; criterios?: EventoCalibracao['criterios'] },
): EventoCalibracao[] => {
  const hist = antes?.historico ?? depois.historico ?? [];
  const novo = (tipo: TipoEventoCalibracao, rodada: number, extra: Partial<EventoCalibracao> = {}): EventoCalibracao => ({
    id: `ev-${ctx.agora}-${tipo}`, tipo, rodada, statusResultante: depois.status, nota: depois.finalScore,
    responsavelId: ctx.responsavelId, ocorridoEm: ctx.agora, origem: 'portal', ...extra,
  });
  const saiu = (s: Monitoring['status']) => antes?.status !== s && depois.status === s;
  const eventos: EventoCalibracao[] = [];

  // envio: da monitora, sempre que sai de Rascunho ou de Em reavaliação (ou nasce enviada).
  // 21: salvar ajustes mantém Em reavaliação e não é envio; Rascunho <-> Em reavaliação não é evento.
  if (depois.status === 'Em reavaliação' && antes?.status === 'Rascunho') return [];
  if (depois.status === 'Rascunho' && antes?.status === 'Em reavaliação') return [];
  if (depois.status !== 'Rascunho' && depois.status !== 'Cancelada' && depois.status !== 'Em reavaliação'
      && (!antes || antes.status === 'Rascunho' || antes.status === 'Em reavaliação')) {
    // já houve qualquer evento = já tinha sido enviada (ex.: devolvida antes do histórico existir)
    const rodada = rodadaAtual(hist, hist.length > 0) + 1;
    eventos.push(novo(rodada === 1 ? 'ENVIO' : 'REENVIO', rodada));
    // envio que já nasce validado (área sem exigência de validação) não é decisão de gestor
    return eventos;
  }
  if (!antes) return eventos;

  const rodada = Math.max(rodadaAtual(hist, jaEnviada(antes, hist)), 1);
  if (!antes.zerada && depois.zerada) {
    eventos.push(novo('ZERAMENTO_CONFIRMADO', rodada, { criterios: ctx.criterios ?? null }));
  }
  const texto = (ctx.consideracoes ?? '').trim() || null;
  if (saiu('Validada')) eventos.push(novo('VALIDACAO', rodada, { consideracoes: texto }));
  else if (saiu('Reprovada')) eventos.push(novo('REPROVACAO', rodada, { consideracoes: depois.motivoReprovacao ?? texto }));
  else if (saiu('Rascunho') || saiu('Em reavaliação')) eventos.push(novo('DEVOLUCAO', rodada, { consideracoes: depois.adjustmentReason ?? texto }));
  else if (saiu('Cancelada')) eventos.push(novo('CANCELAMENTO', rodada, { consideracoes: texto }));
  return eventos;
};

/** Modo local: a observação complementar — só um evento novo; a monitoria não muda. */
export const novaObservacao = (m: Monitoring, texto: string, responsavelId: string, agora: string): EventoCalibracao => {
  const hist = m.historico ?? [];
  return {
    id: `ev-${agora}-OBSERVACAO`, tipo: 'OBSERVACAO', rodada: Math.max(rodadaAtual(hist, jaEnviada(m, hist)), 1),
    statusResultante: m.status, nota: m.finalScore, consideracoes: texto.trim(), responsavelId, ocorridoEm: agora, origem: 'portal',
  };
};

/** Critérios eliminatórios marcados como ocorridos (resposta 0) — o que o zeramento confirma. */
export const eliminatoriosOcorridos = (
  m: Monitoring,
  criterios: { id: string; numero?: number | null; name: string; eliminatorio?: boolean }[],
): NonNullable<EventoCalibracao['criterios']> =>
  (m.scores || [])
    .filter((s) => Number(s.score) === 0 && s.score !== '' && criterios.find((c) => c.id === s.criterionId)?.eliminatorio)
    .map((s) => {
      const c = criterios.find((x) => x.id === s.criterionId)!;
      return { id: c.id, numero: c.numero ?? null, nome: c.name };
    });
