// Testes do script 10 (P1: reprovação respeita a M1) num banco Postgres LOCAL (PGlite), com a
// migração REAL ensaiada (09b exato, lote mig-e86c70923cfc) e logins simulados. Nada sai daqui.
// Saída: só identificadores, situações e códigos de erro.
// Uso: node testes-10.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [projeto] = process.argv.slice(2);
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const man = JSON.parse(readFileSync(join(projeto, 'supabase/migracao/saida/manifesto.json'), 'utf8'));
const DECL = man.responsavel.declarado;
const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'])
  await db.exec(sql(f));
await db.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);

// fotografia do que NÃO pode mudar
const foto = async () => JSON.stringify((await db.query(`select (select json_agg(m order by id) from (select id, status, versao, nota, nota_historica, regua_versao_id, motivo_reprovacao, revisado_por from public.monitorias) m) mon,
  (select count(*) from public.auditoria) aud, (select max(seq) from public.auditoria) ancora, (select count(*) from public.perfis) perfis`)).rows[0]);
const antes = await foto();

// 1. aplicação, idempotência e o próprio SQL
let e = null; try { await db.exec(sql('10_p1_reprovar_m1.sql')); } catch (x) { e = x; }
ok('T.1', 'script 10 aplicado numa transação, com a conferência interna aprovada', !e, e?.message);
e = null; try { await db.exec(sql('10_p1_reprovar_m1.sql')); } catch (x) { e = x; }
ok('T.2', 'rodar de novo não quebra nada (idempotente)', !e, e?.message);
const v = (await db.query("select count(*)::int n from app.versoes_esquema where versao = '10'")).rows[0].n;
ok('T.3', 'versão 10 registrada uma vez', v === 1);
ok('T.4', 'o script 10 NÃO alterou nenhum dado: monitorias, perfis e auditoria idênticos', (await foto()) === antes);
const sem = sql('10_p1_reprovar_m1.sql').replace(/--.*$/gm, '');
ok('T.5', 'o script não cria tabela, não apaga, não grava em tabela de dados (só função, permissão e registro de versão)',
   !/create\s+(temp\s+|temporary\s+)?table|drop\s|delete\s|truncate|update\s+public|insert\s+into\s+public/i.test(sem.replace(/\$\$[\s\S]*?\$\$/g, '')));
const acl = (await db.query(`select has_function_privilege('anon', 'api.reprovar_monitoria(text,integer,text)'::regprocedure, 'execute') anon,
  has_function_privilege('authenticated', 'api.reprovar_monitoria(text,integer,text)'::regprocedure, 'execute') auth,
  (select prosecdef from pg_proc where oid = 'api.reprovar_monitoria(text,integer,text)'::regprocedure) secdef,
  (select array_to_string(proconfig, ',') from pg_proc where oid = 'api.reprovar_monitoria(text,integer,text)'::regprocedure) cfg`)).rows[0];
ok('T.6', 'permissões e segurança iguais às do 08: anônimo não executa, logado executa, security definer, search_path vazio',
   acl.anon === false && acl.auth === true && acl.secdef === true && /^search_path=(""|)$/.test(acl.cfg), JSON.stringify(acl));

const conf = (await db.query(sql('conferencia-09.sql'))).rows;
const falhos = conf.filter((i) => i.ok === false).map((i) => `${i.item}: ${i.resultado}`);
ok('T.6b', 'conferencia-09.sql (17 itens) continua aprovada logo depois do script 10, antes de qualquer operação', falhos.length === 0, JSON.stringify(falhos));

// 2. chamadas como no portal (papel authenticated + JWT)
const como = async (uid, q, p = []) => {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}';`);
  try { const x = await db.query(q, p); await db.exec('commit'); return { rows: x.rows }; } catch (x) { await db.exec('rollback'); return { erro: x }; } };
const versao = async (id) => (await db.query('select versao from public.monitorias where id = $1', [id])).rows[0].versao;

const antesTent = await foto();
const rep = await como(U(2), "select api.reprovar_monitoria('MON-10001', $1, 'Reprovação direta (teste)') r", [await versao('MON-10001')]);
ok('T.7', `P1 fechada: Erivan tenta REPROVAR a MON-10001 migrada sem régua pela API → ${rep.erro?.code} "${rep.erro?.message}"`,
   rep.erro?.code === 'MI403' && /migrada/.test(rep.erro?.message ?? ''));
const repSem = await como(U(2), "select api.reprovar_monitoria('MON-10001', $1, '') r", [await versao('MON-10001')]);
ok('T.8', 'mesmo sem motivo, a resposta é a da M1 (a barreira vem antes do motivo)', repSem.erro?.code === 'MI403' && /migrada/.test(repSem.erro?.message ?? ''));
const val = await como(U(2), "select api.validar_monitoria('MON-10001', $1) r", [await versao('MON-10001')]);
const zer = await como(U(2), "select api.confirmar_zeramento('MON-10001', $1) r", [await versao('MON-10001')]);
ok('T.9', 'validar e confirmar zeramento continuam recusados (M1 do 08, sem mudança)', val.erro?.code === 'MI403' && zer.erro?.code === 'MI403');
ok('T.10', 'as tentativas recusadas não gravaram nada: MON-10001 Pendente, mesma versão, nenhuma linha nova de auditoria', (await foto()) === antesTent);
const ali = await como(U(1), "select api.reprovar_monitoria('MON-10001', $1, 'x') r", [await versao('MON-10001')]);
ok('T.11', 'a Monitora continua sem poder reprovar (recusada pela guarda do gestor)', ali.erro?.code === 'MI403' && !/migrada/.test(ali.erro?.message ?? ''), ali.erro?.message);
const anon = await (async () => { await db.exec("begin; set local role anon;"); try { await db.query("select api.reprovar_monitoria('MON-10001', 1, 'x')"); await db.exec('commit'); return null; } catch (x) { await db.exec('rollback'); return x; } })();
ok('T.12', 'anônimo não executa a função (permission denied)', anon?.code === '42501', anon?.message);

// 3. fluxo normal: devolver → reenviar → decisão final volta a valer
const dev = await como(U(2), "select api.devolver_monitoria('MON-10001', $1, 'Revisar pela Régua 1 oficial.') r", [await versao('MON-10001')]);
ok('T.13', 'Devolver continua disponível para a migrada: MON-10001 → Rascunho', dev.rows?.[0]?.r?.status === 'Rascunho', dev.erro?.message);
const resp = (await db.query(`select r.criterio_id, r.resposta, r.justificativa, r.sub_respostas from public.monitoria_respostas r where r.monitoria_id = 'MON-10001' and r.ativo order by r.ordem`)).rows;
const r1 = (await db.query("select retrato from public.regua_versoes where id = 'regua-1'")).rows[0].retrato;
const subs = Object.fromEntries(r1.map((c) => [c.id, new Set((c.subPerguntas || []).map((s) => s.id))]));
const scores = resp.map((x) => ({ criterionId: x.criterio_id, score: x.resposta, lowScoreReason: x.justificativa ?? '',
  subRespostas: x.sub_respostas && typeof x.sub_respostas === 'object' ? Object.fromEntries(Object.entries(x.sub_respostas).filter(([k]) => subs[x.criterio_id]?.has(k))) : x.sub_respostas }));
const m = (await db.query("select * from public.monitorias where id = 'MON-10001'")).rows[0];
const nota = (await db.query('select app.calcular_nota($1::jsonb, $2, $3::jsonb) n', [JSON.stringify(r1), m.canal, JSON.stringify(scores)])).rows[0].n;
const iso = (d) => (d instanceof Date ? d.toISOString() : d);
const dados = { id: 'MON-10001', colaboradorId: m.colaborador_id, canal: m.canal, tipo: m.tipo, competencia: m.competencia, date: iso(m.data),
  categoriaAtendimento: m.categoria_atendimento, numeroAtendimento: m.numero_atendimento, numeroTitulo: m.numero_titulo,
  inicioAtendimento: iso(m.inicio_atendimento), fimAtendimento: iso(m.fim_atendimento), scores, finalScore: Number(nota) };
const env = await como(U(1), 'select api.salvar_monitoria($1::jsonb, $2, true) r', [JSON.stringify(dados), await versao('MON-10001')]);
const depois = (await db.query("select status, regua_versao_id, nota, nota_historica from public.monitorias where id = 'MON-10001'")).rows[0];
ok('T.14', `Aline reenvia: ${depois.status} pela ${depois.regua_versao_id}, nota do banco ${depois.nota}, nota histórica ${depois.nota_historica} preservada`,
   !env.erro && depois.status === 'Pendente' && depois.regua_versao_id === 'regua-1' && Number(depois.nota_historica) === 96.77, env.erro?.message);
await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${U(2)}","role":"authenticated"}';`);
let repOk; try { repOk = (await db.query("select api.reprovar_monitoria('MON-10001', $1, 'Reprovada após revisão (teste)') r", [await versao('MON-10001')])).rows[0].r.status; } catch (x) { repOk = 'erro ' + x.code + ' ' + x.message; }
await db.exec('rollback');
ok('T.15', `depois do reenvio, o gestor volta a poder REPROVAR (provado numa transação desfeita) → ${repOk}`, repOk === 'Reprovada');
const semMotivo = await como(U(2), "select api.reprovar_monitoria('MON-10001', $1, '  ') r", [await versao('MON-10001')]);
ok('T.16', 'a regra antiga do motivo continua: reprovar sem motivo → MI422', semMotivo.erro?.code === 'MI422', semMotivo.erro?.message);
const valOk = await como(U(2), "select api.validar_monitoria('MON-10001', $1) r", [await versao('MON-10001')]);
ok('T.17', `e pode VALIDAR normalmente → ${valOk.rows?.[0]?.r?.status ?? valOk.erro?.message}`, valOk.rows?.[0]?.r?.status === 'Validada');

// 4. integridade final
const q = (await db.query("select count(*)::int n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra")).rows[0].n;
ok('T.19', 'cadeia da auditoria íntegra', q === 0);

for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`);
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
