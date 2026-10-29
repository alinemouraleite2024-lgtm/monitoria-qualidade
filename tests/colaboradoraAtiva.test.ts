// Colaboradora inativa não recebe monitoria nova (script 16): o formulário não a oferece e o
// importador a recusa; a monitoria antiga dela continua mostrando quem foi avaliada.
//
// Rodar a partir da raiz do projeto:
//   node --import ./tests/registrar-ts.mjs --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INITIAL_CRITERIA } from '../src/mockData';
import { OFFICIAL_COLLABORATORS, OFFICIAL_USERS } from '../src/teamData';
import { OFFICIAL_CATEGORIAS } from '../src/constants/catalogData';
import { validarImportacao } from '../src/domain/importacaoChatGPT';
import { colaboradorasSelecionaveis, rotuloColaboradora, vinculoNovoComInativa, mensagemColaboradoraInativa } from '../src/domain/colaboradoraAtiva';
import type { Collaborator } from '../src/types/domain';

const c = (id: string, active: boolean): Collaborator => ({ id, name: `Pessoa ${id}`, email: '', cargo: '', areaId: 'area-1', active });
const TODAS = [c('a', true), c('b', false), c('c', true)];

test('formulário: só ativas na monitoria nova', () => {
  assert.deepEqual(colaboradorasSelecionaveis(TODAS).map((x) => x.id), ['a', 'c']);
});

test('formulário: a inativa já vinculada à monitoria antiga continua na lista, marcada', () => {
  const lista = colaboradorasSelecionaveis(TODAS, 'b');
  assert.deepEqual(lista.map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(rotuloColaboradora(lista[1]), 'Pessoa b (inativa)');
  assert.equal(rotuloColaboradora(lista[0]), 'Pessoa a');
});

test('vínculo novo com inativa: monitoria nova ou troca, sim; manter a já vinculada, não', () => {
  assert.equal(vinculoNovoComInativa(c('b', false)), true, 'monitoria nova');
  assert.equal(vinculoNovoComInativa(c('b', false), 'a'), true, 'troca de a para b');
  assert.equal(vinculoNovoComInativa(c('b', false), 'b'), false, 'a monitoria já era de b');
  assert.equal(vinculoNovoComInativa(c('a', true)), false, 'ativa');
  assert.equal(vinculoNovoComInativa(undefined), false, 'sem colaboradora escolhida');
  assert.match(mensagemColaboradoraInativa('Pessoa b'), /inativa no cadastro e não recebe monitoria nova/);
});

const AGO001 = readFileSync(new URL('../docs/exemplos/AGO-001.monitoria-chatgpt.json', import.meta.url), 'utf8');
const ctx = (inativaId?: string) => ({
  criteria: INITIAL_CRITERIA,
  collaborators: OFFICIAL_COLLABORATORS.map((x) => (x.id === inativaId ? { ...x, active: false } : x)),
  currentUser: OFFICIAL_USERS.find((u) => u.id === 'usr-1')!,
  catalogCategorias: OFFICIAL_CATEGORIAS,
  monitorings: [],
});

test('importação: colaboradora ativa segue sem erro (caso-base AGO-001)', () => {
  assert.deepEqual(validarImportacao(AGO001, ctx()).erros, []);
});

test('importação: colaboradora inativa é recusada com erro, não só aviso', () => {
  const r = validarImportacao(AGO001, ctx('usr-4'));
  assert.ok(r.erros.some((e) => e.includes('inativa no cadastro e não recebe monitoria nova')), r.erros.join(' | '));
  assert.equal(r.dados, undefined, 'nada a aplicar no formulário');
});
