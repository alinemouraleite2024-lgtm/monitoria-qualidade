// Piloto das evidências no OneDrive: cadastro das MON-10024 e 10025 e endereços dos visualizadores.
//   node --import ./tests/registrar-ts.mjs --test tests/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arquivosDaMonitoria, descricaoDoArquivo, urlDownload, urlNovaAba, urlVisualizador } from '../src/domain/evidenciasOneDrive';

test('só as monitorias do piloto têm arquivos, cada uma com um áudio e um Word', () => {
  for (const [id, ago] of [['MON-10024', 'AGO-007'], ['MON-10025', 'AGO-008']]) {
    const arquivos = arquivosDaMonitoria(id);
    assert.deepEqual(arquivos.map((a) => a.tipo), ['audio', 'documento']);
    assert.ok(arquivos.every((a) => a.nome.startsWith(`${ago}_`)), `${id} só aponta para ${ago}`);
  }
  assert.deepEqual(arquivosDaMonitoria('MON-10001'), []);
  assert.deepEqual(arquivosDaMonitoria('constructor'), [], 'nome de propriedade não vira cadastro');
});

test('os códigos do cadastro são os registrados para cada arquivo', () => {
  const codigos = ['MON-10024', 'MON-10025'].flatMap(arquivosDaMonitoria).map((a) => a.codigo);
  assert.deepEqual(codigos, ['555cdf80e925e8ac', 'be3183ec05068f02', 'bd91492d0228479f', 'fe3a319b6bf7f68e']);
});

test('download só aparece com permissão concedida: no piloto, nenhum ainda', () => {
  assert.ok(['MON-10024', 'MON-10025'].flatMap(arquivosDaMonitoria).every((a) => a.downloadLiberado === false));
});

test('endereços só no OneDrive da empresa, com o visualizador de cada tipo', () => {
  const [audio, word] = arquivosDaMonitoria('MON-10024');
  const raiz = 'https://mouraleite1-my.sharepoint.com/personal/aline_oliveira_mouraleite_com_br/_layouts/15/';
  assert.equal(urlVisualizador(audio), `${raiz}embed.aspx?UniqueId=${audio.id}`);
  assert.equal(urlVisualizador(word), `${raiz}Doc.aspx?sourcedoc=%7B${word.id}%7D&action=embedview`);
  assert.equal(urlNovaAba(word), `${raiz}Doc.aspx?sourcedoc=%7B${word.id}%7D&action=view`);
  assert.equal(urlDownload(audio), `${raiz}download.aspx?UniqueId=${audio.id}`);
});

test('identificador fora do formato não vira endereço', () => {
  const [audio] = arquivosDaMonitoria('MON-10024');
  assert.throws(() => urlVisualizador({ ...audio, id: 'x&Source=https://exemplo.com' }), /inválido/);
});

test('descrição do arquivo', () => {
  assert.equal(descricaoDoArquivo(arquivosDaMonitoria('MON-10024')[0]), 'WAV · 3,27 MB · 13/10/2026');
});
