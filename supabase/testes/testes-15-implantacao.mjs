// Ensaio da IMPLANTAÇÃO do script 15 e do 15b num Postgres LOCAL (PGlite), numa RÉPLICA
// FICTÍCIA da homologação: a migração ensaiada (09b) gera MON-10001/10002 e as 17 monitorias
// seguintes são criadas na mesma ordem, com a mesma situação, canal, dia, horário e os mesmos
// pares duplicados de 29/10/2026 — dados de atendimento e respostas fictícios.
//
// Prova: a conferência só leitura sai IGUAL antes e depois do 15 (nada muda nas 19 monitorias);
// a instalação não cancela nada; o 15b cancela exatamente as 5 cópias, preserva os históricos,
// e fila, metas e médias passam a contar cada atendimento uma vez.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-15-implantacao.mjs <projeto>
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
const COL_A = 'col-teste-homolog-1';
const COL_B = (await um(`select id from public.colaboradores where id <> $1 order by id limit 1`, [COL_A])).id;
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

const ind0 = await indicadores();
ok('I.1', `ANTES: fila ${ind0.fila}; metas (A tel, A wa, B) ${ind0.metas.join('/')}; na média A ${ind0.medias[0]}, B ${ind0.medias[1]} — inflados pelas cópias (reais ${ind0.reais.join('/')})`,
   ind0.fila === 13 && ind0.metas.join() === '6,5,5' && ind0.medias.join() === '11,5' && ind0.reais.join() === '5,3,3', JSON.stringify(ind0));

// ---- 15b antes do 15: recusado -----------------------------------------------------------------
let e = null; try { await db.exec(sql('15b_cancelar_duplicatas_homologacao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('I.2', `o 15b sem o 15 instalado é recusado (${e?.message?.slice(0, 60)}) e nada muda`, e && /15b RECUSADO/.test(e.message) && (await n(`select count(*) n from public.monitorias where status = 'Cancelada'`)) === 0);

// ---- instalação do 15 ----------------------------------------------------------------------------
const c0 = await conf();
const audAntes = await n('select count(*) n from public.auditoria');
const linhasAntes = JSON.stringify((await db.query('select * from public.monitorias order by id')).rows);
e = null; try { await db.exec(sql('15_duplicidade_criacao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('I.3', 'script 15 instalado', !e, e?.message);
const c1 = await conf();
const iguais = [2, 3, 4, 5, 6, 7, 8, 9].filter((i) => c0[i] === c1[i]);
ok('I.4', `conferencia-15 ANTES × DEPOIS do 15: itens 2–9 iguais (${iguais.length}/8) — 19 monitorias, impressões, histórico, auditoria, 0 canceladas, ${c1[9].split(' · ')[0]} grupos em dobro`,
   iguais.length === 8 && /^19 · /.test(c1[2]) && c1[8] === '0' && c1[9].startsWith('5 · ') && /quebras 0$/.test(c1[7]), JSON.stringify({ c0, c1 }));
const linhasDepois = (await db.query('select * from public.monitorias order by id')).rows;
ok('I.5', 'as 19 linhas de monitorias são idênticas coluna a coluna (as duas colunas novas ficam vazias em todas) e a instalação não gravou nada na auditoria',
   JSON.stringify(linhasDepois.map(({ chave_criacao, duplicata_de, ...resto }) => resto)) === linhasAntes
   && linhasDepois.every((x) => x.chave_criacao === null && x.duplicata_de === null) && (await n('select count(*) n from public.auditoria')) === audAntes);
ok('I.6', `a instalação não cancela nada: canceladas ${c1[8]}; cancelamentos por duplicidade: ${c1[11]}; objetos: ${c1[10]}`,
   c1[8] === '0' && c1[11] === 'nenhuma' && c1[10] === 'coluna chave_criacao · coluna duplicata_de · gatilho · cancelar_por_duplicidade · cancelar_duplicata');
const ind1 = await indicadores();
ok('I.7', 'só instalar o 15 não muda fila, metas nem médias', JSON.stringify(ind1) === JSON.stringify(ind0), JSON.stringify(ind1));

// ---- 15b: as 5 cópias ---------------------------------------------------------------------------
e = null; try { await db.exec(sql('15b_cancelar_duplicatas_homologacao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('I.8', '15b executado numa transação', !e, e?.message);
const c2 = await conf();
ok('I.9', `depois do 15b: ${c2[8]} canceladas (${c2[11]}); grupos em dobro: ${c2[9]}; respostas e evidências com a mesma impressão; auditoria ${c2[7]}`,
   c2[8] === '5' && c2[11] === COPIAS.map((c, i) => `${c} → ${ORIGINAIS[i]}`).join(', ') && c2[9] === '0 · nenhum'
   && c2[4] === c1[4] && c2[5] === c1[5] && /quebras 0$/.test(c2[7]) && /^19 · /.test(c2[2]), JSON.stringify(c2));
const lin = Object.fromEntries((await db.query('select id, status, cancelado_por, cancelado_motivo, duplicata_de from public.monitorias')).rows.map((x) => [x.id, x]));
ok('I.10', `cada cópia: Cancelada, ADMIN responsável, motivo padrão ("${lin['MON-10008'].cancelado_motivo}") e referência à original; as originais e a MON-10004/10005 como estavam`,
   COPIAS.every((c, i) => lin[c].status === 'Cancelada' && lin[c].cancelado_por === ADM && lin[c].duplicata_de === ORIGINAIS[i] && lin[c].cancelado_motivo.startsWith(`Duplicidade: cópia de MON-2026-00${ORIGINAIS[i].slice(-2)}`))
   && ORIGINAIS.every((o) => lin[o].status === 'Pendente') && lin['MON-10004'].status === 'Validada' && lin['MON-10005'].status === 'Reprovada');
let histOk = true; const hd = [];
for (const c of COPIAS) {
  const ev = await eventosDe(c);
  const antes = JSON.parse(histAntes[c]);
  if (JSON.stringify(ev.slice(0, antes.length)) !== histAntes[c] || ev.length !== antes.length + 1 || ev.at(-1).tipo !== 'CANCELAMENTO' || ev.at(-1).responsavel_id !== ADM || !ev.at(-1).consideracoes?.startsWith('Duplicidade')) histOk = false;
  hd.push(`${c}: ${ev.map((x) => x.tipo).join('+')}`);
}
for (const o of ORIGINAIS) if (JSON.stringify(await eventosDe(o)) !== histAntes[o]) histOk = false;
ok('I.11', `históricos preservados: o que havia continua igual e cada cópia ganha só o evento de cancelamento (${hd.join('; ')}); originais intactas`, histOk);
const ind2 = await indicadores();
ok('I.12', `DEPOIS: fila ${ind1.fila} → ${ind2.fila}; metas ${ind1.metas.join('/')} → ${ind2.metas.join('/')}; na média A ${ind1.medias[0]} → ${ind2.medias[0]}, B ${ind1.medias[1]} → ${ind2.medias[1]} — agora iguais ao número real de atendimentos`,
   ind2.fila === 8 && ind2.metas.join() === ind2.reais.join() && ind2.metas.join() === '5,3,3' && ind2.medias.join() === '8,3');
e = null; try { await db.exec(sql('15b_cancelar_duplicatas_homologacao.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('I.13', `rodar o 15b de novo é recusado (${e?.message?.slice(0, 70)}) e nada muda`, e && /uma única vez/.test(e.message) && JSON.stringify(await conf()) === JSON.stringify(c2));
// Depois da limpeza, criar de novo um atendimento já existente continua recusado pela original.
const nova = await (async () => { try { await salvarMonitoria(ALINE, monitoria(COL_A, 'Telefone', '25', '16:28', '16:31', 'OUTRO'), dA.criterios, false, false); return 'gravou'; } catch (x) { return x.codigo; } })();
ok('I.14', `depois da limpeza, uma nova monitoria do atendimento da MON-10007 continua recusada (${nova})`, nova === 'MI410');

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
