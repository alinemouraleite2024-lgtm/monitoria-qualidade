// Ensaio do script 20 (competência inicial de validação do Erivan) sobre uma CÓPIA do backup real, num
// Postgres LOCAL em memória (PGlite). Nada é gravado em disco, nada sai deste computador e nada toca o
// Supabase. A saída traz só contagens e códigos.
//
// Prova: o 20 grava só a configuração; nenhuma monitoria, resposta, evidência, histórico ou nota muda;
// lida pelo próprio supervisor (com a RLS), a configuração tira da fila só o que é anterior a outubro;
// o 20 não roda duas vezes; o 20r devolve a configuração e a fila como eram.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-20-dados-reais.mjs <projeto> <arquivo do backup>
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
const { getFilaDeValidacao } = await mod('src/domain/queueService.ts');
const { entraNaFilaDeValidacao, foraDaFilaDeValidacao } = await mod('src/domain/validacaoService.ts');
const { getEquipeDoGestor } = await mod('src/domain/scopeService.ts');
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
process.on('uncaughtException', (e) => { console.log(`INTERROMPIDO: ${String(e.message).slice(0, 300)}`); process.exit(2); });
definirModoParaTeste(true);
const r = [];
const ok = (id, d, c, det = '') => { r.push({ ok: !!c }); console.log(`${c ? '✔' : '✖'} ${id}  ${d}${c ? '' : `  → ${det}`}`); };

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
await db.exec(gerarRestauracao(b, { responsavel: 'adm-aline-oliveira', motivo: 'Ensaio local do script 20, em memória.' }));

const um = async (q) => (await db.query(q)).rows[0];
const impressoes = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias) notas,
  (select valor::text from public.configuracoes where chave = 'settings') cfg,
  (select count(*) from public.auditoria)::int aud,
  (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)::int quebras`);
const gestor = perfis.find((p) => p.id === 'usr-1791895673216');
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const transporte = (uid) => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"aal1"}';`);
    try { const x = await fn(); await db.exec('rollback'); return x; } catch (e) { await db.exec('rollback'); throw e; }
  };
  return { selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows), chamar: async () => null, incluir: async () => {}, alterar: async () => {} };
};
const filaDoErivan = async () => {
  const d = await carregarDados(transporte(gestor.auth_user_id), PADROES);
  const u = d.usuarios.find((x) => x.id === gestor.id);
  const equipe = getEquipeDoGestor(u, d.areas, 'GESTOR');
  const daEquipe = (m) => (equipe === null || equipe.includes(m.monitorId)) && m.monitorId !== gestor.id;
  return {
    fila: getFilaDeValidacao(d.monitorias, '2026-11-11').filter((f) => daEquipe(f.monitoring) && entraNaFilaDeValidacao(f.monitoring, d.areas, d.settings)).map((f) => f.monitoring.id).sort(),
    fora: d.monitorias.filter((m) => daEquipe(m) && foraDaFilaDeValidacao(m, d.areas, d.settings)).map((m) => m.id).sort(),
    pendentesVisiveis: d.monitorias.filter((m) => m.status === 'Pendente').length,
    inicio: d.settings.validacaoDesdePorGestor?.[gestor.id] ?? null,
  };
};

ok('D.1', 'cenário: perfil do Erivan com login e área ativa', Boolean(gestor?.auth_user_id));
const A = await impressoes();
const filaAntes = await filaDoErivan();
ok('D.2', `antes: fila com ${filaAntes.fila.length}, nenhuma fora`, filaAntes.fora.length === 0 && filaAntes.inicio === null);

await db.exec(sql('20_inicio_validacao_erivan.sql'));
const B = await impressoes();
ok('D.3', 'o 20 não muda monitorias, respostas, evidências, histórico nem notas', ['mon', 'resp', 'evid', 'ev', 'notas'].every((k) => A[k] === B[k]));
ok('D.4', 'o 20 muda só a configuração, com registro na auditoria e cadeia íntegra', A.cfg !== B.cfg && B.aud === A.aud + 1 && B.quebras === 0, `${A.aud} → ${B.aud}`);
const cfgA = JSON.parse(A.cfg), cfgB = JSON.parse(B.cfg);
const { validacaoDesdePorGestor: novo, ...restoB } = cfgB;
ok('D.5', 'o restante da configuração ficou igual', JSON.stringify(restoB) === JSON.stringify(cfgA) && novo?.[gestor.id] === '2026-10');
const filaDepois = await filaDoErivan();
const comp = Object.fromEntries(linhasDe(b, 'public.monitorias').map((m) => [m.id, m.competencia]));
ok('D.6', `lida pelo próprio supervisor: fila ${filaDepois.fila.join(' ')}`, filaDepois.inicio === '2026-10' && filaDepois.fila.every((id) => comp[id] >= '2026-10'));
ok('D.7', `fora da fila: ${filaDepois.fora.length} (${filaDepois.fora.join(' ')})`, filaDepois.fora.every((id) => comp[id] < '2026-10') && filaDepois.fila.length + filaDepois.fora.length === filaAntes.fila.length);
ok('D.8', 'as pendentes continuam visíveis a ele (Relatórios) e Pendentes no banco', filaDepois.pendentesVisiveis === filaAntes.pendentesVisiveis);
ok('D.9', 'MON-10024 e MON-10025 fora da fila, mas acessíveis', ['MON-10024', 'MON-10025'].every((id) => filaDepois.fora.includes(id)));
const rep = await db.exec(sql('20_inicio_validacao_erivan.sql')).then(() => null, (e) => e);
await db.exec('rollback').catch(() => {});
ok('D.10', 'o 20 não roda duas vezes', rep && /já está configurada/.test(rep.message));

await db.exec(sql('20r_reverter_inicio_validacao_erivan.sql'));
const C = await impressoes();
ok('D.11', 'o 20r devolve a configuração exatamente como era', C.cfg === A.cfg && ['mon', 'resp', 'evid', 'ev', 'notas'].every((k) => A[k] === C[k]) && C.quebras === 0);
const filaFinal = await filaDoErivan();
ok('D.12', 'depois do 20r, a fila volta a ser a de antes', JSON.stringify(filaFinal) === JSON.stringify(filaAntes));

const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas · ${linhasDe(b, 'public.monitorias').length} monitorias do backup`);
process.exit(falhas ? 1 : 0);
