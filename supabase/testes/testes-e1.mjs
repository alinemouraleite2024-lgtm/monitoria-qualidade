// Testes locais da E1 no PGlite (PostgreSQL 18 em WASM). Nada aqui toca o Supabase.
// Uso: node testes-e1.mjs <pasta dos scripts SQL>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const pasta = process.argv[2];
const sql = (f) => readFileSync(join(pasta, f), 'utf8');
const db = await PGlite.create({ extensions: { pgcrypto } });

// ---- Supabase simulado ------------------------------------------------------
await db.exec(`
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  -- comportamento padrão do Supabase: tabela nova em public nasce acessível
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema auth to service_role; grant execute on function auth.uid() to anon, authenticated, service_role;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  -- serviço de login do Supabase (GoTrue): conecta como supabase_auth_admin
  create role supabase_auth_admin nologin;
  grant usage on schema auth to supabase_auth_admin;
  grant select, insert, update on auth.users to supabase_auth_admin;
  grant execute on function auth.uid() to supabase_auth_admin;
  grant execute on function auth.jwt() to supabase_auth_admin;
`);

// ---- utilitários -------------------------------------------------------------
const resultados = [];
process.on('uncaughtException', (x) => { for (const r of resultados) console.log((r.ok ? '✔' : '✖') + ' ' + r.id + '  ' + r.desc + (r.ok ? '' : '  → ' + r.det)); console.log('INTERROMPIDO:', x.message); process.exit(2); });
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const comoUsuario = (uid) => `set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}';`;
async function erro(fn) { try { await fn(); return null; } catch (e) { return e; } }
async function erroSp(fn) { await db.exec('savepoint sp'); try { await fn(); await db.exec('release savepoint sp'); return null; } catch (e) { await db.exec('rollback to savepoint sp'); return e; } }
async function tx(corpo) { // transação que sempre desfaz
  await db.exec('begin');
  try { return await corpo(); } finally { await db.exec('rollback'); }
}
const um = async (q) => (await db.query(q)).rows[0];

// =============================================================================
// 00_base.sql
// =============================================================================
let e = await erro(() => db.exec(sql('00_base.sql')));
ok('00.1', '00 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('00_base.sql')));
ok('00.2', '00 roda de novo sem erro (idempotente)', !e, e?.message);
ok('00.3', 'versão 00 registrada uma única vez', (await um("select count(*)::int n from app.versoes_esquema where versao='00'")).n === 1);

const esperado = createHash('sha256').update('MonitorIA', 'utf8').digest('hex');
ok('00.4', 'digital_texto = SHA-256 do Node', (await um("select app.digital_texto('MonitorIA') d")).d === esperado);
ok('00.5', 'digital_texto distingue acento (byte a byte)', (await um("select app.digital_texto('Nao') <> app.digital_texto('Não') r")).r);
ok('00.6', 'digital_json ignora a ordem das chaves', (await um(`select app.digital_json('{"a":1,"b":[1,2]}') = app.digital_json('{"b":[1,2],"a":1}') r`)).r);
ok('00.7', 'digital_json distingue 2 de "2" e N/A de vazio', (await um(`select app.digital_json('{"s":2}') <> app.digital_json('{"s":"2"}') and app.digital_json('{"s":"N/A"}') <> app.digital_json('{"s":""}') r`)).r);

// tabela de prova com os dois gatilhos, acessível ao portal só para o teste
await db.exec(`
  create table public.t_prova (id text primary key, valor text, versao integer not null default 1, versao_lida integer check (versao_lida is null),
    criado_em timestamptz, criado_por uuid, atualizado_em timestamptz, atualizado_por uuid);
  create trigger c before insert or update on public.t_prova for each row execute function app.tg_controle_registro();
  create trigger d before delete on public.t_prova for each row execute function app.tg_bloquear_exclusao();
  create trigger t before truncate on public.t_prova for each statement execute function app.tg_bloquear_exclusao();
`);

await tx(async () => {
  await db.exec(comoUsuario(U(1)) + " insert into public.t_prova (id, valor, versao) values ('a','x', 99)");
  const r = await um("select versao, criado_por::text cp, atualizado_por::text ap from public.t_prova where id='a'");
  ok('00.8', 'inclusão: versão 1 (ignora o valor enviado) e autor = usuário logado', r.versao === 1 && r.cp === U(1) && r.ap === U(1), JSON.stringify(r));
  await db.exec(comoUsuario(U(2)) + " update public.t_prova set valor='y', versao_lida=1, criado_por=null where id='a'");
  const r2 = await um("select versao, criado_por::text cp, atualizado_por::text ap from public.t_prova where id='a'");
  ok('00.9', 'alteração com a versão lida: versão 2, autoria original intacta, autor da alteração registrado', r2.versao === 2 && r2.cp === U(1) && r2.ap === U(2), JSON.stringify(r2));
  const e2 = await erro(() => db.exec("update public.t_prova set valor='z', versao_lida=1 where id='a'"));
  ok('00.10', 'alteração sobre versão desatualizada é recusada (MI409)', e2?.code === 'MI409', e2?.message);
});

for (const [id, desc, prep] of [
  ['00.11', 'exclusão pelo portal (authenticated) é recusada (MI403)', comoUsuario(U(1))],
  ['00.12', 'portal recusado mesmo declarando o modo de manutenção', comoUsuario(U(1)) + " set local app.manutencao='restauracao'; set local app.manutencao_motivo='tentativa indevida pelo portal';"],
  ['00.13', 'administrador do banco SEM modo de manutenção é recusado', ''],
  ['00.14', 'administrador com modo mas sem motivo suficiente é recusado', "set local app.manutencao='restauracao'; set local app.manutencao_motivo='curto';"],
]) {
  await tx(async () => {
    await db.exec("insert into public.t_prova (id, valor) values ('b','x')");
    const ex = await erro(() => db.exec(prep + " delete from public.t_prova where id='b'"));
    ok(id, desc, ex?.code === 'MI403', ex?.message);
  });
}
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('b','x')");
  const ex = await erro(() => db.exec("set local app.manutencao='restauracao'; set local app.manutencao_motivo='Teste de restauração da homologação'; delete from public.t_prova where id='b'"));
  const n = (await um("select count(*)::int n from public.t_prova where id='b'")).n;
  ok('00.15', 'manutenção autorizada (administrador + modo + motivo) consegue excluir', !ex && n === 0, ex?.message);
});
await tx(async () => {
  const ex = await erro(() => db.exec('truncate public.t_prova'));
  ok('00.16', 'TRUNCATE sem manutenção autorizada é recusado (MI403)', ex?.code === 'MI403', ex?.message);
});
await tx(async () => {
  const ex = await erro(() => db.exec("set local app.manutencao='manutencao'; set local app.manutencao_motivo='Limpeza autorizada da homologação'; truncate public.t_prova"));
  ok('00.17', 'TRUNCATE com manutenção autorizada passa', !ex, ex?.message);
});
await tx(async () => {
  const ex = await erro(() => db.exec(comoUsuario(U(1)) + " select app.digital_texto('x')"));
  ok('00.18', 'portal não executa funções internas do schema app', ex && /permission denied/i.test(ex.message), ex?.message);
});
// ---- Pergunta 1: concorrência com versão lida obrigatória --------------------
await db.exec(`
  create function public.f_definer_upd() returns void language sql security definer set search_path = '' as $$ update public.t_prova set valor = 'via função privilegiada' where id = 'c' $$;
  create function public.f_definer_upd_ok(v int) returns void language sql security definer set search_path = '' as $$ update public.t_prova set valor = 'via função, com versão', versao_lida = v where id = 'c' $$;
  create function public.f_definer_del() returns void language sql security definer set search_path = '' as $$ delete from public.t_prova where id = 'c' $$;
  grant execute on function public.f_definer_upd(), public.f_definer_upd_ok(int), public.f_definer_del() to authenticated;
`);
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  await db.exec(comoUsuario(U(1)) + " update public.t_prova set valor = 'pessoa A', versao_lida = 1 where id = 'c'");
  const ex = await erroSp(() => db.exec("update public.t_prova set valor = 'pessoa B, sem versão' where id = 'c'"));
  const v = (await um("select valor from public.t_prova where id = 'c'")).valor;
  ok('C.1', 'a situação da pergunta: pessoa B grava SEM versão → recusada (MI428) e a alteração de A fica intacta', ex?.code === 'MI428' && v === 'pessoa A', `${ex?.code} · ${v}`);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  await db.exec(comoUsuario(U(1)) + " update public.t_prova set valor = 'pessoa A', versao_lida = 1 where id = 'c'");
  const ex = await erro(() => db.exec("update public.t_prova set valor = 'pessoa B, versão velha', versao_lida = 1 where id = 'c'"));
  ok('C.2', 'pessoa B com a versão que leu antes (desatualizada) → recusada (MI409)', ex?.code === 'MI409', ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  await db.exec(comoUsuario(U(1)) + " update public.t_prova set valor = 'ok', versao_lida = 1, versao = 999 where id = 'c'");
  const r = await um("select versao, versao_lida from public.t_prova where id = 'c'");
  ok('C.3', 'versão enviada pelo cliente é ignorada (vira 2) e versao_lida não fica gravada', r.versao === 2 && r.versao_lida === null, JSON.stringify(r));
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec(`set local role service_role; update public.t_prova set valor = 'chave secreta' where id = 'c'`));
  ok('C.4', 'chave secreta da API (service_role) sem versão → recusada (MI428)', ex?.code === 'MI428', ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec(comoUsuario(U(1)) + ' select public.f_definer_upd()'));
  ok('C.5', 'função privilegiada chamada pelo portal, sem repassar a versão → recusada (MI428)', ex?.code === 'MI428', ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec(comoUsuario(U(1)) + ' select public.f_definer_upd_ok(1)'));
  ok('C.6', 'função privilegiada que repassa a versão lida funciona', !ex, ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec("update public.t_prova set valor = 'ajuste pelo SQL Editor' where id = 'c'"));
  const v = (await um("select versao from public.t_prova where id = 'c'")).versao;
  ok('C.7', 'SQL Editor (administrador, sem usuário logado) é dispensado, mas a versão sobe', !ex && v === 2, ex?.message);
  const ex2 = await erro(() => db.exec(comoUsuario(U(1)) + " update public.t_prova set valor = 'portal com versão antiga', versao_lida = 1 where id = 'c'"));
  ok('C.8', 'e quem estava editando no portal com a versão anterior recebe conflito (MI409)', ex2?.code === 'MI409', ex2?.message);
});

// ---- Pergunta 2: manutenção protegida contra uso indevido --------------------
const MANUT = "set local app.manutencao = 'restauracao'; set local app.manutencao_motivo = 'Teste de uso indevido da manutenção';";
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec(`set local role service_role; ${MANUT} delete from public.t_prova where id = 'c'`));
  ok('M.1', 'chave secreta da API (service_role) declarando manutenção → exclusão recusada (MI403)', ex?.code === 'MI403', ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erroSp(() => db.exec(comoUsuario(U(1)) + ` ${MANUT} select public.f_definer_del()`));
  const n = (await um("select count(*)::int n from public.t_prova where id = 'c'")).n;
  ok('M.2', 'função privilegiada (roda como dono do banco) chamada pelo portal com manutenção declarada → recusada (MI403)', ex?.code === 'MI403' && n === 1, ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec(`set local request.jwt.claims = '{"sub":"${U(1)}"}'; ${MANUT} delete from public.t_prova where id = 'c'`));
  ok('M.3', 'administrador do banco numa requisição com usuário logado → recusada (MI403)', ex?.code === 'MI403', ex?.message);
});
await tx(async () => {
  await db.exec("insert into public.t_prova (id, valor) values ('c', 'original')");
  const ex = await erro(() => db.exec(`set local role authenticated; ${MANUT} delete from public.t_prova where id = 'c'`));
  ok('M.4', 'portal sem usuário identificado declarando manutenção → recusada (MI403)', ex?.code === 'MI403', ex?.message);
});
await db.exec('drop function public.f_definer_upd(); drop function public.f_definer_upd_ok(int); drop function public.f_definer_del();');

await db.exec('drop table public.t_prova'); // tabela de prova (sem gatilho de exclusão de tabela)

// =============================================================================
// 01_identidade.sql
// =============================================================================
e = await erro(() => db.exec(sql('01_identidade.sql')));
ok('01.1', '01 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('01_identidade.sql')));
ok('01.2', '01 roda de novo sem erro (idempotente)', !e, e?.message);
ok('01.3', 'versões 00 e 01 registradas', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01');
ok('01.4', 'RLS ligada em perfis', (await um("select relrowsecurity r from pg_class where oid='public.perfis'::regclass")).r);

// carga como o dono do banco (é como a migração vai gravar)
await db.exec(`insert into public.perfis (id, email, nome, perfis, status, extras, ordem) values
  ('usr-1','monitora.a@exemplo.test','Monitora Sintética A', '{ADMIN,MONITOR}', 'ACTIVE', '{"cargo":"Monitora","gestor":null,"lastAccess":""}', 0),
  ('usr-9','gestor.e@exemplo.test','Erivan (teste)', '{GESTOR}', 'ACTIVE', '{}', 1),
  ('usr-4','colab.a@exemplo.test','Colaboradora Sintética A', '{}', null, '{"cargo":"Front Office"}', 2)`);

for (const [id, desc, q] of [
  ['01.5', 'e-mail com maiúscula é recusado (grava sempre em minúsculas)', "insert into public.perfis (id,email,nome) values ('x1','Fulano@exemplo.test','F')"],
  ['01.6', 'e-mail repetido é recusado', "insert into public.perfis (id,email,nome) values ('x2','monitora.a@exemplo.test','F')"],
  ['01.7', 'senha em extras é recusada', `insert into public.perfis (id,email,nome,extras) values ('x3','x3@exemplo.test','F','{"password":"Admin@123"}')`],
  ['01.8', 'perfil inválido é recusado', "insert into public.perfis (id,email,nome,perfis) values ('x4','x4@exemplo.test','F','{ROOT}')"],
  ['01.9', 'situação inválida é recusada', "insert into public.perfis (id,email,nome,status) values ('x5','x5@exemplo.test','F','ATIVO')"],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(q)); ok(id, desc, !!ex, ex?.message); });
}

for (const [id, desc, prep] of [
  ['01.10', 'portal (authenticated) não lê perfis antes do script 07', comoUsuario(U(1))],
  ['01.11', 'anônimo não lê perfis', 'set local role anon;'],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(prep + ' select * from public.perfis')); ok(id, desc, ex && /permission denied/i.test(ex.message), ex?.message); });
}

// vínculo com o login
await db.exec(`insert into auth.users values ('${U(1)}','Monitora.A@Exemplo.test', now())`);
ok('01.12', 'login com e-mail confirmado liga o perfil (sem diferença de maiúsculas)', (await um("select auth_user_id::text a from public.perfis where id='usr-1'")).a === U(1));
await db.exec(`insert into auth.users values ('${U(2)}','gestor.e@exemplo.test', null)`);
ok('01.13', 'e-mail NÃO confirmado não liga o perfil', (await um("select auth_user_id a from public.perfis where id='usr-9'")).a === null);
await db.exec(`update auth.users set email_confirmed_at = now() where id='${U(2)}'`);
ok('01.14', 'ao confirmar o e-mail, o perfil é ligado', (await um("select auth_user_id::text a from public.perfis where id='usr-9'")).a === U(2));
await db.exec(`insert into auth.users values ('${U(3)}','monitora.a@exemplo.test', now())`);
ok('01.15', 'outro login com o mesmo e-mail NÃO toma o perfil já ligado', (await um("select auth_user_id::text a from public.perfis where id='usr-1'")).a === U(1));
await db.exec(`insert into auth.users values ('${U(4)}','desconhecido@exemplo.test', now())`);
ok('01.16', 'login sem perfil cadastrado não cria perfil', (await um("select count(*)::int n from public.perfis")).n === 3);
ok('01.17', 'vínculo incrementa a versão do perfil (fica auditável)', (await um("select versao from public.perfis where id='usr-1'")).versao === 2);

// funções de perfil
await tx(async () => { await db.exec(comoUsuario(U(1))); const r = await um('select app.meus_perfis() p, app.tem_perfil($$ADMIN$$) a, app.meu_perfil_id() i, app.usuario_ativo() u');
  ok('01.18', 'Aline logada: ADMIN+MONITOR, id usr-1, ativa', JSON.stringify(r.p) === '["ADMIN","MONITOR"]' && r.a && r.i === 'usr-1' && r.u, JSON.stringify(r)); });
await tx(async () => { await db.exec(comoUsuario(U(4))); const r = await um('select app.meus_perfis() p, app.meu_perfil_id() i, app.usuario_ativo() u');
  ok('01.19', 'login sem perfil: nenhum perfil, inativo', JSON.stringify(r.p) === '[]' && r.i === null && r.u === false, JSON.stringify(r)); });
await tx(async () => { await db.exec("update public.perfis set status='INACTIVE' where id='usr-9'"); await db.exec(comoUsuario(U(2))); const r = await um('select app.meus_perfis() p, app.usuario_ativo() u');
  ok('01.20', 'perfil INATIVO: nenhum perfil, sem acesso', JSON.stringify(r.p) === '[]' && r.u === false, JSON.stringify(r)); });
await tx(async () => { await db.exec('set local role anon'); const ex = await erro(() => db.exec('select app.meus_perfis()'));
  ok('01.21', 'anônimo não executa as funções de perfil', ex && /permission denied/i.test(ex.message), ex?.message); });

// proteção (abre uma política temporária só dentro da transação de teste)
const abrirParaTeste = "create policy tmp_up on public.perfis for update to authenticated using (true) with check (true); create policy tmp_sel on public.perfis for select to authenticated using (true); grant select, update on public.perfis to authenticated;";
await tx(async () => { await db.exec(abrirParaTeste + comoUsuario(U(2)));
  const ex = await erro(() => db.exec("update public.perfis set perfis='{GESTOR,ADMIN}', versao_lida=versao where id='usr-9'"));
  ok('01.22', 'Supervisor não se promove a Administrador (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec(abrirParaTeste + comoUsuario(U(2)));
  const ex = await erro(() => db.exec("update public.perfis set status='ACTIVE', email='outro@exemplo.test', versao_lida=versao where id='usr-4'"));
  ok('01.23', 'não-Administrador não altera e-mail/situação de ninguém (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec(abrirParaTeste + comoUsuario(U(1)));
  const ex = await erro(() => db.exec("update public.perfis set perfis='{GESTOR}', status='ACTIVE', versao_lida=versao where id='usr-9'"));
  ok('01.24', 'Administrador altera perfis de outra pessoa', !ex, ex?.message); });
await tx(async () => { await db.exec(abrirParaTeste + comoUsuario(U(2)));
  const ex = await erro(() => db.exec(`update public.perfis set extras = extras || '{"observacoes":"x"}', versao_lida=versao where id='usr-9'`));
  ok('01.25', 'alteração de campo não sensível não é barrada pela proteção', !ex, ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("update public.perfis set id='usr-100' where id='usr-4'"));
  ok('01.26', 'id do perfil nunca muda, nem pelo administrador do banco (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("update public.perfis set perfis='{MONITOR}' where id='usr-1'"));
  ok('01.27', 'remover o único Administrador ativo é recusado (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("update public.perfis set status='INACTIVE' where id='usr-1'"));
  ok('01.28', 'inativar o único Administrador ativo é recusado (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec("update public.perfis set perfis='{GESTOR,ADMIN}' where id='usr-9'");
  const ex = await erro(() => db.exec("update public.perfis set perfis='{MONITOR}' where id='usr-1'"));
  ok('01.29', 'com outro Administrador ativo, a troca é permitida', !ex, ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("delete from public.perfis where id='usr-4'"));
  ok('01.30', 'exclusão de perfil é recusada (MI403)', ex?.code === 'MI403', ex?.message); });

await tx(async () => { await db.exec(`set local request.jwt.claims = '{"sub":"${U(9)}","role":"authenticated"}'`);
  const ex = await erro(() => db.exec(`insert into auth.users values ('${U(5)}','colab.a@exemplo.test', now())`));
  const r = await um("select auth_user_id::text a from public.perfis where id='usr-4'");
  ok('01.31', 'vínculo funciona mesmo se o serviço de login rodar com usuário identificado', !ex && r.a === U(5), ex?.message || JSON.stringify(r)); });

// ---- revisão final: rodar o 00 depois do 01 -------------------------------
e = await erro(() => db.exec(sql("00_base.sql")));
ok("R.1", "00 roda de novo DEPOIS do 01 sem erro", !e, e?.message);
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query("select app.meus_perfis()"));
  ok("R.2", "depois disso, o portal continua executando as funções de perfil", !ex, ex?.message); });
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query("select * from app.versoes_esquema"));
  ok("R.3", "portal logado não lê a tabela de versões, mesmo com uso do schema app", ex && /permission denied/i.test(ex.message), ex?.message); });
await tx(async () => { await db.exec("set local role anon"); const ex = await erro(() => db.query("select * from app.versoes_esquema"));
  ok("R.4", "anônimo não lê a tabela de versões", ex && /permission denied/i.test(ex.message), ex?.message); });
ok("R.5", "versões continuam registradas uma única vez", (await um("select count(*)::int n from app.versoes_esquema")).n === 2);

// =============================================================================
// 02_estrutura.sql
// =============================================================================
const T02 = ['areas', 'area_monitores', 'colaboradores', 'alocacoes', 'alocacoes_historico'];
e = await erro(() => db.exec(sql('02_estrutura.sql')));
ok('02.1', '02 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('02_estrutura.sql')));
ok('02.2', '02 roda de novo sem erro (idempotente)', !e, e?.message);
ok('02.3', 'versões 00, 01 e 02 registradas uma única vez', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02');
ok('02.4', 'RLS ligada nas 5 tabelas', (await um(`select count(*)::int n from pg_class where oid in (${T02.map(t => `'public.${t}'::regclass`).join(',')}) and relrowsecurity`)).n === 5);
for (const [i, prep, quem] of [[5, comoUsuario(U(1)), 'portal (Administradora logada)'], [6, 'set local role anon;', 'anônimo']]) {
  let negados = 0; const det = [];
  for (const t of T02) await tx(async () => { const ex = await erro(() => db.exec(prep + ` select * from public.${t}`)); if (ex && /permission denied/i.test(ex.message)) negados++; else det.push(t); });
  ok(`02.${i}`, `${quem} não lê nenhuma das 5 tabelas antes do script 07`, negados === 5, det.join(','));
}

// carga como a migração fará (dono do banco), com os casos reais do portal
e = await erro(() => db.exec(`
  insert into public.areas (id, nome, gestor_id, ativo, extras, ordem) values
    ('area-1', 'Relacionamento', 'usr-9', true, '{}', 0),
    ('area-2', 'Sem supervisor', null, true, '{"_gestorId_original":""}', 1);
  insert into public.area_monitores (area_id, monitor_id, ordem) values ('area-1', 'usr-1', 0);
  insert into public.colaboradores (id, nome, email, cargo, area_id, ativo, ordem) values
    ('usr-4', 'Colaboradora Sintética A', 'colab.a@exemplo.test', 'Front Office', 'area-1', true, 0),
    ('ag-1700000000000', 'Pessoa sem e-mail', '', '', null, true, 1);
  insert into public.alocacoes (id, monitor_id, colaborador_id, data_inicio, data_fim, ativo, ordem) values
    ('alloc-1', 'usr-1', 'usr-4', '2026-11-01', '2026-10-12', false, 0),
    ('alloc-2', null, 'usr-4', '2026-10-12', null, true, 1);
  insert into public.alocacoes_historico (id, alocacao_id, acao, alterado_por, alterado_em, detalhes, ordem) values
    ('log-1-ins', 'alloc-1', 'INSERT', 'usr-9', '2026-10-01T12:00:00.000Z', 'Colaboradora A alocada para a Monitora A.', 0),
    ('log-2-term', 'alloc-1', 'TERMINATE', 'usr-9', '2026-10-12T12:00:00.000Z', 'Terminada em 2026-10-12.', 1);`));
ok('02.7', 'dados reais do portal entram: área sem supervisor, colaborador sem e-mail/área, carteira sem monitor, fim antes do início', !e, e?.message);
ok('02.8', 'inclusão carimba versão 1 em todas as tabelas', (await um(`select bool_and(v = 1) r from (${T02.map(t => `select versao v from public.${t}`).join(' union all ')}) x`)).r);

for (const [id, desc, q] of [
  ['02.9',  'supervisor inexistente é recusado (referência)', "insert into public.areas (id, nome, gestor_id) values ('a-x', 'X', 'usr-999')"],
  ['02.10', 'monitor repetido na mesma área é recusado', "insert into public.area_monitores (area_id, monitor_id, ordem) values ('area-1', 'usr-1', 1)"],
  ['02.11', 'carteira com colaborador inexistente é recusada', "insert into public.alocacoes (id, colaborador_id) values ('alloc-x', 'ag-nao-existe')"],
  ['02.12', 'ação de histórico inválida é recusada', "insert into public.alocacoes_historico (id, acao) values ('log-x', 'DELETE')"],
  ['02.13', 'extras que não é objeto é recusado', "insert into public.colaboradores (id, nome, extras) values ('ag-x', 'X', '[]')"],
  ['02.14', 'senha em extras do colaborador é recusada', `insert into public.colaboradores (id, nome, extras) values ('ag-y', 'Y', '{"password":"User@123"}')`],
  ['02.15', 'nome vazio é recusado', "insert into public.areas (id, nome) values ('a-y', '  ')"],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(q)); ok(id, desc, !!ex, ex?.message); });
}

// exclusão e TRUNCATE: recusados em todas, inclusive pelo dono do banco sem manutenção
let recusas = 0; const falhou = [];
for (const t of T02) {
  await tx(async () => { const ex = await erro(() => db.exec(`delete from public.${t}`)); if (ex?.code === 'MI403') recusas++; else falhou.push(`delete ${t}`); });
  await tx(async () => { const ex = await erro(() => db.exec(`truncate public.${t} cascade`)); if (ex?.code === 'MI403') recusas++; else falhou.push(`truncate ${t}`); });
}
ok('02.16', 'exclusão e TRUNCATE recusados nas 5 tabelas (MI403)', recusas === 10, falhou.join(', '));

// concorrência pelo portal (política temporária só dentro da transação de teste)
const abrir02 = T02.map(t => `create policy tmp_${t} on public.${t} for all to authenticated using (true) with check (true); grant select, insert, update on public.${t} to authenticated;`).join(' ');
await tx(async () => { await db.exec(abrir02 + comoUsuario(U(2)));
  const ex = await erro(() => db.exec("update public.alocacoes set ativo = false where id = 'alloc-2'"));
  ok('02.17', 'portal altera carteira sem informar a versão → recusado (MI428)', ex?.code === 'MI428', ex?.message); });
await tx(async () => { await db.exec(abrir02 + comoUsuario(U(2)));
  await db.exec("update public.alocacoes set ativo = false, versao_lida = 1 where id = 'alloc-2'");
  const ex = await erro(() => db.exec("update public.alocacoes set data_fim = '2026-12-31', versao_lida = 1 where id = 'alloc-2'"));
  ok('02.18', 'segunda pessoa com a versão antiga → recusada (MI409)', ex?.code === 'MI409', ex?.message); });
await tx(async () => { await db.exec(abrir02 + comoUsuario(U(1)));
  await db.exec("update public.area_monitores set ativo = false, versao_lida = 1 where area_id = 'area-1' and monitor_id = 'usr-1'");
  const r = await um("select ativo, versao, atualizado_por::text a from public.area_monitores where area_id = 'area-1' and monitor_id = 'usr-1'");
  ok('02.19', 'remover monitor da área = remoção lógica (ativo false, versão 2, autor registrado)', r.ativo === false && r.versao === 2 && r.a === U(1), JSON.stringify(r)); });
await tx(async () => { await db.exec(abrir02 + comoUsuario(U(1)));
  await db.exec("insert into public.alocacoes_historico (id, alocacao_id, acao, alterado_por, alterado_em, detalhes) values ('log-3', 'alloc-2', 'INSERT', 'usr-1', now(), 'teste')");
  const r = await um("select criado_por::text c, versao from public.alocacoes_historico where id = 'log-3'");
  ok('02.20', 'portal inclui no histórico; o login real fica em criado_por', r.c === U(1) && r.versao === 1, JSON.stringify(r)); });

// histórico só de inclusão
await tx(async () => { await db.exec(abrir02 + comoUsuario(U(1)));
  const ex = await erro(() => db.exec("update public.alocacoes_historico set detalhes = 'adulterado', versao_lida = 1 where id = 'log-1-ins'"));
  ok('02.21', 'portal não altera o histórico, nem com a versão certa (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("update public.alocacoes_historico set detalhes = 'x' where id = 'log-1-ins'"));
  ok('02.22', 'dono do banco sem manutenção também não altera o histórico (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec("set local app.manutencao = 'manutencao'; set local app.manutencao_motivo = 'Correção autorizada de teste'");
  const ex = await erro(() => db.exec("update public.alocacoes_historico set detalhes = 'corrigido' where id = 'log-1-ins'"));
  const r = await um("select detalhes, versao from public.alocacoes_historico where id = 'log-1-ins'");
  ok('02.23', 'manutenção autorizada corrige o histórico, e a versão sobe', !ex && r.detalhes === 'corrigido' && r.versao === 2, ex?.message || JSON.stringify(r)); });
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.exec('select app.tg_somente_inclusao()'));
  ok('02.24', 'portal não executa a função interna nova', ex && /permission denied/i.test(ex.message), ex?.message); });

// fidelidade: datas e momentos voltam idênticos ao texto do portal
const f02 = await um("select to_char(data_inicio, 'YYYY-MM-DD') i, to_char(data_fim, 'YYYY-MM-DD') f from public.alocacoes where id = 'alloc-1'");
const h02 = await um(`select to_char(alterado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') t from public.alocacoes_historico where id = 'log-2-term'`);
ok('02.25', 'datas e momentos são reconstruídos exatamente como o portal grava', f02.i === '2026-11-01' && f02.f === '2026-10-12' && h02.t === '2026-10-12T12:00:00.000Z', JSON.stringify({ ...f02, ...h02 }));

// rodar tudo de novo depois do 02 não muda nada
e = await erro(async () => { await db.exec(sql('00_base.sql')); await db.exec(sql('01_identidade.sql')); await db.exec(sql('02_estrutura.sql')); });
const cont02 = await um('select (select count(*) from public.areas)::int a, (select count(*) from public.alocacoes_historico)::int h, (select count(*) from app.versoes_esquema)::int v');
ok('02.26', '00, 01 e 02 rodam de novo sem erro e sem tocar nos dados', !e && cont02.a === 2 && cont02.h === 2 && cont02.v === 3, e?.message || JSON.stringify(cont02));
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query('select app.meus_perfis()'));
  ok('02.27', 'depois disso, o portal continua executando as funções de perfil', !ex, ex?.message); });

// =============================================================================
// 03_regua.sql
// =============================================================================
const T03 = ['criterios', 'criterio_subperguntas', 'regua_versoes'];
e = await erro(() => db.exec(sql('03_regua.sql')));
ok('03.1', '03 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('03_regua.sql')));
ok('03.2', '03 roda de novo sem erro (idempotente)', !e, e?.message);
ok('03.3', 'versões 00 a 03 registradas uma única vez', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03');
ok('03.4', 'RLS ligada nas 3 tabelas', (await um(`select count(*)::int n from pg_class where oid in (${T03.map(t => `'public.${t}'::regclass`).join(',')}) and relrowsecurity`)).n === 3);
for (const [i, prep, quem] of [[5, comoUsuario(U(1)), 'portal (Administradora logada)'], [6, 'set local role anon;', 'anônimo']]) {
  let negados = 0; const det = [];
  for (const t of T03) await tx(async () => { const ex = await erro(() => db.exec(prep + ` select * from public.${t}`)); if (ex && /permission denied/i.test(ex.message)) negados++; else det.push(t); });
  ok(`03.${i}`, `${quem} não lê nenhuma das 3 tabelas antes do script 07`, negados === 3, det.join(','));
}

// ---- ida e volta com os critérios REAIS do portal (simula a migração do script 09)
const semente = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const PROMOVIDOS = "array['id','numero','category','name','description','orientacao','tipoResposta','eliminatorio','weight','active','channels','opcoes','ancoras','quandoNA','subPerguntas']";
const migrarCriterios = async (lista) => {
  await db.query(`
    insert into public.criterios (id, numero, bloco, nome, descricao, orientacao, tipo_resposta, eliminatorio, peso, ativo, canais, opcoes, ancoras, quando_na, extras, ordem)
    select c->>'id', (c->>'numero')::int, c->>'category', c->>'name', c->>'description', c->>'orientacao', c->>'tipoResposta',
           (c->>'eliminatorio')::boolean, (c->>'weight')::numeric, (c->>'active')::boolean,
           case when jsonb_typeof(c->'channels') = 'array' then array(select jsonb_array_elements_text(c->'channels')) end,
           case when jsonb_typeof(c->'opcoes')   = 'array' then array(select jsonb_array_elements_text(c->'opcoes')) end,
           case when jsonb_typeof(c->'ancoras')  = 'object' then c->'ancoras' end,
           c->>'quandoNA',
           (c - ${PROMOVIDOS}) || coalesce((select jsonb_build_object('_nulos', jsonb_agg(k order by k)) from jsonb_each(c) x(k, v)
                                            where k = any (${PROMOVIDOS}) and jsonb_typeof(v) = 'null'), '{}'),
           (ord - 1)::int
      from jsonb_array_elements($1::jsonb) with ordinality t(c, ord)`, [JSON.stringify(lista)]);
  await db.query(`
    insert into public.criterio_subperguntas (criterio_id, id, texto, criterio_sim, criterio_nao, ordem, extras)
    select c->>'id', s->>'id', s->>'texto', s->>'criterioSim', s->>'criterioNao', (so - 1)::int, s - array['id','texto','criterioSim','criterioNao']
      from jsonb_array_elements($1::jsonb) c, jsonb_array_elements(case when jsonb_typeof(c->'subPerguntas') = 'array' then c->'subPerguntas' else '[]' end) with ordinality t(s, so)`, [JSON.stringify(lista)]);
};
const RECONSTRUIR = `
  select coalesce(jsonb_agg(obj order by ordem), '[]') r from (
    select c.ordem,
           (select jsonb_object_agg(k, coalesce(v, 'null'::jsonb)) from (values
              ('id', to_jsonb(c.id)), ('numero', to_jsonb(c.numero)), ('category', to_jsonb(c.bloco)), ('name', to_jsonb(c.nome)),
              ('description', to_jsonb(c.descricao)), ('orientacao', to_jsonb(c.orientacao)), ('tipoResposta', to_jsonb(c.tipo_resposta)),
              ('eliminatorio', to_jsonb(c.eliminatorio)), ('weight', to_jsonb(c.peso)), ('active', to_jsonb(c.ativo)),
              ('channels', to_jsonb(c.canais)), ('opcoes', to_jsonb(c.opcoes)), ('ancoras', c.ancoras), ('quandoNA', to_jsonb(c.quando_na)),
              ('subPerguntas', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', s.id, 'texto', s.texto, 'criterioSim', s.criterio_sim, 'criterioNao', s.criterio_nao)) || s.extras order by s.ordem)
                                  from public.criterio_subperguntas s where s.criterio_id = c.id and s.ativo))
            ) x(k, v) where v is not null or coalesce(c.extras->'_nulos', '[]') ? k)
           || (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(c.extras) y(k, v) where k not like '\\_%') as obj
      from public.criterios c) z`;
const digital = async (j) => (await um(`select app.digital_json($1::jsonb) d`.replace('$1', `'${JSON.stringify(j).replace(/'/g, "''")}'`))).d;

await tx(async () => {
  await migrarCriterios(semente);
  const n = await um("select (select count(*) from public.criterios)::int c, (select count(*) from public.criterio_subperguntas)::int s");
  const r = (await um(RECONSTRUIR)).r;
  const iguais = (await digital(r)) === (await digital(semente));
  ok('03.7', `os ${semente.length} critérios reais do portal (e suas sub-perguntas) entram e voltam idênticos (impressão digital)`, iguais && n.c === semente.length, JSON.stringify(n));
});

// variante de produção: crit-06 com peso 100, número vazio, campo null explícito, campo desconhecido
const producao = semente.map((c) => c.id === 'crit-06' ? { ...c, weight: 100 }
  : c.id === 'crit-10' ? { ...c, numero: null, quandoNA: null, campoAntigo: { x: 1 } } : c);
await tx(async () => {
  const ex = await erro(() => migrarCriterios(producao));
  const r = ex ? null : (await um(RECONSTRUIR)).r;
  const iguais = r && (await digital(r)) === (await digital(producao));
  const peso = ex ? null : (await um("select peso::text p from public.criterios where id = 'crit-06'")).p;
  ok('03.8', 'dados de produção entram e voltam idênticos: crit-06 com peso 100, número vazio, null explícito, campo antigo', !ex && iguais && peso === '100', ex?.message || peso);
});

// carga persistente para os demais testes
await migrarCriterios(semente);
const comSub = (await um("select criterio_id c, id s from public.criterio_subperguntas order by criterio_id, ordem limit 1"));
await tx(async () => {
  await db.exec(`update public.criterio_subperguntas set ativo = false where criterio_id = '${comSub.c}' and id = '${comSub.s}'`);
  const r = (await um(RECONSTRUIR)).r;
  const crit = r.find((c) => c.id === comSub.c);
  const linha = await um(`select count(*)::int n from public.criterio_subperguntas where criterio_id = '${comSub.c}' and id = '${comSub.s}'`);
  ok('03.9', 'sub-pergunta retirada (ativo false) sai da régua, mas o registro continua no banco', !crit.subPerguntas.some((s) => s.id === comSub.s) && linha.n === 1, JSON.stringify(crit.subPerguntas.map((s) => s.id)));
});

for (const [id, desc, q] of [
  ['03.10', 'tipo de resposta inválido é recusado', "insert into public.criterios (id, nome, tipo_resposta) values ('crit-x', 'X', 'NOTA_10')"],
  ['03.11', 'âncoras que não são objeto são recusadas', `insert into public.criterios (id, nome, ancoras) values ('crit-y', 'Y', '["2","1"]')`],
  ['03.12', 'sub-pergunta de critério inexistente é recusada', "insert into public.criterio_subperguntas (criterio_id, id, ordem) values ('crit-999', 'sub-1', 0)"],
  ['03.13', 'sub-pergunta repetida no mesmo critério é recusada', `insert into public.criterio_subperguntas (criterio_id, id, ordem) values ('${comSub.c}', '${comSub.s}', 99)`],
  ['03.14', 'nome vazio é recusado', "insert into public.criterios (id, nome) values ('crit-z', ' ')"],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(q)); ok(id, desc, !!ex, ex?.message); });
}
await tx(async () => { const ex = await erro(() => db.exec(`insert into public.criterio_subperguntas (criterio_id, id, ordem) values ('crit-01', '${comSub.s}', 0)`));
  ok('03.15', 'o mesmo id de sub-pergunta em outro critério é aceito (chave por critério)', !ex, ex?.message); });

// publicação de versão da régua
const retratoAtual = (await um(RECONSTRUIR)).r;
e = await erro(() => db.query("insert into public.regua_versoes (id, rotulo, vigente_desde, descricao, retrato) values ('regua-2.0', 'Régua 2.0', '2026-10-12', 'Calibração de 10/10/2026', $1::jsonb)", [JSON.stringify(retratoAtual)]));
const rv = e ? {} : (await db.query("select app.digital_json(retrato) = app.digital_json($1::jsonb) igual, versao from public.regua_versoes where id = 'regua-2.0'", [JSON.stringify(semente)])).rows[0];
ok('03.16', 'versão publicada guarda o retrato completo, idêntico à régua (impressão digital)', !e && rv.igual === true && rv.versao === 1, e?.message || JSON.stringify(rv));
for (const [id, desc, q] of [
  ['03.17', 'retrato vazio é recusado', "insert into public.regua_versoes (id, rotulo, vigente_desde, retrato) values ('r-x', 'X', '2026-10-12', '[]')"],
  ['03.18', 'retrato que não é lista é recusado', `insert into public.regua_versoes (id, rotulo, vigente_desde, retrato) values ('r-y', 'Y', '2026-10-12', '{"a":1}')`],
  ['03.19', 'rótulo de versão repetido é recusado', `insert into public.regua_versoes (id, rotulo, vigente_desde, retrato) values ('r-z', 'Régua 2.0', '2026-10-13', '[{"id":"crit-01"}]')`],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(q)); ok(id, desc, !!ex, ex?.message); });
}
const abrir03 = T03.map(t => `create policy tmp_${t} on public.${t} for all to authenticated using (true) with check (true); grant select, insert, update on public.${t} to authenticated;`).join(' ');
await tx(async () => { await db.exec(abrir03 + comoUsuario(U(1)));
  const ex = await erro(() => db.exec("update public.regua_versoes set descricao = 'alterada', versao_lida = 1 where id = 'regua-2.0'"));
  ok('03.20', 'versão publicada não muda pelo portal, nem com a versão certa (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("update public.regua_versoes set retrato = '[{\"id\":\"x\"}]' where id = 'regua-2.0'"));
  ok('03.21', 'nem pelo dono do banco sem manutenção autorizada (MI403)', ex?.code === 'MI403', ex?.message); });

// concorrência na edição da régua pelo Admin
await tx(async () => { await db.exec(abrir03 + comoUsuario(U(1)));
  const ex = await erro(() => db.exec("update public.criterios set peso = 2 where id = 'crit-06'"));
  ok('03.22', 'Admin altera peso sem informar a versão → recusado (MI428)', ex?.code === 'MI428', ex?.message); });
await tx(async () => { await db.exec(abrir03 + comoUsuario(U(1)));
  await db.exec("update public.criterios set peso = 2, versao_lida = 1 where id = 'crit-06'");
  const ex = await erroSp(() => db.exec("update public.criterios set peso = 3, versao_lida = 1 where id = 'crit-06'"));
  const r = await um("select peso::text p, versao from public.criterios where id = 'crit-06'");
  ok('03.23', 'segunda edição com a versão antiga → recusada (MI409); vale a primeira', ex?.code === 'MI409' && r.p === '2' && r.versao === 2, ex?.message || JSON.stringify(r)); });

// exclusão e TRUNCATE
let rec03 = 0; const fal03 = [];
for (const t of T03) {
  await tx(async () => { const ex = await erro(() => db.exec(`delete from public.${t}`)); if (ex?.code === 'MI403') rec03++; else fal03.push(`delete ${t}`); });
  await tx(async () => { const ex = await erro(() => db.exec(`truncate public.${t} cascade`)); if (ex?.code === 'MI403') rec03++; else fal03.push(`truncate ${t}`); });
}
ok('03.24', 'exclusão e TRUNCATE recusados nas 3 tabelas (MI403)', rec03 === 6, fal03.join(', '));

// rodar tudo de novo depois do 03 não muda nada
e = await erro(async () => { for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql']) await db.exec(sql(f)); });
const cont03 = await um("select (select count(*) from public.criterios)::int c, (select count(*) from public.regua_versoes)::int r, (select count(*) from app.versoes_esquema)::int v, (select app.digital_json(retrato) from public.regua_versoes) d");
ok('03.25', '00 a 03 rodam de novo sem erro e sem tocar nos dados (retrato intacto)', !e && cont03.c === semente.length && cont03.r === 1 && cont03.v === 4 && cont03.d === (await digital(semente)), e?.message || JSON.stringify(cont03));
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query('select app.meus_perfis()'));
  ok('03.26', 'depois disso, o portal continua executando as funções de perfil', !ex, ex?.message); });

// =============================================================================
// 04_monitorias.sql
// =============================================================================
const T04 = ['monitorias', 'monitoria_respostas', 'monitoria_evidencias'];
e = await erro(() => db.exec(sql('04_monitorias.sql')));
ok('04.1', '04 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('04_monitorias.sql')));
ok('04.2', '04 roda de novo sem erro (idempotente)', !e, e?.message);
ok('04.3', 'versões 00 a 04 registradas uma única vez', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03,04');
ok('04.4', 'RLS ligada nas 3 tabelas', (await um(`select count(*)::int n from pg_class where oid in (${T04.map(t => `'public.${t}'::regclass`).join(',')}) and relrowsecurity`)).n === 3);
for (const [i, prep, quem] of [[5, comoUsuario(U(1)), 'portal (Administradora logada)'], [6, 'set local role anon;', 'anônimo']]) {
  let negados = 0; const det = [];
  for (const t of T04) await tx(async () => { const ex = await erro(() => db.exec(prep + ` select * from public.${t}`)); if (ex && /permission denied/i.test(ex.message)) negados++; else det.push(t); });
  ok(`04.${i}`, `${quem} não lê nenhuma das 3 tabelas antes do script 07`, negados === 3, det.join(','));
}

// ---- monitorias no formato real do portal (a mais recente primeiro) ----------
const ISO = (s) => s; // carimbos de toISOString
const MONS = [
  { id: 'MON-10006', protocolo: 'MON-2026-0006', competencia: '2026-08', date: '2026-08-28T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'usr-4',
    canal: 'Telefone', tipo: 'Regular', status: 'Validada', finalScore: 0, zerada: true, eliminatoryPending: false,
    eliminatoryConfirmedBy: 'usr-9', eliminatoryConfirmedAt: ISO('2026-09-02T13:14:15.000Z'),
    scores: [{ criterionId: 'crit-26', score: 0, lowScoreReason: 'Ironia com o cliente aos 03:10.', subRespostas: null }] },
  { id: 'MON-10005', protocolo: 'MON-2026-0005', competencia: '2026-08', date: '2026-08-25T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'usr-4', gestorId: 'usr-9',
    canal: 'WhatsApp', tipo: 'Regular', status: 'Validada', finalScore: 78.57142857142857,
    numeroAtendimento: 'AT-998877', numeroTitulo: 'TIT-55', categoriaAtendimento: 'Boleto',
    inicioAtendimento: '2026-08-25T14:20', fimAtendimento: '2026-08-26T00:05', duracaoMinutos: 585,
    comments: '', strengths: 'Cordialidade.', opportunities: 'Recapitular.', contexto: 'Cliente pede 2ª via.',
    leituraTecnica: 'Condução adequada.', errosIdentificados: '', conclusao: 'Bom atendimento.', evidenciaObservacoes: 'Print anexo.',
    evidencias: [{ id: 'evd-7', name: 'print1.png', type: 'image/png', size: '0.12 MB', date: '25/08/2026' },
                 { id: 'evd-7', name: 'print2.png', type: 'image/png', size: '0.30 MB', date: '25/08/2026' }],
    links: ['https://crm.exemplo/atendimento/998877'],
    eliminatoryPending: false, zerada: false, approvedBy: 'usr-9', approvedAt: ISO('2026-08-30T10:00:00.123Z'),
    scores: [
      { criterionId: 'crit-01', score: 'Reclamação', lowScoreReason: '', subRespostas: null },
      { criterionId: 'crit-04', score: 1.5, lowScoreReason: 'Não reagiu à abertura.', subRespostas: { 'sub-04-1': 'SIM', 'sub-04-2': 'SIM', 'sub-04-3': 'NAO', 'sub-04-4': 'SIM' } },
      { criterionId: 'crit-06', score: 2, lowScoreReason: '', subRespostas: null },
      { criterionId: 'crit-07', score: 1.33, lowScoreReason: 'Espera de 4 min.', subRespostas: null },
      { criterionId: 'crit-08', score: 'N/A', lowScoreReason: 'Não houve transferência.', subRespostas: null },
      { criterionId: 'crit-25', score: 2, lowScoreReason: '', subRespostas: null },
    ] },
  { id: 'MON-10004', protocolo: 'MON-2026-0004', competencia: '2026-09', date: '2026-09-10T12:00:00Z', monitorId: '', colaboradorId: 'usr-4',
    canal: 'Telefone', tipo: 'Direcionada', status: 'Rascunho', finalScore: 0, adjustmentReason: 'Refazer a justificativa do 7.',
    reviewedBy: 'usr-9', reviewedAt: ISO('2026-09-11T09:00:00.000Z'), eliminatoryPending: false, zerada: false,
    evidencias: [], links: [],
    scores: [
      { criterionId: 'crit-26', score: 0, lowScoreReason: '', subRespostas: null },
      { criterionId: 'crit-27', score: '', lowScoreReason: '', subRespostas: null },
      { criterionId: 'crit-04', score: '', lowScoreReason: '', subRespostas: { 'sub-04-1': 'SIM' } },
    ] },
  { id: 'MON-10003', protocolo: 'MON-2026-0003', competencia: '2026-01', date: '2026-01-15T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'usr-4',
    canal: 'E-mail', tipo: 'Regular', status: 'Validada', finalScore: 92.5, lancamentoRetroativo: { por: 'usr-1', em: ISO('2026-10-01T18:30:00.456Z') },
    eliminatoryPending: false, zerada: false,
    scores: [{ criterionId: 'crit-06', score: 2, lowScoreReason: '', subRespostas: null }] },
  { id: 'mon-2', protocolo: '12345', date: '2026-07-10', monitorId: 'usr-1', colaboradorId: 'ag-1700000000000',
    canal: 'Telefone', tipo: 'Processo', status: 'Concluída', finalScore: 85, empreendimento: 'Residencial Ipê', tempo: '00:05',
    campoAntigo: { nota10: 8.5 },
    scores: [{ criterionId: 'crit-antigo-9', score: 2, lowScoreReason: '' }, { criterionId: 'crit-06', score: null, lowScoreReason: '', subRespostas: null }, { criterionId: 'crit-07', lowScoreReason: 'sem nota' }] },
  { id: 'mon-1', protocolo: '12345', competencia: '2026-07', date: '2026-07-01', monitorId: 'usr-1', colaboradorId: 'usr-4',
    canal: 'Presencial', tipo: 'Regular', status: 'Pendente', finalScore: 100, comments: null, scores: [] },
];

// migração (simula o script 09): colunas + extras, com as convenções do cabeçalho
const perfisIds = new Set((await db.query('select id from public.perfis')).rows.map((r) => r.id));
const MAPA = { id: 'id', protocolo: 'protocolo', competencia: 'competencia', date: 'data', monitorId: 'monitor_id', colaboradorId: 'colaborador_id',
  gestorId: 'gestor_id', canal: 'canal', tipo: 'tipo', status: 'status', finalScore: 'nota', numeroAtendimento: 'numero_atendimento',
  numeroTitulo: 'numero_titulo', categoriaAtendimento: 'categoria_atendimento', empreendimento: 'empreendimento', tempo: 'tempo',
  inicioAtendimento: 'inicio_atendimento', fimAtendimento: 'fim_atendimento', duracaoMinutos: 'duracao_minutos', comments: 'comentarios',
  strengths: 'pontos_fortes', opportunities: 'oportunidades', contexto: 'contexto', leituraTecnica: 'leitura_tecnica',
  errosIdentificados: 'erros_identificados', conclusao: 'conclusao', evidenciaObservacoes: 'evidencia_observacoes',
  eliminatoryPending: 'eliminatorio_pendente', zerada: 'zerada', eliminatoryConfirmedBy: 'eliminatorio_confirmado_por',
  eliminatoryConfirmedAt: 'eliminatorio_confirmado_em', approvedBy: 'aprovado_por', approvedAt: 'aprovado_em', reviewedBy: 'revisado_por',
  reviewedAt: 'revisado_em', adjustmentReason: 'motivo_ajuste' };
const REFS_PERFIL = ['monitorId', 'gestorId', 'eliminatoryConfirmedBy', 'approvedBy', 'reviewedBy'];
const CARIMBOS = ['eliminatoryConfirmedAt', 'approvedAt', 'reviewedAt'];
const isoMs = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v);
const migrarMonitorias = async (lista) => {
  const linhas = [], respostas = [], evid = [];
  lista.forEach((m, i) => {
    const l = { ordem: i, retroativo: false }, extras = {}, nulos = [], vazias = [];
    for (const [k, v] of Object.entries(m)) {
      if (k === 'scores' || k === 'evidencias' || k === 'links') { if (Array.isArray(v) && v.length === 0) vazias.push(k); continue; }
      if (k === 'lancamentoRetroativo') {
        if (v && Object.keys(v).join() === 'por,em' && perfisIds.has(v.por) && isoMs(v.em)) Object.assign(l, { retroativo: true, retroativo_por: v.por, retroativo_em: v.em, registrado_por: v.por });
        else extras._lancamentoRetroativo_original = v;
        continue;
      }
      if (!(k in MAPA)) { extras[k] = v; continue; }
      if (v === null) { nulos.push(k); continue; }
      if (REFS_PERFIL.includes(k) && !perfisIds.has(v)) { extras[`_${k}_original`] = v; continue; }
      if (CARIMBOS.includes(k) && !isoMs(v)) { extras[`_${k}_original`] = v; continue; }
      l[MAPA[k]] = v;
    }
    if (nulos.length) extras._nulos = nulos;
    if (vazias.length) extras._listas_vazias = vazias;
    l.extras = extras;
    linhas.push(l);
    (m.scores || []).forEach((s, j) => {
      const ex = {}, nu = [];
      for (const [k, v] of Object.entries(s)) if (!['criterionId', 'score', 'lowScoreReason', 'subRespostas'].includes(k)) ex[k] = v; else if (v === null) nu.push(k);
      if (nu.length) ex._nulos = nu;
      respostas.push({ monitoria_id: m.id, criterio_id: s.criterionId, resposta: 'score' in s && s.score !== null ? s.score : null,
        justificativa: s.lowScoreReason ?? null, sub_respostas: s.subRespostas ?? null, ordem: j, extras: ex });
    });
    for (const lista of ['evidencias', 'links']) (m[lista] || []).forEach((c, j) => evid.push({ monitoria_id: m.id, lista, ordem: j, conteudo: c }));
  });
  await db.query('insert into public.monitorias select * from jsonb_populate_recordset(null::public.monitorias, $1::jsonb)', [JSON.stringify(linhas)]);
  // resposta e sub_respostas são jsonb: o recordset recebe o valor jsonb diretamente
  await db.query(`insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, justificativa, sub_respostas, ordem, extras)
                  select r->>'monitoria_id', r->>'criterio_id', nullif(r->'resposta', 'null'::jsonb), r->>'justificativa',
                         nullif(r->'sub_respostas', 'null'::jsonb), (r->>'ordem')::int, r->'extras'
                    from jsonb_array_elements($1::jsonb) r`, [JSON.stringify(respostas)]);
  if (evid.length) await db.query(`insert into public.monitoria_evidencias (monitoria_id, lista, ordem, conteudo)
                  select r->>'monitoria_id', r->>'lista', (r->>'ordem')::int, r->'conteudo' from jsonb_array_elements($1::jsonb) r`, [JSON.stringify(evid)]);
};

// reconstrução (o caminho inverso, a partir só do que está no banco)
const reconstruirMonitorias = async () => {
  const ms = (await db.query(`select m.*, nota::text nota_t, duracao_minutos::text dur_t,
      to_char(eliminatorio_confirmado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ec_t,
      to_char(aprovado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ap_t,
      to_char(revisado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') rv_t,
      to_char(retroativo_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') rt_t
      from public.monitorias m order by ordem`)).rows;
  const rs = (await db.query("select monitoria_id, criterio_id, resposta::text resposta, justificativa, sub_respostas::text sub, extras::text extras from public.monitoria_respostas order by monitoria_id, ordem")).rows;
  const ev = (await db.query("select monitoria_id, lista, conteudo::text c from public.monitoria_evidencias where ativo order by monitoria_id, lista, ordem")).rows;
  const INV = Object.fromEntries(Object.entries(MAPA).map(([a, b]) => [b, a]));
  const numero = (t) => (t === null ? undefined : JSON.parse(t));
  return ms.map((m) => {
    const ex = m.extras || {}, o = {};
    const val = { ...m, nota: numero(m.nota_t), duracao_minutos: numero(m.dur_t), eliminatorio_confirmado_em: m.ec_t, aprovado_em: m.ap_t, revisado_em: m.rv_t };
    for (const [col, campo] of Object.entries(INV)) if (val[col] !== null && val[col] !== undefined) o[campo] = val[col];
    for (const k of ex._nulos || []) o[k] = null;
    for (const [k, v] of Object.entries(ex)) { const mm = /^_(.+)_original$/.exec(k); if (mm) o[mm[1]] = v; else if (!k.startsWith('_')) o[k] = v; }
    if (m.retroativo) o.lancamentoRetroativo = { por: m.retroativo_por, em: m.rt_t };
    const sc = rs.filter((r) => r.monitoria_id === m.id).map((r) => {
      const x = { criterionId: r.criterio_id }, re = JSON.parse(r.extras);
      if (r.resposta !== null) x.score = JSON.parse(r.resposta);
      if (r.justificativa !== null) x.lowScoreReason = r.justificativa;
      if (r.sub !== null) x.subRespostas = JSON.parse(r.sub);
      for (const k of re._nulos || []) x[k] = null;
      for (const [k, v] of Object.entries(re)) if (!k.startsWith('_')) x[k] = v;
      return x;
    });
    const vazias = ex._listas_vazias || [];
    if (sc.length || vazias.includes('scores')) o.scores = sc;
    for (const lista of ['evidencias', 'links']) {
      const it = ev.filter((r) => r.monitoria_id === m.id && r.lista === lista).map((r) => JSON.parse(r.c));
      if (it.length || vazias.includes(lista)) o[lista] = it;
    }
    return o;
  });
};

e = await erro(() => migrarMonitorias(MONS));
ok('04.7', 'monitorias no formato real do portal entram (rascunho, validada, retroativa, legadas, zerada)', !e, e?.message);
const recon = e ? [] : await reconstruirMonitorias();
const dOrig = await digital(MONS), dRec = await digital(recon);
ok('04.8', 'as 6 monitorias voltam IDÊNTICAS ao original (impressão digital): respostas, evidências, notas, datas, selos, campos antigos', dOrig === dRec,
   dOrig === dRec ? '' : JSON.stringify(recon).slice(0, 400));
const tipos = await um(`select string_agg(coalesce(resposta::text, 'AUSENTE'), ' | ' order by monitoria_id, ordem) t from public.monitoria_respostas where monitoria_id in ('MON-10004', 'mon-2')`);
ok('04.9', 'resposta 0, "" e ausente/nula continuam diferentes (0 do eliminatório nunca vira vazio)', tipos.t === '0 | "" | "" | 2 | AUSENTE | AUSENTE', tipos.t);
ok('04.10', 'nota histórica gravada com todos os dígitos (78.57142857142857)', (await um("select nota::text n from public.monitorias where id = 'MON-10005'")).n === '78.57142857142857');
ok('04.11', 'quem avaliou e quem registrou ficam separados no retroativo migrado', JSON.stringify(await um("select monitor_id, registrado_por, retroativo, retroativo_por from public.monitorias where id = 'MON-10003'")) === '{"monitor_id":"usr-1","registrado_por":"usr-1","retroativo":true,"retroativo_por":"usr-1"}');
ok('04.12', 'protocolo digitado repetido (legado) é aceito; evidências com o mesmo id na mesma monitoria também',
   (await um("select (select count(*) from public.monitorias where protocolo = '12345')::int p, (select count(*) from public.monitoria_evidencias where monitoria_id = 'MON-10005' and conteudo->>'id' = 'evd-7')::int e")).p === 2);

for (const [id, desc, q] of [
  ['04.13', 'protocolo gerado repetido é recusado', "insert into public.monitorias (id, protocolo) values ('MON-X', 'MON-2026-0005')"],
  ['04.14', 'situação inválida é recusada', "insert into public.monitorias (id, status) values ('MON-X', 'Aprovadíssima')"],
  ['04.15', 'competência fora do formato AAAA-MM é recusada', "insert into public.monitorias (id, competencia) values ('MON-X', '08/2026')"],
  ['04.16', 'monitor inexistente é recusado', "insert into public.monitorias (id, monitor_id) values ('MON-X', 'usr-999')"],
  ['04.17', 'versão de régua inexistente é recusada', "insert into public.monitorias (id, regua_versao_id) values ('MON-X', 'regua-9')"],
  ['04.18', 'resposta para monitoria inexistente é recusada', "insert into public.monitoria_respostas (monitoria_id, criterio_id, ordem) values ('MON-NAO', 'crit-06', 0)"],
  ['04.19', 'resposta em formato de objeto é recusada', `insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, ordem) values ('mon-1', 'crit-06', '{"x":1}', 0)`],
  ['04.20', 'lista de evidência inválida é recusada', `insert into public.monitoria_evidencias (monitoria_id, lista, ordem, conteudo) values ('mon-1', 'anexos', 0, '"x"')`],
  ['04.21', 'selo retroativo incoerente (sem marca, com autor) é recusado', "insert into public.monitorias (id, retroativo, retroativo_por) values ('MON-X', false, 'usr-1')"],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(q)); ok(id, desc, !!ex, ex?.message); });
}
await tx(async () => { const ex = await erro(() => db.exec("insert into public.monitorias (id, regua_versao_id) values ('MON-Y', 'regua-2.0')"));
  ok('04.22', 'monitoria vinculada a uma versão publicada da régua é aceita', !ex, ex?.message); });

// ---- autoria pelo portal (política temporária só dentro da transação de teste)
const abrir04 = T04.map(t => `create policy tmp_${t} on public.${t} for all to authenticated using (true) with check (true); grant select, insert, update on public.${t} to authenticated;`).join(' ');
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1)));
  await db.exec("insert into public.monitorias (id, protocolo, monitor_id, registrado_por, colaborador_id, status) values ('MON-20001', 'MON-2026-0100', 'usr-9', 'usr-9', 'usr-4', 'Rascunho')");
  const r = await um("select monitor_id, registrado_por, criado_por::text c from public.monitorias where id = 'MON-20001'");
  ok('04.23', 'inclusão pelo portal: o banco carimba quem registrou pelo login (ignora o valor enviado) e mantém quem avaliou', r.monitor_id === 'usr-9' && r.registrado_por === 'usr-1' && r.c === U(1), JSON.stringify(r)); });
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1)));
  await db.exec("insert into public.monitorias (id, monitor_id, retroativo, retroativo_por, retroativo_em) values ('MON-20002', 'usr-9', true, 'usr-9', '2020-01-01')");
  const r = await um("select retroativo_por p, retroativo_em > now() - interval '1 minute' recente from public.monitorias where id = 'MON-20002'");
  ok('04.24', 'retroativo pelo portal: o banco carimba quem e quando (não aceita data nem autor enviados)', r.p === 'usr-1' && r.recente === true, JSON.stringify(r)); });
for (const [id, desc, upd] of [
  ['04.25', 'portal não altera quem registrou (MI403)', "update public.monitorias set registrado_por = 'usr-9', versao_lida = 1 where id = 'MON-10003'"],
  ['04.26', 'portal não altera o código da monitoria (MI403)', "update public.monitorias set id = 'MON-99999', versao_lida = 1 where id = 'MON-10004'"],
  ['04.27', 'portal não altera o protocolo (MI403)', "update public.monitorias set protocolo = 'MON-2026-0999', versao_lida = 1 where id = 'MON-10004'"],
  ['04.28', 'portal não retira o selo retroativo (MI403)', "update public.monitorias set retroativo = false, retroativo_por = null, retroativo_em = null, versao_lida = 1 where id = 'MON-10003'"],
]) {
  await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1))); const ex = await erro(() => db.exec(upd)); ok(id, desc, ex?.code === 'MI403', ex?.message); });
}
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(2)));
  await db.exec("update public.monitorias set retroativo = true, retroativo_por = 'usr-1', status = 'Validada', versao_lida = 1 where id = 'MON-10004'");
  const r = await um("select retroativo, retroativo_por p, versao from public.monitorias where id = 'MON-10004'");
  ok('04.29', 'rascunho finalizado como retroativo: o banco carimba o autor real do lançamento', r.retroativo === true && r.p === 'usr-9' && r.versao === 2, JSON.stringify(r)); });
await tx(async () => { const ex = await erro(() => db.exec("update public.monitorias set protocolo = 'MON-2026-0999' where id = 'MON-10004'"));
  ok('04.30', 'nem o SQL Editor altera o protocolo sem manutenção autorizada (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec("set local app.manutencao = 'manutencao'; set local app.manutencao_motivo = 'Correção autorizada de protocolo'");
  const ex = await erro(() => db.exec("update public.monitorias set protocolo = 'MON-2026-0999' where id = 'MON-10004'"));
  ok('04.31', 'com manutenção autorizada, a correção passa', !ex, ex?.message); });

// concorrência
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1)));
  const ex = await erro(() => db.exec("update public.monitoria_respostas set resposta = '1' where monitoria_id = 'MON-10005' and criterio_id = 'crit-06'"));
  ok('04.32', 'alterar resposta sem informar a versão → recusado (MI428)', ex?.code === 'MI428', ex?.message); });
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1)));
  await db.exec("update public.monitorias set conclusao = 'A', versao_lida = 1 where id = 'MON-10005'");
  const ex = await erroSp(() => db.exec("update public.monitorias set conclusao = 'B', versao_lida = 1 where id = 'MON-10005'"));
  const r = await um("select conclusao, versao from public.monitorias where id = 'MON-10005'");
  ok('04.33', 'duas pessoas editando a mesma monitoria: a segunda é recusada (MI409) e vale a primeira', ex?.code === 'MI409' && r.conclusao === 'A' && r.versao === 2, ex?.message || JSON.stringify(r)); });

// exclusão e TRUNCATE
let rec04 = 0; const fal04 = [];
for (const t of T04) {
  await tx(async () => { const ex = await erro(() => db.exec(`delete from public.${t}`)); if (ex?.code === 'MI403') rec04++; else fal04.push(`delete ${t}`); });
  await tx(async () => { const ex = await erro(() => db.exec(`truncate public.${t} cascade`)); if (ex?.code === 'MI403') rec04++; else fal04.push(`truncate ${t}`); });
}
ok('04.34', 'exclusão e TRUNCATE recusados nas 3 tabelas (MI403)', rec04 === 6, fal04.join(', '));
let fn04 = 0;
for (const f of ['app.tg_monitorias_protecao()']) await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.exec(`select ${f}`)); if (ex && /permission denied/i.test(ex.message)) fn04++; });
ok('04.35', 'portal não executa a função interna nova', fn04 === 1);

// rodar tudo de novo depois do 04 não muda nada
e = await erro(async () => { for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql']) await db.exec(sql(f)); });
const rec2 = e ? [] : await reconstruirMonitorias();
ok('04.36', '00 a 04 rodam de novo sem erro e as monitorias continuam idênticas', !e && (await digital(rec2)) === dOrig, e?.message);
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query('select app.meus_perfis()'));
  ok('04.37', 'depois disso, o portal continua executando as funções de perfil', !ex, ex?.message); });

// =============================================================================
// 05_documentos.sql
// =============================================================================
const T05 = ['documentos', 'catalogos', 'configuracoes', 'acessos_log'];
e = await erro(() => db.exec(sql('05_documentos.sql')));
ok('05.1', '05 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('05_documentos.sql')));
ok('05.2', '05 roda de novo sem erro (idempotente)', !e, e?.message);
ok('05.3', 'versões 00 a 05 registradas uma única vez', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03,04,05');
ok('05.4', 'RLS ligada nas 4 tabelas', (await um(`select count(*)::int n from pg_class where oid in (${T05.map(t => `'public.${t}'::regclass`).join(',')}) and relrowsecurity`)).n === 4);
for (const [i, prep, quem] of [[5, comoUsuario(U(1)), 'portal (Administradora logada)'], [6, 'set local role anon;', 'anônimo']]) {
  let negados = 0; const det = [];
  for (const t of T05) await tx(async () => { const ex = await erro(() => db.exec(prep + ` select * from public.${t}`)); if (ex && /permission denied/i.test(ex.message)) negados++; else det.push(t); });
  ok(`05.${i}`, `${quem} não lê nenhuma das 4 tabelas antes do script 07`, negados === 4, det.join(','));
}

// ---- dados no formato real do portal -------------------------------------------
const cat05 = JSON.parse(readFileSync(process.argv[3].replace('criterios-semente.json', 'catalogos-semente.json'), 'utf8'));
const COLECOES = {
  metas_colaborador: [
    { id: 'cgoal-1727900000000', monitorId: 'usr-1', colaboradorId: 'usr-4', year: 2026, month: 8, targetQty: 4 },
    { id: 'cgoal-1727900000001', monitorId: 'usr-1', colaboradorId: 'usr-4', year: 2026, month: 8, targetQty: 2, canal: 'WhatsApp' },
    { id: 'cgoal-1727900000002', monitorId: 'usr-1', colaboradorId: 'ag-1700000000000', year: 2026, month: 9, targetQty: 0, semMeta: true, motivo: 'Férias' },
  ],
  planos_metas: [{ id: 'plano-1', nome: 'Plano 2º semestre', vigenciaInicio: '2026-08', vigenciaFim: '2026-12', criadoPor: 'usr-9', criadoEm: '2026-08-01T10:00:00.000Z',
    linhas: [{ monitorId: 'usr-1', colaboradorId: 'usr-4', targetQty: 4 }, { monitorId: 'usr-1', colaboradorId: 'ag-1700000000000', canal: 'Telefone', targetQty: 2, entraEm: '2026-09' }] }],
  feriados: [{ id: 'hol-1', originalMonitorId: 'usr-1', substituteMonitorId: 'usr-9', startDate: '2026-12-20', endDate: '2027-01-05', isActive: true }],
  metas_monitor: [{ id: 'mgoal-1', monitorId: 'usr-1', year: 2026, month: 7, targetQty: 20 }],
  agenda: [{ titulo: 'Item antigo sem id', data: '2026-06-01' }, { id: 'ag-dup', titulo: 'A' }, { id: 'ag-dup', titulo: 'B (id repetido)' }],
  demandas: [], comunicados: [],
};
const LOGS = [
  { id: '1728000000000', eventType: 'SWITCH_PROFILE', userEmail: 'monitora.a@exemplo.test', userName: 'Monitora Sintética A', userRole: 'MONITOR', actionDetails: 'ADMIN -> MONITOR', timestamp: '2026-10-04T00:00:00.000Z' },
  { id: '1728000000000', eventType: 'LOGIN', userEmail: 'monitora.a@exemplo.test', userName: 'Monitora Sintética A', userRole: 'ADMIN', actionDetails: '', timestamp: '2026-10-04T00:00:00.000Z' },
  { id: '1724000000000', eventType: 'LOGIN_DENIED', userEmail: 'N/A', userName: 'Sistema', userRole: 'N/A', actionDetails: 'Usuário sem perfil de acesso', timestamp: '2026-08-18T21:20:00.000Z', ip: '192.168.0.142' },
];

const chaveDoc = (lista) => { const vistos = new Set(); return lista.map((it, i) => {
  const ok1 = it && typeof it.id === 'string' && it.id.trim() !== '' && !vistos.has(it.id); if (ok1) vistos.add(it.id); return ok1 ? it.id : `#${i}`; }); };
const migrar05 = async () => {
  const docs = []; for (const [c, lista] of Object.entries(COLECOES)) { const ids = chaveDoc(lista); lista.forEach((it, i) => docs.push({ colecao: c, id: ids[i], conteudo: it, ordem: i })); }
  await db.query(`insert into public.documentos (colecao, id, conteudo, ordem) select d->>'colecao', d->>'id', d->'conteudo', (d->>'ordem')::int from jsonb_array_elements($1::jsonb) d`, [JSON.stringify(docs)]);
  const cats = []; for (const c of ['empreendimentos', 'categorias']) cat05[c].forEach((v, i) => cats.push({ catalogo: c, ordem: i, valor: v }));
  await db.query(`insert into public.catalogos (catalogo, ordem, valor) select d->>'catalogo', (d->>'ordem')::int, d->>'valor' from jsonb_array_elements($1::jsonb) d`, [JSON.stringify(cats)]);
  await db.query(`insert into public.configuracoes (chave, valor) values ('settings', $1::jsonb), ('brand', $2::jsonb)`, [JSON.stringify(cat05.settings), JSON.stringify(cat05.brand)]);
  const MAP = { id: 'id', eventType: 'tipo_evento', userEmail: 'usuario_email', userName: 'usuario_nome', userRole: 'usuario_perfil', actionDetails: 'detalhes', timestamp: 'momento' };
  const linhas = LOGS.map((l, i) => { const o = { ordem: i, extras: {} }; for (const [k, v] of Object.entries(l)) { if (k in MAP && !(k === 'timestamp' && !isoMs(v))) o[MAP[k]] = v; else if (k in MAP) o.extras[`_${k}_original`] = v; else o.extras[k] = v; } return o; });
  await db.query(`insert into public.acessos_log (id, tipo_evento, usuario_email, usuario_nome, usuario_perfil, detalhes, momento, extras, ordem)
                  select r->>'id', r->>'tipo_evento', r->>'usuario_email', r->>'usuario_nome', r->>'usuario_perfil', r->>'detalhes', (r->>'momento')::timestamptz, r->'extras', (r->>'ordem')::int
                    from jsonb_array_elements($1::jsonb) r`, [JSON.stringify(linhas)]);
};
const reconstruir05 = async () => {
  const col = {}; for (const c of Object.keys(COLECOES)) col[c] = (await db.query("select conteudo::text c from public.documentos where colecao = $1 and ativo order by ordem", [c])).rows.map((r) => JSON.parse(r.c));
  const cats = {}; for (const c of ['empreendimentos', 'categorias']) cats[c] = (await db.query("select valor from public.catalogos where catalogo = $1 and ativo order by ordem", [c])).rows.map((r) => r.valor);
  const cfg = Object.fromEntries((await db.query("select chave, valor::text v from public.configuracoes")).rows.map((r) => [r.chave, JSON.parse(r.v)]));
  const logs = (await db.query(`select id, tipo_evento, usuario_email, usuario_nome, usuario_perfil, detalhes, extras::text extras,
      to_char(momento at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') momento from public.acessos_log order by ordem`)).rows.map((r) => {
    const o = { id: r.id, eventType: r.tipo_evento, userEmail: r.usuario_email, userName: r.usuario_nome, userRole: r.usuario_perfil, actionDetails: r.detalhes, timestamp: r.momento };
    for (const [k, v] of Object.entries(JSON.parse(r.extras))) { const m = /^_(.+)_original$/.exec(k); if (m) o[m[1]] = v; else o[k] = v; } return o; });
  return { colecoes: col, empreendimentos: cats.empreendimentos, categorias: cats.categorias, settings: cfg.settings, brand: cfg.brand, logs };
};
const original05 = { colecoes: COLECOES, empreendimentos: cat05.empreendimentos, categorias: cat05.categorias, settings: cat05.settings, brand: cat05.brand, logs: LOGS };

e = await erro(() => migrar05());
ok('05.7', 'dados no formato real entram: metas, planos, férias, agenda sem id e com id repetido, catálogos, configurações, logs com id repetido', !e, e?.message);
const rec05 = e ? {} : await reconstruir05();
const d05 = await digital(original05);
ok('05.8', `tudo volta IDÊNTICO ao original (impressão digital): 7 coleções, ${cat05.categorias.length} categorias, ${cat05.empreendimentos.length} empreendimentos, settings, brand e 3 logs`, (await digital(rec05)) === d05,
   JSON.stringify(rec05).slice(0, 300));
ok('05.9', 'log antigo preserva o ip simulado em extras, e os dois logs com o mesmo id ficam separados',
   (await um("select (select extras->>'ip' from public.acessos_log where tipo_evento = 'LOGIN_DENIED') ip, (select count(*) from public.acessos_log where id = '1728000000000')::int n")).n === 2 && (await um("select extras->>'ip' ip from public.acessos_log where tipo_evento = 'LOGIN_DENIED'")).ip === '192.168.0.142');

for (const [id, desc, q] of [
  ['05.10', 'coleção desconhecida é recusada', `insert into public.documentos (colecao, id, conteudo, ordem) values ('senhas', 'x', '{}', 0)`],
  ['05.11', 'chave diferente do id do conteúdo é recusada', `insert into public.documentos (colecao, id, conteudo, ordem) values ('agenda', 'a-1', '{"id":"a-2"}', 9)`],
  ['05.12', 'conteúdo que não é objeto é recusado', `insert into public.documentos (colecao, id, conteudo, ordem) values ('agenda', 'a-3', '[1]', 9)`],
  ['05.13', 'catálogo desconhecido é recusado', "insert into public.catalogos (catalogo, ordem, valor) values ('cores', 0, 'azul')"],
  ['05.14', 'chave de configuração fora do padrão é recusada', `insert into public.configuracoes (chave, valor) values ('Senha Admin', '"x"')`],
]) {
  await tx(async () => { const ex = await erro(() => db.exec(q)); ok(id, desc, !!ex, ex?.message); });
}

// ---- pelo portal (política temporária só dentro da transação de teste) --------
const abrir05 = T05.map(t => `create policy tmp_${t} on public.${t} for all to authenticated using (true) with check (true); grant select, insert, update on public.${t} to authenticated;`).join(' ');
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(2)));
  await db.exec("update public.documentos set ativo = false, versao_lida = 1 where colecao = 'metas_colaborador' and id = 'cgoal-1727900000001'");
  const r = await um("select ativo, versao, atualizado_por::text a from public.documentos where colecao = 'metas_colaborador' and id = 'cgoal-1727900000001'");
  const lista = (await reconstruir05()).colecoes.metas_colaborador.map((g) => g.id);
  ok('05.15', 'retirar meta (o portal apagava) = remoção lógica: sai da lista, fica no banco com autor e versão', r.ativo === false && r.versao === 2 && r.a === U(2) && !lista.includes('cgoal-1727900000001') && lista.length === 2, JSON.stringify(r)); });
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(1)));
  await db.exec(`insert into public.acessos_log (id, tipo_evento, usuario_email, usuario_nome, usuario_perfil, detalhes, momento, perfil_id) values ('1', 'LOGIN', 'falso@x.com', 'Falso', 'ADMIN', '', '2000-01-01', 'usr-9')`);
  const r = await um("select perfil_id, momento > now() - interval '1 minute' recente, criado_por::text c from public.acessos_log where id = '1'");
  ok('05.16', 'log gravado pelo portal: o banco carimba o perfil logado e o momento (ignora os enviados)', r.perfil_id === 'usr-1' && r.recente === true && r.c === U(1), JSON.stringify(r)); });
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(1)));
  const ex = await erro(() => db.exec("update public.acessos_log set detalhes = 'apagado', versao_lida = 1 where tipo_evento = 'LOGIN_DENIED'"));
  ok('05.17', 'histórico de acessos não é alterado pelo portal (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { const ex = await erro(() => db.exec("update public.acessos_log set detalhes = 'x' where tipo_evento = 'LOGIN_DENIED'"));
  ok('05.18', 'nem pelo SQL Editor sem manutenção autorizada (MI403)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(1)));
  const ex = await erro(() => db.exec(`update public.configuracoes set valor = '{"requireGestorValidation":false,"defasagemCompetencia":1}' where chave = 'settings'`));
  ok('05.19', 'alterar configuração sem informar a versão → recusado (MI428)', ex?.code === 'MI428', ex?.message); });
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(1)));
  await db.exec(`update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '0'), versao_lida = 1 where chave = 'settings'`);
  const ex = await erroSp(() => db.exec(`update public.configuracoes set valor = jsonb_set(valor, '{requireGestorValidation}', 'false'), versao_lida = 1 where chave = 'settings'`));
  const r = await um("select valor::text v, versao from public.configuracoes where chave = 'settings'");
  ok('05.20', 'duas pessoas alterando a configuração: a segunda é recusada (MI409) e vale a primeira', ex?.code === 'MI409' && r.versao === 2 && JSON.parse(r.v).requireGestorValidation === true, ex?.message || r.v); });
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(1)));
  await db.exec("insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 27, 'NOVA CATEGORIA')");
  const r = (await reconstruir05()).categorias;
  ok('05.21', 'categoria nova pelo portal entra no fim da lista, como hoje', r.length === cat05.categorias.length + 1 && r[r.length - 1] === 'NOVA CATEGORIA'); });

let rec05x = 0; const fal05 = [];
for (const t of T05) {
  await tx(async () => { const ex = await erro(() => db.exec(`delete from public.${t}`)); if (ex?.code === 'MI403') rec05x++; else fal05.push(`delete ${t}`); });
  await tx(async () => { const ex = await erro(() => db.exec(`truncate public.${t}`)); if (ex?.code === 'MI403') rec05x++; else fal05.push(`truncate ${t}`); });
}
ok('05.22', 'exclusão e TRUNCATE recusados nas 4 tabelas (MI403)', rec05x === 8, fal05.join(', '));
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.exec('select app.tg_acessos_log_autoria()'));
  ok('05.23', 'portal não executa a função interna nova', ex && /permission denied/i.test(ex.message), ex?.message); });

e = await erro(async () => { for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql']) await db.exec(sql(f)); });
ok('05.24', '00 a 05 rodam de novo sem erro e tudo continua idêntico (monitorias e documentos)', !e && (await digital(await reconstruir05())) === d05 && (await digital(await reconstruirMonitorias())) === dOrig, e?.message);
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query('select app.meus_perfis()'));
  ok('05.25', 'depois disso, o portal continua executando as funções de perfil', !ex, ex?.message); });

// =============================================================================
// 06_auditoria.sql
// =============================================================================
// Operações diretas no banco exigem responsável declarado (R5). A sessão de
// teste declara a administradora usr-1 (ainda ADMIN nesta fase da bateria).
await db.exec("set app.responsavel = 'usr-1'");
e = await erro(() => db.exec(sql('06_auditoria.sql')));
ok('06.1', '06 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('06_auditoria.sql')));
ok('06.2', '06 roda de novo sem erro (idempotente)', !e, e?.message);
ok('06.3', 'versões 00 a 06 registradas uma única vez', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03,04,05,06,06.1');
const trg06 = await um("select count(*) filter (where tgname like '%\\_z\\_auditoria')::int l, count(*) filter (where tgname like '%\\_z\\_auditoria\\_truncate')::int t, count(distinct tgrelid)::int tabs from pg_trigger where tgname like '%\\_z\\_auditoria%'");
ok('06.4', 'auditoria ligada nas 16 tabelas de dados (linha + TRUNCATE)', trg06.l === 16 && trg06.t === 16 && trg06.tabs === 16, JSON.stringify(trg06));
const QUEBRAS = `select count(*)::int n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra`;
const ultima = async (extra = '', voltar = '') => { await db.exec('reset role'); const x = await um(`select tabela, acao, chave::text chave, autor_uid::text uid, autor_perfil_id perfil, papel, campos_alterados, manutencao_motivo motivo, transacao::text tx, antes, depois from public.auditoria ${extra} order by seq desc limit 1`); if (voltar) await db.exec(voltar); return x; };

for (const [i, prep, quem] of [[5, comoUsuario(U(1)), 'portal (Administradora logada)'], [6, 'set local role anon;', 'anônimo']]) {
  await tx(async () => { const ex = await erro(() => db.exec(prep + ' select * from public.auditoria'));
    ok(`06.${i}`, `${quem} não lê a auditoria (só o script 07 libera, e só ao Administrador)`, ex && /permission denied/i.test(ex.message), ex?.message); });
}
await tx(async () => { await db.exec(comoUsuario(U(1)));
  const ex = await erro(() => db.exec("insert into public.auditoria (seq, tabela, acao, hash) values (1, 'monitorias', 'INSERT', 'forjado')"));
  ok('06.7', 'portal não consegue forjar registro de auditoria', ex && /permission denied/i.test(ex.message), ex?.message); });

// ---- operações pelo portal geram auditoria com o autor real ------------------
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1)));
  await db.exec("insert into public.monitorias (id, protocolo, monitor_id, colaborador_id, status, registrado_por) values ('MON-30001', 'MON-2026-0300', 'usr-9', 'usr-4', 'Rascunho', 'usr-9')");
  const a = await ultima('', comoUsuario(U(1)));
  ok('06.8', 'inclusão pelo portal: auditoria com o login, o perfil, o papel e o registro como FICOU gravado (quem registrou carimbado)',
     a.tabela === 'monitorias' && a.acao === 'INSERT' && a.chave === '{"id": "MON-30001"}' && a.uid === U(1) && a.perfil === 'usr-1' && a.papel === 'authenticated'
     && a.antes === null && a.depois.registrado_por === 'usr-1' && a.depois.versao === 1, JSON.stringify(a).slice(0, 300));
  await db.exec("update public.monitorias set conclusao = 'Bom atendimento.', versao_lida = 1 where id = 'MON-30001'");
  const b = await ultima('', comoUsuario(U(1)));
  ok('06.9', 'alteração pelo portal: estado anterior e posterior completos e os campos alterados',
     b.acao === 'UPDATE' && b.antes.conclusao === null && b.depois.conclusao === 'Bom atendimento.' && b.antes.versao === 1 && b.depois.versao === 2
     && b.campos_alterados.includes('conclusao') && b.campos_alterados.includes('versao') && !b.campos_alterados.includes('protocolo'), JSON.stringify(b.campos_alterados));
  await db.exec("insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, ordem) values ('MON-30001', 'crit-26', '0', 0)");
  await db.exec('reset role');
  const r = await um("select count(distinct transacao)::int n, count(*)::int q from public.auditoria where (tabela = 'monitorias' and chave->>'id' = 'MON-30001') or (tabela = 'monitoria_respostas' and chave->>'monitoria_id' = 'MON-30001')");
  ok('06.10', 'monitoria e respostas salvas juntas ficam na mesma transação da auditoria', r.n === 1 && r.q === 3, JSON.stringify(r));
  ok('06.11', 'resposta 0 do eliminatório auditada como número 0 (não vazio)', (await ultima()).depois.resposta === 0);
  ok('06.12', 'cadeia íntegra depois das gravações do portal', (await um(QUEBRAS)).n === 0);
});
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(2)));
  await db.exec("update public.documentos set ativo = false, versao_lida = 1 where colecao = 'metas_colaborador' and id = 'cgoal-1727900000000'");
  const a = await ultima();
  ok('06.13', 'remoção lógica pelo Supervisor auditada (quem retirou, antes ativo, depois inativo)', a.perfil === 'usr-9' && a.antes.ativo === true && a.depois.ativo === false, JSON.stringify(a).slice(0, 200)); });

// ---- SQL Editor, manutenção e login ------------------------------------------
await tx(async () => {
  await db.exec("update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '0') where chave = 'settings'");
  const a = await ultima();
  ok('06.14', 'alteração pelo SQL Editor: papel postgres, sem login e sem perfil — também auditada', a.papel === 'postgres' && a.uid === null && a.perfil === null && a.tabela === 'configuracoes', JSON.stringify(a).slice(0, 200)); });
await tx(async () => {
  await db.exec("set local app.manutencao = 'restauracao'; set local app.manutencao_motivo = 'Teste de restauração da homologação, 12/10/2026'");
  await db.exec("delete from public.documentos where colecao = 'agenda' and id = 'ag-dup'");
  const a = await ultima();
  ok('06.15', 'exclusão autorizada auditada com o registro completo e o MOTIVO', a.acao === 'DELETE' && a.antes.conteudo.titulo === 'A' && a.depois === null && a.motivo === 'Teste de restauração da homologação, 12/10/2026', JSON.stringify(a).slice(0, 250));
  await db.exec('truncate public.catalogos');
  const b = await ultima();
  ok('06.16', 'TRUNCATE autorizado auditado com o motivo', b.tabela === 'catalogos' && b.acao === 'TRUNCATE' && b.motivo !== null, JSON.stringify(b).slice(0, 200));
  ok('06.17', 'cadeia íntegra depois da manutenção', (await um(QUEBRAS)).n === 0); });
await tx(async () => {
  await db.exec(`insert into auth.users values ('${U(6)}', 'Colab.A@Exemplo.test', now())`);
  const a = await ultima("where tabela = 'perfis'");
  ok('06.18', 'vínculo automático do login auditado no perfil (auth_user_id ligado, versão sobe)', a && a.acao === 'UPDATE' && a.chave === '{"id": "usr-4"}' && a.campos_alterados.includes('auth_user_id') && a.depois.auth_user_id === U(6), JSON.stringify(a).slice(0, 250)); });

// ---- integridade: ninguém altera nem apaga; adulteração é detectada ----------
await tx(async () => { await db.exec(abrir04 + comoUsuario(U(1))); await db.exec("insert into public.monitorias (id) values ('MON-30002')"); });
// grava alguns registros fora de transação de teste para os testes de adulteração
for (const v of ['1', '2', '3', '1']) await db.exec(`update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '${v}') where chave = 'settings'`);
await db.exec("update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '1', true), versao_lida = null where chave = 'brand'");
const totalAud = (await um('select count(*)::int n from public.auditoria')).n;
for (const [id, desc, prep, q, cod] of [
  ['06.19', 'portal não altera a auditoria', comoUsuario(U(1)), "update public.auditoria set papel = 'x'", 'perm'],
  ['06.20', 'portal não apaga a auditoria', comoUsuario(U(1)), 'delete from public.auditoria', 'perm'],
  ['06.21', 'SQL Editor não altera a auditoria sem manutenção (MI403)', '', "update public.auditoria set papel = 'x'", 'MI403'],
  ['06.22', 'SQL Editor não apaga a auditoria sem manutenção (MI403)', '', 'delete from public.auditoria', 'MI403'],
  ['06.23', 'SQL Editor não esvazia a auditoria sem manutenção (MI403)', '', 'truncate public.auditoria', 'MI403'],
]) {
  await tx(async () => { if (prep) await db.exec(prep); const ex = await erro(() => db.exec(q));
    ok(id, desc, cod === 'perm' ? ex && /permission denied/i.test(ex.message) : ex?.code === cod, ex?.message); });
}
await tx(async () => {
  await db.exec("set local app.manutencao = 'manutencao'; set local app.manutencao_motivo = 'Simulação de adulteração'");
  await db.exec(`update public.auditoria set depois = jsonb_set(depois, '{valor}', '"adulterado"') where seq = (select min(seq) from public.auditoria where tabela = 'configuracoes')`);
  const n = (await um(QUEBRAS)).n;
  ok('06.24', 'adulterar um registro antigo (mesmo com manutenção) quebra a cadeia e é detectado', n >= 1, String(n)); });
await tx(async () => {
  await db.exec("set local app.manutencao = 'manutencao'; set local app.manutencao_motivo = 'Simulação de apagamento'");
  const apagados = (await db.query('delete from public.auditoria where seq = (select seq from public.auditoria order by seq offset 1 limit 1)')).affectedRows;
  const n = (await um(QUEBRAS)).n;
  ok('06.25', 'apagar um registro do meio da trilha quebra a cadeia e é detectado', apagados === 1 && n >= 1, `apagados=${apagados} quebras=${n}`); });
// âncora: o último registro anotado fora do banco detecta a remoção do FINAL da trilha
const ancora = await um('select seq::text seq, hash from public.auditoria order by seq desc limit 1');
await tx(async () => {
  await db.exec("set local app.manutencao = 'manutencao'; set local app.manutencao_motivo = 'Simulação de apagar o final'");
  await db.exec('delete from public.auditoria where seq = (select max(seq) from public.auditoria)');
  const n = (await um(QUEBRAS)).n;
  const ancoraPresente = (await db.query('select count(*)::int c from public.auditoria where seq = $1::bigint and hash = $2', [ancora.seq, ancora.hash])).rows[0].c;
  ok('06.25b', 'apagar o ÚLTIMO registro não quebra a cadeia, mas a âncora anotada na conferência detecta', n === 0 && ancoraPresente === 0, `quebras=${n} ancora=${ancoraPresente}`); });
ok('06.26', 'fora das simulações a cadeia continua íntegra', (await um(QUEBRAS)).n === 0 && totalAud > 0);
let fn06 = 0;
for (const f of ["app.auditoria_hash(null::public.auditoria)", 'app.tg_auditoria()', 'app.tg_auditoria_cadeia()']) await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.exec(`select ${f}`)); if (ex && /permission denied/i.test(ex.message)) fn06++; });
ok('06.27', 'portal não executa as 3 funções internas novas', fn06 === 3, String(fn06));

// ---- R5: identidade autenticada × responsável declarado ------------------------
await tx(async () => { await db.exec("set local app.responsavel = ''");
  const ex = await erro(() => db.exec("update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '2') where chave = 'settings'"));
  ok('06.30', 'R5: operação direta no banco SEM responsável declarado é recusada (MI401)', ex?.code === 'MI401', ex?.message); });
await tx(async () => { await db.exec("set local app.responsavel = 'usr-9'");
  const ex = await erro(() => db.exec("update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '2') where chave = 'settings'"));
  ok('06.31', 'R5: declarar alguém que não é administrador ativo é recusado (MI401)', ex?.code === 'MI401', ex?.message); });
await tx(async () => {
  await db.exec("update public.configuracoes set valor = jsonb_set(valor, '{defasagemCompetencia}', '2') where chave = 'settings'");
  const a = await ultima();
  const b = await um("select sessao_usuario s, responsavel_declarado d from public.auditoria order by seq desc limit 1");
  ok('06.32', 'R5: a auditoria separa o autenticado (sessão postgres, sem login) do declarado (usr-1)', a.uid === null && b.s === 'postgres' && b.d === 'usr-1', JSON.stringify(b)); });
await tx(async () => { await db.exec(abrir05 + comoUsuario(U(2)));
  await db.exec("update public.documentos set conteudo = jsonb_set(conteudo, '{targetQty}', '7'), versao_lida = versao where colecao = 'metas_colaborador' and id = 'cgoal-1727900000000'");
  await db.exec('reset role');
  const b = await um("select autor_perfil_id p, responsavel_declarado d from public.auditoria order by seq desc limit 1");
  ok('06.33', 'R5: no portal vale a identidade autenticada; declaração ignorada (não dá para "assinar" como outro)', b.p === 'usr-9' && b.d === null, JSON.stringify(b)); });
// 06.34 (vínculo pelo serviço de login, sem declaração) roda em banco isolado: testes-r5.mjs
ok('06.35', 'R5: cadeia íntegra com os campos novos na impressão digital', (await um(QUEBRAS)).n === 0);

// rodar tudo de novo depois do 06 não muda nada
e = await erro(async () => { for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql']) await db.exec(sql(f)); });
const depois06 = (await um('select count(*)::int n from public.auditoria')).n;
ok('06.28', '00 a 06 rodam de novo sem erro, sem gerar auditoria falsa e sem mudar os dados',
   !e && depois06 === totalAud && (await um(QUEBRAS)).n === 0 && (await digital(await reconstruirMonitorias())) === dOrig, e?.message || `${totalAud} → ${depois06}`);
await tx(async () => { await db.exec(comoUsuario(U(1))); const ex = await erro(() => db.query('select app.meus_perfis()'));
  ok('06.29', 'depois disso, o portal continua executando as funções de perfil', !ex, ex?.message); });

// =============================================================================
// 07_seguranca.sql — RLS com identidades diferentes
// =============================================================================
const T07 = ['perfis', 'areas', 'area_monitores', 'colaboradores', 'alocacoes', 'alocacoes_historico', 'criterios', 'criterio_subperguntas',
  'regua_versoes', 'monitorias', 'monitoria_respostas', 'monitoria_evidencias', 'documentos', 'catalogos', 'configuracoes', 'acessos_log', 'auditoria'];
// ---- implantação simulada (como a migração fará, no SQL Editor) -------------
// 1. conta administrativa separada, criada com a declaração da administradora atual;
// 2. a declaração passa a ser a nova conta; 3. usr-1 vira só MONITOR, com rastro.
await db.exec(`insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm.monitora.a@exemplo.test', 'Monitora Sintética A (Administração)', '{ADMIN}', 'ACTIVE')`);
await db.exec(`insert into auth.users values ('${U(5)}', 'adm.monitora.a@exemplo.test', now())`);
await db.exec("set app.responsavel = 'adm-1'");
await db.exec(`update public.perfis set perfis = '{MONITOR}', extras = extras || '{"_perfis_original":["ADMIN","MONITOR"]}' where id = 'usr-1'`);
e = await erro(() => db.exec(sql('07_seguranca.sql')));
ok('07.1', '07 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('07_seguranca.sql')));
ok('07.2', '07 roda de novo sem erro (idempotente)', !e, e?.message);
ok('07.3', 'versões 00 a 07 registradas uma única vez', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03,04,05,06,06.1,07');

// ---- elenco: Aline (ADMIN+MONITOR, U1), Erivan (GESTOR, U2), sem perfil (U4),
//      Monitora 2 (U7), Supervisor 2 de outra área (U8), Monitora inativa (U9)
await db.exec(`
  insert into public.perfis (id, email, nome, perfis, status) values
    ('usr-20', 'monitora2@exemplo.test', 'Monitora Dois', '{MONITOR}', 'ACTIVE'),
    ('usr-21', 'gestor2@exemplo.test', 'Supervisor Dois', '{GESTOR}', 'ACTIVE'),
    ('usr-22', 'inativa@exemplo.test', 'Monitora Inativa', '{MONITOR}', 'INACTIVE');
  insert into auth.users values ('${U(7)}', 'monitora2@exemplo.test', now()), ('${U(8)}', 'gestor2@exemplo.test', now()), ('${U(9)}', 'inativa@exemplo.test', now());
  insert into public.areas (id, nome, gestor_id, ativo) values ('area-3', 'Cobrança', 'usr-21', true);
  insert into public.area_monitores (area_id, monitor_id, ordem) values ('area-3', 'usr-20', 0), ('area-3', 'usr-22', 1);
  insert into public.monitorias (id, protocolo, monitor_id, colaborador_id, status, nota, competencia) values ('MON-40001', 'MON-2026-0400', 'usr-20', 'usr-4', 'Pendente', 90, '2026-08');
  insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, ordem) values ('MON-40001', 'crit-06', '2', 0);
  insert into public.monitorias (id, monitor_id, status) values ('MON-40002', 'usr-22', 'Rascunho');`);
const vinc = await um("select count(*)::int n from public.perfis where id in ('usr-20','usr-21','usr-22') and auth_user_id is not null");
ok('07.4', 'elenco de teste montado (3 perfis novos ligados ao login)', vinc.n === 3);
const TOTAL_MON = (await um('select count(*)::int n from public.monitorias')).n;
const MON_ALINE = (await um("select count(*)::int n from public.monitorias where monitor_id = 'usr-1' or registrado_por = 'usr-1'")).n;
const comoAdmin = (uid, aal) => `set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`;
const ADM = comoAdmin(U(5), 'aal2'), ADM_SEM_MFA = comoAdmin(U(5), 'aal1');
const ALINE = comoUsuario(U(1)), ERIVAN = comoUsuario(U(2)), SEMPERFIL = comoUsuario(U(4)), MON2 = comoUsuario(U(7)), GES2 = comoUsuario(U(8)), INATIVA = comoUsuario(U(9));
const contar = async (quem, t, where = '') => { let r; await tx(async () => { await db.exec(quem); r = await erro(async () => { r = (await um(`select count(*)::int n from public.${t} ${where}`)).n; throw { n: r }; }); }); return r?.n ?? r; };
const tenta = async (quem, q) => { let res; await tx(async () => { await db.exec(quem); res = await erro(async () => { const x = await db.query(q); throw { ok: true, linhas: x.affectedRows ?? 0 }; }); }); return res; };
const negado = (r) => r && /permission denied/i.test(r.message || '');
const rls = (r) => r && /row-level security/i.test(r.message || '');

// ---- anônimo -----------------------------------------------------------------
let anonNeg = 0; const anonDet = [];
for (const t of T07) { const r = await contar('set local role anon;', t); if (negado(r)) anonNeg++; else anonDet.push(t); }
ok('07.5', 'SEM LOGIN: nenhuma das 17 tabelas pode ser lida (permission denied em todas)', anonNeg === 17, anonDet.join(','));
let anonEsc = 0;
for (const q of ["insert into public.monitorias (id) values ('X')", "insert into public.acessos_log (id) values ('x')", "update public.configuracoes set valor = '{}'", "delete from public.perfis", "insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 99, 'X')"]) if (negado(await tenta('set local role anon;', q))) anonEsc++;
ok('07.6', 'SEM LOGIN: nenhuma gravação (inclusão, alteração, exclusão) é aceita', anonEsc === 5, String(anonEsc));
ok('07.7', 'SEM LOGIN: nenhuma função interna (schema app) pode ser chamada', negado(await tenta('set local role anon;', 'select app.meus_perfis()')));

// ---- logado sem perfil e inativo: zero registros --------------------------------
for (const [id, quem, nome] of [['07.8', SEMPERFIL, 'logado SEM perfil'], ['07.9', INATIVA, 'perfil INATIVO']]) {
  const vistos = []; for (const t of T07) { const n = await contar(quem, t); if (n !== 0) vistos.push(`${t}=${typeof n === 'number' ? n : n?.message}`); }
  ok(id, `${nome}: zero registros em todas as 17 tabelas`, vistos.length === 0, vistos.join(', '));
}
let semEsc = 0;
for (const q of ["insert into public.acessos_log (id) values ('x')", "insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 99, 'X')", "update public.configuracoes set valor = '{}', versao_lida = 1"]) {
  const r = await tenta(SEMPERFIL, q); if (rls(r) || (r?.ok && r.linhas === 0)) semEsc++; }
ok('07.10', 'logado sem perfil não grava nada (nem log, nem categoria, nem configuração)', semEsc === 3, String(semEsc));

// ---- ADMIN ------------------------------------------------------------------
ok('07.11', `ADMIN lê todas as monitorias (${TOTAL_MON}) e todas as respostas`, (await contar(ADM, 'monitorias')) === TOTAL_MON
   && (await contar(ADM, 'monitoria_respostas')) === (await um('select count(*)::int n from public.monitoria_respostas')).n);
ok('07.12', 'ADMIN lê a auditoria e o histórico de acessos', (await contar(ADM, 'auditoria')) > 0 && (await contar(ADM, 'acessos_log')) > 0);
let r07 = await tenta(ADM, "update public.configuracoes set valor = jsonb_set(valor, '{requireGestorValidation}', 'false'), versao_lida = versao where chave = 'settings'");
ok('07.13', 'ADMIN altera configuração (com a versão lida)', r07?.ok && r07.linhas === 1, r07?.message);
r07 = await tenta(ADM, "insert into public.colaboradores (id, nome, area_id, ativo) values ('ag-novo', 'Nova Colaboradora', 'area-1', true)");
ok('07.14', 'ADMIN cadastra colaborador', r07?.ok, r07?.message);
let admMon = 0;
for (const q of ["insert into public.monitorias (id) values ('MON-ADM')", "update public.monitorias set nota = 100, versao_lida = versao where id = 'MON-10005'",
                 "update public.monitoria_respostas set resposta = '2', versao_lida = versao where monitoria_id = 'MON-10006'", "insert into public.monitoria_evidencias (monitoria_id, lista, ordem, conteudo) values ('MON-10005', 'links', 9, '\"x\"')"])
  if (negado(await tenta(ADM, q))) admMon++;
ok('07.15', 'ADMIN não grava monitorias, respostas nem evidências diretamente (só pelas funções do 08)', admMon === 4, String(admMon));
let admDel = 0; const admDelDet = [];
for (const t of T07) { const r = await tenta(ADM, `delete from public.${t}`); if (negado(r)) admDel++; else admDelDet.push(t); }
ok('07.16', 'ADMIN não exclui nada: DELETE negado nas 17 tabelas', admDel === 17, admDelDet.join(','));
let admAud = 0;
for (const q of ["insert into public.auditoria (seq, tabela, acao, hash) values (1, 'x', 'INSERT', 'x')", "update public.auditoria set papel = 'x'", 'delete from public.auditoria', 'truncate public.auditoria'])
  if (negado(await tenta(ADM, q))) admAud++;
ok('07.17', 'nem o ADMIN inclui, altera, exclui ou esvazia a auditoria', admAud === 4, String(admAud));

// ---- GESTOR (Erivan, supervisor da área 1, onde a monitora é a Aline) ---------
const vistasErivan = await contar(ERIVAN, 'monitorias');
ok('07.18', `GESTOR lê as monitorias da sua equipe (${MON_ALINE}) e NÃO as da outra área`, vistasErivan === MON_ALINE && (await contar(ERIVAN, 'monitorias', "where id = 'MON-40001'")) === 0, String(vistasErivan));
ok('07.19', 'GESTOR não vê respostas de monitoria fora da equipe; vê as da equipe',
   (await contar(ERIVAN, 'monitoria_respostas', "where monitoria_id = 'MON-40001'")) === 0 && (await contar(ERIVAN, 'monitoria_respostas', "where monitoria_id = 'MON-10005'")) > 0);
ok('07.20', 'GESTOR não lê auditoria nem histórico de acessos', (await contar(ERIVAN, 'auditoria')) === 0 && (await contar(ERIVAN, 'acessos_log')) === 0);
let gesMon = 0;
for (const q of ["update public.monitorias set nota = 100, versao_lida = versao where id = 'MON-10005'", "update public.monitorias set status = 'Validada', versao_lida = versao where id = 'MON-10004'",
                 "update public.monitoria_respostas set resposta = '0', versao_lida = versao where monitoria_id = 'MON-10005' and criterio_id = 'crit-06'", "insert into public.monitorias (id, monitor_id) values ('MON-G', 'usr-1')"])
  if (negado(await tenta(ERIVAN, q))) gesMon++;
ok('07.21', 'GESTOR NÃO edita avaliação: nota, situação, respostas e inclusão de monitoria negadas', gesMon === 4, String(gesMon));
await tx(async () => { await db.exec(ERIVAN);
  const ex = await erro(async () => {
    await db.exec("insert into public.alocacoes (id, monitor_id, colaborador_id, data_inicio, ativo) values ('alloc-g1', 'usr-1', 'usr-4', '2026-10-12', true)");
    await db.exec("insert into public.alocacoes_historico (id, alocacao_id, acao, alterado_por, alterado_em, detalhes) values ('log-g1', 'alloc-g1', 'INSERT', 'usr-9', now(), 'Colaboradora A para a Monitora A')");
    await db.exec("update public.documentos set conteudo = jsonb_set(conteudo, '{targetQty}', '5'), versao_lida = versao where colecao = 'metas_colaborador' and id = 'cgoal-1727900000000'"); });
  ok('07.22', 'GESTOR grava carteira, histórico da carteira e metas', !ex, ex?.message); });
r07 = await tenta(ERIVAN, "insert into public.alocacoes_historico (id, alocacao_id, acao, alterado_por, alterado_em) values ('log-g2', 'alloc-1', 'INSERT', 'usr-1', now())");
ok('07.23', 'GESTOR não registra evento de carteira em nome de outra pessoa', rls(r07), r07?.message);
let gesAdm = 0;
for (const q of [`update public.configuracoes set valor = '{}', versao_lida = versao`, "update public.perfis set perfis = '{GESTOR,ADMIN}', versao_lida = versao where id = 'usr-9'", "update public.criterios set peso = 9, versao_lida = versao"]) {
  const r = await tenta(ERIVAN, q); if (r?.ok && r.linhas === 0) gesAdm++; }
for (const q of ["insert into public.criterios (id, nome) values ('crit-g', 'X')", `insert into public.regua_versoes (id, rotulo, vigente_desde, retrato) values ('rg', 'RG', '2026-10-12', '[{"id":"x"}]')`, "insert into public.colaboradores (id, nome) values ('ag-g', 'X')"]) {
  if (rls(await tenta(ERIVAN, q))) gesAdm++; }
ok('07.24', 'GESTOR não altera configuração, régua, colaboradores nem se promove a ADMIN', gesAdm === 6, String(gesAdm));

// ---- MONITOR (Monitora 2, área 3) --------------------------------------------
ok('07.25', 'MONITOR lê só as próprias monitorias (1) — não vê as da Aline', (await contar(MON2, 'monitorias')) === 1 && (await contar(MON2, 'monitorias', "where monitor_id = 'usr-1'")) === 0);
ok('07.26', 'MONITOR lê só as respostas das próprias monitorias', (await contar(MON2, 'monitoria_respostas')) === 1);
ok('07.27', 'MONITOR lê a régua e as configurações (necessárias ao formulário)', (await contar(MON2, 'criterios')) === semente.length && (await contar(MON2, 'configuracoes')) === 2);
r07 = await tenta(MON2, "insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 50, 'CATEGORIA DA MONITORA')");
const r07b = await tenta(MON2, "insert into public.catalogos (catalogo, ordem, valor) values ('empreendimentos', 50, 'X')");
ok('07.28', 'MONITOR cria categoria (como hoje), mas não empreendimento', r07?.ok && rls(r07b), (r07?.message || '') + (r07b?.message || ''));
let monEsc = 0;
for (const q of ["insert into public.alocacoes (id) values ('alloc-m')", "insert into public.documentos (colecao, id, conteudo, ordem) values ('metas_colaborador', 'cg-m', '{\"id\":\"cg-m\"}', 9)"]) if (rls(await tenta(MON2, q))) monEsc++;
for (const q of ["update public.configuracoes set valor = '{}', versao_lida = versao", "update public.alocacoes set ativo = false, versao_lida = versao"]) { const r = await tenta(MON2, q); if (r?.ok && r.linhas === 0) monEsc++; }
if (negado(await tenta(MON2, "update public.monitorias set nota = 100, versao_lida = versao where id = 'MON-40001'"))) monEsc++;
ok('07.29', 'MONITOR não grava carteiras, metas, configurações nem a própria nota diretamente', monEsc === 5, String(monEsc));
ok('07.30', 'MONITOR não lê auditoria nem histórico de acessos', (await contar(MON2, 'auditoria')) === 0 && (await contar(MON2, 'acessos_log')) === 0);
await tx(async () => { await db.exec(MON2); await db.exec("insert into public.acessos_log (id, tipo_evento, usuario_email) values ('m1', 'LOGIN', 'outra@x.com')");
  await db.exec('reset role'); const r = await um("select perfil_id from public.acessos_log where id = 'm1'");
  ok('07.31', 'MONITOR registra o próprio acesso, com o perfil carimbado pelo banco', r.perfil_id === 'usr-20', JSON.stringify(r)); });

// ---- isolamento entre equipes e efeito das mudanças de cadastro -----------------
ok('07.32', 'Supervisor 2 vê só a equipe dele (as 2 monitorias das 2 monitoras da área 3, inclusive a inativa), nada da equipe do Erivan', (await contar(GES2, 'monitorias')) === 2 && (await contar(GES2, 'monitorias', "where monitor_id = 'usr-1'")) === 0);
await tx(async () => { await db.exec("update public.area_monitores set ativo = false where area_id = 'area-3' and monitor_id = 'usr-20'"); await db.exec(GES2);
  ok('07.33', 'monitor retirado da área: o supervisor deixa de ver as monitorias DELE (e continua vendo as da outra monitora)', (await um("select string_agg(id, ',') l from public.monitorias")).l === 'MON-40002'); });
await tx(async () => { await db.exec("update public.areas set ativo = false where id = 'area-3'"); await db.exec(GES2);
  ok('07.34', 'área desativada: o supervisor deixa de ver a equipe', (await um('select count(*)::int n from public.monitorias')).n === 0); });
await tx(async () => { await db.exec("update public.perfis set status = 'INACTIVE' where id = 'usr-20'"); await db.exec(MON2);
  ok('07.35', 'perfil inativado pelo ADMIN: a pessoa perde o acesso na hora (zero registros)', (await um('select count(*)::int n from public.criterios')).n === 0); });

// ---- Data API: só public exposto; app privado; nada de exclusão ----------------
ok('07.36', 'nenhuma função no schema public (nada exposto como RPC pela Data API)', (await um("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace")).n === 0);
const fnPortal = await um("select string_agg(proname, ',' order by proname) l from pg_proc p where pronamespace = 'app'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')");
ok('07.37', 'no schema app, o portal só executa as 7 funções usadas pelas regras (nenhuma grava)', fnPortal.l === 'equipe_do_gestor,meu_perfil_id,meus_perfis,sou_admin,tem_perfil,usuario_ativo,usuario_liberado', fnPortal.l);
const priv = await um(`select count(*)::int n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  and (has_table_privilege('authenticated', c.oid, 'delete') or has_table_privilege('authenticated', c.oid, 'truncate')
       or has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update'))`);
ok('07.38', 'nenhuma tabela dá DELETE/TRUNCATE ao portal nem qualquer acesso ao anônimo', priv.n === 0, String(priv.n));
const semPol = await um("select count(*)::int n from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and (not c.relrowsecurity or not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.cmd = 'SELECT'))");
ok('07.39', 'as 17 tabelas têm RLS ligada e política de leitura', semPol.n === 0, String(semPol.n));
await tx(async () => { await db.exec(ADM); await db.exec("insert into public.colaboradores (id, nome, ativo) values ('ag-aud', 'Auditada', true)");
  const a = await um("select autor_perfil_id p, papel from public.auditoria where tabela = 'colaboradores' and chave->>'id' = 'ag-aud'");
  ok('07.40', 'gravação do portal pela RLS continua auditada (e o ADMIN lê a própria auditoria)', a?.p === 'adm-1' && a?.papel === 'authenticated', JSON.stringify(a)); });

// ---- rodar tudo de novo -----------------------------------------------------
const polAntes = (await um("select count(*)::int n from pg_policies where schemaname = 'public'")).n;
e = await erro(async () => { for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql']) await db.exec(sql(f)); });
const polDepois = (await um("select count(*)::int n from pg_policies where schemaname = 'public'")).n;
ok('07.41', '00 a 07 rodam de novo sem erro: mesmas regras, dados intactos, cadeia íntegra',
   !e && polAntes === polDepois && (await um(QUEBRAS)).n === 0 && (await contar(ERIVAN, 'monitorias')) === MON_ALINE, e?.message || `${polAntes}→${polDepois}`);
await db.exec(sql('03_regua.sql'));
const fechado = await contar(ADM, 'criterios');
await db.exec(sql('07_seguranca.sql'));
const reaberto = await contar(ADM, 'criterios');
ok('07.42', 'rodar um script anterior DEPOIS do 07 fecha o acesso do portal àquelas tabelas (falha segura); rodar o 07 de novo restaura', negado(fechado) && reaberto === semente.length, );

// ---- contas separadas: R1 (ADMIN exclusivo), R2 (nada de ADMIN pelo portal), R4 (MFA)
let r1 = 0;
await tx(async () => { const ex = await erro(() => db.exec("insert into public.perfis (id, email, nome, perfis) values ('x-1', 'x1@exemplo.test', 'X', '{ADMIN,MONITOR}')")); if (ex && /perfis_admin_exclusivo/.test(ex.message)) r1++; });
await tx(async () => { const ex = await erro(() => db.exec("update public.perfis set perfis = '{ADMIN,GESTOR}' where id = 'adm-1'")); if (ex && /perfis_admin_exclusivo/.test(ex.message)) r1++; });
ok('07.43', 'R1: ADMIN não acumula perfil operacional — recusado até pelo SQL Editor', r1 === 2, String(r1));
const al = await um("select perfis, extras->'_perfis_original' orig from public.perfis where id = 'usr-1'");
ok('07.44', 'R1: a Aline (usr-1) é só MONITOR, com o perfil original guardado para rastreabilidade', JSON.stringify(al.perfis) === '["MONITOR"]' && JSON.stringify(al.orig) === '["ADMIN","MONITOR"]', JSON.stringify(al));
ok('07.45', 'login profissional da Aline (MONITOR): só as monitorias dela, sem auditoria, sem administração',
   (await contar(ALINE, 'monitorias')) === MON_ALINE && (await contar(ALINE, 'auditoria')) === 0 && (await contar(ALINE, 'acessos_log')) === 0
   && (await tenta(ALINE, "update public.configuracoes set valor = '{}', versao_lida = versao"))?.linhas === 0);

// R4: conta administrativa sem segundo fator = nenhum acesso
const vistosSemMfa = []; for (const t of T07) { const n = await contar(ADM_SEM_MFA, t); if (n !== 0) vistosSemMfa.push(`${t}=${typeof n === 'number' ? n : n?.message}`); }
const gravaSemMfa = [await tenta(ADM_SEM_MFA, "update public.configuracoes set valor = '{}', versao_lida = versao"), await tenta(ADM_SEM_MFA, "insert into public.colaboradores (id, nome) values ('ag-mfa', 'X')")];
ok('07.46', 'R4: conta ADMIN SEM MFA (aal1) vê zero registros nas 17 tabelas e não grava nada',
   vistosSemMfa.length === 0 && gravaSemMfa[0]?.linhas === 0 && rls(gravaSemMfa[1]), vistosSemMfa.join(',') + (gravaSemMfa[1]?.message || ''));
ok('07.47', 'R4: a mesma conta COM MFA (aal2) tem o acesso administrativo', (await contar(ADM, 'monitorias')) === TOTAL_MON && (await contar(ADM, 'auditoria')) > 0);

// R2: mesmo com MFA, o portal não mexe em acesso administrativo nem em vínculo de login
let r2 = 0; const r2det = [];
for (const [nome, q] of [
  ['criar ADMIN', "insert into public.perfis (id, email, nome, perfis) values ('adm-x', 'admx@exemplo.test', 'X', '{ADMIN}')"],
  ['promover Erivan', "update public.perfis set perfis = '{ADMIN}', versao_lida = versao where id = 'usr-9'"],
  ['inativar a conta ADMIN', "update public.perfis set status = 'INACTIVE', versao_lida = versao where id = 'adm-1'"],
  ['trocar e-mail da conta ADMIN', "update public.perfis set email = 'outro@exemplo.test', versao_lida = versao where id = 'adm-1'"],
  ['religar o login do Erivan', `update public.perfis set auth_user_id = '${U(4)}', versao_lida = versao where id = 'usr-9'`],
  ['criar perfil já ligado a um login', `insert into public.perfis (id, email, nome, perfis, auth_user_id) values ('x-2', 'x2@exemplo.test', 'X', '{MONITOR}', '${U(4)}')`],
]) { const r = await tenta(ADM, q); if (r?.code === 'MI403') r2++; else r2det.push(`${nome}: ${r?.message || JSON.stringify(r)}`); }
ok('07.48', 'R2: pelo portal, nem a conta ADMIN cria/promove/retira/altera ADMIN nem religa login (6 tentativas, MI403)', r2 === 6, r2det.join(' | '));
await tx(async () => { await db.exec(ADM);
  const ex = await erro(async () => {
    await db.exec("insert into public.perfis (id, email, nome, perfis) values ('usr-30', 'nova.monitora@exemplo.test', 'Nova Monitora', '{MONITOR}')");
    await db.exec("update public.perfis set status = 'INACTIVE', versao_lida = versao where id = 'usr-22'"); });
  ok('07.49', 'a conta ADMIN continua administrando os perfis operacionais (cadastrar monitora, inativar pessoa)', !ex, ex?.message); });

// transferência da administração, no SQL Editor, com responsável declarado
await tx(async () => {
  await db.exec("insert into public.perfis (id, email, nome, perfis, status) values ('adm-2', 'adm.nova@exemplo.test', 'Nova Administradora', '{ADMIN}', 'ACTIVE')");
  await db.exec("set local app.responsavel = 'adm-2'");
  await db.exec("update public.perfis set status = 'INACTIVE' where id = 'adm-1'");
  await db.exec('reset role');
  const a = await um("select responsavel_declarado d, sessao_usuario s from public.auditoria where tabela = 'perfis' and chave->>'id' = 'adm-1' order by seq desc limit 1");
  const ainda = (await um("select count(*)::int n from public.perfis where id = 'adm-1'")).n;
  const adm1Agora = await (async () => { await db.exec(ADM); const n = (await um('select count(*)::int n from public.monitorias')).n; await db.exec('reset role'); return n; })();
  ok('07.50', 'transferência: nova conta ADMIN entra, a antiga é inativada (sem apagar), a auditoria registra quem declarou, e a antiga perde o acesso',
     a.d === 'adm-2' && a.s === 'postgres' && ainda === 1 && adm1Agora === 0, JSON.stringify({ a, ainda, adm1Agora })); });
await tx(async () => { const ex = await erro(() => db.exec("update public.perfis set status = 'INACTIVE' where id = 'adm-1'"));
  ok('07.51', 'o sistema nunca fica sem administrador ativo (inativar a única conta ADMIN é recusado)', ex?.code === 'MI403', ex?.message); });
await tx(async () => { await db.exec("set local app.responsavel = 'usr-1'");
  const ex = await erro(() => db.exec("update public.configuracoes set valor = valor where chave = 'brand'"));
  ok('07.52', 'R5 depois da separação: a Aline operacional (usr-1) não pode mais ser declarada responsável no SQL Editor', ex?.code === 'MI401', ex?.message); });

// requisito 8: Erivan supervisor da equipe de Relacionamento
await tx(async () => { await db.exec(ERIVAN); const r = await um('select app.equipe_do_gestor() e');
  ok('07.53', 'Erivan (GESTOR) é o supervisor da área de Relacionamento e a equipe dele contém a Aline (usr-1)', JSON.stringify(r.e) === '["usr-1"]', JSON.stringify(r)); });

// =============================================================================
// 08_funcoes.sql — operações seguras, nota pelo banco, régua por versão
// =============================================================================
// ---- revisão: retrato de segurança e de dados antes do 08 ------------------------
const NOVAS_COLS = "array['nota_calculada','nota_historica','origem','enviado_em','motivo_reprovacao','eliminatorio_afastado_por','eliminatorio_afastado_em','eliminatorio_afastado_motivo','cancelado_por','cancelado_em','cancelado_motivo','ativo','enviada_na_origem']";
const retratoSeg = async () => {
  const pol = (await um(`select string_agg(format('%s.%s|%s|%s|%s|%s', tablename, policyname, cmd, array_to_string(roles, ','), coalesce(qual, ''), coalesce(with_check, '')), E'\\n' order by tablename, policyname) s from pg_policies where schemaname = 'public'`)).s;
  const rls = (await um(`select string_agg(relname || '=' || relrowsecurity || '/' || relforcerowsecurity, ',' order by relname) s from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`)).s;
  const tab = (await um(`select string_agg(table_name || '|' || grantee || '|' || privilege_type, ',' order by table_name, grantee, privilege_type) s from information_schema.role_table_grants where table_schema in ('public', 'app') and grantee in ('anon', 'authenticated', 'public')`)).s;
  const col = (await um(`select count(*)::int n from information_schema.column_privileges where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE') and not (table_name = 'regua_versoes' and privilege_type = 'INSERT')`)).n;
  const fns = Object.fromEntries((await db.query(`select p.oid::regprocedure::text f, has_function_privilege('authenticated', p.oid, 'execute') || '/' || has_function_privilege('anon', p.oid, 'execute') || '/' || p.prosecdef || '/' || md5(p.prosrc) v from pg_proc p where p.pronamespace in ('app'::regnamespace, 'public'::regnamespace)`)).rows.map((r) => [r.f, r.v]));
  const sch = (await um(`select string_agg(n.nspname || '=' || has_schema_privilege('anon', n.oid, 'usage') || '/' || has_schema_privilege('authenticated', n.oid, 'usage'), ',' order by n.nspname) s from pg_namespace n where n.nspname in ('public', 'app')`)).s;
  const trg = (await um(`select string_agg(tgrelid::regclass || '.' || tgname, ',' order by 1) s from pg_trigger where not tgisinternal and tgrelid::regclass::text <> 'regua_versoes' and tgname <> 'regua_versoes_a_vigencia'`)).s;
  const tabelas = (await db.query("select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1")).rows.map((r) => r.relname);
  const dados = {};
  for (const tb of tabelas) dados[tb] = (await um(`select count(*)::int || ':' || coalesce(md5(string_agg((to_jsonb(t) - ${NOVAS_COLS})::text, '|' order by (to_jsonb(t) - ${NOVAS_COLS})::text)), '-') s from public.${tb} t`)).s;
  return { pol, rls, tab, col, fns, sch, trg, dados };
};
const seg07 = await retratoSeg();
e = await erro(() => db.exec(sql('08_funcoes.sql')));
ok('08.1', '08 roda sem erro', !e, e?.message);
e = await erro(() => db.exec(sql('08_funcoes.sql')));
ok('08.2', '08 roda de novo sem erro (idempotente)', !e, e?.message);
// Datas relativas ao dia do banco: o teste vale em qualquer data de execução. A regra de vigência
// (08) compara com app.hoje(), então os testes usam o mesmo relógio.
const diaRel = async (n) => (await db.query(`select (app.hoje() + ${Number(n)})::text d`)).rows[0].d;
const HOJE = await diaRel(0), AMANHA = await diaRel(1), FUTURO = await diaRel(48), FUTURO2 = await diaRel(78);
{ const seg08 = await retratoSeg();
  const semRegua = (s) => ({ pol: s.pol.split('\n').filter((l) => !l.startsWith('regua_versoes.regua_versoes_incluir|')).join('\n'),
                             tab: s.tab.split(',').filter((x) => x !== 'regua_versoes|authenticated|INSERT').join(',') });
  const a7 = semRegua(seg07), a8 = semRegua(seg08);
  ok('08.2d', 'a ÚNICA mudança de regra feita pelo 08: o ADMIN perde a inclusão direta em regua_versoes (política regua_versoes_incluir e permissão INSERT saem); publicação só pela função',
     seg07.pol.includes('regua_versoes.regua_versoes_incluir|INSERT') && !seg08.pol.includes('regua_versoes_incluir')
       && seg07.tab.split(',').includes('regua_versoes|authenticated|INSERT') && !seg08.tab.split(',').includes('regua_versoes|authenticated|INSERT'),
     JSON.stringify({ antes: seg07.tab.split(',').filter((x) => x.startsWith('regua_versoes')), depois: seg08.tab.split(',').filter((x) => x.startsWith('regua_versoes')) }));
  const fnsMudaram = Object.keys(seg07.fns).filter((f) => seg07.fns[f] !== seg08.fns[f]);
  const dadosMudaram = Object.keys(seg07.dados).filter((tb) => seg07.dados[tb] !== seg08.dados[tb]);
  ok('08.2b', 'fora isso, o 08 NÃO altera as regras do 07: políticas RLS (texto integral), RLS ligada, permissões de tabela e de coluna, permissões e código das funções existentes, uso dos schemas public/app e gatilhos existentes ficam idênticos',
     a7.pol === a8.pol && seg07.rls === seg08.rls && a7.tab === a8.tab && seg07.col === seg08.col && fnsMudaram.length === 0 && seg07.sch === seg08.sch && seg07.trg === seg08.trg,
     JSON.stringify({ pol: a7.pol === a8.pol, rls: seg07.rls === seg08.rls, tab: a7.tab === a8.tab, col: [seg07.col, seg08.col], fnsMudaram, sch: seg07.sch === seg08.sch, trg: seg07.trg === seg08.trg }));
  ok('08.2c', `o 08 NÃO modifica dados: conteúdo de todas as ${Object.keys(seg07.dados).length} tabelas (inclusive a auditoria) idêntico, byte a byte, antes e depois`, dadosMudaram.length === 0, JSON.stringify(dadosMudaram));
}
ok('08.3', 'versões 00 a 08 registradas', (await um("select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03,04,05,06,06.1,07,08');

// Régua 1 oficial (o 09 publicará pelo SQL Editor, declarado); a 2.0 já existe (03).
await db.exec(`insert into public.regua_versoes (id, rotulo, vigente_desde, descricao, retrato)
  values ('regua-1', 'Régua 1', '2026-08-25', 'Régua 1 oficial (v0.25.0)', '${JSON.stringify(semente).replace(/'/g, "''")}'::jsonb)`);

const chamar = async (quem, q, params = []) => {
  await db.exec('begin; ' + quem);
  try { const r = await db.query(q, params); await db.exec('commit'); return r.rows[0] ? Object.values(r.rows[0])[0] : null; }
  catch (x) { await db.exec('rollback'); throw x; }
};
const tentaApi = async (quem, q, params = []) => { try { return { ok: await chamar(quem, q, params) }; } catch (x) { return { erro: x }; } };
const salvar = (quem, dados, versao = null, enviar = false) => tentaApi(quem, 'select api.salvar_monitoria($1::jsonb, $2, $3)', [JSON.stringify(dados), versao, enviar]);
const acao = (quem, fn, id, versao, motivo) => tentaApi(quem, motivo === undefined ? `select api.${fn}($1, $2)` : `select api.${fn}($1, $2, $3)`, motivo === undefined ? [id, versao] : [id, versao, motivo]);
const cod = (r) => r.erro?.code;
const monit = (id) => um(`select * from public.monitorias where id = '${id}'`);

// Monitoria completa e válida pela régua (Telefone), no formato que o portal envia.
const completa = (extra = {}, troca = {}) => {
  const aplic = semente.filter((c) => c.active && c.channels.includes('Telefone'));
  const scores = aplic.map((c) => {
    if (troca[c.id] !== undefined) return { criterionId: c.id, ...troca[c.id] };
    if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: c.id === 'crit-29' ? 'Não' : c.opcoes[0], lowScoreReason: '', subRespostas: null };
    if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
    return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
  });
  return { colaboradorId: 'usr-4', categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'AT-1', numeroTitulo: 'TIT-1', canal: 'Telefone',
    date: '2026-08-20T12:00:00Z', competencia: '2026-08', inicioAtendimento: '2026-08-20T10:00', fimAtendimento: '2026-08-20T10:12',
    duracaoMinutos: 12, tipo: 'Regular', scores, evidencias: [], links: [], ...extra };
};

// ---- casos-ouro: paridade portal × banco -----------------------------------------
const ouro = JSON.parse(readFileSync(process.argv[3].replace('criterios-semente.json', 'casos-ouro.json'), 'utf8'));
const entrada = ouro.casos.map((c, i) => ({ i, r: c.retrato, canal: c.canal, scores: Object.entries(c.respostas).map(([criterionId, v]) => ({ criterionId, score: v.score })) }));
const notasBanco = (await db.query(`select (c->>'i')::int i, app.calcular_nota(($2::jsonb) -> ((c->>'r')::int) -> 'criterios', c->>'canal', c->'scores')::text n
  from jsonb_array_elements($1::jsonb) c order by 1`, [JSON.stringify(entrada), JSON.stringify(ouro.retratos)])).rows;
let iguais = 0, maxDif = 0; const difs = [], idxDif = [];
notasBanco.forEach((row) => { const p = ouro.casos[row.i].notaPortal, b = Number(row.n), d = Math.round(Math.abs(p - b) * 100); if (d === 0) iguais++; else { difs.push(`${ouro.casos[row.i].nome}: portal ${p} × banco ${row.n}`); idxDif.push(row.i); } maxDif = Math.max(maxDif, d); });
// valor EXATO (sem arredondar) dos casos divergentes: precisa terminar em 5 na 3ª casa (empate de meio centésimo)
const exatos = idxDif.length === 0 ? [] : (await db.query(`select (c->>'i')::int i,
    (select (sum(r.v::numeric * a.w) / sum(2 * a.w) * 100)::text
       from (select x ->> 'id' id, coalesce((x ->> 'weight')::numeric, 0) w from jsonb_array_elements(($2::jsonb) -> ((c->>'r')::int) -> 'criterios') x
              where coalesce((x ->> 'active')::boolean, false) and coalesce(x -> 'channels', '[]'::jsonb) ? (c->>'canal')) a
       join (select s ->> 'criterionId' id, s -> 'score' v from jsonb_array_elements(c->'scores') s) r on r.id = a.id
      where a.w > 0 and jsonb_typeof(r.v) = 'number') exato
  from jsonb_array_elements($1::jsonb) c where (c->>'i')::int = any ($3::int[])`, [JSON.stringify(entrada), JSON.stringify(ouro.retratos), idxDif])).rows;
const todosEmpate = exatos.every((x) => /^\d+\.\d\d5(0*)$/.test(x.exato));
ok('08.4', `casos-ouro (${ouro.casos.length} distintos): ${iguais} idênticos; ${difs.length} diferem em exatamente 0,01 e TODOS são empates de meio centésimo (o banco arredonda o empate para cima; o portal, em ponto flutuante, às vezes para baixo)`,
   maxDif <= 1 && todosEmpate, JSON.stringify(exatos.slice(0, 3)));
ok('08.4b', 'casos-ouro: nenhuma diferença acima de 0,01 (dentro da tolerância de E1)', maxDif <= 1, String(maxDif));
console.log('EMPATES', JSON.stringify(exatos.map((x) => `${ouro.casos[x.i].nome}: exato ${x.exato}, portal ${ouro.casos[x.i].notaPortal}`)));
const backupNomeado = ouro.casos.find((c) => c.nome === 'tudo nota máxima → 100');
ok('08.4c', 'casos nomeados: tudo máximo = 100, tudo N/A = 0, tudo zero = 0, rascunho vazio = 0',
   backupNomeado.notaPortal === 100 && ['tudo N/A → 0', 'tudo zero → 0', 'tudo vazio (rascunho) → 0'].every((n) => ouro.casos.find((c) => c.nome === n).notaPortal === 0));

// ---- permissões básicas -----------------------------------------------------------
{ const par = notasBanco.map((row) => ({ p: ouro.casos[row.i].notaPortal, b: row.n }));
  const r = (await db.query("select count(*) filter (where abs((x -> 'p')::numeric - (x ->> 'b')::numeric) > 0.01)::int recusados, count(*)::int n from jsonb_array_elements($1::jsonb) x", [JSON.stringify(par)])).rows[0];
  ok('08.4d', `E1 com a regra do banco: nenhum dos ${r.n} casos-ouro (inclusive os 6 empates) seria recusado pela tolerância de 0,01`, r.recusados === 0 && r.n === ouro.casos.length, JSON.stringify(r)); }
ok('08.5', 'schema api: só o portal logado usa; anônimo não', (await um("select has_schema_privilege('authenticated','api','usage') a, has_schema_privilege('anon','api','usage') n")).a === true
   && (await um("select has_schema_privilege('anon','api','usage') n")).n === false);
let anon08 = 0;
for (const q of ['select api.fila_validacao()', `select api.salvar_monitoria('{}'::jsonb)`, `select api.validar_monitoria('x', 1)`]) { const r = await tentaApi('set local role anon;', q); if (/permission denied/i.test(r.erro?.message || '')) anon08++; }
ok('08.6', 'SEM LOGIN: nenhuma operação do schema api pode ser chamada', anon08 === 3, String(anon08));
let r8 = await salvar(SEMPERFIL, completa());
ok('08.7', 'logado sem perfil não registra monitoria (MI403)', cod(r8) === 'MI403', r8.erro?.message);
r8 = await salvar(ERIVAN, completa());
ok('08.8', 'GESTOR não registra nem edita avaliação (MI403)', cod(r8) === 'MI403', r8.erro?.message);
r8 = await salvar(ADM, completa());
ok('08.9', 'ADMIN não registra avaliação (MI403)', cod(r8) === 'MI403', r8.erro?.message);

// ---- rascunho, identidade, id e protocolo ---------------------------------------
const maxId = (await um("select max((substring(id from '^MON-([0-9]+)$'))::bigint) n from public.monitorias")).n;
r8 = await salvar(ALINE, { ...completa(), scores: [], monitorId: 'usr-20', status: 'Validada', finalScore: 100, protocolo: 'MON-2026-9999' });
const rasc = r8.ok;
const mR = rasc ? await monit(rasc.id) : {};
ok('08.10', 'rascunho da Aline: id e protocolo gerados pelo banco; monitora = quem está logada; status/monitor/protocolo enviados são ignorados',
   rasc && rasc.status === 'Rascunho' && Number(rasc.id.slice(4)) === Number(maxId) + 1 && /^MON-2026-\d{4}$/.test(rasc.protocolo) && rasc.protocolo !== 'MON-2026-9999'
   && mR.monitor_id === 'usr-1' && mR.registrado_por === 'usr-1' && mR.nota === null && mR.criado_em !== null, r8.erro?.message || JSON.stringify(rasc));
r8 = await salvar(ALINE, { ...completa({ id: rasc.id }), scores: [] });
ok('08.11', 'editar rascunho sem informar a versão → MI428', cod(r8) === 'MI428', r8.erro?.message);
r8 = await salvar(ALINE, { ...completa({ id: rasc.id }), scores: [] }, 99);
ok('08.12', 'editar rascunho com versão desatualizada → MI409', cod(r8) === 'MI409', r8.erro?.message);
r8 = await salvar(MON2, { ...completa({ id: rasc.id }), scores: [] }, 1);
ok('08.13', 'outra monitora não edita o rascunho da Aline (MI404)', cod(r8) === 'MI404', r8.erro?.message);
r8 = await salvar(ALINE, { ...completa({ id: rasc.id }), date: '2025-12-30T12:00:00Z' }, mR.versao);
ok('08.14', 'Aline edita o próprio rascunho com a versão lida; o protocolo NÃO muda', r8.ok && r8.ok.protocolo === rasc.protocolo && r8.ok.status === 'Rascunho', r8.erro?.message);
r8 = await salvar(ALINE, { ...completa(), date: '2025-05-10T12:00:00Z', competencia: '2025-05', scores: [] });
ok('08.15', 'protocolo segue o ano da data do atendimento (MON-2025-0001)', r8.ok?.protocolo === 'MON-2025-0001', r8.erro?.message || r8.ok?.protocolo);
r8 = await salvar(ALINE, { ...completa(), competencia: '2099-01', scores: [] });
ok('08.16', 'competência futura é recusada (MI422) — D9', cod(r8) === 'MI422', r8.erro?.message);

// ---- envio: regras do formulário (E6), nota pelo banco (E1) ----------------------
const v1 = (await monit(rasc.id)).versao;
for (const [id, desc, dados] of [
  ['08.17', 'envio sem nº do atendimento → MI422', { ...completa({ id: rasc.id }), numeroAtendimento: '' }],
  ['08.18', 'envio com fim antes do início → MI422', { ...completa({ id: rasc.id }), fimAtendimento: '2026-08-20T09:00' }],
  ['08.19', 'envio com critério sem resposta → MI422', { ...completa({ id: rasc.id }), scores: completa().scores.slice(1) }],
  ['08.20', 'envio com nota < 2 sem justificativa → MI422', completa({ id: rasc.id }, { 'crit-06': { score: 1, lowScoreReason: '' } })],
  ['08.21', 'escala fora do padrão (1.5) → MI422', completa({ id: rasc.id }, { 'crit-06': { score: 1.5, lowScoreReason: 'x' } })],
  ['08.22', 'opção de classificação inexistente → MI422', completa({ id: rasc.id }, { 'crit-01': { score: 'Elogio' } })],
  ['08.23', 'checklist com nota que não confere com as sub-respostas → MI422', completa({ id: rasc.id }, { 'crit-04': { score: 2, lowScoreReason: '', subRespostas: { 'sub-04-1': 'SIM', 'sub-04-2': 'NAO', 'sub-04-3': 'SIM', 'sub-04-4': 'SIM' } } })],
  ['08.24', 'checklist com sub-pergunta fora da régua (sub-24-3) → MI422', completa({ id: rasc.id }, { 'crit-24': { score: 2, lowScoreReason: '', subRespostas: { 'sub-24-1': 'SIM', 'sub-24-2': 'SIM', 'sub-24-3': 'SIM' } } })],
  ['08.25', 'portão 29→25 violado (29 = Sim e 25 avaliado) → MI422', completa({ id: rasc.id }, { 'crit-29': { score: 'Sim' }, 'crit-25': { score: 2, lowScoreReason: '' } })],
  ['08.26', 'nota do portal divergente da calculada pelo banco → MI422 (E1)', { ...completa({ id: rasc.id }, { 'crit-06': { score: 1, lowScoreReason: 'Faltou confirmar a demanda.' } }), finalScore: 100 }],
]) { const r = await salvar(ALINE, dados, v1, true); ok(id, desc, cod(r) === 'MI422', r.erro?.message || 'aceitou'); }
const dadosOk = completa({ id: rasc.id }, { 'crit-06': { score: 1, lowScoreReason: 'Faltou confirmar a demanda.' }, 'crit-08': { score: 'N/A', lowScoreReason: '' } });
const notaEsperada = Number((await um(`select app.calcular_nota((select retrato from public.regua_versoes where id = 'regua-2.0'), 'Telefone', '${JSON.stringify(dadosOk.scores).replace(/'/g, "''")}'::jsonb)::text n`)).n);
r8 = await salvar(ALINE, { ...dadosOk, finalScore: Number((notaEsperada + 0.01).toFixed(2)) }, v1, true);
const mE = await monit(rasc.id);
ok('08.27', 'envio válido: Pendente, Régua 2.0 (registro em 12/10), nota do BANCO gravada (nota do portal +0,01 aceita como conferência), N/A sem justificativa aceito (E6)',
   r8.ok?.status === 'Pendente' && mE.regua_versao_id === 'regua-2.0' && Number(mE.nota) === notaEsperada && Number(mE.nota_calculada) === notaEsperada
   && mE.enviado_em !== null && mE.eliminatorio_pendente === false && notaEsperada > 90 && notaEsperada < 100, r8.erro?.message || JSON.stringify({ nota: mE.nota, notaEsperada }));
const audEnvio = await um(`select count(distinct transacao)::int t, count(*)::int n, bool_and(autor_perfil_id = 'usr-1' and papel = 'authenticated' and responsavel_declarado is null) quem
  from public.auditoria where transacao = (select transacao from public.auditoria where tabela = 'monitorias' and chave->>'id' = '${rasc.id}' order by seq desc limit 1)`);
ok('08.28', 'envio auditado: monitoria e respostas na MESMA transação, autor usr-1 autenticado', audEnvio.t === 1 && audEnvio.n > 1 && audEnvio.quem === true, JSON.stringify(audEnvio));
r8 = await salvar(ALINE, { ...dadosOk }, mE.versao);
ok('08.29', 'D4: depois do envio a Monitora NÃO edita (MI403)', cod(r8) === 'MI403', r8.erro?.message);

// ---- decisões do Gestor ---------------------------------------------------------
r8 = await acao(ALINE, 'validar_monitoria', rasc.id, mE.versao);
ok('08.30', 'Monitora não valida (MI403)', cod(r8) === 'MI403', r8.erro?.message);
r8 = await acao(ADM, 'validar_monitoria', rasc.id, mE.versao);
ok('08.31', 'ADMIN não valida (MI403)', cod(r8) === 'MI403', r8.erro?.message);
r8 = await acao(GES2, 'validar_monitoria', rasc.id, mE.versao);
ok('08.32', 'Gestor de outra área não valida (MI404)', cod(r8) === 'MI404', r8.erro?.message);
r8 = await acao(ERIVAN, 'validar_monitoria', rasc.id, mE.versao - 1);
ok('08.33', 'validação com versão desatualizada → MI409', cod(r8) === 'MI409', r8.erro?.message);
r8 = await acao(ERIVAN, 'reprovar_monitoria', rasc.id, mE.versao, '  ');
ok('08.34', 'reprovar sem motivo → MI422 (D5)', cod(r8) === 'MI422', r8.erro?.message);
r8 = await acao(ERIVAN, 'devolver_monitoria', rasc.id, mE.versao, 'Rever a justificativa do critério 6.');
const mD = await monit(rasc.id);
ok('08.35', 'Erivan devolve: volta a Rascunho com o motivo e o autor da revisão', r8.ok?.status === 'Rascunho' && mD.motivo_ajuste === 'Rever a justificativa do critério 6.' && mD.revisado_por === 'usr-9', r8.erro?.message);
r8 = await salvar(ALINE, { ...dadosOk, finalScore: notaEsperada }, mD.versao, true);
const mRe = await monit(rasc.id);
ok('08.36', 'reenvio após devolução mantém a MESMA versão da régua (E2) e recalcula a nota', r8.ok?.status === 'Pendente' && mRe.regua_versao_id === 'regua-2.0' && Number(mRe.nota) === notaEsperada, r8.erro?.message);
r8 = await acao(ERIVAN, 'validar_monitoria', rasc.id, mRe.versao);
const mV = await monit(rasc.id);
ok('08.37', 'Erivan valida: Validada, com aprovador e data', r8.ok?.status === 'Validada' && mV.aprovado_por === 'usr-9' && mV.aprovado_em !== null, r8.erro?.message);
let fin = 0;
for (const r of [await salvar(ALINE, { ...dadosOk }, mV.versao), await acao(ERIVAN, 'devolver_monitoria', rasc.id, mV.versao, 'x'), await acao(ERIVAN, 'reprovar_monitoria', rasc.id, mV.versao, 'x'), await acao(ERIVAN, 'validar_monitoria', rasc.id, mV.versao)])
  if (cod(r) === 'MI403') fin++;
ok('08.38', 'monitoria VALIDADA é final: nem a Monitora edita, nem o Gestor devolve, reprova ou valida de novo', fin === 4, String(fin));

// ---- eliminatório (D6, E5) -------------------------------------------------------
const elim = completa({}, { 'crit-26': { score: 0, lowScoreReason: 'Ironia com o cliente aos 03:10.' } });
r8 = await salvar(ALINE, { ...elim, eliminatoryPending: false }, null, true);
const idE = r8.ok?.id; let mEl = idE ? await monit(idE) : {};
ok('08.39', 'eliminatório marcado: o BANCO marca pendente mesmo que o portal diga que não; nota calculada normalmente (peso 0)', mEl.eliminatorio_pendente === true && Number(mEl.nota) === 100, r8.erro?.message);
r8 = await acao(ERIVAN, 'validar_monitoria', idE, mEl.versao);
ok('08.40', 'validar com eliminatório pendente é bloqueado (D6)', cod(r8) === 'MI422', r8.erro?.message);
r8 = await acao(ERIVAN, 'confirmar_zeramento', idE, mEl.versao);
mEl = await monit(idE);
ok('08.41', 'zeramento confirmado: nota 0, nota_calculada PRESERVADA (100), quem confirmou registrado (E5)', Number(mEl.nota) === 0 && Number(mEl.nota_calculada) === 100 && mEl.zerada === true && mEl.eliminatorio_confirmado_por === 'usr-9', r8.erro?.message);
r8 = await acao(ERIVAN, 'validar_monitoria', idE, mEl.versao);
ok('08.42', 'depois da decisão, a validação é liberada', r8.ok?.status === 'Validada', r8.erro?.message);
r8 = await salvar(ALINE, { ...elim }, null, true);
let mAf = await monit(r8.ok.id);
const semMot = await acao(ERIVAN, 'afastar_eliminatorio', mAf.id, mAf.versao, '');
r8 = await acao(ERIVAN, 'afastar_eliminatorio', mAf.id, mAf.versao, 'Ironia não caracterizada no áudio completo.');
mAf = await monit(mAf.id);
ok('08.43', 'afastar eliminatório exige motivo; afastado, a nota calculada é mantida e o motivo fica registrado', cod(semMot) === 'MI422' && mAf.eliminatorio_pendente === false && Number(mAf.nota) === 100 && mAf.eliminatorio_afastado_motivo !== null, r8.erro?.message);

// ---- reprovação, cancelamento ---------------------------------------------------
r8 = await acao(ERIVAN, 'reprovar_monitoria', mAf.id, mAf.versao, 'Avaliação fora do padrão.');
const mRp = await monit(mAf.id);
ok('08.44', 'reprovada com motivo; é final (devolver depois → MI403) (D5)', r8.ok?.status === 'Reprovada' && mRp.motivo_reprovacao === 'Avaliação fora do padrão.' && cod(await acao(ERIVAN, 'devolver_monitoria', mAf.id, mRp.versao, 'x')) === 'MI403', r8.erro?.message);
r8 = await acao(ADM_SEM_MFA, 'cancelar_monitoria', mAf.id, mRp.versao, 'Duplicada.');
const semMfa = cod(r8);
r8 = await acao(ADM, 'cancelar_monitoria', mAf.id, mRp.versao, '');
const semMotivo = cod(r8);
r8 = await acao(ADM, 'cancelar_monitoria', mAf.id, mRp.versao, 'Registro duplicado.');
const mC = await monit(mAf.id);
ok('08.45', 'cancelar: ADMIN sem MFA → MI403; sem motivo → MI422; com MFA e motivo → Cancelada, com autor e motivo (D7)', semMfa === 'MI403' && semMotivo === 'MI422' && mC.status === 'Cancelada' && mC.cancelado_por === 'adm-1' && mC.cancelado_motivo === 'Registro duplicado.', r8.erro?.message);
ok('08.46', 'Gestor não cancela (MI403)', cod(await acao(ERIVAN, 'cancelar_monitoria', idE, (await monit(idE)).versao, 'x')) === 'MI403');

// ---- revisão: precisão numérica no envio (E1) -------------------------------------
{ const env = async (extra, troca = {}) => salvar(ALINE, completa(extra, troca), null, true);
  const a = await env({ finalScore: 99.99 }), b = await env({ finalScore: 100.00000000000001 }), c = await env({ finalScore: 99.98 }), d = await env({ finalScore: 100.011 });
  ok('08.62', 'nota do portal a 0,01 da do banco é ACEITA e o banco grava a sua (100); ruído de ponto flutuante (100.00000000000001) é aceito',
     a.ok?.status === 'Pendente' && Number(a.ok?.nota) === 100 && b.ok?.status === 'Pendente' && Number(b.ok?.nota) === 100, (a.erro || b.erro)?.message);
  ok('08.63', 'diferença MAIOR que 0,01 é recusada (99,98 e 100,011 → MI422)', cod(c) === 'MI422' && cod(d) === 'MI422', JSON.stringify([c.erro?.message, d.erro?.message]));
  const c04 = semente.find((x) => x.id === 'crit-04'); const sr = Object.fromEntries(c04.subPerguntas.map((s, i) => [s.id, i === 0 ? 'NAO' : 'SIM']));
  const ck = (v) => env({}, { 'crit-04': { score: v, lowScoreReason: 'Faltou um item do checklist.', subRespostas: sr } });
  const k1 = await ck(1.5), k2 = await ck(1.49), k3 = await ck(1.48);
  ok('08.64', `checklist (${c04.subPerguntas.length} sub-perguntas, 1 NÃO): 1,5 exato e 1,49 (arredondamento do portal) aceitos; 1,48 recusado`, !k1.erro && !k2.erro && cod(k3) === 'MI422', JSON.stringify([k1.erro?.message, k2.erro?.message, k3.erro?.message]));
  const sc = await salvar(ALINE, { ...completa(), canal: 'Fax', scores: [] }, null, true);
  ok('08.65', 'envio por canal sem nenhum critério aplicável (e sem respostas) é recusado — antes passaria com nota 0', cod(sc) === 'MI422', sc.erro?.message || JSON.stringify(sc.ok));
}

// ---- revisão: matriz de permissões por chamada direta (PostgREST) -----------------
{ const ids = (await db.query("select id, versao from public.monitorias where status = 'Pendente' and origem = 'portal' and monitor_id = 'usr-1' order by id limit 1")).rows[0];
  const casos = [
    ['MONITOR valida', ALINE, 'validar_monitoria', [ids.id, ids.versao]], ['MONITOR reprova', ALINE, 'reprovar_monitoria', [ids.id, ids.versao, 'x']],
    ['MONITOR devolve', ALINE, 'devolver_monitoria', [ids.id, ids.versao, 'x']], ['MONITOR zera', ALINE, 'confirmar_zeramento', [ids.id, ids.versao]],
    ['MONITOR afasta', ALINE, 'afastar_eliminatorio', [ids.id, ids.versao, 'x']], ['MONITOR cancela', ALINE, 'cancelar_monitoria', [ids.id, ids.versao, 'x']],
    ['GESTOR cancela', ERIVAN, 'cancelar_monitoria', [ids.id, ids.versao, 'x']], ['GESTOR publica régua', ERIVAN, 'publicar_regua', ['r-g', 'R G', FUTURO2, 'x']],
    ['MONITOR publica régua', ALINE, 'publicar_regua', ['r-m', 'R M', FUTURO2, 'x']],
    ['ADMIN valida', ADM, 'validar_monitoria', [ids.id, ids.versao]], ['ADMIN devolve', ADM, 'devolver_monitoria', [ids.id, ids.versao, 'x']],
    ['ADMIN reprova', ADM, 'reprovar_monitoria', [ids.id, ids.versao, 'x']], ['ADMIN zera', ADM, 'confirmar_zeramento', [ids.id, ids.versao]],
    ['GESTOR de outra área (equipe sem a Aline) valida', GES2, 'validar_monitoria', [ids.id, ids.versao]], ['sem perfil valida', SEMPERFIL, 'validar_monitoria', [ids.id, ids.versao]],
    ['inativa registra', INATIVA, 'salvar_monitoria', [JSON.stringify(completa())]], ['sem perfil cancela', SEMPERFIL, 'cancelar_monitoria', [ids.id, ids.versao, 'x']],
  ];
  const falhou = [];
  for (const [nome, quem, fn, args] of casos) {
    const r = await tentaApi(quem, `select api.${fn}(${args.map((_, i) => '$' + (i + 1) + (fn === 'salvar_monitoria' ? '::jsonb' : '')).join(', ')})`, args);
    if (!['MI403', 'MI404'].includes(cod(r))) falhou.push(`${nome}: ${r.erro?.code || 'EXECUTOU'}`);
  }
  const intacta = await monit(ids.id);
  ok('08.66', `matriz: ${casos.length} chamadas diretas fora do papel são todas recusadas (MI403/MI404) e a monitoria fica intacta`, falhou.length === 0 && intacta.status === 'Pendente' && intacta.versao === ids.versao, JSON.stringify(falhou));
  const direto = [];
  for (const q of ["update public.monitorias set nota = 100, versao_lida = versao", "insert into public.monitoria_respostas (monitoria_id, criterio_id) values ('MON-x', 'crit-01')", "update public.auditoria set acao = 'x'", "update public.regua_versoes set descricao = 'x'"])
    for (const [n, quem] of [['MONITOR', ALINE], ['GESTOR', ERIVAN], ['ADMIN', ADM]]) { const r = await tentaApi(quem, q); if (!r.erro) direto.push(n + ': ' + q.slice(0, 40)); }
  ok('08.67', 'nenhum papel grava direto em monitorias, respostas, auditoria ou versões publicadas (o caminho é só o schema api)', direto.length === 0, JSON.stringify(direto));
}

// ---- fila de validação: competências anteriores (agosto)// ---- fila de validação: competências anteriores (agosto) -------------------------
r8 = await salvar(ALINE, { ...completa(), competencia: '2026-08' }, null, true);
const idAgo = r8.ok?.id;
const filaErivan = (await (async () => { await db.exec('begin; ' + ERIVAN); const x = (await db.query('select id, competencia from api.fila_validacao()')).rows; await db.exec('commit'); return x; })());
const filaGes2 = (await (async () => { await db.exec('begin; ' + GES2); const x = (await db.query('select id from api.fila_validacao()')).rows; await db.exec('commit'); return x; })());
ok('08.47', 'fila do Erivan mostra a pendente de AGOSTO (competência anterior); a fila do outro gestor não', filaErivan.some((m) => m.id === idAgo && m.competencia === '2026-08') && !filaGes2.some((m) => m.id === idAgo), JSON.stringify(filaErivan));
r8 = await acao(ERIVAN, 'validar_monitoria', idAgo, (await monit(idAgo)).versao);
ok('08.48', 'Erivan valida a monitoria de agosto', r8.ok?.status === 'Validada', r8.erro?.message);

// ---- régua: versões, vigência, histórico (D10, E2, E3) ----------------------------
r8 = await tentaApi(ADM, "select api.publicar_regua('regua-x', 'Régua X', '2026-01-01', 'retroativa')");
ok('08.49', 'publicar versão com vigência retroativa é recusado (MI422)', cod(r8) === 'MI422', r8.erro?.message);
r8 = await tentaApi(ADM_SEM_MFA, `select api.publicar_regua('regua-3', 'Régua 3', '${HOJE}', 'x')`);
ok('08.50', 'publicar sem MFA → MI403', cod(r8) === 'MI403', r8.erro?.message);
const notasAntes = await um("select string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(regua_versao_id, '-'), ',' order by id) s from public.monitorias where origem = 'portal' and status <> 'Rascunho'");
await chamar(ADM, "update public.criterios set peso = 9, versao_lida = versao where id = 'crit-06'");
r8 = await salvar(ALINE, completa({}, { 'crit-06': { score: 1, lowScoreReason: 'Faltou confirmar.' }, 'crit-08': { score: 'N/A', lowScoreReason: '' } }), null, true);
const mP = await monit(r8.ok.id);
ok('08.51', 'peso alterado no cadastro SEM publicar não afeta nada: o envio usa o retrato da versão (Régua 2.0)', mP.regua_versao_id === 'regua-2.0' && Number(mP.nota) === notaEsperada, JSON.stringify({ nota: mP.nota, notaEsperada }));
await db.exec(`begin; ${ADM} select api.publicar_regua('regua-3', 'Régua 3 (teste)', '${AMANHA}', 'peso do crit-06 = 9'); commit;`);
const notasDepois = await um("select string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(regua_versao_id, '-'), ',' order by id) s from public.monitorias where origem = 'portal' and status <> 'Rascunho' and id <> '" + mP.id + "'");
ok('08.52', 'versão nova publicada (vigência futura): NENHUMA monitoria já enviada muda de nota nem de versão', notasAntes.s === notasDepois.s, `${notasAntes.s} → ${notasDepois.s}`);
r8 = await chamar(ADM, "select count(*)::int n from public.regua_versoes where id = 'regua-3' and (retrato -> 0) ? 'weight'");
ok('08.53', 'a versão publicada guarda o retrato completo dos critérios', r8 === 1);
{ const antes = (await um('select count(*)::int n from public.regua_versoes')).n;
  const dir = [];
  for (const [n, quem] of [['ADMIN com MFA', ADM], ['ADMIN sem MFA', ADM_SEM_MFA], ['GESTOR', ERIVAN], ['MONITOR', ALINE]]) {
    const r = await tentaApi(quem, `insert into public.regua_versoes (id, rotulo, vigente_desde, retrato) values ('r-dir', 'Direta', '${FUTURO}', '[{"id":"x"}]')`);
    dir.push(`${n}:${r.erro?.code || 'GRAVOU'}`);
  }
  const depois = (await um('select count(*)::int n from public.regua_versoes')).n;
  ok('08.54', 'INSERT direto em regua_versoes — ADMIN com MFA (vigência válida, retrato qualquer), ADMIN sem MFA, GESTOR e MONITOR: todos recusados por falta de permissão (42501); nenhuma versão criada',
     dir.every((x) => x.endsWith(':42501')) && antes === depois, JSON.stringify(dir)); }
{ const eu = await chamar(ADM, 'select app.meu_perfil_id()');
  const crit = Number((await um("select count(*)::int n from public.criterios")).n);
  const r = await tentaApi(ADM, `select api.publicar_regua('regua-4', 'Régua 4 (teste)', '${FUTURO}', 'publicada pela função')`);
  const v = await um("select vigente_desde::text vd, jsonb_array_length(retrato) n, retrato = app.retrato_regua_atual() igual from public.regua_versoes where id = 'regua-4'");
  const a = await um("select autor_perfil_id, autor_uid::text uid, papel, acao from public.auditoria where tabela = 'regua_versoes' and chave ->> 'id' = 'regua-4' order by seq desc limit 1");
  ok('08.54b', `publicação pela função autorizada (ADMIN com MFA): versão criada com o retrato montado pelo banco a partir dos ${crit} critérios, e a auditoria registra a inclusão com o login real do ADMIN (${eu})`,
     !r.erro && r.ok?.id === 'regua-4' && v?.vd === FUTURO && v?.n === crit && v?.igual === true && a?.acao === 'INSERT' && a?.autor_perfil_id === eu && a?.uid === U(5) && a?.papel === 'authenticated',
     r.erro?.message || JSON.stringify({ v, a })); }
await chamar(ADM, "update public.criterios set peso = 2, versao_lida = versao where id = 'crit-06'");
console.log('DIVERGENCIAS_OURO', JSON.stringify(difs));

// ---- E4b: MON-10001 migrada (dados reais de 08/10), devolução e reenvio ----------
const bk = JSON.parse(readFileSync(process.env.MONITORIA_BACKUP, 'utf8')).dados;
const m1 = (typeof bk.pm2_monitorings === 'string' ? JSON.parse(bk.pm2_monitorings) : bk.pm2_monitorings).find((x) => x.id === 'MON-10001');
await db.exec(`insert into public.monitorias (id, protocolo, competencia, data, monitor_id, colaborador_id, canal, tipo, status, nota, origem, enviada_na_origem, categoria_atendimento, numero_atendimento, numero_titulo, inicio_atendimento, fim_atendimento)
  values ('MON-10001', 'MON-2026-0001', '2026-08', '${m1.date}', 'usr-1', 'usr-4', 'WhatsApp', 'Regular', 'Pendente', 96.77, 'migracao', true, 'BOLETOS', 'AT-X', 'TIT-X', '2026-08-28T10:00', '2026-08-28T10:20')`);
let mM = await monit('MON-10001');
await db.exec(`insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, justificativa, sub_respostas, ordem)
  select 'MON-10001', s ->> 'criterionId', nullif(s -> 'score', 'null'::jsonb), s ->> 'lowScoreReason', nullif(s -> 'subRespostas', 'null'::jsonb), (o - 1)::int
    from jsonb_array_elements('${JSON.stringify(m1.scores).replace(/'/g, "''")}'::jsonb) with ordinality x(s, o)`);
const respOriginais = (await um("select jsonb_object_agg(criterio_id, jsonb_build_object('r', resposta, 's', sub_respostas)) j from public.monitoria_respostas where monitoria_id = 'MON-10001'")).j;

ok('08.55', 'monitoria migrada entra SEM versão de régua e com a nota original 96,77 (E4)', mM.regua_versao_id === null && Number(mM.nota) === 96.77 && mM.origem === 'migracao');
{ const v0 = mM.versao;
  const val = await acao(ERIVAN, 'validar_monitoria', 'MON-10001', v0), zer = await acao(ERIVAN, 'confirmar_zeramento', 'MON-10001', v0);
  const edi = await salvar(ALINE, { ...completa({ id: 'MON-10001', canal: 'WhatsApp', scores: m1.scores }) }, v0, true);
  const m = await monit('MON-10001');
  ok('08.55b', 'M1: ANTES da devolução, o Gestor NÃO valida nem zera a MON-10001 (nota não calculada pelo banco) e a Monitora não edita (D4); nada muda — 96,77, Pendente, mesma versão',
     cod(val) === 'MI403' && /migrada/.test(val.erro?.message) && cod(zer) === 'MI403' && /migrada/.test(zer.erro?.message) && cod(edi) === 'MI403' && Number(m.nota) === 96.77 && m.status === 'Pendente' && m.versao === v0 && m.nota_calculada === null,
     JSON.stringify([val.erro?.message, zer.erro?.message, edi.erro?.message, m.nota, m.status])); }
r8 = await acao(ERIVAN, 'devolver_monitoria', 'MON-10001', mM.versao, 'Revisão pela régua 1 com o peso corrigido do critério 6 (nota anterior 96,77).');
mM = await monit('MON-10001');
const limpas = m1.scores.map((s) => (s.criterionId === 'crit-24' ? { ...s, subRespostas: { 'sub-24-1': s.subRespostas['sub-24-1'], 'sub-24-2': s.subRespostas['sub-24-2'] } } : s));
const comSub243 = await salvar(ALINE, { ...completa({ id: 'MON-10001', canal: 'WhatsApp', scores: m1.scores }) }, mM.versao, true);
r8 = await salvar(ALINE, { ...completa({ id: 'MON-10001', canal: 'WhatsApp', scores: limpas }), finalScore: 84.62 }, mM.versao, true);
mM = await monit('MON-10001');
ok('08.56', 'reenvio com a resposta antiga sub-24-3 é recusado: nada de misturar versões (o portal precisa limpar)', cod(comSub243) === 'MI422', comSub243.erro?.message);
ok('08.57', 'E4b: MON-10001 reenviada → Régua 1 oficial, nota 84,62 calculada pelo banco, nota anterior 96,77 preservada em nota_historica',
   r8.ok?.status === 'Pendente' && mM.regua_versao_id === 'regua-1' && Number(mM.nota) === 84.62 && Number(mM.nota_historica) === 96.77, r8.erro?.message || JSON.stringify({ v: mM.regua_versao_id, n: mM.nota, h: mM.nota_historica }));
const trilha = (await db.query("select acao, depois->>'nota' nota, depois->>'status' st from public.auditoria where tabela = 'monitorias' and chave->>'id' = 'MON-10001' order by seq")).rows;
ok('08.58', 'a trilha mostra o histórico completo da MON-10001: inclusão (96,77) → devolução → reenvio (84,62)', trilha.length === 3 && trilha[0].nota === '96.77' && trilha[1].st === 'Rascunho' && trilha[2].nota === '84.62', JSON.stringify(trilha));
{ const ins = (await db.query("select depois from public.auditoria where tabela = 'monitoria_respostas' and acao = 'INSERT' and chave ->> 'monitoria_id' = 'MON-10001'")).rows;
  const daTrilha = Object.fromEntries(ins.map((x) => [x.depois.criterio_id, { r: x.depois.resposta ?? null, s: x.depois.sub_respostas ?? null }]));
  const antesSub243 = (await um("select count(*)::int n from public.auditoria where tabela = 'monitoria_respostas' and acao = 'UPDATE' and chave ->> 'monitoria_id' = 'MON-10001' and antes -> 'sub_respostas' ? 'sub-24-3'")).n;
  const linhas = (await um("select count(*)::int n from public.monitoria_respostas where monitoria_id = 'MON-10001'")).n;
  ok('08.58b', `respostas originais preservadas: as ${ins.length} respostas migradas estão íntegras na trilha (inclusão), a alteração do critério 24 guarda o "antes" com a sub-24-3, e nenhuma linha foi apagada`,
     ins.length === m1.scores.length && JSON.stringify(daTrilha, Object.keys(daTrilha).sort()) === JSON.stringify(respOriginais, Object.keys(respOriginais).sort()) && antesSub243 === 1 && linhas === m1.scores.length,
     JSON.stringify({ ins: ins.length, antesSub243, linhas })); }
r8 = await acao(ERIVAN, 'validar_monitoria', 'MON-10001', (await monit('MON-10001')).versao);
mM = await monit('MON-10001');
ok('08.58c', 'depois do reenvio, o Erivan valida: Validada com 84,62 e a nota histórica 96,77 continua guardada', r8.ok?.status === 'Validada' && Number(mM.nota) === 84.62 && Number(mM.nota_historica) === 96.77 && Number(mM.nota_calculada) === 84.62, r8.erro?.message);

// ---- E3 × E4b para migradas (decisão de 12/10) ------------------------------------
const migrada = async (id, prot, status, nota, enviada, scores = null) => {
  await db.exec(`insert into public.monitorias (id, protocolo, competencia, data, monitor_id, colaborador_id, canal, tipo, status, nota, origem, enviada_na_origem,
      categoria_atendimento, numero_atendimento, numero_titulo, inicio_atendimento, fim_atendimento)
    values ('${id}', '${prot}', '2026-09', '2026-09-10T12:00:00Z', 'usr-1', 'usr-4', 'Telefone', 'Regular', '${status}', ${nota === null ? 'null' : nota}, 'migracao', ${enviada === null ? 'null' : enviada},
      'BOLETOS', 'AT-M', 'TIT-M', '2026-09-10T10:00', '2026-09-10T10:15')`);
  if (scores) await db.exec(`insert into public.monitoria_respostas (monitoria_id, criterio_id, resposta, justificativa, sub_respostas, ordem)
    select '${id}', s ->> 'criterionId', nullif(s -> 'score', 'null'::jsonb), s ->> 'lowScoreReason', nullif(s -> 'subRespostas', 'null'::jsonb), (o - 1)::int
      from jsonb_array_elements('${JSON.stringify(scores).replace(/'/g, "''")}'::jsonb) with ordinality x(s, o)`);
  return monit(id);
};
const vigenteHoje = (await um('select app.regua_vigente() v')).v;

// E3: MON-10002 real (rascunho nunca submetido, com as 28 respostas do backup)
{ const m2 = (typeof bk.pm2_monitorings === 'string' ? JSON.parse(bk.pm2_monitorings) : bk.pm2_monitorings).find((x) => x.id === 'MON-10002');
  let m = await migrada('MON-10002', m2.protocolo || 'MON-2026-0002', 'Rascunho', m2.finalScore ?? null, false, m2.scores);
  const rasc = await salvar(ALINE, { ...completa({ id: 'MON-10002' }), scores: m2.scores }, m.versao, false);
  m = await monit('MON-10002');
  ok('08.68', 'E3: MON-10002 (rascunho migrado, enviada_na_origem = false) pode ser editada como rascunho; continua sem versão e sem nota histórica',
     rasc.ok?.status === 'Rascunho' && m.regua_versao_id === null && m.nota_historica === null, rasc.erro?.message);
  const env = await salvar(ALINE, completa({ id: 'MON-10002' }), m.versao, true);
  m = await monit('MON-10002');
  const esperada = Number((await um(`select app.calcular_nota((select retrato from public.regua_versoes where id = '${vigenteHoje}'), 'Telefone', '${JSON.stringify(completa().scores).replace(/'/g, "''")}'::jsonb)::text n`)).n);
  ok('08.69', `E3: no primeiro envio, a MON-10002 usa a régua VIGENTE (${vigenteHoje}), NÃO a Régua 1; nota calculada pelo banco; sem nota histórica; origem continua "migracao"`,
     env.ok?.status === 'Pendente' && vigenteHoje === 'regua-2.0' && m.regua_versao_id === 'regua-2.0' && Number(m.nota) === esperada && m.nota_historica === null && m.origem === 'migracao' && m.enviado_em !== null,
     env.erro?.message || JSON.stringify({ v: m.regua_versao_id, n: m.nota, h: m.nota_historica, esperada })); }

// E4b em rascunho: migrada que JÁ havia sido submetida (ex.: devolvida no portal antigo) → Régua 1, nota histórica preservada
{ let m = await migrada('MON-90001', 'MON-2025-9001', 'Rascunho', 90.5, true);
  const env = await salvar(ALINE, completa({ id: 'MON-90001' }), m.versao, true);
  m = await monit('MON-90001');
  ok('08.70', 'E4b: migrada já submetida (enviada_na_origem = true), mesmo em rascunho, reenvia pela Régua 1 e guarda a nota anterior (90,5) em nota_historica',
     env.ok?.status === 'Pendente' && m.regua_versao_id === 'regua-1' && Number(m.nota_historica) === 90.5, env.erro?.message || JSON.stringify(m)); }

// Sem a indicação: o banco não adivinha
{ let m = await migrada('MON-90002', 'MON-2025-9002', 'Rascunho', 70, null);
  const env = await salvar(ALINE, completa({ id: 'MON-90002' }), m.versao, true);
  const depois = await monit('MON-90002');
  ok('08.71', 'migrada SEM a indicação enviada_na_origem não é enviada (MI422) e nada muda — o banco não escolhe a régua por suposição',
     cod(env) === 'MI422' && /enviada_na_origem/.test(env.erro?.message) && depois.status === 'Rascunho' && depois.versao === m.versao && depois.regua_versao_id === null, env.erro?.message); }

// A indicação só existe em migradas
{ const ex = await erro(() => db.exec("update public.monitorias set enviada_na_origem = true, versao_lida = versao where origem = 'portal' and id = (select min(id) from public.monitorias where origem = 'portal')"));
  ok('08.72', 'enviada_na_origem só é aceita em monitoria migrada (regra no banco)', ex?.code === '23514', ex?.message); }

// D5m: reprovação de migrada — permitida, com motivo obrigatório e registro na auditoria
{ let m = await migrada('MON-90003', 'MON-2025-9003', 'Pendente', 88.4, true);
  const semMotivo = await acao(ERIVAN, 'reprovar_monitoria', 'MON-90003', m.versao, '   ');
  const r = await acao(ERIVAN, 'reprovar_monitoria', 'MON-90003', m.versao, 'Atendimento fora do procedimento.');
  m = await monit('MON-90003');
  const a = await um("select autor_perfil_id, autor_uid, depois ->> 'status' st, depois ->> 'motivo_reprovacao' mot, antes ->> 'status' antes from public.auditoria where tabela = 'monitorias' and chave ->> 'id' = 'MON-90003' order by seq desc limit 1");
  ok('08.73', 'reprovação de migrada: sem motivo → MI422; com motivo → Reprovada, nota 88,4 mantida (nada recalculado), e a auditoria registra antes/depois, o motivo e o Gestor (login real)',
     cod(semMotivo) === 'MI422' && r.ok?.status === 'Reprovada' && Number(m.nota) === 88.4 && m.regua_versao_id === null && m.revisado_por === a.autor_perfil_id && a.autor_uid !== null
       && a.st === 'Reprovada' && a.antes === 'Pendente' && a.mot === 'Atendimento fora do procedimento.',
     JSON.stringify({ e: r.erro?.message, a, rev: m.revisado_por })); }

// ---- revisão de segurança 2: régua publicada imutável --------------------------
const fotoRegua = async () => (await um("select count(*)::int || ':' || md5(string_agg(id || '|' || rotulo || '|' || vigente_desde || '|' || coalesce(descricao, '') || '|' || retrato::text || '|' || versao, ';' order by id)) s from public.regua_versoes")).s;
const fotoAval = async () => (await um("select md5(string_agg(m.id || '|' || coalesce(m.nota::text, '-') || '|' || coalesce(m.nota_calculada::text, '-') || '|' || coalesce(m.nota_historica::text, '-') || '|' || coalesce(m.regua_versao_id, '-') || '|' || m.status || '|' || m.versao || '|' || coalesce(md5(r.retrato::text), '-'), ';' order by m.id)) s from public.monitorias m left join public.regua_versoes r on r.id = m.regua_versao_id")).s;
const regua0 = await fotoRegua(), aval0 = await fotoAval();
{ const tentativas = ["update public.regua_versoes set retrato = '[]'::jsonb, versao_lida = versao where id = 'regua-2.0'",
                      "update public.regua_versoes set descricao = 'alterada', versao_lida = versao where id = 'regua-1'",
                      "update public.regua_versoes set vigente_desde = '2020-01-01', versao_lida = versao",
                      "delete from public.regua_versoes where id = 'regua-1'", "delete from public.regua_versoes", "truncate public.regua_versoes"];
  const passou = [];
  for (const [n, quem] of [['ADMIN com MFA', ADM], ['GESTOR', ERIVAN], ['MONITOR', ALINE], ['sem perfil', SEMPERFIL]])
    for (const q of tentativas) { const r = await tentaApi(quem, q); if (!r.erro) passou.push(`${n}: ${q.slice(0, 50)}`); }
  ok('08.74', `versão publicada: ${tentativas.length} tentativas (alterar retrato, descrição, vigência; excluir uma, todas; truncar) × 4 papéis — todas recusadas e nada muda`,
     passou.length === 0 && (await fotoRegua()) === regua0, JSON.stringify(passou)); }
{ const man = "set local app.manutencao = 'manutencao'; set local app.manutencao_motivo = 'Tentativa de contornar pela manutenção';";
  const r1 = await tentaApi(ADM + man, "update public.regua_versoes set descricao = 'x', versao_lida = versao where id = 'regua-1'");
  const r2 = await tentaApi(ADM + man, "delete from public.regua_versoes where id = 'regua-1'");
  const r3 = await tentaApi(ADM + man, "select api.publicar_regua('regua-man', 'Régua Man', '2020-01-01', 'retroativa com manutenção')");
  ok('08.75', 'nem com os sinalizadores de manutenção ligados na própria sessão o ADMIN altera, exclui ou publica retroativo (a manutenção só vale para o administrador do banco, sem login)',
     !!r1.erro && !!r2.erro && cod(r3) === 'MI422' && (await fotoRegua()) === regua0, JSON.stringify([r1.erro?.message, r2.erro?.message, r3.erro?.message])); }
{ const e1 = await erro(() => db.exec("delete from public.regua_versoes where id = 'regua-2.0'"));
  const e2 = await erro(() => db.exec("update public.regua_versoes set descricao = 'x', versao_lida = versao where id = 'regua-2.0'"));
  ok('08.76', 'até o administrador do banco (SQL Editor) é recusado sem a manutenção declarada: excluir (MI403) e alterar (MI403) versão publicada', e1?.code === 'MI403' && e2?.code === 'MI403', JSON.stringify([e1?.message, e2?.message])); }
{ const hoje = HOJE;
  const r1 = await tentaApi(ADM, `select api.publicar_regua('regua-1', 'Régua 1 (impostora)', '${hoje}', 'x')`);
  const r2 = await tentaApi(ADM, `select api.publicar_regua(' REGUA-1 ', 'Régua 1 (variação)', '${hoje}', 'x')`);
  const r3 = await tentaApi(ADM, `insert into public.regua_versoes (id, rotulo, vigente_desde, retrato) values ('Regua-1', 'Direta', '${hoje}', '[{"id":"x"}]')`);
  const r4 = await tentaApi(ADM, `select api.publicar_regua('regua-2.0', 'Régua 2.0 bis', '${hoje}', 'x')`);
  const r5 = await tentaApi(ADM, `select api.publicar_regua('regua-nova', 'Régua 2.0', '${hoje}', 'x')`);
  ok('08.77', 'o identificador regua-1 (usado pelo reenvio das migradas) é reservado: o ADMIN não o cria nem por variação de maiúsculas/espaços (MI403) nem por gravação direta (sem permissão)',
     cod(r1) === 'MI403' && cod(r2) === 'MI403' && ['MI403', '42501'].includes(cod(r3)), JSON.stringify([r1.erro?.message, r2.erro?.message, r3.erro?.message]));
  ok('08.78', 'republicar sobre versão existente (mesmo id ou mesmo rótulo) é recusado; nenhuma versão muda', !!r4.erro && !!r5.erro && (await fotoRegua()) === regua0, JSON.stringify([r4.erro?.message, r5.erro?.message])); }
ok('08.79', 'avaliações históricas intactas depois de todas as tentativas: nota, nota calculada, nota histórica, versão da régua, situação e o retrato da versão de cada monitoria', (await fotoAval()) === aval0);

// ---- revisão de segurança 2: funções internas e papéis --------------------------
{ const fns = (await db.query(`select p.proname, p.oid::regprocedure::text sig, (select string_agg('(select null::' || format_type(t, null) || ')', ', ' order by o) from unnest(p.proargtypes) with ordinality u(t, o)) args
     from pg_proc p where p.pronamespace = 'app'::regnamespace and p.prorettype <> 'trigger'::regtype
      and p.proname <> all (array['equipe_do_gestor','meu_perfil_id','meus_perfis','sou_admin','tem_perfil','usuario_ativo','usuario_liberado'])`)).rows;
  const vazou = [];
  for (const [n, quem] of [['MONITOR', ALINE], ['GESTOR', ERIVAN], ['ADMIN com MFA', ADM], ['sem perfil', SEMPERFIL]])
    for (const f of fns) { const r = await tentaApi(quem, `select app.${f.proname}(${f.args || ''})`); if (r.erro?.code !== '42501') vazou.push(`${n}: ${f.sig} → ${r.erro?.code || 'EXECUTOU'}`); }
  ok('08.80', `chamada direta das ${fns.length} funções internas do app por MONITOR, GESTOR, ADMIN com MFA e sem perfil: todas recusadas por falta de permissão (42501)`, vazou.length === 0, JSON.stringify(vazou.slice(0, 8))); }
{ const r = await um(`select
     (select count(*)::int from pg_proc p where p.pronamespace = 'app'::regnamespace and p.prorettype = 'trigger'::regtype and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))) gatilhos,
     (select count(*)::int from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.pronamespace in ('app'::regnamespace, 'api'::regnamespace) and a.grantee = 0) publico,
     (select count(*)::int from pg_class c where c.relkind = 'S' and c.relnamespace in ('public'::regnamespace, 'app'::regnamespace) and (has_sequence_privilege('authenticated', c.oid, 'usage') or has_sequence_privilege('authenticated', c.oid, 'update') or has_sequence_privilege('anon', c.oid, 'usage'))) sequencias,
     (select string_agg(p.proname || '=' || array_to_string(p.proconfig, ','), ';') from pg_proc p where p.pronamespace = 'api'::regnamespace and p.prosecdef and not (p.proconfig @> array['search_path=""'])) sem_caminho,
     (select string_agg(p.proname, ',' order by p.proname) from pg_proc p where p.prosecdef and p.pronamespace = 'app'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')) definer_app`);
  ok('08.81', 'nenhum gatilho executável pelo portal; nenhuma função de app/api aberta a PUBLIC; nenhuma sequência utilizável pelo portal; toda SECURITY DEFINER do api com search_path vazio',
     r.gatilhos === 0 && r.publico === 0 && r.sequencias === 0 && r.sem_caminho === null, JSON.stringify(r));
  ok('08.82', `as únicas SECURITY DEFINER do app que o portal executa são auxiliares de leitura do próprio login, todas na lista das 7 (${r.definer_app ?? 'nenhuma'})`,
     (r.definer_app ?? '').split(',').filter(Boolean).every((f) => ['equipe_do_gestor','meu_perfil_id','meus_perfis','sou_admin','tem_perfil','usuario_ativo','usuario_liberado'].includes(f)), r.definer_app); }
{ const fal = [];
  for (const [n, quem] of [['MONITOR', ALINE], ['ADMIN', ADM]]) {
    for (const q of ['create function app.x() returns int language sql as $$ select 1 $$', 'create function api.x() returns int language sql as $$ select 1 $$',
                     'create table app.x (a int)', 'create view api.v as select 1 a',                      "select setval('public.acessos_log_seq_seq', 1)", "select nextval('app.auditoria_seq')"]) {
      const r = await tentaApi(quem, q); if (!r.erro) fal.push(`${n}: ${q.slice(0, 45)}`);
    }
  }
  ok('08.83', 'o portal (MONITOR e ADMIN) não cria funções, tabelas ou views em app/api e não mexe nas sequências (pertencer a outros papéis: ver P7 em testes-padroes)', fal.length === 0, JSON.stringify(fal)); }

// ---- integridade final -----------------------------------------------------------
ok('08.59', 'cadeia da auditoria íntegra depois de todas as operações', (await um(QUEBRAS)).n === 0);
let int08 = 0;
for (const f of ['app.calcular_nota(null, null, null)', 'app.proximo_id_monitoria()', "app.recusar('MI403','x')", 'app.retrato_regua_atual()'])
  if (/permission denied/i.test((await tentaApi(ALINE, `select ${f}`)).erro?.message || '')) int08++;
ok('08.60', 'o portal não chama as funções internas do 08 (só as do schema api)', int08 === 4, String(int08));
e = await erro(async () => { for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql']) await db.exec(sql(f)); });
ok('08.61', '00 a 08 rodam de novo sem erro; dados e cadeia intactos', !e && (await um(QUEBRAS)).n === 0 && Number((await monit('MON-10001')).nota) === 84.62, e?.message);

// ---- relatório ---------------------------------------------------------------
const falhas = resultados.filter((r) => !r.ok);
for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`);
console.log(`\n${resultados.length} testes · ${resultados.length - falhas.length} aprovados · ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
