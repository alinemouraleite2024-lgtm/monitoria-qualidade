// Testes do script 17 (Relatório Completo da Monitoria) num Postgres LOCAL (PGlite), com a migração REAL
// ensaiada (09b), os scripts até o 16 e a camada de dados do PORTAL. Nada sai deste computador.
// Relatórios e monitorias de teste FICTÍCIOS.
//
// Prova: instalar não muda nada; o relatório salva, volta, edita e trava como a monitoria; a nota não
// o enxerga; conteúdo malicioso e acima do limite é recusado; as permissões são as da monitoria; o
// backup o leva e continua comparável; o 17r reverte.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-17-relatorio-completo.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, devolverMonitoria, reprovarMonitoria, validarMonitoria, cancelarMonitoria, cancelarPorDuplicidade } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco, mensagemDoErro } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { atendimentoJaRegistrado } = await mod('src/domain/duplicidade.ts');
const { countsTowardGoal } = await mod('src/domain/monitoringRules.ts');
const { entraNaMedia } = await mod('src/domain/resultadosService.ts');
const { lerBackup, conferirBackup, linhasDe } = await import(pathToFileURL(join(projeto, 'supabase/backup/restauracao.mjs')).href);
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
const cod = (x) => x.erro?.codigo ?? (x.erro ? 'ERRO' : 'ok');
definirModoParaTeste(true);

// ---- banco igual à homologação (até o 14) ---------------------------------------------------
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP); await db.exec(STUB_MFA);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'])
  await db.exec(sql(f));
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
await db.exec(sql('14_historico_calibracao.sql'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
const quebras = () => n("select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q");
const nMon = () => n('select count(*) n from public.monitorias');
const nAud = () => n('select count(*) n from public.auditoria');

// ---- transporte (o que a Data API faz) ------------------------------------------------------
const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text', p_consideracoes: '::text', p_texto: '::text', p_chave: '::uuid', p_original: '::text' };
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
const transporte = (uid, aal = 'aal1') => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
    try { const x = await fn(); await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  return {
    selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: (f, args) => como(async () => { const ks = Object.keys(args);
      return normalizar((await db.query(`select api.${f}(${ks.map((k, i) => `${k} => $${i + 1}${TIPOS[k]}`).join(', ')}) r`, ks.map((k) => (k === 'p_dados' ? JSON.stringify(args[k]) : args[k])))).rows[0].r); }),
    incluir: (tb, linha) => como(async () => { const ks = Object.keys(linha); await db.query(`insert into public.${tb} (${ks.join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`, ks.map((k) => linha[k])); }),
    sql: (q, p) => como(async () => (await db.query(q, p)).rows),
  };
};
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2)), OUTRA = transporte(U(3)), ADMIN = transporte(U(9), 'aal2'), ADMIN_AAL1 = transporte(U(9), 'aal1');
const HOJE = (await um('select app.hoje()::text d')).d;
const COMP = HOJE.slice(0, 7);
const COL = 'col-teste-homolog-1';
const COL2 = (await um(`select id from public.colaboradores where id <> $1 order by id limit 1`, [COL])).id;
const PERFIL_ALINE = (await um(`select id from public.perfis where auth_user_id = $1`, [U(1)])).id;

let dA = await carregarDados(ALINE, PADROES);
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const GAB = (variante = 0) => aplic.map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  if (c.id === 'crit-12' && variante === 1) return { criterionId: c.id, score: 1, lowScoreReason: 'TESTE: resposta diferente (fictício).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
const H = (hm, dia = HOJE) => `${dia}T${hm}`;
const base = (p = {}) => ({ id: '', competencia: COMP, date: `${HOJE}T12:00:00Z`, colaboradorId: COL, canal: 'Telefone', tipo: 'Regular',
  categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'FICT-1', numeroTitulo: 'FICT', inicioAtendimento: H('09:00'), fimAtendimento: H('09:10'), duracaoMinutos: 10,
  comments: 'MONITORIA FICTÍCIA — TESTE DO SCRIPT 15 (LOCAL).', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [], ...p });
const enviada = (p = {}, v = 0) => base({ status: 'Pendente', scores: GAB(v), finalScore: prev(GAB(v)), ...p });
const doBanco = async (quem, id) => (await carregarDados(quem, PADROES)).monitorias.find((m) => m.id === id);
const linha = (id) => um('select * from public.monitorias where id = $1', [id]);
const uuid = (k) => `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;

// ---- estado da homologação: 15 e 16 instalados, monitorias anteriores ao 17 ---------------------
await db.exec(sql('15_duplicidade_criacao.sql'));
await db.exec(sql('16_colaboradora_inativa.sql'));
const P1 = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('08:00'), fimAtendimento: H('08:10'), numeroAtendimento: 'FICT-P1' }), dA.criterios, false, true);
const R1 = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('08:20'), fimAtendimento: H('08:30'), numeroAtendimento: 'FICT-R1', contexto: 'Rascunho anterior ao 17.' }), dA.criterios, false, false);

const impressoes = () => um(`select
  (select md5(coalesce(string_agg((to_jsonb(m) - 'relatorio_completo')::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id), '')) from public.monitoria_respostas r) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select md5(coalesce(string_agg(id || '=' || coalesce(nota::text, '-') || '/' || coalesce(nota_calculada::text, '-') || '/' || status || '/v' || versao, '|' order by id), '')) from public.monitorias) notas,
  (select count(*) from public.auditoria)::int aud`);
const FILA = () => n(`select count(*) n from public.monitorias where status = 'Pendente'`);
const antes = await impressoes();
const filaAntes = await FILA();
const bkAntes = (await db.query(sql('backup-completo.sql'))).rows[0].backup;
ok('A.0', 'a impressão do backup, antes do 17, é a mesma da conferência', bkAntes.meta.impressoes.monitorias === antes.mon, bkAntes.meta.impressoes.monitorias);

// ---- instalação -----------------------------------------------------------------------------
await db.exec(sql('17_relatorio_completo.sql'));
const depois = await impressoes();
ok('A.1', 'instalar não muda monitorias, respostas, evidências, histórico nem notas', ['mon', 'resp', 'evid', 'ev', 'notas'].every((k) => antes[k] === depois[k]), JSON.stringify([antes, depois]));
ok('A.2', 'instalar não grava nada na auditoria', depois.aud === antes.aud, `${antes.aud} → ${depois.aud}`);
ok('A.3', 'todas as monitorias ficam com o campo nulo', await n('select count(*) n from public.monitorias where relatorio_completo is not null') === 0);
ok('A.4', 'fila não muda', await FILA() === filaAntes);
const bkDepois = (await db.query(sql('backup-completo.sql'))).rows[0].backup;
ok('A.5', 'a impressão do backup continua comparável com a de antes do 17', bkDepois.meta.impressoes.monitorias === bkAntes.meta.impressoes.monitorias);
ok('A.6', 'sem a exclusão do campo, a impressão mudaria: é o que a conferência evita', (await um(`select md5(string_agg(to_jsonb(m)::text, '|' order by m.id)) x from public.monitorias m`)).x !== antes.mon);
const rep17 = await tenta(() => db.exec(sql('17_relatorio_completo.sql')));
ok('A.7', 'o 17 não instala duas vezes', rep17.erro);
await db.exec('rollback').catch(() => {});

// ---- monitorias históricas ------------------------------------------------------------------
const histP1 = await doBanco(ALINE, P1.id);
ok('H.1', 'monitoria anterior ao 17 abre sem o campo', histP1 && !('relatorioCompleto' in histP1) && histP1.finalScore === P1.nota);
const histR1 = await doBanco(ALINE, R1.id);
const salvoR1 = await salvarMonitoria(ALINE, { ...histR1, comments: 'Editado depois do 17, pelo portal.' }, dA.criterios, true, false);
ok('H.2', 'rascunho anterior ao 17 é editado e continua sem relatório', salvoR1.status === 'Rascunho' && (await linha(R1.id)).relatorio_completo === null);
const decP1 = await validarMonitoria(ERIVAN, await doBanco(ERIVAN, P1.id));
ok('H.3', 'gestor valida monitoria anterior ao 17, com a mesma nota', (await linha(P1.id)).status === 'Validada' && Number((await linha(P1.id)).nota) === P1.nota, JSON.stringify(decP1));

// ---- salvar, recuperar, editar ----------------------------------------------------------------
const RELATORIO = '<h1>📋 Relatório</h1><h2>Contexto</h2><p>Atendimento <strong>00000</strong>, CR <em>TESTE-01</em>, <u>fictício</u> <mark>destaque</mark>.</p><ul><li><p>😊 Item</p><ul><li><p>Subitem</p></li></ul></li></ul><ol start="2"><li><p>Dois</p></li></ol><table><tbody><tr><th colspan="1" rowspan="1"><p>A</p></th><th><p>B</p></th></tr><tr><td colspan="2"><p>C</p></td></tr></tbody></table><hr><p><a href="https://exemplo.test/a?b=1&amp;c=2">link</a> &lt;script&gt; como texto</p>';
const S1 = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('09:00'), fimAtendimento: H('09:10'), numeroAtendimento: 'FICT-S1', relatorioCompleto: RELATORIO }), dA.criterios, false, false);
const m1 = await doBanco(ALINE, S1.id);
ok('S.1', 'rascunho guarda o relatório, com a formatação intacta', m1.relatorioCompleto === RELATORIO, m1.relatorioCompleto);
const S1b = await salvarMonitoria(ALINE, { ...m1, relatorioCompleto: `${RELATORIO}<p>Editado</p>` }, dA.criterios, true, false);
const m1b = await doBanco(ALINE, S1.id);
ok('S.2', 'edição do relatório é salva e sobe a versão', m1b.relatorioCompleto.endsWith('<p>Editado</p>') && S1b.versao === m1.versao + 1);
const antigo = { ...m1b }; delete antigo.relatorioCompleto;
await salvarMonitoria(ALINE, { ...antigo, comments: 'Salvo pelo portal atual, que não conhece o campo.' }, dA.criterios, true, false);
const m1c = await doBanco(ALINE, S1.id);
ok('S.3', 'portal que não envia o campo não apaga o relatório', m1c.relatorioCompleto === m1b.relatorioCompleto && m1c.comments.startsWith('Salvo'));
await salvarMonitoria(ALINE, { ...m1c, relatorioCompleto: '' }, dA.criterios, true, false);
ok('S.4', 'relatório vazio volta a ser nulo', (await linha(S1.id)).relatorio_completo === null);
const m1d = await doBanco(ALINE, S1.id);
await salvarMonitoria(ALINE, { ...m1d, relatorioCompleto: RELATORIO }, dA.criterios, true, false);
const aud = await um(`select count(*) n from public.auditoria a where a.tabela = 'monitorias' and to_jsonb(a)::text like '%Relatório%' and to_jsonb(a)::text like '%' || $1 || '%'`, [S1.id]);
ok('S.5', 'alteração do relatório entra na auditoria', Number(aud.n) > 0);
ok('S.6', 'auditoria sem quebras depois das gravações', await quebras() === 0);

// ---- nota: o relatório não entra na conta ------------------------------------------------------
const SEM = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('10:00'), fimAtendimento: H('10:10'), numeroAtendimento: 'FICT-N1' }, 1), dA.criterios, false, true);
const COM = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('10:20'), fimAtendimento: H('10:30'), numeroAtendimento: 'FICT-N2', relatorioCompleto: RELATORIO }, 1), dA.criterios, false, true);
const [lS, lC] = [await linha(SEM.id), await linha(COM.id)];
ok('N.1', 'mesmas respostas, com e sem relatório: mesma nota', SEM.nota === COM.nota && SEM.nota === prev(GAB(1)), `${SEM.nota} × ${COM.nota}`);
ok('N.2', 'nota calculada, régua e situação não dependem do relatório', lS.nota_calculada === lC.nota_calculada && lS.regua_versao_id === lC.regua_versao_id && lC.status === 'Pendente');
const respostasIguais = await um(`select (select md5(string_agg(criterio_id || coalesce(resposta::text, '') || coalesce(justificativa, ''), '|' order by criterio_id)) from public.monitoria_respostas where monitoria_id = $1) = (select md5(string_agg(criterio_id || coalesce(resposta::text, '') || coalesce(justificativa, ''), '|' order by criterio_id)) from public.monitoria_respostas where monitoria_id = $2) x`, [SEM.id, COM.id]);
ok('N.3', 'respostas gravadas iguais', respostasIguais.x === true);
const relEl = '<p>O atendimento teve falta de respeito ao cliente: crit-26 ocorreu, nota 0.</p>';
const SEL = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('10:40'), fimAtendimento: H('10:50'), numeroAtendimento: 'FICT-N3', relatorioCompleto: relEl }), dA.criterios, false, true);
const lEl = await linha(SEL.id);
ok('N.4', 'texto do relatório não aciona eliminatório nem zera', lEl.eliminatorio_pendente === false && lEl.zerada === false && Number(lEl.nota) === prev(GAB(0)));

// ---- travamento e permissões -------------------------------------------------------------------
const pend = await doBanco(ALINE, COM.id);
const edPend = await tenta(() => salvarMonitoria(ALINE, { ...pend, relatorioCompleto: '<p>Alterado depois do envio</p>' }, dA.criterios, true, false));
ok('P.1', 'depois do envio o relatório não muda (MI403)', cod(edPend) === 'MI403' && (await linha(COM.id)).relatorio_completo === RELATORIO, cod(edPend));
const dir = await tenta(() => ALINE.sql(`update public.monitorias set relatorio_completo = '<p>x</p>' where id = '${COM.id}'`));
ok('P.2', 'monitora não grava direto na tabela', dir.erro && (await linha(COM.id)).relatorio_completo === RELATORIO);
const dirE = await tenta(() => ERIVAN.sql(`update public.monitorias set relatorio_completo = '<p>x</p>' where id = '${COM.id}'`));
ok('P.3', 'gestor não altera o relatório', dirE.erro && (await linha(COM.id)).relatorio_completo === RELATORIO);
ok('P.4', 'gestor da equipe lê o relatório', (await doBanco(ERIVAN, COM.id))?.relatorioCompleto === RELATORIO);
ok('P.5', 'outra monitora não vê a monitoria nem o relatório', (await doBanco(OUTRA, COM.id)) === undefined);
const anon = await db.query(`select has_column_privilege('anon', 'public.monitorias', 'relatorio_completo', 'select') a, has_function_privilege('authenticated', 'app.conferir_relatorio_completo(text)', 'execute') f`);
ok('P.6', 'anônimo sem leitura; conferência não exposta ao portal', anon.rows[0].a === false && anon.rows[0].f === false);
const edOutra = await tenta(async () => salvarMonitoria(OUTRA, { ...(await doBanco(ALINE, S1.id)), relatorioCompleto: '<p>x</p>' }, dA.criterios, true, false));
ok('P.7', 'outra monitora não edita o rascunho alheio', cod(edOutra) === 'MI404', cod(edOutra));
const dev = await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, COM.id), 'Devolvida no teste fictício.');
const devolvida = await doBanco(ALINE, COM.id);
await salvarMonitoria(ALINE, { ...devolvida, relatorioCompleto: `${RELATORIO}<p>Correção</p>` }, dA.criterios, true, false);
ok('P.8', 'devolvida volta a Rascunho e o relatório é corrigido', (await linha(COM.id)).relatorio_completo.endsWith('<p>Correção</p>'), JSON.stringify(dev));

// ---- segurança e limite ------------------------------------------------------------------------
const MALICIOSOS = {
  script: '<p>a</p><script>alert(1)</script>', 'script maiúsculo': '<SCRIPT>alert(1)</SCRIPT>', 'script com espaço': '< script>alert(1)</script>', evento: '<p onclick="alert(1)">a</p>', 'evento sem aspas': '<p onmouseover=alert(1)>a</p>',
  'evento com barra': '<a/onclick=alert(1)>a</a>', imagem: '<img src=x onerror=alert(1)>', svg: '<svg onload=alert(1)></svg>', iframe: '<iframe src="https://exemplo.test"></iframe>', estilo: '<p style="position:fixed">a</p>',
  'tag style': '<style>p{}</style>', link: '<a href="javascript:alert(1)">a</a>', 'link maiúsculo': '<a href="JaVaScRiPt:alert(1)">a</a>', 'link sem aspas': '<a href=javascript:alert(1)>a</a>', 'link data': '<a href="data:text/html,x">a</a>',
  comentario: '<!-- x --><p>a</p>', objeto: '<object data="x"></object>', math: '<math><mi>a</mi></math>', form: '<form action="https://exemplo.test"><input></form>', meta: '<meta http-equiv="refresh" content="0">', base: '<base href="https://exemplo.test">',
};
const nMonAntes = await nMon();
const recusas = [];
let k = 100;
for (const [nome, html] of Object.entries(MALICIOSOS)) {
  k += 1;
  const x = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H(`11:${String(k - 100).padStart(2, '0')}`), fimAtendimento: H('11:59'), numeroAtendimento: `FICT-X${k}`, relatorioCompleto: html }), dA.criterios, false, false));
  if (cod(x) !== 'MI422') recusas.push(`${nome}: ${cod(x)}`);
}
ok('X.1', `${Object.keys(MALICIOSOS).length} conteúdos maliciosos recusados na gravação (MI422)`, recusas.length === 0, recusas.join('; '));
ok('X.2', 'nenhuma monitoria foi criada pelas tentativas', await nMon() === nMonAntes);
const L200 = `<p>${'a'.repeat(200000 - 7)}</p>`;
const lim = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('12:00'), fimAtendimento: H('12:10'), numeroAtendimento: 'FICT-L1', relatorioCompleto: L200 }), dA.criterios, false, false);
ok('X.3', 'exatamente 200 KB é aceito', (await linha(lim.id)).relatorio_completo.length === 200000);
const lim2 = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('12:20'), fimAtendimento: H('12:30'), numeroAtendimento: 'FICT-L2', relatorioCompleto: `<p>${'a'.repeat(200000 - 6)}</p>` }), dA.criterios, false, false));
ok('X.4', '1 byte acima de 200 KB é recusado (MI422)', cod(lim2) === 'MI422', cod(lim2));
const lim3 = await tenta(() => db.exec(`begin; set local app.responsavel = '${ADM}'; update public.monitorias set relatorio_completo = repeat('a', 200001), versao_lida = versao where id = '${lim.id}'; commit;`));
await db.exec('rollback').catch(() => {});
ok('X.5', 'nem a manutenção direta passa do limite', lim3.erro);

// ---- backup ------------------------------------------------------------------------------------
const bkCom = (await db.query(sql('backup-completo.sql'))).rows[0];
const lido = lerBackup(JSON.stringify([{ resumo: bkCom.resumo, backup: JSON.stringify(bkCom.backup) }]));
ok('B.1', 'backup traz o relatório e passa na conferência', conferirBackup(lido).length === 0 && linhasDe(lido, 'public.monitorias').some((m) => m.relatorio_completo === RELATORIO), conferirBackup(lido).join('; '));
ok('B.2', 'relatório tem impressão própria no backup', /^[0-9a-f]{32}$/.test(lido.meta.impressoes.relatorios));
ok('B.3', 'auditoria íntegra depois de tudo', await quebras() === 0);

// ---- reversão ----------------------------------------------------------------------------------
const rev1 = await tenta(() => db.exec(sql('17r_reverter_relatorio_completo.sql')));
await db.exec('rollback').catch(() => {});
ok('R.1', '17r recusa enquanto houver relatório gravado', rev1.erro && (await n(`select count(*) n from app.versoes_esquema where versao = '17'`)) === 1);
await db.exec(`begin; set local app.responsavel = '${ADM}'; update public.monitorias set relatorio_completo = null, versao_lida = versao where relatorio_completo is not null; commit;`);
const preRev = await impressoes();
await db.exec(sql('17r_reverter_relatorio_completo.sql'));
const posRev = await impressoes();
const semColuna = await n(`select count(*) n from information_schema.columns where table_schema = 'public' and table_name = 'monitorias' and column_name = 'relatorio_completo'`);
ok('R.2', '17r remove coluna, conferência e versão', semColuna === 0 && (await n(`select count(*) n from app.versoes_esquema where versao = '17'`)) === 0);
ok('R.3', '17r não muda monitorias, respostas, evidências, histórico nem auditoria', ['mon', 'resp', 'evid', 'ev', 'notas', 'aud'].every((c) => preRev[c] === posRev[c]), JSON.stringify([preRev, posRev]));
const posR = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('13:00'), fimAtendimento: H('13:10'), numeroAtendimento: 'FICT-POSR' }), dA.criterios, false, false);
ok('R.4', 'portal continua salvando depois da reversão', posR.status === 'Rascunho');
await db.exec(sql('17_relatorio_completo.sql'));
ok('R.5', 'o 17 reinstala', (await n(`select count(*) n from app.versoes_esquema where versao = '17'`)) === 1);
const posI = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('13:20'), fimAtendimento: H('13:30'), numeroAtendimento: 'FICT-POSI', relatorioCompleto: RELATORIO }), dA.criterios, false, false);
ok('R.6', 'relatório volta a funcionar; auditoria íntegra', (await linha(posI.id)).relatorio_completo === RELATORIO && await quebras() === 0);

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
