// Ensaio da REVERSÃO do script 15 (15r_reverter_duplicidade.sql) num Postgres LOCAL (PGlite),
// na mesma réplica fictícia da homologação usada em testes-15-implantacao.mjs.
//
// Prova: o 15r devolve o banco ao estado do 14 (mesma api.salvar_monitoria, sem gatilho, sem
// colunas, sem funções do 15); não muda nenhuma monitoria — nem as 19 antigas nem as criadas
// enquanto o 15 esteve instalado; o portal novo continua gravando depois da reversão; o 15 pode
// ser reinstalado; e o 15r é recusado depois do 15b.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-15-reversao.mjs <projeto>
// (o trecho até a réplica é o mesmo de testes-15-implantacao.mjs)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, validarMonitoria, reprovarMonitoria } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { getEscopoProgresso } = await mod('src/domain/goalService.ts');
const { resumirNotas } = await mod('src/domain/resultadosService.ts');
const { chaveAtendimento } = await mod('src/domain/duplicidade.ts');
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
await db.exec(sql('14_historico_calibracao.sql'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
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
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2));
const COL_A = 'col-teste-homolog-1';
const COL_B = (await um(`select id from public.colaboradores where id <> $1 order by id limit 1`, [COL_A])).id;
const PERFIL_ALINE = (await um(`select id from public.perfis where auth_user_id = $1`, [U(1)])).id;

// ---- réplica: as 17 monitorias criadas depois da migração, na ordem da homologação ------------
let dA = await carregarDados(ALINE, PADROES);
const GAB = (canal) => dA.criterios.filter((c) => c.active && c.channels.includes(canal)).map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (canal, s) => calcularNotaPrevia(dA.criterios.filter((c) => c.active && c.channels.includes(canal)), Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
const monitoria = (colab, canal, dia, ini, fim, num) => {
  const scores = GAB(canal);
  return { id: '', competencia: '2026-08', date: `2026-08-${dia}T12:00:00Z`, colaboradorId: colab, canal, tipo: 'Regular', categoriaAtendimento: 'BOLETOS',
    numeroAtendimento: num, numeroTitulo: 'FICT', inicioAtendimento: `2026-08-${dia}T${ini}`, fimAtendimento: `2026-08-${dia}T${fim}`,
    comments: 'RÉPLICA FICTÍCIA — ENSAIO DO SCRIPT 15.', status: 'Pendente', scores, finalScore: prev(canal, scores), evidencias: [], links: [] };
};
// [colaboradora, canal, dia, início, término, nº, quantas vezes foi criada]
const REPLICA = [
  [COL_A, 'Telefone', '28', '13:09', '13:10', 'F-03', 1],
  [COL_A, 'Telefone', '28', '15:08', '15:20', 'F-04', 2],   // 10004 / 10005
  [COL_A, 'Telefone', '28', '11:32', '11:38', 'F-06', 1],
  [COL_A, 'Telefone', '25', '16:28', '16:31', 'F-07', 2],   // 10007 / 10008
  [COL_A, 'Telefone', '19', '11:57', '12:01', 'F-09', 1],
  [COL_A, 'WhatsApp', '26', '17:00', '17:54', 'F-10', 1],
  [COL_A, 'WhatsApp', '26', '13:09', '13:25', 'F-11', 2],   // 10011 / 10012
  [COL_A, 'WhatsApp', '25', '15:42', '17:00', 'F-13', 2],   // 10013 / 10014
  [COL_B, 'WhatsApp', '20', '14:51', '15:17', 'F-15', 1],
  [COL_B, 'WhatsApp', '24', '15:15', '15:27', 'F-16', 2],   // 10016 / 10017
  [COL_B, 'WhatsApp', '10', '16:32', '17:48', 'F-18', 2],   // 10018 / 10019
];
const criadas = [];
for (const [colab, canal, dia, ini, fim, num, vezes] of REPLICA)
  for (let i = 0; i < vezes; i++) criadas.push((await salvarMonitoria(ALINE, monitoria(colab, canal, dia, ini, fim, num), dA.criterios, false, true)).id);
const doBanco = async (id) => (await carregarDados(ERIVAN, PADROES)).monitorias.find((m) => m.id === id);
// Como na homologação: o gestor devolveu a MON-10001 (migrada), que voltou a Rascunho.
await (await import(pathToFileURL(join(projeto, 'src/shared/compartilhado/dados.ts')).href)).devolverMonitoria(ERIVAN, await doBanco('MON-10001'), 'TESTE: devolvida como na homologação (fictício).');
await validarMonitoria(ERIVAN, await doBanco('MON-10003'));
await validarMonitoria(ERIVAN, await doBanco('MON-10004'));
await reprovarMonitoria(ERIVAN, await doBanco('MON-10005'), 'TESTE: duplicidade (fictício).');
await validarMonitoria(ERIVAN, await doBanco('MON-10006'));
const situacoes = Object.fromEntries((await db.query('select status, count(*)::int n from public.monitorias group by status')).rows.map((x) => [x.status, x.n]));
ok('I.0', `réplica com a mesma numeração e situação da homologação: ${criadas[0]}…${criadas.at(-1)}; ${JSON.stringify(situacoes)}`,
   criadas[0] === 'MON-10003' && criadas.at(-1) === 'MON-10019' && (await n('select count(*) n from public.monitorias')) === 19
   && situacoes.Pendente === 13 && situacoes.Validada === 3 && situacoes.Reprovada === 1 && situacoes.Rascunho === 2, JSON.stringify(situacoes));

// ---- indicadores, pelas mesmas funções do portal ----------------------------------------------
const AGO = { year: 2026, month: 7 };
const METAS = [
  { id: 'g-a-tel', monitorId: PERFIL_ALINE, colaboradorId: COL_A, canal: 'Telefone', year: 2026, month: 7, targetQty: 5 },
  { id: 'g-a-wa', monitorId: PERFIL_ALINE, colaboradorId: COL_A, canal: 'WhatsApp', year: 2026, month: 7, targetQty: 5 },
  { id: 'g-b', monitorId: PERFIL_ALINE, colaboradorId: COL_B, year: 2026, month: 7, targetQty: 5 },
];
const indicadores = async () => {
  const ms = (await carregarDados(ERIVAN, PADROES)).monitorias;
  const fila = (await ERIVAN.sql('select id from api.fila_validacao()')).length;
  const metas = METAS.map((g) => getEscopoProgresso(g, ms, AGO).entregues);
  const medias = [COL_A, COL_B].map((c) => resumirNotas(ms.filter((m) => m.colaboradorId === c && m.competencia === '2026-08')).consideradas);
  // o que DEVERIA contar: cada atendimento uma vez (Pendente/Validada), sem as cópias
  const unicos = (c, canal) => new Set(ms.filter((m) => m.colaboradorId === c && (!canal || m.canal === canal) && ['Pendente', 'Validada'].includes(m.status)).map((m) => chaveAtendimento(m))).size;
  return { fila, metas, medias, reais: [unicos(COL_A, 'Telefone'), unicos(COL_A, 'WhatsApp'), unicos(COL_B)] };
};
const conf = async () => Object.fromEntries((await db.query(sql('conferencia-15.sql'))).rows.map((x) => [x.item, x.resultado]));
const eventosDe = async (id) => (await db.query('select tipo, consideracoes, responsavel_id from public.monitoria_eventos where monitoria_id = $1 order by id', [id])).rows;
const COPIAS = ['MON-10008', 'MON-10012', 'MON-10014', 'MON-10017', 'MON-10019'];
const ORIGINAIS = ['MON-10007', 'MON-10011', 'MON-10013', 'MON-10016', 'MON-10018'];
const histAntes = Object.fromEntries(await Promise.all([...COPIAS, ...ORIGINAIS].map(async (id) => [id, JSON.stringify(await eventosDe(id))])));

// ---- reversão ----------------------------------------------------------------------------------
const rodar = async (f) => { try { await db.exec(sql(f)); return null; } catch (x) { await db.exec('rollback').catch(() => {}); return x; } };
const defSalvar = async () => (await um(`select pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure) d`)).d;
const permissoes = async () => JSON.stringify(await um(`select p.prosecdef s,
  has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') au
  from pg_proc p where p.oid = 'api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure`));
const linhas = async () => (await db.query('select * from public.monitorias order by id')).rows.map(({ chave_criacao, duplicata_de, ...x }) => x);
const audSemAcesso = async () => n(`select count(*) n from public.auditoria where tabela <> 'acessos_log'`);

let e = await rodar('15r_reverter_duplicidade.sql');
ok('R.1', `o 15r sem o 15 instalado é recusado (${e?.message?.slice(0, 60)})`, e && /15r RECUSADO/.test(e.message));

const def14 = await defSalvar(), perm14 = await permissoes(), c0 = await conf(), lin0 = JSON.stringify(await linhas());
e = await rodar('15_duplicidade_criacao.sql');
ok('R.2', 'script 15 instalado', !e, e?.message);

// uso enquanto o 15 está instalado: uma monitoria nova (outro atendimento) pelo portal novo e uma recusa
const NOVA = { ...monitoria(COL_A, 'Telefone', '27', '09:00', '09:05', 'F-NOVA'), chaveCriacao: crypto.randomUUID() };
const idNova = (await salvarMonitoria(ALINE, NOVA, dA.criterios, false, true)).id;
const recusa = await (async () => { try { await salvarMonitoria(ALINE, monitoria(COL_A, 'Telefone', '27', '09:00', '09:07', 'OUTRO'), dA.criterios, false, true); return 'gravou'; } catch (x) { return x.codigo; } })();
ok('R.3', `com o 15: ${idNova} criada com chave de criação; o mesmo atendimento de novo é recusado (${recusa})`,
   (await um('select chave_criacao from public.monitorias where id = $1', [idNova])).chave_criacao === NOVA.chaveCriacao && recusa === 'MI410');

const linAntesR = JSON.stringify(await linhas());
const resp = async () => md5(`select md5(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id)) h from public.monitoria_respostas r`);
const md5 = async (q) => (await um(q)).h;
const respAntes = await resp(), evAntes = await md5(`select count(*) || md5(string_agg(to_jsonb(e)::text, '|' order by e.id)) h from public.monitoria_eventos e`);
const audAntes = await audSemAcesso();
e = await rodar('15r_reverter_duplicidade.sql');
ok('R.4', '15r executado numa transação, com a conferência interna aprovada', !e, e?.message);

const c1 = await conf();
ok('R.5', `banco de volta ao 14: api.salvar_monitoria idêntica à do 08 (texto e permissões); objetos do 15: "${c1[10]}"; scripts: …${c1[1].slice(-6)}`,
   (await defSalvar()) === def14 && (await permissoes()) === perm14 && c1[10] === '' && !/\b15\b/.test(c1[1]), JSON.stringify(c1));
ok('R.6', `nenhuma monitoria muda com a reversão: as ${JSON.parse(linAntesR).length} linhas (19 antigas + a criada com o 15) idênticas; respostas e histórico iguais; nada gravado na auditoria (${c1[7]})`,
   JSON.stringify(await linhas()) === linAntesR && (await resp()) === respAntes
   && (await md5(`select count(*) || md5(string_agg(to_jsonb(e)::text, '|' order by e.id)) h from public.monitoria_eventos e`)) === evAntes
   && (await audSemAcesso()) === audAntes && /quebras 0$/.test(c1[7]));
ok('R.7', 'as 19 monitorias antigas continuam exatamente como antes da instalação do 15',
   JSON.stringify(JSON.parse(linAntesR).filter((x) => x.id !== idNova)) === lin0 && c1[3] !== c0[3] /* só pela nova */ && c1[8] === c0[8]);

// o portal novo (que manda chaveCriacao) continua funcionando sem o 15
let id2 = null; e = null;
try { id2 = (await salvarMonitoria(ALINE, { ...monitoria(COL_B, 'WhatsApp', '27', '10:00', '10:10', 'F-NOVA2'), chaveCriacao: crypto.randomUUID() }, dA.criterios, false, true)).id; } catch (x) { e = x; }
ok('R.8', `sem o 15, o portal novo continua gravando (${id2 || e?.message}) — o banco ignora a chave de criação`, id2 && !e);
const dup = await (async () => { try { await salvarMonitoria(ALINE, monitoria(COL_A, 'Telefone', '27', '09:00', '09:07', 'OUTRO'), dA.criterios, false, true); return 'gravou'; } catch (x) { return x.codigo; } })();
ok('R.9', `sem o 15, a proteção deixa de valer no banco (mesmo atendimento: ${dup}) — a reversão é efetiva`, dup === 'gravou');

// reinstalar o 15 depois da reversão
const linPre = JSON.stringify(await linhas());
e = await rodar('15_duplicidade_criacao.sql');
const c2 = await conf();
ok('R.10', `o 15 pode ser reinstalado depois do 15r, sem mudar nenhuma monitoria; objetos: ${c2[10]}`,
   !e && JSON.stringify(await linhas()) === linPre && c2[10].includes('gatilho') && /\b15\b/.test(c2[1]), e?.message);

// depois do 15b, o 15r é recusado
await db.exec(`begin; set local app.responsavel = '${ADM}';
  update public.monitorias set status = 'Cancelada', cancelado_por = '${ADM}', cancelado_em = now(), cancelado_motivo = 'TESTE', duplicata_de = 'MON-10007' where id = 'MON-10008'; commit;`).catch(async (x) => { await db.exec('rollback').catch(() => {}); throw x; });
const c3 = await conf();
e = await rodar('15r_reverter_duplicidade.sql');
ok('R.11', `com cancelamento por duplicidade registrado, o 15r é recusado (${e?.message?.slice(0, 50)}…) e nada muda`,
   e && /15b já cancelou/.test(e.message) && JSON.stringify(await conf()) === JSON.stringify(c3));

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
