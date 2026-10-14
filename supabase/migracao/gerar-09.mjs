// =============================================================================
// MonitorIA · Gerador do script 09b (migração dos dados do localStorage)
// =============================================================================
//
// Uso (da raiz do projeto):
//   node supabase/migracao/gerar-09.mjs <exportacao.json> <decisoes.json> <pasta de saída>
//
// Entradas
//   exportacao.json  arquivo exportado pelo portal antigo ({ meta, dados: { pm2_*: "<texto>" } }).
//                    CONTÉM SENHAS: guardar em local restrito; nunca versionar nem enviar ao Supabase.
//   decisoes.json    decisões aprovadas (ver o exemplo em decisoes.exemplo.json): ADMIN responsável,
//                    perfis alterados, perfis novos, vínculos da área, régua 1 (arquivo extraído do
//                    git), régua 2.0 (vigência e diferenças aprovadas em relação ao código) e,
//                    opcionalmente, a evidência de 08/10.
//
// Saídas (na pasta indicada)
//   09b_migracao_dados.sql   script único, em uma transação, para o SQL Editor. Sem senha, sem
//                            sessão. Se qualquer conferência interna falhar, nada é gravado.
//   manifesto.json           contagens, impressões digitais, decisões aplicadas, ocorrências,
//                            resultado da reconstrução. Sem dado sensível; pode ser revisado.
//
// Garantias (cada uma interrompe a geração se falhar)
//   G1 Toda chave da exportação é conhecida; chave desconhecida para tudo.
//   G2 Senha e sessão nunca saem daqui: os campos de senha de pm2_users são retirados, a chave
//      pm2_auth_session é descartada, nenhum outro campo com nome de segredo é aceito e nenhum
//      VALOR de senha retirado aparece no SQL gerado.
//   G3 Sem duplicidade na origem: id de usuário, e-mail, id e protocolo de monitoria, critério,
//      colaborador, área; critério respondido duas vezes na mesma monitoria.
//   G4 Sem perda: cada registro é reconstruído a partir das linhas que vão ao banco e comparado
//      com o original (sem os campos de senha). Diferença = para.
//   G5 Só as decisões do arquivo de decisões alteram valores; cada alteração vira ocorrência
//      TRANSFORMADO_POR_DECISAO, com o original guardado em extras._<campo>_original.
//   G6 Régua 2.0 = critérios atuais do navegador. Diferença em relação ao código que não esteja
//      na lista de diferenças aprovadas = para (nenhum critério ou peso é ajustado aqui).
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const GERADOR_VERSAO = '09b-gerador-1.0';

class Recusa extends Error {}
const recusar = (msg) => { throw new Recusa(msg); };
const sha256 = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

// JSON canônico (chaves ordenadas): base das comparações sem perda.
export const canonico = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
};

// ---- chaves conhecidas do localStorage --------------------------------------------------
export const CHAVES = {
  pm2_users: 'perfis', pm2_areas: 'areas', pm2_collaborators: 'colaboradores', pm2_allocations: 'alocacoes',
  pm2_alloc_history: 'alocacoes_historico', pm2_criteria: 'criterios', pm2_monitorings: 'monitorias',
  pm2_cgoals: 'doc:metas_colaborador', pm2_planos_metas: 'doc:planos_metas', pm2_holidays: 'doc:feriados',
  pm2_mgoals: 'doc:metas_monitor', pm2_agenda: 'doc:agenda', pm2_demands: 'doc:demandas', pm2_announcements: 'doc:comunicados',
  pm2_catalog_categorias: 'cat:categorias', pm2_catalog_empreendimentos: 'cat:empreendimentos',
  pm2_settings: 'cfg:settings', pm2_brand: 'cfg:brand', pm2_auth_logs: 'acessos_log',
  // só evidência (marcas de versão do navegador e cópia do crit-24 de 07/10)
  pm2_criteria_version: 'evidencia', pm2_catalog_categorias_version: 'evidencia', pm2_users_perfis_version: 'evidencia',
  pm2_monitorings_competencia_version: 'evidencia', pm2_criteria_sub24_version: 'evidencia', pm2_criteria_sub24_backup: 'evidencia',
  pm2_database_version: 'evidencia',
  // descartada: sessão do navegador
  pm2_auth_session: 'descartar',
};
const SENHA_USUARIO = ['password', 'confirmPassword'];
const NOME_SEGREDO = /^(password|confirmpassword|senha|token|accesstoken|refreshtoken|secret|apikey|api_key|jwt|credential|credentials)$/i;

// ---- convenções de fidelidade (scripts 01 a 05) ------------------------------------------
const isoMs = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v);
const dataISO = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v);
const texto = (v) => typeof v === 'string';
const numero = (v) => typeof v === 'number' && Number.isFinite(v);
const logico = (v) => typeof v === 'boolean';
const listaTextos = (v) => Array.isArray(v) && v.every(texto);

// promove campos para colunas; o que não cabe vai para extras._<campo>_original; null explícito
// vai para extras._nulos; o resto vai intacto para extras.
const promover = (obj, spec, ctx) => {
  const col = {}, extras = {}, nulos = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) recusar(`${ctx}: campo "${k}" começa com "_" (reservado para as marcas de fidelidade). Revisar antes de migrar.`);
    const s = spec[k];
    if (!s) { extras[k] = v; continue; }
    if (v === null) { nulos.push(k); continue; }
    if (s.ok(v)) col[s.col] = s.conv ? s.conv(v) : v;
    else extras[`_${k}_original`] = v;
  }
  if (nulos.length) extras._nulos = nulos;
  return { col, extras };
};
// caminho inverso
const reconstruir = (col, extras, spec) => {
  const o = {};
  for (const [k, s] of Object.entries(spec)) if (col[s.col] !== null && col[s.col] !== undefined) o[k] = s.volta ? s.volta(col[s.col]) : col[s.col];
  for (const k of extras._nulos || []) o[k] = null;
  for (const [k, v] of Object.entries(extras)) {
    const m = /^_(.+)_original$/.exec(k);
    if (m) o[m[1]] = v; else if (!k.startsWith('_')) o[k] = v;
  }
  for (const k of extras._ausentes || []) delete o[k];
  for (const k of extras._listas_vazias || []) if (!(k in o)) o[k] = [];
  return o;
};

// ---- leitura e validação da exportação ------------------------------------------------------
export const lerExportacao = (bruto) => {
  let arq;
  try { arq = JSON.parse(bruto); } catch { recusar('Exportação não é JSON válido.'); }
  if (!arq || typeof arq !== 'object' || !arq.dados || typeof arq.dados !== 'object') recusar('Exportação sem o bloco "dados".');
  const desconhecidas = Object.keys(arq.dados).filter((k) => !(k in CHAVES));
  if (desconhecidas.length) recusar(`Chaves desconhecidas na exportação: ${desconhecidas.join(', ')}. Mapear antes de migrar (G1).`);
  const dados = {};
  for (const [k, t] of Object.entries(arq.dados)) {
    if (typeof t !== 'string') recusar(`Chave ${k}: o valor exportado deveria ser o texto do localStorage.`);
    try { dados[k] = JSON.parse(t); } catch { recusar(`Chave ${k}: texto não é JSON válido.`); }
  }
  return { meta: arq.meta || {}, textos: arq.dados, dados };
};

// procura nome de campo com cara de segredo em qualquer profundidade
const camposSegredo = (v, caminho, achados) => {
  if (Array.isArray(v)) v.forEach((x, i) => camposSegredo(x, `${caminho}[${i}]`, achados));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (NOME_SEGREDO.test(k)) achados.push(`${caminho}.${k}`); camposSegredo(x, `${caminho}.${k}`, achados); }
  return achados;
};

// ---- geração ---------------------------------------------------------------------------------
export const gerar = ({ exportacaoBruta, decisoes, regua1, regua1Anterior = null, reguaCodigo, evidencia0810Bruta = null, agora = Date.now() }) => {
  const { meta, textos, dados } = lerExportacao(exportacaoBruta);
  const ocorrencias = [];
  const oc = (classe, entidade, chave, campo, antes, depois, decisao, detalhe) =>
    ocorrencias.push({ classe, entidade, chave: chave ?? null, campo: campo ?? null, antes: antes === undefined ? null : antes, depois: depois === undefined ? null : depois, decisao: decisao ?? null, detalhe: detalhe ?? null });
  const lista = (k) => { const v = dados[k]; if (v === undefined) return []; if (!Array.isArray(v)) recusar(`${k} deveria ser uma lista.`); return v; };
  const linhas = {};   // tabela -> [linha]
  const add = (t, l) => (linhas[t] ||= []).push(l);

  // Responsável declarado (06, R5). Dois modos, e só um por vez:
  //   responsavel_admin_id      id de um perfil ADMIN ativo (depois que existir administrador);
  //   responsavel_implantacao   "Nome <e-mail>" de quem executa, ENQUANTO não existe nenhum perfil
  //                             ADMIN — a mesma exceção de implantação do R5, que se fecha para
  //                             sempre quando o primeiro administrador for criado.
  const modoAdmin = typeof decisoes?.responsavel_admin_id === 'string' && decisoes.responsavel_admin_id.trim() !== '';
  const modoImpl = typeof decisoes?.responsavel_implantacao === 'string' && decisoes.responsavel_implantacao.trim() !== '';
  if (modoAdmin === modoImpl) recusar('Decisões: informe exatamente um responsável — responsavel_admin_id (perfil ADMIN ativo) OU responsavel_implantacao ("Nome <e-mail>", só enquanto não há ADMIN).');
  if (modoImpl && !/^[^<>]{3,}<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/.test(decisoes.responsavel_implantacao.trim()))
    recusar('responsavel_implantacao precisa ser "Nome completo <e-mail corporativo individual>".');
  const responsavel = modoAdmin ? decisoes.responsavel_admin_id.trim() : decisoes.responsavel_implantacao.trim();

  // ---- G2: senhas e sessão ----
  const senhasRetiradas = [];
  const usuariosOrig = lista('pm2_users');
  const usuarios = usuariosOrig.map((u) => {
    if (!u || typeof u !== 'object') recusar('pm2_users: item que não é objeto.');
    const c = { ...u };
    for (const s of SENHA_USUARIO) if (s in c) { if (typeof c[s] === 'string' && c[s].length >= 4) senhasRetiradas.push(c[s]); delete c[s]; }
    return c;
  });
  let contagemRetirada = Object.fromEntries(SENHA_USUARIO.map((s) => [s, usuariosOrig.filter((u) => u && s in u).length]).filter(([, n]) => n > 0));
  let descartadas = 'pm2_auth_session' in dados ? ['pm2_auth_session'] : [];
  // Cópia sanitizada (sanitizar-exportacao.mjs): a retirada já foi feita lá, a partir do original,
  // que é quem conhece os valores. Aqui só se confere que a cópia está limpa e se registra o que
  // foi retirado, a partir de meta.sanitizacao.
  const sanitizacao = meta.sanitizacao || null;
  if (sanitizacao) {
    if (Object.keys(contagemRetirada).length || descartadas.length) recusar('A cópia sanitizada ainda contém senha ou sessão — gere a cópia de novo com sanitizar-exportacao.mjs (G2).');
    if (!Array.isArray(sanitizacao.campos_removidos) || !Array.isArray(sanitizacao.chaves_descartadas) || !/^[0-9a-f]{64}$/.test(sanitizacao.original_sha256 || ''))
      recusar('Registro de sanitização (meta.sanitizacao) inválido.');
    contagemRetirada = Object.fromEntries(sanitizacao.campos_removidos.map((c) => [c.campo, c.ocorrencias]));
    descartadas = [...sanitizacao.chaves_descartadas];
  }
  const origemRetirada = sanitizacao ? ` (retirada feita na cópia sanitizada em ${sanitizacao.em ?? '?'})` : '';
  for (const [campo, n] of Object.entries(contagemRetirada)) oc('REMOVIDO_SENSIVEL', 'pm2_users', null, campo, null, null, 'Senha nunca entra no banco (01; cuidado adicional de 12/10)', `${n} ocorrência(s) retirada(s); valor não registrado${origemRetirada}`);
  for (const k of descartadas) oc('REMOVIDO_SENSIVEL', k, null, null, null, null, 'Sessão do navegador não é migrada', `chave inteira descartada${origemRetirada}`);
  const dadosSemSenha = { ...dados, pm2_users: usuarios };
  delete dadosSemSenha.pm2_auth_session;
  const segredos = camposSegredo(dadosSemSenha, '$', []);
  if (segredos.length) recusar(`Campo com nome de segredo fora do previsto: ${segredos.join(', ')}. Revisar antes de migrar (G2).`);

  // ---- G3: duplicidades ----
  const dup = (arr, f, nome) => { const vis = new Set(); for (const x of arr) { const k = f(x); if (k === undefined || k === null || k === '') continue; if (vis.has(k)) recusar(`Duplicidade na origem: ${nome} "${k}" (G3).`); vis.add(k); } };
  dup(usuarios, (u) => u.id, 'id de usuário');
  dup(usuarios, (u) => String(u.email || '').toLowerCase(), 'e-mail de usuário');
  dup(lista('pm2_monitorings'), (m) => m.id, 'id de monitoria');
  dup(lista('pm2_monitorings'), (m) => m.protocolo, 'protocolo de monitoria');
  dup(lista('pm2_criteria'), (c) => c.id, 'critério');
  dup(lista('pm2_collaborators'), (c) => c.id, 'colaborador');
  dup(lista('pm2_areas'), (a) => a.id, 'área');
  dup(lista('pm2_allocations'), (a) => a.id, 'carteira');
  dup(lista('pm2_alloc_history'), (a) => a.id, 'histórico de carteira');

  // ---- perfis ----
  const PERFIS_VALIDOS = ['ADMIN', 'GESTOR', 'MONITOR'];
  const SPEC_USU = {
    id: { col: 'id', ok: texto }, email: { col: 'email', ok: texto }, name: { col: 'nome', ok: texto },
    perfis: { col: 'perfis', ok: (v) => Array.isArray(v) && v.every((p) => PERFIS_VALIDOS.includes(p)) },
    status: { col: 'status', ok: (v) => ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(v) },
  };
  const idsPerfis = new Set();
  const decPerfis = decisoes.perfis || {};
  usuarios.forEach((u, i) => {
    if (!texto(u.id) || !u.id.trim()) recusar(`pm2_users[${i}]: usuário sem id.`);
    if (!texto(u.email) || !texto(u.name)) recusar(`pm2_users[${i}] (${u.id}): e-mail e nome são obrigatórios.`);
    const { col, extras } = promover(u, SPEC_USU, `pm2_users ${u.id}`);
    if (!('perfis' in col)) recusar(`pm2_users ${u.id}: perfis ausentes ou inválidos — revisar antes de migrar.`);
    if (col.email !== col.email.toLowerCase()) { extras._email_original = col.email; col.email = col.email.toLowerCase(); }
    const d = decPerfis[u.id];
    if (d) {
      for (const [campo, colNome] of [['perfis', 'perfis'], ['status', 'status']]) {
        if (!(campo in d)) continue;
        const antes = u[campo] === undefined ? null : u[campo];
        if (campo in u) extras[`_${campo}_original`] = antes; else (extras._ausentes ||= []).push(campo);
        col[colNome] = d[campo];
        oc('TRANSFORMADO_POR_DECISAO', 'perfis', u.id, campo, antes, d[campo], d.decisao || 'decisão aprovada', d.motivo || null);
      }
      // Troca de e-mail (identidade de login) por decisão. O e-mail original fica em
      // extras._email_original — a reconstrução devolve o original — e o histórico (monitorias,
      // acessos, cadastro de colaborador) não é tocado.
      if ('email' in d) {
        const novo = texto(d.email) ? d.email.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) recusar(`Decisão de e-mail para ${u.id}: endereço inválido.`);
        if (novo === col.email) recusar(`Decisão de e-mail para ${u.id}: o endereço é o mesmo que já está cadastrado.`);
        extras._email_original = u.email;
        col.email = novo;
        oc('TRANSFORMADO_POR_DECISAO', 'perfis', u.id, 'email', u.email, novo, d.decisao || 'decisão aprovada', d.motivo || 'Identidade de login; histórico preservado');
      }
    }
    if (col.perfis.includes('ADMIN')) recusar(`pm2_users ${u.id}: ainda teria ADMIN depois das decisões. Contas ADMIN são pessoais e criadas antes do 09 (R1).`);
    idsPerfis.add(u.id);
    add('perfis', { id: col.id, email: col.email, nome: col.nome, perfis: col.perfis, status: col.status ?? null, extras, ordem: i });
  });
  for (const id of Object.keys(decPerfis)) if (!idsPerfis.has(id)) recusar(`Decisão para o perfil ${id}, que não está na exportação.`);
  // Depois das decisões, cada e-mail continua único — e nenhum perfil assume o endereço antigo de outro.
  const emailsFinais = (linhas.perfis || []).map((p) => p.email);
  const emailsOcupados = new Set([...emailsFinais, ...usuarios.map((u) => String(u.email).toLowerCase())]);
  dup((linhas.perfis || []), (p) => p.email, 'e-mail de perfil (depois das decisões)');
  for (const p of linhas.perfis || []) {
    const outro = usuarios.find((u) => u.id !== p.id && String(u.email).toLowerCase() === p.email);
    if (outro) recusar(`O perfil ${p.id} ficaria com o e-mail original de ${outro.id} — seria a mesma identidade de login.`);
  }
  const apelidos = {};
  (decisoes.novos_perfis || []).forEach((n, j) => {
    if (!n.apelido || !texto(n.email) || !texto(n.nome) || !Array.isArray(n.perfis)) recusar('novos_perfis: apelido, e-mail, nome e perfis são obrigatórios.');
    if (n.perfis.includes('ADMIN')) recusar('novos_perfis: conta ADMIN não é criada pela migração.');
    let id = n.id;
    if (!id) { let t = agora; do { id = `usr-${t++}`; } while (idsPerfis.has(id)); }
    if (idsPerfis.has(id)) recusar(`novos_perfis: o id ${id} já existe (G3: sem reutilizar identificadores).`);
    const email = n.email.toLowerCase();
    if (emailsOcupados.has(email)) recusar(`novos_perfis: o e-mail ${email} já está em uso (cadastro original ou decidido) — seria duplicidade.`);
    emailsOcupados.add(email);
    idsPerfis.add(id); apelidos[n.apelido] = id;
    add('perfis', { id, email, nome: n.nome, perfis: n.perfis, status: 'ACTIVE', extras: { _criado_na_migracao: { decisao: n.decisao || 'decisão aprovada' } }, ordem: usuarios.length + j });
    oc('CRIADO_POR_DECISAO', 'perfis', id, null, null, { email, nome: n.nome, perfis: n.perfis }, n.decisao || 'decisão aprovada', 'Perfil novo; sem senha (acesso por convite no Supabase Auth)');
  });
  const resolver = (r) => (typeof r === 'string' && r.startsWith('@') ? (apelidos[r.slice(1)] || recusar(`Apelido ${r} não definido em novos_perfis.`)) : r);

  // ---- áreas e monitores da área ----
  const SPEC_AREA = { id: { col: 'id', ok: texto }, name: { col: 'nome', ok: texto }, gestorId: { col: 'gestor_id', ok: (v) => idsPerfis.has(v) }, active: { col: 'ativo', ok: logico } };
  const idsAreas = new Set();
  lista('pm2_areas').forEach((a, i) => {
    const sem = { ...a }; delete sem.monitorIds;
    const { col, extras } = promover(sem, SPEC_AREA, `pm2_areas ${a.id}`);
    let monitores = [];
    if ('monitorIds' in a) {
      if (listaTextos(a.monitorIds) && a.monitorIds.every((m) => idsPerfis.has(m)) && new Set(a.monitorIds).size === a.monitorIds.length) monitores = a.monitorIds;
      else extras._monitorIds_original = a.monitorIds;
    }
    const d = (decisoes.areas || {})[a.id];
    if (d) {
      if ('gestor' in d) {
        const novo = resolver(d.gestor);
        if (!idsPerfis.has(novo)) recusar(`Área ${a.id}: supervisor ${novo} inexistente.`);
        if ('gestorId' in a) extras._gestorId_original = a.gestorId; else (extras._ausentes ||= []).push('gestorId');
        col.gestor_id = novo;
        oc('TRANSFORMADO_POR_DECISAO', 'areas', a.id, 'gestorId', 'gestorId' in a ? a.gestorId : null, novo, d.decisao || 'decisão aprovada', null);
      }
      if ('monitores' in d) {
        const novos = d.monitores.map(resolver);
        if (!novos.every((m) => idsPerfis.has(m))) recusar(`Área ${a.id}: monitor inexistente na decisão.`);
        if ('monitorIds' in a) extras._monitorIds_original = a.monitorIds; else (extras._ausentes ||= []).push('monitorIds');
        monitores = novos;
        oc('TRANSFORMADO_POR_DECISAO', 'areas', a.id, 'monitorIds', 'monitorIds' in a ? a.monitorIds : null, novos, d.decisao || 'decisão aprovada', null);
      }
    }
    if (Array.isArray(a.monitorIds) && a.monitorIds.length === 0 && !('_monitorIds_original' in extras)) (extras._listas_vazias ||= []).push('monitorIds');
    idsAreas.add(a.id);
    add('areas', { id: col.id, nome: col.nome, gestor_id: col.gestor_id ?? null, ativo: col.ativo ?? null, extras, ordem: i });
    monitores.forEach((m, j) => add('area_monitores', { area_id: a.id, monitor_id: m, ordem: j }));
  });
  for (const id of Object.keys(decisoes.areas || {})) if (!idsAreas.has(id)) recusar(`Decisão para a área ${id}, que não está na exportação.`);

  // ---- colaboradores, carteiras, histórico ----
  const SPEC_COL = { id: { col: 'id', ok: texto }, name: { col: 'nome', ok: texto }, email: { col: 'email', ok: texto }, cargo: { col: 'cargo', ok: texto },
    areaId: { col: 'area_id', ok: (v) => idsAreas.has(v) }, active: { col: 'ativo', ok: logico } };
  const idsColab = new Set();
  lista('pm2_collaborators').forEach((c, i) => {
    const { col, extras } = promover(c, SPEC_COL, `pm2_collaborators ${c.id}`);
    if (!col.id || !col.nome) recusar(`pm2_collaborators[${i}]: id e nome são obrigatórios.`);
    idsColab.add(col.id);
    add('colaboradores', { id: col.id, nome: col.nome, email: col.email ?? null, cargo: col.cargo ?? null, area_id: col.area_id ?? null, ativo: col.ativo ?? null, extras, ordem: i });
  });
  const SPEC_ALOC = { id: { col: 'id', ok: texto }, monitorId: { col: 'monitor_id', ok: (v) => idsPerfis.has(v) }, colaboradorId: { col: 'colaborador_id', ok: (v) => idsColab.has(v) },
    startDate: { col: 'data_inicio', ok: dataISO }, endDate: { col: 'data_fim', ok: dataISO }, active: { col: 'ativo', ok: logico } };
  const idsAloc = new Set();
  lista('pm2_allocations').forEach((a, i) => {
    const { col, extras } = promover(a, SPEC_ALOC, `pm2_allocations ${a.id}`);
    if (!col.id) recusar(`pm2_allocations[${i}]: sem id.`);
    idsAloc.add(col.id);
    add('alocacoes', { id: col.id, monitor_id: col.monitor_id ?? null, colaborador_id: col.colaborador_id ?? null, data_inicio: col.data_inicio ?? null, data_fim: col.data_fim ?? null, ativo: col.ativo ?? null, extras, ordem: i });
  });
  const SPEC_HIST = { id: { col: 'id', ok: texto }, allocationId: { col: 'alocacao_id', ok: (v) => idsAloc.has(v) }, actionType: { col: 'acao', ok: (v) => ['INSERT', 'TERMINATE'].includes(v) },
    changedBy: { col: 'alterado_por', ok: (v) => idsPerfis.has(v) }, changedAt: { col: 'alterado_em', ok: isoMs }, details: { col: 'detalhes', ok: texto } };
  lista('pm2_alloc_history').forEach((h, i) => {
    const { col, extras } = promover(h, SPEC_HIST, `pm2_alloc_history ${h.id}`);
    if (!col.id || !col.acao) recusar(`pm2_alloc_history[${i}]: id e ação válida são obrigatórios.`);
    add('alocacoes_historico', { id: col.id, alocacao_id: col.alocacao_id ?? null, acao: col.acao, alterado_por: col.alterado_por ?? null, alterado_em: col.alterado_em ?? null, detalhes: col.detalhes ?? null, extras, ordem: i });
  });

  // ---- critérios (régua atual = 2.0) ----
  const TIPOS = ['ESCALA_4', 'CHECKLIST_SIM_NAO', 'FAIXA_TEMPO', 'MULTIPLA_ESCOLHA', 'SIM_NAO'];
  const SPEC_CRIT = { id: { col: 'id', ok: texto }, numero: { col: 'numero', ok: Number.isInteger }, category: { col: 'bloco', ok: texto }, name: { col: 'nome', ok: texto },
    description: { col: 'descricao', ok: texto }, orientacao: { col: 'orientacao', ok: texto }, tipoResposta: { col: 'tipo_resposta', ok: (v) => TIPOS.includes(v) },
    eliminatorio: { col: 'eliminatorio', ok: logico }, weight: { col: 'peso', ok: numero }, active: { col: 'ativo', ok: logico }, channels: { col: 'canais', ok: listaTextos },
    opcoes: { col: 'opcoes', ok: listaTextos }, ancoras: { col: 'ancoras', ok: (v) => v && typeof v === 'object' && !Array.isArray(v) }, quandoNA: { col: 'quando_na', ok: texto } };
  const criterios = lista('pm2_criteria');
  criterios.forEach((c, i) => {
    const sem = { ...c }; delete sem.subPerguntas;
    const { col, extras } = promover(sem, SPEC_CRIT, `pm2_criteria ${c.id}`);
    if (!col.id || !col.nome) recusar(`pm2_criteria[${i}]: id e nome são obrigatórios.`);
    if ('subPerguntas' in c) {
      if (!Array.isArray(c.subPerguntas)) extras._subPerguntas_original = c.subPerguntas;
      else if (c.subPerguntas.length === 0) (extras._listas_vazias ||= []).push('subPerguntas');
      else {
        dup(c.subPerguntas, (s) => s?.id, `sub-pergunta de ${c.id}`);
        c.subPerguntas.forEach((s, j) => {
          if (!s || !texto(s.id)) recusar(`pm2_criteria ${c.id}: sub-pergunta sem id.`);
          const ex = { ...s }; for (const k of ['id', 'texto', 'criterioSim', 'criterioNao']) delete ex[k];
          add('criterio_subperguntas', { criterio_id: c.id, id: s.id, texto: s.texto ?? null, criterio_sim: s.criterioSim ?? null, criterio_nao: s.criterioNao ?? null, ordem: j, extras: ex });
        });
      }
    }
    add('criterios', { id: col.id, numero: col.numero ?? null, bloco: col.bloco ?? null, nome: col.nome, descricao: col.descricao ?? null, orientacao: col.orientacao ?? null,
      tipo_resposta: col.tipo_resposta ?? null, eliminatorio: col.eliminatorio ?? null, peso: col.peso ?? null, ativo: col.ativo ?? null, canais: col.canais ?? null,
      opcoes: col.opcoes ?? null, ancoras: col.ancoras ?? null, quando_na: col.quando_na ?? null, extras, ordem: i });
  });
  // G6: régua 2.0 (critérios atuais) × código
  const difCodigo = [];
  if (reguaCodigo) {
    const A = reguaCodigo.criterios, B = criterios;
    for (const id of new Set([...A, ...B].map((c) => c.id))) {
      const x = A.find((c) => c.id === id), y = B.find((c) => c.id === id);
      if (!x || !y) { difCodigo.push(`${id}${x ? ' (ausente no navegador)' : ' (só no navegador)'}`); continue; }
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (canonico(x[k]) !== canonico(y[k])) difCodigo.push(`${id}.${k}`);
    }
    const aprovadas = new Set(decisoes.regua2?.diferencas_aprovadas || []);
    const pendentes = difCodigo.filter((d) => !aprovadas.has(d));
    if (pendentes.length) recusar(`Régua 2.0: critérios do navegador diferem do código em ${pendentes.join(', ')}. Validar cada diferença e listá-la em regua2.diferencas_aprovadas (G6) — nada é ajustado automaticamente.`);
  }

  // ---- monitorias ----
  const STATUS = ['Rascunho', 'Pendente', 'Concluída', 'Validada', 'Reprovada', 'Cancelada', 'Aprovada', 'Aguardando Aprovação'];
  const refPerfil = (v) => idsPerfis.has(v);
  const SPEC_MON = {
    id: { col: 'id', ok: texto }, protocolo: { col: 'protocolo', ok: texto }, competencia: { col: 'competencia', ok: (v) => texto(v) && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) },
    date: { col: 'data', ok: texto }, monitorId: { col: 'monitor_id', ok: refPerfil }, colaboradorId: { col: 'colaborador_id', ok: (v) => idsColab.has(v) },
    gestorId: { col: 'gestor_id', ok: refPerfil }, canal: { col: 'canal', ok: texto }, tipo: { col: 'tipo', ok: texto }, status: { col: 'status', ok: (v) => STATUS.includes(v) },
    finalScore: { col: 'nota', ok: numero }, numeroAtendimento: { col: 'numero_atendimento', ok: texto }, numeroTitulo: { col: 'numero_titulo', ok: texto },
    categoriaAtendimento: { col: 'categoria_atendimento', ok: texto }, empreendimento: { col: 'empreendimento', ok: texto }, tempo: { col: 'tempo', ok: texto },
    inicioAtendimento: { col: 'inicio_atendimento', ok: texto }, fimAtendimento: { col: 'fim_atendimento', ok: texto }, duracaoMinutos: { col: 'duracao_minutos', ok: numero },
    comments: { col: 'comentarios', ok: texto }, strengths: { col: 'pontos_fortes', ok: texto }, opportunities: { col: 'oportunidades', ok: texto },
    contexto: { col: 'contexto', ok: texto }, leituraTecnica: { col: 'leitura_tecnica', ok: texto }, errosIdentificados: { col: 'erros_identificados', ok: texto },
    conclusao: { col: 'conclusao', ok: texto }, evidenciaObservacoes: { col: 'evidencia_observacoes', ok: texto },
    eliminatoryPending: { col: 'eliminatorio_pendente', ok: logico }, zerada: { col: 'zerada', ok: logico },
    eliminatoryConfirmedBy: { col: 'eliminatorio_confirmado_por', ok: refPerfil }, eliminatoryConfirmedAt: { col: 'eliminatorio_confirmado_em', ok: isoMs },
    approvedBy: { col: 'aprovado_por', ok: refPerfil }, approvedAt: { col: 'aprovado_em', ok: isoMs }, reviewedBy: { col: 'revisado_por', ok: refPerfil },
    reviewedAt: { col: 'revisado_em', ok: isoMs }, adjustmentReason: { col: 'motivo_ajuste', ok: texto },
  };
  const SPEC_RESP = { criterionId: { col: 'criterio_id', ok: texto }, score: { col: 'resposta', ok: () => true }, lowScoreReason: { col: 'justificativa', ok: texto }, subRespostas: { col: 'sub_respostas', ok: () => true } };
  const monitorias = lista('pm2_monitorings');
  const resumoMon = [];
  monitorias.forEach((m, i) => {
    if (!m || !texto(m.id) || !m.id.trim()) recusar(`pm2_monitorings[${i}]: monitoria sem id.`);
    const sem = { ...m }; for (const k of ['scores', 'evidencias', 'links', 'lancamentoRetroativo']) delete sem[k];
    const { col, extras } = promover(sem, SPEC_MON, `pm2_monitorings ${m.id}`);
    const vazias = ['scores', 'evidencias', 'links'].filter((k) => Array.isArray(m[k]) && m[k].length === 0);
    if (vazias.length) extras._listas_vazias = vazias;
    for (const k of ['scores', 'evidencias', 'links']) if (k in m && !Array.isArray(m[k])) extras[`_${k}_original`] = m[k];
    let retro = { retroativo: false, retroativo_por: null, retroativo_em: null };
    if ('lancamentoRetroativo' in m) {
      const v = m.lancamentoRetroativo;
      if (v && typeof v === 'object' && Object.keys(v).sort().join() === 'em,por' && refPerfil(v.por) && isoMs(v.em)) retro = { retroativo: true, retroativo_por: v.por, retroativo_em: v.em };
      else extras._lancamentoRetroativo_original = v;
    }
    // E3 × E4b × E3m: enviada_na_origem
    const st = m.status;
    if (!STATUS.includes(st)) recusar(`Monitoria ${m.id}: situação "${st}" desconhecida — decidir enviada_na_origem antes de migrar.`);
    const tracosRevisao = ['reviewedBy', 'reviewedAt', 'approvedBy', 'approvedAt', 'adjustmentReason', 'eliminatoryConfirmedBy'].some((k) => m[k] !== undefined && m[k] !== null && m[k] !== '');
    const enviada = st !== 'Rascunho' || tracosRevisao;
    const notaHistorica = enviada && numero(m.finalScore) ? m.finalScore : null;
    add('monitorias', { ...Object.fromEntries(Object.values(SPEC_MON).map((s) => [s.col, col[s.col] ?? null])), ...retro,
      registrado_por: retro.retroativo ? retro.retroativo_por : null, extras, ordem: i,
      origem: 'migracao', enviada_na_origem: enviada, nota_historica: notaHistorica });
    if (notaHistorica !== null) oc('TRANSFORMADO_POR_DECISAO', 'monitorias', m.id, 'nota_historica', null, notaHistorica, 'Decisão 6 (12/10): nota original preservada em nota_historica já na migração', 'nota original mantida também em nota; nada recalculado');
    resumoMon.push({ id: m.id, status: st, enviada_na_origem: enviada, motivo: st !== 'Rascunho' ? `situação ${st}` : (tracosRevisao ? 'rascunho com traços de revisão no portal antigo' : 'rascunho nunca submetido'), nota: m.finalScore ?? null, nota_historica: notaHistorica });
    if (Array.isArray(m.scores)) {
      dup(m.scores, (s) => s?.criterionId, `critério respondido na monitoria ${m.id}`);
      m.scores.forEach((s, j) => {
        if (!s || !texto(s.criterionId)) recusar(`Monitoria ${m.id}: resposta sem critério.`);
        const { col: rc, extras: rex } = promover(s, SPEC_RESP, `resposta ${m.id}/${s.criterionId}`);
        add('monitoria_respostas', { monitoria_id: m.id, criterio_id: rc.criterio_id, resposta: 'resposta' in rc ? rc.resposta : null, justificativa: rc.justificativa ?? null,
          sub_respostas: 'sub_respostas' in rc ? rc.sub_respostas : null, ordem: j, extras: rex });
      });
    }
    for (const l of ['evidencias', 'links']) if (Array.isArray(m[l])) m[l].forEach((c, j) => { if (c === null || c === undefined) recusar(`Monitoria ${m.id}: item vazio em ${l}.`); add('monitoria_evidencias', { monitoria_id: m.id, lista: l, ordem: j, conteudo: c }); });
  });
  const idsMon = new Set(monitorias.map((m) => m.id));

  // ---- documentos, catálogos, configurações, acessos ----
  for (const [k, destino] of Object.entries(CHAVES)) {
    if (!(k in dados)) continue;
    if (destino.startsWith('doc:')) {
      const colecao = destino.slice(4), vis = new Set();
      lista(k).forEach((it, i) => {
        if (!it || typeof it !== 'object' || Array.isArray(it)) recusar(`${k}[${i}]: item que não é objeto.`);
        const temId = texto(it.id) && it.id.trim() !== '' && !vis.has(it.id); if (temId) vis.add(it.id);
        add('documentos', { colecao, id: temId ? it.id : `#${i}`, conteudo: it, ordem: i });
      });
    } else if (destino.startsWith('cat:')) {
      lista(k).forEach((v, i) => { if (!texto(v)) recusar(`${k}[${i}]: valor que não é texto.`); add('catalogos', { catalogo: destino.slice(4), ordem: i, valor: v }); });
    } else if (destino.startsWith('cfg:')) {
      if (dados[k] === null) recusar(`${k}: configuração nula.`);
      add('configuracoes', { chave: destino.slice(4), valor: dados[k] });
    }
  }
  const SPEC_LOG = { id: { col: 'id', ok: texto }, eventType: { col: 'tipo_evento', ok: texto }, userEmail: { col: 'usuario_email', ok: texto }, userName: { col: 'usuario_nome', ok: texto },
    userRole: { col: 'usuario_perfil', ok: texto }, actionDetails: { col: 'detalhes', ok: texto }, timestamp: { col: 'momento', ok: isoMs } };
  lista('pm2_auth_logs').forEach((l, i) => {
    const { col, extras } = promover(l, SPEC_LOG, `pm2_auth_logs[${i}]`);
    add('acessos_log', { id: col.id ?? null, tipo_evento: col.tipo_evento ?? null, usuario_email: col.usuario_email ?? null, usuario_nome: col.usuario_nome ?? null,
      usuario_perfil: col.usuario_perfil ?? null, detalhes: col.detalhes ?? null, momento: col.momento ?? null, extras, ordem: i });
  });

  // ---- G4: reconstrução sem perda (a partir só das linhas que vão ao banco) ----
  const L = (t) => linhas[t] || [];
  const recon = {};
  recon.pm2_users = L('perfis').filter((p) => !p.extras._criado_na_migracao).map((p) => {
    const e = { ...p.extras }; delete e._email_original;
    const o = reconstruir({ id: p.id, email: p.extras._email_original ?? p.email, nome: p.nome, perfis: p.perfis, status: p.status }, e, SPEC_USU);
    return o;
  });
  recon.pm2_areas = L('areas').map((a) => {
    const o = reconstruir(a, a.extras, SPEC_AREA);
    if (!('_monitorIds_original' in a.extras) && !(a.extras._ausentes || []).includes('monitorIds')) { const ms = L('area_monitores').filter((x) => x.area_id === a.id).map((x) => x.monitor_id); if (ms.length) o.monitorIds = ms; }
    return o;
  });
  recon.pm2_collaborators = L('colaboradores').map((c) => reconstruir(c, c.extras, SPEC_COL));
  recon.pm2_allocations = L('alocacoes').map((a) => reconstruir(a, a.extras, SPEC_ALOC));
  recon.pm2_alloc_history = L('alocacoes_historico').map((h) => reconstruir(h, h.extras, SPEC_HIST));
  recon.pm2_criteria = L('criterios').map((c) => {
    const o = reconstruir(c, c.extras, SPEC_CRIT);
    const subs = L('criterio_subperguntas').filter((s) => s.criterio_id === c.id);
    if (subs.length)
      o.subPerguntas = subs.map((s) => ({ ...Object.fromEntries([['id', s.id], ['texto', s.texto], ['criterioSim', s.criterio_sim], ['criterioNao', s.criterio_nao]].filter(([, v]) => v !== null)), ...s.extras }));
    return o;
  });
  recon.pm2_monitorings = L('monitorias').map((m) => {
    const o = reconstruir(m, m.extras, SPEC_MON);
    if (m.retroativo) o.lancamentoRetroativo = { por: m.retroativo_por, em: m.retroativo_em };
    const vaz = m.extras._listas_vazias || [];
    const sc = L('monitoria_respostas').filter((r) => r.monitoria_id === m.id).map((r) => reconstruir(r, r.extras, SPEC_RESP));
    // resposta/sub_respostas ausentes x nulas: reconstruir() já trata nulo explícito; ausente fica fora
    if (sc.length || vaz.includes('scores')) o.scores = sc;
    for (const l of ['evidencias', 'links']) { const it = L('monitoria_evidencias').filter((x) => x.monitoria_id === m.id && x.lista === l).map((x) => x.conteudo); if (it.length || vaz.includes(l)) o[l] = it; }
    return o;
  });
  for (const [k, destino] of Object.entries(CHAVES)) {
    if (!(k in dados)) continue;
    if (destino.startsWith('doc:')) recon[k] = L('documentos').filter((d) => d.colecao === destino.slice(4)).map((d) => d.conteudo);
    if (destino.startsWith('cat:')) recon[k] = L('catalogos').filter((d) => d.catalogo === destino.slice(4)).map((d) => d.valor);
    if (destino.startsWith('cfg:')) recon[k] = L('configuracoes').find((d) => d.chave === destino.slice(4)).valor;
  }
  recon.pm2_auth_logs = L('acessos_log').map((l) => reconstruir(l, l.extras, SPEC_LOG));
  const reconstrucao = {};
  for (const [k, v] of Object.entries(recon)) {
    if (!(k in dados)) { if (Array.isArray(v) && v.length === 0) continue; recusar(`Reconstrução: ${k} não existe na origem.`); }
    const orig = k === 'pm2_users' ? usuarios : dados[k];
    // resposta ausente é diferente de resposta nula: comparar pelo canônico
    const igual = canonico(v) === canonico(orig);
    if (!igual) recusar(`Reconstrução de ${k} difere do original (G4). Nada foi gerado.`);
    reconstrucao[k] = 'idêntico ao original' + (k === 'pm2_users' ? ' (sem os campos de senha)' : '');
  }

  // ---- G2 (valores): nenhuma senha retirada aparece no que vai ao banco ----
  const origem = Object.keys(textos).filter((k) => CHAVES[k] !== 'descartar').map((k, i) => {
    const t = k === 'pm2_users' ? JSON.stringify(usuarios) : textos[k];
    return { chave: k, texto: t, sha256: sha256(t), redacoes: k === 'pm2_users' ? Object.entries(contagemRetirada).map(([campo, n]) => ({ campo, ocorrencias: n })) : [], ordem: i };
  });
  for (const k of Object.keys(textos)) if (CHAVES[k] === 'evidencia') oc('EVIDENCIA', k, null, null, null, null, 'Marca de versão / cópia do navegador guardada só como prova', 'em app.migracao_origem');

  // ---- régua 1 e evidência de 08/10 ----
  if (!regua1 || !Array.isArray(regua1.criterios) || !regua1.commit || !regua1.sha256) recusar('Régua 1: informar o arquivo extraído do git (extrair-regua.mjs).');
  if (sha256(JSON.stringify(regua1.criterios)) !== regua1.sha256) recusar('Régua 1: impressão digital do arquivo não confere.');
  const r1 = decisoes.regua1 || {};
  if (!dataISO(r1.vigente_desde)) recusar('Régua 1: vigente_desde (AAAA-MM-DD) ainda não decidida.');
  // Datas da Régua 1, cada uma com a sua situação: comprovada ou não (decisão de 12/10).
  const datas = r1.datas;
  if (!datas || !datas.commit_codigo || !datas.publicacao_producao || !['comprovada', 'nao_comprovada'].includes(datas.publicacao_producao.situacao))
    recusar('Régua 1: informar datas.commit_codigo e datas.publicacao_producao.situacao (comprovada | nao_comprovada).');
  // Retrato anterior à alteração do crit-24 (07/10/2026): evidência histórica, não vira versão.
  const difRegua1 = [];
  if (r1.anterior && !regua1Anterior) recusar('Régua 1: o retrato anterior foi indicado mas não carregado.');
  if (regua1Anterior) {
    if (!Array.isArray(regua1Anterior.criterios) || sha256(JSON.stringify(regua1Anterior.criterios)) !== regua1Anterior.sha256) recusar('Régua 1 anterior: impressão digital do arquivo não confere.');
    const A = regua1Anterior.criterios, B = regua1.criterios;
    for (const id of new Set([...A, ...B].map((c) => c.id))) {
      const x = A.find((c) => c.id === id), y = B.find((c) => c.id === id);
      if (!x || !y) { difRegua1.push({ id, campo: null, antes: x ?? null, depois: y ?? null }); continue; }
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (canonico(x[k]) !== canonico(y[k])) difRegua1.push({ id, campo: k, antes: x[k] ?? null, depois: y[k] ?? null });
    }
    const t = JSON.stringify({ revisao: regua1Anterior.revisao, commit: regua1Anterior.commit, data_commit: regua1Anterior.data_commit, sha256: regua1Anterior.sha256, criterios: A });
    origem.push({ chave: 'evidencia:regua-1-anterior', texto: t, sha256: sha256(t), redacoes: [], ordem: origem.length });
    oc('EVIDENCIA', 'evidencia:regua-1-anterior', null, null, null, null, 'Retrato da Régua 1 antes da alteração de 07/10/2026, preservado como evidência histórica (decisão de 12/10); NÃO vira versão de régua',
       `${regua1Anterior.revisao} (commit ${String(regua1Anterior.commit).slice(0, 7)}, ${regua1Anterior.data_commit})`);
    for (const d of difRegua1)
      oc('EVIDENCIA', 'regua-1', d.id, d.campo, d.antes, d.depois, 'Alteração da Régua 1 em 07/10/2026 documentada (decisão de 12/10)',
         `de ${regua1Anterior.revisao} (${String(regua1Anterior.commit).slice(0, 7)}) para ${regua1.revisao} (${String(regua1.commit).slice(0, 7)})`);
  }
  const r2 = decisoes.regua2 || {};
  if (!dataISO(r2.vigente_desde)) recusar('Régua 2.0: vigente_desde (AAAA-MM-DD) é obrigatória.');
  let evidencia = null;
  if (evidencia0810Bruta) {
    const ev = lerExportacao(evidencia0810Bruta);
    if (!Array.isArray(ev.dados.pm2_criteria)) recusar('Evidência de 08/10 sem pm2_criteria.');
    const t = ev.textos.pm2_criteria;
    evidencia = { chave: 'evidencia:pm2_criteria', texto: t, sha256: sha256(t), redacoes: [], ordem: origem.length, exportado_em: ev.meta.exportadoEm ?? null };
    origem.push(evidencia);
    oc('EVIDENCIA', 'evidencia:pm2_criteria', null, null, null, null, 'Cadastro de critérios do navegador em 08/10 (crit-06 com peso 100), guardado como prova; NÃO vira versão de régua', `exportado em ${ev.meta.exportadoEm ?? '?'}`);
  }

  // ---- manifesto e SQL ----
  const contagens = Object.fromEntries(Object.entries(linhas).map(([t, ls]) => [t, ls.length]));
  const conteudoSha = sha256(canonico({ origem: origem.map((o) => [o.chave, o.sha256]), linhas }));
  const loteId = `mig-${conteudoSha.slice(0, 12)}`;
  const seqOcorrencias = ocorrencias.map((o, i) => ({ ...o, seq: i + 1 }));
  const manifesto = {
    gerador: GERADOR_VERSAO, lote: loteId, conteudo_sha256: conteudoSha,
    exportacao: { exportado_em: meta.exportadoEm ?? null, origem: meta.origem ?? null, versao_banco: meta.versaoBanco ?? null, chaves: Object.keys(textos).length },
    responsavel: { modo: modoAdmin ? 'admin' : 'implantacao', declarado: responsavel },
    contagens, chaves_origem: origem.map((o) => ({ chave: o.chave, sha256: o.sha256, redacoes: o.redacoes })),
    removidos: { campos_senha: Object.entries(contagemRetirada).map(([campo, n]) => ({ campo, ocorrencias: n })), chaves_descartadas: descartadas,
      // a impressão digital do ORIGINAL (que contém senhas) não vai ao banco: fica só no manifesto local
      sanitizacao: sanitizacao ? { ferramenta: sanitizacao.ferramenta ?? null, em: sanitizacao.em ?? null } : null },
    novos_perfis: Object.fromEntries(Object.entries(apelidos)),
    monitorias: resumoMon, reconstrucao,
    regua1: { id: 'regua-1', rotulo: r1.rotulo || 'Régua 1', vigente_desde: r1.vigente_desde, commit: regua1.commit, revisao: regua1.revisao, sha256: regua1.sha256, criterios: regua1.criterios.length,
              datas, anterior: regua1Anterior ? { revisao: regua1Anterior.revisao, commit: regua1Anterior.commit, sha256: regua1Anterior.sha256, alteracoes: difRegua1.map((d) => `${d.id}${d.campo ? '.' + d.campo : ''}`) } : null },
    regua2: { id: 'regua-2.0', rotulo: r2.rotulo || 'Régua 2.0', vigente_desde: r2.vigente_desde, fonte: 'critérios atuais do navegador (pm2_criteria)', diferencas_codigo: difCodigo, diferencas_aprovadas: r2.diferencas_aprovadas || [] },
    ocorrencias_por_classe: seqOcorrencias.reduce((a, o) => ({ ...a, [o.classe]: (a[o.classe] || 0) + 1 }), {}),
    ocorrencias_do_gerador: seqOcorrencias.length,
  };
  const sql = montarSQL({ loteId, conteudoSha, meta, decisoes, manifesto, origem, linhas, ocorrencias: seqOcorrencias, regua1, r1, r2, evidencia });

  // G2 final: nenhum valor de senha no SQL nem no manifesto
  for (const s of senhasRetiradas) if (sql.includes(s) || JSON.stringify(manifesto).includes(s)) recusar('Um valor de senha retirado aparece em outro campo da exportação (ex.: observações). Revisar a origem antes de migrar (G2).');
  if (/"(password|confirmPassword)"\s*:/i.test(sql)) recusar('Campo de senha no SQL gerado (G2).');
  return { sql, manifesto, linhas, ocorrencias: seqOcorrencias, idsMon };
};

// ---- montagem do SQL -------------------------------------------------------------------
const CHAVES_TABELA = {
  perfis: ['id'], areas: ['id'], area_monitores: ['area_id', 'monitor_id'], colaboradores: ['id'], alocacoes: ['id'], alocacoes_historico: ['id'],
  criterios: ['id'], criterio_subperguntas: ['criterio_id', 'id'], monitorias: ['id'], monitoria_respostas: ['monitoria_id', 'criterio_id'],
  monitoria_evidencias: ['monitoria_id', 'lista', 'ordem'], documentos: ['colecao', 'id'], catalogos: ['catalogo', 'ordem'], configuracoes: ['chave'], acessos_log: ['ordem'],
};
const ORDEM_CARGA = ['perfis', 'areas', 'area_monitores', 'colaboradores', 'alocacoes', 'alocacoes_historico', 'criterios', 'criterio_subperguntas',
  'REGUAS', 'monitorias', 'monitoria_respostas', 'monitoria_evidencias', 'documentos', 'catalogos', 'configuracoes', 'acessos_log'];
const INTEIRAS = new Set(['ordem']);

const montarSQL = ({ loteId, conteudoSha, meta, decisoes, manifesto, origem, linhas, ocorrencias, regua1, r1, r2, evidencia }) => {
  const corpo = JSON.stringify({ origem, linhas, ocorrencias, regua1: regua1.criterios });
  let tag; do { tag = `$m09_${randomBytes(4).toString('hex')}$`; } while (corpo.includes(tag));
  const lit = (v) => `${tag}${typeof v === 'string' ? v : JSON.stringify(v)}${tag}`;
  const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
  const tabelaLinhas = [];
  for (const [t, ls] of Object.entries(linhas)) ls.forEach((l, i) => tabelaLinhas.push({ tabela: t, linha: l, n: i }));

  const carga = (t) => {
    const cols = [...new Set((linhas[t] || []).flatMap((l) => Object.keys(l)))];
    if (!cols.length) return `-- ${t}: nada a migrar`;
    return `insert into public.${t} (${cols.join(', ')})
select ${cols.map((c) => `r.${c}`).join(', ')}
  from pg_temp._mig09 m, jsonb_populate_record(null::public.${t}, m.linha) r
 where m.tabela = '${t}' order by m.n;`;
  };
  const confere = (t) => {
    const ch = CHAVES_TABELA[t];
    const on = ch.map((c) => (INTEIRAS.has(c) ? `x.${c} = (m.linha ->> '${c}')::integer` : `x.${c} = m.linha ->> '${c}'`)).join(' and ');
    const filtroLog = t === 'acessos_log' ? ' and x.perfil_id is null' : '';
    return `    select count(*) into v_n from pg_temp._mig09 m left join public.${t} x on ${on}${filtroLog}
     where m.tabela = '${t}' and (x is null or not app.migracao_linha_confere(m.linha, to_jsonb(x)));
    if v_n > 0 then raise exception 'MIGRAÇÃO INTERROMPIDA: % linha(s) de ${t} diferente(s) do esperado.', v_n using errcode = 'MI422'; end if;`;
  };

  return `-- =============================================================================
-- MonitorIA · Banco compartilhado · E1 · Script 09b — MIGRAÇÃO DOS DADOS (gerado)
-- =============================================================================
-- GERADO por ${GERADOR_VERSAO}. NÃO EDITAR À MÃO: gere de novo a partir da exportação.
-- Lote: ${loteId}   conteúdo: ${conteudoSha}
-- Exportação: ${meta.exportadoEm ?? '?'} (${meta.origem ?? '?'})
--
-- ONDE RODAR: somente na HOMOLOGAÇÃO, pelo SQL Editor, depois do 08 e do 09a, e SÓ
-- com a conta ADMIN pessoal já criada (declarada abaixo em app.responsavel).
-- UMA TRANSAÇÃO: se qualquer pré-condição ou conferência falhar, NADA é gravado.
-- NÃO CONTÉM senha, sessão nem token (retirados pelo gerador; ver manifesto).
-- Nada é recalculado: notas, respostas e datas entram como estão no navegador.
-- =============================================================================

begin;

set local app.responsavel = ${q(manifesto.responsavel.declarado)};

-- 1. Pré-condições -------------------------------------------------------------------
do $pre$
declare
  v_resp text := current_setting('app.responsavel', true);
begin
  if not exists (select 1 from app.versoes_esquema where versao = '08') or not exists (select 1 from app.versoes_esquema where versao = '09a') then
    raise exception 'MIGRAÇÃO RECUSADA: scripts 08 e 09a precisam estar aplicados.' using errcode = 'MI403';
  end if;
${manifesto.responsavel.modo === 'admin' ? `  if not exists (select 1 from public.perfis p where p.id = v_resp and 'ADMIN' = any (p.perfis) and coalesce(p.status, 'ACTIVE') = 'ACTIVE') then
    raise exception 'MIGRAÇÃO RECUSADA: o responsável declarado (%) não é uma conta ADMIN ativa.', v_resp using errcode = 'MI401';
  end if;` : `  -- Modo implantação: só enquanto NÃO existe nenhum perfil ADMIN (mesma regra do 06, R5).
  if exists (select 1 from public.perfis p where 'ADMIN' = any (p.perfis)) then
    raise exception 'MIGRAÇÃO RECUSADA: já existe perfil ADMIN — declare o id dele (responsavel_admin_id) em vez do nome.' using errcode = 'MI401';
  end if;
  if v_resp is null or length(v_resp) < 10 then
    raise exception 'MIGRAÇÃO RECUSADA: declare nome e e-mail de quem executa.' using errcode = 'MI401';
  end if;`}
  if exists (select 1 from app.migracao_lotes) then
    raise exception 'MIGRAÇÃO RECUSADA: já existe migração aplicada (%). Não se aplica outra por cima.', (select string_agg(id, ', ') from app.migracao_lotes) using errcode = 'MI409';
  end if;
  if exists (select 1 from public.perfis p where not ('ADMIN' = any (p.perfis))) then
    raise exception 'MIGRAÇÃO RECUSADA: já há perfis além das contas ADMIN.' using errcode = 'MI409';
  end if;
  if (select count(*) from public.areas) + (select count(*) from public.colaboradores) + (select count(*) from public.alocacoes)
     + (select count(*) from public.criterios) + (select count(*) from public.regua_versoes) + (select count(*) from public.monitorias)
     + (select count(*) from public.documentos) + (select count(*) from public.catalogos) + (select count(*) from public.configuracoes)
     + (select count(*) from public.acessos_log) > 0 then
    raise exception 'MIGRAÇÃO RECUSADA: as tabelas de destino já têm dados.' using errcode = 'MI409';
  end if;
  if exists (select 1 from public.perfis p where p.id in (${[...(linhas.perfis || [])].map((l) => q(l.id)).join(', ') || "''"})
             or p.email in (${[...(linhas.perfis || [])].map((l) => q(l.email)).join(', ') || "''"})) then
    raise exception 'MIGRAÇÃO RECUSADA: id ou e-mail migrado coincide com uma conta ADMIN existente (contas separadas).' using errcode = 'MI409';
  end if;
end;
$pre$;

-- 2. Linhas preparadas pelo gerador (só nesta transação) ------------------------------------
create temp table _mig09 (tabela text not null, linha jsonb not null, n integer not null) on commit drop;
insert into pg_temp._mig09 (tabela, linha, n)
select x ->> 'tabela', x -> 'linha', (x ->> 'n')::integer
  from jsonb_array_elements(${lit(tabelaLinhas)}::jsonb) x;

-- 3. Lote e origem ---------------------------------------------------------------------
insert into app.migracao_lotes (id, conteudo_sha256, exportado_em, exportado_de, versao_banco_navegador, gerador_versao, manifesto, responsavel)
values (${q(loteId)}, ${q(conteudoSha)}, ${q(meta.exportadoEm ?? null)}, ${q(meta.origem ?? null)}, ${q(meta.versaoBanco ?? null)}, ${q(GERADOR_VERSAO)},
        ${lit(manifesto)}::jsonb, current_setting('app.responsavel'));

insert into app.migracao_origem (lote_id, chave, texto, sha256, redacoes, ordem)
select ${q(loteId)}, o ->> 'chave', o ->> 'texto', o ->> 'sha256', o -> 'redacoes', (o ->> 'ordem')::integer
  from jsonb_array_elements(${lit(origem.map(({ chave, texto, sha256: s, redacoes, ordem }) => ({ chave, texto, sha256: s, redacoes, ordem })))}::jsonb) o;

-- 4. Carga (ordem das referências) ----------------------------------------------------------
${ORDEM_CARGA.map((t) => (t === 'REGUAS' ? `-- Régua 1 oficial (${regua1.revisao}, commit ${regua1.commit.slice(0, 7)}) e Régua 2.0 (critérios atuais)
insert into public.regua_versoes (id, rotulo, vigente_desde, descricao, retrato, extras)
values ('regua-1', ${q(r1.rotulo || 'Régua 1')}, ${q(r1.vigente_desde)}, ${q(r1.descricao || 'Régua 1 oficial')},
        ${lit(regua1.criterios)}::jsonb,
        jsonb_build_object('fonte', 'semente do código', 'revisao', ${q(regua1.revisao)}, 'commit', ${q(regua1.commit)}, 'sha256', ${q(regua1.sha256)}, 'lote', ${q(loteId)},
                           'datas', ${lit(manifesto.regua1.datas)}::jsonb, 'anterior', ${lit(manifesto.regua1.anterior)}::jsonb));
insert into public.regua_versoes (id, rotulo, vigente_desde, descricao, retrato, extras)
values ('regua-2.0', ${q(r2.rotulo || 'Régua 2.0')}, ${q(r2.vigente_desde)}, ${q(r2.descricao || 'Régua 2.0')},
        app.retrato_regua_atual(),
        jsonb_build_object('fonte', 'critérios atuais do navegador migrados neste lote', 'lote', ${q(loteId)}));` : carga(t))).join('\n\n')}

-- 5. Ocorrências --------------------------------------------------------------------------
insert into app.migracao_ocorrencias (lote_id, seq, classe, entidade, chave, campo, antes, depois, decisao, detalhe)
select ${q(loteId)}, (o ->> 'seq')::integer, o ->> 'classe', o ->> 'entidade', o ->> 'chave', o ->> 'campo',
       nullif(o -> 'antes', 'null'::jsonb), nullif(o -> 'depois', 'null'::jsonb), o ->> 'decisao', o ->> 'detalhe'
  from jsonb_array_elements(${lit(ocorrencias)}::jsonb) o;

-- Divergências documentadas, SEM correção: nota original × Régua 1 oficial${evidencia ? ' × cadastro de 08/10' : ''},
-- e sub-respostas que não existem na Régua 1 (ex.: sub-24-3).
insert into app.migracao_ocorrencias (lote_id, seq, classe, entidade, chave, campo, antes, depois, decisao, detalhe)
select ${q(loteId)}, ${ocorrencias.length} + row_number() over (order by d.id)::integer, 'DIVERGENCIA_REGISTRADA', 'monitorias', d.id, 'nota',
       to_jsonb(d.nota), jsonb_build_object('regua_1', d.nota_r1${evidencia ? ", 'cadastro_0810', d.nota_ev" : ''}),
       'Decisão 6 (12/10): preservar a nota original; correção só por devolução e reenvio',
       format('Nota original %s; pela Régua 1 oficial %s${evidencia ? '; pelo cadastro de 08/10 %s' : ''}. Nada foi recalculado.', d.nota, d.nota_r1${evidencia ? ', d.nota_ev' : ''})
  from (select m.id, m.nota,
               app.calcular_nota((select retrato from public.regua_versoes where id = 'regua-1'), m.canal, s.scores) nota_r1${evidencia ? `,
               app.calcular_nota((select texto::jsonb from app.migracao_origem where lote_id = ${q(loteId)} and chave = 'evidencia:pm2_criteria'), m.canal, s.scores) nota_ev` : ''}
          from public.monitorias m
          cross join lateral (select coalesce(jsonb_agg(jsonb_build_object('criterionId', r.criterio_id, 'score', r.resposta)), '[]'::jsonb) scores
                                from public.monitoria_respostas r where r.monitoria_id = m.id) s
         where m.origem = 'migracao' and m.enviada_na_origem and m.nota is not null) d
 where abs(d.nota - d.nota_r1) > 0.01;

insert into app.migracao_ocorrencias (lote_id, seq, classe, entidade, chave, campo, antes, depois, decisao, detalhe)
select ${q(loteId)}, (select coalesce(max(seq), 0) from app.migracao_ocorrencias where lote_id = ${q(loteId)}) + row_number() over (order by r.monitoria_id, r.criterio_id, k)::integer,
       'DIVERGENCIA_REGISTRADA', 'monitoria_respostas', r.monitoria_id || '/' || r.criterio_id, 'subRespostas.' || k,
       r.sub_respostas -> k, null, 'E2 (12/10): no reenvio, só as sub-perguntas da versão da régua', 'Sub-resposta que não existe na Régua 1 oficial; mantida como está. No reenvio, o portal precisa retirá-la.'
  from public.monitoria_respostas r
  join public.monitorias m on m.id = r.monitoria_id and m.origem = 'migracao' and m.enviada_na_origem
  cross join lateral jsonb_object_keys(case when jsonb_typeof(r.sub_respostas) = 'object' then r.sub_respostas else '{}'::jsonb end) k
 where not exists (select 1 from jsonb_array_elements((select retrato from public.regua_versoes where id = 'regua-1')) c,
                                 jsonb_array_elements(coalesce(c -> 'subPerguntas', '[]'::jsonb)) sp
                    where c ->> 'id' = r.criterio_id and sp ->> 'id' = k);

-- 6. Conferência dentro da transação (falhou = nada gravado) --------------------------------
do $conf$
declare
  v_n integer;
begin
${Object.keys(CHAVES_TABELA).filter((t) => linhas[t]?.length).map(confere).join('\n')}
${Object.keys(CHAVES_TABELA).filter((t) => linhas[t]?.length).map((t) => `    if (select count(*) from public.${t}${t === 'perfis' ? " where not ('ADMIN' = any (perfis))" : ''}) <> ${linhas[t].length} then raise exception 'MIGRAÇÃO INTERROMPIDA: contagem de ${t} diferente do manifesto (${linhas[t].length}).' using errcode = 'MI422'; end if;`).join('\n')}
    if (select digital_json from (select app.digital_json(retrato) digital_json from public.regua_versoes where id = 'regua-1') x)
       <> app.digital_json(${lit(regua1.criterios)}::jsonb) then
      raise exception 'MIGRAÇÃO INTERROMPIDA: retrato da Régua 1 difere do arquivo extraído do git.' using errcode = 'MI422';
    end if;
    if exists (select 1 from public.perfis where extras::text ~* '"(password|confirmPassword|senha)"') then
      raise exception 'MIGRAÇÃO INTERROMPIDA: campo de senha em perfis.' using errcode = 'MI422';
    end if;
    if exists (select 1 from public.monitorias where origem = 'migracao' and (enviada_na_origem is null or regua_versao_id is not null or nota_calculada is not null)) then
      raise exception 'MIGRAÇÃO INTERROMPIDA: monitoria migrada fora das regras E3/E4b/E3m.' using errcode = 'MI422';
    end if;
end;
$conf$;

insert into app.versoes_esquema (versao, descricao)
values ('09', ${q(`Migração dos dados do localStorage — lote ${loteId}`)})
on conflict (versao) do nothing;

commit;
`;
};

// ---- linha de comando ----------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [exp, dec, saida] = process.argv.slice(2);
  if (!exp || !dec || !saida) { console.error('uso: gerar-09.mjs <exportacao.json> <decisoes.json> <pasta de saída>'); process.exit(2); }
  try {
    const decisoes = JSON.parse(readFileSync(dec, 'utf8'));
    const ler = (p) => (p ? readFileSync(p, 'utf8') : null);
    const r = gerar({ exportacaoBruta: readFileSync(exp, 'utf8'), decisoes, regua1: JSON.parse(ler(decisoes.regua1?.arquivo) || 'null'),
      regua1Anterior: decisoes.regua1?.anterior ? JSON.parse(ler(decisoes.regua1.anterior)) : null,
      reguaCodigo: decisoes.regua2?.codigo ? JSON.parse(ler(decisoes.regua2.codigo)) : null, evidencia0810Bruta: ler(decisoes.evidencia_0810) });
    mkdirSync(saida, { recursive: true });
    writeFileSync(join(saida, '09b_migracao_dados.sql'), r.sql);
    writeFileSync(join(saida, 'manifesto.json'), JSON.stringify({ ...r.manifesto,
      // só no manifesto LOCAL (fora do banco): impressões do arquivo de entrada e, se for a cópia sanitizada, do original
      arquivo_entrada_sha256: sha256(readFileSync(exp, 'utf8')),
      original_sha256: JSON.parse(readFileSync(exp, 'utf8')).meta?.sanitizacao?.original_sha256 ?? sha256(readFileSync(exp, 'utf8')) }, null, 1));
    console.log(`OK — lote ${r.manifesto.lote}; ${Object.entries(r.manifesto.contagens).map(([t, n]) => `${t}=${n}`).join(', ')}`);
  } catch (e) {
    if (e instanceof Recusa) { console.error(`RECUSADO: ${e.message}`); process.exit(1); }
    throw e;
  }
}
