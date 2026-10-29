// Testes do script 16 (colaboradora inativa não recebe monitoria nova) num Postgres LOCAL (PGlite),
// com a migração REAL ensaiada (09b), os scripts 10, 12, 12a, 11a, 14 e 15 e a camada de dados do PORTAL.
// Nada sai deste computador. Monitorias de teste FICTÍCIAS.
//
// Prova: sem o 16 a falha existe; com o 16, monitoria nova (rascunho, envio, importação — todas pela
// api.salvar_monitoria) e troca de colaboradora para inativa são recusadas (MI422); o que já existe
// segue normalmente (editar, enviar, validar, reprovar, devolver, reenviar, cancelar, consultar);
// manutenção direto no banco não é bloqueada; reativada, volta a receber; 16r reverte; auditoria íntegra.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-16-colaboradora-inativa.mjs <projeto>
// (o trecho de preparação é o de testes-15-duplicidade.mjs)
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
const { lerBackup, conferirBackup } = await import(pathToFileURL(join(projeto, 'supabase/backup/restauracao.mjs')).href);
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


// ---- 15 instalado (estado da homologação) e monitorias ANTERIORES à inativação -----------------
await db.exec(sql('15_duplicidade_criacao.sql'));
const P1 = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('08:00'), fimAtendimento: H('08:10'), numeroAtendimento: 'FICT-P1' }), dA.criterios, false, true);
const P2 = await salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('08:20'), fimAtendimento: H('08:30'), numeroAtendimento: 'FICT-P2' }), dA.criterios, false, true);
const R1 = await salvarMonitoria(ALINE, base({ inicioAtendimento: H('10:00'), fimAtendimento: H('10:10'), numeroAtendimento: 'FICT-R1' }), dA.criterios, false, false);
const R2 = await salvarMonitoria(ALINE, base({ colaboradorId: COL2, inicioAtendimento: H('11:00'), fimAtendimento: H('11:10'), numeroAtendimento: 'FICT-R2' }), dA.criterios, false, false);
const desativar = (id, ativo) => db.exec(`begin; set local app.responsavel = '${ADM}'; update public.colaboradores set ativo = ${ativo}, versao_lida = versao where id = '${id}'; commit;`);
await desativar(COL, false);

// A falha que motivou o 16: sem ele, o banco aceita monitoria nova para a inativa.
const semRegra = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('12:00'), fimAtendimento: H('12:10'), numeroAtendimento: 'FICT-SEM16' }), dA.criterios, false, false));
ok('G.0', `sem o 16, monitoria nova para a colaboradora inativa é aceita (${semRegra.ok?.id ?? cod(semRegra)}) — a falha de 29/10`, semRegra.ok?.id);

// ---- instalação do 16 ---------------------------------------------------------------------------
const linhas = async () => JSON.stringify((await db.query('select * from public.monitorias order by id')).rows.map(normalizar));
const colabs = async () => JSON.stringify((await db.query('select * from public.colaboradores order by id')).rows.map(normalizar));
const l0 = await linhas(), c0 = await colabs(), a0 = await nAud();
let e = null; try { await db.exec(sql('16_colaboradora_inativa.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
ok('G.1', 'script 16 instalado sem alterar nenhuma monitoria, colaboradora ou auditoria', !e && (await linhas()) === l0 && (await colabs()) === c0 && (await nAud()) === a0, e?.message);

// ---- criação e troca para inativa: recusadas ------------------------------------------------------
const nAntes = await nMon();
const nova = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('13:00'), fimAtendimento: H('13:10'), numeroAtendimento: 'FICT-N1' }), dA.criterios, false, false));
const novaEnv = await tenta(() => salvarMonitoria(ALINE, enviada({ inicioAtendimento: H('13:20'), fimAtendimento: H('13:30'), numeroAtendimento: 'FICT-N2' }), dA.criterios, false, true));
ok('G.2', `monitoria nova para colaboradora inativa é recusada — rascunho (${cod(nova)}) e envio direto (${cod(novaEnv)}); nada criado. Mensagem: "${String(nova.erro?.message).slice(0, 90)}…"`,
   cod(nova) === 'MI422' && cod(novaEnv) === 'MI422' && /inativa no cadastro/.test(nova.erro?.message) && (await nMon()) === nAntes);
const vR2 = await doBanco(ALINE, R2.id);
const troca = await tenta(() => salvarMonitoria(ALINE, { ...vR2, colaboradorId: COL }, dA.criterios, true, false));
ok('G.3', `rascunho que troca a colaboradora para a inativa é recusado (${cod(troca)}) e continua como estava`, cod(troca) === 'MI422' && (await linha(R2.id)).colaborador_id === COL2);

// ---- o que já existe segue normalmente --------------------------------------------------------------
const vR1 = await doBanco(ALINE, R1.id);
const edita = await tenta(() => salvarMonitoria(ALINE, { ...vR1, comments: 'MONITORIA FICTÍCIA — editada depois da inativação.' }, dA.criterios, true, false));
ok('G.4', `rascunho antigo da colaboradora inativa é editado normalmente (${edita.ok?.status ?? cod(edita)})`, edita.ok?.status === 'Rascunho');
const vR1b = await doBanco(ALINE, R1.id);
const envia = await tenta(() => salvarMonitoria(ALINE, { ...vR1b, scores: GAB(), finalScore: prev(GAB()) }, dA.criterios, true, true));
ok('G.5', `rascunho antigo da colaboradora inativa é enviado normalmente (${envia.ok?.status ?? cod(envia)})`, envia.ok?.status === 'Pendente');
const val = await tenta(async () => validarMonitoria(ERIVAN, await doBanco(ERIVAN, P1.id)));
const rep = await tenta(async () => reprovarMonitoria(ERIVAN, await doBanco(ERIVAN, P2.id), 'TESTE: reprovada (fictício).'));
const dev = await tenta(async () => devolverMonitoria(ERIVAN, await doBanco(ERIVAN, R1.id), 'TESTE: devolvida (fictício).'));
ok('G.6', `gestor decide normalmente as monitorias da colaboradora inativa: validar ${val.ok?.status ?? cod(val)}, reprovar ${rep.ok?.status ?? cod(rep)}, devolver ${dev.ok?.status ?? cod(dev)}`,
   val.ok?.status === 'Validada' && rep.ok?.status === 'Reprovada' && dev.ok?.status === 'Rascunho');
const vR1c = await doBanco(ALINE, R1.id);
const reenvia = await tenta(() => salvarMonitoria(ALINE, { ...vR1c, scores: GAB(), finalScore: prev(GAB()) }, dA.criterios, true, true));
const canc = await tenta(async () => cancelarMonitoria(ADMIN, await doBanco(ADMIN, R1.id), 'TESTE: cancelada (fictício).'));
ok('G.7', `devolvida e reenviada (${reenvia.ok?.status ?? cod(reenvia)}); o ADMIN cancela normalmente (${canc.ok?.status ?? cod(canc)})`, reenvia.ok?.status === 'Pendente' && canc.ok?.status === 'Cancelada');
const vis = await carregarDados(ALINE, PADROES);
ok('G.8', 'pelo portal, as monitorias antigas da inativa continuam consultáveis e ela aparece como inativa',
   [P1.id, P2.id, R1.id].every((id) => vis.monitorias.some((m) => m.id === id && m.colaboradorId === COL)) && vis.colaboradores.find((c) => c.id === COL)?.active === false);

// ---- a regra do 15 continua, e a ordem dos gatilhos -------------------------------------------------
const dup = await tenta(() => salvarMonitoria(ALINE, base({ colaboradorId: COL2, inicioAtendimento: H('11:00'), fimAtendimento: H('11:05'), numeroAtendimento: 'OUTRO' }), dA.criterios, false, false));
ok('G.9', `duplicidade (15) continua recusada para colaboradora ativa (${cod(dup)})`, cod(dup) === 'MI410');

// ---- manutenção direto no banco (restauração, migração, scripts) não passa pela regra ------------
let m = null; try { await db.exec(`begin; set local app.responsavel = '${ADM}'; update public.monitorias set colaborador_id = '${COL}', versao_lida = versao where id = '${R2.id}'; commit;`); } catch (x) { m = x; await db.exec('rollback').catch(() => {}); }
ok('G.10', 'operação direto no banco, sem sessão do portal (como restauração e scripts de manutenção), não é bloqueada', !m && (await linha(R2.id)).colaborador_id === COL, m?.message);

// ---- reativada, volta a receber ------------------------------------------------------------------------
await desativar(COL, true);
const reat = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('14:00'), fimAtendimento: H('14:10'), numeroAtendimento: 'FICT-REAT' }), dA.criterios, false, false));
ok('G.11', `reativada pelo ADMIN, a colaboradora volta a receber monitoria nova (${reat.ok?.status ?? cod(reat)})`, reat.ok?.status === 'Rascunho');
ok('G.12', `auditoria íntegra (${await nAud()} registros, 0 quebras)`, (await quebras()) === 0);

// ---- reversão (16r) e reinstalação ---------------------------------------------------------------------
await desativar(COL, false);
const l1 = await linhas();
e = null; try { await db.exec(sql('16r_reverter_colaboradora_inativa.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
const depoisR = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('15:00'), fimAtendimento: H('15:10'), numeroAtendimento: 'FICT-16R' }), dA.criterios, false, false));
ok('G.13', `16r: sem alterar monitorias, o banco volta ao comportamento anterior (nova para inativa: ${depoisR.ok?.status ?? cod(depoisR)}); versão 16 retirada`,
   !e && depoisR.ok?.status === 'Rascunho' && (await n(`select count(*) n from app.versoes_esquema where versao = '16'`)) === 0, e?.message);
const l2 = JSON.parse(await linhas()).filter((x) => x.id !== depoisR.ok?.id);
ok('G.14', 'a reversão não alterou nenhuma monitoria existente', JSON.stringify(l2) === l1);
e = null; try { await db.exec(sql('16_colaboradora_inativa.sql')); } catch (x) { e = x; await db.exec('rollback').catch(() => {}); }
const deNovo = await tenta(() => salvarMonitoria(ALINE, base({ inicioAtendimento: H('16:00'), fimAtendimento: H('16:10'), numeroAtendimento: 'FICT-REINST' }), dA.criterios, false, false));
ok('G.15', `o 16 pode ser reinstalado e volta a recusar (${cod(deNovo)}); 0 quebras`, !e && cod(deNovo) === 'MI422' && (await quebras()) === 0, e?.message);

relatorio();
const falhas = r.filter((x) => !x.ok).length;
console.log(`\n${r.length} testes · ${r.length - falhas} aprovados · ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
