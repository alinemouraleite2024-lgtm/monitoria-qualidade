// Duplicidade na criação de monitorias (29/10/2026).
//
// A conferência de 29/10 achou seis pares de monitorias idênticas na homologação, criadas com
// 1–2 segundos de diferença (segundo clique em "Concluir" enquanto o banco respondia), e uma
// avaliação de agosto que repetia um atendimento já cadastrado com o número e o título
// digitados de outro jeito.
//
// MESMO ATENDIMENTO = mesma monitora, mesma colaboradora, mesmo canal, mesmo dia e mesmo minuto
// de início. Número do atendimento, título, categoria e término NÃO entram: são justamente os
// campos que cada pessoa preenche de um jeito. É a mesma regra do gatilho do script 15
// (app.chave_atendimento) — o banco é quem decide; aqui o portal só avisa antes de enviar.
//
// Não contam como conflito (casos legítimos): outra monitora (calibração entre monitoras), tipo
// Calibração, monitoria anterior Cancelada ou Reprovada, e registro sem início preenchido.

import type { Monitoring } from '../types/domain';

const INICIO = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/;

/** Colaboradora | canal | AAAA-MM-DDTHH:MI — ou null quando falta algum dos três. */
export const chaveAtendimento = (m: Pick<Monitoring, 'colaboradorId' | 'canal' | 'inicioAtendimento'>): string | null => {
  const colab = (m.colaboradorId ?? '').trim();
  const canal = String(m.canal ?? '').trim();
  const ini = INICIO.exec(String(m.inicioAtendimento ?? ''));
  if (!colab || !canal || !ini) return null;
  return `${colab}|${canal}|${ini[1]}T${ini[2]}`;
};

const foraDaRegra = (m: Pick<Monitoring, 'status' | 'tipo'>) =>
  m.status === 'Cancelada' || m.status === 'Reprovada' || m.tipo === 'Calibração';

/**
 * A monitoria já registrada pela mesma monitora para o mesmo atendimento, se houver.
 * `monitorId` é quem está registrando (no formulário novo, quem está logado).
 */
export const atendimentoJaRegistrado = (
  nova: Pick<Monitoring, 'id' | 'colaboradorId' | 'canal' | 'inicioAtendimento' | 'status' | 'tipo'>,
  monitorId: string,
  existentes: Monitoring[],
): Monitoring | null => {
  const chave = chaveAtendimento(nova);
  if (!chave || !monitorId || foraDaRegra(nova)) return null;
  return existentes
    .filter((m) => m.id !== nova.id && m.monitorId === monitorId && !foraDaRegra(m) && chaveAtendimento(m) === chave)
    .sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
};

/** Tolerância do alerta complementar: inícios até 10 minutos de diferença, no mesmo dia. */
export const TOLERANCIA_MINUTOS = 10;

const minutos = (inicio?: string): { dia: string; min: number } | null => {
  const ini = INICIO.exec(String(inicio ?? ''));
  if (!ini) return null;
  const [h, m] = ini[2].split(':').map(Number);
  return { dia: ini[1], min: h * 60 + m };
};

/** Número do atendimento comparável: só letras e dígitos, maiúsculas, sem zeros à esquerda. */
export const numeroComparavel = (n?: string): string =>
  String(n ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+(?=.)/, '');

/**
 * ALERTA COMPLEMENTAR (decisão de 29/10/2026): o que não é bloqueado, mas parece o mesmo
 * atendimento com pequenas diferenças de preenchimento — mesma monitora, mesma colaboradora,
 * mesmo dia e (início até TOLERANCIA_MINUTOS de diferença, em qualquer canal, OU o mesmo número
 * de atendimento). Não bloqueia: a monitora confirma que é outro atendimento. Os casos que o
 * banco já recusa (atendimentoJaRegistrado) não entram aqui.
 */
export const possiveisDuplicidades = (
  nova: Pick<Monitoring, 'id' | 'colaboradorId' | 'canal' | 'inicioAtendimento' | 'numeroAtendimento' | 'status' | 'tipo'>,
  monitorId: string,
  existentes: Monitoring[],
): Monitoring[] => {
  const t = minutos(nova.inicioAtendimento);
  const colab = (nova.colaboradorId ?? '').trim();
  if (!t || !colab || !monitorId || foraDaRegra(nova)) return [];
  const chave = chaveAtendimento(nova);
  const num = numeroComparavel(nova.numeroAtendimento);
  return existentes
    .filter((m) => {
      if (m.id === nova.id || m.monitorId !== monitorId || foraDaRegra(m) || (m.colaboradorId ?? '').trim() !== colab) return false;
      if (chave && chaveAtendimento(m) === chave) return false;   // esse o banco já recusa
      const o = minutos(m.inicioAtendimento);
      if (!o || o.dia !== t.dia) return false;
      return Math.abs(o.min - t.min) <= TOLERANCIA_MINUTOS || (num !== '' && numeroComparavel(m.numeroAtendimento) === num);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
};

const dataHora = (inicio?: string) => {
  const ini = INICIO.exec(String(inicio ?? ''));
  if (!ini) return '';
  const [a, m, d] = ini[1].split('-');
  return `${d}/${m}/${a} ${ini[2]}`;
};

/** Pergunta do alerta complementar: a monitora confirma que é outro atendimento. */
export const perguntaPossivelDuplicidade = (parecidas: Monitoring[]): string =>
  'Possível duplicidade — você já tem, para esta colaboradora e neste dia, monitoria(s) parecida(s):\n\n' +
  parecidas.map((m) => `• ${m.protocolo || m.id} · ${m.status} · ${m.canal || '—'} · início ${dataHora(m.inicioAtendimento)} · nº ${m.numeroAtendimento || '—'}`).join('\n') +
  '\n\nSe for o MESMO atendimento, cancele e use a monitoria existente. É outro atendimento e deseja gravar?';

/** Mensagem para a monitora — o mesmo sentido da recusa MI410 do banco. */
export const mensagemAtendimentoJaRegistrado = (existente: Monitoring): string => {
  const codigo = existente.protocolo || existente.id;
  return existente.status === 'Rascunho'
    ? `Este atendimento já tem um rascunho seu: ${codigo}. Continue por ele em vez de criar outra monitoria.`
    : existente.status === 'Em reavaliação'
    ? `Este atendimento já tem uma monitoria sua em reavaliação: ${codigo}. Faça os ajustes e reenvie por ela em vez de criar outra monitoria.`
    :`Este atendimento já foi avaliado por você: ${codigo}, situação ${existente.status} (início em ${dataHora(existente.inicioAtendimento)}). ` +
      'Uma nova monitoria do mesmo atendimento não foi criada.\n\n' +
      'Mesmo atendimento = mesma colaboradora, mesmo canal, mesmo dia e mesmo horário de início, ainda que o número do atendimento ou o título tenham sido digitados de outro jeito.';
};
