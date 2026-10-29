// Testes do BACKUP MANUAL (sql/backup-completo.sql) e da RESTAURAÇÃO (backup/restauracao.mjs),
// num Postgres LOCAL (PGlite), com DADOS 100% SINTÉTICOS (migração sintética do gerar-09, como na
// suíte do portal compartilhado). Nada sai deste computador; nada toca o Supabase.
//
// Prova: a consulta só lê; o arquivo traz todas as tabelas (inclusive o histórico de calibração e
// a auditoria) e acusa corte; a restauração num banco novo e no mesmo banco devolve exatamente o
// estado do backup — contagens, impressões digitais e a CADEIA DA AUDITORIA com os elos originais —,
// e o sistema continua funcionando e encadeando depois dela.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-backup.mjs <projeto> <pasta reguas>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto, pastaReguas] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, perfilDoLogin, salvarMonitoria, validarMonitoria, devolverMonitoria, registrarObservacao } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { gerar } = await import(pathToFileURL(join(projeto, 'supabase/migracao/gerar-09.mjs')).href);
const { lerBackup, conferirBackup, gerarRestauracao, linhasDe, TABELAS } = await import(pathToFileURL(join(projeto, 'supabase/backup/restauracao.mjs')).href);
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const regua = (r) => JSON.parse(readFileSync(join(pastaReguas, `${r}.json`), 'utf8'));
const R1 = regua('v0.25.0'), R024 = regua('v0.24.0'), RHEAD = regua('HEAD');

const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });
const relatorio = () => { for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };
definirModoParaTeste(true);
const SCRIPTS = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql'];
const novoBanco = async (com14 = true) => {
  const d = await PGlite.create({ extensions: { pgcrypto } });
  await d.exec(SETUP);
  for (const f of SCRIPTS) await d.exec(sql(f));
  if (com14) await d.exec(sql('14_historico_calibracao.sql'));
  await d.exec("set timezone = 'UTC'");
  return d;
};

// ---- banco A: migração sintética, ADMIN sintético, script 14 -----------------------------------
const db = await novoBanco(false);
const DECLARACAO = 'Pessoa Responsável Sintética <responsavel@exemplo.test>';
const ADM = 'adm-sintetico';
const crit = R1.criterios;
const pessoa = (id, n, perfis) => ({ id, email: `${n}@exemplo.test`, name: `Pessoa ${n}`, password: `Senha-${n}-sintetica`, status: 'ACTIVE', cargo: 'X', perfis });
const dadosLS = {
  pm2_users: [pessoa('usr-1', 'monitora1', ['MONITOR']), pessoa('usr-4', 'pessoa4', []), pessoa('usr-5', 'pessoa5', [])],
  pm2_collaborators: ['usr-1', 'usr-4', 'usr-5'].map((id) => ({ id, email: `${id}@exemplo.test`, name: `Colaborador ${id}`, cargo: 'Front', active: true, areaId: 'area-1' })),
  pm2_areas: [{ id: 'area-1', name: 'Relacionamento', gestorId: '', monitorIds: [], active: true }],
  pm2_criteria: crit, pm2_catalog_categorias: ['BOLETOS', 'CADASTRO'], pm2_settings: { requireGestorValidation: true, defasagemCompetencia: 1 },
  pm2_brand: { id: 'b', name: 'MonitorIA', logoUrl: '', primaryColor: '#166534', secondaryColor: '#f28c1c', backgroundColor: '#fff', textColor: '#111' },
  pm2_monitorings: [{ id: 'MON-10001', monitorId: 'usr-1', colaboradorId: '', competencia: '2026-09', date: '2026-10-06T12:00:00Z', canal: '', protocolo: 'MON-2026-0001',
    status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [], eliminatoryPending: false, zerada: false }],
};
const exportacao = JSON.stringify({ meta: { exportadoEm: '2026-10-13T12:00:00.000Z', origem: 'https://sintetico.exemplo.test', versaoBanco: '11' },
  dados: Object.fromEntries(Object.entries(dadosLS).map(([k, v]) => [k, JSON.stringify(v)])) });
const G = gerar({ exportacaoBruta: exportacao, regua1: R1, regua1Anterior: R024, reguaCodigo: RHEAD, agora: 1789000000000, decisoes: {
  responsavel_implantacao: DECLARACAO,
  novos_perfis: [{ apelido: 'gestor', email: 'supervisor@exemplo.test', nome: 'Supervisor Sintético', perfis: ['GESTOR'] }],
  areas: { 'area-1': { gestor: '@gestor', monitores: ['usr-1'] } },
  regua1: { vigente_desde: '2026-08-31', anterior: 'x', datas: { commit_codigo: { data: '2026-08-31', situacao: 'comprovada' }, publicacao_producao: { situacao: 'nao_comprovada' } } },
  regua2: { vigente_desde: '2026-10-12' },
} });
await db.exec(G.sql);
// logins primeiro (o 01 liga o perfil pelo e-mail); o ADMIN sintético por último, como no 12a
await db.exec(`begin; set local app.responsavel = '${DECLARACAO}';
  insert into auth.users values ('${U(1)}', 'monitora1@exemplo.test', now()), ('${U(2)}', 'supervisor@exemplo.test', now()); commit;`);
await db.exec(`begin; set local app.responsavel = '${DECLARACAO}';
  insert into public.perfis (id, email, nome, perfis, status) values ('${ADM}', 'admin-sintetico@exemplo.test', 'ADMIN Sintético', array['ADMIN'], 'ACTIVE'); commit;`);

const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text', p_consideracoes: '::text', p_texto: '::text', p_chave: '::uuid' };
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
const transporte = (banco, uid) => {
  const como = async (fn) => {
    await banco.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"aal1"}';`);
    try { const x = await fn(); await banco.exec('commit'); return x; } catch (x) { await banco.exec('rollback'); throw new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  return {
    selecionar: (tb) => como(async () => (await banco.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: (f, args) => como(async () => { const ks = Object.keys(args);
      return normalizar((await banco.query(`select api.${f}(${ks.map((k, i) => `${k} => $${i + 1}${TIPOS[k]}`).join(', ')}) r`, ks.map((k) => (k === 'p_dados' ? JSON.stringify(args[k]) : args[k])))).rows[0].r); }),
    incluir: (tb, linha) => como(async () => { const ks = Object.keys(linha); await banco.query(`insert into public.${tb} (${ks.join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`, ks.map((k) => linha[k])); }),
  };
};
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const HOJE = (await db.query('select app.hoje()::text d')).rows[0].d;

// uso real (sintético): envio, devolução, reenvio, validação com considerações, observação
const fluxo = async (banco, sufixo, com14 = true, logins = [U(1), U(2)]) => {
  const AL = transporte(banco, logins[0]), GE = transporte(banco, logins[1]);
  let dA = await carregarDados(AL, PADROES);
  const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
  const GAB = (f) => aplic.map((c) => c.tipoResposta === 'MULTIPLA_ESCOLHA' ? { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id] ?? c.opcoes?.[0], lowScoreReason: '', subRespostas: null }
    : c.tipoResposta === 'CHECKLIST_SIM_NAO' ? { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) }
    : c.id === 'crit-12' && f === 1 ? { criterionId: c.id, score: 1, lowScoreReason: 'Sintético: comunicação parcial.', subRespostas: null }
    : { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null });
  const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
  const base = { id: '', competencia: HOJE.slice(0, 7), date: `${HOJE}T12:00:00Z`, colaboradorId: 'usr-5', canal: 'Telefone', tipo: 'Regular', categoriaAtendimento: 'BOLETOS',
    numeroAtendimento: `SINT-${sufixo}`, numeroTitulo: 'TIT', inicioAtendimento: `${HOJE}T09:00`, fimAtendimento: `${HOJE}T09:10`, duracaoMinutos: 10,
    comments: 'Monitoria SINTÉTICA de teste de backup.', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [{ id: 'e1', name: 'audio-sintetico.wav', type: 'audio/wav', size: '1.00 MB', date: '01/10/2026' }], links: ['https://exemplo.test/gravacao'] };
  const r1 = await salvarMonitoria(AL, base, dA.criterios, false, false);
  dA = await carregarDados(AL, PADROES);
  await salvarMonitoria(AL, { ...dA.monitorias.find((m) => m.id === r1.id), scores: GAB(1), status: 'Pendente', finalScore: prev(GAB(1)) }, dA.criterios, true, true);
  const pega = async (q) => (await carregarDados(q, PADROES)).monitorias.find((m) => m.id === r1.id);
  await devolverMonitoria(GE, await pega(GE), 'Sintético: rever o critério 12.');
  dA = await carregarDados(AL, PADROES);
  await salvarMonitoria(AL, { ...dA.monitorias.find((m) => m.id === r1.id), scores: GAB(2), status: 'Pendente', finalScore: prev(GAB(2)) }, dA.criterios, true, true);
  // antes do 14 não há considerações nem observação (o banco ainda não as conhece)
  await validarMonitoria(GE, await pega(GE), com14 ? 'Sintético: boa correção.' : undefined);
  if (com14) await registrarObservacao(GE, await pega(GE), 'Sintético: observação complementar.', `5${sufixo.padStart(7, '0')}-2222-4333-8444-555555555555`);
  return r1.id;
};
// antes do 14 (vira matéria da reconstituição), o 14, a reconstituição, e uso depois do 14
const M0 = await fluxo(db, '1', false);
await db.exec(sql('14_historico_calibracao.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}'; select app.reconstituir_eventos(); commit;`);
const M1 = await fluxo(db, '2');
const n = async (banco, q) => Number((await banco.query(q)).rows[0].n);
ok('B.0', `banco A sintético: ${await n(db, 'select count(*) n from public.monitorias')} monitorias, ${await n(db, 'select count(*) n from public.monitoria_eventos')} eventos (reconstituídos e do portal), ${await n(db, 'select count(*) n from public.auditoria')} linhas de auditoria`,
   (await n(db, "select count(*) n from public.monitoria_eventos where origem = 'reconstituido'")) > 0 && (await n(db, "select count(*) n from public.monitoria_eventos where origem = 'portal'")) > 0);

// ---- 1. a consulta de backup ------------------------------------------------------------------
const foto = async (banco) => (await banco.query(`select (select count(*) from public.auditoria)::int aud, (select max(seq) from public.auditoria)::text ultimo,
  (select md5(string_agg(to_jsonb(m)::text, '|' order by m.id)) from public.monitorias m) mon,
  (select count(*) from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q)::int quebras`)).rows[0];
const sqlBackup = sql('backup-completo.sql');
const semComent = sqlBackup.replace(/--.*$/gm, '');
ok('B.1', 'a consulta de backup é um único SELECT, sem nenhum comando que grave',
   !/\b(insert|update|delete|create|drop|alter|truncate|grant|revoke|copy|call|perform|nextval|setval|set_config)\b/i.test(semComent) && (semComent.match(/;/g) || []).length === 1);
const antesA = await foto(db);
const linha = (await db.query(sqlBackup)).rows[0];
ok('B.2', 'rodar o backup não altera nada: auditoria, monitorias e cadeia iguais', JSON.stringify(await foto(db)) === JSON.stringify(antesA));
const exportado = JSON.stringify([{ resumo: linha.resumo, backup: linha.backup }], null, 2);   // como o Export → JSON entrega
const b = lerBackup(exportado);
const prob = conferirBackup(b);
ok('B.3', `resumo: "${linha.resumo}"`, /monitorias/.test(linha.resumo) && /tabelas fora: nenhuma/.test(linha.resumo) && /quebras 0/.test(linha.resumo));
ok('B.4', `arquivo completo: ${TABELAS.length + 1} tabelas, contagens = banco, nenhuma tabela de dados fora, cadeia íntegra no próprio arquivo`, prob.length === 0, prob.join('; '));
const contagens = Object.fromEntries((await db.query(`select 'public.monitoria_eventos' t, count(*)::int n from public.monitoria_eventos union all select 'public.auditoria', count(*) from public.auditoria union all select 'public.monitorias', count(*) from public.monitorias`)).rows.map((x) => [x.t, x.n]));
ok('B.5', `o arquivo traz o histórico (${b.dados['public.monitoria_eventos'].length} eventos, ${linhasDe(b, 'public.monitoria_eventos').filter((e) => e.origem === 'reconstituido').length} reconstituídos) e a auditoria inteira (${b.dados['public.auditoria'].length} linhas)`,
   Object.entries(contagens).every(([k, v]) => b.dados[k].length === v));
ok('B.6', 'o arquivo NÃO contém senha, segredo, nem tabela do Supabase Auth (só a contagem de logins)',
   !/"(password|confirmPassword|senha|encrypted_password|secret)"\s*:/i.test(exportado) && !('auth.users' in b.dados) && typeof b.meta.logins_no_supabase_auth === 'number');
ok('B.7', 'o arquivo também aceita o formato "texto" do Export (coluna JSON como texto)', conferirBackup(lerBackup(JSON.stringify([{ resumo: linha.resumo, backup: JSON.stringify(linha.backup) }]))).length === 0);
// "Download CSV" do SQL Editor (o único download que ele oferece): cabeçalho e uma linha, campo com
// vírgula/aspas entre aspas e "" no lugar de ", fim de linha \r\n.
const csvCampo = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = `resumo,backup\r\n${csvCampo(linha.resumo)},${csvCampo(JSON.stringify(linha.backup))}`;
const csvCortadoProb = (() => { try { return conferirBackup(lerBackup(csv.slice(0, Math.floor(csv.length * 0.9)))); } catch (e) { return [e.message]; } })();
ok('B.7b', `o arquivo também aceita o "Download CSV" (com e sem BOM); CSV cortado → recusado (${csvCortadoProb[0]})`,
   conferirBackup(lerBackup(csv)).length === 0 && conferirBackup(lerBackup('﻿' + csv + '\r\n')).length === 0 && csvCortadoProb.length > 0);
const cortado = exportado.slice(0, Math.floor(exportado.length * 0.9));
const cortadoProb = (() => { try { return conferirBackup(lerBackup(cortado)); } catch (e) { return [`não é JSON válido (${e.message.slice(0, 40)})`]; } })();
const semLinha = structuredClone(b); semLinha.dados['public.auditoria'].splice(5, 1);
const semTabela = structuredClone(b); delete semTabela.dados['public.monitoria_eventos'];
ok('B.8', `arquivo cortado → recusado (${cortadoProb[0]}); uma linha a menos na auditoria → recusado; tabela ausente → recusado`,
   cortadoProb.length > 0 && conferirBackup(semLinha).some((x) => /auditoria/.test(x)) && conferirBackup(semTabela).some((x) => /monitoria_eventos/.test(x)));

// ---- 2. restauração num banco NOVO (desastre: projeto perdido) ----------------------------------
const restSQL = gerarRestauracao(b, { responsavel: ADM, motivo: 'Ensaio sintético de restauração em banco novo', origem: 'teste' });
const dbB = await novoBanco(true);
let e = null; try { await dbB.exec(restSQL); } catch (x) { e = x; await dbB.exec('rollback').catch(() => {}); }
const fB = await foto(dbB);
ok('B.9', `restauração em banco novo aplicada numa transação (SQL de ${Math.round(restSQL.length / 1024)} KB)`, !e, e?.message);
const iguais = async (banco) => { const q = (await banco.query(sqlBackup)).rows[0].backup;
  return { imp: JSON.stringify(q.meta.impressoes) === JSON.stringify(b.meta.impressoes),
           cont: TABELAS.every((tb) => q.meta.contagens[tb] === b.meta.contagens[tb] + (tb === 'public.auditoria' || tb === 'public.acessos_log' ? 1 : 0)) }; };
const igB = await iguais(dbB);
ok('B.10', 'banco novo = backup: todas as tabelas com as mesmas contagens (+1 linha de registro da restauração) e impressões digitais idênticas', igB.imp && igB.cont, JSON.stringify(igB));
const elos = (await dbB.query(`select a.seq::text seq, a.hash, a.hash_anterior from public.auditoria a order by a.seq desc limit 2`)).rows;
ok('B.11', `cadeia da auditoria preservada: 0 quebras; elos originais mantidos; o registro da restauração (seq ${elos[0].seq}) aponta para o último elo do backup`,
   fB.quebras === 0 && elos[1].seq === String(b.meta.auditoria.ultimo_seq) && elos[1].hash === b.meta.auditoria.ultimo_hash && elos[0].hash_anterior === b.meta.auditoria.ultimo_hash,
   JSON.stringify({ quebras: fB.quebras, elos: elos.map((x) => [x.seq, x.hash.slice(0, 8), (x.hash_anterior || '').slice(0, 8)]), meta: [b.meta.auditoria.ultimo_seq, b.meta.auditoria.ultimo_hash.slice(0, 8)] }));
const marca = (await dbB.query("select a.tabela, a.responsavel_declarado d, a.manutencao_modo m from public.auditoria a order by seq desc limit 1")).rows[0];
ok('B.12', `a restauração ficou registrada na auditoria (${marca.tabela}, responsável ${marca.d}, modo ${marca.m})`, marca.tabela === 'acessos_log' && marca.d === ADM && marca.m === 'restauracao');
ok('B.13', 'perfis voltam SEM vínculo de login (o banco novo não tem os logins)', (await n(dbB, 'select count(*) n from public.perfis where auth_user_id is not null')) === 0);
// os logins são refeitos (no Supabase: cada pessoa redefine a senha); o vínculo volta pelo e-mail
await dbB.exec(`begin; set local app.responsavel = '${ADM}'; insert into auth.users values ('${U(7)}', 'monitora1@exemplo.test', now()), ('${U(8)}', 'supervisor@exemplo.test', now()); commit;`);
const AL_B = transporte(dbB, U(7)), GE_B = transporte(dbB, U(8));
const dAB = await carregarDados(AL_B, PADROES);
const mM1 = dAB.monitorias.find((m) => m.id === M1);
ok('B.14', `depois do novo login (mesmo e-mail), a monitora vê as suas monitorias com o histórico (${mM1?.historico?.length} eventos na ${M1})`,
   perfilDoLogin(dAB, U(7))?.id === 'usr-1' && mM1?.historico?.map((x) => x.tipo).join() === 'ENVIO,DEVOLUCAO,REENVIO,VALIDACAO,OBSERVACAO');
const M2 = await fluxo(dbB, '3', true, [U(7), U(8)]);
const evM2 = (await dbB.query('select tipo from public.monitoria_eventos where monitoria_id = $1 order by id', [M2])).rows.map((x) => x.tipo).join();
const fB2 = await foto(dbB);
ok('B.15', `o sistema continua funcionando depois da restauração: novo fluxo completo (${evM2}); cadeia com ${fB2.aud} linhas e 0 quebras`,
   evM2 === 'ENVIO,DEVOLUCAO,REENVIO,VALIDACAO,OBSERVACAO' && fB2.quebras === 0 && fB2.aud > fB.aud);
const idsNovos = (await dbB.query("select count(*)::int n from public.monitoria_eventos where id <= (select max((e ->> 'id')::bigint) from jsonb_array_elements($1::jsonb) e) and monitoria_id = $2", [JSON.stringify(linhasDe(b, 'public.monitoria_eventos')), M2])).rows[0].n;
ok('B.16', 'as numerações automáticas continuam de onde pararam (eventos novos sem reaproveitar números do backup)', idsNovos === 0);

// ---- 3. recusas: destino diferente, conferência falha ------------------------------------------
const dbC = await novoBanco(false);   // sem o 14
let eC = null; try { await dbC.exec(restSQL); } catch (x) { eC = x; await dbC.exec('rollback').catch(() => {}); }
ok('B.17', `destino com scripts diferentes (sem o 14) → recusado, nada alterado (${(eC?.message || '').slice(0, 60)}…)`,
   /RECUSADA/.test(eC?.message || '') && (await n(dbC, 'select count(*) n from public.monitorias')) === 0);
const adulterado = structuredClone(b); adulterado.meta.impressoes.monitorias = '0'.repeat(32);
const dbD = await novoBanco(true);
let eD = null; try { await dbD.exec(gerarRestauracao(adulterado, { responsavel: ADM, motivo: 'Ensaio de conferência que falha', origem: 'teste' })); } catch (x) { eD = x; await dbD.exec('rollback').catch(() => {}); }
const trigD = await n(dbD, "select count(*) n from pg_trigger where not tgisinternal and not tgenabled = 'O'");
ok('B.18', 'se a conferência final não bate, TUDO é desfeito: banco vazio e gatilhos religados', /DESFEITA/.test(eD?.message || '') && (await n(dbD, 'select count(*) n from public.monitorias')) === 0 && trigD === 0, eD?.message);
const semResp = await tenta(async () => gerarRestauracao(b, { responsavel: '', motivo: 'x' }));
ok('B.19', 'o gerador exige ADMIN responsável e motivo, e recusa arquivo incompleto', !!semResp.erro && !!(await tenta(async () => gerarRestauracao(semLinha, { responsavel: ADM, motivo: 'Motivo suficiente' }))).erro);

// ---- 4. restauração no MESMO banco (dado corrompido depois do backup) ---------------------------
await fluxo(db, '4');   // alterações depois do backup
const audAntesRest = (await foto(db)).aud;
let eA = null; try { await db.exec(gerarRestauracao(b, { responsavel: ADM, motivo: 'Ensaio sintético: voltar ao backup no mesmo banco', origem: 'teste' })); } catch (x) { eA = x; await db.exec('rollback').catch(() => {}); }
const igA = await iguais(db);
const fA = await foto(db);
ok('B.20', `no mesmo banco: volta exatamente ao backup (o que veio depois — ${audAntesRest - b.dados['public.auditoria'].length} linhas de auditoria — sai; por isso, antes, faz-se um backup do estado atual)`,
   !eA && igA.imp && igA.cont && fA.quebras === 0, eA?.message ?? JSON.stringify(igA));
ok('B.21', 'no mesmo banco os vínculos de login são mantidos (os logins existem)', (await n(db, 'select count(*) n from public.perfis where auth_user_id is not null')) === 2);
const M5 = await fluxo(db, '5');
ok('B.22', 'e continua funcionando e encadeando depois', (await foto(db)).quebras === 0 && (await n(db, `select count(*) n from public.monitoria_eventos where monitoria_id = '${M5}'`)) === 5);

// ---- 5. a linha de comando (o que se usa de verdade) --------------------------------------------
{ const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync, existsSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'monitoria-backup-'));
  const cli = join(projeto, 'supabase/backup/restauracao.mjs');
  const roda = (args) => { try { return { out: execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' }), code: 0 }; } catch (x) { return { out: `${x.stdout}${x.stderr}`, code: x.status }; } };
  writeFileSync(join(dir, 'bom.json'), exportado); writeFileSync(join(dir, 'cortado.json'), cortado);
  const c1 = roda(['conferir', join(dir, 'bom.json')]), c2 = roda(['conferir', join(dir, 'cortado.json')]);
  const g1 = roda(['gerar', join(dir, 'bom.json'), join(dir, 'r.sql'), '--responsavel', ADM, '--motivo', 'Ensaio da linha de comando']);
  const nomes = linhasDe(b, 'public.perfis').map((p) => p.nome).filter(Boolean);
  ok('B.23', 'linha de comando: "conferir" diz COMPLETO (código 0) e mostra só contagens; arquivo cortado → código 1; "gerar" grava o SQL',
     c1.code === 0 && /COMPLETO/.test(c1.out) && !nomes.some((n) => c1.out.includes(n)) && c2.code === 1 && g1.code === 0 && existsSync(join(dir, 'r.sql')), `${c1.out.slice(-200)} | ${c2.out.slice(0, 120)}`);
  rmSync(dir, { recursive: true, force: true }); }

relatorio();
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
