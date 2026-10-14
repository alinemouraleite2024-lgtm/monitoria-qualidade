// Confere as DECISÕES REAIS (supabase/migracao/decisoes.json) num banco local, com uma exportação
// SINTÉTICA que tem os mesmos identificadores da real (usr-1, usr-7, area-1, a gestora existente).
// Nenhum dado real de atendimento é lido: a evidência de 08/10 não é usada aqui.
// Uso: node testes-decisoes-reais.mjs <projeto>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [projeto] = process.argv.slice(2);
const { gerar } = await import(pathToFileURL(join(projeto, 'supabase/migracao/gerar-09.mjs')).href);
const lerJ = (p) => JSON.parse(readFileSync(join(projeto, p), 'utf8'));
const dec = lerJ('supabase/migracao/decisoes.json');
const R1 = lerJ(dec.regua1.arquivo), R024 = lerJ(dec.regua1.anterior), RCOD = lerJ(dec.regua2.codigo);
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
const SETUP = t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`')));
const resultados = [];
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const relatorio = () => { for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message); process.exit(2); });
const U = (n) => `0000000${n}-0000-0000-0000-00000000000${n}`;

// exportação sintética com os ids reais (pessoas e textos fictícios)
const crit = R1.criterios;
const resp = (canal) => crit.filter((c) => c.active && c.channels.includes(canal)).map((c) => c.tipoResposta === 'MULTIPLA_ESCOLHA'
  ? { criterionId: c.id, score: c.id === 'crit-29' ? 'Não' : c.opcoes[0], lowScoreReason: '', subRespostas: null }
  : c.tipoResposta === 'CHECKLIST_SIM_NAO' ? { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: Object.fromEntries(c.subPerguntas.map((s) => [s.id, 'SIM'])) }
  : { criterionId: c.id, score: 2, lowScoreReason: '', subRespostas: null });
const pessoa = (id, email, perfis, extra = {}) => ({ id, email, name: `Pessoa ${id}`, password: `Sintetica-${id}`, status: 'ACTIVE', perfis, ...extra });
const dados = {
  pm2_users: [pessoa('usr-1', 'email.antigo.monitora@exemplo.test', ['ADMIN', 'MONITOR']), pessoa('usr-3', 'p3@exemplo.test', []), pessoa('usr-4', 'p4@exemplo.test', []),
    pessoa('usr-7', 'conta.generica@exemplo.test', ['ADMIN']), pessoa('usr-1788800361784', 'gestora@exemplo.test', ['GESTOR'], { confirmPassword: 'Sintetica-g' })],
  pm2_collaborators: ['usr-1', 'usr-3', 'usr-4'].map((id) => ({ id, email: `${id}@exemplo.test`, name: `Colab ${id}`, cargo: 'Front', active: true, areaId: 'area-1' })),
  pm2_areas: [{ id: 'area-1', name: 'Relacionamento', gestorId: '', monitorIds: [], active: true }],
  pm2_criteria: crit, pm2_catalog_categorias: ['BOLETOS'], pm2_settings: { requireGestorValidation: true, defasagemCompetencia: 1 },
  pm2_auth_session: { email: 'email.antigo.monitora@exemplo.test', perfilAtivo: 'MONITOR' },
  pm2_monitorings: [
    { id: 'MON-10003', protocolo: 'MON-2026-0003', monitorId: 'usr-1', colaboradorId: 'usr-3', competencia: '2026-08', date: '2026-08-20T12:00:00Z', canal: 'Telefone', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [] },
    { id: 'MON-10002', protocolo: 'MON-2026-0002', monitorId: 'usr-1', colaboradorId: '', competencia: '2026-09', date: '2026-10-06T12:00:00Z', canal: '', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [] },
    { id: 'MON-10001', protocolo: 'MON-2026-0001', monitorId: 'usr-1', colaboradorId: 'usr-4', competencia: '2026-08', date: '2026-08-28T12:00:00Z', canal: 'WhatsApp', tipo: 'Regular',
      categoriaAtendimento: 'BOLETOS', numeroAtendimento: 'AT-1', numeroTitulo: 'T-1', inicioAtendimento: '2026-08-28T10:00', fimAtendimento: '2026-08-28T10:20', status: 'Pendente', finalScore: 96.77,
      scores: resp('WhatsApp'), evidencias: [], links: [] },
  ],
};
const exp = JSON.stringify({ meta: { exportadoEm: '2026-10-13T12:00:00.000Z' }, dados: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, JSON.stringify(v)])) });
const G = gerar({ exportacaoBruta: exp, decisoes: dec, regua1: R1, regua1Anterior: R024, reguaCodigo: RCOD, agora: Date.parse('2026-10-13T12:00:00Z') });
const ERIVAN_ID = G.manifesto.novos_perfis.erivan;
ok('D.1', `decisões reais aceitas pelo gerador: responsável "${dec.responsavel_implantacao}", Erivan com id novo ${ERIVAN_ID}, régua do navegador = código (nenhuma diferença)`,
   G.manifesto.responsavel.modo === 'implantacao' && /^usr-\d{13}$/.test(ERIVAN_ID) && G.manifesto.regua2.diferencas_codigo.length === 0);

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(SETUP);
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql'])
  await db.exec(readFileSync(join(projeto, 'supabase/sql', f), 'utf8'));
let e = null; try { await db.exec(G.sql); } catch (x) { e = x; }
ok('D.2', 'migração aplicada SEM nenhum ADMIN, declarada com o responsável de implantação do decisoes.json', !e, e?.message);
// logins (como o painel do Supabase fará depois da migração)
await db.exec(`begin; set local app.responsavel = '${dec.responsavel_implantacao}'; insert into auth.users values
  ('${U(1)}', 'aline.oliveira@mouraleite.com.br', now()), ('${U(2)}', 'erivan.sousa@mouraleite.com.br', now()), ('${U(3)}', 'gestora@exemplo.test', now()), ('${U(4)}', 'email.antigo.monitora@exemplo.test', now()); commit;`);
const conf = (await db.query(readFileSync(join(projeto, 'supabase/sql/conferencia-09.sql'), 'utf8'))).rows;
const falhos = conf.filter((i) => i.ok === false).map((i) => `${i.item}: ${i.resultado}`);
ok('D.3', `conferencia-09.sql (a do SQL Editor, sem adaptação): ${conf.filter((i) => i.ok === true).length} itens aprovados — inclui Aline com e-mail corporativo e Erivan GESTOR do Relacionamento com logins ligados`, falhos.length === 0, JSON.stringify(falhos));

const como = async (uid, q, p = []) => { await db.exec(`begin; set local role authenticated; set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}';`);
  try { const r = await db.query(q, p); await db.exec('commit'); return { rows: r.rows }; } catch (x) { await db.exec('rollback'); return { erro: x }; } };
const er = await como(U(2), "select app.meu_perfil_id() eu, app.meus_perfis() perfis, app.equipe_do_gestor() equipe, (select count(*)::int from public.monitorias) vistas, (select count(*)::int from api.fila_validacao()) fila");
const r0 = er.rows?.[0];
ok('D.4', `Erivan (erivan.sousa@…) entra como GESTOR; equipe = [usr-1]; vê as ${r0?.vistas} monitorias da Aline; MON-10001 na fila de validação`,
   r0?.eu === ERIVAN_ID && JSON.stringify(r0.perfis) === '["GESTOR"]' && JSON.stringify(r0.equipe) === '["usr-1"]' && r0.vistas === 3 && r0.fila === 1, JSON.stringify(er.erro?.message || r0));
const al = (await como(U(1), "select app.meu_perfil_id() eu, app.meus_perfis() perfis, (select count(*)::int from public.monitorias) vistas")).rows?.[0];
ok('D.5', 'Aline (aline.oliveira@…) entra como usr-1, só MONITOR, e vê as próprias monitorias', al?.eu === 'usr-1' && JSON.stringify(al.perfis) === '["MONITOR"]' && al.vistas === 3, JSON.stringify(al));
const antigo = (await como(U(4), "select app.meu_perfil_id() eu, (select count(*)::int from public.monitorias) vistas")).rows?.[0];
ok('D.6', 'login com o e-mail antigo (aline@…) não liga perfil nenhum e não vê nada', antigo?.eu === null && antigo.vistas === 0, JSON.stringify(antigo));
const ge = (await como(U(3), "select app.meus_perfis() perfis, app.equipe_do_gestor() equipe, (select count(*)::int from public.monitorias) vistas")).rows?.[0];
ok('D.7', 'a gestora já cadastrada (GESTOR sem área) entra, mas não tem equipe e não vê monitoria nenhuma', JSON.stringify(ge?.perfis) === '["GESTOR"]' && JSON.stringify(ge.equipe) === '[]' && ge.vistas === 0, JSON.stringify(ge));
const v = (await como(U(1), 'select versao from public.monitorias where id = $1', ['MON-10001'])).rows[0].versao;
const gesVal = await como(U(3), "select api.devolver_monitoria('MON-10001', $1, 'x')", [v]);
const aliVal = await como(U(1), "select api.validar_monitoria('MON-10001', $1)", [v]);
const eriSalva = await como(U(2), "select api.salvar_monitoria('{\"canal\":\"Telefone\"}'::jsonb, null, false)");
const eriVal = await como(U(2), "select api.validar_monitoria('MON-10001', $1)", [v]);
const eriDev = await como(U(2), "select api.devolver_monitoria('MON-10001', $1, 'Revisar pela Régua 1 oficial.') r", [v]);
ok('D.8', 'permissões do GESTOR: a gestora sem área não alcança a MON-10001 (MI404); a Aline não valida (MI403); o Erivan não registra monitoria (MI403), não valida a migrada direto (M1, MI403) e DEVOLVE com motivo',
   gesVal.erro?.code === 'MI404' && aliVal.erro?.code === 'MI403' && eriSalva.erro?.code === 'MI403' && eriVal.erro?.code === 'MI403' && eriDev.rows?.[0]?.r?.status === 'Rascunho',
   JSON.stringify([gesVal.erro?.code, aliVal.erro?.code, eriSalva.erro?.code, eriVal.erro?.code, eriDev.erro?.message]));

relatorio();
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length} testes · ${resultados.length - falhas.length} aprovados · ${falhas.length} falhas`);
process.exit(falhas.length ? 1 : 0);
