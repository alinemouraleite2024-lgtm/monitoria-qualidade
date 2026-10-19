// Destino depois de entrar (login novo ou sessão restaurada) — correção de 19/10/2026.
// O primeiro ADMIN do ambiente compartilhado caía em "acesso negado" porque toda entrada ia
// para /monitorings, que o ADMIN não abre desde a 0.20.0.
//
// Rodar a partir da raiz do projeto:  node --import ./tests/registrar-ts.mjs --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoAposEntrar, entradaDoPerfil, perfilPodeAbrir } from '../src/routes/entrada';
import { ENTRADA_POR_PERFIL, TABS, tabToPath } from '../src/routes/paths';
import { tabPermissionMap } from '../src/routes/routeAccess';
import { hasPermission } from '../src/auth';
import type { Role } from '../src/types/domain';

const PERFIS: Role[] = ['ADMIN', 'GESTOR', 'MONITOR'];

test('entrada: ADMIN vai para /admin/criterios; MONITOR e GESTOR continuam em /monitorings', () => {
  assert.equal(entradaDoPerfil('ADMIN'), '/admin/criterios');
  assert.equal(entradaDoPerfil('GESTOR'), '/monitorings');
  assert.equal(entradaDoPerfil('MONITOR'), '/monitorings');
  // sem perfil conhecido: o comportamento anterior
  assert.equal(entradaDoPerfil(null), '/monitorings');
});

test('entrada: sem rota pretendida (/, /home, /login, vazio) cada perfil vai para a própria entrada', () => {
  for (const de of [undefined, null, '', '/', '/home', '/login', '/login/']) {
    assert.equal(destinoAposEntrar('ADMIN', de), '/admin/criterios', `ADMIN, de=${de}`);
    assert.equal(destinoAposEntrar('GESTOR', de), '/monitorings', `GESTOR, de=${de}`);
    assert.equal(destinoAposEntrar('MONITOR', de), '/monitorings', `MONITOR, de=${de}`);
  }
});

test('entrada: ADMIN com rota anterior que ele NÃO abre (o caso do "acesso negado") vai para a própria entrada', () => {
  for (const de of ['/monitorings', '/monitorings/new', '/monitorings/MON-10001/edit', '/planning', '/allocations']) {
    assert.equal(destinoAposEntrar('ADMIN', de), '/admin/criterios', de);
  }
});

test('entrada: ADMIN com rota anterior permitida volta para ela', () => {
  // lançamento retroativo é de GESTOR e ADMIN desde a 0.22.0 (LANCAR_RETROATIVO)
  for (const de of ['/reports', '/dashboard', '/profile', '/admin/acessos', '/admin/sistema', '/admin/criterios/', '/monitorings/retroativa']) {
    assert.equal(destinoAposEntrar('ADMIN', de), de.replace(/\/$/, ''), de);
  }
});

test('entrada: GESTOR — permitidas voltam; Administração e formulário de monitoria não', () => {
  for (const de of ['/monitorings', '/reports', '/dashboard', '/planning', '/allocations', '/profile']) assert.equal(destinoAposEntrar('GESTOR', de), de, de);
  for (const de of ['/admin/criterios', '/admin/acessos', '/monitorings/new', '/monitorings/MON-10001/edit']) assert.equal(destinoAposEntrar('GESTOR', de), '/monitorings', de);
});

test('entrada: MONITOR — permitidas voltam (inclusive editar monitoria); Painel, Metas e Administração não', () => {
  for (const de of ['/monitorings', '/monitorings/new', '/monitorings/MON-10002/edit', '/reports', '/profile']) assert.equal(destinoAposEntrar('MONITOR', de), de, de);
  for (const de of ['/dashboard', '/planning', '/allocations', '/admin/criterios', '/admin/sistema']) assert.equal(destinoAposEntrar('MONITOR', de), '/monitorings', de);
});

test('entrada: rota inexistente nunca é devolvida (vai para a entrada do perfil)', () => {
  for (const p of PERFIS) {
    for (const de of ['/nao-existe', '/admin/inexistente', '/monitorings/x/y', 'https://outro.site/monitorings']) {
      assert.equal(destinoAposEntrar(p, de), entradaDoPerfil(p), `${p} ${de}`);
    }
  }
});

test('entrada: a regra é a MESMA do RouteGuard — para todas as abas e os três perfis', () => {
  for (const p of PERFIS) {
    for (const tab of TABS) {
      const perm = tabPermissionMap[tab];
      const guard = Object.prototype.hasOwnProperty.call(tabPermissionMap, tab) && (perm === null || hasPermission(p, perm));
      assert.equal(perfilPodeAbrir(p, tabToPath(tab)), guard, `${p} ${tab}`);
    }
  }
});

test('entrada: a entrada de cada perfil é uma rota que ele mesmo pode abrir (nunca cai em acesso negado)', () => {
  for (const p of PERFIS) assert.equal(perfilPodeAbrir(p, ENTRADA_POR_PERFIL[p]), true, p);
});
