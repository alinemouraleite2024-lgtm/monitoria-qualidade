// ENSAIO LOCAL do teste de homologação ponta a ponta (roteiro aprovado em 15/10/2026), com a
// migração REAL ensaiada (09b exato), o script 10, o 11a e a camada de dados do PORTAL
// (src/shared/compartilhado) contra um Postgres local. Nada sai deste computador.
//
// Prova, antes de tocar a homologação: o 11a; o gabarito e as notas esperadas; os 8 passos com
// Aline (MONITOR) e Erivan (GESTOR); o que os indicadores mostram; a auditoria; e o caminho de
// encerramento que respeita as regras (cancelamento pelo ADMIN com MFA, quando existir).
//
// Uso (precisa do gancho de TypeScript do projeto e de supabase/migracao/saida, git-ignorado):
//   node --import <projeto>/tests/registrar-ts.mjs testes-11-homologacao.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, perfilDoLogin, salvarMonitoria, validarMonitoria, devolverMonitoria, cancelarMonitoria } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { exigeReenvio, podeValidar } = await mod('src/domain/validacaoService.ts');
const { getFilaDeValidacao } = await mod('src/domain/queueService.ts');
const { getCarteiraProgress } = await mod('src/domain/goalService.ts');
const { countsTowardGoal } = await mod('src/domain/monitoringRules.ts');
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
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };
definirModoParaTeste(true);

// ---- banco igual à homologação: 00–09a, 09b real, 10, logins de Aline e Erivan --------------
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
await db.exec(STUB_MFA);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'])
  await db.exec(sql(f));
await db.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
await db.exec(sql('10_p1_reprovar_m1.sql'));
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
// Ordem 2 (P3): o ADMIN existe ANTES do 11a revisado
await db.exec(sql('12_estado_do_acesso_mfa.sql'));
await db.exec(sql('12a_admin_aline_oliveira.sql'));
await db.exec(`begin; set local app.responsavel = '${ADM}'; insert into auth.users values ('${U(9)}', '${EMAIL_ADM}', now()); commit;`);
await db.exec(`insert into auth.mfa_factors (user_id, friendly_name, status) values ('${U(9)}', 'celular 1', 'verified'), ('${U(9)}', 'celular 2', 'verified')`);

const um = async (q, p) => (await db.query(q, p)).rows[0];
const foto = async (ids) => JSON.stringify((await db.query(`select id, status, versao, nota, nota_historica, regua_versao_id, aprovado_por, revisado_por, cancelado_por from public.monitorias where id = any($1) order by id`, [ids])).rows);
const conf = async () => Object.fromEntries((await db.query(sql('conferencia-11-homologacao.sql'))).rows.map((x) => [x.item, x.resultado]));
const c0 = await conf();
const linhaDeBase = { reais: await foto(['MON-10001', 'MON-10002']), aud: Number((await um('select count(*) n from public.auditoria')).n) };

ok('H.0', `conferencia-11 (só leitura) na linha de base: colaborador "${c0[1]}", ${c0[2]} monitorias marcadas, MON-10001 "${c0[7]}", cadeia com ${c0[11]} quebras`,
   c0[1] === 'ainda não existe' && c0[2] === '0' && c0[3] === null && c0[11] === '0' && /^Pendente · v\d+ · 96\.77 · sem régua$/.test(c0[7]), JSON.stringify(c0));

// ---- 1. script 11a -------------------------------------------------------------------------
let e = null; try { await db.exec(sql('11a_colaborador_teste_homologacao.sql')); } catch (x) { e = x; }
ok('H.1', '11a aplicado numa transação, com a conferência interna aprovada', !e, e?.message);
e = null; try { await db.exec(sql('11a_colaborador_teste_homologacao.sql')); } catch (x) { e = x; }
const nCol = Number((await um("select count(*) n from public.colaboradores where id = 'col-teste-homolog-1'")).n);
ok('H.2', '11a pode rodar de novo: não duplica nem altera (idempotente)', !e && nCol === 1, e?.message);
const col = await um("select nome, area_id, ativo, extras from public.colaboradores where id = 'col-teste-homolog-1'");
const audCol = await um("select acao, responsavel_declarado d, autor_perfil_id a from public.auditoria where tabela = 'colaboradores' and chave ->> 'id' = 'col-teste-homolog-1' order by seq");
ok('H.3', `colaborador fictício: "${col.nome}", area-1, ativo, marcado como fictício, SEM alocação; auditoria declarada ("${audCol?.d}")`,
   col.area_id === 'area-1' && col.ativo === true && col.extras.ficticio === true && audCol?.acao === 'INSERT' && audCol.d === ADM
   && Number((await um("select count(*) n from public.alocacoes where colaborador_id = 'col-teste-homolog-1'")).n) === 0);
ok('H.4', 'o 11a não tocou em nada além do colaborador: MON-10001 e MON-10002 idênticas; só 1 linha nova de auditoria (a inclusão) + o registro de versão não auditado',
   (await foto(['MON-10001', 'MON-10002'])) === linhaDeBase.reais && Number((await um('select count(*) n from public.auditoria')).n) === linhaDeBase.aud + 1);
// adulteração: se já existir com outros dados, o 11a recusa e não altera nada
{ const d2 = await PGlite.create({ extensions: { pgcrypto } }); await d2.exec(SETUP); await d2.exec(STUB_MFA);
  for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql']) await d2.exec(sql(f));
  await d2.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8')); await d2.exec(sql('10_p1_reprovar_m1.sql'));
  await d2.exec(sql('12_estado_do_acesso_mfa.sql')); await d2.exec(sql('12a_admin_aline_oliveira.sql'));
  await d2.exec(`begin; set local app.responsavel = '${ADM}'; insert into public.colaboradores (id, nome, area_id, ativo) values ('col-teste-homolog-1', 'Pessoa Real Qualquer', 'area-1', true); commit;`);
  // o SQL Editor desfaz a transação que falhou; aqui o rollback é explícito
  let e2 = null; try { await d2.exec(sql('11a_colaborador_teste_homologacao.sql')); } catch (x) { e2 = x; await d2.exec('rollback'); }
  const ainda = (await d2.query("select nome from public.colaboradores where id = 'col-teste-homolog-1'")).rows[0].nome;
  ok('H.5', 'se o id já existir com outros dados, o 11a RECUSA (MI409) e não altera nada', e2?.code === 'MI409' && ainda === 'Pessoa Real Qualquer', e2?.message); }

// ---- transporte (o que a Data API faz) ----------------------------------------------------
const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text' };
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
  };
};
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2));
const HOJE = (await um('select app.hoje()::text d')).d;
const COMP = HOJE.slice(0, 7);
const PERIODO = { year: Number(COMP.slice(0, 4)), month: Number(COMP.slice(5, 7)) - 1 };

// ---- 2. gabarito da Régua 2.0 (canal Telefone) -------------------------------------------------
let dA = await carregarDados(ALINE, PADROES);
ok('H.6', 'Aline vê o colaborador fictício na lista de colaboradores do formulário', dA.colaboradores.some((c) => c.id === 'col-teste-homolog-1' && c.name === 'TESTE HOMOLOGAÇÃO — FICTÍCIO'));
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const GAB = (fase) => aplic.map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: { 'crit-01': 'Informação', 'crit-02': 'Receptivo', 'crit-29': 'Não' }[c.id], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) };
  if (c.id === 'crit-08') return { criterionId: c.id, score: 'N/A', lowScoreReason: '', subRespostas: null };
  if (c.id === 'crit-12' && fase === 1) return { criterionId: c.id, score: 1, lowScoreReason: 'TESTE: comunicação parcialmente clara (fictício).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const retrato = (await um("select retrato from public.regua_versoes where id = 'regua-2.0'")).retrato;
const notaBanco = async (s) => Number((await um("select app.calcular_nota($1::jsonb, 'Telefone', $2::jsonb)::text n", [JSON.stringify(retrato), JSON.stringify(s)])).n);
const prev = (s) => calcularNotaPrevia(aplic, Object.fromEntries(s.map((x) => [x.criterionId, { score: x.score }])));
const N1 = { banco: await notaBanco(GAB(1)), portal: prev(GAB(1)) }, N2 = { banco: await notaBanco(GAB(2)), portal: prev(GAB(2)) };
ok('H.7', `gabarito: ${aplic.length} critérios do Telefone na Régua 2.0; nota esperada no 1º envio ${N1.banco} (portal ${N1.portal}) e no reenvio ${N2.banco} (portal ${N2.portal})`,
   aplic.length === 28 && Math.abs(N1.banco - N1.portal) <= 0.01 && Math.abs(N2.banco - N2.portal) <= 0.01 && N1.banco < N2.banco);

// ---- 3. os 8 passos ---------------------------------------------------------------------------
const base = { id: '', competencia: COMP, date: `${HOJE}T12:00:00Z`, colaboradorId: 'col-teste-homolog-1', canal: 'Telefone', tipo: 'Calibração',
  categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'HOMOLOG-TESTE-001', numeroTitulo: 'TESTE', inicioAtendimento: `${HOJE}T09:00`, fimAtendimento: `${HOJE}T09:10`, duracaoMinutos: 10,
  comments: 'MONITORIA FICTÍCIA — TESTE DE HOMOLOGAÇÃO 15/10/2026. NÃO CONSIDERAR.', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [] };
const p1 = await tenta(() => salvarMonitoria(ALINE, base, dA.criterios, false, false));
const ID = p1.ok?.id;
const m1 = await um('select status, monitor_id, colaborador_id, regua_versao_id, nota, tipo, numero_atendimento, protocolo from public.monitorias where id = $1', [ID]);
ok('H.8', `passo 1 — rascunho: ${ID} / ${m1?.protocolo}, Rascunho, monitora usr-1, colaborador fictício, tipo Calibração, sem régua e sem nota`,
   !p1.erro && m1.status === 'Rascunho' && m1.monitor_id === 'usr-1' && m1.colaborador_id === 'col-teste-homolog-1' && m1.tipo === 'Calibração' && m1.regua_versao_id === null && m1.nota === null, p1.erro?.message);
dA = await carregarDados(ALINE, PADROES);
let mv = dA.monitorias.find((m) => m.id === ID);
const p3 = await tenta(() => salvarMonitoria(ALINE, { ...mv, scores: GAB(1), status: 'Pendente', finalScore: N1.portal }, dA.criterios, true, true));
ok('H.9', `passos 2–3 — envio: Pendente, Régua 2.0, nota do banco ${p3.ok?.nota} = esperada ${N1.banco}`, !p3.erro && p3.ok.status === 'Pendente' && p3.ok.regua_versao_id === 'regua-2.0' && Math.abs(p3.ok.nota - N1.banco) <= 0.01, p3.erro?.message);
let dE = await carregarDados(ERIVAN, PADROES);
const erivan = perfilDoLogin(dE, U(2));
let mE = dE.monitorias.find((m) => m.id === ID);
ok('H.10', 'passo 4 — Erivan vê a fictícia na fila, COM Validar disponível (não é migrada); a MON-10001 continua só com devolução',
   getFilaDeValidacao(dE.monitorias, HOJE).some((x) => x.monitoring.id === ID) && podeValidar(erivan, 'GESTOR', mE).pode && !exigeReenvio(mE)
   && exigeReenvio(dE.monitorias.find((m) => m.id === 'MON-10001')));
const p5 = await tenta(() => devolverMonitoria(ERIVAN, mE, 'TESTE: revisar o critério 12 (comunicação clara).'));
const m5 = await um('select status, regua_versao_id, extras, versao from public.monitorias where id = $1', [ID]);
ok('H.11', 'passo 5 — devolução: Rascunho para a Aline, com o motivo; a régua fica (E2)', !p5.erro && m5.status === 'Rascunho' && m5.regua_versao_id === 'regua-2.0', p5.erro?.message);
dA = await carregarDados(ALINE, PADROES);
mv = dA.monitorias.find((m) => m.id === ID);
ok('H.12', `a Aline vê a devolução com o motivo do Erivan ("${mv?.adjustmentReason}")`, /critério 12/.test(mv?.adjustmentReason || ''));
const p6 = await tenta(() => salvarMonitoria(ALINE, { ...mv, scores: GAB(2), status: 'Pendente', finalScore: N2.portal }, dA.criterios, true, true));
ok('H.13', `passo 6 — reenvio: Pendente, mesma Régua 2.0, nota nova ${p6.ok?.nota} = esperada ${N2.banco}, versão ${m5.versao} → ${p6.ok?.versao}`,
   !p6.erro && p6.ok.status === 'Pendente' && p6.ok.regua_versao_id === 'regua-2.0' && Math.abs(p6.ok.nota - N2.banco) <= 0.01 && p6.ok.versao > m5.versao, p6.erro?.message);
dE = await carregarDados(ERIVAN, PADROES);
mE = dE.monitorias.find((m) => m.id === ID);
const p7 = await tenta(() => validarMonitoria(ERIVAN, mE));
const m7 = await um('select status, aprovado_por, aprovado_em, nota from public.monitorias where id = $1', [ID]);
ok('H.14', `passo 7 — validação: Validada, aprovada por ${m7.aprovado_por} (Erivan), nota final ${m7.nota}`, !p7.erro && m7.status === 'Validada' && m7.aprovado_por === erivan.id && m7.aprovado_em !== null, p7.erro?.message);

const c7 = await conf();
ok('H.14b', `conferencia-11 depois da validação: "${c7[3]}" · "${c7[4]}" · auditoria "${c7[6]}" · MON-10001 igual à linha de base`,
   c7[2] === '1' && /· Validada · Calibração ·/.test(c7[3]) && /^regua-2\.0 · 100\.00 · v\d+$/.test(c7[4]) && /· 0 declaradas$/.test(c7[6]) && c7[7] === c0[7] && c7[8] === c0[8] && c7[11] === '0', JSON.stringify(c7));

// ---- 4. indicadores com a fictícia validada -----------------------------------------------------
dA = await carregarDados(ALINE, PADROES);
const mF = dA.monitorias.find((m) => m.id === ID);
const semFicticia = dA.monitorias.filter((m) => m.id !== ID);
const cart = getCarteiraProgress(dA.metasColaborador, dA.monitorias, 'usr-1', PERIODO), cart0 = getCarteiraProgress(dA.metasColaborador, semFicticia, 'usr-1', PERIODO);
ok('H.15', `indicadores (Calibração): a fictícia NÃO entra na carteira nem nas metas da Aline (entregues ${cart0.entregues} → ${cart.entregues}, validadas ${cart0.validated} → ${cart.validated}); aparece só em "fora da carteira" (${cart0.outOfCarteira} → ${cart.outOfCarteira})`,
   cart.entregues === cart0.entregues && cart.validated === cart0.validated && cart.outOfCarteira === cart0.outOfCarteira + 1 && countsTowardGoal(mF));

// ---- 5. auditoria e integridade ---------------------------------------------------------------
const aud = (await db.query(`select acao, autor_perfil_id a, responsavel_declarado d, papel from public.auditoria where tabela = 'monitorias' and chave ->> 'id' = $1 order by seq`, [ID])).rows;
const quebras = Number((await um('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q')).n);
ok('H.16', `passo 8 — auditoria da fictícia: ${aud.length} linhas, todas com o autor REAL do portal (${[...new Set(aud.map((x) => x.a))].join(', ')}), nenhuma declarada; cadeia sem quebras`,
   aud.length >= 5 && aud.every((x) => ['usr-1', erivan.id].includes(x.a) && x.d === null && x.papel === 'authenticated') && quebras === 0, JSON.stringify(aud));
ok('H.17', 'MON-10001 e MON-10002 continuam idênticas à linha de base', (await foto(['MON-10001', 'MON-10002'])) === linhaDeBase.reais);

// ---- 6. encerramento ---------------------------------------------------------------------------
// Hoje (sem ADMIN): ninguém do portal cancela, e o banco não aceita escrita direta sem responsável.
const aCancela = await tenta(() => cancelarMonitoria(ALINE, mF, 'x')), eCancela = await tenta(() => cancelarMonitoria(ERIVAN, mF, 'x'));
ok('H.18', 'hoje ninguém cancela pelo portal: Monitora e Gestor recebem MI403 (D7: só ADMIN com MFA)', aCancela.erro?.codigo === 'MI403' && eCancela.erro?.codigo === 'MI403');
let semResp = null; try { await db.exec(`update public.monitorias set status = 'Cancelada', versao_lida = versao where id = '${ID}'`); } catch (x) { semResp = x; }
ok('H.19', 'escrita direta no banco sem responsável declarado é recusada (MI401) — não há atalho silencioso', semResp?.code === 'MI401', semResp?.message);
// Caminho recomendado: conta ADMIN pessoal (decisão pendente com o Erivan), com MFA, cancela pelo portal.
const semMFA = await tenta(() => cancelarMonitoria(transporte(U(9), 'aal1'), mF, 'Teste de homologação de 15/10/2026 — registro fictício.'));
ok('H.20', 'ADMIN sem MFA (aal1) não cancela', ['MI403', '42501'].includes(semMFA.erro?.codigo), semMFA.erro?.message);
const audAntes = Number((await um('select count(*) n from public.auditoria')).n);
const canc = await tenta(() => cancelarMonitoria(transporte(U(9), 'aal2'), mF, 'Teste de homologação de 15/10/2026 — registro fictício.'));
const mC = await um('select status, cancelado_por, cancelado_motivo, nota, aprovado_por from public.monitorias where id = $1', [ID]);
ok('H.21', `ADMIN com MFA cancela pelo portal: Cancelada, cancelado_por ${mC.cancelado_por}, motivo gravado; nota e aprovação PRESERVADAS (${mC.nota}, ${mC.aprovado_por})`,
   !canc.erro && mC.status === 'Cancelada' && mC.cancelado_por === ADM && /fictício/.test(mC.cancelado_motivo) && mC.aprovado_por === erivan.id, canc.erro?.message);
ok('H.22', 'o cancelamento ACRESCENTA auditoria (nada é apagado ou reescrito); cadeia sem quebras',
   Number((await um('select count(*) n from public.auditoria')).n) > audAntes && Number((await um('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q')).n) === 0
   && Number((await um("select count(*) n from public.auditoria where tabela = 'monitorias' and chave ->> 'id' = $1 and acao = 'DELETE'", [ID])).n) === 0);
dA = await carregarDados(ALINE, PADROES); dE = await carregarDados(ERIVAN, PADROES);
const mX = dA.monitorias.find((m) => m.id === ID);
const cartX = getCarteiraProgress(dA.metasColaborador, dA.monitorias, 'usr-1', PERIODO);
ok('H.23', `depois do cancelamento: sai da fila e de todo indicador (conta como entregue: ${countsTowardGoal(mX)}; fora da carteira ${cart.outOfCarteira} → ${cartX.outOfCarteira}); continua VISÍVEL nas listas como "Cancelada" (rastreabilidade)`,
   mX?.status === 'Cancelada' && !countsTowardGoal(mX) && cartX.outOfCarteira === cart0.outOfCarteira && !getFilaDeValidacao(dE.monitorias, HOJE).some((x) => x.monitoring.id === ID));
ok('H.24', 'MON-10001 e MON-10002 intactas também depois do encerramento', (await foto(['MON-10001', 'MON-10002'])) === linhaDeBase.reais);
let r5 = null; try { await db.exec(`begin; set local app.responsavel = '${DECL}'; update public.colaboradores set ativo = false, versao_lida = versao where id = 'col-teste-homolog-1'; commit;`); } catch (x) { r5 = x; await db.exec('rollback').catch(() => {}); }
ok('H.25', 'depois que existe ADMIN, a declaração por nome (implantação) deixa de valer: desativar o colaborador exige declarar o ADMIN (R5)', r5?.code === 'MI401', r5?.message);
let r6 = null; try { await db.exec(`begin; set local app.responsavel = '${ADM}'; update public.colaboradores set ativo = false, versao_lida = versao where id = 'col-teste-homolog-1'; commit;`); } catch (x) { r6 = x; await db.exec('rollback').catch(() => {}); }
const colX = await um("select ativo from public.colaboradores where id = 'col-teste-homolog-1'");
ok('H.26', 'desativação do colaborador fictício declarada pelo ADMIN: aceita e auditada (sem apagar)', !r6 && colX.ativo === false, r6?.message);

const c9 = await conf();
ok('H.27', `conferencia-11 depois do encerramento: "${c9[1]}" · "${c9[3]}" · cadeia com ${c9[11]} quebras`, /INATIVO/.test(c9[1]) && /· Cancelada ·/.test(c9[3]) && c9[7] === c0[7] && c9[11] === '0', JSON.stringify(c9));

relatorio();
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
