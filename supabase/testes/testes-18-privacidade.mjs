// Testes do script 18 (privacidade das monitorias nunca enviadas) num Postgres LOCAL (PGlite), com a
// migração REAL ensaiada (09b), os scripts até o 17 e a camada de dados do PORTAL. Nada sai deste
// computador. Monitorias de teste FICTÍCIAS.
//
// Prova, perfil a perfil: o supervisor não alcança a monitoria nunca enviada por tabela, função ou
// mensagem de erro; a monitora e o Administrador continuam alcançando; o que já foi enviado continua
// visível; instalar não grava nada; o 18r devolve exatamente o estado anterior.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-18-privacidade.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, devolverMonitoria, validarMonitoria, cancelarMonitoria, registrarObservacao } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
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

// ---- banco igual à homologação (até o 17) ---------------------------------------------------
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
  insert into public.perfis (id, email, nome, perfis, status) values
    ('usr-teste-monitora-2', 'monitora2@exemplo.test', 'MONITORA FICTÍCIA 2', array['MONITOR'], 'ACTIVE'),
    ('usr-teste-gestor-2', 'gestor2@exemplo.test', 'GESTOR FICTÍCIO 2', array['GESTOR'], 'ACTIVE');
  insert into auth.users values ('${U(3)}', 'monitora2@exemplo.test', now()), ('${U(4)}', 'gestor2@exemplo.test', now()); commit;`);
await db.exec(sql('14_historico_calibracao.sql'));
await db.exec(sql('15_duplicidade_criacao.sql'));
await db.exec(sql('16_colaboradora_inativa.sql'));
await db.exec(sql('17_relatorio_completo.sql'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
const quebras = () => n('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q');
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
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2)), OUTRA = transporte(U(3)), GESTOR2 = transporte(U(4)), ADMIN = transporte(U(9), 'aal2'), ADMIN_AAL1 = transporte(U(9), 'aal1');
const HOJE = (await um('select app.hoje()::text d')).d;
const COL = 'col-teste-homolog-1';

const dA = await carregarDados(ALINE, PADROES);
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const GAB = () => aplic.map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
let minuto = 0;
const base = (p = {}) => { minuto += 11; const h = String(8 + Math.floor(minuto / 60)).padStart(2, '0'), m = String(minuto % 60).padStart(2, '0');
  return { id: '', competencia: HOJE.slice(0, 7), date: `${HOJE}T12:00:00Z`, colaboradorId: COL, canal: 'Telefone', tipo: 'Regular', categoriaAtendimento: 'BOLETOS',
    numeroAtendimento: `FICT-${minuto}`, numeroTitulo: 'FICT', inicioAtendimento: `${HOJE}T${h}:${m}`, fimAtendimento: `${HOJE}T${h}:${m}`, duracaoMinutos: 1,
    comments: 'MONITORIA FICTÍCIA — TESTE DO SCRIPT 18 (LOCAL).', status: 'Rascunho', finalScore: 0, scores: GAB(), evidencias: [{ name: 'ficticia.pdf', type: 'PDF', size: '1 KB' }], links: ['https://exemplo.invalid/ficticio'], ...p }; };
const enviada = (p = {}) => base({ status: 'Pendente', finalScore: prev(GAB()), ...p });
const salvar = (quem, m, enviar) => salvarMonitoria(quem, m, dA.criterios, false, enviar);
const doBanco = async (quem, id) => (await carregarDados(quem, PADROES)).monitorias.find((m) => m.id === id);
const idsDe = async (quem, tb, campo = 'monitoria_id') => new Set((await quem.selecionar(tb)).map((l) => l[campo]));
const uuid = (k) => `00000000-0000-4000-8000-${String(k).padStart(12, '0')}`;
const impressoes = () => um(`select
  (select md5(coalesce(string_agg(to_jsonb(m)::text, '|' order by m.id), '')) from public.monitorias m) mon,
  (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.monitoria_id, x.criterio_id), '')) from public.monitoria_respostas x) resp,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by to_jsonb(e)::text), '')) from public.monitoria_evidencias e) evid,
  (select md5(coalesce(string_agg(to_jsonb(e)::text, '|' order by e.id), '')) from public.monitoria_eventos e) ev,
  (select count(*) from public.auditoria)::int aud`);
const definicoes = () => um(`select pg_get_functiondef('app.monitoria_para_gestor(text, integer)'::regprocedure) f1, pg_get_functiondef('api.registrar_observacao(text, text, uuid)'::regprocedure) f2,
  (select qual from pg_policies where schemaname = 'public' and tablename = 'monitorias' and policyname = 'monitorias_ler') q`);

// ---- cenário anterior ao 18 -----------------------------------------------------------------
const R1 = await salvar(ALINE, base(), false);
const R2 = await salvar(ALINE, base(), false);                     // será enviado depois do 18
const RC = await salvar(ALINE, base(), false);                     // nunca enviada, cancelada antes do 18
await cancelarMonitoria(ADMIN, await doBanco(ADMIN, RC.id), 'Teste do script 18 (fictício).');
const P1 = await salvar(ALINE, enviada(), true);                   // pendente
const P2 = await salvar(ALINE, enviada(), true);                   // será validada depois do 18
const P3 = await salvar(ALINE, enviada(), true);                   // será devolvida depois do 18
const V1 = await salvar(ALINE, enviada(), true);                   // validada antes do 18
await validarMonitoria(ERIVAN, await doBanco(ERIVAN, V1.id));
const D1 = await salvar(ALINE, enviada(), true);                   // devolvida antes do 18
await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, D1.id), 'Corrigir (fictício).');
const CE = await salvar(ALINE, enviada(), true);                   // enviada e cancelada
await cancelarMonitoria(ADMIN, await doBanco(ADMIN, CE.id), 'Teste do script 18 (fictício).');
const O1 = await salvar(OUTRA, base({ inicioAtendimento: `${HOJE}T20:00`, fimAtendimento: `${HOJE}T20:01` }), false).catch(() => null);
// Migrada já enviada no portal antigo e devolvida aqui: Rascunho, sem data de envio neste banco (caso real da MON-10001).
const MIG_SIM = (await um(`select id from public.monitorias where status = 'Pendente' and origem = 'migracao' and enviada_na_origem is true order by id limit 1`))?.id;
if (MIG_SIM) await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, MIG_SIM), 'Corrigir (fictício).');
const MIG_NAO = (await um(`select id from public.monitorias where status = 'Rascunho' and origem = 'migracao' and enviada_na_origem is false order by id limit 1`))?.id;

const PRIVADAS = [R1.id, R2.id, RC.id];
const ENVIADAS = [P1.id, P2.id, P3.id, V1.id, D1.id, CE.id];
const verAntes = await idsDe(ERIVAN, 'monitorias', 'id');
ok('B.0', 'antes do 18 o supervisor alcança os rascunhos (é o que o script corrige)', verAntes.has(R1.id) && verAntes.has(RC.id));
const defAntes = await definicoes();
const antes = await impressoes();
const totalAntes = await n('select count(*) n from public.monitorias');

// ---- instalação -----------------------------------------------------------------------------
await db.exec(sql('18_privacidade_monitorias.sql'));
const depois = await impressoes();
ok('A.1', 'instalar não muda monitorias, respostas, evidências nem histórico', ['mon', 'resp', 'evid', 'ev'].every((k) => antes[k] === depois[k]), JSON.stringify([antes, depois]));
ok('A.2', 'instalar não grava nada na auditoria', depois.aud === antes.aud, `${antes.aud} → ${depois.aud}`);
ok('A.3', 'auditoria íntegra', await quebras() === 0);
const rep = await tenta(() => db.exec(sql('18_privacidade_monitorias.sql')));
await db.exec('rollback').catch(() => {});
ok('A.4', 'o 18 não instala duas vezes', rep.erro && /já instalado/.test(rep.erro.message));

// ---- supervisor: leitura --------------------------------------------------------------------
for (const [tb, campo, nome] of [['monitorias', 'id', 'monitorias'], ['monitoria_respostas', 'monitoria_id', 'respostas'], ['monitoria_evidencias', 'monitoria_id', 'evidências'], ['monitoria_eventos', 'monitoria_id', 'histórico']]) {
  const vistos = await idsDe(ERIVAN, tb, campo);
  ok(`S.${nome}`, `supervisor não alcança privada em ${nome}`, PRIVADAS.every((id) => !vistos.has(id)), JSON.stringify(PRIVADAS.filter((id) => vistos.has(id))));
}
const dE = await carregarDados(ERIVAN, PADROES);
ok('S.portal', 'a carga do portal do supervisor não traz privada (telas, CSV, PDF, painéis e link direto usam esta lista)', PRIVADAS.every((id) => !dE.monitorias.some((m) => m.id === id)));
const consulta = (id) => ERIVAN.sql('select count(*)::int n from public.monitorias where id = $1', [id]);
ok('S.direta', 'consulta direta pelo código não devolve a privada', (await consulta(R1.id))[0].n === 0);
const respDir = await ERIVAN.sql('select count(*)::int n from public.monitoria_respostas where monitoria_id = $1', [R1.id]);
ok('S.direta2', 'consulta direta às respostas da privada não devolve nada', respDir[0].n === 0 && await n('select count(*) n from public.monitoria_respostas where monitoria_id = $1', [R1.id]) > 0);
const fila = await ERIVAN.sql('select id from api.fila_validacao()');
ok('S.fila', 'fila de validação sem privada e com as pendentes', fila.every((l) => !PRIVADAS.includes(l.id)) && fila.some((l) => l.id === P1.id));
const agregada = await ERIVAN.sql(`select count(*)::int n from public.monitorias where status in ('Rascunho', 'Cancelada') and enviado_em is null and coalesce(enviada_na_origem, false) = false`);
ok('S.agregada', 'contagem por situação não revela quantas privadas existem', agregada[0].n === 0, JSON.stringify(agregada));
const audE = await tenta(() => ERIVAN.selecionar('auditoria'));
ok('S.auditoria', 'supervisor não lê a auditoria', audE.erro || audE.ok.length === 0);
const origemE = await tenta(() => ERIVAN.sql('select count(*)::int n from app.migracao_origem'));
ok('S.origem', 'supervisor não lê os dados de origem da migração', Boolean(origemE.erro));
const visaoE = await tenta(() => ERIVAN.sql('select count(*)::int n from app.eventos_reconstituiveis'));
ok('S.visao', 'supervisor não lê a visão de reconstituição do histórico', Boolean(visaoE.erro));

// ---- supervisor: funções e mensagens ---------------------------------------------------------
const INEXISTENTE = 'MON-99999';
const resposta = (x) => (x.erro ? `${x.erro.codigo}|${x.erro.message}` : 'SEM ERRO');
const CHAMADAS = [
  ['validar_monitoria', { p_versao_lida: 1 }],
  ['validar_monitoria', { p_versao_lida: null }],
  ['devolver_monitoria', { p_versao_lida: 1, p_motivo: 'x' }],
  ['reprovar_monitoria', { p_versao_lida: 1, p_motivo: 'x' }],
  ['confirmar_zeramento', { p_versao_lida: 1 }],
  ['afastar_eliminatorio', { p_versao_lida: 1, p_motivo: 'x' }],
  ['registrar_observacao', { p_texto: 'x', p_chave: uuid(1) }],
  ['registrar_observacao', { p_texto: '', p_chave: null }],
];
for (const alvo of [R1.id, RC.id]) for (const [f, args] of CHAMADAS) {
  const priv = await tenta(() => ERIVAN.chamar(f, { p_id: alvo, ...args }));
  const nada = await tenta(() => ERIVAN.chamar(f, { p_id: INEXISTENTE, ...args }));
  ok(`F.${f}`, `${f}: privada responde igual a código inexistente`, resposta(priv) === resposta(nada) && /MI404/.test(resposta(priv)), `${resposta(priv)} × ${resposta(nada)}`);
}
const posFuncoes = await impressoes();
ok('F.nada', 'as tentativas do supervisor não gravaram nada', ['mon', 'resp', 'evid', 'ev', 'aud'].every((k) => depois[k] === posFuncoes[k]));
const edita = await tenta(() => ERIVAN.chamar('salvar_monitoria', { p_dados: { id: R1.id, comments: 'invasão' }, p_versao_lida: 1, p_enviar: false }));
ok('F.salvar', 'supervisor não salva monitoria', /MI403/.test(resposta(edita)));
const cancela = await tenta(() => ERIVAN.chamar('cancelar_monitoria', { p_id: R1.id, p_versao_lida: 1, p_motivo: 'x' }));
const cancelaNada = await tenta(() => ERIVAN.chamar('cancelar_monitoria', { p_id: INEXISTENTE, p_versao_lida: 1, p_motivo: 'x' }));
ok('F.cancelar', 'cancelar: mesma recusa para privada e inexistente', resposta(cancela) === resposta(cancelaNada) && /MI403/.test(resposta(cancela)));
const dup = await tenta(() => ERIVAN.chamar('cancelar_por_duplicidade', { p_id: R1.id, p_versao_lida: 1, p_original: P1.id }));
ok('F.duplicidade', 'cancelar por duplicidade: só o Administrador', /MI403/.test(resposta(dup)));

// ---- supervisor: o que já foi enviado --------------------------------------------------------
for (const [id, nome] of [[P1.id, 'pendente'], [V1.id, 'validada'], [D1.id, 'devolvida'], [CE.id, 'enviada e cancelada']]) {
  const m = await doBanco(ERIVAN, id);
  ok(`E.${nome}`, `${nome}: continua visível, com respostas e histórico`, m && m.scores.length > 0 && (m.historico ?? []).length > 0, id);
}
ok('E.conjunto', 'todas as enviadas seguem na carga do supervisor', ENVIADAS.every((id) => dE.monitorias.some((m) => m.id === id)));
const V = await validarMonitoria(ERIVAN, await doBanco(ERIVAN, P2.id));
ok('E.validar', 'supervisor continua validando', (await um('select status from public.monitorias where id = $1', [P2.id])).status === 'Validada', JSON.stringify(V));
await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, P3.id), 'Corrigir (fictício).');
ok('E.devolver', 'monitoria devolvida depois do 18 continua visível, apesar de Rascunho', Boolean(await doBanco(ERIVAN, P3.id)));
const ob = await tenta(async () => registrarObservacao(ERIVAN, await doBanco(ERIVAN, V1.id), 'Observação fictícia.', uuid(2)));
ok('E.observacao', 'observação em monitoria enviada continua funcionando', !ob.erro, resposta(ob));
if (MIG_SIM) ok('E.migrada', 'rascunho migrado já enviado no portal antigo continua visível', Boolean(await doBanco(ERIVAN, MIG_SIM)), MIG_SIM);
if (MIG_NAO) ok('E.migrada2', 'rascunho migrado nunca enviado fica privado', !(await doBanco(ERIVAN, MIG_NAO)), MIG_NAO);
ok('E.cenario', 'o cenário traz os dois tipos de rascunho migrado', Boolean(MIG_SIM && MIG_NAO), `${MIG_SIM} ${MIG_NAO}`);

// ---- outros perfis ---------------------------------------------------------------------------
const mA = await doBanco(ALINE, R1.id);
ok('M.ler', 'a monitora alcança a própria privada, com respostas e evidências', mA && mA.scores.length > 0 && mA.evidencias.length > 0);
ok('M.cancelada', 'a monitora alcança a própria cancelada nunca enviada', Boolean(await doBanco(ALINE, RC.id)));
const ed = await salvarMonitoria(ALINE, { ...mA, comments: 'Editado depois do 18 (fictício).' }, dA.criterios, true, false);
ok('M.editar', 'a monitora continua editando o próprio rascunho', ed.status === 'Rascunho');
const vistaOutra = await idsDe(OUTRA, 'monitorias', 'id');
ok('M.outra', 'outra monitora não alcança a privada', PRIVADAS.every((id) => !vistaOutra.has(id)));
if (O1) ok('M.outra2', 'a privada de outra monitora fica fora da carga da Aline', !(await idsDe(ALINE, 'monitorias', 'id')).has(O1.id));
const vistaG2 = await idsDe(GESTOR2, 'monitorias', 'id');
ok('M.gestor2', 'supervisor de fora da equipe não alcança nada desta equipe', [...PRIVADAS, ...ENVIADAS].every((id) => !vistaG2.has(id)));
const vistaAdm = await idsDe(ADMIN, 'monitorias', 'id');
ok('A.admin', 'Administrador com MFA alcança as privadas', PRIVADAS.every((id) => vistaAdm.has(id)) && vistaAdm.size === await n('select count(*) n from public.monitorias'));
ok('A.adminresp', 'Administrador com MFA alcança respostas e auditoria', (await idsDe(ADMIN, 'monitoria_respostas')).has(R1.id) && (await ADMIN.selecionar('auditoria')).length > 0);
const semMfa = await idsDe(ADMIN_AAL1, 'monitorias', 'id');
ok('A.semmfa', 'Administrador sem MFA não alcança', semMfa.size === 0);
await db.exec('begin; set local role anon;');
const anon = await tenta(() => db.query('select count(*) from public.monitorias'));
await db.exec('rollback');
ok('A.anon', 'sem login não há acesso', Boolean(anon.erro));

// ---- transições ------------------------------------------------------------------------------
const audAntes = await nAud();
const R2b = await doBanco(ALINE, R2.id);
const env = await salvarMonitoria(ALINE, { ...R2b, status: 'Pendente', finalScore: prev(GAB()) }, dA.criterios, true, true);
const vis = await doBanco(ERIVAN, R2.id);
ok('T.envio', 'ao enviar, fica visível na hora, com respostas e o registro de envio', env.status === 'Pendente' && vis && vis.scores.length > 0 && vis.historico.some((e) => e.tipo === 'ENVIO'));
ok('T.fila', 'e entra na fila de validação', (await ERIVAN.sql('select id from api.fila_validacao()')).some((l) => l.id === R2.id));
ok('T.auditoria', 'o envio é registrado na auditoria e a cadeia continua íntegra', await nAud() > audAntes && await quebras() === 0);
const R3 = await salvar(ALINE, base(), false);
await cancelarMonitoria(ADMIN, await doBanco(ADMIN, R3.id), 'Teste do script 18 (fictício).');
ok('T.cancelar', 'cancelada sem nunca ter sido enviada continua privada', !(await doBanco(ERIVAN, R3.id)) && Boolean(await doBanco(ALINE, R3.id)));

// ---- guarda e reversão -----------------------------------------------------------------------
const preRev = await impressoes();
await db.exec(sql('18r_reverter_privacidade.sql'));
const posRev = await impressoes();
ok('R.1', '18r não muda monitorias, respostas, evidências, histórico nem auditoria', ['mon', 'resp', 'evid', 'ev', 'aud'].every((k) => preRev[k] === posRev[k]), JSON.stringify([preRev, posRev]));
const defDepois = await definicoes();
ok('R.2', '18r devolve regra de leitura e funções exatamente como eram', defAntes.q === defDepois.q && defAntes.f1 === defDepois.f1 && defAntes.f2 === defDepois.f2);
ok('R.3', '18r remove a função da regra e a versão', (await um(`select to_regprocedure('app.monitoria_privada(text, timestamptz, boolean)') x`)).x === null && await n(`select count(*) n from app.versoes_esquema where versao = '18'`) === 0);
ok('R.4', 'depois do 18r o supervisor volta a alcançar os rascunhos', (await idsDe(ERIVAN, 'monitorias', 'id')).has(R1.id));
await db.exec(sql('18_privacidade_monitorias.sql'));
ok('R.5', 'o 18 reinstala e volta a proteger', !(await idsDe(ERIVAN, 'monitorias', 'id')).has(R1.id) && await quebras() === 0);
await db.exec(sql('18r_reverter_privacidade.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}';
  insert into public.monitoria_eventos (monitoria_id, tipo, rodada, versao_monitoria, status_resultante, responsavel_id, origem) values ('${R1.id}', 'ENVIO', 1, 1, 'Pendente', '${ADM}', 'portal'); commit;`);
const guarda = await tenta(() => db.exec(sql('18_privacidade_monitorias.sql')));
await db.exec('rollback').catch(() => {});
ok('R.6', 'o 18 recusa instalar se monitoria com envio no histórico fosse ficar privada', guarda.erro && /com envio no histórico/.test(guarda.erro.message) && await n(`select count(*) n from app.versoes_esquema where versao = '18'`) === 0, guarda.erro?.message);
ok('Z.total', 'nenhuma monitoria anterior foi perdida', await n('select count(*) n from public.monitorias') >= totalAntes);

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`
${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
