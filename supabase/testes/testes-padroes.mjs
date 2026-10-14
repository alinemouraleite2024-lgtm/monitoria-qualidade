// Permissões padrão (ALTER DEFAULT PRIVILEGES) e privilégios herdados.
// Uso: node testes-padroes.mjs <pasta dos scripts>
//
// O Supabase cria funções e tabelas com permissões automáticas para anon,
// authenticated e service_role (no schema public, e podem existir regras
// globais). Um "revoke ... from public" NÃO retira uma permissão dada
// diretamente a esses papéis. Aqui o banco é montado do zero duas vezes —
// limpo e com as permissões automáticas no pior caso — e o estado final de
// permissões precisa ser IDÊNTICO.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [pasta] = process.argv.slice(2);
const sql = (f) => readFileSync(join(pasta, f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const resultados = [];
process.on('uncaughtException', (x) => { for (const r of resultados) console.log((r.ok ? '✔' : '✖') + ' ' + r.id + '  ' + r.desc + (r.ok ? '' : '  → ' + r.det)); console.log('INTERROMPIDO:', x.message); process.exit(2); });
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const SCRIPTS = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql'];
const PERMITIDAS_APP = 'equipe_do_gestor,meu_perfil_id,meus_perfis,sou_admin,tem_perfil,usuario_ativo,usuario_liberado';

// Pior caso: o que o Supabase faz no schema public, mais regras GLOBAIS
// (valem para qualquer schema, inclusive app e api) para funções, tabelas,
// sequências e schemas.
const PADROES = `
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges grant execute on functions to anon, authenticated, service_role;
  alter default privileges grant all on tables    to anon, authenticated;
  alter default privileges grant all on sequences to anon, authenticated;
  alter default privileges grant usage, create on schemas to anon, authenticated;
`;

const montar = async (comPadroes) => {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SETUP);
  if (comPadroes) await db.exec(PADROES);
  for (const f of SCRIPTS) await db.exec(sql(f));
  return db;
};
const retrato = async (db) => {
  const q = async (s) => (await db.query(s)).rows;
  return {
    funcoes: (await q(`select p.oid::regprocedure::text f, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
                         from pg_proc p where p.pronamespace in ('app'::regnamespace, 'api'::regnamespace) order by 1`)).map((r) => `${r.f}:${r.a}/${r.u}`),
    tabelas: (await q(`select c.oid::regclass::text t, r.r, has_table_privilege(r.r, c.oid, 'select') s, has_table_privilege(r.r, c.oid, 'insert') i,
                              has_table_privilege(r.r, c.oid, 'update') up, has_table_privilege(r.r, c.oid, 'delete') d, has_table_privilege(r.r, c.oid, 'truncate') tr
                         from pg_class c cross join (values ('anon'), ('authenticated')) r(r)
                        where c.relnamespace in ('public'::regnamespace, 'app'::regnamespace) and c.relkind in ('r', 'v', 'S') order by 1, 2`)).map((r) => JSON.stringify(r)),
    colunas: (await q(`select table_schema || '.' || table_name || '.' || column_name || ':' || grantee || ':' || privilege_type x from information_schema.column_privileges
                        where grantee in ('anon', 'authenticated') and table_schema in ('public', 'app') order by 1`)).map((r) => r.x),
    schemas: (await q(`select n.nspname || ':' || has_schema_privilege('anon', n.oid, 'usage') || '/' || has_schema_privilege('anon', n.oid, 'create') || '/'
                              || has_schema_privilege('authenticated', n.oid, 'usage') || '/' || has_schema_privilege('authenticated', n.oid, 'create') x
                         from pg_namespace n where n.nspname in ('app', 'api') order by 1`)).map((r) => r.x),
  };
};

const limpo = await montar(false);
const padrao = await montar(true);
const A = await retrato(limpo), B = await retrato(padrao);
const dif = (k) => B[k].filter((x, i) => x !== A[k][i]).concat(A[k].length !== B[k].length ? [`tamanho ${A[k].length} × ${B[k].length}`] : []);

ok('P1', 'com as permissões automáticas no pior caso, as funções de app e api ficam com EXATAMENTE as mesmas permissões do banco limpo', dif('funcoes').length === 0, JSON.stringify(dif('funcoes').slice(0, 12)) + (dif('funcoes').length > 12 ? ` … (${dif('funcoes').length})` : ''));
ok('P2', 'idem para tabelas e sequências (select/insert/update/delete/truncate de anon e authenticated)', dif('tabelas').length === 0, JSON.stringify(dif('tabelas').slice(0, 6)));
ok('P3', 'idem para permissões por coluna', dif('colunas').length === 0, JSON.stringify(dif('colunas').slice(0, 6)));
ok('P4', 'idem para os schemas app e api (uso e CRIAÇÃO de objetos)', dif('schemas').length === 0, JSON.stringify({ limpo: A.schemas, padrao: B.schemas }));

for (const [nome, db] of [['limpo', limpo], ['com padrões', padrao]]) {
  const r = (await db.query(`select
      (select string_agg(proname, ',' order by proname) from pg_proc p where pronamespace = 'app'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')) app_u,
      (select count(*)::int from pg_proc p where pronamespace = 'app'::regnamespace and has_function_privilege('anon', p.oid, 'execute')) app_a,
      (select count(*)::int from pg_proc p where pronamespace = 'api'::regnamespace and has_function_privilege('anon', p.oid, 'execute')) api_a,
      (select count(*)::int from pg_proc p where pronamespace = 'api'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')) api_u,
      has_schema_privilege('authenticated', 'app', 'create') or has_schema_privilege('authenticated', 'api', 'create')
        or has_schema_privilege('anon', 'app', 'create') or has_schema_privilege('anon', 'api', 'create') cria`)).rows[0];
  ok(`P5 (${nome})`, `portal logado executa só as 7 funções auxiliares do app e as 9 do api; anônimo, nenhuma; ninguém cria objetos em app/api`,
     r.app_u === PERMITIDAS_APP && r.app_a === 0 && r.api_a === 0 && r.api_u === 9 && r.cria === false, JSON.stringify(r));

  // Chamada real de TODA função interna (não-gatilho) fora da lista, como logado e como anônimo.
  const fns = (await db.query(`select p.proname, p.oid::regprocedure::text assinatura, (select string_agg('(select null::' || format_type(t, null) || ')', ', ' order by o)
                                  from unnest(p.proargtypes) with ordinality u(t, o)) args
                                 from pg_proc p where p.pronamespace = 'app'::regnamespace and p.prorettype <> 'trigger'::regtype
                                  and p.proname <> all (string_to_array('${PERMITIDAS_APP}', ','))`)).rows;
  const vazou = [];
  for (const papel of ['authenticated', 'anon']) for (const f of fns) {
    await db.exec(`begin; set local role ${papel}; set local request.jwt.claims = '{"sub":"00000001-0000-0000-0000-000000000001","role":"${papel}","aal":"aal2"}';`);
    try { await db.query(`select app.${f.proname}(${f.args || ''})`); vazou.push(`${papel}:${f.assinatura}`); }
    catch (x) { if (x.code !== '42501') vazou.push(`${papel}:${f.assinatura}:${x.code}`); }
    await db.exec('rollback');
  }
  ok(`P6 (${nome})`, `chamada direta de cada uma das ${fns.length} funções internas, como logado (com MFA) e como anônimo: todas recusadas por falta de permissão`, vazou.length === 0, JSON.stringify(vazou.slice(0, 10)));
}

// Privilégios herdados: anon e authenticated não pertencem a nenhum outro papel
for (const [nome, db] of [['limpo', limpo], ['com padrões', padrao]]) {
  const r = (await db.query(`select
      (select string_agg(b.rolname || '∈' || r.rolname, ',') from pg_roles b join pg_roles r on pg_has_role(b.oid, r.oid, 'member') and b.oid <> r.oid
        where b.rolname in ('anon', 'authenticated')) herda,
      (select bool_or(rolsuper or rolbypassrls or rolcreaterole or rolcreatedb) from pg_roles where rolname in ('anon', 'authenticated')) poderes,
      (select string_agg(distinct pg_get_userbyid(p.proowner), ',') from pg_proc p where p.pronamespace = 'api'::regnamespace and p.prosecdef) donos,
      (select bool_or(pg_has_role(x.r, p.proowner, 'member')) from pg_proc p cross join (values ('anon'), ('authenticated')) x(r) where p.pronamespace in ('app'::regnamespace, 'api'::regnamespace)) membro_do_dono`)).rows[0];
  ok(`P7 (${nome})`, 'anon e authenticated não herdam nenhum papel, não têm superpoder (superuser, bypass de RLS, criar papéis/bancos) e não são membros do dono das funções SECURITY DEFINER',
     r.herda === null && r.poderes === false && r.membro_do_dono === false, JSON.stringify(r));
}

for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`);
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length} testes · ${resultados.length - falhas.length} aprovados · ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
