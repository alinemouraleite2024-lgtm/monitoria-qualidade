// Metas e planos no banco compartilhado (25/10/2026), num Postgres LOCAL igual à homologação:
// 00–09a, 09b REAL, 10, 12, 12a e os logins de Aline (MONITOR) e Erivan (GESTOR).
//   1. o script 13 (monitora responsável nas metas de agosto): conferência, efeito, auditoria e
//      recusa ao rodar de novo;
//   2. o código do PORTAL gravando metas e planos (src/shared/compartilhado/documentos.ts) com as
//      regras reais: RLS do 07 (só GESTOR grava), versão do 00 (MI409), remoção lógica do 05;
//   3. Painel do Erivan em agosto, antes e depois (goalService + resultadosService).
// Nada é criado no Supabase.
//
// Uso: node --import <projeto>/tests/registrar-ts.mjs testes-13-metas.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, perfilDoLogin } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const { gravarColecao } = await mod('src/shared/compartilhado/documentos.ts');
const { resolverMetasDoPeriodo, sucederPlano, getPlanoVigente } = await mod('src/domain/planoMetasService.ts');
const { getCarteiraProgress } = await mod('src/domain/goalService.ts');
const { resumirNotas } = await mod('src/domain/resultadosService.ts');
const { getEquipeDoGestor } = await mod('src/domain/scopeService.ts');
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const man = JSON.parse(readFileSync(join(projeto, 'supabase/migracao/saida/manifesto.json'), 'utf8'));
const DECL = man.responsavel.declarado;
const r = [];
const ok = (id, d, c, det = '') => r.push({ id, d, ok: !!c, det });
const relatorio = () => { for (const x of r) console.log(`${x.ok ? '✔' : '✖'} ${x.id}  ${x.d}${x.ok ? '' : `  → ${x.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const ERIVAN = 'usr-1791895673216';
const AGOSTO = { year: 2026, month: 7 }, OUTUBRO = { year: 2026, month: 9 };
definirModoParaTeste(true);

const STUB_MFA = `create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  friendly_name text, factor_type text not null default 'totp', status text not null, created_at timestamptz default now());`;
const SCRIPTS = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'];
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP); await db.exec(STUB_MFA);
for (const f of SCRIPTS) await db.exec(sql(f));
await db.exec(readFileSync(join(projeto, 'supabase/migracao/saida/09b_migracao_dados.sql'), 'utf8'));
await db.exec(sql('10_p1_reprovar_m1.sql'));
await db.exec(sql('12_estado_do_acesso_mfa.sql'));
await db.exec(`begin; set local app.responsavel = '${DECL}'; insert into auth.users values ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()); commit;`);
await db.exec(sql('12a_admin_aline_oliveira.sql'));
const um = async (q, p) => (await db.query(q, p)).rows[0];
const roda = async (f) => { try { await db.exec(sql(f)); return null; } catch (x) { await db.exec('rollback').catch(() => {}); return x; } };

// transporte igual ao da Data API (PostgREST): papel authenticated + JWT do usuário
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
const transporte = (uid) => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"aal1"}';`);
    try { const x = await fn(); await db.exec('commit'); return x; } catch (x) { await db.exec('rollback'); throw x instanceof ErroBanco ? x : new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  const val = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : v);
  return {
    selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: () => { throw new Error('não usado aqui'); },
    incluir: (tb, linha) => como(async () => { const ks = Object.keys(linha); await db.query(`insert into public.${tb} (${ks.join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`, ks.map((k) => val(linha[k]))); }),
    // o mesmo contrato de supabase.ts: update ... match(chave) ... select('versao'); 0 linhas = recusa
    alterar: (tb, chave, valores, versaoLida) => como(async () => {
      const sets = { ...valores, versao_lida: versaoLida }; const ks = Object.keys(sets); const cs = Object.keys(chave);
      const rows = (await db.query(`update public.${tb} set ${ks.map((k, i) => `${k} = $${i + 1}`).join(', ')} where ${cs.map((k, i) => `${k} = $${ks.length + i + 1}`).join(' and ')} returning versao`,
        [...ks.map((k) => val(sets[k])), ...cs.map((k) => chave[k])])).rows;
      if (rows.length !== 1) throw new ErroBanco('42501', 'O banco não aceitou a alteração (registro não encontrado ou sem permissão).');
      return Number(rows[0].versao);
    }),
  };
};
const ALINE = transporte(U(1)), ERV = transporte(U(2));
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };
const carregar = (tr) => carregarDados(tr, PADROES);
const quebras = async () => Number((await um('select count(*) n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) q from public.auditoria a) x where q')).n);
const painel = (d, periodo) => {
  const eu = perfilDoLogin(d, U(2));
  const equipe = getEquipeDoGestor(eu, d.areas, 'GESTOR');
  const metas = resolverMetasDoPeriodo(d.planosMetas, d.metasColaborador, periodo).metas;
  const p = getCarteiraProgress(metas, d.monitorias, 'usr-1', periodo);
  const notas = resumirNotas(d.monitorias.filter((m) => equipe.includes(m.monitorId) && m.competencia === `${periodo.year}-${String(periodo.month + 1).padStart(2, '0')}`));
  return { equipe, metas, p, notas };
};

// ---- 1. linha de base: agosto sem meta no Painel ---------------------------------------------
let dE = await carregar(ERV);
const p0 = painel(dE, AGOSTO);
ok('M.1', `Erivan (GESTOR) carrega as 7 metas de agosto e o "Plano 2026"; equipe = [${p0.equipe}]; o Painel de agosto diz SEM META (metas sem monitora): alvo ${p0.p.target}, hasGoal ${p0.p.hasGoal}`,
   dE.metasColaborador.filter((g) => g.month === 7).length === 7 && dE.metasColaborador.every((g) => g.monitorId === '') && dE.planosMetas.length === 1
   && JSON.stringify(p0.equipe) === '["usr-1"]' && p0.p.hasGoal === false && p0.p.target === 0, JSON.stringify(p0.p));
ok('M.2', `as monitorias de agosto visíveis ao Erivan entram no resumo (${p0.notas.total} registrada(s), ${p0.notas.consideradas} na média, média ${p0.notas.media})`,
   p0.notas.total >= 1 && p0.notas.consideradas >= 1, JSON.stringify(p0.notas));

// ---- 2. script 13 ---------------------------------------------------------------------------
const aud0 = Number((await um('select count(*) n from public.auditoria')).n);
let e = await roda('13_correcao_metas_agosto.sql');
const docs = (await db.query("select id, ativo, versao, conteudo from public.documentos where colecao = 'metas_colaborador' order by ordem")).rows;
const audDocs = (await db.query("select acao, responsavel_declarado d, antes, depois from public.auditoria where tabela = 'documentos' and seq > (select max(seq) - 7 from public.auditoria) order by seq")).rows;
ok('M.3', '13 aplicado: 6 metas com monitorId usr-1 (valores, canais e ids iguais), a sem colaboradora retirada (ativo false, conteúdo intacto), todas na versão 2',
   !e && docs.length === 7 && docs.filter((x) => x.ativo && x.conteudo.monitorId === 'usr-1' && x.conteudo.targetQty === 5 && x.versao === 2).length === 6
   && docs.filter((x) => !x.ativo && x.id === 'cgoal-1789126035423' && x.conteudo.monitorId === '' && x.versao === 2).length === 1, e?.message ?? JSON.stringify(docs));
ok('M.4', `auditoria: 7 UPDATE em documentos declarados por "${audDocs[0]?.d}", com o conteúdo original em "antes"; cadeia sem quebras`,
   Number((await um('select count(*) n from public.auditoria')).n) === aud0 + 7 && audDocs.length === 7 && audDocs.every((a) => a.acao === 'UPDATE' && a.d === 'adm-aline-oliveira' && a.antes.conteudo.monitorId === '')
   && (await quebras()) === 0, JSON.stringify(audDocs.map((a) => [a.acao, a.d])));
e = await roda('13_correcao_metas_agosto.sql');
ok('M.5', 'rodar o 13 de novo: RECUSADO (MI409) e nada muda', e?.code === 'MI409' && Number((await um('select count(*) n from public.auditoria')).n) === aud0 + 7, e?.message);

dE = await carregar(ERV);
const p1 = painel(dE, AGOSTO);
ok('M.6', `depois do 13, o Painel do Erivan em agosto tem meta: alvo ${p1.p.target} (6 linhas de 5), entregues ${p1.p.entregues}, cobertura ${p1.p.cobertura}`,
   p1.p.hasGoal && p1.p.target === 30 && p1.metas.length === 6 && p1.p.entregues === p1.notas.consideradas && p1.p.cobertura >= 1, JSON.stringify(p1.p));

// ---- 3. portal gravando metas (GESTOR) ---------------------------------------------------------
const nova = { id: 'cgoal-teste-1', monitorId: 'usr-1', colaboradorId: 'usr-4', year: 2026, month: 9, canal: 'WhatsApp', targetQty: 7 };
const antes1 = dE.metasColaborador;
e = await tenta(() => gravarColecao(ERV, 'metas_colaborador', dE.indiceDocumentos, antes1, [...antes1, nova]));
let linhaNova = await um("select ativo, versao, ordem, criado_por, conteudo from public.documentos where colecao = 'metas_colaborador' and id = 'cgoal-teste-1'");
dE = await carregar(ERV);
ok('M.7', 'Erivan inclui uma meta pelo portal: gravada (versão 1, ordem 7, autoria = login do Erivan) e presente ao recarregar — persistência entre sessões',
   e.ok === 1 && linhaNova?.versao === 1 && linhaNova.ordem === 7 && linhaNova.criado_por === U(2) && dE.metasColaborador.some((g) => g.id === 'cgoal-teste-1' && g.targetQty === 7), e.erro?.message);
const dA = await carregar(ALINE);
ok('M.8', 'Aline (MONITOR) vê exatamente as mesmas metas e planos que o Erivan (perfis autorizados com informação consistente)',
   JSON.stringify(dA.metasColaborador) === JSON.stringify(dE.metasColaborador) && JSON.stringify(dA.planosMetas) === JSON.stringify(dE.planosMetas));

e = await tenta(() => gravarColecao(ERV, 'metas_colaborador', dE.indiceDocumentos, dE.metasColaborador, dE.metasColaborador.map((g) => (g.id === 'cgoal-teste-1' ? { ...g, targetQty: 9 } : g))));
linhaNova = await um("select versao, conteudo from public.documentos where colecao = 'metas_colaborador' and id = 'cgoal-teste-1'");
ok('M.9', 'Erivan altera o volume: só essa linha muda (1 operação), versão 2', e.ok === 1 && linhaNova.versao === 2 && linhaNova.conteudo.targetQty === 9, e.erro?.message);

const velho = dE; // sessão aberta antes da alteração acima
e = await tenta(() => gravarColecao(ERV, 'metas_colaborador', velho.indiceDocumentos, velho.metasColaborador, velho.metasColaborador.map((g) => (g.id === 'cgoal-teste-1' ? { ...g, targetQty: 3 } : g))));
ok('M.10', 'alteração a partir de uma tela desatualizada: RECUSADA (MI409) — ninguém sobrescreve o trabalho do outro', e.erro?.codigo === 'MI409'
   && (await um("select conteudo from public.documentos where colecao = 'metas_colaborador' and id = 'cgoal-teste-1'")).conteudo.targetQty === 9, e.erro?.codigo);

dE = await carregar(ERV);
e = await tenta(() => gravarColecao(ERV, 'metas_colaborador', dE.indiceDocumentos, dE.metasColaborador, dE.metasColaborador.filter((g) => g.id !== 'cgoal-teste-1')));
linhaNova = await um("select ativo, versao from public.documentos where colecao = 'metas_colaborador' and id = 'cgoal-teste-1'");
dE = await carregar(ERV);
ok('M.11', 'Erivan remove a meta: remoção LÓGICA (ativo false, a linha fica no banco) e ela some da tela', e.ok === 1 && linhaNova.ativo === false && !dE.metasColaborador.some((g) => g.id === 'cgoal-teste-1'), e.erro?.message);

e = await tenta(() => gravarColecao(ALINE, 'metas_colaborador', dA.indiceDocumentos, dA.metasColaborador, [...dA.metasColaborador, { ...nova, id: 'cgoal-teste-aline' }]));
const e2 = await tenta(() => gravarColecao(ALINE, 'metas_colaborador', dE.indiceDocumentos, dE.metasColaborador, dE.metasColaborador.map((g, i) => (i === 0 ? { ...g, targetQty: 99 } : g))));
ok('M.12', `MONITOR não grava metas: inclusão recusada (${e.erro?.codigo}) e alteração recusada (${e2.erro?.codigo}); nada mudou`,
   e.erro?.codigo === '42501' && e2.erro?.codigo === '42501' && !(await um("select 1 x from public.documentos where id = 'cgoal-teste-aline'"))
   && !(await carregar(ERV)).metasColaborador.some((g) => g.targetQty === 99), JSON.stringify([e.erro?.message, e2.erro?.message]));

// ---- 4. planos -------------------------------------------------------------------------------
dE = await carregar(ERV);
const plano = dE.planosMetas[0];
const { substitui, novo } = sucederPlano(plano, [...plano.linhas, { monitorId: 'usr-1', colaboradorId: 'usr-6', targetQty: 2, canal: 'WhatsApp' }], OUTUBRO, ERIVAN);
e = await tenta(() => gravarColecao(ERV, 'planos_metas', dE.indiceDocumentos, dE.planosMetas, [substitui, novo]));
dE = await carregar(ERV);
const vAgo = getPlanoVigente(dE.planosMetas, AGOSTO), vOut = getPlanoVigente(dE.planosMetas, OUTUBRO);
ok('M.13', `Erivan edita o plano em outubro: sucessão gravada (antigo até ${substitui.vigenciaFim}, novo desde ${novo.vigenciaInicio}); agosto continua com o plano original`,
   e.ok === 2 && dE.planosMetas.length === 2 && vAgo?.id === plano.id && vAgo.vigenciaFim === '2026-09' && vOut?.id === novo.id && vOut.linhas.length === plano.linhas.length + 1, e.erro?.message);
const p2 = painel(dE, AGOSTO);
ok('M.14', 'o Painel de agosto não mudou com a edição do plano em outubro (o passado não é reescrito)', JSON.stringify(p2.p) === JSON.stringify(p1.p), JSON.stringify([p1.p, p2.p]));
ok('M.15', 'cadeia da auditoria íntegra no fim; nenhuma linha de documentos foi apagada', (await quebras()) === 0
   && Number((await um("select count(*) n from public.documentos where colecao in ('metas_colaborador','planos_metas')")).n) === 7 + 1 + 1 + 1);

relatorio();
const f = r.filter((x) => !x.ok);
console.log(`\n${r.length} testes · ${r.length - f.length} aprovados · ${f.length} falhas`);
process.exit(f.length ? 1 : 0);
