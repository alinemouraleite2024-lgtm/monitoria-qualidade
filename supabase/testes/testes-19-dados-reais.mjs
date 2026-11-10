// Ensaio do script 19 sobre uma CÓPIA do backup real, num Postgres LOCAL em memória (PGlite). Nada é
// gravado em disco, nada sai deste computador e nada toca o Supabase. A saída traz só contagens,
// impressões e códigos, sem conteúdo. As operações do ensaio usam só a cópia em memória.
//
// Prova: instalar não muda nenhum registro; toda nota continua igual; a privacidade do 18 segue igual;
// guardar e enviar funcionam sobre um rascunho real da cópia sem tocar nas demais monitorias; o backup
// e a restauração levam as colunas novas; o 19r devolve o estado anterior.
//
// Uso: node testes-19-dados-reais.mjs <projeto> <arquivo do backup>
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
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql', '12_estado_do_acesso_mfa.sql', '14_historico_calibracao.sql', '15_duplicidade_criacao.sql', '16_colaboradora_inativa.sql', '17_relatorio_completo.sql', ...(b.meta.versoes.includes('18') ? ['18_privacidade_monitorias.sql'] : [])]) {
  await db.exec(sql(f));
}
const instalarVersoes = async (backup) => {
  for (const v of backup.meta.versoes.filter((x) => !['09', '11a', '12a'].includes(x))) {
    await db.query(`insert into app.versoes_esquema (versao, descricao) values ($1, 'ensaio local') on conflict (versao) do nothing`, [v]);
  }
};
await instalarVersoes(b);
const perfis = linhasDe(b, 'public.perfis');
for (const p of perfis.filter((x) => x.auth_user_id)) {
  await db.query('insert into auth.users values ($1, $2, now()) on conflict do nothing', [p.auth_user_id, `ensaio-${p.id}@exemplo.test`]);
}
await db.exec("set timezone = 'UTC'");
await db.exec(gerarRestauracao(b, { responsavel: 'adm-aline-oliveira', motivo: 'Ensaio local do script 19, em memória.' }));
if (!b.meta.versoes.includes('18')) await db.exec(sql('18_privacidade_monitorias.sql'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const SEM = `- 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em'`;
const impressoes = (filtro = 'true') => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) ${SEM})::text, '|' order by m.id), '')) from public.monitorias m where ${filtro}) mon,
  (select md5(coalesce(string_agg(m.id || '=' || (to_jsonb(m) ->> 'relatorio_completo'), '|' order by m.id), '')) from public.monitorias m where ${filtro}) rel,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x join public.monitorias m on m.id = x.monitoria_id where ${filtro}) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e join public.monitorias m on m.id = e.monitoria_id where ${filtro}) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e join public.monitorias m on m.id = e.monitoria_id where ${filtro}) ev,
  (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(nota_calculada::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias m where ${filtro}) notas,
  (select count(*) from public.auditoria)::int aud,
  (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)::int quebras`);
const A = await impressoes();
const I = b.meta.impressoes;
ok('D.1', 'restaurado: impressões iguais às registradas no backup', A.mon === I.monitorias && A.rel === I.relatorios && A.resp === I.respostas && A.evid === I.evidencias && A.ev === I.eventos, JSON.stringify([A, I]));

const conferencia = async () => Object.fromEntries((await db.query(sql('conferencia-19.sql'))).rows.map((l) => [l.item.split(' ')[0], l.resultado]));
const confAntes = await conferencia();
const recalculo = () => db.query(`select m.id, m.nota::text nota, m.zerada, app.calcular_nota(v.retrato, m.canal, (select coalesce(jsonb_agg(jsonb_build_object('criterionId', r.criterio_id, 'score', r.resposta)), '[]') from public.monitoria_respostas r where r.monitoria_id = m.id and r.ativo))::text calc
  from public.monitorias m join public.regua_versoes v on v.id = m.regua_versao_id where m.status in ('Pendente', 'Validada') order by m.id`);
const calcAntes = JSON.stringify((await recalculo()).rows);
const como = async (uid, aal, fn) => {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
  try { const x = await fn(); await db.exec('commit'); return x; } catch (e) { await db.exec('rollback'); throw e; }
};
const area = linhasDe(b, 'public.areas').find((a) => a.ativo);
const gestor = perfis.find((p) => p.id === area.gestor_id);
const monitora = perfis.find((p) => (p.perfis ?? []).includes('MONITOR') && p.auth_user_id);
const visaoSup = () => como(gestor.auth_user_id, 'aal1', async () => (await db.query('select id from public.monitorias order by id')).rows.map((l) => l.id));
const supAntes = await visaoSup();

await db.exec(sql('19_concluir_liberar.sql'));
const B = await impressoes();
ok('D.2', 'o 19 não muda monitorias, relatórios, respostas, evidências, histórico nem notas', ['mon', 'rel', 'resp', 'evid', 'ev', 'notas'].every((k) => A[k] === B[k]), JSON.stringify([A, B]));
ok('D.3', 'o 19 não grava na auditoria; cadeia sem quebras', A.aud === B.aud && B.quebras === 0, `${A.aud} → ${B.aud}, quebras ${B.quebras}`);
ok('D.4', 'nenhuma monitoria ganhou marca ou data de conclusão', Number((await um('select count(*) n from public.monitorias where aguardando_liberacao or concluida_em is not null')).n) === 0);
ok('D.5', `nota recalculada igual em ${(await recalculo()).rows.length} monitorias enviadas`, JSON.stringify((await recalculo()).rows) === calcAntes);
const confDepois = await conferencia();
const mudou = Object.keys(confAntes).filter((k) => confAntes[k] !== confDepois[k]);
ok('D.6', `conferência: só mudam os itens 1 e 16 (mudaram: ${mudou.join(', ')})`, JSON.stringify(mudou.sort()) === JSON.stringify(['1', '16'].sort()), JSON.stringify(mudou));
ok('D.7', 'o supervisor vê exatamente o mesmo que antes do 19', JSON.stringify(await visaoSup()) === JSON.stringify(supAntes));

// Guardar e enviar sobre um rascunho real, na cópia em memória.
const hoje = (await um('select app.hoje()::text d')).d;
const alvo = (await um(`select m.id, m.versao from public.monitorias m where m.status = 'Rascunho' and m.enviado_em is null and coalesce(m.enviada_na_origem, false) = false and m.monitor_id = $1 and m.id = 'MON-10026'`, [monitora.id]));
ok('D.8', 'cenário: rascunho privado de teste presente na cópia', Boolean(alvo), 'MON-10026');
const respostas = (await db.query(`select criterio_id, resposta, justificativa, sub_respostas from public.monitoria_respostas where monitoria_id = $1 and ativo order by ordem`, [alvo.id])).rows;
const row = await um('select * from public.monitorias where id = $1', [alvo.id]);
const dados = { id: alvo.id, colaboradorId: row.colaborador_id, categoriaAtendimento: row.categoria_atendimento, numeroAtendimento: row.numero_atendimento, numeroTitulo: row.numero_titulo, canal: row.canal,
  date: row.data, competencia: row.competencia, inicioAtendimento: row.inicio_atendimento, fimAtendimento: row.fim_atendimento, duracaoMinutos: Number(row.duracao_minutos), tipo: row.tipo,
  comments: row.comentarios, relatorioCompleto: row.relatorio_completo, guardar: true,
  scores: respostas.map((x) => ({ criterionId: x.criterio_id, score: x.resposta, lowScoreReason: x.justificativa ?? '', subRespostas: x.sub_respostas })) };
const outras = () => impressoes(`m.id <> '${alvo.id}'`);
const antesOutras = await outras();
const res = await como(monitora.auth_user_id, 'aal1', async () => (await db.query('select api.salvar_monitoria($1::jsonb, $2::integer, false) r', [JSON.stringify(dados), alvo.versao])).rows[0].r);
const g = await um('select * from public.monitorias where id = $1', [alvo.id]);
ok('D.9', `guardar sobre rascunho real: nota ${g.nota}, marcada`, g.aguardando_liberacao === true && g.status === 'Rascunho' && g.nota !== null && g.enviado_em === null, JSON.stringify(res).slice(0, 200));
ok('D.10', 'a guardada segue fora do alcance do supervisor', !(await visaoSup()).includes(alvo.id));
const gv = await impressoes(`m.id <> '${alvo.id}'`);
ok('D.11', 'guardar não tocou em nenhuma outra monitoria', ['mon', 'rel', 'resp', 'evid', 'ev', 'notas'].every((k) => antesOutras[k] === gv[k]));

// Backup e restauração com as colunas novas.
const novo = (await db.query(sql('backup-completo.sql'))).rows[0].backup;
const b2 = lerBackup(JSON.stringify(novo));
ok('D.12', 'o backup com o 19 fica íntegro e leva a guardada', conferirBackup(b2).length === 0 && linhasDe(b2, 'public.monitorias').find((m) => m.id === alvo.id)?.aguardando_liberacao === true, conferirBackup(b2).join('; '));
await db.exec(gerarRestauracao(b2, { responsavel: 'adm-aline-oliveira', motivo: 'Ensaio local do script 19, em memória.' }));
ok('D.13', 'a restauração com o 19 devolve a guardada', (await um('select aguardando_liberacao a from public.monitorias where id = $1', [alvo.id])).a === true);

const rel = await como(monitora.auth_user_id, 'aal1', async () => (await db.query('select api.liberar_monitorias($1::jsonb) r', [JSON.stringify([{ id: alvo.id, versao: (await um('select versao from public.monitorias where id = $1', [alvo.id])).versao }])])).rows[0].r).catch((e) => ({ erro: e.message }));
const l = await um('select * from public.monitorias where id = $1', [alvo.id]);
const iniciada = row.competencia <= hoje.slice(0, 7);
ok('D.14', 'enviar sobre rascunho real: fica visível ao supervisor', iniciada && l.status === 'Pendente' && l.aguardando_liberacao === false && (await visaoSup()).includes(alvo.id), JSON.stringify(rel).slice(0, 240));
const dv = await impressoes(`m.id <> '${alvo.id}'`);
ok('D.15', 'enviar não tocou em nenhuma outra monitoria; auditoria íntegra', ['mon', 'rel', 'resp', 'evid', 'ev', 'notas'].every((k) => antesOutras[k] === dv[k]) && dv.quebras === 0);

const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas · ${linhasDe(b, 'public.monitorias').length} monitorias do backup`);
process.exit(falhas ? 1 : 0);
