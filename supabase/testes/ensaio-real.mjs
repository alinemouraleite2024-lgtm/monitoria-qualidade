// ENSAIO LOCAL da migração real: banco Postgres local (PGlite) com os scripts 00–09a, o 09b gerado da
// cópia sanitizada, a conferência do 09 e os primeiros logins simulados. Nada sai deste computador.
// A saída mostra só identificadores, situações, contagens e os e-mails já aprovados (Aline, Erivan).
// Uso: node ensaio-real.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [projeto] = process.argv.slice(2);
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const man = JSON.parse(readFileSync(join(projeto, 'supabase/migracao/saida/manifesto.json'), 'utf8'));
const DECL = man.responsavel.declarado, ERIVAN = man.novos_perfis.erivan;
const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql'])
  await db.exec(sql(f));
let e = null;
try { await db.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8')); } catch (x) { e = x; }
ok('R.1', `09b real aplicado em uma transação (lote ${man.lote}), declarado como "${DECL}"`, !e, e?.message);
const conf1 = (await db.query(sql('conferencia-09.sql'))).rows;
const antes = conf1.filter((i) => i.ok === false).map((i) => i.item);
ok('R.2', 'conferência do 09 logo após a migração: tudo aprovado, exceto os itens 14 e 15 (logins ainda não criados)', JSON.stringify(antes) === '[14,15]', JSON.stringify(conf1.filter((i) => i.ok === false).map((i) => `${i.item}: ${i.resultado}`)));
const div = (await db.query("select chave, campo, antes::text a, depois::text d from app.migracao_ocorrencias where classe = 'DIVERGENCIA_REGISTRADA' order by seq")).rows;
ok('R.3', `divergências registradas sem correção: ${div.map((x) => `${x.chave} ${x.campo} ${x.a}→${x.d}`).join(' | ')}`, div.some((x) => x.chave === 'MON-10001' && x.campo === 'nota'));
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
const conf2 = (await db.query(sql('conferencia-09.sql'))).rows;
ok('R.4', `conferência depois dos logins simulados: ${conf2.filter((i) => i.ok === true).length} itens aprovados, nenhum reprovado`, conf2.every((i) => i.ok !== false), JSON.stringify(conf2.filter((i) => i.ok === false)));
for (const i of conf2) console.log(`   ${String(i.item).padStart(2)} ${i.ok === null ? 'ℹ' : i.ok ? '✔' : '✖'} ${i.verificacao}: ${i.resultado}`);
const como = async (uid, q, p = []) => { await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}';`);
  try { const x = await db.query(q, p); await db.exec('commit'); return x.rows; } catch (x) { await db.exec('rollback'); return { erro: x }; } };
const a = (await como(U(1), "select app.meu_perfil_id() eu, app.meus_perfis() p, (select string_agg(id || ':' || status, ',' order by id) from public.monitorias) m"))[0];
ok('R.5', `Aline (usr-1, MONITOR) vê as monitorias dela: ${a?.m}`, a?.eu === 'usr-1' && JSON.stringify(a.p) === '["MONITOR"]' && a.m === 'MON-10001:Pendente,MON-10002:Rascunho', JSON.stringify(a));
const g = (await como(U(2), "select app.meu_perfil_id() eu, app.meus_perfis() p, app.equipe_do_gestor() eq, (select string_agg(id, ',') from api.fila_validacao()) fila"))[0];
ok('R.6', `Erivan (${ERIVAN}, GESTOR) — equipe ${JSON.stringify(g?.eq)}, fila de validação: ${g?.fila}`, g?.eu === ERIVAN && JSON.stringify(g.p) === '["GESTOR"]' && JSON.stringify(g.eq) === '["usr-1"]' && g.fila === 'MON-10001', JSON.stringify(g));
const v = (await como(U(1), "select versao from public.monitorias where id = 'MON-10001'"))[0].versao;
const val = await como(U(2), "select api.validar_monitoria('MON-10001', $1)", [v]);
ok('R.7', 'Erivan não consegue validar a MON-10001 direto (M1): o caminho é devolver para a Aline revisar pela Régua 1', val.erro?.code === 'MI403', val.erro?.message);
const q = (await db.query("select count(*)::int n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra")).rows[0].n;
const segredo = (await db.query(`select count(*)::int n from (select texto t from app.migracao_origem union all select extras::text from public.perfis union all select coalesce(depois::text,'') from public.auditoria union all select manifesto::text from app.migracao_lotes) z
  where t ~* '"(password|confirmPassword|perfilAtivo)"[[:space:]]*:' or t like '%' || $1 || '%'`, [man.original_sha256])).rows[0].n;
ok('R.8', 'cadeia da auditoria íntegra; nenhuma senha, sessão ou impressão do arquivo original no banco', q === 0 && segredo === 0, JSON.stringify({ q, segredo }));

for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`);
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} verificações · ${r.length - f.length} aprovadas · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
