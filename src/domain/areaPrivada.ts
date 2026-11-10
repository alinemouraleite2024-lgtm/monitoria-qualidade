// Área privada da monitora: o que está em preparação e o que está guardado à espera de liberação.
//
// A guardada continua sendo Rascunho no banco (script 19), por isso já fica de fora de fila, meta,
// média e painéis: as regras de contagem só enxergam o que foi entregue. Aqui ficam apenas o rótulo,
// o prazo e o que pode ser enviado. A proteção contra o supervisor está no banco (script 18).

import type { Monitoring } from '../types/domain';

export const ROTULO_GUARDADA = 'Aguardando liberação';
export const MESES_DE_ANTECEDENCIA = 12;
export const DIAS_DE_ALERTA = 5;
export const MAXIMO_POR_LOTE = 100;

export const estaGuardada = (m: Monitoring): boolean =>
  m.status === 'Rascunho' && m.aguardandoLiberacao === true;

export const statusParaExibir = (m: Monitoring): string =>
  estaGuardada(m) ? ROTULO_GUARDADA : m.status;

/** Devolvida já foi enviada: segue "Precisa da sua ação" e o reenvio, fora da área privada. */
export const rascunhoPrivado = (m: Monitoring): boolean =>
  m.status === 'Rascunho' && !estaGuardada(m) && !m.adjustmentReason?.trim();

/** Só a monitora que já passou pelo envio não pode guardar; o banco confere de novo. */
export const podeSerGuardada = (m: Monitoring | null | undefined): boolean =>
  !m || (m.status === 'Rascunho' && !m.adjustmentReason?.trim() && !m.enviadoEm);

const somaMeses = (competencia: string, meses: number): string => {
  const [ano, mes] = competencia.split('-').map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

/** A competência já começou? Antes disso, a monitoria só pode ficar na área privada. */
export const competenciaIniciada = (competencia: string, hojeISO: string): boolean =>
  competencia <= hojeISO.slice(0, 7);

export const dentroDaAntecedencia = (competencia: string, hojeISO: string): boolean =>
  competencia <= somaMeses(hojeISO.slice(0, 7), MESES_DE_ANTECEDENCIA);

export const inicioDaCompetencia = (competencia: string): string => `${competencia}-01`;

/** Referência de entrega: dia 15 do mês seguinte à competência, em dias corridos. */
export const prazoDaCompetencia = (competencia: string): string => `${somaMeses(competencia, 1)}-15`;

export type NivelDoPrazo = 'normal' | 'proximo' | 'vencido';

const diaUTC = (iso: string): number => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};

/** Só informa: o prazo nunca bloqueia nem libera nada. */
export const situacaoDoPrazo = (competencia: string, hojeISO: string): { prazo: string; dias: number; nivel: NivelDoPrazo } => {
  const prazo = prazoDaCompetencia(competencia);
  const dias = Math.round((diaUTC(prazo) - diaUTC(hojeISO)) / 86400000);
  return { prazo, dias, nivel: dias < 0 ? 'vencido' : dias <= DIAS_DE_ALERTA ? 'proximo' : 'normal' };
};

export const dataBR = (iso: string): string => {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

const porCompetenciaECodigo = (a: Monitoring, b: Monitoring): number =>
  (a.competencia || '').localeCompare(b.competencia || '') || a.id.localeCompare(b.id, 'pt-BR', { numeric: true });

export const separarAreaPrivada = (monitorings: Monitoring[], monitorId: string): { rascunhos: Monitoring[]; guardadas: Monitoring[] } => {
  const minhas = monitorings.filter((m) => m.monitorId === monitorId).sort(porCompetenciaECodigo);
  return { rascunhos: minhas.filter(rascunhoPrivado), guardadas: minhas.filter(estaGuardada) };
};

export interface ConferenciaDoLote {
  podem: Monitoring[];
  bloqueadas: { monitoria: Monitoring; motivo: string }[];
  vencidas: Monitoring[];
  porCompetencia: { competencia: string; quantidade: number }[];
}

/** Conferência antes de confirmar. O banco repete todas elas, e é ele quem decide. */
export const conferirLote = (selecionadas: Monitoring[], hojeISO: string): ConferenciaDoLote => {
  const podem: Monitoring[] = [];
  const bloqueadas: ConferenciaDoLote['bloqueadas'] = [];
  for (const m of selecionadas) {
    if (!estaGuardada(m)) bloqueadas.push({ monitoria: m, motivo: 'não está guardada' });
    else if (!competenciaIniciada(m.competencia, hojeISO)) bloqueadas.push({ monitoria: m, motivo: `envio a partir de ${dataBR(inicioDaCompetencia(m.competencia))}` });
    else podem.push(m);
  }
  const contagem = new Map<string, number>();
  for (const m of podem) contagem.set(m.competencia, (contagem.get(m.competencia) ?? 0) + 1);
  return {
    podem,
    bloqueadas,
    vencidas: podem.filter((m) => situacaoDoPrazo(m.competencia, hojeISO).nivel === 'vencido'),
    porCompetencia: [...contagem].sort(([a], [b]) => a.localeCompare(b)).map(([competencia, quantidade]) => ({ competencia, quantidade })),
  };
};
