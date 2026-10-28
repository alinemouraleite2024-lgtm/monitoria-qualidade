// Testes do script 14 (histórico de calibração, Etapa B) num Postgres LOCAL (PGlite), com
// a migração REAL ensaiada (09b), os scripts 10, 12, 12a e 11a, e a camada de dados do PORTAL.
// Nada sai deste computador. Saída: só identificadores, situações, notas e códigos de erro.
//
// Prova: integridade da auditoria existente; envios, reenvios e decisões gravados juntos com a
// mudança; observação complementar sem tocar a monitoria; duplicidade bloqueada; leitura só
// no escopo de cada perfil; reconstituição pela auditoria sem texto inventado.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-14-historico.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, validarMonitoria, devolverMonitoria, reprovarMonitoria, confirmarZeramento, registrarObservacao } = await mod('src/shared/compartilhado/dados.ts');
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

// ---- banco igual à homologação ----------------------------------------------------------------
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
// segunda monitora, FICTÍCIA e só neste banco local, para provar o isolamento da leitura
await db.exec(`begin; set local app.responsavel = '${ADM}';
  insert into public.perfis (id, email, nome, perfis, status) values ('usr-teste-monitora-2', 'monitora2@exemplo.test', 'MONITORA FICTÍCIA 2', array['MONITOR'], 'ACTIVE');
  insert into auth.users values ('${U(3)}', 'monitora2@exemplo.test', now()); commit;`);

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
const quebras = () => n("select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q");

// ---- transporte (o que a Data API faz) ------------------------------------------------------
const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text', p_consideracoes: '::text', p_texto: '::text', p_chave: '::uuid' };
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
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2)), OUTRA = transporte(U(3));
const HOJE = (await um('select app.hoje()::text d')).d;
const COMP = HOJE.slice(0, 7);

let dA = await carregarDados(ALINE, PADROES);
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const GAB = (fase, elim = false) => aplic.map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  if (c.id === 'crit-12' && fase === 1) return { criterionId: c.id, score: 1, lowScoreReason: 'TESTE: comunicação parcial (fictício).', subRespostas: null };
  if (c.id === 'crit-26' && elim) return { criterionId: c.id, score: 0, lowScoreReason: 'TESTE: eliminatório ocorrido (fictício).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
const base = (num) => ({ id: '', competencia: COMP, date: `${HOJE}T12:00:00Z`, colaboradorId: 'col-teste-homolog-1', canal: 'Telefone', tipo: 'Calibração',
  categoriaAtendimento: 'BOLETOS', numeroAtendimento: `VIAB-14-${num}`, numeroTitulo: 'TESTE', inicioAtendimento: `${HOJE}T09:00`, fimAtendimento: `${HOJE}T09:10`, duracaoMinutos: 10,
  comments: 'MONITORIA FICTÍCIA — VIABILIDADE DO SCRIPT 14 (LOCAL).', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [] });
const doBanco = async (quem, id) => (await carregarDados(quem, PADROES)).monitorias.find((m) => m.id === id);
const criarEEnviar = async (num, scores) => {
  const r1 = await salvarMonitoria(ALINE, base(num), dA.criterios, false, false);
  dA = await carregarDados(ALINE, PADROES);
  const mv = dA.monitorias.find((m) => m.id === r1.id);
  return salvarMonitoria(ALINE, { ...mv, scores, status: 'Pendente', finalScore: prev(scores) }, dA.criterios, true, true);
};

// ---- 0. ANTES do 14: uma monitoria percorre o fluxo inteiro (vira matéria da reconstituição) ---
const A0 = await criarEEnviar('A', GAB(1));
const A = A0.id;
await devolverMonitoria(ERIVAN, await doBanco(ERIVAN, A), 'TESTE: revisar o critério 12.');
dA = await carregarDados(ALINE, PADROES);
await salvarMonitoria(ALINE, { ...dA.monitorias.find((m) => m.id === A), scores: GAB(2), status: 'Pendente', finalScore: prev(GAB(2)) }, dA.criterios, true, true);
await validarMonitoria(ERIVAN, await doBanco(ERIVAN, A));
const notasA = (await db.query(`select (depois ->> 'nota') nota, depois ->> 'status' st from public.auditoria where tabela = 'monitorias' and chave ->> 'id' = $1 and acao = 'UPDATE' and (antes ->> 'status') is distinct from (depois ->> 'status') order by seq`, [A])).rows;

const semHist = await carregarDados(ERIVAN, PADROES);
ok('V.0', 'ANTES do 14 o portal novo carrega normalmente, e as monitorias ficam sem histórico (indisponível, não "vazio")',
   semHist.monitorias.length > 0 && semHist.monitorias.every((m) => m.historico === undefined));

const foto = async () => JSON.stringify((await db.query('select id, status, versao, nota, aprovado_por, revisado_por, motivo_ajuste from public.monitorias order by id')).rows);
const antes14 = { mon: await foto(), aud: await n('select count(*) n from public.auditoria'), ancora: (await um('select hash from public.auditoria order by seq desc limit 1')).hash };

// ---- 1. aplicação do 14 ---------------------------------------------------------------------
let e = null; try { await db.exec(sql('14_historico_calibracao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('V.1', 'script 14 aplicado numa transação', !e, e?.message);
e = null; try { await db.exec(sql('14_historico_calibracao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('V.2', 'rodar de novo não quebra nada (idempotente)', !e, e?.message);
ok('V.3', 'o 14 não alterou nenhuma monitoria e não mexeu na auditoria existente (mesma contagem, mesma âncora, 0 quebras)',
   (await foto()) === antes14.mon && (await n('select count(*) n from public.auditoria')) === antes14.aud
   && (await um('select hash from public.auditoria order by seq desc limit 1')).hash === antes14.ancora && (await quebras()) === 0);
ok('V.4', 'o histórico começa vazio (nada é criado sem pedido)', (await n('select count(*) n from public.monitoria_eventos')) === 0);

// ---- 2. reconstituição (regras 8 e 9) -------------------------------------------------------
const rec = async () => { await db.exec(`begin; set local app.responsavel = '${ADM}';`); try { const x = (await um('select app.reconstituir_eventos() n')).n; await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw x; } };
const semDecl = await tenta(async () => { await db.exec('begin'); try { await db.query('select app.reconstituir_eventos()'); await db.exec('commit'); } catch (x) { await db.exec('rollback'); throw x; } });
ok('V.5', 'reconstituir sem declarar o ADMIN responsável é recusado pelo 06 (MI401) e não grava nada',
   semDecl.erro?.code === 'MI401' && (await n('select count(*) n from public.monitoria_eventos')) === 0, semDecl.erro?.message);
const previa = (await db.query("select * from app.eventos_reconstituiveis order by auditoria_seq")).rows;
const conf14 = await tenta(async () => (await db.exec(readFileSync(join(projeto, 'supabase/sql/conferencia-14-reconstituicao.sql'), 'utf8'))));
const recuperaveis = previa.filter((x) => x.situacao === 'recuperável');
ok('V.5b', `consulta SÓ LEITURA (conferencia-14): ${recuperaveis.length} recuperáveis, ${previa.length - recuperaveis.length} descartados — fonte, via e limitações em cada linha; nada gravado`,
   !conf14.erro && recuperaveis.length === 4 && previa.every((x) => x.auditoria_seq && x.situacao)
   && previa.filter((x) => x.monitoria_id === 'MON-10001' || x.monitoria_id === 'MON-10002').every((x) => /^descartado: inclusão pela migração/.test(x.situacao))
   && recuperaveis.find((x) => x.tipo === 'VALIDACAO')?.limitacoes.includes('regra 9')
   && (await n('select count(*) n from public.monitoria_eventos')) === 0, conf14.erro?.message ?? JSON.stringify(previa.map((x) => [x.monitoria_id, x.tipo, x.situacao])));
const nRec = await rec();
const evA = (await db.query('select tipo, rodada, nota::text nota, consideracoes, origem, responsavel_id, auditoria_seq from public.monitoria_eventos where monitoria_id = $1 order by id', [A])).rows;
ok('V.6', `reconstituídos ${nRec} eventos da monitoria de teste: ${evA.map((x) => `${x.tipo}/r${x.rodada}/${x.nota}`).join(' → ')}`,
   evA.map((x) => x.tipo).join() === 'ENVIO,DEVOLUCAO,REENVIO,VALIDACAO' && evA.map((x) => x.rodada).join() === '1,1,2,2'
   && evA.every((x) => x.origem === 'reconstituido' && x.auditoria_seq), JSON.stringify(evA));
ok('V.7', 'notas reconstituídas = notas da auditoria em cada rodada (1º envio e reenvio diferentes)',
   Number(evA[0].nota) === Number(notasA[0].nota) && Number(evA[2].nota) === Number(notasA[2].nota) && evA[0].nota !== evA[2].nota, JSON.stringify(notasA));
ok('V.8', 'regra 9: validação reconstituída SEM considerações; devolução com o motivo que já estava gravado',
   evA[3].consideracoes === null && evA[1].consideracoes === 'TESTE: revisar o critério 12.');
ok('V.9', 'responsáveis reconstituídos: envios da Aline (usr-1), decisões do Erivan', evA[0].responsavel_id === 'usr-1' && evA[2].responsavel_id === 'usr-1'
   && evA[1].responsavel_id === evA[3].responsavel_id && evA[1].responsavel_id !== 'usr-1');
ok('V.10', 'inclusões da migração (MON-10001/10002) NÃO viram eventos inventados',
   (await n("select count(*) n from public.monitoria_eventos where monitoria_id in ('MON-10001','MON-10002')")) === 0);
ok('V.11', 'reconstituir de novo não duplica (0 novos)', (await rec()) === 0);
const gravados = (await db.query("select auditoria_seq::text s, tipo, rodada, nota::text nota from public.monitoria_eventos where origem = 'reconstituido' order by auditoria_seq")).rows;
ok('V.11b', 'o que foi gravado é exatamente o que a consulta de leitura mostrou (mesmas linhas, tipos, rodadas e notas)',
   JSON.stringify(gravados) === JSON.stringify(recuperaveis.map((x) => ({ s: String(x.auditoria_seq), tipo: x.tipo, rodada: x.rodada, nota: x.nota === null ? null : String(x.nota) }))),
   JSON.stringify({ gravados, recuperaveis: recuperaveis.map((x) => [x.auditoria_seq, x.tipo, x.rodada, x.nota]) }));
ok('V.11c', 'depois de gravar, a consulta marca essas linhas como "já no histórico"',
   (await n("select count(*) n from app.eventos_reconstituiveis where situacao = 'recuperável'")) === 0);

// ---- 3. fluxo novo com o gatilho -----------------------------------------------------------
const evs = async (id) => (await db.query('select id, tipo, rodada, versao_monitoria v, status_resultante st, nota::text nota, consideracoes c, criterios, responsavel_id resp, origem from public.monitoria_eventos where monitoria_id = $1 order by id', [id])).rows;
const B0 = await criarEEnviar('B', GAB(1));
const B = B0.id;
let eB = await evs(B);
ok('V.12', `rascunho não gera evento; envio gera ENVIO r1 com a nota do banco (${eB[0]?.nota}) e a versão produzida`,
   eB.length === 1 && eB[0].tipo === 'ENVIO' && eB[0].rodada === 1 && Number(eB[0].nota) === B0.nota && eB[0].v === B0.versao && eB[0].resp === 'usr-1' && eB[0].origem === 'portal');

const mB = await doBanco(ERIVAN, B);
const longo = 'x'.repeat(2001);
const dLong = await tenta(() => devolverMonitoria(ERIVAN, mB, longo));
ok('V.13', 'devolver com 2.001 caracteres → MI422, nada gravado', dLong.erro?.codigo === 'MI422' && (await evs(B)).length === 1, dLong.erro?.message);
const dVazio = await tenta(() => devolverMonitoria(ERIVAN, mB, '   '));
ok('V.14', 'devolver sem motivo → MI422 (regra 5)', dVazio.erro?.codigo === 'MI422');
const d1 = await tenta(() => devolverMonitoria(ERIVAN, mB, 'TESTE: revisar o critério 12 (rodada 1).'));
const dRep = await tenta(() => devolverMonitoria(ERIVAN, mB, 'TESTE: revisar o critério 12 (rodada 1).'));
eB = await evs(B);
ok('V.15', `duplicidade: a mesma devolução repetida (mesma versão lida) → ${dRep.erro?.codigo}; um único evento DEVOLUCAO`,
   !d1.erro && dRep.erro?.codigo === 'MI409' && eB.filter((x) => x.tipo === 'DEVOLUCAO').length === 1, d1.erro?.message);
dA = await carregarDados(ALINE, PADROES);
const r2 = await salvarMonitoria(ALINE, { ...dA.monitorias.find((m) => m.id === B), scores: GAB(2), status: 'Pendente', finalScore: prev(GAB(2)) }, dA.criterios, true, true);
eB = await evs(B);
ok('V.16', `reenvio → REENVIO r2 com a nota nova (${eB[2]?.nota} ≠ ${eB[0]?.nota})`, eB[2]?.tipo === 'REENVIO' && eB[2].rodada === 2 && Number(eB[2].nota) === r2.nota && eB[2].nota !== eB[0].nota);

const mB2 = await doBanco(ERIVAN, B);
const vLong = await tenta(() => ERIVAN.chamar('validar_monitoria', { p_id: B, p_versao_lida: mB2.versao, p_consideracoes: longo }));
ok('V.17', 'validar com considerações de 2.001 caracteres → MI422; monitoria continua Pendente, sem evento', vLong.erro?.codigo === 'MI422'
   && (await um('select status from public.monitorias where id = $1', [B])).status === 'Pendente' && (await evs(B)).length === 3);
const CONS = 'TESTE: boa condução; atenção à confirmação de dados.';
const v1 = await tenta(() => ERIVAN.chamar('validar_monitoria', { p_id: B, p_versao_lida: mB2.versao, p_consideracoes: CONS }));
const vRep = await tenta(() => ERIVAN.chamar('validar_monitoria', { p_id: B, p_versao_lida: mB2.versao, p_consideracoes: CONS }));
eB = await evs(B);
ok('V.18', `validar com considerações → VALIDACAO r2 com o texto e a nota da rodada; repetição → ${vRep.erro?.codigo}, sem segundo evento`,
   !v1.erro && eB.length === 4 && eB[3].tipo === 'VALIDACAO' && eB[3].c === CONS && eB[3].rodada === 2 && Number(eB[3].nota) === r2.nota && vRep.erro?.codigo === 'MI409', v1.erro?.message);
const cfg = (await um("select coalesce(current_setting('app.consideracoes', true), '') v")).v;
ok('V.19', 'a configuração local das considerações não vaza para fora da transação', cfg === '');

// observação complementar (regra 10)
const vB = await um('select versao, status, nota::text nota from public.monitorias where id = $1', [B]);
const CH = '11111111-2222-4333-8444-555555555555';
const o1 = await tenta(() => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: 'TESTE: observação complementar.', p_chave: CH }));
const o2 = await tenta(() => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: 'TESTE: observação complementar.', p_chave: CH }));
const o3 = await tenta(() => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: 'TESTE: outro texto com a mesma chave.', p_chave: CH }));
const vB2 = await um('select versao, status, nota::text nota from public.monitorias where id = $1', [B]);
eB = await evs(B);
ok('V.20', `observação: grava 1 evento; repetir a mesma requisição devolve o mesmo (id ${o2.ok?.id} = ${o1.ok?.id}); mesma chave com outro texto → ${o3.erro?.codigo}`,
   !o1.erro && o2.ok?.id === o1.ok?.id && o3.erro?.codigo === 'MI409' && eB.filter((x) => x.tipo === 'OBSERVACAO').length === 1, o1.erro?.message);
ok('V.21', 'a observação NÃO muda a monitoria: versão, situação e nota iguais', JSON.stringify(vB) === JSON.stringify(vB2));
const oAl = await tenta(() => ALINE.chamar('registrar_observacao', { p_id: B, p_texto: 'x', p_chave: '21111111-2222-4333-8444-555555555555' }));
const oVaz = await tenta(() => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: ' ', p_chave: '31111111-2222-4333-8444-555555555555' }));
const oLon = await tenta(() => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: longo, p_chave: '41111111-2222-4333-8444-555555555555' }));
const oSem = await tenta(() => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: 'x', p_chave: null }));
ok('V.22', `observação: monitora → ${oAl.erro?.codigo}; vazia → ${oVaz.erro?.codigo}; 2.001 caracteres → ${oLon.erro?.codigo}; sem chave → ${oSem.erro?.codigo}`,
   oAl.erro?.codigo === 'MI403' && oVaz.erro?.codigo === 'MI422' && oLon.erro?.codigo === 'MI422' && oSem.erro?.codigo === 'MI428');

// zeramento (regra 7) e chamada antiga do portal (sem p_consideracoes)
const C0 = await criarEEnviar('C', GAB(2, true));
const C = C0.id;
const mC = await doBanco(ERIVAN, C);
const vAntesZ = await tenta(() => validarMonitoria(ERIVAN, mC));
ok('V.23', `eliminatório pendente: validar continua bloqueado (${vAntesZ.erro?.codigo}), sem evento`, vAntesZ.erro?.codigo === 'MI422' && (await evs(C)).length === 1);
const z = await tenta(() => confirmarZeramento(ERIVAN, mC));
let eC = await evs(C);
const zev = eC.find((x) => x.tipo === 'ZERAMENTO_CONFIRMADO');
ok('V.24', `confirmação de zeramento → evento próprio com o critério ${JSON.stringify(zev?.criterios)}, responsável ${zev?.resp}, nota ${zev?.nota}`,
   !z.erro && zev && zev.criterios?.length === 1 && zev.criterios[0].id === 'crit-26' && zev.criterios[0].nome && zev.resp !== 'usr-1' && Number(zev.nota) === 0, z.erro?.message);
const vC = await tenta(async () => validarMonitoria(ERIVAN, await doBanco(ERIVAN, C)));
eC = await evs(C);
ok('V.25', 'a chamada ANTIGA do portal (validar sem considerações) continua funcionando: VALIDACAO sem texto',
   !vC.erro && eC.at(-1).tipo === 'VALIDACAO' && eC.at(-1).c === null, vC.erro?.message);

// reprovação
const D0 = await criarEEnviar('D', GAB(2));
const rp = await tenta(async () => reprovarMonitoria(ERIVAN, await doBanco(ERIVAN, D0.id), 'TESTE: reprovação definitiva (fictícia).'));
const eD = await evs(D0.id);
ok('V.26', 'reprovar → REPROVACAO com o motivo', !rp.erro && eD.at(-1).tipo === 'REPROVACAO' && eD.at(-1).c === 'TESTE: reprovação definitiva (fictícia).' && eD.at(-1).st === 'Reprovada', rp.erro?.message);

// recusas não deixam rastro no histórico
const total = await n('select count(*) n from public.monitoria_eventos');
const ali = await tenta(async () => validarMonitoria(ALINE, await doBanco(ALINE, B)));
ok('V.27', 'decisão recusada (monitora tentando validar) não grava evento', ali.erro && (await n('select count(*) n from public.monitoria_eventos')) === total);

// ---- 4. escrita direta: ninguém grava, altera ou apaga -------------------------------------------
const ins = await tenta(() => ALINE.incluir('monitoria_eventos', { monitoria_id: B, tipo: 'VALIDACAO', rodada: 9, versao_monitoria: 999, status_resultante: 'Validada', responsavel_id: 'usr-1' }));
const upd = await tenta(() => ERIVAN.sql("update public.monitoria_eventos set consideracoes = 'alterado' where monitoria_id = $1", [B]));
const del = await tenta(() => ERIVAN.sql('delete from public.monitoria_eventos where monitoria_id = $1', [B]));
ok('V.28', `pela Data API: incluir → ${ins.erro?.codigo}; alterar → ${upd.erro?.codigo}; apagar → ${del.erro?.codigo}`,
   ins.erro?.codigo === '42501' && upd.erro?.codigo === '42501' && del.erro?.codigo === '42501');
const direto = async (q) => { await db.exec(`begin; set local app.responsavel = '${ADM}';`); try { await db.query(q); await db.exec('commit'); return null; } catch (x) { await db.exec('rollback'); return x; } };
const u2 = await direto("update public.monitoria_eventos set consideracoes = 'alterado' where tipo = 'VALIDACAO'");
const d2 = await direto('delete from public.monitoria_eventos');
const t2 = await direto('truncate public.monitoria_eventos');
ok('V.29', `direto no banco, mesmo como ADMIN declarado: alterar → ${u2?.code}; apagar → ${d2?.code}; TRUNCATE → ${t2?.code}`,
   u2?.code === 'MI403' && !!d2 && !!t2 && (await n('select count(*) n from public.monitoria_eventos')) === total);

// ---- 5. leitura no escopo de cada perfil ---------------------------------------------------------
const lAline = await ALINE.selecionar('monitoria_eventos');
const lOutra = await OUTRA.selecionar('monitoria_eventos');
const lErivan = await ERIVAN.selecionar('monitoria_eventos');
const anon = await tenta(async () => { await db.exec('begin; set local role anon;'); try { const x = (await db.query('select count(*) n from public.monitoria_eventos')).rows; await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw x; } });
ok('V.30', `Aline (autora) vê os ${lAline.length} eventos das suas monitorias, inclusive as considerações da validação (regra 1)`,
   lAline.length === total && lAline.some((x) => x.consideracoes === CONS));
ok('V.31', `outra monitora vê ${lOutra.length} eventos (nenhum das monitorias da Aline); gestor da equipe vê ${lErivan.length}`, lOutra.length === 0 && lErivan.length === total);
ok('V.32', `anônimo não lê (${anon.erro?.code})`, anon.erro?.code === '42501');

// ---- 5b. a camada de dados do portal --------------------------------------------------------
const E0 = await criarEEnviar('E', GAB(2));
const viaPortal = await tenta(async () => validarMonitoria(ERIVAN, await doBanco(ERIVAN, E0.id), '  TESTE: considerações pelo portal.  '));
const obsPortal = await tenta(async () => registrarObservacao(ERIVAN, await doBanco(ERIVAN, E0.id), 'TESTE: observação pelo portal.', '51111111-2222-4333-8444-555555555555'));
const obsDe = await tenta(async () => registrarObservacao(ERIVAN, await doBanco(ERIVAN, E0.id), 'TESTE: observação pelo portal.', '51111111-2222-4333-8444-555555555555'));
const vistaAline = (await carregarDados(ALINE, PADROES)).monitorias.find((m) => m.id === E0.id);
const hE = vistaAline?.historico ?? [];
ok('V.36b', `portal: validar com considerações (aparadas) e observação repetida pela mesma chave → ${hE.map((x) => x.tipo).join(', ')}`,
   !viaPortal.erro && !obsPortal.erro && !obsDe.erro && hE.map((x) => x.tipo).join() === 'ENVIO,VALIDACAO,OBSERVACAO'
   && hE[1].consideracoes === 'TESTE: considerações pelo portal.' && typeof hE[0].nota === 'number' && hE[0].responsavelId === 'usr-1', viaPortal.erro?.message ?? obsPortal.erro?.message);
const vistaOutra = (await carregarDados(OUTRA, PADROES)).monitorias;
ok('V.36c', 'portal: a outra monitora não recebe as monitorias nem o histórico da Aline', !vistaOutra.some((m) => m.id === E0.id));

// ---- 5c. backup e restauração (procedimento do BACKUP-RESTAURACAO.md) -------------------------
const copia = (await db.query('select * from public.monitoria_eventos order by id')).rows;
const restaurar = async () => {
  await db.exec("begin; set local app.responsavel = '" + ADM + "'; set local app.manutencao = 'restauracao'; set local app.manutencao_motivo = 'Ensaio local de restauração do histórico (script 14)';");
  try {
    await db.query('delete from public.monitoria_eventos');
    for (const e of copia) {
      const ks = Object.keys(e);
      await db.query(`insert into public.monitoria_eventos (${ks.join(', ')}) overriding system value values (${ks.map((_, i) => '$' + (i + 1)).join(', ')})`,
        ks.map((k) => (k === 'criterios' && e[k] !== null ? JSON.stringify(e[k]) : e[k])));
    }
    await db.query("select setval(pg_get_serial_sequence('public.monitoria_eventos', 'id'), (select max(id) from public.monitoria_eventos))");
    // regravar uma monitoria durante a restauração NÃO gera evento (o histórico vem do backup)
    await db.query("update public.monitorias set status = 'Pendente', versao_lida = versao where id = $1", [D0.id]);
    await db.query("update public.monitorias set status = 'Reprovada', versao_lida = versao where id = $1", [D0.id]);
    await db.exec('commit'); return null;
  } catch (x) { await db.exec('rollback'); return x; }
};
const semModo = await tenta(async () => { await db.exec(`begin; set local app.responsavel = '${ADM}';`); try { await db.query('delete from public.monitoria_eventos'); await db.exec('commit'); } catch (x) { await db.exec('rollback'); throw x; } });
ok('V.37', `apagar o histórico fora do modo de restauração é recusado (${semModo.erro?.code})`, !!semModo.erro && (await n('select count(*) n from public.monitoria_eventos')) === copia.length);
const er = await restaurar();
const depoisR = (await db.query('select * from public.monitoria_eventos order by id')).rows;
ok('V.38', `restauração (modo autorizado, com motivo): ${depoisR.length} eventos de volta, idênticos ao backup; regravar monitorias não criou evento`,
   !er && JSON.stringify(depoisR) === JSON.stringify(copia), er?.message);
const novoDepois = await tenta(async () => ERIVAN.chamar('registrar_observacao', { p_id: B, p_texto: 'TESTE: depois da restauração.', p_chave: '61111111-2222-4333-8444-555555555555' }));
ok('V.39', 'depois da restauração, novos eventos continuam sendo gravados (numeração sem colisão)', !novoDepois.erro && Number(novoDepois.ok.id) > Math.max(...copia.map((x) => Number(x.id))), novoDepois.erro?.message);

// ---- 6. integridade -------------------------------------------------------------------------------
const audEv = await n("select count(distinct chave ->> 'id') n from public.auditoria where tabela = 'monitoria_eventos' and acao = 'INSERT'");
const total2 = await n('select count(*) n from public.monitoria_eventos');
const mesmaTx = await n(`select count(*) n from public.monitoria_eventos e where e.origem = 'portal' and not exists (
   select 1 from public.auditoria x join public.auditoria y on y.transacao = x.transacao
    where x.tabela = 'monitoria_eventos' and x.chave ->> 'id' = e.id::text and (y.tabela = 'monitorias' and y.chave ->> 'id' = e.monitoria_id or e.tipo = 'OBSERVACAO'))`);
ok('V.33', `cada evento tem a sua linha de auditoria (${audEv} = ${total2}) e entrou na MESMA transação da mudança da monitoria`, audEv === total2 && mesmaTx === 0);
ok('V.34', 'cadeia da auditoria íntegra do começo ao fim (0 quebras), linhas anteriores ao 14 intactas',
   (await quebras()) === 0 && (await um('select hash from public.auditoria where seq = (select max(seq) from public.auditoria where seq <= $1)', [antes14.aud])) !== undefined);
const semEv = await n(`select count(*) n from public.monitorias m where m.status in ('Pendente','Validada','Reprovada') and m.origem = 'portal'
   and not exists (select 1 from public.monitoria_eventos e where e.monitoria_id = m.id and e.status_resultante = m.status)`);
ok('V.35', 'toda monitoria do portal na situação atual tem o evento correspondente', semEv === 0);
const port = await tenta(() => carregarDados(ERIVAN, PADROES));
ok('V.36', 'o portal atual carrega os dados normalmente com o 14 aplicado', !port.erro, port.erro?.message);

relatorio();
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
