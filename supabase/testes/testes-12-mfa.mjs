// Testes de segurança do script 12 e do MFA do ADMIN (P2), num Postgres LOCAL (PGlite) igual à
// homologação: 00–09a, 09b REAL, 10, logins de Aline e Erivan. Uma conta ADMIN existe SÓ neste
// banco local (fixture de teste) — nenhuma é criada no Supabase.
//
// O que se prova: o banco barra o ADMIN em sessão aal1 em TODA tabela e função protegida, mesmo
// chamando direto (sem a tela); libera em aal2; a função nova só fala da própria sessão; Aline e
// Erivan (sem fator) não mudam em nada.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-12-mfa.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { etapaFinal } = await mod('src/shared/compartilhado/mfa.ts');
const { estadoDoAcesso } = await mod('src/shared/compartilhado/supabase.ts');
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
definirModoParaTeste(true);

// Tabela de fatores do Supabase Auth (no Supabase ela já existe; aqui, a forma mínima usada pelo 12).
const STUB_MFA = `create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`;
const SCRIPTS = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'];
const novoBanco = async (comStub = true) => {
  const d = await PGlite.create({ extensions: { pgcrypto } });
  await d.exec(SETUP); if (comStub) await d.exec(STUB_MFA);
  for (const f of SCRIPTS) await d.exec(sql(f));
  await d.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
  await d.exec(sql('10_p1_reprovar_m1.sql'));
  await d.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
  return d;
};
const db = await novoBanco();
const um = async (q, p) => (await db.query(q, p)).rows[0];

// transporte igual ao da Data API (papel authenticated + JWT com aal)
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
const resumo = (d) => JSON.stringify({ u: d.usuarios.map((x) => x.id), c: d.colaboradores.map((x) => x.id), m: d.monitorias.map((x) => `${x.id}:${x.status}:${x.versao}`), k: d.criterios.length, a: d.areas.map((x) => x.id) });

// ---- antes do 12: como Aline e Erivan veem o portal hoje ----------------------------------------
const antesA = resumo(await carregarDados(transporte(U(1), 'aal1'), PADROES));
const antesE = resumo(await carregarDados(transporte(U(2), 'aal1'), PADROES));
const foto = async () => JSON.stringify(await um(`select (select count(*) from public.auditoria) aud, (select max(seq) from public.auditoria) ancora,
  (select json_agg(m order by id) from (select id, status, versao, nota from public.monitorias) m) mon, (select count(*) from public.perfis) perfis`));
const fotoAntes = await foto();
const conf12 = async () => Object.fromEntries((await db.query(sql('conferencia-12.sql'))).rows.map((x) => [x.item, x]));
const k0 = await conf12();

// O PORTAL NOVO num banco SEM o script 12 (ordem: publicar o Preview antes de aplicar o 12):
// a consulta do estado devolve null e o login segue o fluxo de antes.
const semDoze = [await estadoDoAcesso(transporte(U(1), 'aal1')), await estadoDoAcesso(transporte(U(2), 'aal1'))];
ok('M.0', 'portal novo com banco SEM o 12: estado do acesso = null para Aline e Erivan → login segue o fluxo de hoje (mesmos dados)',
   semDoze.every((x) => x === null) && resumo(await carregarDados(transporte(U(1), 'aal1'), PADROES)) === antesA && resumo(await carregarDados(transporte(U(2), 'aal1'), PADROES)) === antesE);

// ---- 1. o script 12 ------------------------------------------------------------------------------
let e = null; try { await db.exec(sql('12_estado_do_acesso_mfa.sql')); } catch (x) { e = x; }
ok('M.1', 'script 12 aplicado numa transação, com a conferência interna aprovada', !e, e?.message);
e = null; try { await db.exec(sql('12_estado_do_acesso_mfa.sql')); } catch (x) { e = x; }
ok('M.2', 'rodar de novo não quebra nada (idempotente)', !e && Number((await um("select count(*) n from app.versoes_esquema where versao = '12'")).n) === 1, e?.message);
const k1 = await conf12();
ok('M.3b', `conferencia-12 (só leitura): ANTES do 12 acusa ausência; DEPOIS todos os itens ok; MON-10001/10002 e âncora iguais antes e depois ("${k1[8].resultado.split(' | ')[0]}")`,
   k0[1].ok === false && k0[2].resultado === 'não existe' && [1, 2, 3, 4, 5, 9].every((i) => k1[i].ok === true) && k1[7].resultado === k0[7].resultado && k1[8].resultado === k0[8].resultado && k1[6].resultado === '0',
   JSON.stringify([k0, k1].map((k) => Object.values(k).map((x) => `${x.item}:${x.ok}:${x.resultado}`))));
ok('M.3', 'o script 12 NÃO grava dados: monitorias, perfis e auditoria idênticos', (await foto()) === fotoAntes);
const acl = await um(`select has_function_privilege('anon', 'api.estado_do_meu_acesso()'::regprocedure, 'execute') anon,
  has_function_privilege('authenticated', 'api.estado_do_meu_acesso()'::regprocedure, 'execute') auth,
  (select prosecdef from pg_proc where oid = 'api.estado_do_meu_acesso()'::regprocedure) sd, (select pronargs from pg_proc where oid = 'api.estado_do_meu_acesso()'::regprocedure) np`);
ok('M.4', 'função sem parâmetros (só a própria sessão), security definer; anônimo não executa, logado executa', acl.anon === false && acl.auth === true && acl.sd === true && acl.np === 0, JSON.stringify(acl));
{ const d2 = await novoBanco(false); let e2 = null; try { await d2.exec(sql('12_estado_do_acesso_mfa.sql')); } catch (x) { e2 = x; await d2.exec('rollback'); }
  ok('M.5', 'sem a tabela de fatores do Supabase Auth, o 12 recusa (MI403) e nada é criado', e2?.code === 'MI403' && (await d2.query("select to_regprocedure('api.estado_do_meu_acesso()') f")).rows[0].f === null, e2?.message); }
const anon = await (async () => { await db.exec('begin; set local role anon;'); try { await db.query('select api.estado_do_meu_acesso()'); await db.exec('commit'); return null; } catch (x) { await db.exec('rollback'); return x; } })();
ok('M.6', 'chamada anônima à função: recusada (42501)', anon?.code === '42501', anon?.message);

// ---- 2. Aline e Erivan: nada muda --------------------------------------------------------------
const estado = async (uid, aal) => (await transporte(uid, aal).chamar('estado_do_meu_acesso', {}));
const eA = await estado(U(1), 'aal1'), eE = await estado(U(2), 'aal1');
const viaPortal = await estadoDoAcesso(transporte(U(1), 'aal1'));
ok('M.6b', 'com o 12 aplicado, a função do portal (estadoDoAcesso) recebe o mesmo estado que o banco devolve', JSON.stringify(viaPortal) === JSON.stringify(eA));
ok('M.7', `Aline (MONITOR, sem fator): etapa "${eA.etapa}"; Erivan (GESTOR, sem fator): etapa "${eE.etapa}"`,
   eA.etapa === 'liberado' && !eA.admin && !eA.fator_verificado && eE.etapa === 'liberado' && !eE.admin && etapaFinal(eA) === 'liberado' && etapaFinal(eE) === 'liberado', JSON.stringify([eA, eE]));
ok('M.8', 'depois do 12, Aline e Erivan carregam EXATAMENTE os mesmos dados de antes',
   resumo(await carregarDados(transporte(U(1), 'aal1'), PADROES)) === antesA && resumo(await carregarDados(transporte(U(2), 'aal1'), PADROES)) === antesE);
ok('M.9', 'a resposta tem só 6 campos sobre a própria sessão — nenhum id, nome, e-mail ou perfil de outra pessoa',
   JSON.stringify(Object.keys(eA).sort()) === JSON.stringify(['admin', 'ativo', 'etapa', 'fator_verificado', 'nivel', 'tem_perfil']) && !/usr-|@|MON-/.test(JSON.stringify(eA)));
await db.exec(`insert into auth.users values ('${U(4)}', 'sem.perfil@exemplo.test', now())`);
const eS = await estado(U(4), 'aal1');
ok('M.10', 'login sem perfil: etapa "sem_perfil" (o portal recusa como hoje)', eS.etapa === 'sem_perfil' && !eS.tem_perfil);

// ---- 3. conta ADMIN (fixture local) ------------------------------------------------------------
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into public.perfis (id, email, nome, perfis, status) values ('adm-local', 'adm.local@exemplo.test', 'ADMIN de teste (local)', '{ADMIN}', 'ACTIVE'); commit;`);
await db.exec(`begin; set local app.responsavel = 'adm-local'; insert into auth.users values ('${U(9)}', 'adm.local@exemplo.test', now()); commit;`);
const TABELAS = ['perfis', 'colaboradores', 'areas', 'area_monitores', 'alocacoes', 'criterios', 'criterio_subperguntas', 'monitorias', 'monitoria_respostas', 'monitoria_evidencias', 'documentos', 'catalogos', 'configuracoes', 'regua_versoes', 'acessos_log', 'auditoria'];
const contagens = async (aal) => { const tr = transporte(U(9), aal); const o = {}; for (const tb of TABELAS) { const x = await tenta(() => tr.sql(`select count(*)::int n from public.${tb}`)); o[tb] = x.erro ? `erro ${x.erro.codigo}` : x.ok[0].n; } return o; };
const versao = async (id) => Number((await um('select versao from public.monitorias where id = $1', [id])).versao);

let eAdm = await estado(U(9), 'aal1');
ok('M.11', `ADMIN sem fator, sessão só com senha (aal1): etapa "${eAdm.etapa}"`, eAdm.etapa === 'cadastrar_mfa' && eAdm.admin && !eAdm.fator_verificado && etapaFinal(eAdm) === 'cadastrar_mfa', JSON.stringify(eAdm));
const c1 = await contagens('aal1');
ok('M.12', `ADMIN em aal1 lê ZERO linhas em todas as ${TABELAS.length} tabelas (chamada direta, sem a tela)`, Object.values(c1).every((n) => n === 0 || /^erro 42501/.test(n)), JSON.stringify(c1));
const adm1 = transporte(U(9), 'aal1');
const diretas = {
  cancelar: await tenta(() => adm1.chamar('cancelar_monitoria', { p_id: 'MON-10002', p_versao_lida: 1, p_motivo: 'x' })),
  publicar: await tenta(() => adm1.sql("select api.publicar_regua('regua-x', 'X', (app.hoje() + 1), 'x')")),
  validar: await tenta(() => adm1.chamar('validar_monitoria', { p_id: 'MON-10001', p_versao_lida: 1 })),
  fila: await tenta(() => adm1.sql('select * from api.fila_validacao()')),
  salvar: await tenta(() => adm1.chamar('salvar_monitoria', { p_dados: { canal: 'Telefone' }, p_versao_lida: null, p_enviar: false })),
  sou_admin: await tenta(() => adm1.sql('select app.sou_admin() v')),
};
ok('M.13', 'ADMIN em aal1, chamando DIRETO as funções protegidas: cancelar, publicar régua, validar e salvar recusados; a fila volta VAZIA (nada vaza); sou_admin() = false',
   ['cancelar', 'publicar', 'validar', 'salvar'].every((k) => ['MI403', '42501'].includes(diretas[k].erro?.codigo))
   && (['MI403', '42501'].includes(diretas.fila.erro?.codigo) || (Array.isArray(diretas.fila.ok) && diretas.fila.ok.length === 0)) && diretas.sou_admin.ok?.[0]?.v === false,
   JSON.stringify(Object.fromEntries(Object.entries(diretas).map(([k, v]) => [k, v.erro?.codigo ?? JSON.stringify(v.ok)]))));

await db.exec(`insert into auth.mfa_factors (user_id, friendly_name, status) values ('${U(9)}', 'interrompido', 'unverified')`);
eAdm = await estado(U(9), 'aal1');
ok('M.14', 'cadastro interrompido (fator NÃO verificado) não conta: continua "cadastrar_mfa"', eAdm.etapa === 'cadastrar_mfa' && !eAdm.fator_verificado);
await db.exec(`insert into auth.mfa_factors (user_id, friendly_name, status) values ('${U(9)}', 'celular 1', 'verified')`);
eAdm = await estado(U(9), 'aal1');
ok('M.15', `ADMIN com fator verificado mas sessão aal1: etapa "${eAdm.etapa}", e continua lendo ZERO linhas`,
   eAdm.etapa === 'verificar_mfa' && eAdm.fator_verificado && Object.values(await contagens('aal1')).every((n) => n === 0 || /^erro 42501/.test(n)));
const eA2 = await estado(U(1), 'aal1');
ok('M.16', 'o fator do ADMIN não aparece para a Aline (cada um só vê a própria sessão)', eA2.fator_verificado === false && !eA2.admin);

const eAal2 = await estado(U(9), 'aal2');
const c2 = await contagens('aal2');
const adm2 = transporte(U(9), 'aal2');
const vErrada = (await versao('MON-10002')) + 99;
const canc = await tenta(() => adm2.chamar('cancelar_monitoria', { p_id: 'MON-10002', p_versao_lida: vErrada, p_motivo: 'teste de autorização' }));
const soua = await adm2.sql('select app.sou_admin() v');
ok('M.17', `ADMIN em aal2: etapa "${eAal2.etapa}"; lê os dados (perfis ${c2.perfis}, monitorias ${c2.monitorias}); sou_admin() = true; cancelar passa da autorização (para no controle de versão, MI409, sem gravar)`,
   eAal2.etapa === 'liberado' && c2.perfis > 0 && c2.monitorias > 0 && soua[0].v === true && canc.erro?.codigo === 'MI409', JSON.stringify({ eAal2, c2, canc: canc.erro?.codigo }));

const antesFatorE = resumo(await carregarDados(transporte(U(2), 'aal1'), PADROES));
// MFA opcional de quem não é ADMIN: a tela pede o código; o banco não exige (não muda permissão)
await db.exec(`insert into auth.mfa_factors (user_id, friendly_name, status) values ('${U(2)}', 'celular', 'verified')`);
const eE2 = await estado(U(2), 'aal1');
ok('M.18', 'GESTOR que um dia cadastrar fator: a tela pede o código (verificar_mfa); o banco não muda a permissão dele', eE2.etapa === 'verificar_mfa' && !eE2.admin
   && resumo(await carregarDados(transporte(U(2), 'aal1'), PADROES)) === antesFatorE);
await db.exec(`delete from auth.mfa_factors where user_id = '${U(2)}'`);

ok('M.19', 'banco e tela concordam em todos os estados testados (etapaFinal = etapa do banco)',
   [eA, eE, eS, eAal2, eE2].every((x) => etapaFinal(x) === x.etapa));
const quebras = Number((await um('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q')).n);
ok('M.20', 'consultar o estado não grava auditoria; cadeia íntegra; MON-10001 e MON-10002 intactas', quebras === 0
   && JSON.stringify((await db.query("select id, status, versao from public.monitorias where id in ('MON-10001','MON-10002') order by id")).rows) === JSON.stringify(JSON.parse(fotoAntes).mon.filter((m) => ['MON-10001', 'MON-10002'].includes(m.id)).map(({ id, status, versao: v }) => ({ id, status, versao: v }))));

relatorio();
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
