// Ensaio do script 17 sobre uma CÓPIA do backup real, num Postgres LOCAL em memória (PGlite).
// Nada é gravado em disco, nada sai deste computador e nada toca o Supabase. A saída traz só
// contagens, impressões e os códigos das monitorias, sem conteúdo.
//
// Prova: restaurado o backup, instalar o 17 não muda nenhuma monitoria, resposta, evidência, evento
// ou nota; a nota recalculada de cada monitoria enviada continua igual; a impressão continua igual à
// registrada no próprio backup; o 17r devolve exatamente o estado anterior.
//
// Uso: node testes-17-dados-reais.mjs <projeto> <arquivo do backup>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto, arquivo] = process.argv.slice(2);
if (!arquivo) { console.log('Informe o projeto e o arquivo do backup.'); process.exit(2); }
const { lerBackup, conferirBackup, gerarRestauracao, linhasDe } = await import(pathToFileURL(join(projeto, 'supabase/backup/restauracao.mjs')).href);
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
// O erro do banco repete a consulta, com os dados: aqui só o motivo.
process.on('uncaughtException', (e) => { console.log(`INTERROMPIDO: ${String(e.message).slice(0, 300)}`); process.exit(2); });
const r = [];
const ok = (id, d, c, det = '') => { r.push({ ok: !!c }); console.log(`${c ? '✔' : '✖'} ${id}  ${d}${c ? '' : `  → ${det}`}`); };

const b = lerBackup(readFileSync(arquivo, 'utf8'));
ok('D.0', `backup íntegro (${b.meta.gerado_em})`, conferirBackup(b).length === 0, conferirBackup(b).join('; '));

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
await db.exec(`create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql', '12_estado_do_acesso_mfa.sql', '14_historico_calibracao.sql', '15_duplicidade_criacao.sql', '16_colaboradora_inativa.sql']) {
  await db.exec(sql(f));
}
const SO_DADOS = ['09', '11a', '12a'];
for (const v of b.meta.versoes.filter((x) => !SO_DADOS.includes(x))) {
  await db.query(`insert into app.versoes_esquema (versao, descricao) values ($1, 'ensaio local') on conflict (versao) do nothing`, [v]);
}
for (const p of linhasDe(b, 'public.perfis').filter((x) => x.auth_user_id)) {
  await db.query(`insert into auth.users values ($1, $2, now()) on conflict do nothing`, [p.auth_user_id, `ensaio-${p.id}@exemplo.test`]);
}
await db.exec("set timezone = 'UTC'");
await db.exec(gerarRestauracao(b, { responsavel: 'adm-aline-oliveira', motivo: 'Ensaio local do script 17, em memória.' }));

const um = async (q) => (await db.query(q)).rows[0];
const impressoes = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(nota_calculada::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias) notas,
  (select count(*) from public.auditoria)::int aud,
  (select count(*) from public.auditoria where seq is not null and hash <> app.auditoria_hash(auditoria))::int hash_ruim`);
const A = await impressoes();
ok('D.1', 'restaurado: impressões iguais às registradas no backup', A.mon === b.meta.impressoes.monitorias && A.resp === b.meta.impressoes.respostas && A.evid === b.meta.impressoes.evidencias && A.ev === b.meta.impressoes.eventos, JSON.stringify([A, b.meta.impressoes]));

const notas = () => db.query(`select id, status, versao, nota::text nota, nota_calculada::text nc, zerada, eliminatorio_pendente ep from public.monitorias order by id`);
const antes = JSON.stringify((await notas()).rows);
const recalculo = () => db.query(`select m.id, m.nota::text nota, m.zerada, app.calcular_nota(v.retrato, m.canal, (select coalesce(jsonb_agg(jsonb_build_object('criterionId', r.criterio_id, 'score', r.resposta)), '[]') from public.monitoria_respostas r where r.monitoria_id = m.id and r.ativo))::text calc
  from public.monitorias m join public.regua_versoes v on v.id = m.regua_versao_id where m.status in ('Pendente', 'Validada') order by m.id`);
const calcAntes = JSON.stringify((await recalculo()).rows);

await db.exec(sql('17_relatorio_completo.sql'));
const B = await impressoes();
ok('D.2', 'o 17 não muda monitorias, respostas, evidências, histórico nem notas', ['mon', 'resp', 'evid', 'ev', 'notas'].every((k) => A[k] === B[k]), JSON.stringify([A, B]));
ok('D.3', 'o 17 não grava na auditoria', A.aud === B.aud, `${A.aud} → ${B.aud}`);
ok('D.4', 'situação, versão e nota de cada monitoria iguais', JSON.stringify((await notas()).rows) === antes);
const calcDepois = (await recalculo()).rows;
ok('D.5', `nota recalculada igual em ${calcDepois.length} monitorias enviadas`, JSON.stringify(calcDepois) === calcAntes && calcDepois.every((x) => x.zerada || Number(x.nota) === Number(x.calc)), JSON.stringify(calcDepois.filter((x) => !x.zerada && Number(x.nota) !== Number(x.calc))));
const quebras = await um(`select count(*)::int n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q`);
ok('D.6', 'auditoria sem quebras', quebras.n === 0, String(quebras.n));
const piloto = (await db.query(`select id, status, nota::text nota, relatorio_completo is null nulo from public.monitorias where id in ('MON-10024', 'MON-10025') order by id`)).rows;
ok('D.7', `piloto preservado: ${piloto.map((m) => `${m.id} ${m.status} ${m.nota}`).join(' · ')}`, piloto.length === 2 && piloto.every((m) => m.status === 'Pendente' && m.nulo) && piloto[0].nota === '90.48' && piloto[1].nota === '67.02', JSON.stringify(piloto));
const mid = (await um(`select count(*)::int n from public.monitorias where relatorio_completo is not null`)).n;
ok('D.8', 'nenhuma monitoria ganhou relatório', mid === 0);
const links = (await db.query(`select monitoria_id, conteudo::text c from public.monitoria_evidencias where lista = 'links' and monitoria_id in ('MON-10024', 'MON-10025') and ativo order by 1`)).rows;
ok('D.9', 'links do piloto preservados', links.length === 2 && links[0].c.endsWith('tBu0Pn2nTbU"') && links[1].c.endsWith('1b1L7a5Q3N0"'), JSON.stringify(links.length));

await db.exec(sql('17r_reverter_relatorio_completo.sql'));
const C = await impressoes();
ok('D.10', 'o 17r devolve o estado anterior', ['mon', 'resp', 'evid', 'ev', 'notas', 'aud'].every((k) => A[k] === C[k]), JSON.stringify([A, C]));
const original = await um(`select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) x from public.monitorias m`);
ok('D.11', 'depois do 17r, a impressão original do backup confere', original.x === b.meta.impressoes.monitorias, original.x);

const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas · ${linhasDe(b, 'public.monitorias').length} monitorias do backup`);
process.exit(falhas ? 1 : 0);
