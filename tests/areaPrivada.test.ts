import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  competenciaIniciada, conferirLote, dentroDaAntecedencia, estaGuardada, ORIENTACAO_SEM_PRAZO, podeSerGuardada, rascunhoPrivado,
  separarAreaPrivada, statusParaExibir,
} from '../src/domain/areaPrivada';
import { countsTowardGoal } from '../src/domain/monitoringRules';
import { entraNaMedia, notaParaExibir, resumirNotas } from '../src/domain/resultadosService';
import { getPendencias } from '../src/domain/queueService';
import { montarDadosParaSalvar } from '../src/shared/compartilhado/mapeamento';
import type { Monitoring } from '../src/types/domain';

const m = (p: Partial<Monitoring>): Monitoring => ({
  id: 'MON-1', competencia: '2026-10', date: '2026-10-15T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'c-1', canal: 'Telefone', tipo: 'Regular',
  status: 'Rascunho', finalScore: 0, scores: [], ...p,
} as Monitoring);
const guardada = (p: Partial<Monitoring> = {}) => m({ aguardandoLiberacao: true, finalScore: 82.93, ...p });

// Sem prazo (13/11/2026): o tempo não muda nada numa monitoria guardada.
test('sem prazo: guardada há 1, 6 ou 13 meses continua guardada, privada e enviável só por ação da monitora', () => {
  const antiga = guardada({ id: 'MON-1', competencia: '2025-10', concluidaEm: '2025-10-20T10:00:00Z' });
  for (const hoje of ['2025-11-20', '2026-04-20', '2026-11-20']) {
    assert.equal(estaGuardada(antiga), true, hoje);
    assert.equal(statusParaExibir(antiga), 'Aguardando liberação', hoje);
    assert.equal(countsTowardGoal(antiga), false, hoje);
    assert.equal(entraNaMedia(antiga), false, hoje);
    assert.deepEqual(separarAreaPrivada([antiga], 'usr-1').guardadas.map((x) => x.id), ['MON-1'], hoje);
    const lote = conferirLote([antiga], hoje);
    assert.deepEqual(lote.podem.map((x) => x.id), ['MON-1'], hoje);
    assert.equal(lote.bloqueadas.length, 0, hoje);
    assert.equal('vencidas' in lote, false, hoje);
  }
});

test('sem prazo: a orientação da tela diz isso com todas as letras', () => {
  assert.equal(ORIENTACAO_SEM_PRAZO, 'As monitorias guardadas permanecem privadas, sem prazo de expiração. Você decide quando enviá-las para validação.');
});

test('competência futura: envio só depois de começar; preparação até 12 meses', () => {
  assert.equal(competenciaIniciada('2026-11', '2026-11-01'), true);
  assert.equal(competenciaIniciada('2026-12', '2026-11-30'), false);
  assert.equal(dentroDaAntecedencia('2027-11', '2026-11-10'), true);
  assert.equal(dentroDaAntecedencia('2027-12', '2026-11-10'), false);
});

test('guardada: rótulo próprio, sem deixar de ser Rascunho', () => {
  assert.equal(statusParaExibir(guardada()), 'Aguardando liberação');
  assert.equal(statusParaExibir(m({})), 'Rascunho');
  assert.equal(statusParaExibir(m({ status: 'Pendente', aguardandoLiberacao: true })), 'Pendente');
  assert.equal(estaGuardada(m({ status: 'Pendente', aguardandoLiberacao: true })), false);
});

test('guardada não conta como entregue: meta, média e nota exibida', () => {
  assert.equal(countsTowardGoal(guardada()), false);
  assert.equal(entraNaMedia(guardada()), false);
  assert.equal(notaParaExibir(guardada()), '—');
  assert.equal(resumirNotas([guardada(), m({ id: 'MON-2' })]).porStatus['Aguardando liberação'], 1);
});

test('devolvida fica fora da área privada e não pode ser guardada', () => {
  const dev = m({ adjustmentReason: 'Corrigir' });
  assert.equal(rascunhoPrivado(dev), false);
  assert.equal(podeSerGuardada(dev), false);
  assert.equal(podeSerGuardada(m({ enviadoEm: '2026-10-20T10:00:00Z' })), false);
  assert.equal(podeSerGuardada(m({})), true);
  assert.equal(podeSerGuardada(null), true);
});

test('área privada: só as da própria monitora, separadas', () => {
  const lista = [guardada({ id: 'MON-1' }), m({ id: 'MON-2' }), m({ id: 'MON-3', adjustmentReason: 'x' }), m({ id: 'MON-4', status: 'Pendente' }), guardada({ id: 'MON-5', monitorId: 'usr-2' })];
  const { rascunhos, guardadas } = separarAreaPrivada(lista, 'usr-1');
  assert.deepEqual(rascunhos.map((x) => x.id), ['MON-2']);
  assert.deepEqual(guardadas.map((x) => x.id), ['MON-1']);
});

test('fila da monitora: guardada sai de "Precisa da sua ação"', () => {
  const p = getPendencias([guardada({ id: 'MON-1' }), m({ id: 'MON-2' }), m({ id: 'MON-3', adjustmentReason: 'x' })], 'usr-1', { year: 2026, month: 9 });
  assert.deepEqual(p.rascunhos.map((x) => x.id), ['MON-2']);
  assert.deepEqual(p.guardadas.map((x) => x.id), ['MON-1']);
  assert.deepEqual(p.devolvidas.map((x) => x.id), ['MON-3']);
});

test('lote: conferência prévia aponta o que não pode ir', () => {
  const r = conferirLote([guardada({ id: 'MON-1', competencia: '2026-09' }), guardada({ id: 'MON-2', competencia: '2026-10' }), guardada({ id: 'MON-3', competencia: '2026-12' }), m({ id: 'MON-4' })], '2026-11-20');
  assert.deepEqual(r.podem.map((x) => x.id), ['MON-1', 'MON-2']);
  assert.deepEqual(r.bloqueadas.map((b) => b.monitoria.id), ['MON-3', 'MON-4']);
  assert.match(r.bloqueadas[0].motivo, /01\/12\/2026/);
  assert.deepEqual(r.porCompetencia, [{ competencia: '2026-09', quantidade: 1 }, { competencia: '2026-10', quantidade: 1 }]);
});

test('salvar: "guardar" só vai quando pedido, e leva a nota como conferência', () => {
  const dados = montarDadosParaSalvar(m({ finalScore: 82.93 }), [], false, false, true);
  assert.equal(dados.guardar, true);
  assert.equal(dados.finalScore, 82.93);
  const rascunho = montarDadosParaSalvar(m({ finalScore: 82.93, aguardandoLiberacao: true }), [], true, false);
  assert.equal('guardar' in rascunho, false);
  assert.equal('finalScore' in rascunho, false);
});
