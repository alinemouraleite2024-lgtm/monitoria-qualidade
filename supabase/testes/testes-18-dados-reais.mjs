// Ensaio do script 18 sobre uma CÓPIA do backup real, num Postgres LOCAL em memória (PGlite). Nada é
// gravado em disco, nada sai deste computador e nada toca o Supabase. A saída traz só contagens,
// impressões e os códigos das monitorias, sem conteúdo.
//
// Prova: o conjunto que fica privado é exatamente o esperado pela regra; toda monitoria enviada segue
// visível ao supervisor, com as mesmas respostas, evidências e histórico; a monitora e o Administrador
// não perdem nada; nada é gravado; o 18r devolve o estado anterior.
//
// Uso: node testes-18-dados-reais.mjs <projeto> <arquivo do backup>
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
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql', '12_estado_do_acesso_mfa.sql', '14_historico_calibracao.sql', '15_duplicidade_criacao.sql', '16_colaboradora_inativa.sql', '17_relatorio_completo.sql']) {
  await db.exec(sql(f));
}
const SO_DADOS = ['09', '11a', '12a'];
for (const v of b.meta.versoes.filter((x) => !SO_DADOS.includes(x))) {
  await db.query(`insert into app.versoes_esquema (versao, descricao) values ($1, 'ensaio local') on conflict (versao) do nothing`, [v]);
}
const perfis = linhasDe(b, 'public.perfis');
for (const p of perfis.filter((x) => x.auth_user_id)) {
  await db.query('insert into auth.users values ($1, $2, now()) on conflict do nothing', [p.auth_user_id, `ensaio-${p.id}@exemplo.test`]);
}
await db.exec("set timezone = 'UTC'");
await db.exec(gerarRestauracao(b, { responsavel: 'adm-aline-oliveira', motivo: 'Ensaio local do script 18, em memória.' }));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const impressoes = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(m.id || '=' || (to_jsonb(m) ->> 'relatorio_completo'), '|' order by m.id), '')) from public.monitorias m) rel,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(nota_calculada::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias) notas,
  (select count(*) from public.auditoria)::int aud,
  (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)::int quebras`);
const A = await impressoes();
const I = b.meta.impressoes;
ok('D.1', 'restaurado: impressões iguais às registradas no backup', A.mon === I.monitorias && A.rel === I.relatorios && A.resp === I.respostas && A.evid === I.evidencias && A.ev === I.eventos, JSON.stringify([A, I]));

const conferencia = async () => Object.fromEntries((await db.query(sql('conferencia-18.sql'))).rows.map((l) => [l.item.split(' ')[0], l.resultado]));
const confAntes = await conferencia();

const como = async (uid, aal, fn) => {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
  try { const x = await fn(); await db.exec('rollback'); return x; } catch (e) { await db.exec('rollback'); throw e; }
};
const area = linhasDe(b, 'public.areas').find((a) => a.ativo);
const gestor = perfis.find((p) => p.id === area.gestor_id);
const monitora = perfis.find((p) => (p.perfis ?? []).includes('MONITOR') && p.auth_user_id);
const admin = perfis.find((p) => (p.perfis ?? []).includes('ADMIN') && p.auth_user_id);
ok('D.2', 'cenário: supervisor da área, monitora e Administrador com login', Boolean(gestor?.auth_user_id && monitora && admin));

const contagens = async (uid, aal) => como(uid, aal, async () => {
  const col = async (q) => (await db.query(q)).rows;
  return {
    mon: (await col('select id from public.monitorias order by id')).map((l) => l.id),
    resp: await col('select monitoria_id id, count(*)::int n from public.monitoria_respostas group by 1 order by 1'),
    evid: await col('select monitoria_id id, count(*)::int n from public.monitoria_evidencias group by 1 order by 1'),
    ev: await col('select monitoria_id id, count(*)::int n from public.monitoria_eventos group by 1 order by 1'),
  };
});
const supAntes = await contagens(gestor.auth_user_id, 'aal1');
const monAntes = await contagens(monitora.auth_user_id, 'aal1');
const admAntes = await contagens(admin.auth_user_id, 'aal2');

const todas = linhasDe(b, 'public.monitorias');
const privada = (m) => ['Rascunho', 'Cancelada', null, undefined].includes(m.status) && !m.enviado_em && !m.enviada_na_origem;
const esperadas = todas.filter(privada).map((m) => m.id).sort();
const eventos = linhasDe(b, 'public.monitoria_eventos');
const comEnvio = esperadas.filter((id) => eventos.some((e) => e.monitoria_id === id && ['ENVIO', 'REENVIO'].includes(e.tipo)));
ok('D.3', 'nenhuma futura privada tem envio no histórico', comEnvio.length === 0, comEnvio.join(', '));

await db.exec(sql('18_privacidade_monitorias.sql'));
const B = await impressoes();
ok('D.4', 'o 18 não muda monitorias, relatórios, respostas, evidências, histórico nem notas', ['mon', 'rel', 'resp', 'evid', 'ev', 'notas'].every((k) => A[k] === B[k]), JSON.stringify([A, B]));
ok('D.5', 'o 18 não grava na auditoria; cadeia sem quebras', A.aud === B.aud && B.quebras === 0, `${A.aud} → ${B.aud}, quebras ${B.quebras}`);

const sup = await contagens(gestor.auth_user_id, 'aal1');
const ocultas = supAntes.mon.filter((id) => !sup.mon.includes(id)).sort();
const iguaisA = (x, y) => JSON.stringify(x) === JSON.stringify(y);
ok('D.6', `ficam privadas exatamente: ${ocultas.join(', ')}`, iguaisA(ocultas, esperadas.filter((id) => supAntes.mon.includes(id))), JSON.stringify([ocultas, esperadas]));
const enviadas = todas.filter((m) => !privada(m)).map((m) => m.id);
ok('D.7', `todas as ${enviadas.length} monitorias já enviadas seguem visíveis ao supervisor`, enviadas.filter((id) => supAntes.mon.includes(id)).every((id) => sup.mon.includes(id)) && sup.mon.length === supAntes.mon.length - ocultas.length);
for (const [k, nome] of [['resp', 'respostas'], ['evid', 'evidências'], ['ev', 'histórico']]) {
  const semOcultas = (l) => l.filter((x) => !ocultas.includes(x.id));
  ok(`D.8.${k}`, `${nome} das enviadas iguais ao que o supervisor via`, iguaisA(sup[k], semOcultas(supAntes[k])) && sup[k].every((x) => !ocultas.includes(x.id)));
}
ok('D.9', 'a monitora não perde nada', iguaisA(await contagens(monitora.auth_user_id, 'aal1'), monAntes));
ok('D.10', 'o Administrador não perde nada', iguaisA(await contagens(admin.auth_user_id, 'aal2'), admAntes));
const piloto = await como(gestor.auth_user_id, 'aal1', async () => (await db.query(`select id, status, nota::text nota from public.monitorias where id in ('MON-10024', 'MON-10025') order by id`)).rows);
ok('D.11', `piloto preservado: ${piloto.map((m) => `${m.id} ${m.status} ${m.nota}`).join(' · ')}`, piloto.length === 2 && piloto.every((m) => m.status === 'Pendente') && piloto[0].nota === '90.48' && piloto[1].nota === '67.02', JSON.stringify(piloto));

const confDepois = await conferencia();
const mudou = Object.keys(confAntes).filter((k) => confAntes[k] !== confDepois[k]);
ok('D.12', `conferência: só mudam os itens 1 e 15 (mudaram: ${mudou.join(', ')})`, iguaisA(mudou.sort(), ['1', '15'].sort()), JSON.stringify(mudou));
ok('D.13', 'conferência acusa as mesmas privadas e nenhuma com envio', confDepois['3'].endsWith(esperadas.join(', ')) && confDepois['14'] === '0' && confDepois['16'] === '0' && confDepois['17'] === '0', JSON.stringify([confDepois['3'], confDepois['14'], confDepois['16'], confDepois['17']]));

await db.exec(sql('18r_reverter_privacidade.sql'));
const C = await impressoes();
ok('D.14', 'o 18r devolve o estado anterior', ['mon', 'rel', 'resp', 'evid', 'ev', 'notas', 'aud'].every((k) => A[k] === C[k]) && C.quebras === 0, JSON.stringify([A, C]));
ok('D.15', 'depois do 18r o supervisor vê o mesmo que antes', iguaisA(await contagens(gestor.auth_user_id, 'aal1'), supAntes));

const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas · ${todas.length} monitorias do backup`);
process.exit(falhas ? 1 : 0);
