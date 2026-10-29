// Ensaio do ENCERRAMENTO dos testes do 15 num Postgres LOCAL (PGlite): 15c (cancela os 4 rascunhos
// fictícios MON-10020..10023) e 11b (desativa a colaboradora fictícia), numa réplica da homologação
// de 29/10/2026 — as 19 monitorias com a mesma numeração e situação, em colaboradoras que NÃO são a
// fictícia, mais os 4 rascunhos TESTE15 da validação V1–V8 na colaboradora fictícia.
//
// Ordem ensaiada = a planejada: 15 → 15b (duplicidades reais) → 15c → 11b. Prova que o 15c cancela
// só as 4 fictícias (com histórico e auditoria), sem mudar nenhum indicador, e que o 11b só desativa
// a fictícia, sem apagar nem alterar monitorias; e que as travas recusam fora de ordem ou repetidos.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-15c-encerramento.mjs <projeto>
// (o trecho até a réplica é o de testes-15-implantacao.mjs, com as colaboradoras reais trocadas)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, salvarMonitoria, validarMonitoria, reprovarMonitoria } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { getEscopoProgresso } = await mod('src/domain/goalService.ts');
const { resumirNotas } = await mod('src/domain/resultadosService.ts');
const { chaveAtendimento } = await mod('src/domain/duplicidade.ts');
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
await db.exec(sql('14_historico_calibracao.sql'));

const um = async (q, p) => (await db.query(q, p)).rows[0];
const n = async (q, p) => Number((await um(q, p)).n);
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
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2));
const FICT = 'col-teste-homolog-1';
const COL_A = (await um(`select id from public.colaboradores where id <> $1 order by id limit 1`, [FICT])).id;
const COL_B = (await um(`select id from public.colaboradores where id <> $1 and id <> $2 order by id limit 1`, [FICT, COL_A])).id;
const PERFIL_ALINE = (await um(`select id from public.perfis where auth_user_id = $1`, [U(1)])).id;

// ---- réplica: as 17 monitorias criadas depois da migração, na ordem da homologação ------------
let dA = await carregarDados(ALINE, PADROES);
const GAB = (canal) => dA.criterios.filter((c) => c.active && c.channels.includes(canal)).map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const prev = (canal, s) => calcularNotaPrevia(dA.criterios.filter((c) => c.active && c.channels.includes(canal)), Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
const monitoria = (colab, canal, dia, ini, fim, num) => {
  const scores = GAB(canal);
  return { id: '', competencia: '2026-08', date: `2026-08-${dia}T12:00:00Z`, colaboradorId: colab, canal, tipo: 'Regular', categoriaAtendimento: 'BOLETOS',
    numeroAtendimento: num, numeroTitulo: 'FICT', inicioAtendimento: `2026-08-${dia}T${ini}`, fimAtendimento: `2026-08-${dia}T${fim}`,
    comments: 'RÉPLICA FICTÍCIA — ENSAIO DO SCRIPT 15.', status: 'Pendente', scores, finalScore: prev(canal, scores), evidencias: [], links: [] };
};
// [colaboradora, canal, dia, início, término, nº, quantas vezes foi criada]
const REPLICA = [
  [COL_A, 'Telefone', '28', '13:09', '13:10', 'F-03', 1],
  [COL_A, 'Telefone', '28', '15:08', '15:20', 'F-04', 2],   // 10004 / 10005
  [COL_A, 'Telefone', '28', '11:32', '11:38', 'F-06', 1],
  [COL_A, 'Telefone', '25', '16:28', '16:31', 'F-07', 2],   // 10007 / 10008
  [COL_A, 'Telefone', '19', '11:57', '12:01', 'F-09', 1],
  [COL_A, 'WhatsApp', '26', '17:00', '17:54', 'F-10', 1],
  [COL_A, 'WhatsApp', '26', '13:09', '13:25', 'F-11', 2],   // 10011 / 10012
  [COL_A, 'WhatsApp', '25', '15:42', '17:00', 'F-13', 2],   // 10013 / 10014
  [COL_B, 'WhatsApp', '20', '14:51', '15:17', 'F-15', 1],
  [COL_B, 'WhatsApp', '24', '15:15', '15:27', 'F-16', 2],   // 10016 / 10017
  [COL_B, 'WhatsApp', '10', '16:32', '17:48', 'F-18', 2],   // 10018 / 10019
];
const criadas = [];
for (const [colab, canal, dia, ini, fim, num, vezes] of REPLICA)
  for (let i = 0; i < vezes; i++) criadas.push((await salvarMonitoria(ALINE, monitoria(colab, canal, dia, ini, fim, num), dA.criterios, false, true)).id);
const doBanco = async (id) => (await carregarDados(ERIVAN, PADROES)).monitorias.find((m) => m.id === id);
// Como na homologação: o gestor devolveu a MON-10001 (migrada), que voltou a Rascunho.
await (await import(pathToFileURL(join(projeto, 'src/shared/compartilhado/dados.ts')).href)).devolverMonitoria(ERIVAN, await doBanco('MON-10001'), 'TESTE: devolvida como na homologação (fictício).');
await validarMonitoria(ERIVAN, await doBanco('MON-10003'));
await validarMonitoria(ERIVAN, await doBanco('MON-10004'));
await reprovarMonitoria(ERIVAN, await doBanco('MON-10005'), 'TESTE: duplicidade (fictício).');
await validarMonitoria(ERIVAN, await doBanco('MON-10006'));
const situacoes = Object.fromEntries((await db.query('select status, count(*)::int n from public.monitorias group by status')).rows.map((x) => [x.status, x.n]));
ok('I.0', `réplica com a mesma numeração e situação da homologação: ${criadas[0]}…${criadas.at(-1)}; ${JSON.stringify(situacoes)}`,
   criadas[0] === 'MON-10003' && criadas.at(-1) === 'MON-10019' && (await n('select count(*) n from public.monitorias')) === 19
   && situacoes.Pendente === 13 && situacoes.Validada === 3 && situacoes.Reprovada === 1 && situacoes.Rascunho === 2, JSON.stringify(situacoes));

// ---- indicadores, pelas mesmas funções do portal ----------------------------------------------
const AGO = { year: 2026, month: 7 };
const METAS = [
  { id: 'g-a-tel', monitorId: PERFIL_ALINE, colaboradorId: COL_A, canal: 'Telefone', year: 2026, month: 7, targetQty: 5 },
  { id: 'g-a-wa', monitorId: PERFIL_ALINE, colaboradorId: COL_A, canal: 'WhatsApp', year: 2026, month: 7, targetQty: 5 },
  { id: 'g-b', monitorId: PERFIL_ALINE, colaboradorId: COL_B, year: 2026, month: 7, targetQty: 5 },
];
const indicadores = async () => {
  const ms = (await carregarDados(ERIVAN, PADROES)).monitorias;
  const fila = (await ERIVAN.sql('select id from api.fila_validacao()')).length;
  const metas = METAS.map((g) => getEscopoProgresso(g, ms, AGO).entregues);
  const medias = [COL_A, COL_B].map((c) => resumirNotas(ms.filter((m) => m.colaboradorId === c && m.competencia === '2026-08')).consideradas);
  // o que DEVERIA contar: cada atendimento uma vez (Pendente/Validada), sem as cópias
  const unicos = (c, canal) => new Set(ms.filter((m) => m.colaboradorId === c && (!canal || m.canal === canal) && ['Pendente', 'Validada'].includes(m.status)).map((m) => chaveAtendimento(m))).size;
  return { fila, metas, medias, reais: [unicos(COL_A, 'Telefone'), unicos(COL_A, 'WhatsApp'), unicos(COL_B)] };
};
const conf = async () => Object.fromEntries((await db.query(sql('conferencia-15.sql'))).rows.map((x) => [x.item, x.resultado]));
const eventosDe = async (id) => (await db.query('select tipo, consideracoes, responsavel_id from public.monitoria_eventos where monitoria_id = $1 order by id', [id])).rows;
const COPIAS = ['MON-10008', 'MON-10012', 'MON-10014', 'MON-10017', 'MON-10019'];
const ORIGINAIS = ['MON-10007', 'MON-10011', 'MON-10013', 'MON-10016', 'MON-10018'];
const histAntes = Object.fromEntries(await Promise.all([...COPIAS, ...ORIGINAIS].map(async (id) => [id, JSON.stringify(await eventosDe(id))])));

// ---- os 4 rascunhos fictícios da validação V1–V8 (MON-10020..10023) ----------------------------
const FICTICIAS = [['TESTE15-V1', '09:00', '09:05'], ['TESTE15-V4', '09:06', '09:10'], ['TESTE15-V5', '14:00', '14:05'], ['TESTE15-V6-B', '16:00', '16:05']];
const idsF = [];
for (const [num, ini, fim] of FICTICIAS)
  idsF.push((await salvarMonitoria(ALINE, { ...monitoria(FICT, 'Telefone', '28', ini, fim, num), numeroTitulo: 'TESTE15', status: 'Rascunho' }, dA.criterios, false, false)).id);
ok('E.0', `réplica: 19 monitorias reais (colaboradoras ${COL_A}, ${COL_B}) + 4 rascunhos fictícios ${idsF.join(', ')}`,
   idsF.join() === 'MON-10020,MON-10021,MON-10022,MON-10023' && (await n(`select count(*) n from public.monitorias where colaborador_id = $1`, [FICT])) === 4
   && (await n(`select count(*) n from public.monitorias where colaborador_id = $1 and status = 'Rascunho'`, [FICT])) === 4);

const rodar = async (f) => { try { await db.exec(sql(f)); return null; } catch (x) { await db.exec('rollback').catch(() => {}); return x; } };
let e = await rodar('15_duplicidade_criacao.sql');
const e2 = e || await rodar('15b_cancelar_duplicatas_homologacao.sql');
ok('E.1', '15 e 15b aplicados antes (ordem planejada): 5 cópias reais canceladas por duplicidade', !e2 && (await n(`select count(*) n from public.monitorias where duplicata_de is not null`)) === 5, e2?.message);

const linhas = async (onde = 'true') => JSON.stringify((await db.query(`select * from public.monitorias where ${onde} order by id`)).rows.map(normalizar));
const auditoria = async () => (await db.query('select seq, tabela, acao, responsavel_declarado from public.auditoria order by seq')).rows;
const quebras = async () => n(`select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q`);
const respostasF = async () => (await um(`select count(*) || ' ' || md5(string_agg(to_jsonb(r)::text, '|' order by r.monitoria_id, r.criterio_id)) h from public.monitoria_respostas r where r.monitoria_id like 'MON-1002%'`)).h;

// ---- 11b antes do 15c: recusado ---------------------------------------------------------------
e = await rodar('11b_desativar_colaboradora_teste.sql');
ok('E.2', `11b antes do 15c é recusado (${e?.message?.slice(0, 70)}…) e a colaboradora continua ativa`,
   e && /Rode antes o 15c/.test(e.message) && (await um(`select ativo from public.colaboradores where id = $1`, [FICT])).ativo === true);

// ---- 15c --------------------------------------------------------------------------------------
const ind0 = await indicadores();
const reais0 = await linhas(`colaborador_id <> '${FICT}'`), resp0 = await respostasF(), aud0 = (await auditoria()).length;
const ev0 = await n(`select count(*) n from public.monitoria_eventos where monitoria_id not like 'MON-1002%'`);
e = await rodar('15c_cancelar_ficticias_teste15.sql');
ok('E.3', '15c executado numa transação, conferências internas aprovadas', !e, e?.message);
const fic = (await db.query(`select id, status, versao, cancelado_por, cancelado_motivo, duplicata_de from public.monitorias where colaborador_id = $1 order by id`, [FICT])).rows;
ok('E.4', `as 4 fictícias Canceladas pelo ADMIN, com motivo ("${fic[0]?.cancelado_motivo}") e sem referência de duplicidade`,
   fic.length === 4 && fic.every((x, i) => x.status === 'Cancelada' && x.versao === 2 && x.cancelado_por === ADM && x.duplicata_de === null
     && String(x.cancelado_motivo).startsWith(`Registro fictício da validação do script 15 (${['V1', 'V4', 'V5', 'V6'][i]})`)), JSON.stringify(fic));
ok('E.5', 'nenhuma outra monitoria mudou (19 reais idênticas, inclusive as 5 cópias já canceladas pelo 15b) e o histórico delas é o mesmo; respostas das fictícias preservadas',
   (await linhas(`colaborador_id <> '${FICT}'`)) === reais0 && (await respostasF()) === resp0
   && (await n(`select count(*) n from public.monitoria_eventos where monitoria_id not like 'MON-1002%'`)) === ev0);
const evF = (await db.query(`select monitoria_id, tipo, responsavel_id, consideracoes from public.monitoria_eventos where monitoria_id like 'MON-1002%' order by id`)).rows;
ok('E.6', `histórico: cada fictícia ganhou só o evento de cancelamento, pelo ADMIN (${evF.map((x) => x.monitoria_id.slice(-2) + ':' + x.tipo).join(', ')})`,
   evF.length === 4 && evF.every((x) => x.tipo === 'CANCELAMENTO' && x.responsavel_id === ADM && String(x.consideracoes).startsWith('Registro fictício')), JSON.stringify(evF));
const novos = (await auditoria()).slice(aud0);
ok('E.7', `auditoria: +${novos.length} (${[...new Set(novos.map((x) => x.tabela + ' ' + x.acao))].join(', ')}), todos com o ADMIN declarado, 0 quebras`,
   novos.length === 8 && novos.every((x) => x.responsavel_declarado === ADM) && (await quebras()) === 0, JSON.stringify(novos));
const ind1 = await indicadores();
ok('E.8', `indicadores iguais antes e depois do 15c: fila ${ind1.fila}, metas ${ind1.metas.join('/')}, na média ${ind1.medias.join('/')}`,
   JSON.stringify(ind1) === JSON.stringify(ind0) && ind1.fila === 8 && ind1.metas.join() === '5,3,3', JSON.stringify({ ind0, ind1 }));
const linhas15c = await linhas();
e = await rodar('15c_cancelar_ficticias_teste15.sql');
ok('E.9', `15c de novo é recusado (${e?.message?.slice(0, 60)}…) e nada muda`, e && /uma única vez/.test(e.message) && (await linhas()) === linhas15c);

// ---- 11b --------------------------------------------------------------------------------------
const colabs0 = JSON.stringify((await db.query(`select * from public.colaboradores where id <> $1 order by id`, [FICT])).rows.map(normalizar));
const aud1 = (await auditoria()).length;
e = await rodar('11b_desativar_colaboradora_teste.sql');
const cf = await um(`select ativo, nome, versao from public.colaboradores where id = $1`, [FICT]);
ok('E.10', `11b: a colaboradora fictícia ficou inativa ("${cf.nome}", v${cf.versao}); o registro continua no banco`, !e && cf.ativo === false, e?.message);
const novos2 = (await auditoria()).slice(aud1);
ok('E.11', `11b não alterou monitorias nem outras colaboradoras; auditoria +${novos2.length} (${novos2.map((x) => x.tabela + ' ' + x.acao).join(', ')}) com o ADMIN declarado, 0 quebras`,
   (await linhas()) === linhas15c && JSON.stringify((await db.query(`select * from public.colaboradores where id <> $1 order by id`, [FICT])).rows.map(normalizar)) === colabs0
   && novos2.length === 1 && novos2[0].tabela === 'colaboradores' && novos2[0].responsavel_declarado === ADM && (await quebras()) === 0, JSON.stringify(novos2));
const vis = await carregarDados(ALINE, PADROES);
const visF = vis.monitorias.filter((m) => m.colaboradorId === FICT);
ok('E.12', `pelo portal: as 4 fictícias continuam consultáveis (${visF.map((m) => m.id.slice(-2) + ' ' + m.status).join(', ')}) e a colaboradora aparece como inativa`,
   visF.length === 4 && visF.every((m) => m.status === 'Cancelada') && vis.colaboradores.find((c) => c.id === FICT)?.active === false);
ok('E.13', 'indicadores iguais depois do 11b', JSON.stringify(await indicadores()) === JSON.stringify(ind0));
let apagar = null; try { await db.exec(`begin; set local app.responsavel = '${ADM}'; delete from public.colaboradores where id = '${FICT}'; commit;`); } catch (x) { apagar = x; await db.exec('rollback').catch(() => {}); }
ok('E.14', `apagar a colaboradora com monitorias é impedido pelo banco (${apagar?.message?.slice(0, 60)}…)`, apagar && (await n(`select count(*) n from public.colaboradores where id = $1`, [FICT])) === 1);
e = await rodar('11b_desativar_colaboradora_teste.sql');
ok('E.15', `11b de novo é recusado (${e?.message?.slice(0, 60)}…)`, e && /já está inativa/.test(e.message));

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
