import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAguardandoValidacao, getFilaDeValidacao, referenciaDaEspera, textoDaEspera } from '../src/domain/queueService';
import type { EventoCalibracao, Monitoring } from '../src/types/domain';

const m = (p: Partial<Monitoring>): Monitoring => ({
  id: 'MON-1', competencia: '2026-10', date: '2026-10-13T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'c-1', canal: 'WhatsApp', tipo: 'Regular',
  status: 'Pendente', finalScore: 90, scores: [], ...p,
} as Monitoring);
const ev = (tipo: EventoCalibracao['tipo'], ocorridoEm: string): EventoCalibracao =>
  ({ id: ocorridoEm, tipo, rodada: 1, statusResultante: 'Pendente', nota: 90, responsavelId: 'usr-1', ocorridoEm, origem: 'portal' } as EventoCalibracao);
const HOJE = '2026-11-11';

test('caso real: atendimento de 13/10 enviado em 10/11 espera 1 dia, não 29', () => {
  const r = getFilaDeValidacao([m({ id: 'MON-10037', enviadoEm: '2026-11-10T19:47:30.000Z', historico: [ev('ENVIO', '2026-11-10T19:47:30.000Z')] })], HOJE);
  assert.equal(r[0].dias, 1);
  assert.equal(r[0].referenciaExata, true);
  assert.equal(textoDaEspera(r[0].dias, r[0].referenciaExata), 'na fila há 1 dia');
});

test('sem histórico, usa a data de envio gravada', () => {
  assert.deepEqual(referenciaDaEspera(m({ enviadoEm: '2026-11-05T13:00:00.000Z' })), { desde: '2026-11-05', exata: true });
});

test('registro antigo sem envio conta do atendimento, e a tela diz isso', () => {
  const r = getFilaDeValidacao([m({ id: 'MON-10001' })], HOJE);
  assert.equal(r[0].dias, 29);
  assert.equal(r[0].referenciaExata, false);
  assert.match(textoDaEspera(r[0].dias, false), /desde o atendimento/);
});

test('depois de devolução, a espera conta do reenvio', () => {
  const x = m({ enviadoEm: '2026-10-20T12:00:00.000Z', historico: [ev('ENVIO', '2026-10-20T12:00:00.000Z'), ev('DEVOLUCAO', '2026-10-25T12:00:00.000Z'), ev('REENVIO', '2026-11-09T12:00:00.000Z')] });
  assert.equal(getFilaDeValidacao([x], HOJE)[0].dias, 2);
});

test('ordem: quem espera há mais tempo pelo envio vem primeiro, não o atendimento mais antigo', () => {
  const recente = m({ id: 'MON-10037', date: '2026-08-01T12:00:00Z', enviadoEm: '2026-11-10T12:00:00.000Z' });
  const antiga = m({ id: 'MON-10018', date: '2026-10-30T12:00:00Z', enviadoEm: '2026-10-31T12:00:00.000Z' });
  const semEnvio = m({ id: 'MON-10007', date: '2026-08-10T12:00:00Z' });
  assert.deepEqual(getFilaDeValidacao([recente, antiga, semEnvio], HOJE).map((f) => f.monitoring.id), ['MON-10007', 'MON-10018', 'MON-10037']);
});

test('empate: mesma espera, ordem estável pelo código', () => {
  const a = m({ id: 'MON-10010', enviadoEm: '2026-11-01T12:00:00.000Z' });
  const b = m({ id: 'MON-10009', enviadoEm: '2026-11-01T15:00:00.000Z' });
  assert.deepEqual(getFilaDeValidacao([a, b], HOJE).map((f) => f.monitoring.id), ['MON-10009', 'MON-10010']);
});

test('enviada hoje aparece como tal', () => {
  const r = getFilaDeValidacao([m({ enviadoEm: `${HOJE}T15:00:00.000Z` })], HOJE);
  assert.equal(textoDaEspera(r[0].dias, r[0].referenciaExata), 'enviada hoje');
});

test('fila da monitora usa a mesma referência, sem mudar o recorte por competência', () => {
  const r = getAguardandoValidacao([m({ enviadoEm: '2026-11-10T19:47:30.000Z' }), m({ id: 'MON-2', competencia: '2026-09', enviadoEm: '2026-11-10T19:47:30.000Z' })], 'usr-1', { year: 2026, month: 9 }, HOJE);
  assert.equal(r.length, 1);
  assert.equal(r[0].dias, 1);
});

test('a data do atendimento e o restante do registro não mudam', () => {
  const x = m({ enviadoEm: '2026-11-10T19:47:30.000Z' });
  const copia = structuredClone(x);
  const r = getFilaDeValidacao([x], HOJE)[0];
  assert.deepEqual(x, copia);
  assert.equal(r.monitoring.date, '2026-10-13T12:00:00Z');
  assert.equal(r.monitoring.competencia, '2026-10');
});
