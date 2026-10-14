// Testes do modo compartilhado (banco Supabase) que não precisam de banco.
//
// Rodar a partir da raiz do projeto:
//   node --import ./tests/registrar-ts.mjs --test tests/
//
// Os testes contra o banco de verdade (scripts 00–09a, RLS e funções do 08) ficam na suíte de
// integração do PGlite — aqui ficam a trava do localStorage e a conversão de dados.
// Todos os dados são sintéticos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_CRITERIA } from '../src/mockData';
import { definirModoParaTeste } from '../src/shared/compartilhado/modo';
import { read, write, remove } from '../src/repositories/storage';
import { logAuthEvent } from '../src/auth';
import { paraMonitorias, montarDadosParaSalvar, paraUsuario } from '../src/shared/compartilhado/mapeamento';
import { mensagemDoErro, ErroBanco } from '../src/shared/compartilhado/transporte';
import type { Monitoring, User } from '../src/types/domain';
import { exigeReenvio, MOTIVO_REENVIO_MIGRADA, podeValidar } from '../src/domain/validacaoService';

// localStorage de mentira, com o conteúdo de um navegador que usou o portal antigo
const criarArmazenamento = () => {
  const m = new Map<string, string>([
    ['pm2_monitorings', JSON.stringify([{ id: 'MON-10001', finalScore: 96.77 }])],
    ['pm2_users', JSON.stringify([{ id: 'usr-1', password: 'x' }])],
    ['pm2_auth_logs', '[]'],
    ['pm2_database_version', '11'],
  ]);
  const ls = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    clear: () => m.clear(),
  };
  (globalThis as unknown as { localStorage: typeof ls }).localStorage = ls;
  return m;
};
const foto = (m: Map<string, string>) => JSON.stringify([...m.entries()].sort());

test('modo compartilhado: o localStorage do portal antigo não é gravado, apagado nem lido para a tela', () => {
  const m = criarArmazenamento();
  const antes = foto(m);
  definirModoParaTeste(true);
  try {
    write('pm2_monitorings', []);
    write('pm2_nova', { a: 1 });
    remove('pm2_users');
    logAuthEvent('LOGIN', { id: 'usr-1', name: 'X', email: 'x@exemplo.test', perfis: ['MONITOR'] }, '', 'MONITOR');
    assert.equal(foto(m), antes, 'nada mudou no localStorage');
    assert.deepEqual(read('pm2_monitorings', [] as unknown[]), [], 'coleção começa vazia (não lê a local)');
    assert.deepEqual(read('pm2_settings', { padrao: true }), { padrao: true }, 'configuração usa o padrão do código');
  } finally {
    definirModoParaTeste(null);
  }
});

test('modo local continua igual: lê e grava o localStorage', () => {
  const m = criarArmazenamento();
  definirModoParaTeste(false);
  try {
    assert.equal((read('pm2_monitorings', [] as { id: string }[]))[0].id, 'MON-10001');
    write('pm2_teste', { ok: true });
    assert.equal(m.get('pm2_teste'), '{"ok":true}');
  } finally {
    definirModoParaTeste(null);
  }
});

test('linha do banco vira monitoria da tela: valor efetivo, campos antigos de extras, sem marcas de fidelidade', () => {
  const [m] = paraMonitorias(
    [{ id: 'MON-10001', protocolo: 'MON-2026-0001', competencia: '2026-08', data: '2026-08-28T12:00:00Z', monitor_id: 'usr-1',
       colaborador_id: 'usr-4', canal: 'WhatsApp', tipo: 'Regular', status: 'Pendente', nota: '96.77', nota_historica: '96.77',
       origem: 'migracao', regua_versao_id: null, versao: 2, retroativo: false,
       extras: { campoAntigo: { nota10: 8.5 }, _nulos: ['comments'], _gestorId_original: '' } }],
    [{ monitoria_id: 'MON-10001', criterio_id: 'crit-24', resposta: 2, justificativa: null, sub_respostas: { 'sub-24-1': 'SIM' }, ordem: 0, ativo: true },
     { monitoria_id: 'MON-10001', criterio_id: 'crit-99', resposta: 1, ordem: 1, ativo: false }],
    [{ monitoria_id: 'MON-10001', lista: 'links', ordem: 0, conteudo: 'https://x.exemplo.test', ativo: true }],
  );
  assert.equal(m.finalScore, 96.77);
  assert.equal(m.notaHistorica, 96.77);
  assert.equal(m.versao, 2);
  assert.equal(m.origem, 'migracao');
  assert.equal(m.date, '2026-08-28T12:00:00Z');
  assert.deepEqual((m as unknown as Record<string, unknown>).campoAntigo, { nota10: 8.5 });
  assert.ok(!Object.keys(m).some((k) => k.startsWith('_')), 'marcas de fidelidade não vão para a tela');
  assert.equal(m.scores.length, 1, 'resposta inativa (critério que deixou de se aplicar) não aparece');
  assert.deepEqual(m.links, ['https://x.exemplo.test']);
});

test('perfil do banco nunca carrega senha para a tela', () => {
  const { usuario } = paraUsuario({ id: 'usr-1', nome: 'Pessoa', email: 'p@exemplo.test', perfis: ['MONITOR'], status: null,
    extras: { cargo: 'Monitora', password: 'nunca', _perfis_original: ['ADMIN', 'MONITOR'] } });
  assert.equal((usuario as unknown as Record<string, unknown>).password, undefined);
  assert.equal(usuario.status, 'ACTIVE', 'status ausente = ativo, como no portal antigo');
  assert.deepEqual(usuario.perfis, ['MONITOR']);
});

const monitoriaDoFormulario = (): Monitoring => ({
  id: 'MON-55555', protocolo: 'MON-2026-0099', competencia: '2026-08', date: '2026-08-20T12:00:00Z', monitorId: 'usr-1',
  colaboradorId: 'usr-4', canal: 'Telefone', tipo: 'Regular', status: 'Pendente', finalScore: 91.3,
  scores: [{ criterionId: 'crit-24', score: 2, lowScoreReason: '', subRespostas: { 'sub-24-1': 'SIM', 'sub-24-2': 'SIM', 'sub-24-3': 'SIM' } }],
});

test('monitoria nova vai ao banco SEM id e SEM protocolo (o banco gera os dois)', () => {
  const d = montarDadosParaSalvar(monitoriaDoFormulario(), INITIAL_CRITERIA, false, false);
  assert.equal(d.id, undefined);
  assert.equal(d.protocolo, undefined);
  assert.equal(d.monitorId, undefined, 'a monitora é quem está logada (D3), o portal não envia');
  assert.equal(d.status, undefined, 'a situação é decidida pelo banco');
  assert.equal(d.finalScore, undefined, 'rascunho não manda nota');
});

test('envio leva a nota como conferência e retira sub-respostas que não existem na régua (sub-24-3)', () => {
  const d = montarDadosParaSalvar(monitoriaDoFormulario(), INITIAL_CRITERIA, true, true);
  assert.equal(d.id, 'MON-55555');
  assert.equal(d.finalScore, 91.3);
  const s = (d.scores as { subRespostas: Record<string, string> }[])[0];
  assert.deepEqual(Object.keys(s.subRespostas).sort(), ['sub-24-1', 'sub-24-2']);
});

test('mensagens de erro: versão desatualizada e falta de permissão viram texto claro; as do banco passam como vieram', () => {
  assert.match(mensagemDoErro(new ErroBanco('MI409', 'x')), /Outra pessoa alterou/);
  assert.match(mensagemDoErro(new ErroBanco('42501', 'permission denied')), /não tem permissão/);
  assert.equal(mensagemDoErro(new ErroBanco('MI422', 'Informe o motivo da reprovação.')), 'Informe o motivo da reprovação.');
});

test('troca de senha no ambiente compartilhado: confirmação igual, mínimo de 10 caracteres, diferente da atual', async () => {
  const { problemaDaSenhaNova } = await import('../src/shared/compartilhado/supabase');
  assert.match(problemaDaSenhaNova('atual-123456', 'nova-senha-1', 'outra-coisa') ?? '', /confirmação/);
  assert.match(problemaDaSenhaNova('atual-123456', 'curta', 'curta') ?? '', /10 caracteres/);
  assert.match(problemaDaSenhaNova('mesma-senha-1', 'mesma-senha-1', 'mesma-senha-1') ?? '', /diferente/);
  assert.equal(problemaDaSenhaNova('atual-123456', 'nova-senha-forte', 'nova-senha-forte'), null);
});

// ---- M1 na tela: migrada sem régua só pode ser devolvida (14/10/2026) ----------------------
// A REPROVAÇÃO direta ainda é aceita pela API: esconder o botão é orientação, não proteção.
test('M1 na tela: migrada sem versão da régua exige devolução e reenvio; as demais seguem as regras normais', () => {
  const linha = (extra: Record<string, unknown>) => paraMonitorias(
    [{ id: 'MON-10001', protocolo: 'MON-2026-0001', competencia: '2026-08', data: '2026-08-28T12:00:00Z', monitor_id: 'usr-1',
       colaborador_id: 'usr-4', canal: 'WhatsApp', tipo: 'Regular', status: 'Pendente', nota: '96.77', versao: 2, extras: {}, ...extra }],
    [], [])[0];
  const migradaSemRegua = linha({ origem: 'migracao', regua_versao_id: null, nota_historica: '96.77' });
  const migradaReenviada = linha({ origem: 'migracao', regua_versao_id: 'regua-1', nota_historica: '96.77' });
  const doPortal = linha({ origem: 'portal', regua_versao_id: 'regua-2.0' });
  assert.equal(exigeReenvio(migradaSemRegua), true, 'MON-10001 como veio da migração');
  assert.equal(exigeReenvio(migradaReenviada), false, 'depois do reenvio o banco grava a régua: decisão normal');
  assert.equal(exigeReenvio(doPortal), false, 'monitoria registrada no portal compartilhado');
  // modo local (portal antigo): o registro não tem origem — nada muda para ele
  assert.equal(exigeReenvio({ id: 'MON-1', status: 'Pendente' } as Monitoring), false);
  assert.equal(exigeReenvio(null), false);
  assert.equal(exigeReenvio(undefined), false);
  assert.equal(MOTIVO_REENVIO_MIGRADA, 'Monitoria migrada: é necessário devolver para revisão e reenvio antes da decisão final.');
});

test('M1 na tela: o bloqueio não depende de quem olha — o gestor continua podendo devolver (podeValidar)', () => {
  const gestor = { id: 'usr-1791895673216', name: 'G', email: 'g@exemplo.test' } as User;
  const m = { id: 'MON-10001', monitorId: 'usr-1', status: 'Pendente', origem: 'migracao', reguaVersaoId: null } as Monitoring;
  // podeValidar é o gate de DEVOLVER também: segue liberado para o gestor da área
  assert.equal(podeValidar(gestor, 'GESTOR', m).pode, true);
  assert.equal(exigeReenvio(m), true);
  // a Monitora não ganha nada com isso
  assert.equal(podeValidar({ ...gestor, id: 'usr-1' }, 'MONITOR', m).pode, false);
});
