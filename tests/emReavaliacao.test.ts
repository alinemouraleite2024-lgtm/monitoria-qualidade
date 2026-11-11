// Situação "Em reavaliação" (script 21): devolvida pelo supervisor, entregue e aguardando ajustes.
// Decisões da gestão da qualidade (11/11/2026): conta como realizada e ocupa a vaga da meta; a nota fica fora da
// média até o reenvio; não vai para a fila de validação nem para a área privada; nunca conta duas vezes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countsTowardGoal, countsForCarteiraGoal, editavelPelaMonitora, isAwaitingValidation, isEmReavaliacao } from '../src/domain/monitoringRules';
import { entraNaMedia, evolucaoMensal, notaParaExibir, resumirNotas } from '../src/domain/resultadosService';
import { foiDevolvida, getDetalheDaColaboradora, getFilaDeValidacao, getPendencias } from '../src/domain/queueService';
import { estaGuardada, podeSerGuardada, rascunhoPrivado, statusParaExibir } from '../src/domain/areaPrivada';
import { eventosDaTransicao } from '../src/domain/historicoCalibracao';
import { entraNaFilaDeValidacao } from '../src/domain/validacaoService';
import { mensagemAtendimentoJaRegistrado } from '../src/domain/duplicidade';
import type { ColaboradorGoal, Monitoring, SystemSettings } from '../src/types/domain';

const OUT = { year: 2026, month: 9 };   // mês base zero: outubro
const m = (p: Partial<Monitoring>): Monitoring => ({
  id: 'MON-1', competencia: '2026-10', date: '2026-10-15T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'c-1', canal: 'Telefone', tipo: 'Regular',
  status: 'Pendente', finalScore: 90, scores: [], enviadoEm: '2026-10-20T10:00:00Z', ...p,
} as Monitoring);
const reav = (p: Partial<Monitoring> = {}) => m({ status: 'Em reavaliação', adjustmentReason: 'Revisar o critério 12 (fictício).', reviewedAt: '2026-10-22T10:00:00Z', ...p });
const meta = (alvo: number): ColaboradorGoal => ({ id: 'g-1', monitorId: 'usr-1', colaboradorId: 'c-1', year: 2026, month: 9, targetQty: alvo });
const ctx = (monitorings: Monitoring[], alvo = 3) => ({ monitorings, goals: [meta(alvo)], collaborators: [] });

test('em reavaliação conta como realizada e entregue, mas fora da média', () => {
  assert.equal(isEmReavaliacao(reav()), true);
  assert.equal(countsTowardGoal(reav()), true);
  assert.equal(countsForCarteiraGoal(reav()), true);
  assert.equal(entraNaMedia(reav()), false);
  assert.equal(isAwaitingValidation(reav()), false);
  assert.equal(notaParaExibir(reav({ finalScore: 94.05 })), '94.05%');
  assert.equal(statusParaExibir(reav()), 'Em reavaliação');
});

test('média e totais: entregue sim, média não', () => {
  const r = resumirNotas([reav({ id: 'A', finalScore: 50 }), m({ id: 'B', finalScore: 90 }), m({ id: 'C', status: 'Validada', finalScore: 100 })]);
  assert.equal(r.total, 3);
  assert.equal(r.entregues, 3);
  assert.equal(r.emReavaliacao, 1);
  assert.equal(r.consideradas, 2);
  assert.equal(r.media, 95);
  assert.equal(r.porStatus['Em reavaliação'], 1);
  const ev = evolucaoMensal([reav({ id: 'A' }), m({ id: 'B' })], OUT, 1)[0];
  assert.equal(ev.entregues, 2);
  assert.equal(ev.consideradas, 1);
});

test('meta: ocupa a vaga uma única vez, com estado próprio, e não aparece de novo à parte', () => {
  const d = getDetalheDaColaboradora(ctx([reav({ id: 'A' }), m({ id: 'B' })]), 'usr-1', 'c-1', OUT);
  const e = d.escopos[0];
  assert.deepEqual(e.vagas.map((v) => v.estado), ['em-reavaliacao', 'em-validacao', 'aberta']);
  assert.equal(e.devolvidas.length, 0);
  assert.equal(e.rascunhos.length, 0);
  assert.equal(e.progresso.entregues, 2);
  assert.equal(d.foraDeMeta.length, 0);
});

test('devolver e reenviar não muda a contagem: sempre 1', () => {
  const etapas = [m({ id: 'X' }), reav({ id: 'X' }), m({ id: 'X', status: 'Pendente' }), m({ id: 'X', status: 'Validada' })];
  for (const x of etapas) {
    const e = getDetalheDaColaboradora(ctx([x]), 'usr-1', 'c-1', OUT).escopos[0];
    assert.equal(e.progresso.entregues, 1, x.status);
    assert.equal(e.vagas.filter((v) => v.monitoring).length, 1, x.status);
    assert.equal(e.devolvidas.length + e.rascunhos.length, 0, x.status);
  }
});

test('forma anterior ao 21 (Rascunho + motivo) continua reconhecida como devolvida, fora da vaga', () => {
  const antiga = m({ id: 'L', status: 'Rascunho', adjustmentReason: 'Corrigir (fictício)' });
  assert.equal(foiDevolvida(antiga), true);
  const e = getDetalheDaColaboradora(ctx([antiga]), 'usr-1', 'c-1', OUT).escopos[0];
  assert.equal(e.devolvidas.length, 1);
  assert.equal(e.vagas[0].estado, 'aberta');
});

test('monitora: aparece em "Precisa da sua ação" para corrigir, não como rascunho', () => {
  const p = getPendencias([reav({ id: 'A' }), m({ id: 'R', status: 'Rascunho', enviadoEm: undefined })], 'usr-1', OUT);
  assert.deepEqual(p.devolvidas.map((x) => x.id), ['A']);
  assert.deepEqual(p.rascunhos.map((x) => x.id), ['R']);
  assert.equal(editavelPelaMonitora('Em reavaliação'), true);
  assert.equal(editavelPelaMonitora('Pendente'), false);
});

test('supervisor: fora da fila de validação', () => {
  const fila = getFilaDeValidacao([reav({ id: 'A' }), m({ id: 'B' })], '2026-11-11');
  assert.deepEqual(fila.map((f) => f.monitoring.id), ['B']);
  const settings = { requireGestorValidation: true } as SystemSettings;
  assert.equal(entraNaFilaDeValidacao(reav(), [], settings), false);
});

test('privacidade: nunca volta à área privada nem pode ser guardada', () => {
  assert.equal(rascunhoPrivado(reav()), false);
  assert.equal(estaGuardada(reav({ aguardandoLiberacao: true })), false);
  assert.equal(podeSerGuardada(reav()), false);
});

test('histórico (modo local): devolução, ajustes e reenvio', () => {
  const ctxEv = { responsavelId: 'usr-2', agora: '2026-10-22T10:00:00Z' };
  const pend = m({ historico: [{ id: 'e1', tipo: 'ENVIO', rodada: 1 } as never] });
  const dev = eventosDaTransicao(pend, reav({ historico: pend.historico }), ctxEv);
  assert.deepEqual(dev.map((e) => e.tipo), ['DEVOLUCAO']);
  assert.equal(dev[0].consideracoes, 'Revisar o critério 12 (fictício).');
  const hist = [...(pend.historico ?? []), ...dev];
  assert.deepEqual(eventosDaTransicao(reav({ historico: hist }), reav({ historico: hist, finalScore: 92 }), ctxEv), []);
  const re = eventosDaTransicao(reav({ historico: hist }), m({ historico: hist }), ctxEv);
  assert.deepEqual(re.map((e) => [e.tipo, e.rodada]), [['REENVIO', 2]]);
  assert.deepEqual(eventosDaTransicao(m({ status: 'Rascunho', adjustmentReason: 'x' }), reav(), ctxEv), []);
});

test('atendimento repetido aponta a monitoria em reavaliação', () => {
  assert.match(mensagemAtendimentoJaRegistrado(reav({ protocolo: 'MON-2026-0001' })), /em reavaliação: MON-2026-0001/);
});

test('configuração do supervisor (início em 2026-10) continua valendo, inclusive no reenvio', () => {
  const areas = [{ id: 'area-1', name: 'Relacionamento', gestorId: 'gestor-1', monitorIds: ['usr-1'], active: true }] as never;
  const cfg = { requireGestorValidation: true, validacaoDesdePorGestor: { 'gestor-1': '2026-10' } } as SystemSettings;
  // em reavaliação: fora da fila em qualquer competência
  assert.equal(entraNaFilaDeValidacao(reav({ competencia: '2026-10' }), areas, cfg), false);
  assert.equal(entraNaFilaDeValidacao(reav({ competencia: '2026-08' }), areas, cfg), false);
  // reenviada (Pendente): segue a competência inicial — outubro entra, agosto fica fora (em Relatórios)
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-10' }), areas, cfg), true);
  assert.equal(entraNaFilaDeValidacao(m({ competencia: '2026-08' }), areas, cfg), false);
});
