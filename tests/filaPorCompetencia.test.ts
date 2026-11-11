import assert from 'node:assert/strict';
import { test } from 'node:test';
import { competenciaInicialDaValidacao, entraNaFilaDeValidacao, foraDaFilaDeValidacao } from '../src/domain/validacaoService';
import { countsTowardGoal } from '../src/domain/monitoringRules';
import type { Area, Monitoring, SystemSettings } from '../src/types/domain';

const AREAS: Area[] = [
  { id: 'area-1', name: 'Relacionamento', gestorId: 'gestor-1', monitorIds: ['usr-1'], active: true },
  { id: 'area-2', name: 'Outra', gestorId: 'gestor-2', monitorIds: ['usr-2'], active: true },
];
const base: SystemSettings = { requireGestorValidation: true, defasagemCompetencia: 1 };
const comInicio: SystemSettings = { ...base, validacaoDesdePorGestor: { 'gestor-1': '2026-10' } };
const m = (p: Partial<Monitoring>): Monitoring => ({
  id: 'MON-1', competencia: '2026-10', date: '2026-10-13T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'c-1', canal: 'WhatsApp', tipo: 'Regular',
  status: 'Pendente', finalScore: 90, scores: [], ...p,
} as Monitoring);

test('sem configuração, o supervisor vê todas as pendentes, como antes', () => {
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-08' }), AREAS, base), true);
});

test('com início em outubro: agosto e setembro saem, outubro em diante fica', () => {
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-08' }), AREAS, comInicio), false);
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-09' }), AREAS, comInicio), false);
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-10' }), AREAS, comInicio), true);
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-12' }), AREAS, comInicio), true);
});

test('a configuração é por supervisor: outra área segue sem recorte', () => {
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-08', monitorId: 'usr-2' }), AREAS, comInicio), true);
});

test('monitor sem área: segue sem recorte', () => {
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-08', monitorId: 'usr-9' }), AREAS, comInicio), true);
});

test('valor inválido é ignorado, nunca esconde nada', () => {
  for (const v of ['2026-13', 'outubro', '', '2026-1']) {
    assert.equal(competenciaInicialDaValidacao({ ...base, validacaoDesdePorGestor: { 'gestor-1': v } }, 'gestor-1'), null, v);
  }
});

test('sem competência gravada, usa a do atendimento', () => {
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '', date: '2026-08-10T12:00:00Z' }), AREAS, comInicio), false);
});

test('só pendentes: rascunho, validada e reprovada nunca estão na fila nem "fora" dela', () => {
  for (const status of ['Rascunho', 'Validada', 'Reprovada', 'Cancelada'] as const) {
    assert.equal(entraNaFilaDeValidacao(m({ status, competencia: '2026-10' }), AREAS, comInicio), false);
    assert.equal(foraDaFilaDeValidacao(m({ status, competencia: '2026-08' }), AREAS, comInicio), false);
  }
  assert.equal(foraDaFilaDeValidacao(m({ competencia: '2026-08' }), AREAS, comInicio), true);
});

test('organiza a fila sem mudar o registro nem a meta', () => {
  const x = m({ competencia: '2026-08' });
  const copia = structuredClone(x);
  foraDaFilaDeValidacao(x, AREAS, comInicio);
  assert.deepEqual(x, copia);
  assert.equal(x.status, 'Pendente');
  assert.equal(countsTowardGoal(x), true);
});
