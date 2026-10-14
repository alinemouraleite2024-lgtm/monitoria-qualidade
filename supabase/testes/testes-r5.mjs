// Caminho real de atualização e cenários que exigem banco isolado.
// Uso: node testes-r5.mjs <pasta dos scripts> <06 aplicado no Supabase (antigo)>
//
// U1: o Supabase hoje — 00 a 05 + 06 ANTIGO, trilha vazia → 06 REVISADO → 07 → conferências.
// U2: trava — 06 antigo com registros na trilha → 06 revisado é RECUSADO e nada muda.
// U3: vínculo automático feito pelo serviço de login (supabase_auth_admin) sem declaração.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [pasta, antigo06] = process.argv.slice(2);
const sql = (f) => readFileSync(join(pasta, f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const resultados = [];
process.on('uncaughtException', (x) => { for (const r of resultados) console.log((r.ok ? '✔' : '✖') + ' ' + r.id + '  ' + r.desc + (r.ok ? '' : '  → ' + r.det)); console.log('INTERROMPIDO:', x.message, '|', (x.query||'').slice(0,160)); process.exit(2); });
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const erro = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const novo = async () => { const db = await PGlite.create({ extensions: { pgcrypto } }); await db.exec(SETUP); return db; };
const um = async (db, q) => (await db.query(q)).rows[0];
const foto = async (db) => um(db, `select
  (select string_agg(versao || '|' || descricao || '|' || aplicado_em::text || '|' || aplicado_por, ';' order by versao) from app.versoes_esquema where versao <= '06') versoes,
  (select string_agg(c.relname || '=' || (xpath('/row/n/text()', query_to_xml('select count(*) n from public.' || c.relname, false, true, '')))[1]::text, ',' order by c.relname)
     from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r') contagens,
  (select last_value::text || '/' || is_called::text from app.auditoria_seq) sequencia,
  (select string_agg(tgname || ':' || pg_get_triggerdef(oid), ';' order by tgname) from pg_trigger where not tgisinternal) gatilhos,
  (select string_agg(conname || ':' || pg_get_constraintdef(oid), ';' order by conname) from pg_constraint where connamespace = 'public'::regnamespace) regras`);
const ATE05 = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql'];

// ---- U1: o caminho que será feito no Supabase ------------------------------------
{
  const db = await novo();
  for (const f of ATE05) await db.exec(sql(f));
  await db.exec(readFileSync(antigo06, 'utf8'));
  const antes = await um(db, "select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'auditoria'");
  const fotoAntes = await foto(db);
  let e = await erro(() => db.exec(sql('06_auditoria.sql')));
  const fotoDepois = await foto(db);
  ok('U1.1', 'Supabase hoje (06 antigo, trilha vazia): o 06 revisado roda sem erro', !e, e?.message);
  const cols = await um(db, "select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'auditoria'");
  ok('U1.2', 'a auditoria ganha exatamente as 3 colunas novas', cols.n === antes.n + 3, `${antes.n} → ${cols.n}`);
  ok('U1.10', 'o 06 revisado NÃO altera nada existente: versões 00–06, contagem de todas as tabelas, sequência, gatilhos e regras idênticos',
     fotoAntes.versoes === fotoDepois.versoes && fotoAntes.contagens === fotoDepois.contagens && fotoAntes.sequencia === fotoDepois.sequencia
     && fotoAntes.gatilhos === fotoDepois.gatilhos && fotoAntes.regras === fotoDepois.regras,
     JSON.stringify(Object.keys(fotoAntes).filter((k) => fotoAntes[k] !== fotoDepois[k])));
  e = await erro(() => db.exec(sql('06_auditoria.sql')));
  ok('U1.3', 'o 06 revisado roda de novo sem erro', !e, e?.message);
  e = await erro(() => db.exec(sql('07_seguranca.sql')));
  ok('U1.4', 'em seguida, o 07 revisado roda sem erro', !e, e?.message);
  const v = await um(db, "select string_agg(versao, ',' order by versao) v from app.versoes_esquema");
  ok('U1.5', 'versões registradas: 00 a 06, 06.1 (R5) e 07', v.v === '00,01,02,03,04,05,06,06.1,07', v.v);
  // implantação: perfis antes dos logins; a primeira gravação usa a declaração de implantação
  e = await erro(() => db.exec(`begin; set local app.responsavel = 'curto';
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE'); commit;`));
  await db.exec('rollback').catch(() => {});
  ok('U1.6', 'implantação: declaração curta demais (sem nome e e-mail) é recusada', e?.code === 'MI401', e?.message);
  e = await erro(() => db.exec(`begin; set local app.responsavel = 'Responsável Sintético <a definir>';
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE');
      set local app.responsavel = 'adm-1';
      insert into public.perfis (id, email, nome, perfis, status) values ('usr-1', 'monitora.a@exemplo.test', 'Monitora A', '{MONITOR}', 'ACTIVE'),
                                                                         ('usr-9', 'gestor.e@exemplo.test', 'Gestor E', '{GESTOR}', 'ACTIVE');
      commit;`));
  ok('U1.7', 'implantação: 1º administrador com declaração de nome; em seguida, tudo declarado como adm-1', !e, e?.message);
  const aud = await db.query("select chave->>'id' id, responsavel_declarado d, sessao_usuario s from public.auditoria order by seq");
  ok('U1.8', 'a auditoria registra quem declarou cada passo da implantação', JSON.stringify(aud.rows.map((r) => [r.id, r.d])) === '[["adm-1","Responsável Sintético <a definir>"],["usr-1","adm-1"],["usr-9","adm-1"]]', JSON.stringify(aud.rows));
  const conf06 = await db.query(readFileSync(new URL('./conferencia-06r.sql', import.meta.url), 'utf8')).catch((x) => ({ erro: x.message }));
  ok('U1.9', 'a conferência do 06 revisado roda (somente leitura)', !conf06.erro, conf06.erro);
}

// ---- U2: trava — trilha com registros + 06 antigo → 06 revisado é recusado --------
{
  const db = await novo();
  for (const f of ATE05) await db.exec(sql(f));
  await db.exec(readFileSync(antigo06, 'utf8'));
  await db.exec("update public.configuracoes set valor = valor where false"); // nada
  await db.exec("insert into public.configuracoes (chave, valor) values ('settings', '{}')");
  const n = (await um(db, 'select count(*)::int n from public.auditoria')).n;
  const fotoAntes = await foto(db);
  const fnAntes = (await um(db, "select md5(string_agg(prosrc, '|' order by proname)) h from pg_proc where pronamespace = 'app'::regnamespace")).h;
  const e = await erro(() => db.exec(sql('06_auditoria.sql')));
  await db.exec('rollback').catch(() => {});
  const fotoDepois = await foto(db);
  const fnDepois = (await um(db, "select md5(string_agg(prosrc, '|' order by proname)) h from pg_proc where pronamespace = 'app'::regnamespace")).h;
  const v061 = (await um(db, "select count(*)::int n from app.versoes_esquema where versao = '06.1'")).n;
  ok('U2.2', 'a trava MI409 dispara ANTES de qualquer alteração: funções, versões, gatilhos, regras, sequência e dados idênticos; 06.1 não registrada',
     JSON.stringify(fotoAntes) === JSON.stringify(fotoDepois) && fnAntes === fnDepois && v061 === 0, JSON.stringify({ v061, fn: fnAntes === fnDepois }));
  const cols = await um(db, "select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'auditoria' and column_name = 'responsavel_declarado'");
  ok('U2.1', 'trilha com registros: o 06 revisado é RECUSADO (MI409) e nada é alterado', n === 1 && e?.code === 'MI409' && cols.n === 0, e?.message);
}

// ---- U4: implantação com o 1º administrador gravado dentro de pontos de salvamento
{
  const db = await novo();
  for (const f of ATE05) await db.exec(sql(f));
  await db.exec(readFileSync(antigo06, 'utf8'));
  await db.exec(sql('06_auditoria.sql'));
  await db.exec(sql('07_seguranca.sql'));
  let e = await erro(() => db.exec(`begin; set local app.responsavel = 'Responsável Sintético <a definir>';
      savepoint s1;
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE');
      release savepoint s1;
      set local app.responsavel = 'adm-1';
      insert into public.perfis (id, email, nome, perfis, status) values ('usr-1', 'monitora.a@exemplo.test', 'Monitora A', '{MONITOR}', 'ACTIVE');
      commit;`));
  await db.exec('rollback').catch(() => {});
  ok('U4.1', 'implantação com o 1º administrador criado num savepoint e, em seguida, a transação declarada com o id dele', !e, e?.message);
  const db2 = await novo();
  for (const f of [...ATE05, '06_auditoria.sql', '07_seguranca.sql']) await db2.exec(sql(f));
  e = await erro(() => db2.exec(`begin; set local app.responsavel = 'Responsável Sintético <a definir>';
      do $$ begin
        begin
          insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE');
        exception when others then raise;
        end;
      end $$;
      set local app.responsavel = 'adm-1';
      insert into public.perfis (id, email, nome, perfis, status) values ('usr-9', 'gestor.e@exemplo.test', 'Gestor E', '{GESTOR}', 'ACTIVE');
      commit;`));
  await db2.exec('rollback').catch(() => {});
  ok('U4.2', 'idem com o 1º administrador criado num bloco com tratamento de erro (subtransação, como em rotinas de migração)', !e, e?.message);
  const db3 = await novo();
  for (const f of [...ATE05, '06_auditoria.sql', '07_seguranca.sql']) await db3.exec(sql(f));
  const e45 = await erro(() => db3.exec(`begin; set local app.responsavel = 'Responsável Sintético <a definir>';
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE');
      insert into public.perfis (id, email, nome, perfis, status) values ('usr-9', 'gestor.e@exemplo.test', 'Gestor E', '{GESTOR}', 'ACTIVE');
      commit;`));
  await db3.exec('rollback').catch(() => {});
  const n45 = (await um(db3, 'select count(*)::int n from public.perfis')).n;
  ok('U4.5', 'a declaração por nome serve SÓ para incluir o 1º administrador: continuar com ela na mesma transação é recusado e nada é gravado', e45?.code === 'MI401' && n45 === 0, (e45?.message || 'aceitou') + ' perfis=' + n45);
  e = await erro(() => db2.exec(`begin; set local app.responsavel = 'Outra Pessoa <outra@exemplo.test>';
      update public.configuracoes set valor = valor where false; insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 0, 'X'); commit;`));
  await db2.exec('rollback').catch(() => {});
  ok('U4.3', 'depois da implantação, declaração por nome em OUTRA transação é recusada (só o id de um administrador ativo vale)', e?.code === 'MI401', e?.message);
  e = await erro(() => db2.exec(`begin; set local app.responsavel = 'adm-1';
      insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 0, 'X'); commit;`));
  await db2.exec('rollback').catch(() => {});
  ok('U4.4', 'migração/manutenção posterior: transação declarada com o id do administrador é aceita', !e, e?.message);
}

// ---- U5: a exceção de implantação não reabre depois que o 1º administrador existe
{
  const db = await novo();
  for (const f of [...ATE05, '06_auditoria.sql', '07_seguranca.sql']) await db.exec(sql(f));
  await db.exec(`begin; set local app.responsavel = 'Responsável Sintético <a definir>';
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE');
      commit;`);
  const transacao = async (corpo) => { const e = await erro(() => db.exec('begin; ' + corpo + ' commit;')); await db.exec('rollback').catch(() => {}); return e; };
  const NOME = "set local app.responsavel = 'Fulano de Tal <fulano@exemplo.test>';";
  let e = await transacao(`set local app.responsavel = 'adm-1';
      update public.perfis set nome = 'Administração (renomeada)' where id = 'adm-1';
      ${NOME}
      insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 0, 'X');`);
  ok('U5.1', 'S1: administrador atualizado nesta transação NÃO reabre a implantação — declaração por nome em seguida é recusada (MI401)', e?.code === 'MI401', e?.message || 'ACEITOU (brecha)');
  e = await transacao(`${NOME}
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-2', 'adm2@exemplo.test', 'Segunda Administração', '{ADMIN}', 'ACTIVE');`);
  ok('U5.2', 'S2: criar um 2º administrador com a declaração de implantação, havendo o 1º, é recusado (MI401)', e?.code === 'MI401', e?.message || 'ACEITOU (brecha)');
  e = await transacao(`set local app.responsavel = 'adm-1';
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-2', 'adm2@exemplo.test', 'Segunda Administração', '{ADMIN}', 'ACTIVE');
      ${NOME}
      insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 1, 'Y');`);
  ok('U5.3', 'S3: 2º administrador criado do jeito certo (declarando adm-1); declaração por nome em seguida é recusada (MI401)', e?.code === 'MI401', e?.message || 'ACEITOU (brecha)');
  e = await transacao(`set local app.responsavel = 'adm-1';
      insert into public.perfis (id, email, nome, perfis, status) values ('adm-2', 'adm2@exemplo.test', 'Segunda Administração', '{ADMIN}', 'ACTIVE');`);
  ok('U5.4', 'S3 (controle): criar o 2º administrador declarando o id do 1º é aceito', !e, e?.message);
  e = await transacao(`${NOME} update public.perfis set nome = 'Outro nome' where id = 'adm-1';`);
  ok('U5.5', 'S4: atualizar o único administrador com declaração por nome é recusado (MI401)', e?.code === 'MI401', e?.message || 'ACEITOU (brecha)');
  e = await transacao(`${NOME}
      insert into public.perfis (id, email, nome, perfis, status) values ('usr-50', 'nova@exemplo.test', 'Nova Monitora', '{MONITOR}', 'ACTIVE');`);
  // adm-2 já foi criado (de verdade) no U5.4; a transferência inativa o adm-1, declarada pelo adm-2
  await db.exec(`begin; set local app.responsavel = 'adm-2';
      update public.perfis set status = 'INACTIVE' where id = 'adm-1'; commit;`);
  e = await transacao(`set local app.responsavel = 'adm-1'; insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 2, 'Z');`);
  ok('U5.7', 'administrador INATIVADO não pode mais ser declarado responsável (MI401)', e?.code === 'MI401', e?.message || 'aceitou');
  e = await transacao(`${NOME} insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 3, 'W');`);
  ok('U5.8', 'transferência feita (adm-2 ativo, adm-1 inativo): a implantação continua fechada para declaração por nome', e?.code === 'MI401', e?.message || 'aceitou');
  e = await transacao(`set local app.responsavel = 'adm-2'; insert into public.catalogos (catalogo, ordem, valor) values ('categorias', 4, 'V');`);
  ok('U5.9', 'o novo administrador (adm-2) declara e opera normalmente', !e, e?.message);
  e = await transacao(`${NOME}
      insert into public.perfis (id, email, nome, perfis, status) values ('usr-50', 'nova@exemplo.test', 'Nova Monitora', '{MONITOR}', 'ACTIVE');`);
  ok('U5.6', 'S5: cadastrar perfil operacional com declaração por nome, havendo administrador, é recusado (MI401)', e?.code === 'MI401', e?.message || 'ACEITOU (brecha)');
}

// ---- U3: vínculo pelo serviço de login (sessão supabase_auth_admin) ----------------
{
  const db = await novo();
  for (const f of [...ATE05, '06_auditoria.sql']) await db.exec(sql(f));
  await db.exec(`begin; set local app.responsavel = 'Implantação de teste <teste@exemplo.test>';
    insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração', '{ADMIN}', 'ACTIVE');
    set local app.responsavel = 'adm-1';
    insert into public.perfis (id, email, nome, perfis, status) values ('usr-9', 'gestor.e@exemplo.test', 'Gestor E', '{GESTOR}', 'ACTIVE'); commit;`);
  // permissão de leitura só para o teste conferir o resultado depois da troca de sessão
  await db.exec('create policy tmp_p on public.perfis for select to supabase_auth_admin using (true); create policy tmp_a on public.auditoria for select to supabase_auth_admin using (true); grant select on public.perfis, public.auditoria to supabase_auth_admin');
  await db.exec('set session authorization supabase_auth_admin');
  const e = await erro(() => db.exec("insert into auth.users values ('00000002-0000-0000-0000-000000000002', 'Gestor.E@Exemplo.test', now())"));
  await db.exec('reset session authorization').catch(() => {});
  ok('U3.1', 'o serviço de login cria o usuário sem declarar responsável (o vínculo automático não é bloqueado)', !e, e?.message);
  const r = await um(db, "select auth_user_id is not null ligado from public.perfis where id = 'usr-9'");
  ok('U3.2', 'o perfil do Erivan fica ligado ao login', r.ligado === true, JSON.stringify(r));
  const a = await um(db, 'select tabela, sessao_usuario s, responsavel_declarado d, autor_uid from public.auditoria order by seq desc limit 1');
  ok('U3.3', 'a auditoria registra o vínculo como feito pelo serviço de login, sem responsável declarado', a.tabela === 'perfis' && a.s === 'supabase_auth_admin' && a.d === null, JSON.stringify(a));
}

for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`);
const f = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length} testes · ${resultados.length - f} aprovados · ${f} falhas`);
