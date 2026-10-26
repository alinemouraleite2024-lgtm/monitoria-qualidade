// Descrição dos anexos no painel de análise do gestor (Etapa A, 26/10/2026).
//   node --import ./tests/registrar-ts.mjs --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tipoAmigavel, tamanhoAmigavel, descricaoDoAnexo } from '../src/domain/evidencias';

test('tipo pela extensão do nome; sem extensão, pelo tipo MIME', () => {
  assert.equal(tipoAmigavel('Relatorio.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'DOCX');
  assert.equal(tipoAmigavel('AGO-04_Audio.wav', 'audio/wav'), 'WAV');
  assert.equal(tipoAmigavel('sem-extensao', 'application/pdf'), 'PDF');
  assert.equal(tipoAmigavel('sem-extensao', 'application/vnd.ms-excel'), 'VND');
  assert.equal(tipoAmigavel(undefined, undefined), '');
});

test('tamanho com vírgula decimal; outro formato passa como está', () => {
  assert.equal(tamanhoAmigavel('0.04 MB'), '0,04 MB');
  assert.equal(tamanhoAmigavel('4.00 MB'), '4,00 MB');
  assert.equal(tamanhoAmigavel('120 KB'), '120 KB');
  assert.equal(tamanhoAmigavel(undefined), '');
});

test('descrição completa e com partes ausentes', () => {
  assert.equal(
    descricaoDoAnexo({
      name: 'AGO-04_Relatorio_Monitoria.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: '0.04 MB',
      date: '25/10/2026',
    }),
    'DOCX · 0,04 MB · 25/10/2026',
  );
  assert.equal(descricaoDoAnexo({ name: 'x.pdf' }), 'PDF');
  assert.equal(descricaoDoAnexo({}), '');
});
