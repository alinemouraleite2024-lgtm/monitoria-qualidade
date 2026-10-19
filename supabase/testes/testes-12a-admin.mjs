// Testes do script 12a (primeiro ADMIN: adm-aline-oliveira) e do 11a REVISADO (Ordem 2, P3),
// num Postgres LOCAL igual à homologação: 00–09a, 09b REAL, 10, 12, logins de Aline e Erivan.
// Nada é criado no Supabase; o "login" do ADMIN aqui é uma linha local em auth.users.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-12a-admin.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, perfilDoLogin, salvarMonitoria } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { etapaFinal } = await mod('src/shared/compartilhado/mfa.ts');
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const man = JSON.parse(readFileSync(join(projeto, 'supabase/migracao/saida/manifesto.json'), 'utf8'));
const DECL = man.responsavel.declarado;
const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });
const relatorio = () => { for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const ADM = 'adm-aline-oliveira', EMAIL_ADM = 'aline.oliveira+admin@mouraleite.com.br', ERIVAN = 'usr-1791895673216';
definirModoParaTeste(true);

const STUB_MFA = `create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`;
const SCRIPTS = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'];
const novoBanco = async ({ com12 = true } = {}) => {
  const d = await PGlite.create({ extensions: { pgcrypto } });
  await d.exec(SETUP); await d.exec(STUB_MFA);
  for (const f of SCRIPTS) await d.exec(sql(f));
  await d.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
  await d.exec(sql('10_p1_reprovar_m1.sql'));
  if (com12) await d.exec(sql('12_estado_do_acesso_mfa.sql'));
  await d.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
  return d;
};
const roda = async (d, f) => { try { await d.exec(sql(f)); return null; } catch (x) { await d.exec('rollback').catch(() => {}); return x; } };
const db = await novoBanco();
const um = async (q, p) => (await db.query(q, p)).rows[0];

// transporte igual ao da Data API
const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text' };
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
const transporte = (uid, aal) => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
    try { const x = await fn(); await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  return {
    selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: (f, args) => como(async () => { const ks = Object.keys(args);
      return normalizar((await db.query(`select api.${f}(${ks.map((k, i) => `${k} => $${i + 1}${TIPOS[k]}`).join(', ')}) r`, ks.map((k) => (k === 'p_dados' ? JSON.stringify(args[k]) : args[k])))).rows[0].r); }),
    incluir: (tb, linha) => como(async () => { const ks = Object.keys(linha); await db.query(`insert into public.${tb} (${ks.join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`, ks.map((k) => linha[k])); }),
    sql: (q, p = []) => como(async () => (await db.query(q, p)).rows),
  };
};
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const estado = async (uid, aal) => transporte(uid, aal).chamar('estado_do_meu_acesso', {});
const conf = async () => Object.fromEntries((await db.query(sql('conferencia-12a.sql'))).rows.map((x) => [x.item, x.resultado]));
// o que Aline e Erivan podem fazer e ver: o próprio perfil, monitorias, colaboradores, critérios, áreas
const visao = async (uid) => { const d = await carregarDados(transporte(uid, 'aal1'), PADROES); const eu = perfilDoLogin(d, uid);
  return JSON.stringify({ eu: eu && { id: eu.id, perfis: eu.perfis, email: eu.email }, m: d.monitorias.map((x) => `${x.id}:${x.status}:${x.versao}`), c: d.colaboradores.map((x) => x.id), k: d.criterios.length, a: d.areas.map((x) => `${x.id}:${x.gestorId}`) }); };
const linha = async (id) => JSON.stringify(await um('select id, email, nome, perfis, status, auth_user_id, versao, extras from public.perfis where id = $1', [id]));
const audN = async () => Number((await um('select count(*) n from public.auditoria')).n);
const quebras = async () => Number((await um('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q')).n);

// ---- linha de base ----------------------------------------------------------------------------
const base = { aline: await linha('usr-1'), erivan: await linha(ERIVAN), vA: await visao(U(1)), vE: await visao(U(2)),
  mon: JSON.stringify((await db.query("select id, status, versao, nota from public.monitorias where id in ('MON-10001','MON-10002') order by id")).rows) };
const c0 = await conf();
ok('A.0', `conferencia-12a na linha de base: 12a "${c0[1]}", ADMIN "${c0[2]}", exceção de implantação "${c0[9]}", usr-1 "${c0[7]}"`,
   c0[1] === '0' && c0[2] === '0 · —' && c0[3] === '—' && c0[9] === 'aberta' && /^MONITOR · ACTIVE · aline\.oliveira@mouraleite\.com\.br · ligado$/.test(c0[7]) && /^GESTOR · ligado · gestor da area-1$/.test(c0[8]), JSON.stringify(c0));

// ---- 11a revisado ANTES do 12a: recusado ------------------------------------------------------
let e = await roda(db, '11a_colaborador_teste_homologacao.sql');
ok('A.1', '11a revisado ANTES do 12a: RECUSADO (MI403 — não há ADMIN ativo) e nada é criado',
   e?.code === 'MI403' && /12a/.test(e.message) && Number((await um("select count(*) n from public.colaboradores where id = 'col-teste-homolog-1'")).n) === 0, e?.message);

// ---- 12a: pré-condições -----------------------------------------------------------------------
{ const d = await novoBanco({ com12: false }); const x = await roda(d, '12a_admin_aline_oliveira.sql');
  ok('A.2', 'sem o script 12, o 12a RECUSA (MI403) e não cria nada', x?.code === 'MI403' && (await d.query("select count(*)::int n from public.perfis where 'ADMIN' = any (perfis)")).rows[0].n === 0, x?.message); }
{ const d = await novoBanco();
  await d.exec(`begin; set local app.responsavel = '${DECL}'; insert into public.perfis (id, email, nome, perfis, status) values ('adm-outro', 'outro.adm@exemplo.test', 'Outro ADMIN', '{ADMIN}', 'ACTIVE'); commit;`);
  const x = await roda(d, '12a_admin_aline_oliveira.sql');
  ok('A.3', 'se já existir OUTRO ADMIN, o 12a RECUSA (MI409): ele só cria o primeiro', x?.code === 'MI409' && (await d.query("select count(*)::int n from public.perfis where id = 'adm-aline-oliveira'")).rows[0].n === 0, x?.message); }
{ const d = await novoBanco();
  await d.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(8)}', '${EMAIL_ADM}', now()); commit;`);
  const x = await roda(d, '12a_admin_aline_oliveira.sql');
  ok('A.4', 'se o login no Auth já existir antes do perfil, o 12a RECUSA (MI409): a ordem é perfil e DEPOIS Auth', x?.code === 'MI409' && /ordem/.test(x.message), x?.message); }

// ---- 12a aplicado --------------------------------------------------------------------------------
const aud0 = await audN();
e = await roda(db, '12a_admin_aline_oliveira.sql');
const adm = await um('select email, nome, perfis, status, auth_user_id, extras from public.perfis where id = $1', [ADM]);
const audAdm = (await db.query("select acao, responsavel_declarado d, autor_perfil_id a from public.auditoria where tabela = 'perfis' and chave ->> 'id' = $1 order by seq", [ADM])).rows;
ok('A.5', `12a aplicado: ${ADM} · ${adm?.email} · ${JSON.stringify(adm?.perfis)} · ${adm?.status} · sem login; auditoria INSERT declarada ("${audAdm[0]?.d}")`,
   !e && adm.email === EMAIL_ADM && adm.nome === 'Aline Oliveira (Administração)' && JSON.stringify(adm.perfis) === '["ADMIN"]' && adm.status === 'ACTIVE' && adm.auth_user_id === null
   && audAdm.length === 1 && audAdm[0].acao === 'INSERT' && audAdm[0].d === DECL && (await audN()) === aud0 + 1, e?.message);
e = await roda(db, '12a_admin_aline_oliveira.sql');
ok('A.6', 'rodar o 12a de novo: nada muda (idempotente; nenhuma linha nova de auditoria)', !e && (await audN()) === aud0 + 1 && Number((await um("select count(*) n from public.perfis where 'ADMIN' = any (perfis)")).n) === 1, e?.message);
ok('A.7', 'usr-1 (Aline monitora) e o perfil do Erivan: IDÊNTICOS (perfis, e-mail, situação, login, versão)', (await linha('usr-1')) === base.aline && (await linha(ERIVAN)) === base.erivan);
ok('A.8', 'MON-10001 e MON-10002 idênticas; cadeia da auditoria sem quebras',
   JSON.stringify((await db.query("select id, status, versao, nota from public.monitorias where id in ('MON-10001','MON-10002') order by id")).rows) === base.mon && (await quebras()) === 0);

// ---- exceção de implantação fechada --------------------------------------------------------------
const tentaDireto = async (resp) => { await db.exec(`begin; set local app.responsavel = '${resp}';`);
  try { await db.query("update public.configuracoes set versao_lida = versao where chave = (select min(chave) from public.configuracoes)"); return null; } catch (x) { return x; } finally { await db.exec('rollback'); } };
const porNome = await tentaDireto(DECL), porAdm = await tentaDireto(ADM), porMonitora = await tentaDireto('usr-1');
ok('A.9', 'exceção de implantação FECHADA: gravação direta declarada por nome → MI401; declarando o usr-1 (não ADMIN) → MI401; declarando adm-aline-oliveira → aceita (testado e desfeito)',
   porNome?.code === 'MI401' && porMonitora?.code === 'MI401' && porAdm === null, JSON.stringify([porNome?.message, porMonitora?.message, porAdm?.message]));

// ---- Aline e Erivan continuam iguais -------------------------------------------------------------
const eA = await estado(U(1), 'aal1'), eE = await estado(U(2), 'aal1');
ok('A.10', `Aline (MONITOR) e Erivan (GESTOR): etapa "${eA.etapa}" / "${eE.etapa}", sem MFA; veem exatamente o mesmo de antes (perfil, monitorias, colaboradores, critérios, áreas)`,
   eA.etapa === 'liberado' && eE.etapa === 'liberado' && !eA.admin && !eE.admin && (await visao(U(1))) === base.vA && (await visao(U(2))) === base.vE);

// ---- login do ADMIN no Auth (local) e MFA ---------------------------------------------------------
await db.exec(`begin; set local app.responsavel = '${ADM}'; insert into auth.users values ('${U(9)}', '${EMAIL_ADM}', now()); commit;`);
const lig = await um('select auth_user_id::text u from public.perfis where id = $1', [ADM]);
ok('A.11', 'usuário criado no Auth com aline.oliveira+admin@ → liga SÓ ao adm-aline-oliveira; usr-1 continua ligado ao login antigo',
   lig.u === U(9) && JSON.parse(await linha('usr-1')).auth_user_id === JSON.parse(base.aline).auth_user_id);
let eAdm = await estado(U(9), 'aal1');
const tr1 = transporte(U(9), 'aal1');
const zero = await tr1.sql("select (select count(*) from public.monitorias) + (select count(*) from public.perfis) + (select count(*) from public.colaboradores) n");
ok('A.12', `ADMIN só com senha (aal1): etapa "${eAdm.etapa}", lê ZERO linhas`, eAdm.etapa === 'cadastrar_mfa' && etapaFinal(eAdm) === 'cadastrar_mfa' && Number(zero[0].n) === 0, JSON.stringify(eAdm));
await db.exec(`insert into auth.mfa_factors (user_id, friendly_name, status) values ('${U(9)}', 'celular 1', 'verified'), ('${U(9)}', 'celular 2', 'verified')`);
eAdm = await estado(U(9), 'aal1');
const eAdm2 = await estado(U(9), 'aal2');
const soua = await transporte(U(9), 'aal2').sql('select app.sou_admin() v');
ok('A.13', `ADMIN com 2 autenticadores: aal1 → "${eAdm.etapa}"; aal2 → "${eAdm2.etapa}", sou_admin() = ${soua[0].v}`, eAdm.etapa === 'verificar_mfa' && eAdm2.etapa === 'liberado' && soua[0].v === true);
const eA2 = await estado(U(1), 'aal1');
ok('A.14', 'os autenticadores do ADMIN NÃO afetam o login de monitora: usr-1 continua "liberado", sem fator', eA2.etapa === 'liberado' && eA2.fator_verificado === false && (await visao(U(1))) === base.vA);
const admSalva = await tenta(() => salvarMonitoria(transporte(U(9), 'aal2'), { id: '', competencia: '2026-10', canal: 'Telefone', tipo: 'Regular', status: 'Rascunho', scores: [], evidencias: [], links: [] }, [], false, false));
ok('A.15', 'segregação (R1): a conta ADMIN, mesmo com MFA, NÃO registra monitoria (MI403) — monitorar é só do usr-1', admSalva.erro?.codigo === 'MI403', admSalva.erro?.message);

// ---- 11a revisado DEPOIS do 12a ----------------------------------------------------------------
e = await roda(db, '11a_colaborador_teste_homologacao.sql');
const audCol = await um("select acao, responsavel_declarado d from public.auditoria where tabela = 'colaboradores' and chave ->> 'id' = 'col-teste-homolog-1' order by seq limit 1");
ok('A.16', `11a revisado DEPOIS do 12a: colaborador fictício criado; auditoria declarada pelo ADMIN ("${audCol?.d}")`, !e && audCol?.acao === 'INSERT' && audCol.d === ADM, e?.message);

// ---- conferência final --------------------------------------------------------------------------
const c1 = await conf();
ok('A.17', `conferencia-12a no fim: 12a "${c1[1]}" · ADMIN "${c1[2]}" · "${c1[3]}" · login "${c1[4]}" · fatores ${c1[5]} · criação "${c1[6]}" · exceção "${c1[9]}"; usr-1, Erivan e MON-10001/10002 iguais à linha de base; ${c1[12]} quebras`,
   c1[1] === '1' && c1[2] === `1 · ${ADM}` && c1[3] === `ADMIN · ACTIVE · ${EMAIL_ADM}` && c1[4] === 'ligado' && c1[5] === '2' && c1[6] === `INSERT · ${DECL}` && c1[9] === 'fechada'
   && c1[7] === c0[7] && c1[8] === c0[8] && c1[10] === c0[10] && c1[12] === '0', JSON.stringify(c1));

relatorio();
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
