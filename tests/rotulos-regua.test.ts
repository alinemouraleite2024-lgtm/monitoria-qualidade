// Rótulos da régua no painel de análise do gestor (Etapa A, 26/10/2026).
//   node --import ./tests/registrar-ts.mjs --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CRITERIA } from '../src/mockData';
import { rotuloDaResposta, tomDaResposta, respostasDoChecklist } from '../src/domain/rotulosRegua';

const c = (id: string) => INITIAL_CRITERIA.find((x) => x.id === id)!;

test('escala: 2 · Excelente, 1 · Parcial, 0 · Não realizou, N/A; vazio é "não respondido"', () => {
  assert.equal(rotuloDaResposta(c('crit-06'), 2), '2 · Excelente');
  assert.equal(rotuloDaResposta(c('crit-06'), 1), '1 · Parcial');
  assert.equal(rotuloDaResposta(c('crit-06'), 0), '0 · Não realizou');
  assert.equal(rotuloDaResposta(c('crit-06'), 'N/A'), 'N/A · Não se aplica');
  assert.equal(rotuloDaResposta(c('crit-06'), ''), 'não respondido');
  assert.equal(tomDaResposta(c('crit-06'), 1), 'meio');
});

test('eliminatório: 2 é "Não ocorreu" e 0 é "Sim, ocorreu" (o oposto da leitura do número)', () => {
  const elim = INITIAL_CRITERIA.find((x) => x.eliminatorio)!;
  assert.equal(rotuloDaResposta(elim, 2), 'Não ocorreu');
  assert.equal(rotuloDaResposta(elim, 0), 'Sim, ocorreu');
  assert.equal(tomDaResposta(elim, 0), 'ruim');
});

test('faixa de tempo e múltipla escolha', () => {
  const faixa = INITIAL_CRITERIA.find((x) => x.tipoResposta === 'FAIXA_TEMPO');
  if (faixa) assert.equal(rotuloDaResposta(faixa, 1.33), '1.33 · 5-15min · Bom');
  assert.equal(rotuloDaResposta(c('crit-01'), 'Solicitação'), 'Solicitação');
  assert.equal(tomDaResposta(c('crit-01'), 'Solicitação'), 'neutro');
});

test('checklist: nota "x de 2" e cada sub-pergunta com o texto da régua; aceita NAO e NÃO', () => {
  const ck = c('crit-24');
  assert.equal(rotuloDaResposta(ck, 1), '1 de 2');
  const subs = ck.subPerguntas!;
  const r = respostasDoChecklist(ck, { [subs[0].id]: 'NAO', [subs[1].id]: 'SIM' } as never);
  assert.deepEqual(r.map((x) => x.resposta), ['NÃO', 'SIM']);
  assert.equal(r[0].texto, subs[0].texto);
  assert.equal(respostasDoChecklist(ck, { [subs[0].id]: 'NÃO' } as never)[1].resposta, 'não respondida');
});
