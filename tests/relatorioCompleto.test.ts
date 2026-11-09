// Relatório Completo da Monitoria: limite, aviso de dados pessoais e caminho até o banco.
// A limpeza do HTML depende do navegador e é testada lá; a conferência do banco, na suíte do 17.
//   node --import ./tests/registrar-ts.mjs --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITE_RELATORIO_BYTES, dadosPessoaisNoTexto, excedeLimite, tamanhoAmigavel, tamanhoEmBytes } from '../src/domain/relatorioCompleto';
import { montarDadosParaSalvar, paraMonitorias } from '../src/shared/compartilhado/mapeamento';
import { calcularNotaPrevia } from '../src/domain/importacaoChatGPT';
import { INITIAL_CRITERIA } from '../src/mockData';
import type { Monitoring } from '../src/types/domain';

test('limite conta bytes, não caracteres', () => {
  assert.equal(tamanhoEmBytes('é'), 2);
  assert.equal(excedeLimite('a'.repeat(LIMITE_RELATORIO_BYTES)), false);
  assert.equal(excedeLimite('a'.repeat(LIMITE_RELATORIO_BYTES + 1)), true);
  assert.equal(excedeLimite('😊'.repeat(LIMITE_RELATORIO_BYTES / 4 + 1)), true);
  assert.equal(tamanhoAmigavel('a'.repeat(1024)), '1,0 KB de 200 KB');
});

test('aviso de dados pessoais: CPF, telefone e e-mail', () => {
  assert.deepEqual(dadosPessoaisNoTexto('CPF 123.456.789-09'), ['CPF']);
  assert.deepEqual(dadosPessoaisNoTexto('12345678909'), ['CPF']);
  assert.deepEqual(dadosPessoaisNoTexto('Ligar em (11) 91234-5678'), ['telefone']);
  assert.deepEqual(dadosPessoaisNoTexto('11 3456-7890'), ['telefone']);
  assert.ok(dadosPessoaisNoTexto('11912345678').includes('telefone'), '11 dígitos seguidos podem ser CPF ou celular: avisa os dois');
  assert.deepEqual(dadosPessoaisNoTexto('fulano@exemplo.com.br'), ['e-mail']);
});

test('aviso não dispara em número de atendimento, CR, data, hora ou nota', () => {
  for (const t of ['Atendimento 06258, CR C-2 - 19', 'Processo 10140 · K-290', '21/08/2026 09h31–10h19', 'Nota 67,02% com peso 1,5', 'crit-25 = 2', 'MON-2026-0025', 'CR-TESTE-01']) {
    assert.deepEqual(dadosPessoaisNoTexto(t), [], t);
  }
});

const monitoria = (p: Partial<Monitoring> = {}) => ({ id: 'MON-1', status: 'Rascunho', scores: [], evidencias: [], links: [], ...p }) as unknown as Monitoring;

test('vai ao banco quando existe; vazio limpa; ausente não é enviado', () => {
  assert.equal(montarDadosParaSalvar(monitoria({ relatorioCompleto: '<p>a</p>' }), [], true, false).relatorioCompleto, '<p>a</p>');
  assert.equal(montarDadosParaSalvar(monitoria({ relatorioCompleto: '' }), [], true, false).relatorioCompleto, '');
  assert.equal('relatorioCompleto' in montarDadosParaSalvar(monitoria(), [], true, false), false);
});

const linhaBanco = (extra: Record<string, unknown> = {}) => ({ id: 'MON-2', status: 'Pendente', versao: 2, nota: 90.48, extras: {}, ...extra });

test('volta do banco; monitoria histórica fica sem o campo', () => {
  const [com] = paraMonitorias([linhaBanco({ relatorio_completo: '<p>a</p>' })], [], [], []);
  assert.equal(com.relatorioCompleto, '<p>a</p>');
  const [nulo] = paraMonitorias([linhaBanco({ relatorio_completo: null })], [], [], []);
  assert.equal('relatorioCompleto' in nulo, false);
  const [antes] = paraMonitorias([linhaBanco()], [], [], []);
  assert.equal('relatorioCompleto' in antes, false);
  assert.equal(nulo.finalScore, 90.48);
});

test('nota não enxerga o relatório', () => {
  const respostas = Object.fromEntries(INITIAL_CRITERIA.filter((c) => c.active).map((c) => [c.id, { score: c.id === 'crit-09' ? 1 : 2 }]));
  const nota = calcularNotaPrevia(INITIAL_CRITERIA.filter((c) => c.active), respostas);
  const comRelatorio = calcularNotaPrevia(INITIAL_CRITERIA.filter((c) => c.active), { ...respostas, relatorioCompleto: { score: 0 } });
  assert.equal(nota, comRelatorio);
});
