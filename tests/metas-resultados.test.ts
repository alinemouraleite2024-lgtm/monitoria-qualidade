// Metas no banco compartilhado (gravação por diferença) e resultados de qualidade (25/10/2026).
//
//   node --import ./tests/registrar-ts.mjs --test tests/
//
// Dados SINTÉTICOS, só dentro do teste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diferencas, gravarColecao, indexarDocumentos } from '../src/shared/compartilhado/documentos';
import { ErroBanco, type Transporte } from '../src/shared/compartilhado/transporte';
import { resumirNotas, resultadosPorColaboradora, evolucaoMensal, notaParaExibir, entraNaMedia } from '../src/domain/resultadosService';
import { getCarteiraProgress } from '../src/domain/goalService';
import { resolverMetasDoPeriodo } from '../src/domain/planoMetasService';
import type { ColaboradorGoal, Monitoring, MonitoringStatus } from '../src/types/domain';

const meta = (id: string, extra: Partial<ColaboradorGoal> = {}): ColaboradorGoal =>
  ({ id, monitorId: 'usr-1', colaboradorId: 'usr-4', year: 2026, month: 7, targetQty: 5, ...extra }) as ColaboradorGoal;

const mon = (id: string, status: MonitoringStatus, nota: number, extra: Partial<Monitoring> = {}): Monitoring =>
  ({ id, status, finalScore: nota, monitorId: 'usr-1', colaboradorId: 'usr-4', competencia: '2026-08', canal: 'WhatsApp',
    tipo: 'Regular', date: '2026-08-20T12:00:00Z', scores: [], ...extra }) as unknown as Monitoring;

/** Transporte de mentira: registra as chamadas e falha na N-ésima, se pedido. */
const falso = (falharNa?: number) => {
  const chamadas: { op: string; args: unknown[] }[] = [];
  const reg = (op: string, args: unknown[]) => {
    chamadas.push({ op, args });
    if (falharNa !== undefined && chamadas.length === falharNa) throw new ErroBanco('MI409', 'alterado por outra pessoa');
  };
  const t: Transporte = {
    selecionar: async () => [],
    chamar: async () => null as never,
    incluir: async (...a) => { reg('incluir', a); },
    alterar: async (...a) => { reg('alterar', a); return 2; },
  };
  return { t, chamadas };
};

test('diferenças: inclui o novo, altera o mudado, retira o que saiu; a ordem das chaves não conta', () => {
  const antes = [meta('a'), meta('b'), meta('c')];
  const depois = [{ targetQty: 5, month: 7, year: 2026, colaboradorId: 'usr-4', monitorId: 'usr-1', id: 'a' } as ColaboradorGoal,
    meta('b', { targetQty: 8 }), meta('d')];
  assert.deepEqual(diferencas(antes, depois), [
    { tipo: 'alterar', id: 'b' }, { tipo: 'incluir', id: 'd' }, { tipo: 'retirar', id: 'c' },
  ]);
  assert.deepEqual(diferencas(antes, antes), []);
});

test('diferenças: recusa item sem id e id repetido (não há como gravar com segurança)', () => {
  assert.throws(() => diferencas([], [meta('')]), /sem id/);
  assert.throws(() => diferencas([], [meta('x'), meta('x')]), /repetido/);
});

test('índice: só documentos ativos; chave do banco preservada', () => {
  const i = indexarDocumentos([
    { colecao: 'metas_colaborador', id: 'a', conteudo: { id: 'a' }, versao: 3, ordem: 0, ativo: true },
    { colecao: 'metas_colaborador', id: 'b', conteudo: { id: 'b' }, versao: 1, ordem: 1, ativo: false },
    { colecao: 'feriados', id: '#2', conteudo: { nome: 'x' }, versao: 1, ordem: 2, ativo: true },
  ]);
  assert.deepEqual(i['metas_colaborador/a'], { chave: 'a', versao: 3, ordem: 0 });
  assert.equal(i['metas_colaborador/b'], undefined);
  assert.deepEqual(i['feriados/#2'], { chave: '#2', versao: 1, ordem: 2 });
});

test('gravação: inclusão com a próxima ordem; alteração e retirada com a versão lida', async () => {
  const indice = indexarDocumentos([
    { colecao: 'metas_colaborador', id: 'a', conteudo: meta('a'), versao: 4, ordem: 6, ativo: true },
    { colecao: 'metas_colaborador', id: 'b', conteudo: meta('b'), versao: 1, ordem: 2, ativo: true },
  ]);
  const { t, chamadas } = falso();
  const n = await gravarColecao(t, 'metas_colaborador', indice, [meta('a'), meta('b')], [meta('a', { targetQty: 9 }), meta('n')]);
  assert.equal(n, 3);
  assert.deepEqual(chamadas, [
    { op: 'alterar', args: ['documentos', { colecao: 'metas_colaborador', id: 'a' }, { conteudo: meta('a', { targetQty: 9 }) }, 4] },
    { op: 'incluir', args: ['documentos', { colecao: 'metas_colaborador', id: 'n', conteudo: meta('n'), ordem: 7 }] },
    { op: 'alterar', args: ['documentos', { colecao: 'metas_colaborador', id: 'b' }, { ativo: false }, 1] },
  ]);
});

test('gravação: para na primeira recusa e diz quantas já entraram', async () => {
  const indice = indexarDocumentos([{ colecao: 'planos_metas', id: 'p1', conteudo: { id: 'p1' }, versao: 1, ordem: 0, ativo: true }]);
  const { t, chamadas } = falso(2);
  await assert.rejects(
    gravarColecao(t, 'planos_metas', indice, [{ id: 'p1', fim: '2026-12' }], [{ id: 'p1', fim: '2026-09' }, { id: 'p2', fim: '2026-12' }]),
    (e: unknown) => e instanceof ErroBanco && e.codigo === 'MI409' && /1 de 2 alterações já tinham sido gravadas/.test(e.message),
  );
  assert.equal(chamadas.length, 2);
});

test('gravação: item carregado sem versão conhecida não é alterado às cegas (MI428)', async () => {
  const { t } = falso();
  await assert.rejects(gravarColecao(t, 'metas_colaborador', {}, [meta('a')], [meta('a', { targetQty: 2 })]),
    (e: unknown) => e instanceof ErroBanco && e.codigo === 'MI428');
});

test('agosto/2026: meta sem monitora não entra no progresso; com a monitora, entra', () => {
  const agosto = { year: 2026, month: 7 };
  const semMonitor = [meta('w', { monitorId: '', canal: 'WhatsApp' }), meta('t', { monitorId: '', canal: 'Telefone' })];
  const monitorias = [mon('MON-1', 'Pendente', 96.77), mon('MON-3', 'Pendente', 69.05, { canal: 'Telefone' })];
  const antes = getCarteiraProgress(resolverMetasDoPeriodo([], semMonitor, agosto).metas, monitorias, 'usr-1', agosto);
  assert.equal(antes.hasGoal, false);
  const corrigidas = semMonitor.map((g) => ({ ...g, monitorId: 'usr-1' }));
  const depois = getCarteiraProgress(resolverMetasDoPeriodo([], corrigidas, agosto).metas, monitorias, 'usr-1', agosto);
  assert.equal(depois.target, 10);
  assert.equal(depois.cobertura, 2);
});

test('média: só Pendente, Validada e Concluída; rascunho, reprovada e cancelada ficam fora; zerada entra', () => {
  const ms = [mon('1', 'Pendente', 80), mon('2', 'Validada', 90), mon('3', 'Rascunho', 0), mon('4', 'Reprovada', 40),
    mon('5', 'Cancelada', 10), mon('6', 'Pendente', 0, { zerada: true })];
  const r = resumirNotas(ms);
  assert.equal(r.total, 6);
  assert.equal(r.consideradas, 3);
  assert.equal(r.media, 56.67);
  assert.equal(r.menor, 0);
  assert.equal(r.maior, 90);
  assert.equal(r.zeradas, 1);
  assert.deepEqual(r.porStatus, { Pendente: 2, Validada: 1, Rascunho: 1, Reprovada: 1, Cancelada: 1 });
  assert.equal(entraNaMedia(mon('x', 'Rascunho', 0)), false);
  assert.equal(resumirNotas([mon('3', 'Rascunho', 0)]).media, null);
});

test('resultados por colaboradora e evolução mensal', () => {
  const ms = [mon('1', 'Pendente', 80), mon('2', 'Pendente', 100, { colaboradorId: 'usr-3' }), mon('3', 'Pendente', 60),
    mon('4', 'Validada', 70, { competencia: '2026-09' })];
  const nomes: Record<string, string> = { 'usr-4': 'Allanis', 'usr-3': 'Nathalia' };
  const pc = resultadosPorColaboradora(ms.filter((m) => m.competencia === '2026-08'), (id) => nomes[id]);
  assert.deepEqual(pc.map((p) => [p.nome, p.total, p.media]), [['Allanis', 2, 70], ['Nathalia', 1, 100]]);
  const ev = evolucaoMensal(ms, { year: 2026, month: 8 }, 3);
  assert.deepEqual(ev.map((p) => [p.rotulo, p.consideradas, p.media]), [
    ['Julho de 2026', 0, null], ['Agosto de 2026', 3, 80], ['Setembro de 2026', 1, 70],
  ]);
});

test('volume de 35 monitorias por mês: contagens e média fecham com a soma das partes', () => {
  const ms: Monitoring[] = [];
  const colabs = ['usr-3', 'usr-4', 'usr-5', 'usr-6', 'usr-1'];
  for (let i = 0; i < 35; i += 1) {
    const status: MonitoringStatus = i % 7 === 0 ? 'Rascunho' : i % 5 === 0 ? 'Validada' : 'Pendente';
    ms.push(mon(`M${i}`, status, status === 'Rascunho' ? 0 : 60 + (i % 40), { colaboradorId: colabs[i % 5] }));
  }
  const r = resumirNotas(ms);
  const pc = resultadosPorColaboradora(ms, (id) => id);
  assert.equal(r.total, 35);
  assert.equal(pc.reduce((s, p) => s + p.total, 0), 35);
  assert.equal(pc.reduce((s, p) => s + p.consideradas, 0), r.consideradas);
  const soma = ms.filter(entraNaMedia).reduce((s, m) => s + m.finalScore, 0);
  assert.equal(r.media, Math.round((soma / r.consideradas) * 100) / 100);
  assert.equal(r.consideradas, 30);
});

test('nota para exibir: rascunho mostra "—", não 0,00%', () => {
  assert.equal(notaParaExibir(mon('1', 'Rascunho', 0)), '—');
  assert.equal(notaParaExibir(mon('2', 'Pendente', 69.05)), '69.05%');
});
