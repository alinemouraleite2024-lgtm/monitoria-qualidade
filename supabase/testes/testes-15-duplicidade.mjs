// Testes do script 15 (duplicidade na criação de monitorias) num Postgres LOCAL (PGlite), com a
// migração REAL ensaiada (09b), os scripts 10, 12, 12a, 11a e 14, e a camada de dados do PORTAL.
// Nada sai deste computador. Monitorias de teste FICTÍCIAS. Saída: só códigos, situações e contagens.
//
// Prova: pares duplicados ANTERIORES ao 15 preservados e operáveis; a mesma requisição não cria
// duas monitorias; o mesmo atendimento digitado de outro jeito é recusado com mensagem clara;
// atendimentos diferentes não são bloqueados; cancelamento (comum e por duplicidade) tira a cópia
// da fila, das metas e das médias, entra no histórico e mantém a auditoria íntegra.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-15-duplicidade.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, devolverMonitoria, reprovarMonitoria, validarMonitoria, cancelarMonitoria, cancelarPorDuplicidade } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco, mensagemDoErro } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { atendimentoJaRegistrado } = await mod('src/domain/duplicidade.ts');
const { countsTowardGoal } = await mod('src/domain/monitoringRules.ts');
const { entraNaMedia } = await mod('src/domain/resultadosService.ts');
const { lerBackup, conferirBackup } = await import(pathToFileURL(join(projeto, 'supabase/backup/restauracao.mjs')).href);
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const man = JSON.parse(readFileSync(join(projeto, 'supabase/migracao/saida/manifesto.json'), 'utf8'));
const DECL = man.responsavel.declarado;
const ADM = 'adm-aline-oliveira', EMAIL_ADM = 'aline.oliveira+admin@mouraleite.com.br';
const STUB_MFA = `create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`;

const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });
const relatorio = () => { for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };
const cod = (x) => x.erro?.codigo ?? (x.erro ? 'ERRO' : 'ok');
definirModoParaTeste(true);

// ---- banco igual à homologação (até o 14) ---------------------------------------------------
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP); await db.exec(STUB_MFA);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'])
  await db.exec(sql(f));
await db.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
await db.exec(sql('10_p1_reprovar_m1.sql'));
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
await db.exec(sql('12_estado_do_acesso_mfa.sql'));
await db.exec(sql('12a_admin_aline_oliveira.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}'; insert into auth.users values ('${U(9)}', '${EMAIL_ADM}', now()); commit;`);
await db.exec(sql('11a_colaborador_teste_homologacao.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}';
  insert into public.perfis (id, email, nome, perfis, status) values ('usr-teste-monitora-2', 'monitora2@exemplo.test', 'MONITORA FICTÍCIA 2', array['MONITOR'], 'ACTIVE');
  insert into auth.users values ('${U(3)}', 'monitora2@exemplo.test', now()); commit;`);
await db.exec(sql('14_historico_calibracao.sql'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
const quebras = () => n("select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q");
const nMon = () => n('select count(*) n from public.monitorias');
const nAud = () => n('select count(*) n from public.auditoria');

// ---- transporte (o que a Data API faz) ------------------------------------------------------
const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text', p_consideracoes: '::text', p_texto: '::text', p_chave: '::uuid', p_original: '::text' };
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
const transporte = (uid, aal = 'aal1') => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
    try { const x = await fn(); await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  return {
    selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: (f, args) => como(async () => { const ks = Object.keys(args);
      return normalizar((await db.query(`select api.${f}(${ks.map((k, i) => `${k} => $${i + 1}${TIPOS[k]}`).join(', ')}) r`, ks.map((k) => (k === 'p_dados' ? JSON.stringify(args[k]) : args[k])))).rows[0].r); }),
    incluir: (tb, linha) => como(async () => { const ks = Object.keys(linha); await db.query(`insert into public.${tb} (${ks.join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`, ks.map((k) => linha[k])); }),
    sql: (q, p) => como(async () => (await db.query(q, p)).rows),
  };
};
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2)), OUTRA = transporte(U(3)), ADMIN = transporte(U(9), 'aal2'), ADMIN_AAL1 = transporte(U(9), 'aal1');
const HOJE = (await um('select app.hoje()::text d')).d;
const COMP = HOJE.slice(0, 7);
const COL = 'col-teste-homolog-1';
const COL2 = (await um(`select id from public.colaboradores where id <> $1 order by id limit 1`, [COL])).id;
const PERFIL_ALINE = (await um(`select id from public.perfis where auth_user_id = $1`, [U(1)])).id;

let dA = await carregarDados(ALINE, PADROES);
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const GAB = (variante = 0) => aplic.map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  if (c.id === 'crit-12' && variante === 1) return { criterionId: c.id, score: 1, lowScoreReason: 'TESTE: resposta diferente (fictício).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
const H = (hm, dia = HOJE) => `${dia}T${hm}`;
const base = (p = {}) => ({ id: '', competencia: COMP, date: `${HOJE}T12:00:00Z`, colaboradorId: COL, canal: 'Telefone', tipo: 'Regular',
  categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'FICT-1', numeroTitulo: 'FICT', inicioAtendimento: H('09:00'), fimAtendimento: H('09:10'), duracaoMinutos: 10,
  comments: 'MONITORIA FICTÍCIA — TESTE DO SCRIPT 15 (LOCAL).', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [], ...p });
const enviada = (p = {}, v = 0) => base({ status: 'Pendente', scores: GAB(v), finalScore: prev(GAB(v)), ...p });
const doBanco = async (quem, id) => (await carregarDados(quem, PADROES)).monitorias.find((m) => m.id === id);
const linha = (id) => um('select * from public.monitorias where id = $1', [id]);
const uuid = (k) => `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;

// ---- 0. ANTES do 15: o que aconteceu na homologação — pares criados em dobro ------------------
// Dois pedidos de criação iguais (o segundo clique em "Concluir"), sem chave: o banco de hoje aceita.
const P1a = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('14:00'), fimAtendimento: H('14:05'), numeroAtendimento: 'PAR-1' }), dA.criterios, false, true);
const P1b = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('14:00'), fimAtendimento: H('14:05'), numeroAtendimento: 'PAR-1' }), dA.criterios, false, true);
const P2a = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('15:00'), fimAtendimento: H('15:05'), numeroAtendimento: 'PAR-2' }), dA.criterios, false, true);
const P2b = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('15:00'), fimAtendimento: H('15:05'), numeroAtendimento: 'PAR-2' }), dA.criterios, false, true);
ok('D.0', `sem o 15, dois pedidos iguais criam duas monitorias (reprodução do problema): ${P1a.id} e ${P1b.id}, ${P2a.id} e ${P2b.id}, todas Pendentes`,
   P1a.id !== P1b.id && P2a.id !== P2b.id && [P1a, P1b, P2a, P2b].every((x) => x.status === 'Pendente'));

const foto = async () => JSON.stringify((await db.query('select id, status, versao, nota, colaborador_id, inicio_atendimento from public.monitorias order by id')).rows);
const antes15 = { mon: await foto(), aud: await nAud(), ancora: (await um('select hash from public.auditoria order by seq desc limit 1')).hash,
  ev: await n('select count(*) n from public.monitoria_eventos') };

// ---- 1. aplicação do 15 ---------------------------------------------------------------------
let e = null; try { await db.exec(sql('15_duplicidade_criacao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('D.1', 'script 15 aplicado numa transação (com a conferência interna)', !e, e?.message);
e = null; try { await db.exec(sql('15_duplicidade_criacao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('D.2', 'rodar de novo não quebra nada (idempotente)', !e, e?.message);
ok('D.3', 'o 15 não alterou nenhuma monitoria nem o histórico, e não mexeu na auditoria (mesma contagem, mesma âncora, 0 quebras) — os pares antigos continuam lá',
   (await foto()) === antes15.mon && (await nAud()) === antes15.aud && (await n('select count(*) n from public.monitoria_eventos')) === antes15.ev
   && (await um('select hash from public.auditoria order by seq desc limit 1')).hash === antes15.ancora && (await quebras()) === 0);
ok('D.4', 'o 15 ficou registrado e o gatilho está ativo',
   (await n("select count(*) n from app.versoes_esquema where versao = '15'")) === 1
   && (await n("select count(*) n from pg_trigger where tgname = 'monitorias_b_duplicidade' and tgenabled = 'O'")) === 1);

// ---- 2. mesma requisição (clique repetido / nova tentativa) ------------------------------------
dA = await carregarDados(ALINE, PADROES);
let antesMon = await nMon();
const k1 = enviada({ inicioAtendimento: H('08:00'), fimAtendimento: H('08:05'), numeroAtendimento: 'REQ-1', chaveCriacao: uuid(1) });
const R1 = await salvarMonitoria(ALINE, k1, dA.criterios, false, true);
const R2 = await salvarMonitoria(ALINE, k1, dA.criterios, false, true);
ok('D.5', `o mesmo pedido de criação duas vezes (mesma chave) → UMA monitoria (${R1.id}); a segunda resposta devolve a mesma, marcada como repetida`,
   R1.id === R2.id && R1.repetida !== true && R2.repetida === true && (await nMon()) === antesMon + 1
   && (await n(`select count(*) n from public.monitoria_eventos where monitoria_id = $1 and tipo = 'ENVIO'`, [R1.id])) === 1);
const kOutra = await tenta(() => salvarMonitoria(OUTRA, base({ inicioAtendimento: H('08:30'), chaveCriacao: uuid(1) }), dA.criterios, false, false));
const kInval = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('08:40'), chaveCriacao: 'não-é-uuid' }), dA.criterios, false, false));
ok('D.6', `a chave de outra conta é recusada (${cod(kOutra)}); chave inválida é recusada (${cod(kInval)}); nada foi gravado`,
   cod(kOutra) === 'MI403' && cod(kInval) === 'MI422' && (await nMon()) === antesMon + 1);
// Rascunho criado com a chave; o pedido repetido com "enviar" NÃO envia às escondidas: devolve o rascunho.
const kr = base({ inicioAtendimento: H('08:50'), numeroAtendimento: 'REQ-2', chaveCriacao: uuid(2) });
const RR1 = await salvarMonitoria(ALINE, kr, dA.criterios, false, false);
const RR2 = await salvarMonitoria(ALINE, { ...kr, ...enviada({ inicioAtendimento: H('08:50'), numeroAtendimento: 'REQ-2', chaveCriacao: uuid(2) }) }, dA.criterios, false, true);
ok('D.7', `repetir a chave de um rascunho devolve o rascunho (${RR2.status}), sem criar outro nem enviar sem o id`, RR1.id === RR2.id && RR2.repetida === true && RR2.status === 'Rascunho');
const dupChave = await tenta(() => db.query(`insert into public.monitorias (id, protocolo, chave_criacao) values ('MON-TESTE-X', 'X', $1)`, [uuid(1)]));
ok('D.8', `pedidos simultâneos com a mesma chave: o índice único impede a segunda gravação mesmo por fora das funções (${dupChave.erro?.code ?? 'aceitou'})`,
   dupChave.erro?.code === '23505');

// ---- 3. mesmo atendimento, digitado de outro jeito --------------------------------------------
dA = await carregarDados(ALINE, PADROES);
antesMon = await nMon();
const orig = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('10:00'), fimAtendimento: H('10:04'), numeroAtendimento: '677441', numeroTitulo: '17779', categoriaAtendimento: 'CADASTRO', chaveCriacao: uuid(10) }), dA.criterios, false, true);
const audAposOrig = await nAud();
const outraForma = enviada({ inicioAtendimento: H('10:00'), fimAtendimento: H('10:04:50'), numeroAtendimento: '11591', numeroTitulo: 'B-2101', categoriaAtendimento: 'BOLETOS', chaveCriacao: uuid(11) });
const rec = await tenta(() => salvarMonitoria(ALINE, outraForma, dA.criterios, false, true));
const msg = rec.erro ? mensagemDoErro(rec.erro) : '';
ok('D.9', `mesma colaboradora, canal e início, com número, título, categoria e término diferentes → recusado (${cod(rec)}), nada gravado (monitorias e auditoria iguais)`,
   cod(rec) === 'MI410' && (await nMon()) === antesMon + 1 && (await nAud()) === audAposOrig && (await n(`select count(*) n from public.monitorias where numero_atendimento = '11591'`)) === 0);
ok('D.10', `a mensagem diz qual monitoria existe e em que situação: "${msg.split('\n')[0]}"`,
   msg.includes(orig.protocolo) && /situação Pendente/.test(msg) && /início em \d{2}\/\d{2}\/\d{4} 10:00/.test(msg) && /mesma colaboradora, mesmo canal/.test(msg));
const rasc = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('10:30'), numeroAtendimento: 'RASC-1', chaveCriacao: uuid(12) }), dA.criterios, false, false);
const rec2 = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('10:30:15'), numeroAtendimento: 'OUTRO', chaveCriacao: uuid(13) }), dA.criterios, false, false));
ok('D.11', `rascunho do mesmo atendimento: recusado (${cod(rec2)}) com a orientação de continuar pelo rascunho ${rasc.protocolo}`,
   cod(rec2) === 'MI410' && rec2.erro.message.includes(`rascunho seu: ${rasc.protocolo}`));
// editar um rascunho para o horário de outra monitoria ativa também é recusado
dA = await carregarDados(ALINE, PADROES);
const vRasc = dA.monitorias.find((m) => m.id === rasc.id);
const rec3 = await tenta(() => salvarMonitoria(ALINE, { ...vRasc, inicioAtendimento: H('10:00') }, dA.criterios, true, false));
ok('D.12', `mudar o início de um rascunho para o de outra monitoria ativa → recusado (${cod(rec3)}); o rascunho fica como estava`,
   cod(rec3) === 'MI410' && (await linha(rasc.id)).inicio_atendimento === H('10:30'));

// ---- 4. atendimentos diferentes NÃO são bloqueados (e o portal decide igual ao banco) -------------
dA = await carregarDados(ALINE, PADROES);
const casos = [
  ['um minuto depois', ALINE, base({ inicioAtendimento: H('10:01') })],
  ['outro dia, mesmo horário', ALINE, base({ inicioAtendimento: H('10:00', '2026-08-25'), competencia: '2026-08', date: '2026-08-25T12:00:00Z' })],
  ['outro canal no mesmo minuto', ALINE, base({ inicioAtendimento: H('10:00'), canal: 'WhatsApp' })],
  ['outra colaboradora no mesmo minuto', ALINE, base({ inicioAtendimento: H('10:00'), colaboradorId: COL2 })],
  ['outra monitora, mesmo atendimento (calibração entre monitoras)', OUTRA, base({ inicioAtendimento: H('10:00') })],
  ['tipo Calibração, mesma monitora', ALINE, base({ inicioAtendimento: H('10:00'), tipo: 'Calibração' })],
  ['rascunho sem início preenchido', ALINE, base({ inicioAtendimento: '' })],
  ['outro rascunho sem início', ALINE, base({ inicioAtendimento: '' })],
];
const res = [];
for (const [nome, quem, m] of casos) {
  const portal = atendimentoJaRegistrado(m, quem === OUTRA ? 'usr-teste-monitora-2' : PERFIL_ALINE, dA.monitorias);
  const x = await tenta(() => salvarMonitoria(quem, m, dA.criterios, false, false));
  res.push({ nome, banco: cod(x), portal: portal ? 'bloqueia' : 'livre' });
}
ok('D.13', `${res.length} atendimentos diferentes do mesmo dia/colaboradora/horário: todos gravados, e o aviso do portal concorda com o banco`,
   res.every((x) => x.banco === 'ok' && x.portal === 'livre'), JSON.stringify(res));
const bloqueados = [
  ['mesmo atendimento, segundos diferentes', base({ inicioAtendimento: H('10:00:59') })],
  ['mesmo atendimento, separador com espaço', base({ inicioAtendimento: `${HOJE} 10:00` })],
];
const resB = [];
for (const [nome, m] of bloqueados) {
  const portal = atendimentoJaRegistrado(m, PERFIL_ALINE, dA.monitorias);
  const x = await tenta(() => salvarMonitoria(ALINE, m, dA.criterios, false, false));
  resB.push({ nome, banco: cod(x), portal: portal ? 'bloqueia' : 'livre' });
}
ok('D.14', 'o mesmo atendimento com o início escrito de outra forma (segundos, separador) é recusado pelo banco e avisado pelo portal',
   resB.every((x) => x.banco === 'MI410' && x.portal === 'bloqueia'), JSON.stringify(resB));

// anterior Reprovada ou Cancelada libera o atendimento
dA = await carregarDados(ALINE, PADROES);
const rp = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('11:00'), fimAtendimento: H('11:05'), numeroAtendimento: 'RP-1' }), dA.criterios, false, true);
await reprovarMonitoria(ERIVAN, await doBanco(ERIVAN, rp.id), 'TESTE: reprovada (fictício).');
const posRp = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('11:00'), numeroAtendimento: 'RP-2' }), dA.criterios, false, false));
const cc = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('11:30'), numeroAtendimento: 'CC-1' }), dA.criterios, false, false);
await cancelarMonitoria(ADMIN, await doBanco(ADMIN, cc.id), 'TESTE: cancelada (fictício).');
const posCc = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('11:30'), numeroAtendimento: 'CC-2' }), dA.criterios, false, false));
ok('D.15', `anterior Reprovada (${cod(posRp)}) ou Cancelada (${cod(posCc)}) não bloqueia uma nova avaliação do atendimento`, cod(posRp) === 'ok' && cod(posCc) === 'ok');

// ---- 5. os pares ANTIGOS continuam operáveis -------------------------------------------------
await validarMonitoria(ERIVAN, await doBanco(ERIVAN, P1a.id));
await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, P1b.id), 'TESTE: devolvida para conferir (fictício).');
dA = await carregarDados(ALINE, PADROES);
const reenv = await tenta(() => salvarMonitoria(ALINE, { ...dA.monitorias.find((m) => m.id === P1b.id), status: 'Pendente', finalScore: prev(GAB()) }, dA.criterios, true, true));
ok('D.16', `par antigo: o gestor valida a original (${(await linha(P1a.id)).status}), devolve a cópia, e a monitora consegue reenviar a cópia sem mudar o atendimento (${cod(reenv)}) — nada do que já existe fica travado`,
   (await linha(P1a.id)).status === 'Validada' && cod(reenv) === 'ok' && (await linha(P1b.id)).status === 'Pendente');

// ---- 6. cancelamento administrativo das cópias ------------------------------------------------
// 6a. o cancelamento comum (já existente desde o 08)
const filaAntes = (await ERIVAN.sql('select id from api.fila_validacao()')).map((m) => m.id);
const copia2 = await doBanco(ADMIN, P2b.id);
const gestorCancela = await tenta(async () => cancelarMonitoria(ERIVAN, await doBanco(ERIVAN, P2b.id), 'Duplicidade.'));
const semMfa = await tenta(() => cancelarMonitoria(ADMIN_AAL1, copia2, 'Duplicidade.'));
const semMotivo = await tenta(() => cancelarMonitoria(ADMIN, copia2, '  '));
ok('D.17', `cancelamento comum: só o ADMIN com MFA (gestor ${cod(gestorCancela)}, ADMIN sem MFA ${cod(semMfa)}) e com motivo (${cod(semMotivo)})`,
   cod(gestorCancela) === 'MI403' && cod(semMfa) !== 'ok' && cod(semMotivo) === 'MI422');
const audAntesCanc = await nAud();
await cancelarMonitoria(ADMIN, copia2, `Duplicidade: cópia de ${P2a.protocolo}, criada em dobro (TESTE).`);
const filaDepois = (await ERIVAN.sql('select id from api.fila_validacao()')).map((m) => m.id);
const vE = await carregarDados(ERIVAN, PADROES);
const c2 = vE.monitorias.find((m) => m.id === P2b.id), o2 = vE.monitorias.find((m) => m.id === P2a.id);
const evC = (await db.query(`select tipo, consideracoes, responsavel_id from public.monitoria_eventos where monitoria_id = $1 order by id`, [P2b.id])).rows;
ok('D.18', `cancelamento comum da cópia: sai da fila do gestor (${filaAntes.includes(P2b.id)} → ${filaDepois.includes(P2b.id)}), das metas e das médias; a original fica (${o2.status}, conta ${countsTowardGoal(o2)})`,
   filaAntes.includes(P2b.id) && !filaDepois.includes(P2b.id) && filaDepois.includes(P2a.id) && c2.status === 'Cancelada'
   && !countsTowardGoal(c2) && !entraNaMedia(c2) && countsTowardGoal(o2) && entraNaMedia(o2));
ok('D.19', `cancelamento comum: o motivo fica na monitoria (e chega ao portal) e o histórico ganha o evento ${evC.at(-1)?.tipo} com o motivo e o ADMIN; a auditoria registra (+${(await nAud()) - audAntesCanc})`,
   c2.motivoCancelamento?.startsWith('Duplicidade: cópia de') && evC.at(-1)?.tipo === 'CANCELAMENTO' && evC.at(-1)?.consideracoes?.startsWith('Duplicidade')
   && evC.at(-1)?.responsavel_id === ADM && (await nAud()) > audAntesCanc && (await quebras()) === 0);
ok('D.20', 'a cópia cancelada continua visível para a monitora e para o gestor, com a situação Cancelada (nada é apagado)',
   (await carregarDados(ALINE, PADROES)).monitorias.some((m) => m.id === P2b.id && m.status === 'Cancelada') && c2 !== undefined);

// 6b. o cancelamento POR DUPLICIDADE (novo): confere que é cópia antes de cancelar
dA = await carregarDados(ALINE, PADROES);
const Q1 = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('16:00'), fimAtendimento: H('16:05'), numeroAtendimento: 'PAR-3' }), dA.criterios, false, true);
// cópia "antiga": gravada por fora da regra (simula as que já existem), com respostas iguais
await db.exec(`begin; alter table public.monitorias disable trigger monitorias_b_duplicidade; commit;`);
const Q2 = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('16:00'), fimAtendimento: H('16:05'), numeroAtendimento: 'PAR-3' }), dA.criterios, false, true);
const Q3 = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('16:00'), fimAtendimento: H('16:05'), numeroAtendimento: 'PAR-3' }, 1), dA.criterios, false, true);
await db.exec(`begin; alter table public.monitorias enable trigger monitorias_b_duplicidade; commit;`);
const outroAt = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('16:30'), fimAtendimento: H('16:35'), numeroAtendimento: 'PAR-3' }), dA.criterios, false, true);
const vAd = async (id) => doBanco(ADMIN, id);
const cpGestor = await tenta(async () => cancelarPorDuplicidade(ERIVAN, { id: Q2.id, versao: (await linha(Q2.id)).versao }, Q1.id));
const cpSemMfa = await tenta(async () => cancelarPorDuplicidade(ADMIN_AAL1, await vAd(Q2.id), Q1.id));
const cpDifResp = await tenta(async () => cancelarPorDuplicidade(ADMIN, await vAd(Q3.id), Q1.id));
const cpOutroAt = await tenta(async () => cancelarPorDuplicidade(ADMIN, await vAd(outroAt.id), Q1.id));
const cpSiMesma = await tenta(async () => cancelarPorDuplicidade(ADMIN, await vAd(Q2.id), Q2.id));
await validarMonitoria(ERIVAN, await doBanco(ERIVAN, Q1.id));
const cpValidada = await tenta(async () => cancelarPorDuplicidade(ADMIN, await vAd(Q1.id), Q2.id));
ok('D.21', `cancelar por duplicidade recusa: gestor (${cod(cpGestor)}), ADMIN sem MFA (${cod(cpSemMfa)}), respostas diferentes (${cod(cpDifResp)}), outro atendimento (${cod(cpOutroAt)}), ela mesma (${cod(cpSiMesma)}), cancelar a VALIDADA (${cod(cpValidada)})`,
   cod(cpGestor) === 'MI403' && cod(cpSemMfa) === 'MI403' && cod(cpDifResp) === 'MI422' && cod(cpOutroAt) === 'MI422' && cod(cpSiMesma) === 'MI422' && cod(cpValidada) === 'MI403'
   && (await linha(Q2.id)).status === 'Pendente' && (await linha(Q3.id)).status === 'Pendente');
const audAntesDup = await nAud();
const cpOk = await cancelarPorDuplicidade(ADMIN, await vAd(Q2.id), Q1.id);
const lq2 = await linha(Q2.id);
const evQ = (await db.query(`select tipo, consideracoes from public.monitoria_eventos where monitoria_id = $1 order by id`, [Q2.id])).rows.at(-1);
ok('D.22', `cancelar por duplicidade a cópia ${Q2.id}: Cancelada, motivo padrão "${lq2.cancelado_motivo}", referência à original (${lq2.duplicata_de}), evento ${evQ.tipo} no histórico, auditoria +${(await nAud()) - audAntesDup}, 0 quebras`,
   cpOk.status === 'Cancelada' && lq2.duplicata_de === Q1.id && lq2.cancelado_motivo.startsWith(`Duplicidade: cópia de ${Q1.protocolo}`)
   && evQ.tipo === 'CANCELAMENTO' && evQ.consideracoes === lq2.cancelado_motivo && (await nAud()) > audAntesDup && (await quebras()) === 0);
const cpDeNovo = await tenta(async () => cancelarPorDuplicidade(ADMIN, await vAd(Q2.id), Q1.id));
ok('D.23', `repetir o cancelamento da mesma cópia é recusado (${cod(cpDeNovo)}); a original e a outra continuam como estavam`,
   cod(cpDeNovo) === 'MI403' && (await linha(Q1.id)).status === 'Validada' && (await linha(Q3.id)).status === 'Pendente');
// depois de cancelar a cópia, o atendimento continua protegido pela original
const posCanc = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('16:00'), numeroAtendimento: 'PAR-3-NOVA' }), dA.criterios, false, false));
ok('D.24', `cancelada a cópia, uma nova monitoria do mesmo atendimento continua recusada pela original ativa (${cod(posCanc)})`, cod(posCanc) === 'MI410');

// ---- 7. metas e médias: o efeito da limpeza ----------------------------------------------------
const vFim = await carregarDados(ERIVAN, PADROES);
const doAtend = (hm) => vFim.monitorias.filter((m) => m.inicioAtendimento === H(hm) && m.colaboradorId === COL && m.canal === 'Telefone' && m.tipo === 'Regular');
const contam = (hm) => doAtend(hm).filter(countsTowardGoal).length;
ok('D.25', `metas: cada atendimento limpo conta uma vez — 14:00 (validada + cópia reenviada, ainda NÃO cancelada) conta ${contam('14:00')}; 15:00 conta ${contam('15:00')}; 16:00 conta ${contam('16:00')} (original + a cópia com respostas diferentes, que exige decisão)`,
   contam('14:00') === 2 && contam('15:00') === 1 && contam('16:00') === 2);

// ---- 8. fim: auditoria íntegra e backup completo com as colunas novas -------------------------
ok('D.26', 'auditoria íntegra no fim (0 quebras)', (await quebras()) === 0);
const bk = (await db.query(sql('backup-completo.sql'))).rows[0];
const b = lerBackup(JSON.stringify([{ resumo: bk.resumo, backup: bk.backup }]));
const probs = conferirBackup(b);
ok('D.27', `o backup continua completo com o 15 ("${bk.resumo.split(' · ').slice(1, 5).join(' · ')}") e leva as colunas novas`,
   probs.length === 0 && /tabelas fora: nenhuma/.test(bk.resumo) && b.dados['public.monitorias'].some((x) => x.includes('"chave_criacao"')) && b.dados['public.monitorias'].some((x) => x.includes(`"duplicata_de": "${Q1.id}"`)), probs.join('; '));

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
