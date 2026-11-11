// Testes do script 19 (concluir e guardar; enviar para validação) num Postgres LOCAL (PGlite), com a
// migração REAL ensaiada (09b), os scripts até o 18 e a camada de dados do PORTAL. Nada sai deste
// computador. Monitorias de teste FICTÍCIAS.
//
// Prova: instalar não muda nada; guardar confere e fixa nota e régua sem enviar; editar invalida a
// conclusão e preserva o preenchimento; a guardada não alcança o supervisor nem conta como entregue;
// competência futura só na área privada; o envio é tudo ou nada, só da responsável, sem repetição;
// o 19r reverte.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-19-concluir-liberar.mjs <projeto>
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
const ADM = 'adm-aline-oliveira', EMAIL_ADM = 'aline.oliveira+admin@mouraleite.com.br';
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
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
await db.exec(sql('12_estado_do_acesso_mfa.sql'));
await db.exec(sql('12a_admin_aline_oliveira.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}'; insert into auth.users values ('${U(9)}', '${EMAIL_ADM}', now()); commit;`);
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
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2)), OUTRA = transporte(U(3)), ADMIN = transporte(U(9), 'aal2');
const HOJE = (await um('select app.hoje()::text d')).d;
const COMP = HOJE.slice(0, 7);
const somaMes = (c, k) => { const [a, m] = c.split('-').map(Number); const x = a * 12 + m - 1 + k; return `${Math.floor(x / 12)}-${String(x % 12 + 1).padStart(2, '0')}`; };
const COL = 'col-teste-homolog-1';

const dA = await carregarDados(ALINE, PADROES);
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
    comments: 'MONITORIA FICTÍCIA — TESTE DO SCRIPT 19 (LOCAL).', status: 'Rascunho', finalScore: prev(scores), scores, evidencias: [{ name: 'ficticia.pdf', type: 'PDF', size: '1 KB' }], links: [], relatorioCompleto: '<p>Relatório fictício.</p>', ...p }; };
const rascunho = (p, v) => salvarMonitoria(ALINE, base(p, v), dA.criterios, false, false);
const guardar = (p, v) => salvarMonitoria(ALINE, base(p, v), dA.criterios, false, false, true);
const enviar = (p, v) => salvarMonitoria(ALINE, base({ status: 'Pendente', ...p }, v), dA.criterios, false, true);
const doBanco = async (quem, id) => (await carregarDados(quem, PADROES)).monitorias.find((m) => m.id === id);
const linha = (id) => um('select * from public.monitorias where id = $1', [id]);
const nEventos = (id, tipo) => n('select count(*) n from public.monitoria_eventos where monitoria_id = $1 and tipo = $2', [id, tipo]);
const liberar = async (ids, quem = ALINE) => { const d = await carregarDados(quem, PADROES); return liberarMonitorias(quem, ids.map((id) => d.monitorias.find((m) => m.id === id) ?? { id, versao: 1 })); };
const impressoes = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo' - 'aguardando_liberacao' - 'concluida_em')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(m.id || '=' || (to_jsonb(m) ->> 'relatorio_completo'), '|' order by m.id), '')) from public.monitorias m) rel,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select count(*) from public.auditoria)::int aud`);
const definicoes = () => um(`select pg_get_functiondef('api.salvar_monitoria(jsonb, integer, boolean)'::regprocedure) f`);
const msg = (x) => (x.erro ? `${x.erro.codigo}|${x.erro.message}` : 'SEM ERRO');

// ---- instalação -----------------------------------------------------------------------------
const P0 = await enviar();
const R0 = await rascunho();
const antes = await impressoes();
const defAntes = await definicoes();
const bkAntes = (await db.query(sql('backup-completo.sql'))).rows[0].backup;
await db.exec(sql('19_concluir_liberar.sql'));
const depois = await impressoes();
ok('A.1', 'instalar não muda monitorias, relatórios, respostas, evidências nem histórico', ['mon', 'rel', 'resp', 'evid', 'ev'].every((k) => antes[k] === depois[k]), JSON.stringify([antes, depois]));
ok('A.2', 'instalar não grava na auditoria', antes.aud === depois.aud && await quebras() === 0, `${antes.aud} → ${depois.aud}`);
ok('A.3', 'nenhuma monitoria fica guardada ou com data de conclusão', await n('select count(*) n from public.monitorias where aguardando_liberacao or concluida_em is not null') === 0);
const bkDepois = (await db.query(sql('backup-completo.sql'))).rows[0].backup;
ok('A.4', 'a impressão do backup continua comparável com a de antes do 19', bkDepois.meta.impressoes.monitorias === bkAntes.meta.impressoes.monitorias && Boolean(bkDepois.meta.impressoes.guardas));
const rep = await tenta(() => db.exec(sql('19_concluir_liberar.sql')));
await db.exec('rollback').catch(() => {});
ok('A.5', 'o 19 não instala duas vezes', rep.erro && /já instalado/.test(rep.erro.message));
await db.exec(sql('19r_reverter_concluir_liberar.sql'));
const posR = await impressoes();
ok('A.6', '19r devolve a função exatamente como era e não muda dados', (await definicoes()).f === defAntes.f && ['mon', 'rel', 'resp', 'evid', 'ev', 'aud'].every((k) => antes[k] === posR[k]) && await n(`select count(*) n from information_schema.columns where table_name = 'monitorias' and column_name in ('aguardando_liberacao', 'concluida_em')`) === 0);
await db.exec(sql('19_concluir_liberar.sql'));
ok('A.7', 'o 19 reinstala', await n(`select count(*) n from app.versoes_esquema where versao = '19'`) === 1);

// ---- guardar ----------------------------------------------------------------------------------
const G1 = await guardar();
const g1 = await linha(G1.id);
ok('G.1', 'guardar: continua Rascunho, marcada, com data de conclusão', g1.status === 'Rascunho' && g1.aguardando_liberacao === true && g1.concluida_em !== null, JSON.stringify(G1));
ok('G.2', 'guardar: fixa nota e régua, sem data de envio', Number(g1.nota) === prev(GAB()) && g1.regua_versao_id !== null && g1.enviado_em === null);
ok('G.3', 'guardar não gera registro de envio', await nEventos(G1.id, 'ENVIO') === 0);
const incompleta = await tenta(() => salvarMonitoria(ALINE, base({ scores: [] }), dA.criterios, false, false, true));
ok('G.4', 'guardar recusa avaliação incompleta, como o envio', /MI422/.test(msg(incompleta)), msg(incompleta));
const semCampo = await tenta(() => salvarMonitoria(ALINE, base({ numeroAtendimento: '' }), dA.criterios, false, false, true));
ok('G.5', 'guardar recusa campo obrigatório vazio', /MI422/.test(msg(semCampo)), msg(semCampo));
const notaErrada = await tenta(() => salvarMonitoria(ALINE, base({ finalScore: 1 }), dA.criterios, false, false, true));
ok('G.6', 'guardar recusa nota que não confere com o banco', /não confere/.test(msg(notaErrada)), msg(notaErrada));
const ambos = await tenta(() => ALINE.chamar('salvar_monitoria', { p_dados: { ...base(), guardar: true }, p_versao_lida: null, p_enviar: true }));
ok('G.7', 'não aceita guardar e enviar ao mesmo tempo', /MI422/.test(msg(ambos)), msg(ambos));
const mG = await doBanco(ALINE, G1.id);
ok('G.8', 'o portal recebe marca, nota fixada e datas', mG.aguardandoLiberacao === true && mG.finalScore === prev(GAB()) && Boolean(mG.concluidaEm) && Boolean(mG.criadoEm) && !mG.enviadoEm);
ok('G.9', 'guardada não conta para meta nem média', !countsTowardGoal(mG) && !entraNaMedia(mG));

// ---- privacidade -------------------------------------------------------------------------------
for (const [tb, campo, nome] of [['monitorias', 'id', 'monitorias'], ['monitoria_respostas', 'monitoria_id', 'respostas'], ['monitoria_evidencias', 'monitoria_id', 'evidências'], ['monitoria_eventos', 'monitoria_id', 'histórico']]) {
  ok(`P.${nome}`, `supervisor não alcança guardada em ${nome}`, !(await ERIVAN.selecionar(tb)).some((l) => l[campo] === G1.id));
}
ok('P.portal', 'a carga do supervisor não traz guardada', !(await carregarDados(ERIVAN, PADROES)).monitorias.some((m) => m.id === G1.id));
ok('P.fila', 'a guardada não está na fila de validação', !(await ERIVAN.sql('select id from api.fila_validacao()')).some((l) => l.id === G1.id));
for (const [f, a] of [['validar_monitoria', { p_versao_lida: 1 }], ['devolver_monitoria', { p_versao_lida: 1, p_motivo: 'x' }], ['reprovar_monitoria', { p_versao_lida: 1, p_motivo: 'x' }], ['registrar_observacao', { p_texto: 'x', p_chave: '00000000-0000-4000-8000-000000000001' }]]) {
  const p = await tenta(() => ERIVAN.chamar(f, { p_id: G1.id, ...a }));
  const q = await tenta(() => ERIVAN.chamar(f, { p_id: 'MON-99999', ...a }));
  ok(`P.${f}`, `${f}: guardada responde igual a código inexistente`, msg(p) === msg(q) && /MI404/.test(msg(p)), `${msg(p)} × ${msg(q)}`);
}
ok('P.outra', 'outra monitora não alcança', !(await OUTRA.selecionar('monitorias')).some((l) => l.id === G1.id));
ok('P.admin', 'o Administrador com MFA alcança', (await ADMIN.selecionar('monitorias')).some((l) => l.id === G1.id));

// ---- editar invalida a conclusão -----------------------------------------------------------------
const E1 = await guardar();
const antesRel = (await linha(E1.id)).relatorio_completo;
const mE = await doBanco(ALINE, E1.id);
await salvarMonitoria(ALINE, { ...mE, comments: 'Editado depois de guardar (fictício).' }, dA.criterios, true, false);
const e1 = await linha(E1.id);
ok('E.1', 'salvar devolve a Rascunho e invalida a conclusão', e1.status === 'Rascunho' && e1.aguardando_liberacao === false && e1.concluida_em === null && e1.nota === null && e1.regua_versao_id === null && e1.eliminatorio_pendente === false);
ok('E.2', 'o preenchimento fica preservado', e1.comentarios === 'Editado depois de guardar (fictício).' && e1.relatorio_completo === antesRel && await n('select count(*) n from public.monitoria_respostas where monitoria_id = $1 and ativo', [E1.id]) === aplic.length);
ok('E.3', 'editada não alcança o supervisor', !(await ERIVAN.selecionar('monitorias')).some((l) => l.id === E1.id));
const naoLibera = await tenta(() => liberar([E1.id]));
ok('E.4', 'editada não pode ser enviada antes de nova conclusão', /não está guardada/.test(msg(naoLibera)), msg(naoLibera));
const mE2 = await doBanco(ALINE, E1.id);
const scoresNovos = GAB({ 'crit-12': 1 });
await salvarMonitoria(ALINE, { ...mE2, scores: scoresNovos, finalScore: prev(scoresNovos) }, dA.criterios, true, false, true);
const e2 = await linha(E1.id);
ok('E.5', 'nova conclusão fixa a nota nova', e2.aguardando_liberacao === true && Number(e2.nota) === prev(scoresNovos) && Number(e2.nota) < prev(GAB()) && e2.concluida_em !== null);
const mPortalAntigo = await doBanco(ALINE, E1.id);
await ALINE.chamar('salvar_monitoria', { p_dados: { id: E1.id, comments: 'Portal anterior (fictício).', scores: scoresNovos }, p_versao_lida: mPortalAntigo.versao, p_enviar: false });
ok('E.6', 'o portal anterior, sem o campo novo, também invalida a conclusão', (await linha(E1.id)).aguardando_liberacao === false);
const D1 = await guardar();
const mD = await doBanco(ALINE, D1.id);
await salvarMonitoria(ALINE, { ...mD, status: 'Pendente' }, dA.criterios, true, true);
const d1 = await linha(D1.id);
ok('E.7', 'de guardada para "Concluir e enviar": sai da guarda e vai para a fila', d1.status === 'Pendente' && d1.aguardando_liberacao === false && d1.enviado_em !== null && await nEventos(D1.id, 'ENVIO') === 1);

// ---- competência futura ---------------------------------------------------------------------------
const PROX = somaMes(COMP, 1);
const F1 = await rascunho({ competencia: PROX });
ok('C.1', 'rascunho de competência futura é aceito', (await linha(F1.id)).competencia === PROX);
const F2 = await guardar({ competencia: PROX });
ok('C.2', 'guardar competência futura é aceito', (await linha(F2.id)).aguardando_liberacao === true);
const F3 = await guardar({ competencia: somaMes(COMP, 12) });
ok('C.3', 'aceita até 12 meses à frente', Boolean(F3.id));
const F4 = await tenta(() => guardar({ competencia: somaMes(COMP, 13) }));
ok('C.4', 'recusa além de 12 meses', /12 meses/.test(msg(F4)), msg(F4));
const F5 = await tenta(() => enviar({ competencia: PROX }));
ok('C.5', 'enviar competência que não começou é recusado', /ainda não começou/.test(msg(F5)), msg(F5));
const F6 = await tenta(() => liberar([F2.id]));
ok('C.6', 'liberar competência que não começou é recusado', /ainda não começou/.test(msg(F6)) && (await linha(F2.id)).status === 'Rascunho', msg(F6));
ok('C.7', 'competência futura guardada não alcança o supervisor', !(await ERIVAN.selecionar('monitorias')).some((l) => l.id === F2.id));

// ---- enviar para validação ---------------------------------------------------------------------------
const audAntes = await n('select count(*) n from public.auditoria');
const L1 = await guardar();
const notaL1 = Number((await linha(L1.id)).nota), concluidaL1 = (await linha(L1.id)).concluida_em;
const rL = await liberar([L1.id]);
const l1 = await linha(L1.id);
ok('L.1', 'envio individual: vai para Pendente, sem marca, com data real', rL.liberadas[0] === L1.id && l1.status === 'Pendente' && l1.aguardando_liberacao === false && l1.enviado_em !== null, JSON.stringify(rL));
ok('L.2', 'nota e data de conclusão são preservadas', Number(l1.nota) === notaL1 && String(l1.concluida_em) === String(concluidaL1));
ok('L.3', 'um único registro de envio', await nEventos(L1.id, 'ENVIO') === 1);
const vL = await doBanco(ERIVAN, L1.id);
ok('L.4', 'fica visível ao supervisor na hora, com respostas e fila', vL && vL.scores.length > 0 && (await ERIVAN.sql('select id from api.fila_validacao()')).some((x) => x.id === L1.id));
ok('L.5', 'conta como entregue', countsTowardGoal(vL) && entraNaMedia(vL));
const filaE = getFilaDeValidacao((await carregarDados(ERIVAN, PADROES)).monitorias, HOJE).find((f) => f.monitoring.id === L1.id);
ok('L.5b', 'na fila do supervisor, a espera conta do envio (hoje), com referência exata', filaE && filaE.dias === 0 && filaE.referenciaExata && filaE.desde === HOJE, JSON.stringify(filaE && { dias: filaE.dias, desde: filaE.desde }));
ok('L.6', 'a auditoria registra e a cadeia segue íntegra', await n('select count(*) n from public.auditoria') > audAntes && await quebras() === 0);
const v0 = (await linha(L1.id)).versao;
const rep2 = await liberarMonitorias(ALINE, [await doBanco(ALINE, L1.id)]);
ok('L.7', 'repetir o envio não gera novo envio nem alteração', rep2.liberadas.length === 0 && rep2.ja_enviadas[0] === L1.id && await nEventos(L1.id, 'ENVIO') === 1 && (await linha(L1.id)).versao === v0, JSON.stringify(rep2));

const [A1, A2, A3] = [await guardar(), await guardar(), await guardar()];
const rLote = await liberar([A3.id, A1.id, A2.id]);
ok('L.8', 'lote: todas enviadas', rLote.liberadas.length === 3 && await n(`select count(*) n from public.monitorias where id = any($1) and status = 'Pendente' and not aguardando_liberacao`, [[A1.id, A2.id, A3.id]]) === 3);
ok('L.9', 'lote: um registro de envio por monitoria', (await Promise.all([A1, A2, A3].map((x) => nEventos(x.id, 'ENVIO')))).every((k) => k === 1));

const [B1, B2] = [await guardar(), await guardar()];
const dLote = await carregarDados(ALINE, PADROES);
const emB1 = dLote.monitorias.find((m) => m.id === B1.id), emB2 = dLote.monitorias.find((m) => m.id === B2.id);
const defasada = await tenta(() => liberarMonitorias(ALINE, [emB1, { ...emB2, versao: emB2.versao + 5 }]));
ok('L.10', 'versão defasada: nenhuma é enviada, e o erro aponta qual', /Nenhuma monitoria foi enviada/.test(msg(defasada)) && msg(defasada).includes(B2.id) && msg(defasada).includes('alterada') && (await linha(B1.id)).status === 'Rascunho', msg(defasada));
const comum = await rascunho();
const comRascunho = await tenta(() => liberar([B1.id, comum.id]));
ok('L.11', 'lote com rascunho comum: nenhuma é enviada', /não está guardada/.test(msg(comRascunho)) && (await linha(B1.id)).status === 'Rascunho', msg(comRascunho));
const O1 = await salvarMonitoria(OUTRA, base({ inicioAtendimento: `${HOJE}T22:00`, fimAtendimento: `${HOJE}T22:01` }), dA.criterios, false, false, true).catch((e) => e);
const alheia = await tenta(() => ALINE.chamar('liberar_monitorias', { p_itens: [{ id: B1.id, versao: emB1.versao }, { id: O1.id ?? 'MON-99999', versao: 1 }] }));
ok('L.12', 'monitoria de outra pessoa: nenhuma é enviada', /não encontrada entre as suas/.test(msg(alheia)) && (await linha(B1.id)).status === 'Rascunho', msg(alheia));
for (const [quem, nome, rx] of [[ERIVAN, 'supervisor', /MI403/], [ADMIN, 'Administrador', /MI403/], [OUTRA, 'outra monitora', /não encontrada/]]) {
  const x = await tenta(() => quem.chamar('liberar_monitorias', { p_itens: [{ id: B1.id, versao: emB1.versao }] }));
  ok(`L.13.${nome}`, `${nome} não envia pela monitora`, rx.test(msg(x)) && (await linha(B1.id)).status === 'Rascunho', msg(x));
}
await db.exec('begin; set local role anon;');
const anon = await tenta(() => db.query(`select api.liberar_monitorias('[]'::jsonb)`));
await db.exec('rollback');
ok('L.14', 'sem login não executa', Boolean(anon.erro));
for (const [lista, nome] of [[[], 'vazia'], [[{ id: B1.id, versao: 1 }, { id: B1.id, versao: 1 }], 'repetida'], [[{ id: '', versao: 1 }], 'sem código'], [Array.from({ length: 101 }, (_, i) => ({ id: `X-${i}`, versao: 1 })), 'acima de 100']]) {
  const x = await tenta(() => ALINE.chamar('liberar_monitorias', { p_itens: lista }));
  ok(`L.15.${nome}`, `lista ${nome} é recusada`, /MI422/.test(msg(x)), msg(x));
}
await db.exec(`begin; alter table public.monitorias disable trigger user; update public.monitorias set nota = 1 where id = '${B2.id}'; alter table public.monitorias enable trigger user; commit;`);
const adulterada = await tenta(() => liberar([B2.id]));
ok('L.16', 'nota fixada que não confere impede o envio', /não confere/.test(msg(adulterada)) && (await linha(B2.id)).status === 'Rascunho', msg(adulterada));

// ---- caminhos paralelos --------------------------------------------------------------------------
const Dv = await enviar();
await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, Dv.id), 'Corrigir (fictício).');
const mDv = await doBanco(ALINE, Dv.id);
const gDv = await tenta(() => salvarMonitoria(ALINE, mDv, dA.criterios, true, false, true));
ok('X.1', 'devolvida não pode ser guardada', /reenviada, não guardada/.test(msg(gDv)) && Boolean(await doBanco(ERIVAN, Dv.id)), msg(gDv));
const Cn = await guardar();
await cancelarMonitoria(ADMIN, await doBanco(ADMIN, Cn.id), 'Teste do script 19 (fictício).');
const cn = await linha(Cn.id);
ok('X.2', 'cancelar uma guardada funciona, sem deixar a marca', cn.status === 'Cancelada' && cn.aguardando_liberacao === false);
ok('X.3', 'cancelada nunca enviada continua privada', !(await ERIVAN.selecionar('monitorias')).some((l) => l.id === Cn.id));
const cnL = await tenta(() => liberar([Cn.id]));
ok('X.4', 'cancelada não pode ser enviada', /não está guardada/.test(msg(cnL)), msg(cnL));
const El = await guardar({}, { 'crit-25': 0 });
ok('X.5', 'eliminatório marcado fica pendente na guardada', (await linha(El.id)).eliminatorio_pendente === true);
await liberar([El.id]);
const decisao = await tenta(async () => confirmarZeramento(ERIVAN, await doBanco(ERIVAN, El.id)));
ok('X.6', 'depois de enviada, o supervisor decide o eliminatório normalmente', !decisao.erro && Number((await linha(El.id)).nota) === 0 && (await linha(El.id)).zerada === true, msg(decisao));
const Va = await guardar();
await liberar([Va.id]);
await validarMonitoria(ERIVAN, await doBanco(ERIVAN, Va.id));
ok('X.7', 'depois de enviada, o supervisor valida normalmente', (await linha(Va.id)).status === 'Validada');

// ---- régua fixada na conclusão ------------------------------------------------------------------
const Rg = await guardar();
const reguaRg = (await linha(Rg.id)).regua_versao_id;
await db.exec(`begin; set local app.responsavel = '${ADM}';
  insert into public.regua_versoes (id, rotulo, vigente_desde, retrato, descricao)
  select 'regua-teste-19', 'Teste 19', app.hoje(), retrato, 'Fictícia, só para o teste' from public.regua_versoes where id = '${reguaRg}'; commit;`);
ok('Y.0', 'cenário: há régua nova vigente', (await um('select app.regua_vigente() r')).r === 'regua-teste-19', (await um('select app.regua_vigente() r')).r);
await liberar([Rg.id]);
ok('Y.1', 'o envio mantém a régua da conclusão', (await linha(Rg.id)).regua_versao_id === reguaRg);
const Rn = await guardar();
ok('Y.2', 'conclusão nova usa a régua vigente', (await linha(Rn.id)).regua_versao_id === 'regua-teste-19');
const Re = await guardar();
await db.exec(`begin; alter table public.monitorias disable trigger user; update public.monitorias set regua_versao_id = '${reguaRg}' where id = '${Re.id}'; alter table public.monitorias enable trigger user; commit;`);
const mRe = await doBanco(ALINE, Re.id);
await salvarMonitoria(ALINE, mRe, dA.criterios, true, false);
await salvarMonitoria(ALINE, { ...(await doBanco(ALINE, Re.id)), finalScore: prev(GAB()) }, dA.criterios, true, false, true);
ok('Y.3', 'editar e concluir de novo passa para a régua vigente', (await linha(Re.id)).regua_versao_id === 'regua-teste-19');

// ---- reversão com uso ----------------------------------------------------------------------------
const recusa = await tenta(() => db.exec(sql('19r_reverter_concluir_liberar.sql')));
await db.exec('rollback').catch(() => {});
ok('R.1', 'o 19r recusa quando há guardadas ou datas de conclusão', recusa.erro && /RECUSADO/.test(recusa.erro.message), recusa.erro?.message);
ok('R.2', 'auditoria íntegra ao final', await quebras() === 0);
ok('R.3', 'privacidade do 18 ativa ao final', await n(`select count(*) n from pg_policies where tablename = 'monitorias' and policyname = 'monitorias_ler' and qual like '%monitoria_privada%'`) === 1);

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
