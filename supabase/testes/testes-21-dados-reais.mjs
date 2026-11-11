// Ensaio do script 21 ("Em reavaliação") sobre uma CÓPIA do backup real, num Postgres LOCAL em memória
// (PGlite). Nada é gravado em disco, nada sai deste computador e nada toca o Supabase. A saída traz só
// códigos de monitoria, contagens e situações.
//
// Prova, com o arquivo do 21 SEM alteração: converte exatamente as cinco devolvidas aprovadas; não muda
// dados, notas, motivos, datas de envio, respostas, evidências nem histórico; não duplica devolução; a
// auditoria registra as cinco conversões; o supervisor (com a RLS) as acompanha fora da fila; para a
// monitora elas voltam a contar como feitas, fora da média; a privacidade não muda; o 21r desfaz.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-21-dados-reais.mjs <projeto> <arquivo do backup>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto, arquivo] = process.argv.slice(2);
if (!arquivo) { console.log('Informe o projeto e o arquivo do backup.'); process.exit(2); }
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { lerBackup, conferirBackup, gerarRestauracao, linhasDe } = await mod('supabase/backup/restauracao.mjs');
const { carregarDados } = await mod('src/shared/compartilhado/dados.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { getFilaDeValidacao, getDetalheDaColaboradora } = await mod('src/domain/queueService.ts');
const { entraNaFilaDeValidacao } = await mod('src/domain/validacaoService.ts');
const { countsForCarteiraGoal } = await mod('src/domain/monitoringRules.ts');
const { entraNaMedia, resumirNotas } = await mod('src/domain/resultadosService.ts');
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
process.on('uncaughtException', (e) => { console.log(`INTERROMPIDO: ${String(e.message).slice(0, 300)}`); process.exit(2); });
definirModoParaTeste(true);
const r = [];
const ok = (id, d, c, det = '') => { r.push({ ok: !!c }); console.log(`${c ? '✔' : '✖'} ${id}  ${d}${c ? '' : `  → ${det}`}`); };
const CINCO = ['MON-10001', 'MON-10028', 'MON-10030', 'MON-10031', 'MON-10034'];

const b = lerBackup(readFileSync(arquivo, 'utf8'));
ok('D.0', `backup íntegro (${b.meta.gerado_em})`, conferirBackup(b).length === 0);
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
await db.exec(`create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`);
const estrutura = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql', '12_estado_do_acesso_mfa.sql', '14_historico_calibracao.sql', '15_duplicidade_criacao.sql', '16_colaboradora_inativa.sql', '17_relatorio_completo.sql'];
for (const v of ['18', '19']) if (b.meta.versoes.includes(v)) estrutura.push(v === '18' ? '18_privacidade_monitorias.sql' : '19_concluir_liberar.sql');
for (const f of estrutura) await db.exec(sql(f));
for (const v of b.meta.versoes.filter((x) => !['09', '11a', '12a'].includes(x))) {
  await db.query(`insert into app.versoes_esquema (versao, descricao) values ($1, 'ensaio local') on conflict (versao) do nothing`, [v]);
}
const perfis = linhasDe(b, 'public.perfis');
for (const p of perfis.filter((x) => x.auth_user_id)) await db.query('insert into auth.users values ($1, $2, now()) on conflict do nothing', [p.auth_user_id, `ensaio-${p.id}@exemplo.test`]);
await db.exec("set timezone = 'UTC'");
await db.exec(gerarRestauracao(b, { responsavel: 'adm-aline-oliveira', motivo: 'Ensaio local do script 21, em memória.' }));
// A homologação já tem o 20 (o supervisor valida a partir de 2026-10). Backup anterior a ele: aplica aqui também.
const tem20 = (await db.query(`select coalesce(valor -> 'validacaoDesdePorGestor' ? 'usr-1791895673216', false) t from public.configuracoes where chave = 'settings'`)).rows[0]?.t;
if (!tem20) await db.exec(readFileSync(join(projeto, 'supabase/sql', '20_inicio_validacao_erivan.sql'), 'utf8'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
const imp = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'status' - 'versao' - 'versao_lida' - 'atualizado_em' - 'atualizado_por')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(m.id || '=' || coalesce(m.nota::text, '-') || '/' || coalesce(m.motivo_ajuste, '') || '/' || coalesce(m.enviado_em::text, '-'), '|' order by m.id), '')) from public.monitorias m) notas,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select string_agg(id || '=' || coalesce(status, '-'), ',' order by id) from public.monitorias) situacoes,
  (select string_agg(id, ',' order by id) from public.monitorias m where app.monitoria_privada(m.status, m.enviado_em, m.enviada_na_origem)) privadas,
  (select count(*) from public.monitoria_eventos where tipo = 'DEVOLUCAO')::int devolucoes,
  (select count(*) from public.auditoria)::int aud,
  (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)::int quebras`);
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const transporte = (uid) => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"aal1"}';`);
    try { const x = await fn(); await db.exec('rollback'); return x; } catch (e) { await db.exec('rollback'); throw e; }
  };
  return { selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows), chamar: async () => null, incluir: async () => {}, alterar: async () => {} };
};
const ms = linhasDe(b, 'public.monitorias');
const gestor = perfis.find((p) => p.id === 'usr-1791895673216');
const monitora = perfis.find((p) => p.id === ms.find((m) => m.id === 'MON-10028')?.monitor_id);
const visao = async (p) => {
  const d = await carregarDados(transporte(p.auth_user_id), PADROES);
  const minhas = d.monitorias.filter((m) => m.monitorId === monitora.id);
  const out = d.monitorias.filter((m) => m.competencia === '2026-10' && m.monitorId === monitora.id);
  // Vagas da meta de AGOSTO (único mês com metas por colaboradora na homologação; a MON-10001 é de
  // agosto): cada monitoria ocupa no máximo uma vaga.
  const ago = d.monitorias.filter((m) => m.competencia === '2026-08' && m.monitorId === monitora.id);
  const ctx = { monitorings: d.monitorias, goals: d.metasColaborador ?? [], collaborators: d.colaboradores ?? [] };
  const ocupadas = [...new Set(ago.map((m) => m.colaboradorId))].flatMap((c) =>
    getDetalheDaColaboradora(ctx, monitora.id, c, { year: 2026, month: 7 }).escopos.flatMap((e) => e.vagas.filter((v) => v.monitoring).map((v) => v.monitoring.id)));
  return {
    vagas: ocupadas,
    filaComInicio: getFilaDeValidacao(d.monitorias, '2026-11-11')
      .filter((f) => f.monitoring.monitorId !== p.id && entraNaFilaDeValidacao(f.monitoring, d.areas, d.settings)).map((f) => f.monitoring.id).sort().join(','),
    inicio: d.settings.validacaoDesdePorGestor?.[gestor.id] ?? null,
    visiveis: CINCO.filter((id) => d.monitorias.some((m) => m.id === id)),
    situacao: Object.fromEntries(CINCO.map((id) => [id, d.monitorias.find((m) => m.id === id)?.status ?? 'invisível'])),
    fila: getFilaDeValidacao(d.monitorias, '2026-11-11').map((f) => f.monitoring.id),
    feitasOutubro: out.filter(countsForCarteiraGoal).length,
    resumoOutubro: resumirNotas(out),
    naMedia: minhas.filter(entraNaMedia).map((m) => m.id).sort().join(','),
  };
};

ok('D.1', 'cenário: supervisor e monitora com login; as cinco são Rascunho com motivo',
  Boolean(gestor?.auth_user_id && monitora?.auth_user_id) && CINCO.every((id) => { const m = ms.find((x) => x.id === id); return m?.status === 'Rascunho' && (m.motivo_ajuste ?? '').trim(); }));
const A = await imp();
const vGA = await visao(gestor), vMA = await visao(monitora);

await db.exec(sql('21_em_reavaliacao.sql'));   // o arquivo real, sem alteração
const B = await imp();
ok('D.2', 'dados, notas, motivos, datas de envio, respostas e evidências idênticos', ['mon', 'notas', 'resp', 'evid'].every((k) => A[k] === B[k]));
ok('D.3', 'histórico idêntico: nenhuma devolução duplicada', A.ev === B.ev && A.devolucoes === B.devolucoes, `${A.devolucoes} → ${B.devolucoes}`);
ok('D.4', 'auditoria: exatamente 5 registros novos, cadeia íntegra', B.aud === A.aud + 5 && B.quebras === 0, `${A.aud} → ${B.aud}`);
const mudou = B.situacoes.split(',').filter((x, i) => x !== A.situacoes.split(',')[i]);
ok('D.5', `mudaram só as cinco: ${mudou.join(' ')}`, mudou.length === 5 && mudou.every((x) => CINCO.includes(x.split('=')[0]) && x.endsWith('=Em reavaliação')));
ok('D.6', 'privacidade: o conjunto de monitorias privadas não mudou', A.privadas === B.privadas, `${A.privadas} → ${B.privadas}`);

const vGB = await visao(gestor), vMB = await visao(monitora);
ok('D.7', 'supervisor (RLS): continua vendo as cinco, agora "Em reavaliação"', vGB.visiveis.length === 5 && Object.values(vGB.situacao).every((s) => s === 'Em reavaliação'));
ok('D.8', `fila do supervisor igual (${vGB.fila.length}); nenhuma das cinco nela`, JSON.stringify(vGA.fila) === JSON.stringify(vGB.fila) && !vGB.fila.some((id) => CINCO.includes(id)));
ok('D.9', `monitora, outubro: feitas ${vMA.feitasOutubro} → ${vMB.feitasOutubro} (as quatro de outubro voltam a contar)`, vMB.feitasOutubro === vMA.feitasOutubro + 4);
ok('D.10', `média de outubro inalterada (${vMA.resumoOutubro.media} → ${vMB.resumoOutubro.media}); em reavaliação: ${vMB.resumoOutubro.emReavaliacao}`,
  vMA.resumoOutubro.media === vMB.resumoOutubro.media && vMA.naMedia === vMB.naMedia && vMB.resumoOutubro.emReavaliacao === 4);
ok('D.10a', `configuração do supervisor preservada (início ${vGB.inicio}); fila dele igual: ${vGB.filaComInicio}`,
  vGA.inicio === '2026-10' && vGB.inicio === '2026-10' && vGA.filaComInicio === vGB.filaComInicio && !CINCO.some((id) => vGB.filaComInicio.includes(id)));
const repetidas = vMB.vagas.filter((id, i) => vMB.vagas.indexOf(id) !== i);
const reavNasVagas = vMB.vagas.filter((id) => CINCO.includes(id));
ok('D.10b', `vagas de agosto ocupadas: ${vMA.vagas.length} → ${vMB.vagas.length}; em reavaliação ocupando vaga: ${reavNasVagas.join(' ') || 'nenhuma'}; nenhuma repetida`,
  repetidas.length === 0 && reavNasVagas.length === 1 && reavNasVagas[0] === 'MON-10001' && vMB.vagas.length === vMA.vagas.length + 1 && !vMA.vagas.includes('MON-10001'));
const rep = await db.exec(sql('21_em_reavaliacao.sql')).then(() => null, (e) => e);
await db.exec('rollback').catch(() => {});
ok('D.11', 'o 21 não roda duas vezes', rep && /já instalado/.test(rep.message));

await db.exec(sql('21r_reverter_reavaliacao.sql'));
const C = await imp();
ok('D.12', 'o 21r devolve as situações e mantém dados, notas e histórico', C.situacoes === A.situacoes && ['mon', 'notas', 'resp', 'evid', 'ev', 'privadas'].every((k) => A[k] === C[k]) && C.quebras === 0);
const vMC = await visao(monitora);
ok('D.13', 'depois do 21r, a contagem da monitora volta a ser a de antes', vMC.feitasOutubro === vMA.feitasOutubro);

const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas · ${ms.length} monitorias do backup`);
process.exit(falhas ? 1 : 0);
