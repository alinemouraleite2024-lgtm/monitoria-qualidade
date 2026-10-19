// Segundo fator (P2): a regra que decide a TELA depois do login. O banco é quem protege os dados
// (07: ADMIN só em aal2); aqui se prova que a tela nunca libera o que o banco não liberou e que
// MONITOR e GESTOR sem fator — o caso da Aline e do Erivan — seguem direto, como hoje.
//
// Rodar a partir da raiz do projeto:  node --import ./tests/registrar-ts.mjs --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapaDeAcesso, etapaFinal, codigoTotpValido, type EstadoDoAcesso } from '../src/shared/compartilhado/mfa';

const estado = (o: Partial<EstadoDoAcesso>): Omit<EstadoDoAcesso, 'etapa'> =>
  ({ tem_perfil: true, admin: false, ativo: true, nivel: 'aal1', fator_verificado: false, ...o });

test('MFA: MONITOR e GESTOR sem fator entram direto (comportamento atual preservado)', () => {
  assert.equal(etapaDeAcesso(estado({})), 'liberado');
  assert.equal(etapaDeAcesso(estado({ nivel: null })), 'liberado');
});

test('MFA: ADMIN sem fator → cadastrar; com fator e só senha → verificar; com aal2 → liberado', () => {
  assert.equal(etapaDeAcesso(estado({ admin: true })), 'cadastrar_mfa');
  assert.equal(etapaDeAcesso(estado({ admin: true, nivel: null })), 'cadastrar_mfa');
  assert.equal(etapaDeAcesso(estado({ admin: true, fator_verificado: true })), 'verificar_mfa');
  assert.equal(etapaDeAcesso(estado({ admin: true, fator_verificado: true, nivel: 'aal2' })), 'liberado');
});

test('MFA: quem não é ADMIN mas cadastrou fator também confirma o código (MFA opcional)', () => {
  assert.equal(etapaDeAcesso(estado({ fator_verificado: true })), 'verificar_mfa');
  assert.equal(etapaDeAcesso(estado({ fator_verificado: true, nivel: 'aal2' })), 'liberado');
});

test('MFA: sem perfil e inativo não chegam à etapa do fator', () => {
  assert.equal(etapaDeAcesso(estado({ tem_perfil: false, admin: false })), 'sem_perfil');
  assert.equal(etapaDeAcesso(estado({ ativo: false, admin: true })), 'inativo');
});

test('MFA: se banco e tela discordarem, vale a etapa MAIS restritiva — a tela nunca libera sozinha', () => {
  // banco diz liberado, mas o estado mostra ADMIN em aal1 sem fator → a tela pede o cadastro
  assert.equal(etapaFinal({ ...estado({ admin: true }), etapa: 'liberado' }), 'cadastrar_mfa');
  // banco pede o código, regra local diria liberado → vale o banco
  assert.equal(etapaFinal({ ...estado({ nivel: 'aal2' }), etapa: 'verificar_mfa' }), 'verificar_mfa');
  // valor desconhecido vindo do banco → tratado como sem perfil
  assert.equal(etapaFinal({ ...estado({}), etapa: 'qualquer' as never }), 'sem_perfil');
  // concordância
  assert.equal(etapaFinal({ ...estado({}), etapa: 'liberado' }), 'liberado');
});

test('MFA: código TOTP aceita só 6 dígitos (espaços no meio são ignorados)', () => {
  assert.equal(codigoTotpValido('123456'), '123456');
  assert.equal(codigoTotpValido(' 123 456 '), '123456');
  assert.equal(codigoTotpValido('12345'), null);
  assert.equal(codigoTotpValido('1234567'), null);
  assert.equal(codigoTotpValido('12a456'), null);
  assert.equal(codigoTotpValido(''), null);
});
