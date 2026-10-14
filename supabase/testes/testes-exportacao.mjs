// Testes das ferramentas de exportação (DADOS SINTÉTICOS — nada real é lido ou gravado).
// Uso: node testes-exportacao.mjs <projeto> <pasta reguas> <pasta temporária>
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const [projeto, pastaReguas, tmp] = process.argv.slice(2);
const MIG = join(projeto, 'supabase', 'migracao');
const { conferir } = await import(pathToFileURL(join(MIG, 'conferir-exportacao.mjs')).href);
const { sanitizar } = await import(pathToFileURL(join(MIG, 'sanitizar-exportacao.mjs')).href);
const { gerar } = await import(pathToFileURL(join(MIG, 'gerar-09.mjs')).href);
const regua = (r) => JSON.parse(readFileSync(join(pastaReguas, `${r}.json`), 'utf8'));
const R1 = regua('v0.25.0'), R024 = regua('v0.24.0'), RHEAD = regua('HEAD');
const sha = (t) => createHash('sha256').update(t).digest('hex');
const resultados = [];
const ok = (id, desc, cond, det = '') => resultados.push({ id, desc, ok: !!cond, det });
const relatorio = () => { for (const r of resultados) console.log(`${r.ok ? '✔' : '✖'} ${r.id}  ${r.desc}${r.ok ? '' : `  → ${r.det}`}`); };
process.on('uncaughtException', (x) => { relatorio(); console.log('INTERROMPIDO:', x.message, (x.stack || '').split('\n')[1]); process.exit(2); });
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });

// ---- navegador sintético (o que existiria no localStorage do portal antigo) --------------------
const SENHAS = ['Sintetica#Senha-Monitora1', 'Sintetica#Senha-Pessoa4', 'Sintetica#Senha-Admin', 'Sintetica#Senha-Gestora'];
const EMAILS = ['monitora1@exemplo.test', 'pessoa4@exemplo.test', 'admin@exemplo.test', 'gestora@exemplo.test'];
const NOMES = ['Pessoa Monitora Ação', 'Pessoa Quatro', 'Administração Genérica', 'Gestora Sintética'];
const usuarios = [
  { id: 'usr-1', email: EMAILS[0], name: NOMES[0], password: SENHAS[0], perfis: ['ADMIN', 'MONITOR'], status: 'ACTIVE', cargo: 'Monitora' },
  { id: 'usr-4', email: EMAILS[1], name: NOMES[1], password: SENHAS[1], perfis: [], status: 'ACTIVE' },
  { id: 'usr-7', email: EMAILS[2], name: NOMES[2], password: SENHAS[2], perfis: ['ADMIN'], status: 'ACTIVE' },
  { id: 'usr-1788800361784', email: EMAILS[3], name: NOMES[3], password: SENHAS[3], confirmPassword: SENHAS[3], perfis: ['GESTOR'], status: 'ACTIVE', observacoes: 'Supervisão — ação' },
];
const rascunhoAgosto = (n) => ({ id: `MON-1${String(n).padStart(4, '0')}`, protocolo: `MON-2026-${String(n).padStart(4, '0')}`, monitorId: 'usr-1', colaboradorId: 'usr-4', competencia: '2026-08',
  date: '2026-08-15T12:00:00Z', canal: 'Telefone', tipo: 'Regular', status: 'Rascunho', finalScore: 0, scores: [], evidencias: [], links: [], eliminatoryPending: false, zerada: false,
  contexto: `Atendimento sintético nº ${n} — observação com acentuação: ção, ê, ü 🙂` });
const mon10001 = { id: 'MON-10001', protocolo: 'MON-2026-0001', monitorId: 'usr-1', colaboradorId: 'usr-4', competencia: '2026-08', date: '2026-08-28T12:00:00Z', canal: 'WhatsApp',
  tipo: 'Regular', status: 'Pendente', finalScore: 96.77, scores: [{ criterionId: 'crit-06', score: 1, lowScoreReason: 'x', subRespostas: null }], evidencias: [], links: [], eliminatoryPending: false, zerada: false };
const mon10002 = { id: 'MON-10002', protocolo: 'MON-2026-0002', monitorId: 'usr-1', colaboradorId: '', competencia: '2026-09', date: '2026-10-06T12:00:00Z', canal: '', status: 'Rascunho',
  finalScore: 0, scores: [], evidencias: [], links: [], eliminatoryPending: false, zerada: false };
const estado = (extraMons = []) => ({
  pm2_users: usuarios, pm2_collaborators: [{ id: 'usr-1', name: NOMES[0], email: EMAILS[0], cargo: 'Front', active: true, areaId: 'area-1' }, { id: 'usr-4', name: NOMES[1], email: EMAILS[1], cargo: 'Front', active: true, areaId: 'area-1' }],
  pm2_areas: [{ id: 'area-1', name: 'Relacionamento', gestorId: '', monitorIds: [], active: true }], pm2_criteria: R1.criterios, pm2_catalog_categorias: ['BOLETOS', 'CADASTRO'],
  pm2_settings: { requireGestorValidation: true, defasagemCompetencia: 1 }, pm2_brand: { id: 'b', name: 'MonitorIA', logoUrl: '', primaryColor: '#166534', secondaryColor: '#f28c1c', backgroundColor: '#fff', textColor: '#111' },
  pm2_auth_session: { email: EMAILS[0], perfilAtivo: 'MONITOR' }, pm2_auth_logs: [{ id: '1', eventType: 'LOGIN', userEmail: EMAILS[0], userName: NOMES[0], userRole: 'MONITOR', actionDetails: '', timestamp: '2026-09-10T12:00:00.000Z' }],
  pm2_cgoals: [{ id: 'cgoal-1', monitorId: 'usr-1', colaboradorId: 'usr-4', year: 2026, month: 8, targetQty: 4 }], pm2_planos_metas: [], pm2_mgoals: [], pm2_holidays: [], pm2_agenda: [], pm2_demands: [], pm2_announcements: [], pm2_allocations: [], pm2_alloc_history: [],
  pm2_criteria_version: 4, pm2_database_version: 11, pm2_users_perfis_version: 1, pm2_monitorings_competencia_version: 1, pm2_catalog_categorias_version: 1,
  pm2_criteria_sub24_version: 1, pm2_criteria_sub24_backup: { em: '2026-10-07T13:08:45.617Z', criterio: R024.criterios.find((c) => c.id === 'crit-24') },
  pm2_monitorings: [...extraMons, mon10002, mon10001],
});
const RASCUNHOS = 6;
const navegador = estado(Array.from({ length: RASCUNHOS }, (_, i) => rascunhoAgosto(i + 3)));
const backup0810 = estado([]);

// ---- 1. a rotina do navegador, executada num navegador simulado ------------------------------
const ls = new Map(Object.entries(navegador).map(([k, v]) => [k, JSON.stringify(v)]));
ls.set('monitoria-sessao-supabase', '{"access_token":"jwt-sintetico"}'); // outra chave do site: não pode entrar
ls.set('preferencia-de-outro-app', 'x');
const lsAntes = JSON.stringify([...ls.entries()]);
let baixado = null, nomeBaixado = null, rede = 0;
const saidaConsole = [];
const contexto = vm.createContext({
  localStorage: { get length() { return ls.size; }, key: (i) => [...ls.keys()][i] ?? null, getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: () => { throw new Error('a rotina tentou GRAVAR no localStorage'); }, removeItem: () => { throw new Error('a rotina tentou APAGAR do localStorage'); }, clear: () => { throw new Error('clear'); } },
  location: { origin: 'https://monitoria-qualidade.vercel.app' },
  document: { createElement: () => ({ set href(v) { this._h = v; }, get href() { return this._h; }, set download(v) { nomeBaixado = v; }, click() {} }) },
  URL: { createObjectURL: (b) => { baixado = b.texto; return 'blob:sintetico'; } },
  Blob: class { constructor(partes) { this.texto = partes.join(''); } },
  TextEncoder, crypto: webcrypto, JSON, Object, Array, Uint8Array, Date,
  fetch: () => { rede++; throw new Error('rede'); }, XMLHttpRequest: function () { rede++; },
  console: { log: (...a) => saidaConsole.push(a), table: (...a) => saidaConsole.push(a) },
});
const rotina = readFileSync(join(MIG, 'exportar-navegador.js'), 'utf8');
const retorno = await vm.runInContext(rotina, contexto);
const exp = JSON.parse(baixado);
const pm2 = [...ls.keys()].filter((k) => k.startsWith('pm2_'));
ok('E.1', `rotina do navegador: copia as ${pm2.length} chaves pm2_* BYTE A BYTE (inclusive acentos e emoji) e nenhuma outra chave do site (nem a sessão do Supabase)`,
   Object.keys(exp.dados).length === pm2.length && pm2.every((k) => exp.dados[k] === ls.get(k)) && !('monitoria-sessao-supabase' in exp.dados) && !('preferencia-de-outro-app' in exp.dados));
ok('E.2', 'rotina do navegador: não grava, não apaga e não acessa a rede; o meta confere (chaves, monitorias, versão do banco)',
   JSON.stringify([...ls.entries()]) === lsAntes && rede === 0 && exp.meta.chaves === pm2.length && exp.meta.monitorias === navegador.pm2_monitorings.length && exp.meta.versaoBanco === '11');
ok('E.3', 'a impressão digital mostrada no console é a do arquivo baixado (prova que o arquivo não mudou no caminho)', retorno.sha256 === sha(Buffer.from(baixado, 'utf8')) && /^monitoria-exportacao-final-/.test(nomeBaixado));
const consoleTexto = JSON.stringify(saidaConsole);
ok('E.4', `o console mostra situação e rascunhos por competência (2026-08: ${RASCUNHOS}) e NÃO mostra senha, e-mail nem nome`,
   consoleTexto.includes(`"2026-08":${RASCUNHOS}`) && ![...SENHAS, ...EMAILS, ...NOMES].some((s) => consoleTexto.includes(s)), consoleTexto.slice(0, 300));
const ORIG = join(tmp, 'exportacao-original.json');
writeFileSync(ORIG, baixado);
const BK = join(tmp, 'backup-anterior.json');
writeFileSync(BK, JSON.stringify({ meta: { exportadoEm: '2026-10-08T15:16:53.698Z', origem: 'https://monitoria-qualidade.vercel.app', versaoBanco: '11', chaves: Object.keys(backup0810).length, monitorias: 2 },
  dados: Object.fromEntries(Object.entries(backup0810).map(([k, v]) => [k, JSON.stringify(v)])) }, null, 2));

// ---- 2. conferência ---------------------------------------------------------------------------
const c1 = conferir(readFileSync(ORIG, 'utf8'), readFileSync(BK, 'utf8'));
ok('E.5', `conferência da original: APTO; ${c1.monitorias?.total} monitorias, por situação ${JSON.stringify(c1.monitorias?.por_situacao)}, rascunhos de agosto = ${c1.monitorias?.rascunhos_por_competencia?.['2026-08']}`,
   c1.veredito === 'APTO' && c1.monitorias.total === RASCUNHOS + 2 && c1.monitorias.rascunhos_por_competencia['2026-08'] === RASCUNHOS && c1.monitorias.por_situacao.Pendente === 1, JSON.stringify(c1.problemas));
ok('E.6', `× backup anterior: ${c1.comparacao?.monitorias?.novas.length} novas (os rascunhos de agosto), nenhuma removida; a original é sinalizada como contendo senha e sessão`,
   c1.comparacao.monitorias.novas.length === RASCUNHOS && c1.comparacao.monitorias.removidas.length === 0 && c1.alertas.some((a) => /ORIGINAL/.test(a)) && c1.usuarios.com_password === 4 && c1.sessao_presente === true);
ok('E.7', 'ensaio do gerador dentro da conferência: reconstrução idêntica em todas as chaves; MON-10001 enviada, rascunhos não', Object.values(c1.ensaio.reconstrucao).every((v) => v.startsWith('idêntico'))
   && c1.ensaio.monitorias.find((m) => m.id === 'MON-10001').enviada_na_origem === true && c1.ensaio.monitorias.filter((m) => m.situacao === 'Rascunho').every((m) => m.enviada_na_origem === false));
const c1txt = JSON.stringify(c1);
ok('E.8', 'o relatório da conferência não contém nenhuma senha, e-mail ou nome', ![...SENHAS, ...EMAILS, ...NOMES].some((s) => c1txt.includes(s)));
// problemas detectados
const mexe = (f) => { const d = structuredClone(estado(Array.from({ length: RASCUNHOS }, (_, i) => rascunhoAgosto(i + 3)))); f(d); return JSON.stringify({ meta: { exportadoEm: 'x', chaves: Object.keys(d).length, monitorias: d.pm2_monitorings.length }, dados: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, JSON.stringify(v)])) }); };
const casos = {
  'monitoria sumiu': conferir(mexe((d) => { d.pm2_monitorings = d.pm2_monitorings.filter((m) => m.id !== 'MON-10001'); }), readFileSync(BK, 'utf8')),
  'meta não confere': conferir(baixado.replace(`"monitorias": ${exp.meta.monitorias}`, '"monitorias": 99')),
  'chave inválida': conferir(JSON.stringify({ meta: {}, dados: { ...exp.dados, pm2_agenda: '{quebrado' } })),
  'chave desconhecida': conferir(JSON.stringify({ meta: {}, dados: { ...exp.dados, pm2_nova: '[]' } })),
  'id repetido': conferir(mexe((d) => { d.pm2_monitorings.push({ ...mon10002, protocolo: 'MON-2026-9999' }); })),
  'campo token': conferir(mexe((d) => { d.pm2_brand.token = 'abc'; })),
  'senha copiada': conferir(mexe((d) => { d.pm2_users[1].observacoes = `anotei ${SENHAS[0]}`; })),
};
const naoApto = Object.entries(casos).filter(([, r]) => r.veredito !== 'NÃO APTO').map(([k]) => k);
ok('E.9', `conferência acusa NÃO APTO em ${Object.keys(casos).length} situações: ${Object.keys(casos).join(', ')}`, naoApto.length === 0, JSON.stringify(naoApto));
ok('E.10', 'as mensagens desses problemas não repetem nenhum valor sensível', ![...SENHAS, ...EMAILS, ...NOMES].some((s) => JSON.stringify(casos).includes(s)));
// linha de comando: só lê
const shaOrig0 = sha(readFileSync(ORIG)), mtime0 = statSync(ORIG).mtimeMs;
const node = (args) => { try { return { out: execFileSync(process.execPath, args, { encoding: 'utf8' }), code: 0 }; } catch (e) { return { out: (e.stdout || '') + (e.stderr || ''), code: e.status }; } };
const RELC = join(tmp, 'relatorio.json');
const cli = node([join(MIG, 'conferir-exportacao.mjs'), ORIG, BK, '--relatorio', RELC]);
const cli2 = node([join(MIG, 'conferir-exportacao.mjs'), ORIG, '--relatorio', ORIG]);
ok('E.11', 'linha de comando da conferência: APTO (código 0), relatório gravado, original intacto, saída sem dado sensível; recusa gravar o relatório por cima da entrada',
   cli.code === 0 && /APTO/.test(cli.out) && existsSync(RELC) && sha(readFileSync(ORIG)) === shaOrig0 && statSync(ORIG).mtimeMs === mtime0
   && ![...SENHAS, ...EMAILS, ...NOMES].some((s) => cli.out.includes(s)) && cli2.code !== 0 && sha(readFileSync(ORIG)) === shaOrig0, cli.out.slice(0, 300) + ' | ' + cli2.out);

// ---- 3. cópia sanitizada ----------------------------------------------------------------------
const SAN = join(tmp, 'copia-sanitizada.json');
const s1 = node([join(MIG, 'sanitizar-exportacao.mjs'), ORIG, SAN]);
const copiaTxt = existsSync(SAN) ? readFileSync(SAN, 'utf8') : '';
const copia = copiaTxt ? JSON.parse(copiaTxt) : { dados: {}, meta: {} };
ok('E.12', 'sanitização: cópia gravada; o original continua com a MESMA impressão digital e data de alteração', s1.code === 0 && existsSync(SAN) && sha(readFileSync(ORIG)) === shaOrig0 && statSync(ORIG).mtimeMs === mtime0, s1.out);
ok('E.13', 'a cópia não tem password, confirmPassword, pm2_auth_session nem qualquer valor de senha', !/"(password|confirmPassword)"\s*:/.test(copiaTxt) && !('pm2_auth_session' in copia.dados) && !SENHAS.some((s) => copiaTxt.includes(s)) && !copiaTxt.includes('perfilAtivo'));
const iguais = Object.keys(exp.dados).filter((k) => k !== 'pm2_users' && k !== 'pm2_auth_session').every((k) => copia.dados[k] === exp.dados[k]);
const usuariosCopia = JSON.parse(copia.dados.pm2_users || '[]');
ok('E.14', 'todas as outras chaves são IDÊNTICAS ao original (byte a byte) e cada usuário é idêntico sem os dois campos de senha', iguais
   && JSON.stringify(usuariosCopia) === JSON.stringify(JSON.parse(exp.dados.pm2_users).map((u) => { const c = { ...u }; delete c.password; delete c.confirmPassword; return c; })));
ok('E.15', 'meta.sanitizacao registra o que saiu e quantas vezes (password ×4, confirmPassword ×1, sessão) e a impressão digital do original — sem valores',
   JSON.stringify(copia.meta.sanitizacao?.campos_removidos) === JSON.stringify([{ chave: 'pm2_users', campo: 'password', ocorrencias: 4 }, { chave: 'pm2_users', campo: 'confirmPassword', ocorrencias: 1 }])
   && JSON.stringify(copia.meta.sanitizacao.chaves_descartadas) === '["pm2_auth_session"]' && copia.meta.sanitizacao.original_sha256 === shaOrig0 && copia.meta.chaves === pm2.length - 1);
ok('E.16', 'a saída da sanitização não mostra senha, e-mail nem nome', ![...SENHAS, ...EMAILS, ...NOMES].some((s) => s1.out.includes(s)));
const shaSan = sha(readFileSync(SAN));
const r1 = node([join(MIG, 'sanitizar-exportacao.mjs'), ORIG, ORIG]);
const r2 = node([join(MIG, 'sanitizar-exportacao.mjs'), ORIG, SAN]);
const ruim1 = join(tmp, 'origem-senha-copiada.json'), ruim2 = join(tmp, 'origem-token.json');
writeFileSync(ruim1, mexe((d) => { d.pm2_users[1].observacoes = `anotei ${SENHAS[0]}`; }));
writeFileSync(ruim2, mexe((d) => { d.pm2_brand.token = 'abc'; }));
const r3 = node([join(MIG, 'sanitizar-exportacao.mjs'), ruim1, join(tmp, 'saida3.json')]);
const r4 = node([join(MIG, 'sanitizar-exportacao.mjs'), ruim2, join(tmp, 'saida4.json')]);
const r5 = node([join(MIG, 'sanitizar-exportacao.mjs'), join(tmp, 'nao-existe.json'), join(tmp, 'saida5.json')]);
ok('E.17', 'sanitização RECUSA: gravar por cima do original, sobrescrever cópia existente, senha anotada em outro campo, campo "token", arquivo inexistente — sem gravar nada e sem mostrar valores',
   r1.code === 1 && r2.code === 1 && sha(readFileSync(SAN)) === shaSan && sha(readFileSync(ORIG)) === shaOrig0 && r3.code === 1 && r4.code === 1 && r5.code === 1
   && !existsSync(join(tmp, 'saida3.json')) && !existsSync(join(tmp, 'saida4.json')) && ![r1, r2, r3, r4, r5].some((r) => SENHAS.some((s) => r.out.includes(s))),
   [r1, r2, r3, r4, r5].map((r) => r.out.trim()).join(' | '));
const c2 = conferir(copiaTxt, readFileSync(BK, 'utf8'));
ok('E.18', 'conferência da CÓPIA sanitizada: APTO, reconhecida como sanitizada, sem senha nem sessão, e sem perda em relação ao backup anterior', c2.veredito === 'APTO' && c2.tipo === 'cópia sanitizada'
   && c2.usuarios.com_password === 0 && c2.sessao_presente === false && c2.comparacao.monitorias.removidas.length === 0 && c2.comparacao.chaves_removidas.length === 0, JSON.stringify(c2.problemas));

// ---- 4. gerador a partir da cópia sanitizada --------------------------------------------------
const decisoes = { responsavel_admin_id: 'adm-1', perfis: { 'usr-1': { perfis: ['MONITOR'] }, 'usr-7': { perfis: [], status: 'INACTIVE' } },
  novos_perfis: [{ apelido: 'erivan', email: 'supervisor@exemplo.test', nome: 'Supervisor Sintético', perfis: ['GESTOR'] }],
  areas: { 'area-1': { gestor: '@erivan', monitores: ['usr-1'] } },
  regua1: { vigente_desde: '2026-08-31', anterior: 'x', datas: { commit_codigo: { situacao: 'comprovada' }, publicacao_producao: { situacao: 'nao_comprovada' } } }, regua2: { vigente_desde: '2026-10-12' } };
const G = gerar({ exportacaoBruta: copiaTxt, decisoes, regua1: R1, regua1Anterior: R024, reguaCodigo: RHEAD, agora: 1789000000000 });
const sens = G.ocorrencias.filter((o) => o.classe === 'REMOVIDO_SENSIVEL');
ok('E.19', 'gerador lendo a CÓPIA: registra a retirada feita na sanitização (password ×4, confirmPassword ×1, sessão) e reconstrói tudo sem perda',
   sens.length === 3 && sens.every((o) => /cópia sanitizada/.test(o.detalhe)) && JSON.stringify(G.manifesto.removidos.campos_senha) === JSON.stringify([{ campo: 'password', ocorrencias: 4 }, { campo: 'confirmPassword', ocorrencias: 1 }])
   && Object.values(G.manifesto.reconstrucao).every((v) => v.startsWith('idêntico')), JSON.stringify(G.manifesto.removidos));
ok('E.20', 'a impressão digital do ORIGINAL (que tem senhas) NÃO vai para o SQL nem para o manifesto do banco', !G.sql.includes(shaOrig0) && !JSON.stringify(G.manifesto).includes(shaOrig0));
const adulterada = JSON.parse(copiaTxt); const us = JSON.parse(adulterada.dados.pm2_users); us[0].password = 'voltou'; adulterada.dados.pm2_users = JSON.stringify(us);
let recusouAdult = null; try { gerar({ exportacaoBruta: JSON.stringify(adulterada), decisoes, regua1: R1, regua1Anterior: R024, reguaCodigo: RHEAD }); } catch (e) { recusouAdult = e.message; }
ok('E.21', 'gerador RECUSA uma "cópia sanitizada" que ainda tem senha', /ainda contém senha/.test(recusouAdult || ''), recusouAdult);
const SAIDA = join(tmp, 'saida-gerador'), DEC = join(tmp, 'decisoes.json');
writeFileSync(join(tmp, 'r1.json'), JSON.stringify(R1)); writeFileSync(join(tmp, 'r024.json'), JSON.stringify(R024)); writeFileSync(join(tmp, 'rhead.json'), JSON.stringify(RHEAD));
writeFileSync(DEC, JSON.stringify({ ...decisoes, regua1: { ...decisoes.regua1, arquivo: join(tmp, 'r1.json'), anterior: join(tmp, 'r024.json') }, regua2: { ...decisoes.regua2, codigo: join(tmp, 'rhead.json') } }));
const g = node([join(MIG, 'gerar-09.mjs'), SAN, DEC, SAIDA]);
const manLocal = existsSync(join(SAIDA, 'manifesto.json')) ? JSON.parse(readFileSync(join(SAIDA, 'manifesto.json'), 'utf8')) : {};
ok('E.22', 'linha de comando do gerador com a cópia: 09b e manifesto gravados; o manifesto LOCAL guarda a impressão do original e a da cópia (fora do banco)',
   g.code === 0 && existsSync(join(SAIDA, '09b_migracao_dados.sql')) && manLocal.original_sha256 === shaOrig0 && manLocal.arquivo_entrada_sha256 === shaSan && !readFileSync(join(SAIDA, '09b_migracao_dados.sql'), 'utf8').includes(shaOrig0), g.out);

// ---- 5. cadeia completa no banco: cópia sanitizada → 09b → Postgres ------------------------------
const db = await PGlite.create({ extensions: { pgcrypto } });
const t = readFileSync(new URL('./testes-e1.mjs', import.meta.url), 'utf8');
await db.exec(t.slice(t.indexOf('await db.exec(`') + 15, t.indexOf('`);', t.indexOf('await db.exec(`'))));
for (const f of ['00_base.sql', '01_identidade.sql', '02_estrutura.sql', '03_regua.sql', '04_monitorias.sql', '05_documentos.sql', '06_auditoria.sql', '07_seguranca.sql', '08_funcoes.sql', '09a_migracao_estrutura.sql', '10_p1_reprovar_m1.sql'])
  await db.exec(readFileSync(join(projeto, 'supabase', 'sql', f), 'utf8'));
await db.exec(`begin; set local app.responsavel = 'Administração Sintética <adm@exemplo.test>'; insert into public.perfis (id, email, nome, perfis, status) values ('adm-1', 'adm@exemplo.test', 'Adm', '{ADMIN}', 'ACTIVE'); commit;`);
let e9 = null; try { await db.exec(readFileSync(join(SAIDA, '09b_migracao_dados.sql'), 'utf8')); } catch (e) { e9 = e; }
const cnt = (await db.query("select (select count(*) from public.monitorias)::int m, (select count(*) from public.monitorias where status = 'Rascunho' and competencia = '2026-08' and not enviada_na_origem)::int r, (select count(*) from app.migracao_ocorrencias where classe = 'REMOVIDO_SENSIVEL')::int s")).rows[0];
const tudo = (await db.query("select string_agg(x, ' ') t from (select texto x from app.migracao_origem union all select extras::text from public.perfis union all select coalesce(depois::text, '') from public.auditoria union all select manifesto::text from app.migracao_lotes) z")).rows[0].t;
ok('E.23', `cadeia completa: cópia sanitizada → 09b → banco: ${cnt.m} monitorias (os ${RASCUNHOS} rascunhos de agosto como rascunho nunca enviado, E3m), 3 retiradas registradas, nenhuma senha, sessão ou impressão do original no banco`,
   !e9 && cnt.m === RASCUNHOS + 2 && cnt.r === RASCUNHOS && cnt.s === 3 && !SENHAS.some((s) => tudo.includes(s)) && !tudo.includes('perfilAtivo') && !tudo.includes(shaOrig0), e9?.message || JSON.stringify(cnt));

relatorio();
const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length} testes · ${resultados.length - falhas.length} aprovados · ${falhas.length} falhas`);
rmSync(tmp, { recursive: true, force: true });
process.exit(falhas.length ? 1 : 0);
