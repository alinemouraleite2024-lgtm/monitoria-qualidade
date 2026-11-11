// Testes do script 21 (situação "Em reavaliação") num Postgres LOCAL (PGlite), com a migração REAL
// ensaiada (09b), os scripts até o 19 e a camada de dados do PORTAL. Nada sai deste computador.
// Monitorias de teste FICTÍCIAS.
//
// Prova: o 21 recusa se as devolvidas não forem as cinco aprovadas; converte sem mudar dados, notas,
// respostas, evidências nem histórico e sem devolução duplicada; devolver grava Em reavaliação; a
// monitora ajusta e reenvia (histórico ENVIO, DEVOLUCAO, REENVIO); o supervisor acompanha sem
// fila; não volta à área privada; só o Administrador cancela; o 21r reverte tudo.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-21-reavaliacao.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, liberarMonitorias, devolverMonitoria, validarMonitoria, cancelarMonitoria, confirmarZeramento } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { countsTowardGoal } = await mod('src/domain/monitoringRules.ts');
const { entraNaMedia } = await mod('src/domain/resultadosService.ts');
const { getFilaDeValidacao } = await mod('src/domain/queueService.ts');
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const man = JSON.parse(readFileSync(join(projeto, 'supabase/migracao/saida/manifesto.json'), 'utf8'));
const DECL = man.responsavel.declarado;
// Nenhum e-mail real escrito aqui: os logins de teste usam o e-mail que o próprio banco de teste já tem
// no perfil (vindo da migração local, git-ignorada, e do script 12a). O vínculo login → perfil é pelo e-mail.
const ADM = 'adm-aline-oliveira';
const emailDoPerfil = async (id) => (await db.query('select email from public.perfis where id = $1', [id])).rows[0]?.email;
const STUB_MFA = `create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`;

const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });
const relatorio = () => { for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };
definirModoParaTeste(true);

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP); await db.exec(STUB_MFA);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql']) await db.exec(sql(f));
await db.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
await db.exec(sql('10_p1_reprovar_m1.sql'));
await db.exec('begin'); await db.exec(`set local app.responsavel = '${DECL}'`);
await db.query('insert into auth.users values ($1, $2, now()), ($3, $4, now())', [U(1), await emailDoPerfil('usr-1'), U(2), await emailDoPerfil('usr-1791895673216')]);
await db.exec('commit');
await db.exec(sql('12_estado_do_acesso_mfa.sql'));
await db.exec(sql('12a_admin_aline_oliveira.sql'));
await db.exec('begin'); await db.exec(`set local app.responsavel = '${ADM}'`);
await db.query('insert into auth.users values ($1, $2, now())', [U(9), await emailDoPerfil(ADM)]);
await db.exec('commit');
await db.exec(sql('11a_colaborador_teste_homologacao.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}';
  insert into public.perfis (id, email, nome, perfis, status) values ('usr-teste-monitora-2', 'monitora2@exemplo.test', 'MONITORA FICTÍCIA 2', array['MONITOR'], 'ACTIVE');
  insert into auth.users values ('${U(3)}', 'monitora2@exemplo.test', now()); commit;`);
for (const f of ['14_historico_calibracao.sql', '15_duplicidade_criacao.sql', '16_colaboradora_inativa.sql', '17_relatorio_completo.sql', '18_privacidade_monitorias.sql']) await db.exec(sql(f));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
const quebras = () => n('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q');

const TIPOS = { p_dados: '::jsonb', p_itens: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text', p_consideracoes: '::text', p_texto: '::text', p_chave: '::uuid', p_original: '::text' };
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
const transporte = (uid, aal = 'aal1') => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
    try { const x = await fn(); await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  return {
    selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: (f, args) => como(async () => { const ks = Object.keys(args);
      return normalizar((await db.query(`select api.${f}(${ks.map((k, i) => `${k} => $${i + 1}${TIPOS[k]}`).join(', ')}) r`, ks.map((k) => (['p_dados', 'p_itens'].includes(k) ? JSON.stringify(args[k]) : args[k])))).rows[0].r); }),
    incluir: () => { throw new Error('não usado'); },
    sql: (q, p) => como(async () => (await db.query(q, p)).rows),
  };
};
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const MONITORA = transporte(U(1)), SUPERVISOR = transporte(U(2)), OUTRA = transporte(U(3)), ADMIN = transporte(U(9), 'aal2');
const HOJE = (await um('select app.hoje()::text d')).d;
const COMP = HOJE.slice(0, 7);
const somaMes = (c, k) => { const [a, m] = c.split('-').map(Number); const x = a * 12 + m - 1 + k; return `${Math.floor(x / 12)}-${String(x % 12 + 1).padStart(2, '0')}`; };
const COL = 'col-teste-homolog-1';

const dA = await carregarDados(MONITORA, PADROES);
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const GAB = (v = {}) => aplic.map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  if (v[c.id] !== undefined) return { criterionId: c.id, score: v[c.id], lowScoreReason: 'TESTE: resposta diferente (fictício).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
let minuto = 0;
const base = (p = {}, v = {}) => { minuto += 7; const h = String(6 + Math.floor(minuto / 60)).padStart(2, '0'), m = String(minuto % 60).padStart(2, '0'); const scores = GAB(v);
  return { id: '', competencia: COMP, date: `${HOJE}T12:00:00Z`, colaboradorId: COL, canal: 'Telefone', tipo: 'Regular', categoriaAtendimento: 'BOLETOS',
    numeroAtendimento: `FICT-${minuto}`, numeroTitulo: 'FICT', inicioAtendimento: `${HOJE}T${h}:${m}`, fimAtendimento: `${HOJE}T${h}:${m}`, duracaoMinutos: 1,
    comments: 'MONITORIA FICTÍCIA — TESTE DO SCRIPT 21 (LOCAL).', status: 'Rascunho', finalScore: prev(scores), scores, evidencias: [{ name: 'ficticia.pdf', type: 'PDF', size: '1 KB' }], links: [], relatorioCompleto: '<p>Relatório fictício.</p>', ...p }; };
const rascunho = (p, v) => salvarMonitoria(MONITORA, base(p, v), dA.criterios, false, false);
const guardar = (p, v) => salvarMonitoria(MONITORA, base(p, v), dA.criterios, false, false, true);
const enviar = (p, v) => salvarMonitoria(MONITORA, base({ status: 'Pendente', ...p }, v), dA.criterios, false, true);
const doBanco = async (quem, id) => (await carregarDados(quem, PADROES)).monitorias.find((m) => m.id === id);
const linha = (id) => um('select * from public.monitorias where id = $1', [id]);
const nEventos = (id, tipo) => n('select count(*) n from public.monitoria_eventos where monitoria_id = $1 and tipo = $2', [id, tipo]);
const liberar = async (ids, quem = MONITORA) => { const d = await carregarDados(quem, PADROES); return liberarMonitorias(quem, ids.map((id) => d.monitorias.find((m) => m.id === id) ?? { id, versao: 1 })); };
const impressoes = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(m.id || '=' || (to_jsonb(m) ->> 'relatorio_completo'), '|' order by m.id), '')) from public.monitorias m) rel,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select count(*) from public.auditoria)::int aud`);
const definicoes = () => um(`select pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure) f`);
const msg = (x) => (x.erro ? `${x.erro.codigo}|${x.erro.message}` : 'SEM ERRO');

await db.exec(sql('19_concluir_liberar.sql'));

const { countsTowardGoal: contaComoFeita } = await mod('src/domain/monitoringRules.ts');
const s21 = sql('21_em_reavaliacao.sql');
const LISTA_REAL = "array['MON-10001', 'MON-10028', 'MON-10030', 'MON-10031', 'MON-10034']";
const funcoes = () => um(`select pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure) s,
  pg_get_functiondef('api.devolver_monitoria(text, integer, text)'::regprocedure) d,
  pg_get_functiondef('app.tg_monitoria_eventos()'::regprocedure) g,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'monitorias_status_valido') c`);
const imp21 = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'status' - 'versao' - 'versao_lida' - 'atualizado_em' - 'atualizado_por')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(m.id || '=' || coalesce(m.nota::text, '-') || '/' || coalesce(m.motivo_ajuste, '') || '/' || coalesce(m.enviado_em::text, '-'), '|' order by m.id), '')) from public.monitorias m) notas,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select count(*) from public.auditoria)::int aud`);
const status = async (id) => (await linha(id)).status;

// ---- cenário: cinco devolvidas FICTÍCIAS antes do 21 (Rascunho + motivo + evento) ---------------
const DEV = [];
for (let i = 0; i < 5; i += 1) {
  const x = await enviar();
  await devolverMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, x.id), `Ajustar o critério ${i + 1} (fictício).`);
  DEV.push(x.id);
}
DEV.sort();
const ok0 = (await Promise.all(DEV.map(status))).every((s) => s === 'Rascunho');
ok('A.0', 'cenário: cinco devolvidas fictícias como Rascunho com motivo e evento DEVOLUCAO', ok0 && (await n(`select count(*) n from public.monitoria_eventos where tipo = 'DEVOLUCAO'`)) === 5);
const Pd = await enviar();   // uma Pendente comum, que não pode mudar
const funcAntes = await funcoes();
const antes = await imp21();

// O script real exige as cinco monitorias aprovadas da homologação: aqui ele precisa recusar.
const recReal = await tenta(() => db.exec(s21));
await db.exec('rollback').catch(() => {});
const aposRec = await imp21();
ok('A.1', 'o 21 real recusa quando as devolvidas não são as cinco aprovadas, sem gravar nada',
  recReal.erro && /diferem das cinco aprovadas/.test(recReal.erro.message) && JSON.stringify(aposRec) === JSON.stringify(antes), recReal.erro?.message);
ok('A.2', 'a recusa não deixa função nem situação nova', JSON.stringify(await funcoes()) === JSON.stringify(funcAntes));

// Mesmo script, com a lista trocada pelas cinco fictícias (único texto alterado).
const s21teste = s21.replace(LISTA_REAL, `array[${DEV.map((x) => `'${x}'`).join(', ')}]`);
ok('A.3', 'a versão de teste difere do script real só na lista', s21teste !== s21 && s21teste.length === s21.length + (DEV.join('').length - 45));
await db.exec(s21teste);
const depois = await imp21();
ok('A.4', 'conversão preserva dados, notas, motivo, data de envio, respostas e evidências',
  ['mon', 'notas', 'resp', 'evid'].every((k) => antes[k] === depois[k]), JSON.stringify([antes, depois]));
ok('A.5', 'conversão não grava evento (nenhuma devolução duplicada)', antes.ev === depois.ev && await n(`select count(*) n from public.monitoria_eventos where tipo = 'DEVOLUCAO'`) === 5);
ok('A.6', 'a auditoria registra exatamente as cinco conversões, cadeia íntegra', depois.aud === antes.aud + 5 && await quebras() === 0, `${antes.aud} → ${depois.aud}`);
ok('A.7', 'as cinco ficam "Em reavaliação"; a Pendente comum não muda',
  (await Promise.all(DEV.map(status))).every((s) => s === 'Em reavaliação') && await status(Pd.id) === 'Pendente');
const rep21 = await tenta(() => db.exec(s21teste));
await db.exec('rollback').catch(() => {});
ok('A.8', 'o 21 não instala duas vezes', rep21.erro && /já instalado/.test(rep21.erro.message));

// ---- supervisor e monitora pelo portal ------------------------------------------------------------
const dE = await carregarDados(SUPERVISOR, PADROES);
const dAl = await carregarDados(MONITORA, PADROES);
ok('B.1', 'o supervisor vê as em reavaliação (não são privadas)', DEV.every((id) => dE.monitorias.some((m) => m.id === id && m.status === 'Em reavaliação')));
ok('B.2', 'fila do supervisor: fora (só Pendente)', getFilaDeValidacao(dE.monitorias, HOJE).every((f) => !DEV.includes(f.monitoring.id))
  && getFilaDeValidacao(dE.monitorias, HOJE).some((f) => f.monitoring.id === Pd.id));
const mDev = dAl.monitorias.find((m) => m.id === DEV[0]);
ok('B.3', 'para a monitora: conta como feita, fora da média, com o motivo visível',
  contaComoFeita(mDev) && !entraNaMedia(mDev) && mDev.adjustmentReason === 'Ajustar o critério 1 (fictício).');

// devolução depois do 21
const Nv = await enviar();
await devolverMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, Nv.id), 'Revisar a abordagem (fictício).');
const nv = await linha(Nv.id);
ok('C.1', 'devolver agora grava "Em reavaliação", com motivo, responsável e data', nv.status === 'Em reavaliação' && nv.motivo_ajuste === 'Revisar a abordagem (fictício).' && nv.revisado_em && nv.enviado_em);
ok('C.2', 'e grava um único evento DEVOLUCAO com o motivo', await nEventos(Nv.id, 'DEVOLUCAO') === 1
  && (await um(`select consideracoes c from public.monitoria_eventos where monitoria_id = $1 and tipo = 'DEVOLUCAO'`, [Nv.id])).c === 'Revisar a abordagem (fictício).');
const rep2 = await tenta(async () => devolverMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, Nv.id), 'De novo (fictício).'));
ok('C.3', 'em reavaliação não é devolvida de novo nem validada pelo supervisor', Boolean(rep2.erro)
  && Boolean((await tenta(async () => validarMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, Nv.id)))).erro), msg(rep2));

// ajustes da monitora
const notaAntes = nv.nota, envioAntes = String(nv.enviado_em), evAntes = await n('select count(*) n from public.monitoria_eventos where monitoria_id = $1', [Nv.id]);
await salvarMonitoria(MONITORA, { ...(await doBanco(MONITORA, Nv.id)), status: 'Em reavaliação', comments: 'AJUSTADA (fictício).' }, dA.criterios, true, false);
const aj = await linha(Nv.id);
ok('D.1', 'salvar ajustes mantém "Em reavaliação", sem evento e sem mexer na nota nem no envio',
  aj.status === 'Em reavaliação' && aj.comentarios === 'AJUSTADA (fictício).' && Number(aj.nota) === Number(notaAntes) && String(aj.enviado_em) === envioAntes
  && await n('select count(*) n from public.monitoria_eventos where monitoria_id = $1', [Nv.id]) === evAntes, JSON.stringify({ s: aj.status, c: aj.comentarios }));
const gd = await tenta(async () => salvarMonitoria(MONITORA, await doBanco(MONITORA, Nv.id), dA.criterios, true, false, true));
ok('D.2', 'não pode ser guardada (não volta à área privada)', gd.erro?.codigo === 'MI403' && /reenviada, não guardada/.test(gd.erro.message), msg(gd));
const outra = await tenta(async () => salvarMonitoria(OUTRA, await doBanco(MONITORA, Nv.id), dA.criterios, true, false));
ok('D.3', 'outra monitora não edita', outra.erro?.codigo === 'MI404', msg(outra));
const canc = await tenta(async () => cancelarMonitoria(MONITORA, await doBanco(MONITORA, Nv.id), 'x'));
ok('D.4', 'a monitora não cancela (só o Administrador com MFA)', Boolean(canc.erro), msg(canc));

// reenvio
await salvarMonitoria(MONITORA, { ...(await doBanco(MONITORA, Nv.id)), status: 'Pendente', finalScore: prev(GAB()) }, dA.criterios, true, true);
const re = await linha(Nv.id);
const reenv = await um(`select rodada, ocorrido_em from public.monitoria_eventos where monitoria_id = $1 and tipo = 'REENVIO'`, [Nv.id]);
ok('E.1', 'reenviar volta para a fila (Pendente) com evento REENVIO da rodada 2', re.status === 'Pendente' && reenv?.rodada === 2);
ok('E.2', 'a data do primeiro envio é preservada; a do reenvio fica no histórico', String(re.enviado_em) === envioAntes && Boolean(reenv.ocorrido_em));
ok('E.3', 'histórico completo e em ordem: ENVIO, DEVOLUCAO, REENVIO',
  (await db.query('select tipo from public.monitoria_eventos where monitoria_id = $1 order by id', [Nv.id])).rows.map((x) => x.tipo).join(',') === 'ENVIO,DEVOLUCAO,REENVIO');
const dE2 = await carregarDados(SUPERVISOR, PADROES);
ok('E.4', 'reenviada volta à fila do supervisor', getFilaDeValidacao(dE2.monitorias, HOJE).some((f) => f.monitoring.id === Nv.id));
await validarMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, Nv.id));
ok('E.5', 'e é validada normalmente', await status(Nv.id) === 'Validada');
const unica = (await carregarDados(MONITORA, PADROES)).monitorias.filter((m) => m.id === Nv.id);
ok('E.6', 'em todo o ciclo existe uma única monitoria (nada duplicado)', unica.length === 1 && await n('select count(*) n from public.monitorias where numero_atendimento = $1', [nv.numero_atendimento]) === 1);

// convertida reenviada (cenário das cinco)
await salvarMonitoria(MONITORA, { ...(await doBanco(MONITORA, DEV[0])), status: 'Pendente', finalScore: prev(GAB()) }, dA.criterios, true, true);
ok('E.7', 'convertida também reenvia com REENVIO, sem DEVOLUCAO extra', await status(DEV[0]) === 'Pendente' && await nEventos(DEV[0], 'REENVIO') === 1 && await nEventos(DEV[0], 'DEVOLUCAO') === 1);

// cancelamento pelo Administrador com MFA
const Cx = await enviar();
await devolverMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, Cx.id), 'Para testar o cancelamento (fictício).');
await cancelarMonitoria(ADMIN, await doBanco(ADMIN, Cx.id), 'Teste do script 21 (fictício).');
ok('F.1', 'o Administrador com MFA cancela uma em reavaliação, com evento próprio', await status(Cx.id) === 'Cancelada' && await nEventos(Cx.id, 'CANCELAMENTO') === 1);

// ---- reversão --------------------------------------------------------------------------------------
const antesR = await imp21();
const nReav = await n(`select count(*) n from public.monitorias where status = 'Em reavaliação'`);
await db.exec(sql('21r_reverter_reavaliacao.sql'));
const depoisR = await imp21();
ok('R.1', `o 21r volta as ${nReav} em reavaliação a Rascunho com motivo, sem evento e preservando os dados`,
  await n(`select count(*) n from public.monitorias where status = 'Em reavaliação'`) === 0
  && ['mon', 'notas', 'resp', 'evid', 'ev'].every((k) => antesR[k] === depoisR[k]) && depoisR.aud === antesR.aud + nReav, JSON.stringify([antesR, depoisR]));
ok('R.2', 'o 21r devolve funções, gatilho e situações permitidas exatamente como antes', JSON.stringify(await funcoes()) === JSON.stringify(funcAntes));
ok('R.3', 'auditoria íntegra e versão 21 removida', await quebras() === 0 && await n(`select count(*) n from app.versoes_esquema where versao = '21'`) === 0);
const NvR = await enviar();
await devolverMonitoria(SUPERVISOR, await doBanco(SUPERVISOR, NvR.id), 'Depois da reversão (fictício).');
ok('R.4', 'depois do 21r, devolver volta a gravar Rascunho como antes', await status(NvR.id) === 'Rascunho');
ok('R.5', 'privacidade do 18 ativa ao final', await n(`select count(*) n from pg_policies where tablename = 'monitorias' and policyname = 'monitorias_ler' and qual like '%monitoria_privada%'`) === 1);

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
