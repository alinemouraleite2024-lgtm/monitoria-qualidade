// Testes do 09 (migração) com DADOS SINTÉTICOS — nenhum dado real.
// Uso: node testes-09.mjs <pasta sql> <gerar-09.mjs> <pasta com reguas/*.json> <catalogos-semente.json>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [pasta, geradorPath, pastaReguas, catalogosPath] = process.argv.slice(2);
const sql = (f) => readFileSync(join(pasta, f), 'utf8');
const { gerar, canonico } = await import(pathToFileURL(geradorPath).href);
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const resultados = [];
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n')[1]); process.exit(2); });
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const erro = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;
const SCRIPTS = ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql'];
const regua = (r) => JSON.parse(readFileSync(join(pastaReguas, `${r}.json`), 'utf8'));
const R1 = regua('v0.25.0'), RHEAD = regua('HEAD'), R024 = regua('v0.24.0');
const cat = JSON.parse(readFileSync(catalogosPath, 'utf8'));

const novoBanco = async () => {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SETUP);
  for (const f of [...SCRIPTS, '10_p1_reprovar_m1.sql']) await db.exec(sql(f));
  // implantação do 1º ADMIN (procedimento do 06): declaração por nome, depois o id
  await db.exec(`begin; set local app.responsavel = 'Administração Sintética <adm@exemplo.test>';
    insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração Sintética', '{ADMIN}', 'ACTIVE');
    commit;`);
  return db;
};
const um = async (db, q, p) => (await db.query(q, p)).rows[0];

// ---- exportação sintética, com a mesma forma do portal (26 chaves) --------------------------
const SENHAS = ['Sintetica#Senha-01', 'Sintetica#Senha-03', 'Sintetica#Senha-04', 'Sintetica#Senha-05', 'Sintetica#Senha-06', 'Sintetica#Senha-07', 'Sintetica#Senha-GG'];
const pessoa = (id, n, perfis, senha, extra = {}) => ({ id, email: `${n}@exemplo.test`, login: n, password: senha, name: `Pessoa ${n}`, cargo: 'Cargo X', area: 'Relacionamento', gestor: '', status: 'ACTIVE', provider: 'local', lastAccess: '', photoUrl: '', perfis, ...extra });
const usuarios = [
  pessoa('usr-1', 'monitora1', ['ADMIN', 'MONITOR'], SENHAS[0]),
  pessoa('usr-3', 'pessoa3', [], SENHAS[1]), pessoa('usr-4', 'pessoa4', [], SENHAS[2]), pessoa('usr-5', 'pessoa5', [], SENHAS[3]), pessoa('usr-6', 'pessoa6', [], SENHAS[4]),
  pessoa('usr-7', 'admin', ['ADMIN'], SENHAS[5]),
  { name: 'Gestora Sintética', email: 'gestora@exemplo.test', login: 'gestora', password: SENHAS[6], confirmPassword: SENHAS[6], perfis: ['GESTOR'], cargo: 'Supervisão', area: 'Relacionamento', gestor: '', status: 'ACTIVE', photoUrl: '', observacoes: '', id: 'usr-1788800361784' },
];
const colaboradores = ['usr-1', 'usr-3', 'usr-4', 'usr-5', 'usr-6'].map((id) => ({ id, email: `${id}@exemplo.test`, name: `Colaborador ${id}`, cargo: 'Front Office', active: true, areaId: 'area-1' }));
const criteriosAtuais = R1.criterios;
const evidencia = criteriosAtuais.map((c) => (c.id === 'crit-06' ? { ...c, weight: 100, channels: c.channels.filter((x) => x !== 'Telefone') } : c));
const c24antigo = R024.criterios.find((c) => c.id === 'crit-24');
const respostasMax = (crits, canal, sub243) => crits.filter((c) => c.active && c.channels.includes(canal)).map((c) => {
  if (c.tipoResposta === 'MULTIPLA_ESCOLHA') return { criterionId: c.id, score: c.id === 'crit-29' ? 'Não' : c.opcoes[0], lowScoreReason: '', subRespostas: null };
  if (c.tipoResposta === 'CHECKLIST_SIM_NAO') {
    const subs = Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM']));
    if (c.id === 'crit-24' && sub243) subs['sub-24-3'] = 'SIM';
    return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: subs };
  }
  if (c.id === 'crit-06') return { criterionId: c.id, score: 1, lowScoreReason: 'Faltou demonstrar interesse (sintético).', subRespostas: null };
  return { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null };
});
const mon10001 = (nota) => ({ id: 'MON-10001', colaboradorId: 'usr-4', monitorId: 'usr-1', gestorId: '', competencia: '2026-08', date: '2026-08-28T12:00:00Z', canal: 'WhatsApp',
  categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'AT-S1', protocolo: 'MON-2026-0001', numeroTitulo: 'TIT-S1', inicioAtendimento: '2026-08-28T10:00', fimAtendimento: '2026-08-28T10:20',
  tipo: 'Regular', evidencias: [], links: [], evidenciaObservacoes: '', strengths: 'x', opportunities: 'y', comments: '', contexto: 'c', leituraTecnica: 'l', errosIdentificados: '', conclusao: 'k',
  status: 'Pendente', duracaoMinutos: 20, finalScore: nota, scores: respostasMax(criteriosAtuais, 'WhatsApp', true), eliminatoryPending: false, zerada: false });
const mon10002 = { id: 'MON-10002', colaboradorId: '', monitorId: 'usr-1', competencia: '2026-09', date: '2026-10-06T12:00:00Z', canal: '', protocolo: 'MON-2026-0002', status: 'Rascunho',
  finalScore: 0, scores: criteriosAtuais.slice(0, 28).map((c) => ({ criterionId: c.id, score: '', lowScoreReason: '', subRespostas: null })), evidencias: [], links: [], eliminatoryPending: false, zerada: false };
// casos de borda (sintéticos, dos testes 04): validada e zerada, rascunho devolvido no portal antigo, retroativa, legada
const extrasMon = [
  { id: 'MON-10006', protocolo: 'MON-2026-0006', competencia: '2026-08', date: '2026-08-28T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'usr-4', canal: 'Telefone', tipo: 'Regular', status: 'Validada',
    finalScore: 0, zerada: true, eliminatoryPending: false, eliminatoryConfirmedBy: 'usr-1788800361784', eliminatoryConfirmedAt: '2026-09-02T13:14:15.000Z',
    scores: [{ criterionId: 'crit-26', score: 0, lowScoreReason: 'Ironia (sintético).', subRespostas: null }] },
  { id: 'MON-10004', protocolo: 'MON-2026-0004', competencia: '2026-09', date: '2026-09-10T12:00:00Z', monitorId: '', colaboradorId: 'usr-4', canal: 'Telefone', tipo: 'Direcionada', status: 'Rascunho',
    finalScore: 61.5, adjustmentReason: 'Refazer a justificativa do 7.', reviewedBy: 'usr-1788800361784', reviewedAt: '2026-09-11T09:00:00.000Z', eliminatoryPending: false, zerada: false, evidencias: [], links: [],
    scores: [{ criterionId: 'crit-26', score: 0, lowScoreReason: '', subRespostas: null }, { criterionId: 'crit-27', score: '', lowScoreReason: '', subRespostas: null }] },
  { id: 'MON-10003', protocolo: 'MON-2026-0003', competencia: '2026-01', date: '2026-01-15T12:00:00Z', monitorId: 'usr-1', colaboradorId: 'usr-5', canal: 'E-mail', tipo: 'Regular', status: 'Validada',
    finalScore: 78.57142857142857, lancamentoRetroativo: { por: 'usr-1', em: '2026-10-01T18:30:00.456Z' }, eliminatoryPending: false, zerada: false,
    evidencias: [{ id: 'evd-7', name: 'print1.png', type: 'image/png', size: '0.12 MB', date: '25/08/2026' }, { id: 'evd-7', name: 'print2.png', type: 'image/png', size: '0.30 MB', date: '25/08/2026' }],
    links: ['https://crm.exemplo.test/atendimento/1'], scores: [{ criterionId: 'crit-06', score: 2, lowScoreReason: '', subRespostas: null }] },
  { id: 'mon-2', protocolo: '12345', date: '2026-07-10', monitorId: 'usr-1', colaboradorId: 'usr-9-inexistente', canal: 'Telefone', tipo: 'Processo', status: 'Concluída', finalScore: 85, empreendimento: 'Residencial X', tempo: '00:05', campoAntigo: { nota10: 8.5 },
    scores: [{ criterionId: 'crit-antigo-9', score: 2, lowScoreReason: '' }, { criterionId: 'crit-06', score: null, lowScoreReason: '', subRespostas: null }, { criterionId: 'crit-07', lowScoreReason: 'sem nota' }] },
];
const logs = Array.from({ length: 12 }, (_, i) => ({ id: String(1788000000000 + (i % 10)), eventType: ['LOGIN', 'LOGOUT', 'SWITCH_PROFILE', 'CREATE_USER'][i % 4], userEmail: i % 3 ? 'monitora1@exemplo.test' : 'N/A',
  userName: 'Pessoa monitora1', userRole: 'MONITOR', actionDetails: i === 3 ? 'Criou gestora@exemplo.test' : '', timestamp: `2026-09-${String(10 + i).padStart(2, '0')}T12:00:00.000Z` }));
const montarExportacao = (nota1, mexer = (d) => d) => {
  const dados = mexer({
    pm2_settings: { requireGestorValidation: true, defasagemCompetencia: 1 },
    pm2_cgoals: [{ id: 'cgoal-1', monitorId: 'usr-1', colaboradorId: 'usr-4', year: 2026, month: 8, targetQty: 4 }, { titulo: 'item sem id' }],
    pm2_catalog_categorias_version: 1, pm2_mgoals: [], pm2_holidays: [], pm2_catalog_categorias: cat.categorias, pm2_criteria: criteriosAtuais,
    pm2_auth_session: { email: 'monitora1@exemplo.test', perfilAtivo: 'MONITOR' }, pm2_demands: [], pm2_agenda: [], pm2_criteria_version: 4, pm2_alloc_history: [],
    pm2_auth_logs: logs, pm2_collaborators: colaboradores, pm2_users_perfis_version: 1, pm2_monitorings_competencia_version: 1,
    pm2_criteria_sub24_backup: { em: '2026-10-07T13:08:45.617Z', criterio: c24antigo }, pm2_criteria_sub24_version: 1, pm2_announcements: [], pm2_database_version: 11,
    pm2_areas: [{ id: 'area-1', name: 'Relacionamento', gestorId: '', monitorIds: [], active: true }], pm2_allocations: [], pm2_users: usuarios, pm2_brand: cat.brand,
    pm2_planos_metas: [{ id: 'plano-1', nome: 'Plano sintético', vigenciaInicio: '2026-08', vigenciaFim: '2026-12', criadoPor: 'usr-1788800361784', criadoEm: '2026-08-01T10:00:00.000Z', linhas: [{ monitorId: 'usr-1', colaboradorId: 'usr-4', targetQty: 4 }] }],
    pm2_monitorings: [mon10002, mon10001(nota1), ...extrasMon],
  });
  return JSON.stringify({ meta: { exportadoEm: '2026-10-13T12:00:00.000Z', origem: 'https://portal-sintetico.exemplo.test', versaoBanco: '11', chaves: Object.keys(dados).length },
    dados: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, JSON.stringify(v)])) });
};
const evidencia0810 = JSON.stringify({ meta: { exportadoEm: '2026-10-08T15:16:53.698Z' }, dados: { pm2_criteria: JSON.stringify(evidencia) } });
const decisoes = {
  responsavel_admin_id: 'adm-1',
  perfis: { 'usr-1': { perfis: ['MONITOR'], email: 'monitora1.corporativa@exemplo.test', decisao: 'Contas separadas (12/10) e e-mail corporativo (13/10): Aline operacional só MONITOR' },
            'usr-7': { perfis: [], status: 'INACTIVE', decisao: 'usr-7 genérico: inativo, sem perfis (12/10)' } },
  novos_perfis: [{ apelido: 'erivan', email: 'supervisor@exemplo.test', nome: 'Supervisor Sintético', perfis: ['GESTOR'], decisao: 'Decisão 2 (12/10): Erivan GESTOR, cadastro novo' }],
  areas: { 'area-1': { gestor: '@erivan', monitores: ['usr-1'], decisao: 'Decisão 7 (12/10): Aline MONITOR e Erivan GESTOR do Relacionamento' } },
  regua1: { vigente_desde: '2026-08-31', descricao: 'Régua 1 oficial (sintético)', anterior: 'v0.24.0', datas: {"validacao_documento":{"data":"2026-08-25","situacao":"comprovada","fonte":"docs/METODOLOGIA-MONITORIA.md § 3A.0 (32 itens revisados, 32 aprovados)"},"commit_codigo":{"data":"2026-08-31T16:52:48-03:00","situacao":"comprovada","fonte":"commit 37b345a em main (data de autor = data de commit)"},"publicacao_producao":{"situacao":"nao_comprovada","janela_inicio":"2026-08-31T16:52:48-03:00","janela_fim":"2026-09-01T16:54:00-03:00","fonte":"deployment Vercel iwb8bzvq0 (Production, main, 37b345a) excluído pela retenção de 30 dias, sem data; limite superior = registro da 0.19.0 publicada (d8b4774)","limitacao":"GitHub privado sem acesso de leitura autenticado no ambiente; histórico de push local começa em 07/09"}} },
  regua2: { vigente_desde: '2026-10-12', descricao: 'Régua 2.0 (sintético)', diferencas_aprovadas: [] },
};
const gerarCom = (exp, dec = decisoes, extra = {}) => gerar({ exportacaoBruta: exp, decisoes: dec, regua1: R1, regua1Anterior: R024, reguaCodigo: RHEAD, evidencia0810Bruta: evidencia0810, agora: 1789000000000, ...extra });
const recusa = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// =============================================================================
const db = await novoBanco();
let e = await erro(() => db.exec(sql('09a_migracao_estrutura.sql')));
ok('09.1', '09a roda e roda de novo sem erro; versões 00 a 09a e 10', !e && (await um(db, "select string_agg(versao, ',' order by versao) v from app.versoes_esquema")).v === '00,01,02,03,04,05,06,06.1,07,08,09a,10', e?.message);
const nota1 = Number((await um(db, "select app.calcular_nota($1::jsonb, 'WhatsApp', $2::jsonb)::text n", [JSON.stringify(evidencia), JSON.stringify(respostasMax(criteriosAtuais, 'WhatsApp', true))])).n);
const nota1r1 = Number((await um(db, "select app.calcular_nota($1::jsonb, 'WhatsApp', $2::jsonb)::text n", [JSON.stringify(R1.criterios), JSON.stringify(respostasMax(criteriosAtuais, 'WhatsApp', true))])).n);
const EXP = montarExportacao(nota1);

// ---- gerador ----
const G = gerarCom(EXP);
ok('09.2', `gerador: reconstrução SEM PERDA de todas as chaves migradas (${Object.keys(G.manifesto.reconstrucao).length}), a partir só das linhas que vão ao banco`,
   Object.values(G.manifesto.reconstrucao).every((v) => v.startsWith('idêntico')) && Object.keys(G.manifesto.reconstrucao).length >= 15, JSON.stringify(G.manifesto.reconstrucao));
ok('09.3', 'gerador: nenhuma das 7 senhas sintéticas aparece no SQL nem no manifesto; nenhum campo password/confirmPassword; sessão (pm2_auth_session) fora',
   SENHAS.every((s) => !G.sql.includes(s) && !JSON.stringify(G.manifesto).includes(s)) && !/"(password|confirmPassword)"s*:/.test(G.sql) && !G.sql.includes('perfilAtivo')
   && G.manifesto.removidos.chaves_descartadas.join() === 'pm2_auth_session' && canonico(G.manifesto.removidos.campos_senha) === canonico([{ campo: 'password', ocorrencias: 7 }, { campo: 'confirmPassword', ocorrencias: 1 }]),
   JSON.stringify(G.manifesto.removidos));
const resumo = Object.fromEntries(G.manifesto.monitorias.map((m) => [m.id, m]));
ok('09.4', 'E3/E4b/E3m no gerador: MON-10001 (Pendente) enviada; MON-10002 (rascunho nunca submetido) NÃO; MON-10004 (rascunho com revisão no portal antigo) enviada; nota histórica só nas enviadas com nota',
   resumo['MON-10001'].enviada_na_origem === true && resumo['MON-10001'].nota_historica === nota1 && resumo['MON-10002'].enviada_na_origem === false && resumo['MON-10002'].nota_historica === null
   && resumo['MON-10004'].enviada_na_origem === true && /traços de revisão/.test(resumo['MON-10004'].motivo), JSON.stringify(G.manifesto.monitorias));
ok('09.5', `Erivan: id NOVO (${G.manifesto.novos_perfis.erivan}), no padrão do portal, sem reutilizar nenhum id existente`, /^usr-\d{13}$/.test(G.manifesto.novos_perfis.erivan) && !usuarios.some((u) => u.id === G.manifesto.novos_perfis.erivan));

// ---- recusas do gerador (nada é gerado) ----
const R = {
  dupId: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_monitorings: [...d.pm2_monitorings, { ...mon10002, protocolo: 'MON-2026-9999' }] })))),
  dupProt: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_monitorings: [...d.pm2_monitorings, { ...mon10002, id: 'MON-19999' }] })))),
  dupEmail: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_users: [...d.pm2_users, pessoa('usr-99', 'pessoa3', [], 'xxxxxx')] })))),
  chave: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_chave_nova: [] })))),
  senhaObs: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_users: d.pm2_users.map((u) => (u.id === 'usr-3' ? { ...u, observacoes: `senha antiga ${SENHAS[0]}` } : u)) })))),
  campoToken: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_brand: { ...d.pm2_brand, token: 'abc' } })))),
  difRegua: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_criteria: d.pm2_criteria.map((c) => (c.id === 'crit-12' ? { ...c, weight: 3 } : c)) })))),
  semData1: recusa(() => gerarCom(EXP, { ...decisoes, regua1: {} })),
  semDatas: recusa(() => gerarCom(EXP, { ...decisoes, regua1: { ...decisoes.regua1, datas: undefined } })),
  anteriorAdult: recusa(() => gerarCom(EXP, decisoes, { regua1Anterior: { ...R024, criterios: R024.criterios.slice(1) } })),
  semAdmin: recusa(() => gerarCom(EXP, { ...decisoes, responsavel_admin_id: '' })),
  decInex: recusa(() => gerarCom(EXP, { ...decisoes, perfis: { ...decisoes.perfis, 'usr-404': { perfis: [] } } })),
  adminSobra: recusa(() => gerarCom(EXP, { ...decisoes, perfis: { 'usr-7': decisoes.perfis['usr-7'] } })),
  emailInvalido: recusa(() => gerarCom(EXP, { ...decisoes, perfis: { ...decisoes.perfis, 'usr-1': { ...decisoes.perfis['usr-1'], email: 'sem-arroba' } } })),
  emailIgual: recusa(() => gerarCom(EXP, { ...decisoes, perfis: { ...decisoes.perfis, 'usr-1': { ...decisoes.perfis['usr-1'], email: 'MONITORA1@exemplo.test' } } })),
  emailDeOutro: recusa(() => gerarCom(EXP, { ...decisoes, perfis: { ...decisoes.perfis, 'usr-1': { ...decisoes.perfis['usr-1'], email: 'pessoa3@exemplo.test' } } })),
  novoComEmailAntigo: recusa(() => gerarCom(EXP, { ...decisoes, novos_perfis: [{ ...decisoes.novos_perfis[0], email: 'monitora1@exemplo.test' }] })),
  idReuso: recusa(() => gerarCom(EXP, { ...decisoes, novos_perfis: [{ ...decisoes.novos_perfis[0], id: 'usr-4' }] })),
  emailReuso: recusa(() => gerarCom(EXP, { ...decisoes, novos_perfis: [{ ...decisoes.novos_perfis[0], email: 'pessoa3@exemplo.test' }] })),
  r1Adulterada: recusa(() => gerar({ exportacaoBruta: EXP, decisoes, regua1: { ...R1, criterios: R1.criterios.slice(1) }, reguaCodigo: RHEAD })),
  status: recusa(() => gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_monitorings: [...d.pm2_monitorings, { ...mon10002, id: 'MON-1', protocolo: 'P-1', status: 'Em análise' }] })))),
};
const falta = Object.entries(R).filter(([, v]) => !v).map(([k]) => k);
ok('09.6', `gerador RECUSA (sem gerar nada) ${Object.keys(R).length} situações: id e protocolo de monitoria repetidos, e-mail repetido, chave desconhecida, senha copiada em outro campo, campo "token", régua 2.0 diferente do código sem aprovação, vigência da Régua 1 não decidida, sem ADMIN responsável, decisão para perfil inexistente, ADMIN que sobraria na migração, id e e-mail reutilizados no perfil novo, Régua 1 adulterada, situação desconhecida`,
   falta.length === 0, JSON.stringify(falta));
ok('09.7', 'a recusa de senha copiada em outro campo NÃO repete o valor da senha na mensagem', R.senhaObs && !R.senhaObs.includes(SENHAS[0]), R.senhaObs);

// ---- 09b aplicado ----
const audAntes = (await um(db, 'select count(*)::int n from public.auditoria')).n;
e = await erro(() => db.exec(G.sql));
ok('09.8', '09b aplicado em UMA transação, com todas as conferências internas aprovadas', !e, e?.message);
const lote = await um(db, 'select * from app.migracao_lotes');
ok('09.9', 'lote registrado: responsável = conta ADMIN pessoal (adm-1), conteúdo sem senha identificado por SHA-256', lote?.responsavel === 'adm-1' && lote.id === G.manifesto.lote && lote.conteudo_sha256 === G.manifesto.conteudo_sha256, JSON.stringify(lote && { id: lote.id, r: lote.responsavel }));
const cont = Object.fromEntries((await db.query(`select 'perfis' t, count(*)::int n from public.perfis where not ('ADMIN' = any(perfis)) union all select 'monitorias', count(*) from public.monitorias
   union all select 'monitoria_respostas', count(*) from public.monitoria_respostas union all select 'criterios', count(*) from public.criterios union all select 'acessos_log', count(*) from public.acessos_log
   union all select 'documentos', count(*) from public.documentos union all select 'catalogos', count(*) from public.catalogos`)).rows.map((r) => [r.t, r.n]));
ok('09.10', 'contagens no banco = manifesto (perfis, monitorias, respostas, critérios, acessos, documentos, catálogos)',
   Object.entries(cont).every(([k, n]) => G.manifesto.contagens[k] === n), JSON.stringify({ banco: cont, manifesto: G.manifesto.contagens }));

// decisões aplicadas × preservado literalmente
const P = Object.fromEntries((await db.query("select id, perfis, status, extras from public.perfis")).rows.map((r) => [r.id, r]));
const eri = G.manifesto.novos_perfis.erivan;
ok('09.11', 'decisões nos perfis: usr-1 só MONITOR (original ADMIN+MONITOR guardado); usr-7 INATIVO e sem perfis (originais guardados); gestora sintética preservada como GESTOR ativa; Erivan GESTOR ativo, marcado como criado na migração',
   canonico(P['usr-1'].perfis) === '["MONITOR"]' && canonico(P['usr-1'].extras._perfis_original) === '["ADMIN","MONITOR"]'
   && P['usr-7'].status === 'INACTIVE' && P['usr-7'].perfis.length === 0 && canonico(P['usr-7'].extras._perfis_original) === '["ADMIN"]' && P['usr-7'].extras._status_original === 'ACTIVE'
   && canonico(P['usr-1788800361784'].perfis) === '["GESTOR"]' && P['usr-1788800361784'].status === 'ACTIVE'
   && canonico(P[eri].perfis) === '["GESTOR"]' && !!P[eri].extras._criado_na_migracao, JSON.stringify({ u1: P['usr-1'], u7: P['usr-7'] }));
const A1 = await um(db, "select a.gestor_id, a.extras, (select string_agg(monitor_id, ',') from public.area_monitores where area_id = 'area-1') m from public.areas a where id = 'area-1'");
{ const p1 = await um(db, "select email, extras ->> '_email_original' orig from public.perfis where id = 'usr-1'");
  const oe = await um(db, "select antes #>> '{}' antes, depois #>> '{}' depois from app.migracao_ocorrencias where classe = 'TRANSFORMADO_POR_DECISAO' and chave = 'usr-1' and campo = 'email'");
  const hist = await um(db, `select (select email from public.colaboradores where id = 'usr-1') colab,
      (select count(*)::int from public.acessos_log where usuario_email = 'monitora1@exemplo.test') acessos_antigos,
      (select count(*)::int from public.acessos_log where usuario_email = 'monitora1.corporativa@exemplo.test') acessos_novos,
      (select count(*)::int from public.monitorias where monitor_id = 'usr-1') monitorias`);
  ok('09.11b', 'usr-1 passa a usar o e-mail corporativo por decisão documentada: e-mail antigo guardado em extras e registrado como ocorrência (antes → depois)',
     p1.email === 'monitora1.corporativa@exemplo.test' && p1.orig === 'monitora1@exemplo.test' && oe?.antes === 'monitora1@exemplo.test' && oe?.depois === 'monitora1.corporativa@exemplo.test', JSON.stringify({ p1, oe }));
  ok('09.11c', `histórico intacto: o cadastro de colaboradora e o histórico de acessos continuam com o e-mail antigo, e as ${hist.monitorias} monitorias seguem no usr-1`,
     hist.colab === 'usr-1@exemplo.test' && hist.acessos_antigos > 0 && hist.acessos_novos === 0 && hist.monitorias > 0, JSON.stringify(hist)); }
ok('09.12', 'Relacionamento: Erivan supervisor e Aline (usr-1) monitora; vínculos originais (supervisor "" e lista vazia) preservados para auditoria',
   A1.gestor_id === eri && A1.m === 'usr-1' && A1.extras._gestorId_original === '' && canonico(A1.extras._monitorIds_original) === '[]', JSON.stringify(A1));
const M = Object.fromEntries((await db.query("select id, status, nota::float8 nota, nota_historica::float8 h, nota_calculada, regua_versao_id, origem, enviada_na_origem e from public.monitorias")).rows.map((r) => [r.id, r]));
ok('09.13', `MON-10001: Pendente, nota ORIGINAL ${nota1} intacta, nota_historica ${nota1} já na migração, sem versão de régua e sem nota calculada (E4b); nada recalculado`,
   M['MON-10001'].status === 'Pendente' && M['MON-10001'].nota === nota1 && M['MON-10001'].h === nota1 && M['MON-10001'].regua_versao_id === null && M['MON-10001'].nota_calculada === null
   && M['MON-10001'].origem === 'migracao' && M['MON-10001'].e === true, JSON.stringify(M['MON-10001']));
ok('09.14', 'MON-10002: Rascunho, enviada_na_origem = false (E3m), sem nota histórica', M['MON-10002'].status === 'Rascunho' && M['MON-10002'].e === false && M['MON-10002'].h === null, JSON.stringify(M['MON-10002']));
const r24 = await um(db, "select sub_respostas from public.monitoria_respostas where monitoria_id = 'MON-10001' and criterio_id = 'crit-24'");
ok('09.15', 'respostas da MON-10001 preservadas como estão, inclusive a sub-resposta obsoleta sub-24-3', r24?.sub_respostas?.['sub-24-3'] === 'SIM' && (await um(db, "select count(*)::int n from public.monitoria_respostas where monitoria_id = 'MON-10001'")).n === mon10001(0).scores.length);
const O = (await db.query("select classe, entidade, chave, campo, antes, depois, detalhe from app.migracao_ocorrencias order by seq")).rows;
const div = O.find((o) => o.classe === 'DIVERGENCIA_REGISTRADA' && o.chave === 'MON-10001' && o.campo === 'nota');
ok('09.16', `divergência DOCUMENTADA sem correção: MON-10001 original ${nota1} × Régua 1 ${nota1r1} × cadastro de 08/10 ${nota1}`,
   div && Number(div.antes) === nota1 && Number(div.depois.regua_1) === nota1r1 && Number(div.depois.cadastro_0810) === nota1, JSON.stringify(div));
ok('09.17', 'sub-24-3 registrada como divergência (não existe na Régua 1; o portal a retira no reenvio)', O.some((o) => o.classe === 'DIVERGENCIA_REGISTRADA' && o.chave === 'MON-10001/crit-24' && o.campo === 'subRespostas.sub-24-3'));
const porClasse = O.reduce((a, o) => ({ ...a, [o.classe]: (a[o.classe] || 0) + 1 }), {});
ok('09.18', `ocorrências separadas por classe: ${JSON.stringify(porClasse)}`,
   porClasse.REMOVIDO_SENSIVEL === 3 && porClasse.CRIADO_POR_DECISAO === 1 && porClasse.TRANSFORMADO_POR_DECISAO >= 6 && porClasse.EVIDENCIA === 10 && porClasse.DIVERGENCIA_REGISTRADA >= 2);

// réguas
const RV = Object.fromEntries((await db.query("select id, vigente_desde::text v, extras, app.digital_json(retrato) d from public.regua_versoes")).rows.map((r) => [r.id, r]));
const dR1 = (await um(db, 'select app.digital_json($1::jsonb) d', [JSON.stringify(R1.criterios)])).d;
const dAtual = (await um(db, 'select app.digital_json(app.retrato_regua_atual()) d')).d;
ok('09.19', `Régua 1 = semente do código em ${R1.revisao} (commit ${R1.commit.slice(0, 7)}), vigência 2026-08-31 (decisão), origem gravada; Régua 2.0 = critérios atuais migrados, vigência 12/10/2026`,
   RV['regua-1'].d === dR1 && RV['regua-1'].v === '2026-08-31' && RV['regua-1'].extras.commit === R1.commit && RV['regua-2.0'].d === dAtual && RV['regua-2.0'].v === '2026-10-12', JSON.stringify({ r1: RV['regua-1'].v, r2: RV['regua-2.0'].v }));
{ const x = RV['regua-1'].extras;
  ok('09.19b', 'Régua 1 registra as três datas separando o comprovado (validação 25/08, commit 31/08 16:52) do NÃO comprovado (publicação em produção, janela até 01/09 16:54, deployment iwb8bzvq0)',
     x.datas.commit_codigo.situacao === 'comprovada' && x.datas.validacao_documento.data === '2026-08-25' && x.datas.publicacao_producao.situacao === 'nao_comprovada' && /iwb8bzvq0/.test(x.datas.publicacao_producao.fonte), JSON.stringify(x.datas)); }
{ const ev = await um(db, "select texto::jsonb ->> 'revisao' rev, texto::jsonb ->> 'commit' c, jsonb_array_length(texto::jsonb -> 'criterios') n, (select jsonb_agg(sp ->> 'id') from jsonb_array_elements(texto::jsonb -> 'criterios') cc, jsonb_array_elements(cc -> 'subPerguntas') sp where cc ->> 'id' = 'crit-24') subs from app.migracao_origem where chave = 'evidencia:regua-1-anterior'");
  const alt = O.filter((o) => o.classe === 'EVIDENCIA' && o.entidade === 'regua-1');
  ok('09.19c', `retrato ANTERIOR da Régua 1 (${R024.revisao}, crit-24 com sub-24-3) preservado como evidência, sem virar versão; a alteração de 07/10 documentada campo a campo (${alt.map((o) => o.chave + '.' + o.campo).join(', ')})`,
     ev?.rev === 'v0.24.0' && ev.n === 29 && JSON.stringify(ev.subs) === '["sub-24-1","sub-24-2","sub-24-3"]' && alt.length === 1 && alt[0].chave === 'crit-24' && alt[0].campo === 'subPerguntas'
     && !Object.keys(RV).some((k) => !['regua-1', 'regua-2.0'].includes(k)), JSON.stringify({ ev, alt: alt.length })); }
ok('09.20', 'régua vigente hoje = Régua 2.0', (await um(db, 'select app.regua_vigente() v')).v === 'regua-2.0');

// auditoria
const aud = await um(db, `select count(*)::int n, count(*) filter (where responsavel_declarado = 'adm-1')::int decl, count(distinct transacao)::int tx
                           from public.auditoria where seq > ${audAntes}`);
const QUEBRAS = 'select count(*)::int n from (select a.hash <> app.auditoria_hash(a) or a.hash_anterior is distinct from lag(a.hash) over (order by a.seq) quebra from public.auditoria a) x where quebra';
const totalLinhas = Object.values(G.manifesto.contagens).reduce((a, b) => a + b, 0) + 2 /* réguas */ + 1 /* lote */ + G.manifesto.chaves_origem.length + O.length;
ok('09.21', `auditoria: as ${totalLinhas} inclusões da migração (dados, réguas, lote, origem, ocorrências) registradas na MESMA transação, todas declaradas pelo ADMIN adm-1; cadeia íntegra`,
   aud.n === totalLinhas && aud.decl === aud.n && aud.tx === 1 && (await um(db, QUEBRAS)).n === 0, JSON.stringify({ aud, totalLinhas }));

// nada sensível em lugar nenhum do banco
const tudo = (await um(db, `select string_agg(x, ' ') t from (
   select texto x from app.migracao_origem union all select extras::text from public.perfis union all select coalesce(depois::text, '') from public.auditoria
   union all select manifesto::text from app.migracao_lotes union all select conteudo::text from public.documentos union all select extras::text from public.acessos_log) z`)).t;
ok('09.22', 'nenhuma senha sintética, nenhum campo password/confirmPassword e nenhuma sessão em origem, perfis, auditoria, lote, documentos ou acessos', SENHAS.every((s) => !tudo.includes(s)) && !/"(password|confirmPassword)"s*:/.test(tudo) && !tudo.includes('perfilAtivo'));
const red = await um(db, "select redacoes from app.migracao_origem where chave = 'pm2_users'");
ok('09.23', 'pm2_users na origem registra a retirada (campo e quantidade), nunca o valor', canonico(red.redacoes) === canonico([{ campo: 'password', ocorrencias: 7 }, { campo: 'confirmPassword', ocorrencias: 1 }]), JSON.stringify(red));

// duplicidade: rodar de novo, ou outra exportação
const fotoTab = async () => (await um(db, "select (select count(*) from public.monitorias)::int || '/' || (select count(*) from public.perfis)::int || '/' || (select count(*) from app.migracao_ocorrencias)::int || '/' || (select count(*) from public.auditoria)::int s")).s;
const f0 = await fotoTab();
const e2 = await erro(() => db.exec(G.sql)); await db.exec('rollback').catch(() => {});
const G2 = gerarCom(montarExportacao(nota1, (d) => ({ ...d, pm2_agenda: [{ id: 'ag-novo', titulo: 'outra exportação' }] })));
const e3 = await erro(() => db.exec(G2.sql)); await db.exec('rollback').catch(() => {});
ok('09.24', 'aplicar o 09b de novo é RECUSADO (MI409), e outra exportação também; nada muda', e2?.code === 'MI409' && e3?.code === 'MI409' && (await fotoTab()) === f0, JSON.stringify([e2?.message, e3?.message]));

// portal não enxerga a migração
const negado = [];
for (const quem of ["set local role authenticated; set local request.jwt.claims = '{\"sub\":\"" + U(1) + "\",\"role\":\"authenticated\",\"aal\":\"aal2\"}';", 'set local role anon;'])
  for (const tb of ['migracao_lotes', 'migracao_origem', 'migracao_ocorrencias']) { await db.exec('begin; ' + quem); const x = await erro(() => db.query(`select * from app.${tb}`)); await db.exec('rollback'); if (!/permission denied/.test(x?.message || '')) negado.push(tb); }
ok('09.25', 'portal (logado ou anônimo) não lê lote, origem nem ocorrências', negado.length === 0, negado.join());
const alt = await erro(() => db.exec("update app.migracao_ocorrencias set detalhe = 'x'"));
const exc = await erro(() => db.exec('delete from app.migracao_origem'));
ok('09.26', 'proveniência é só inclusão: nem o administrador do banco altera ou apaga sem manutenção (MI403)', alt?.code === 'MI403' && exc?.code === 'MI403', JSON.stringify([alt?.message, exc?.message]));

// segurança do 08 intacta
const conf08 = (await db.query(readFileSync(join(pastaReguas, '..', 'conferencia-08.sql'), 'utf8'))).rows;
const itensSeg = [2, 3, 4, 5, 6, 7, 9, 14, 15, 16, 21, 22, 23, 24, 25, 26, 28];
const falhasSeg = conf08.filter((r) => itensSeg.includes(r.item) && r.resultado !== r.esperado).map((r) => `${r.item}:${r.resultado}`);
ok('09.27', `depois da migração, os ${itensSeg.length} itens de segurança da conferência do 08 continuam como esperado`, falhasSeg.length === 0, falhasSeg.join(' | '));

// ---- compatibilidade com o 08: o caminho real depois da migração ----
// primeiro login: auth.users recebe o usuário e o 01 liga o perfil pelo e-mail
// (o PGlite não restaura a sessão depois de set session authorization; o vínculo do serviço de login
//  já é provado em testes-r5 U3 — aqui o primeiro login é gravado com responsável declarado)
await db.exec(`begin; set local app.responsavel = 'adm-1'; insert into auth.users values ('${U(1)}', 'monitora1.corporativa@exemplo.test', now()), ('${U(2)}', 'supervisor@exemplo.test', now()), ('${U(5)}', 'monitora1@exemplo.test', now()); commit;`);
{ const lig = (await db.query("select id, auth_user_id::text a from public.perfis where auth_user_id is not null and id <> 'adm-1' order by id")).rows;
  ok('09.27b', 'primeiro login pelo e-mail CORPORATIVO liga o usr-1; um login com o e-mail antigo não liga perfil nenhum (não vira segunda identidade)',
     lig.some((r) => r.id === 'usr-1' && r.a === U(1)) && !lig.some((r) => r.a === U(5)), JSON.stringify(lig)); }
const ALINE = `set local role authenticated; set local request.jwt.claims = '{"sub":"${U(1)}","role":"authenticated"}';`;
const ERIVAN = `set local role authenticated; set local request.jwt.claims = '{"sub":"${U(2)}","role":"authenticated"}';`;
const chamar = async (quem, q, p = []) => { await db.exec('begin; ' + quem); try { const r = await db.query(q, p); await db.exec('commit'); return { ok: r.rows[0] ? Object.values(r.rows[0])[0] : null, rows: r.rows }; } catch (x) { await db.exec('rollback'); return { erro: x }; } };
const vers = async (id) => (await um(db, 'select versao from public.monitorias where id = $1', [id])).versao;
const fila = await chamar(ERIVAN, 'select id from api.fila_validacao()');
ok('09.28', 'Erivan vê na fila a MON-10001 (agosto) — e a MON-10004 devolvida no portal antigo não aparece (é rascunho)', fila.rows?.some((r) => r.id === 'MON-10001') && !fila.rows?.some((r) => r.id === 'MON-10004'), JSON.stringify(fila.rows || fila.erro?.message));
const val0 = await chamar(ERIVAN, 'select api.validar_monitoria($1, $2)', ['MON-10001', await vers('MON-10001')]);
ok('09.29', 'antes da devolução, o Gestor NÃO valida a MON-10001 (M1 do 08)', val0.erro?.code === 'MI403', val0.erro?.message);
const dev = await chamar(ERIVAN, 'select api.devolver_monitoria($1, $2, $3)', ['MON-10001', await vers('MON-10001'), 'Revisar pela Régua 1 oficial (peso do critério 6).']);
const limpas = mon10001(0).scores.map((s) => (s.criterionId === 'crit-24' ? { ...s, subRespostas: Object.fromEntries(Object.entries(s.subRespostas).filter(([k]) => k !== 'sub-24-3')) } : s));
const dadosReenvio = { ...mon10001(0), scores: limpas, colaboradorId: 'usr-4' }; delete dadosReenvio.finalScore;
const reenvio = await chamar(ALINE, 'select api.salvar_monitoria($1::jsonb, $2, true)', [JSON.stringify(dadosReenvio), await vers('MON-10001')]);
const m1 = await um(db, "select status, regua_versao_id, nota::float8 n, nota_historica::float8 h from public.monitorias where id = 'MON-10001'");
ok('09.30', `devolução formal → Aline revisa e reenvia → Régua 1, nota ${nota1r1} calculada pelo banco, nota histórica ${nota1} mantida (E4b)`,
   !dev.erro && !reenvio.erro && m1.status === 'Pendente' && m1.regua_versao_id === 'regua-1' && m1.n === nota1r1 && m1.h === nota1, JSON.stringify({ d: dev.erro?.message, r: reenvio.erro?.message, m1 }));
const val1 = await chamar(ERIVAN, 'select api.validar_monitoria($1, $2)', ['MON-10001', await vers('MON-10001')]);
ok('09.31', 'Erivan valida a MON-10001 corrigida', val1.ok?.status === 'Validada', val1.erro?.message);
const r2crit = (await um(db, "select retrato from public.regua_versoes where id = 'regua-2.0'")).retrato;
const dados2 = { id: 'MON-10002', colaboradorId: 'usr-5', categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'AT-S2', numeroTitulo: 'TIT-S2', canal: 'Telefone', date: '2026-10-06T12:00:00Z',
  competencia: '2026-09', inicioAtendimento: '2026-10-06T09:00', fimAtendimento: '2026-10-06T09:10', tipo: 'Regular',
  scores: respostasMax(r2crit, 'Telefone', false).map((s) => (s.criterionId === 'crit-06' ? { ...s, score: 2, lowScoreReason: '' } : s)) };
const env2 = await chamar(ALINE, 'select api.salvar_monitoria($1::jsonb, $2, true)', [JSON.stringify(dados2), await vers('MON-10002')]);
const m2 = await um(db, "select status, regua_versao_id, nota_historica from public.monitorias where id = 'MON-10002'");
ok('09.32', 'MON-10002: primeiro envio usa a Régua 2.0 (E3m), sem nota histórica', !env2.erro && m2.regua_versao_id === 'regua-2.0' && m2.nota_historica === null, env2.erro?.message || JSON.stringify(m2));
const rep = await chamar(ERIVAN, 'select api.reprovar_monitoria($1, $2, $3)', ['MON-10002', await vers('MON-10002'), '']);
ok('09.33', 'reprovação exige motivo também aqui (D5m)', rep.erro?.code === 'MI422', rep.erro?.message);
ok('09.34', 'cadeia da auditoria íntegra depois de migração + devolução + reenvios + validação', (await um(db, QUEBRAS)).n === 0);

// ---- atomicidade em banco novo: qualquer falha = nada gravado ----
const vazio = async (d) => (await um(d, "select (select count(*) from public.monitorias) + (select count(*) from public.perfis where not ('ADMIN' = any(perfis))) + (select count(*) from app.migracao_lotes) + (select count(*) from public.regua_versoes) n")).n;
{ const d = await novoBanco();
  const adulterado = G.sql.replace('-- 6. Conferência dentro da transação', () => "update public.monitorias set nota = 1 where id = 'MON-10002';\n-- 6. Conferência dentro da transação");
  const x = await erro(() => d.exec(adulterado)); await d.exec('rollback').catch(() => {});
  ok('09.35', 'se um valor gravado diverge do esperado, a conferência interna interrompe e NADA fica gravado (nem lote, nem perfis, nem réguas)', x?.code === 'MI422' && Number(await vazio(d)) === 0, x?.message);
  const x2 = await erro(() => d.exec(G.sql.replace("set local app.responsavel = 'adm-1';", () => "set local app.responsavel = 'usr-qualquer';"))); await d.exec('rollback').catch(() => {});
  ok('09.36', 'responsável que não é ADMIN ativo: recusado antes de gravar (MI401)', x2?.code === 'MI401' && Number(await vazio(d)) === 0, x2?.message);
  const x3 = await erro(() => d.exec(G.sql.replace("set local app.responsavel = 'adm-1';", () => ''))); await d.exec('rollback').catch(() => {});
  ok('09.37', 'sem responsável declarado: recusado, nada gravado', !!x3 && Number(await vazio(d)) === 0, x3?.message);
  await d.exec("begin; set local app.responsavel = 'adm-1'; insert into public.perfis (id, email, nome, perfis, status) values ('usr-1', 'outra@exemplo.test', 'Conflito', '{GESTOR}', 'ACTIVE'); commit;");
  const x4 = await erro(() => d.exec(G.sql)); await d.exec('rollback').catch(() => {});
  ok('09.38', 'banco com perfil não-ADMIN já cadastrado: migração recusada (MI409), sem misturar', x4?.code === 'MI409', x4?.message);
  await d.close(); }
{ const d = await PGlite.create({ extensions: { pgcrypto } }); await d.exec(SETUP); for (const f of SCRIPTS.slice(0, -1)) await d.exec(sql(f));
  await d.exec(`begin; set local app.responsavel = 'Administração Sintética <adm@exemplo.test>'; insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Administração Sintética', '{ADMIN}', 'ACTIVE'); commit;`);
  const x = await erro(() => d.exec(G.sql)); await d.exec('rollback').catch(() => {});
  ok('09.39', 'sem o 09a aplicado, o 09b é recusado', !!x, x?.message); await d.close(); }

// ---- modo implantação: migração ANTES de existir qualquer ADMIN ----------------------------
{ const DECL = 'Pessoa Responsável Sintética <responsavel@exemplo.test>';
  const decImpl = { ...decisoes }; delete decImpl.responsavel_admin_id; decImpl.responsavel_implantacao = DECL;
  const rec = {
    ambos: recusa(() => gerarCom(EXP, { ...decImpl, responsavel_admin_id: 'adm-1' })),
    nenhum: recusa(() => { const d = { ...decImpl }; delete d.responsavel_implantacao; return gerarCom(EXP, d); }),
    semEmail: recusa(() => gerarCom(EXP, { ...decImpl, responsavel_implantacao: 'Só o nome sem e-mail' })),
    generico: recusa(() => gerarCom(EXP, { ...decImpl, responsavel_implantacao: '<relacionamento@exemplo.test>' })),
  };
  ok('09.40', 'gerador: exatamente UM responsável (ADMIN ou implantação); a declaração de implantação exige "Nome <e-mail>"', Object.values(rec).every(Boolean), JSON.stringify(rec));
  const GI = gerarCom(EXP, decImpl);
  // banco novo SEM nenhum ADMIN
  const d = await PGlite.create({ extensions: { pgcrypto } }); await d.exec(SETUP); for (const f2 of SCRIPTS) await d.exec(sql(f2));
  const x = await erro(() => d.exec(GI.sql)); await d.exec('rollback').catch(() => {});
  const r = (await d.query(`select (select responsavel from app.migracao_lotes) lote, (select count(*)::int from public.perfis where 'ADMIN' = any (perfis)) admins,
      (select count(*)::int from public.auditoria) aud, (select count(*) filter (where responsavel_declarado = $1)::int from public.auditoria) decl`, [DECL])).rows[0];
  ok('09.41', 'migração em banco SEM nenhum ADMIN, declarada por "Nome <e-mail>": aplicada; lote e TODA a auditoria com a declaração; nenhum ADMIN foi criado', !x && r.lote === DECL && r.admins === 0 && r.aud > 0 && r.decl === r.aud, x?.message || JSON.stringify(r));
  const x2 = await erro(() => d.exec(GI.sql)); await d.exec('rollback').catch(() => {});
  ok('09.42', 'aplicar de novo (ainda sem ADMIN) é recusado (MI409)', x2?.code === 'MI409', x2?.message);
  // o primeiro ADMIN, quando for definido, entra pelo procedimento do 06 — e a exceção se fecha
  const x3 = await erro(() => d.exec(`begin; set local app.responsavel = '${DECL}';
    insert into public.perfis (id, email, nome, perfis, status) values ('adm-futuro', 'adm.futuro@exemplo.test', 'Administração Futura', '{ADMIN}', 'ACTIVE'); commit;`)); await d.exec('rollback').catch(() => {});
  const x4 = await erro(() => d.exec(`begin; set local app.responsavel = '${DECL}'; update public.configuracoes set valor = valor || '{"x":1}'::jsonb where chave = 'settings'; commit;`)); await d.exec('rollback').catch(() => {});
  const x5 = await erro(() => d.exec(`begin; set local app.responsavel = 'adm-futuro'; update public.configuracoes set valor = valor || '{"x":1}'::jsonb where chave = 'settings'; commit;`)); await d.exec('rollback').catch(() => {});
  ok('09.43', 'depois: o primeiro ADMIN entra pelo procedimento do 06; a partir daí a declaração por nome é RECUSADA para sempre (MI401) e só o id do ADMIN vale', !x3 && x4?.code === 'MI401' && !x5, JSON.stringify([x3?.message, x4?.message, x5?.message]));
  const GA = gerarCom(EXP, decImpl); const d2 = await novoBanco(); // banco COM ADMIN
  const x6 = await erro(() => d2.exec(GA.sql)); await d2.exec('rollback').catch(() => {});
  ok('09.44', 'modo implantação num banco que JÁ tem ADMIN: recusado antes de gravar (MI401) — não dá para contornar o ADMIN declarando um nome', x6?.code === 'MI401' && (await d2.query('select count(*)::int n from app.migracao_lotes')).rows[0].n === 0, x6?.message);
  await d.close(); await d2.close(); }

function relatorio() { for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`); }
relatorio();
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length} testes · ${resultados.length - falhas.length} aprovados · ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
