// Duplicidade na criação de monitorias (29/10/2026) — a regra do portal, igual à do script 15.
//   node --import ./tests/registrar-ts.mjs --test tests/*.test.ts
// Dados fictícios. Os casos reais que motivaram a regra aparecem com identificadores trocados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atendimentoJaRegistrado, chaveAtendimento, mensagemAtendimentoJaRegistrado, numeroComparavel, perguntaPossivelDuplicidade, possiveisDuplicidades } from '../src/domain/duplicidade';
import { montarDadosParaSalvar } from '../src/shared/compartilhado/mapeamento';
import type { Monitoring } from '../src/types/domain';

const mon = (p: Partial<Monitoring>): Monitoring => ({
  id: 'MON-1', protocolo: 'MON-2026-0001', monitorId: 'usr-a', colaboradorId: 'col-1', canal: 'Telefone', tipo: 'Regular',
  status: 'Pendente', competencia: '2026-08', date: '2026-08-25T12:00:00Z', inicioAtendimento: '2026-08-25T16:28',
  fimAtendimento: '2026-08-25T16:31', numeroAtendimento: '677441', numeroTitulo: '17779', categoriaAtendimento: 'CADASTRO',
  scores: [], finalScore: 100, evidencias: [], links: [],
  ...p,
} as Monitoring);

const existente = mon({});
const nova = (p: Partial<Monitoring>) => mon({ id: '', protocolo: '', status: 'Rascunho', ...p });

test('chave do atendimento: colaboradora, canal e início ao minuto (segundos e separador não importam)', () => {
  assert.equal(chaveAtendimento(existente), 'col-1|Telefone|2026-08-25T16:28');
  assert.equal(chaveAtendimento(mon({ inicioAtendimento: '2026-08-25 16:28:50' })), 'col-1|Telefone|2026-08-25T16:28');
  assert.equal(chaveAtendimento(mon({ inicioAtendimento: '' })), null);
  assert.equal(chaveAtendimento(mon({ inicioAtendimento: '16:28' })), null);
  assert.equal(chaveAtendimento(mon({ colaboradorId: '' })), null);
});

test('mesmo atendimento com número, título, categoria e término digitados de outro jeito → já registrado (caso do AGO-009)', () => {
  const outra = nova({ numeroAtendimento: '11591', numeroTitulo: 'B-2101', categoriaAtendimento: 'OUTRA', fimAtendimento: '2026-08-25T16:31:50' });
  assert.equal(atendimentoJaRegistrado(outra, 'usr-a', [existente])?.id, 'MON-1');
});

test('atendimentos diferentes NÃO são bloqueados', () => {
  const casos: [string, Partial<Monitoring>, string?][] = [
    ['um minuto depois', { inicioAtendimento: '2026-08-25T16:29' }],
    ['outro dia, mesmo horário', { inicioAtendimento: '2026-08-26T16:28' }],
    ['outro canal no mesmo minuto', { canal: 'WhatsApp' }],
    ['outra colaboradora no mesmo minuto', { colaboradorId: 'col-2' }],
    ['outra monitora avaliando o mesmo atendimento (calibração entre monitoras)', {}, 'usr-b'],
    ['tipo Calibração', { tipo: 'Calibração' }],
    ['sem início preenchido (rascunho incompleto)', { inicioAtendimento: '' }],
  ];
  for (const [nome, p, quem] of casos) assert.equal(atendimentoJaRegistrado(nova(p), quem ?? 'usr-a', [existente]), null, nome);
});

test('anterior Cancelada ou Reprovada não bloqueia; Rascunho, Pendente e Validada bloqueiam', () => {
  for (const status of ['Cancelada', 'Reprovada'] as const) assert.equal(atendimentoJaRegistrado(nova({}), 'usr-a', [mon({ status })]), null, status);
  for (const status of ['Rascunho', 'Pendente', 'Validada'] as const) assert.ok(atendimentoJaRegistrado(nova({}), 'usr-a', [mon({ status })]), status);
});

test('editar a própria monitoria não conflita com ela mesma; com cópia antiga, aponta a mais antiga', () => {
  assert.equal(atendimentoJaRegistrado(existente, 'usr-a', [existente]), null);
  const copia = mon({ id: 'MON-2', protocolo: 'MON-2026-0002' });
  assert.equal(atendimentoJaRegistrado(nova({}), 'usr-a', [copia, existente])?.id, 'MON-1');
});

test('mensagem diz qual monitoria existe e em que situação; rascunho pede para continuar por ele', () => {
  const m1 = mensagemAtendimentoJaRegistrado(existente);
  assert.match(m1, /MON-2026-0001, situação Pendente \(início em 25\/08\/2026 16:28\)/);
  assert.match(m1, /não foi criada/);
  assert.match(mensagemAtendimentoJaRegistrado(mon({ status: 'Rascunho' })), /já tem um rascunho seu: MON-2026-0001\. Continue por ele/);
});

test('a chave de criação vai só na criação, nunca na edição', () => {
  const m = mon({ chaveCriacao: '11111111-2222-4333-8444-555555555555' });
  assert.equal(montarDadosParaSalvar(m, [], false, false).chaveCriacao, '11111111-2222-4333-8444-555555555555');
  assert.equal(montarDadosParaSalvar(m, [], true, false).chaveCriacao, undefined);
  assert.equal(montarDadosParaSalvar(mon({}), [], false, false).chaveCriacao, undefined);
});

test('alerta complementar: parecida com pequena diferença de preenchimento pede confirmação (não bloqueia)', () => {
  const casos: [string, Partial<Monitoring>][] = [
    ['início um minuto depois', { inicioAtendimento: '2026-08-25T16:29' }],
    ['início 10 minutos antes', { inicioAtendimento: '2026-08-25T16:18' }],
    ['outro canal, início 3 minutos depois', { canal: 'WhatsApp', inicioAtendimento: '2026-08-25T16:31' }],
    ['mesmo número (com zeros e pontuação), outro horário do dia', { inicioAtendimento: '2026-08-25T09:00', numeroAtendimento: '0677-441' }],
  ];
  for (const [nome, p] of casos) {
    const n = nova(p);
    assert.equal(atendimentoJaRegistrado(n, 'usr-a', [existente]), null, nome + ' — não bloqueia');
    assert.deepEqual(possiveisDuplicidades(n, 'usr-a', [existente]).map((m) => m.id), ['MON-1'], nome + ' — alerta');
  }
});

test('alerta complementar: sem alerta quando é claramente outro atendimento ou já é bloqueio', () => {
  const casos: [string, Partial<Monitoring>, string?][] = [
    ['11 minutos de diferença, número diferente', { inicioAtendimento: '2026-08-25T16:39', numeroAtendimento: 'X-1' }],
    ['outro dia', { inicioAtendimento: '2026-08-26T16:28' }],
    ['outra colaboradora', { colaboradorId: 'col-2', inicioAtendimento: '2026-08-25T16:29' }],
    ['outra monitora', { inicioAtendimento: '2026-08-25T16:29' }, 'usr-b'],
    ['tipo Calibração', { tipo: 'Calibração', inicioAtendimento: '2026-08-25T16:29' }],
    ['mesmo minuto (já é bloqueio, não alerta)', {}],
  ];
  for (const [nome, p, quem] of casos) assert.deepEqual(possiveisDuplicidades(nova(p), quem ?? 'usr-a', [existente]), [], nome);
  for (const status of ['Cancelada', 'Reprovada'] as const)
    assert.deepEqual(possiveisDuplicidades(nova({ inicioAtendimento: '2026-08-25T16:29' }), 'usr-a', [mon({ status })]), [], status);
});

test('número comparável e texto da pergunta', () => {
  assert.equal(numeroComparavel(' 00957 '), '957');
  assert.equal(numeroComparavel('k-290'), 'K290');
  assert.equal(numeroComparavel('0'), '0');
  const p = perguntaPossivelDuplicidade([existente]);
  assert.ok(p.includes('MON-2026-0001 · Pendente · Telefone · início 25/08/2026 16:28 · nº 677441'), p);
  assert.ok(p.endsWith('É outro atendimento e deseja gravar?'), p);
});
