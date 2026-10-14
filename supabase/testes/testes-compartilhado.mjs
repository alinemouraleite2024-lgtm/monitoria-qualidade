// Integração do MODO COMPARTILHADO: a camada de dados do PORTAL (src/shared/compartilhado) contra
// o banco de verdade (scripts 00–09a, RLS do 07, funções do 08), com DADOS SINTÉTICOS.
//
// Uso (precisa do gancho de TypeScript do projeto):
//   node --import <projeto>/tests/registrar-ts.mjs testes-compartilhado.mjs <projeto> <pasta reguas>
//
// O transporte deste teste faz o que a Data API do Supabase faz: abre a transação com o papel
// `authenticated` e o JWT do usuário (sub, aal), executa o select ou a função do schema `api` e
// devolve o resultado — então RLS, auditoria, versão e regras do 08 valem como em produção.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto, pastaReguas] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(projeto, p)).href);
const { carregarDados, perfilDoLogin, salvarMonitoria, validarMonitoria, reprovarMonitoria, devolverMonitoria, registrarAcesso } = await mod('src/shared/compartilhado/dados.ts');
const { ErroBanco, mensagemDoErro } = await mod('src/shared/compartilhado/transporte.ts');
const { definirModoParaTeste } = await mod('src/shared/compartilhado/modo.ts');
const storage = await mod('src/repositories/storage.ts');
const { calcularNotaPrevia } = await mod('src/domain/importacaoChatGPT.ts');
const { exigeReenvio, podeValidar } = await mod('src/domain/validacaoService.ts');
const { getFilaDeValidacao } = await mod('src/domain/queueService.ts');
const { gerar } = await import(pathToFileURL(join(projeto, 'supabase/migracao/gerar-09.mjs')).href);
const sql = (f) => readFileSync(join(projeto, 'supabase/sql', f), 'utf8');
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const regua = (r) => JSON.parse(readFileSync(join(pastaReguas, `${r}.json`), 'utf8'));
const R1 = regua('v0.25.0'), R024 = regua('v0.24.0'), RHEAD = regua('HEAD');

const resultados = [];
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const relatorio = () => { for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n').slice(1, 3).join(' | ')); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;

// ---- banco: 00..09a, ADMIN, migração sintética --------------------------------------------
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql']) await db.exec(sql(f));
// CAMINHO DE HOJE: nenhum perfil ADMIN existe. A migração é declarada pela pessoa que executa
// (exceção de implantação do 06, R5), e o portal funciona só com MONITOR e GESTOR.
const DECLARACAO = 'Pessoa Responsável Sintética <responsavel@exemplo.test>';

const crit = R1.criterios;
const respostas = (canal, extra = {}) => crit.filter((c) => c.active && c.channels.includes(canal)).map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: c.id === 'crit-29' ? 'Não' : c.opcoes[0], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') {
    const subs = Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM']));
    if (c.id === 'crit-24' && extra.sub243) subs['sub-24-3'] = 'SIM';
    return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: subs };
  }
  if (c.id === 'crit-06' && extra.c06) return { criterionId: c.id, score: 1, lowScoreReason: 'Faltou empatia (sintético).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const evid = crit.map((c) => (c.id === 'crit-06' ? { ...c, weight: 100 } : c));
const notaEvid = Number((await db.query("select app.calcular_nota($1::jsonb, 'WhatsApp', $2::jsonb)::text n", [JSON.stringify(evid), JSON.stringify(respostas('WhatsApp', { sub243: true, c06: true }))])).rows[0].n);
const pessoa = (id, n, perfis) => ({ id, email: `${n}@exemplo.test`, name: `Pessoa ${n}`, password: `Senha-${n}-sintetica`, status: 'ACTIVE', cargo: 'X', perfis });
const dados = {
  pm2_users: [pessoa('usr-1', 'monitora1', ['ADMIN', 'MONITOR']), pessoa('usr-4', 'pessoa4', []), pessoa('usr-5', 'pessoa5', []), pessoa('usr-7', 'admin', ['ADMIN']),
              pessoa('usr-20', 'monitora2', ['MONITOR'])],
  pm2_collaborators: ['usr-1', 'usr-4', 'usr-5'].map((id) => ({ id, email: `${id}@exemplo.test`, name: `Colaborador ${id}`, cargo: 'Front', active: true, areaId: 'area-1' })),
  pm2_areas: [{ id: 'area-1', name: 'Relacionamento', gestorId: '', monitorIds: [], active: true }, { id: 'area-2', name: 'Outra área', gestorId: '', monitorIds: ['usr-20'], active: true }],
  pm2_criteria: crit, pm2_catalog_categorias: ['BOLETOS', 'CADASTRO'], pm2_settings: { requireGestorValidation: true, defasagemCompetencia: 1 },
  pm2_brand: { id: 'b', name: 'MonitorIA', logoUrl: '', primaryColor: '#166534', secondaryColor: '#f28c1c', backgroundColor: '#fff', textColor: '#111' },
  pm2_auth_session: { email: 'monitora1@exemplo.test', perfilAtivo: 'MONITOR' },
  pm2_monitorings: [
    { id: 'MON-10002', monitorId: 'usr-1', colaboradorId: '', competencia: '2026-09', date: '2026-10-06T12:00:00Z', canal: '', protocolo: 'MON-2026-0002', status: 'Rascunho', finalScore: 0,
      scores: [], evidencias: [], links: [], eliminatoryPending: false, zerada: false },
    { id: 'MON-10001', monitorId: 'usr-1', colaboradorId: 'usr-4', gestorId: '', competencia: '2026-08', date: '2026-08-28T12:00:00Z', canal: 'WhatsApp', protocolo: 'MON-2026-0001',
      categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'AT-1', numeroTitulo: 'TIT-1', inicioAtendimento: '2026-08-28T10:00', fimAtendimento: '2026-08-28T10:20', tipo: 'Regular',
      status: 'Pendente', finalScore: notaEvid, scores: respostas('WhatsApp', { sub243: true, c06: true }), evidencias: [], links: [], eliminatoryPending: false, zerada: false },
    { id: 'MON-10003', monitorId: 'usr-20', colaboradorId: 'usr-5', competencia: '2026-08', date: '2026-08-22T12:00:00Z', canal: 'Telefone', protocolo: 'MON-2026-0003', status: 'Rascunho',
      finalScore: 0, scores: [], eliminatoryPending: false, zerada: false },
  ],
};
const exportacao = JSON.stringify({ meta: { exportadoEm: '2026-10-13T12:00:00.000Z', origem: 'https://sintetico.exemplo.test', versaoBanco: '11' },
  dados: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, JSON.stringify(v)])) });
const G = gerar({ exportacaoBruta: exportacao, regua1: R1, regua1Anterior: R024, reguaCodigo: RHEAD, agora: 1789000000000, decisoes: {
  responsavel_implantacao: DECLARACAO,
  perfis: { 'usr-1': { perfis: ['MONITOR'] }, 'usr-7': { perfis: [], status: 'INACTIVE' } },
  novos_perfis: [{ apelido: 'erivan', email: 'supervisor@exemplo.test', nome: 'Supervisor Sintético', perfis: ['GESTOR'] },
                 { apelido: 'gestor2', email: 'gestor2@exemplo.test', nome: 'Gestor Dois', perfis: ['GESTOR'] }],
  areas: { 'area-1': { gestor: '@erivan', monitores: ['usr-1'] }, 'area-2': { gestor: '@gestor2' } },
  regua1: { vigente_desde: '2026-08-31', anterior: 'x', datas: { commit_codigo: { data: '2026-08-31', situacao: 'comprovada' }, publicacao_producao: { situacao: 'nao_comprovada' } } },
  regua2: { vigente_desde: '2026-10-12' },
} });
await db.exec(G.sql);
const ERIVAN_ID = G.manifesto.novos_perfis.erivan;
// primeiros logins (o 01 liga o perfil pelo e-mail)
await db.exec(`begin; set local app.responsavel = '${DECLARACAO}'; insert into auth.users values
  ('${U(1)}', 'monitora1@exemplo.test', now()), ('${U(2)}', 'supervisor@exemplo.test', now()), ('${U(3)}', 'gestor2@exemplo.test', now()),
  ('${U(4)}', 'sem-perfil@exemplo.test', now()), ('${U(6)}', 'admin@exemplo.test', now()); commit;`);

// ---- conferência do 09 (a mesma que vai para o SQL Editor), logo depois da migração e dos logins ----
{ const conf = readFileSync(join(projeto, 'supabase/sql/conferencia-09.sql'), 'utf8').replace("'aline.oliveira@mouraleite.com.br'", "'monitora1@exemplo.test'");
  const itens = (await db.query(conf)).rows;
  const falhos = itens.filter((i) => i.ok === false).map((i) => i.item + ': ' + i.resultado);
  ok('C.00', `conferência do 09 (${itens.length} itens, só leitura) aprovada logo após a migração e os logins: contagens × manifesto, E3/E4b/E3m, perfis, réguas, auditoria declarada, cadeia, vínculo dos logins`,
     falhos.length === 0 && itens.filter((i) => i.ok === true).length === 15, JSON.stringify(falhos)); }

// ---- transporte PGlite (o que a Data API faz) ------------------------------------------------
const TIPOS = { p_dados: '::jsonb', p_versao_lida: '::integer', p_enviar: '::boolean', p_id: '::text', p_motivo: '::text' };
const normalizar = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(normalizar) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalizar(x)])) : v);
let consultas = 0;
const transporte = (uid, aal = 'aal1') => {
  const como = async (fn) => {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated","aal":"${aal}"}';`);
    try { const r = await fn(); await db.exec('commit'); consultas++; return r; }
    catch (x) { await db.exec('rollback'); throw new ErroBanco(x.code || 'ERRO', x.message, x.hint || ''); }
  };
  return {
    selecionar: (tb) => como(async () => (await db.query(`select * from public.${tb}`)).rows.map(normalizar)),
    chamar: (f, args) => como(async () => {
      const ks = Object.keys(args);
      const r = await db.query(`select api.${f}(${ks.map((k, i) => `${k} => $${i + 1}${TIPOS[k]}`).join(', ')}) r`, ks.map((k) => (k === 'p_dados' ? JSON.stringify(args[k]) : args[k])));
      return normalizar(r.rows[0].r);
    }),
    incluir: (tb, linha) => como(async () => { const ks = Object.keys(linha); await db.query(`insert into public.${tb} (${ks.join(', ')}) values (${ks.map((_, i) => `$${i + 1}`).join(', ')})`, ks.map((k) => linha[k])); }),
  };
};
const PADROES = { settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, brand: { id: 'p', name: 'p', logoUrl: '', primaryColor: '#000', secondaryColor: '#000', backgroundColor: '#fff', textColor: '#000' } };
const ALINE = transporte(U(1)), ERIVAN = transporte(U(2)), GES2 = transporte(U(3)), SEM = transporte(U(4)), USR7 = transporte(U(6));
const tenta = async (fn) => { try { return { ok: await fn() }; } catch (e) { return { erro: e }; } };

// ---- trava do localStorage durante todo o teste ----------------------------------------------
const ls = new Map([['pm2_monitorings', JSON.stringify(dados.pm2_monitorings)], ['pm2_users', JSON.stringify(dados.pm2_users)], ['pm2_database_version', '11']]);
globalThis.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k), key: (i) => [...ls.keys()][i] ?? null, get length() { return ls.size; } };
const fotoLS = JSON.stringify([...ls.entries()]);
definirModoParaTeste(true);

// =============================================================================
let dA = await carregarDados(ALINE, PADROES);
const aline = perfilDoLogin(dA, U(1));
ok('C.1', 'Aline entra: perfil usr-1 só MONITOR (contas separadas), vê o cadastro (pessoas, colaboradores, 29 critérios com sub-perguntas, categorias) e as monitorias DELA', aline?.id === 'usr-1' && JSON.stringify(aline.perfis) === '["MONITOR"]'
   && dA.usuarios.some((u) => u.id === ERIVAN_ID) && dA.colaboradores.length === 3 && dA.criterios.length === 29 && dA.criterios.find((c) => c.id === 'crit-24').subPerguntas.length === 2
   && dA.categorias.join() === 'BOLETOS,CADASTRO' && dA.monitorias.map((m) => m.id).sort().join() === 'MON-10001,MON-10002', JSON.stringify({ p: aline, m: dA.monitorias.map((m) => m.id) }));
ok('C.2', 'nenhuma senha chega à tela (perfis do banco não têm o campo)', !JSON.stringify(dA.usuarios).includes('Senha-') && dA.usuarios.every((u) => !('password' in u)));
const m1A = dA.monitorias.find((m) => m.id === 'MON-10001');
ok('C.3', `MON-10001 chega à tela com versão, origem "migracao", nota original ${notaEvid}, nota histórica e as 28 respostas (inclusive sub-24-3)`, m1A.versao >= 1 && m1A.origem === 'migracao' && m1A.finalScore === notaEvid && m1A.notaHistorica === notaEvid
   && m1A.scores.find((s) => s.criterionId === 'crit-24').subRespostas['sub-24-3'] === 'SIM', JSON.stringify({ v: m1A.versao, n: m1A.finalScore, h: m1A.notaHistorica }));
let dE = await carregarDados(ERIVAN, PADROES);
const erivan = perfilDoLogin(dE, U(2));
const filaE = getFilaDeValidacao(dE.monitorias, '2026-10-13').map((f) => f.monitoring?.id ?? f.id);
ok('C.4', 'Erivan entra como GESTOR, vê só a equipe dele (MON-10001/10002 da Aline; NÃO a MON-10003 da outra área) e a MON-10001 está na fila de validação (agosto)', erivan?.id === ERIVAN_ID && JSON.stringify(erivan.perfis) === '["GESTOR"]'
   && dE.monitorias.some((m) => m.id === 'MON-10001') && !dE.monitorias.some((m) => m.id === 'MON-10003') && JSON.stringify(filaE).includes('MON-10001'), JSON.stringify({ e: erivan?.id, m: dE.monitorias.map((m) => m.id), filaE }));
const dS = await carregarDados(SEM, PADROES);
const d7 = await carregarDados(USR7, PADROES);
ok('C.5', 'login sem perfil e o usr-7 genérico (inativo): o banco não devolve NADA e não há perfil — o portal recusa a entrada', perfilDoLogin(dS, U(4)) === null && dS.monitorias.length === 0 && dS.usuarios.length === 0 && perfilDoLogin(d7, U(6)) === null && d7.criterios.length === 0);

// ---- Aline registra: rascunho, envio ----
const base = { id: 'MON-77777', protocolo: 'MON-2026-0777', competencia: '2026-08', date: '2026-08-21T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'usr-5', canal: 'Telefone', tipo: 'Regular',
  categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'AT-77', numeroTitulo: 'TIT-77', inicioAtendimento: '2026-08-21T09:00', fimAtendimento: '2026-08-21T09:12', duracaoMinutos: 12,
  status: 'Rascunho', finalScore: 0, scores: respostas('Telefone', { c06: true }).slice(0, 5), evidencias: [], links: [] };
const r1 = await tenta(() => salvarMonitoria(ALINE, base, dA.criterios, false, false));
dA = await carregarDados(ALINE, PADROES);
const nova = dA.monitorias.find((m) => m.id === r1.ok?.id);
ok('C.6', `rascunho novo: id e protocolo gerados pelo BANCO (${r1.ok?.id} / ${r1.ok?.protocolo}), não os do navegador; situação Rascunho; versão 1`, !r1.erro && r1.ok.id !== 'MON-77777' && /^MON-2026-\d{4}$/.test(r1.ok.protocolo)
   && r1.ok.protocolo !== 'MON-2026-0777' && nova?.status === 'Rascunho' && nova.versao === 1 && nova.monitorId === 'usr-1', r1.erro?.message);
const aplic = dA.criterios.filter((c) => c.active && c.channels.includes('Telefone'));
const resp = respostas('Telefone', { c06: true });
const notaPortal = calcularNotaPrevia(aplic, Object.fromEntries(resp.map((s) => [s.criterionId, { score: s.score }])));
const envio = { ...nova, scores: resp, status: 'Pendente', finalScore: notaPortal };
const r2 = await tenta(() => salvarMonitoria(ALINE, envio, dA.criterios, true, true));
ok('C.7', `envio: Pendente, Régua 2.0, nota calculada pelo banco (${r2.ok?.nota}) = prévia do portal (${notaPortal})`, !r2.erro && r2.ok.status === 'Pendente' && r2.ok.regua_versao_id === 'regua-2.0' && Math.abs(r2.ok.nota - notaPortal) <= 0.01, r2.erro?.message);
const reenvioDireto = await tenta(() => salvarMonitoria(ALINE, { ...envio, versao: r2.ok.versao }, dA.criterios, true, false));
ok('C.8', 'depois do envio a Monitora não edita mais (D4): o banco recusa e a tela recebe a mensagem', reenvioDireto.erro?.codigo === 'MI403' && /rascunho/i.test(mensagemDoErro(reenvioDireto.erro)), reenvioDireto.erro?.message);
const alineValida = await tenta(() => validarMonitoria(ALINE, { ...envio, id: r2.ok.id, versao: r2.ok.versao }));
ok('C.9', 'a Monitora não valida (MI403)', alineValida.erro?.codigo === 'MI403', alineValida.erro?.message);

// ---- Erivan: fila, versão desatualizada, devolução, validação ----
dE = await carregarDados(ERIVAN, PADROES);
let alvo = dE.monitorias.find((m) => m.id === r2.ok.id);
ok('C.10', 'Erivan vê a nova monitoria na fila de validação', JSON.stringify(getFilaDeValidacao(dE.monitorias, '2026-10-13')).includes(r2.ok.id));
const velha = await tenta(() => validarMonitoria(ERIVAN, { ...alvo, versao: alvo.versao - 1 }));
ok('C.11', 'versão desatualizada (outra pessoa mexeu antes): MI409 e mensagem clara, nada é gravado', velha.erro?.codigo === 'MI409' && /Outra pessoa alterou/.test(mensagemDoErro(velha.erro)), velha.erro?.message);
const semMotivo = await tenta(() => reprovarMonitoria(ERIVAN, alvo, '  '));
ok('C.12', 'reprovar sem motivo: recusado (MI422) com a mensagem do banco', semMotivo.erro?.codigo === 'MI422' && /motivo/i.test(mensagemDoErro(semMotivo.erro)), semMotivo.erro?.message);
const dev = await tenta(() => devolverMonitoria(ERIVAN, alvo, 'Ajustar a justificativa do critério 6.'));
dA = await carregarDados(ALINE, PADROES);
const devolvida = dA.monitorias.find((m) => m.id === r2.ok.id);
ok('C.13', 'devolução: volta Rascunho para a Aline, com o motivo do Erivan e a régua mantida (E2)', !dev.erro && devolvida.status === 'Rascunho' && devolvida.adjustmentReason === 'Ajustar a justificativa do critério 6.' && devolvida.reguaVersaoId === 'regua-2.0', dev.erro?.message);
const reenvio = await tenta(() => salvarMonitoria(ALINE, { ...devolvida, status: 'Pendente', finalScore: notaPortal }, dA.criterios, true, true));
dE = await carregarDados(ERIVAN, PADROES);
alvo = dE.monitorias.find((m) => m.id === r2.ok.id);
const val = await tenta(() => validarMonitoria(ERIVAN, alvo));
dA = await carregarDados(ALINE, PADROES);
const validada = dA.monitorias.find((m) => m.id === r2.ok.id);
ok('C.14', 'Aline reenvia → Erivan valida → a Aline vê "Validada", com a nota do banco e quem aprovou', !reenvio.erro && !val.erro && validada.status === 'Validada' && validada.approvedBy === ERIVAN_ID && Math.abs(validada.finalScore - notaPortal) <= 0.01,
   (reenvio.erro || val.erro)?.message);
const outroGestor = await tenta(() => devolverMonitoria(GES2, m1A, 'x'));
ok('C.15', 'gestor de OUTRA área não alcança a monitoria da Aline (MI404)', outroGestor.erro?.codigo === 'MI404', outroGestor.erro?.message);

// ---- MON-10001 migrada: M1, devolução, reenvio limpo pela Régua 1 ----
dE = await carregarDados(ERIVAN, PADROES);
let m1E = dE.monitorias.find((m) => m.id === 'MON-10001');
const m1val = await tenta(() => validarMonitoria(ERIVAN, m1E));
ok('C.16', 'MON-10001: validar direto é recusado (nota não calculada pelo banco — M1) e a tela explica o motivo', m1val.erro?.codigo === 'MI403' && /migrada/.test(mensagemDoErro(m1val.erro)), m1val.erro?.message);
ok('C.16a', 'tela (M1): a MON-10001 lida do banco pelo Erivan exige devolução e reenvio — Validar, Reprovar e Confirmar Zerada saem da tela; Devolver continua (podeValidar)',
   exigeReenvio(m1E) === true && podeValidar(perfilDoLogin(dE, U(2)), 'GESTOR', m1E).pode === true);
// PENDÊNCIA (14/10/2026): a API ainda ACEITA reprovar uma migrada sem régua. Provado numa transação desfeita.
await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${U(2)}","role":"authenticated","aal":"aal1"}';`);
let pendencia; try { pendencia = (await db.query("select api.reprovar_monitoria('MON-10001', $1::integer, 'teste de pendência') r", [m1E.versao])).rows[0].r?.status; } catch (x) { pendencia = 'recusada: ' + x.code; }
await db.exec('rollback');
const aindaPendente = (await db.query("select status from public.monitorias where id = 'MON-10001'")).rows[0].status;
ok('C.16c', `P1 fechada (script 10): reprovar direto a MON-10001 migrada sem régua pela API → ${pendencia}`, pendencia === 'recusada: MI403');
ok('C.16b', 'a sondagem da pendência não deixou rastro: MON-10001 continua Pendente', aindaPendente === 'Pendente');
await devolverMonitoria(ERIVAN, m1E, 'Revisar pela Régua 1 oficial (peso do critério 6).');
dA = await carregarDados(ALINE, PADROES);
const m1D = dA.monitorias.find((m) => m.id === 'MON-10001');
const aplicW = dA.criterios.filter((c) => c.active && c.channels.includes('WhatsApp'));
const notaW = calcularNotaPrevia(aplicW, Object.fromEntries(m1D.scores.map((s) => [s.criterionId, { score: s.score }])));
const m1R = await tenta(() => salvarMonitoria(ALINE, { ...m1D, status: 'Pendente', finalScore: notaW }, dA.criterios, true, true));
dA = await carregarDados(ALINE, PADROES);
const m1F = dA.monitorias.find((m) => m.id === 'MON-10001');
ok('C.17', `reenvio da MON-10001 pelo portal: a sub-24-3 obsoleta é retirada antes de enviar, o banco aceita pela Régua 1, nota ${m1R.ok?.nota}, e a nota histórica ${notaEvid} continua lá`,
   !m1R.erro && m1F.reguaVersaoId === 'regua-1' && m1F.notaHistorica === notaEvid && !('sub-24-3' in m1F.scores.find((s) => s.criterionId === 'crit-24').subRespostas), m1R.erro?.message);
{ await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${U(2)}","role":"authenticated","aal":"aal1"}';`);
  let st; try { st = (await db.query("select api.reprovar_monitoria('MON-10001', $1::integer, 'teste') r", [m1F.versao])).rows[0].r?.status; } catch (x) { st = 'erro ' + x.code; }
  await db.exec('rollback');
  ok('C.17b', `depois do reenvio, reprovar volta a ser aceito pela API (transação desfeita) → ${st}`, st === 'Reprovada'); }
ok('C.17a', 'depois do reenvio a MON-10001 tem régua: a tela volta a oferecer as decisões normais do gestor', exigeReenvio(m1F) === false);

// ---- rascunho vindo do portal antigo (E3m) ----
const m2 = dA.monitorias.find((m) => m.id === 'MON-10002');
const r10002 = await tenta(() => salvarMonitoria(ALINE, { ...m2, colaboradorId: 'usr-4', canal: 'Telefone', tipo: 'Regular', categoriaAtendimento: 'CADASTRO', numeroAtendimento: 'AT-2', numeroTitulo: 'TIT-2',
  inicioAtendimento: '2026-10-06T08:00', fimAtendimento: '2026-10-06T08:05', scores: resp, status: 'Pendente', finalScore: notaPortal }, dA.criterios, true, true));
ok('C.18', 'rascunho migrado do portal antigo (MON-10002) é concluído no portal compartilhado e vai pela Régua 2.0 (E3m)', !r10002.erro && r10002.ok.regua_versao_id === 'regua-2.0', r10002.erro?.message);

// ---- caminho sem ADMIN ----
{ const sem = (await db.query("select count(*)::int n from public.perfis where 'ADMIN' = any (perfis)")).rows[0].n;
  const lote = (await db.query('select responsavel from app.migracao_lotes')).rows[0];
  const decl = (await db.query("select count(*)::int n, count(*) filter (where responsavel_declarado = $1)::int d from public.auditoria where transacao = (select transacao from app.migracao_lotes)", [DECLARACAO])).rows[0];
  ok('C.0', 'banco SEM nenhum perfil ADMIN: a migração foi aplicada com a declaração de implantação (nome e e-mail de quem executou), registrada no lote e em TODAS as linhas da auditoria da migração',
     sem === 0 && lote.responsavel === DECLARACAO && decl.n > 0 && decl.d === decl.n, JSON.stringify({ sem, lote, decl })); }

// ---- histórico de acessos e auditoria ----
await registrarAcesso(ALINE, 'LOGIN', aline, 'MONITOR');
const acesso = (await db.query("select perfil_id, tipo_evento, usuario_email from public.acessos_log where tipo_evento = 'LOGIN' and perfil_id is not null order by seq desc limit 1")).rows[0];
ok('C.19', 'entrada registrada no banco (acessos_log), com o perfil carimbado pelo banco', acesso?.perfil_id === 'usr-1' && acesso.usuario_email === 'monitora1@exemplo.test', JSON.stringify(acesso));
const aud = (await db.query(`select count(*)::int n, count(*) filter (where autor_perfil_id = 'usr-1')::int a, count(*) filter (where autor_perfil_id = '${ERIVAN_ID}')::int e
  from public.auditoria where tabela = 'monitorias' and transacao <> (select transacao from app.migracao_lotes limit 1)`)).rows[0];
const quebras = (await db.query('select count(*)::int n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra')).rows[0].n;
ok('C.20', `toda gravação feita pelo portal ficou na auditoria com o autor real (Aline ${aud.a}, Erivan ${aud.e}); cadeia íntegra`, aud.a > 0 && aud.e > 0 && aud.a + aud.e === aud.n && quebras === 0, JSON.stringify({ aud, quebras }));

// ---- localStorage ----
ok('C.21', `durante todas as ${consultas} operações, o localStorage do portal antigo (pm2_*) ficou idêntico — nada lido para a tela, gravado ou apagado`, JSON.stringify([...ls.entries()]) === fotoLS
   && JSON.stringify(storage.read('pm2_monitorings', [])) === '[]');
definirModoParaTeste(null);

relatorio();
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length} testes · ${resultados.length - falhas.length} aprovados · ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
