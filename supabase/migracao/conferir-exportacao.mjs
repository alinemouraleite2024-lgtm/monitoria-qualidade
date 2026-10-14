// =============================================================================
// MonitorIA · Conferência da exportação do navegador (somente leitura)
// =============================================================================
//
// Uso (da raiz do projeto):
//   node supabase/migracao/conferir-exportacao.mjs <exportacao.json> [backup-anterior.json] [--relatorio <saida.json>]
//
// Funciona com a exportação original ou com a cópia sanitizada. NÃO altera nenhum arquivo de
// entrada (só lê) e não envia nada a lugar nenhum. O relatório (tela e, se pedido, arquivo)
// mostra apenas identificadores (MON-…, usr-…), situações, competências, contagens, nomes de
// chave e caminhos de campo — nunca nomes, e-mails, senhas ou outros valores.
//
// Veredito
//   APTO       nada impede a migração (alertas, se houver, precisam ser lidos e confirmados);
//   NÃO APTO   há problema: não migrar até resolver.
//
// O que confere
//   1. Arquivo: JSON válido, bloco `dados`, impressão digital SHA-256 e tamanho.
//   2. Chaves: todas conhecidas, cada uma com JSON válido; contagens do `meta` batem com o conteúdo.
//   3. Monitorias: total, por situação, por competência, rascunhos por competência (para conferir
//      com a contagem anotada dos rascunhos de agosto), ids e protocolos únicos, situação conhecida.
//   4. Usuários e segredos: campos de senha (só a contagem), sessão, nenhum outro campo com nome de
//      segredo, nenhum valor de senha repetido em outro lugar. Na cópia sanitizada: nada disso.
//   5. Comparação com o backup anterior: chaves novas e removidas; monitorias novas, alteradas
//      (com a situação antes → depois) e REMOVIDAS (problema); ids que sumiram de outras listas
//      (alerta).
//   6. Ensaio sem efeito: roda o gerador do 09b em memória com decisões de ensaio, só para provar
//      que cada registro é reconstruído sem perda. Nada é gravado; o SQL do ensaio é descartado.
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHAVES, canonico, gerar } from './gerar-09.mjs';

export const CONFERIDOR_VERSAO = 'conferir-1.0';
const STATUS = ['Rascunho', 'Pendente', 'Concluída', 'Validada', 'Reprovada', 'Cancelada', 'Aprovada', 'Aguardando Aprovação'];
const NOME_SEGREDO = /^(password|confirmpassword|senha|token|accesstoken|refreshtoken|secret|apikey|api_key|jwt|credential|credentials)$/i;
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const contar = (lista, f) => lista.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
const repetidos = (lista) => [...new Set(lista.filter((x, i) => x !== undefined && x !== null && x !== '' && lista.indexOf(x) !== i))];

const ler = (bruto, rotulo) => {
  let arq;
  try { arq = JSON.parse(bruto); } catch { return { erro: `${rotulo}: não é um JSON válido (trecho não exibido).` }; }
  if (!arq || typeof arq !== 'object' || !arq.dados || typeof arq.dados !== 'object') return { erro: `${rotulo}: sem o bloco "dados".` };
  const dados = {}, invalidas = [];
  for (const [k, t] of Object.entries(arq.dados)) {
    if (typeof t !== 'string') { invalidas.push(k); continue; }
    try { dados[k] = JSON.parse(t); } catch { invalidas.push(k); }
  }
  return { arq, meta: arq.meta || {}, textos: arq.dados, dados, invalidas };
};

const segredosEm = (v, caminho, achados) => {
  if (Array.isArray(v)) v.forEach((x, i) => segredosEm(x, `${caminho}[${i}]`, achados));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (NOME_SEGREDO.test(k)) achados.push(`${caminho}.${k}`); segredosEm(x, `${caminho}.${k}`, achados); }
  return achados;
};

/** Confere uma exportação (texto). Devolve o relatório; não toca em disco. */
export const conferir = (bruto, brutoAnterior = null) => {
  const problemas = [], alertas = [];
  const rel = { ferramenta: CONFERIDOR_VERSAO, arquivo: { sha256: sha(bruto), bytes: Buffer.byteLength(bruto, 'utf8') } };
  const e = ler(bruto, 'Exportação');
  if (e.erro) return { ...rel, veredito: 'NÃO APTO', problemas: [e.erro], alertas };
  const { meta, textos, dados, invalidas } = e;
  const sanitizada = !!meta.sanitizacao;
  rel.tipo = sanitizada ? 'cópia sanitizada' : 'exportação original';
  rel.meta = { exportado_em: meta.exportadoEm ?? null, origem: meta.origem ?? null, versao_banco: meta.versaoBanco ?? null, chaves: meta.chaves ?? null, monitorias: meta.monitorias ?? null };

  // 2. chaves
  const desconhecidas = Object.keys(textos).filter((k) => !(k in CHAVES));
  if (desconhecidas.length) problemas.push(`Chaves desconhecidas: ${desconhecidas.join(', ')} (mapear antes de migrar).`);
  if (invalidas.length) problemas.push(`Chaves com conteúdo que não é JSON válido: ${invalidas.join(', ')}.`);
  rel.chaves = Object.keys(textos).sort().map((k) => {
    const v = dados[k];
    return { chave: k, destino: CHAVES[k] ?? 'DESCONHECIDA', tipo: Array.isArray(v) ? 'lista' : v === null ? 'nulo' : typeof v, itens: Array.isArray(v) ? v.length : null };
  });
  if (meta.chaves !== undefined && meta.chaves !== Object.keys(textos).length) problemas.push(`O meta diz ${meta.chaves} chaves, mas o arquivo tem ${Object.keys(textos).length}.`);
  const mons = Array.isArray(dados.pm2_monitorings) ? dados.pm2_monitorings : null;
  if (!mons) problemas.push('Sem pm2_monitorings (ou não é lista): exportação incompleta.');
  if (mons && meta.monitorias !== undefined && meta.monitorias !== mons.length) problemas.push(`O meta diz ${meta.monitorias} monitorias, mas o arquivo tem ${mons.length}.`);
  if (sanitizada && meta.sanitizacao.original_chaves !== undefined) {
    const esperado = meta.sanitizacao.original_chaves - (meta.sanitizacao.chaves_descartadas || []).length;
    if (esperado !== Object.keys(textos).length) problemas.push(`Cópia sanitizada: esperadas ${esperado} chaves (original menos descartadas), há ${Object.keys(textos).length}.`);
  }

  // 3. monitorias
  if (mons) {
    const ids = mons.map((m) => m?.id);
    rel.monitorias = {
      total: mons.length,
      por_situacao: contar(mons, (m) => m?.status ?? '(sem situação)'),
      por_competencia: contar(mons, (m) => m?.competencia || '(sem competência)'),
      rascunhos_por_competencia: contar(mons.filter((m) => m?.status === 'Rascunho'), (m) => m?.competencia || '(sem competência)'),
      ids: ids.filter(Boolean),
    };
    const semId = mons.filter((m) => !m || typeof m.id !== 'string' || !m.id.trim()).length;
    if (semId) problemas.push(`${semId} monitoria(s) sem id.`);
    const dupId = repetidos(ids), dupProt = repetidos(mons.map((m) => m?.protocolo));
    if (dupId.length) problemas.push(`Id de monitoria repetido: ${dupId.join(', ')}.`);
    if (dupProt.length) problemas.push(`Protocolo repetido: ${dupProt.join(', ')}.`);
    const stDesc = [...new Set(mons.map((m) => m?.status).filter((s) => !STATUS.includes(s)))];
    if (stDesc.length) problemas.push(`Situação desconhecida em monitoria: ${stDesc.map(String).join(', ')}.`);
    const semComp = mons.filter((m) => m && m.status !== 'Rascunho' && !m.competencia).map((m) => m.id);
    if (semComp.length) alertas.push(`Monitoria enviada sem competência: ${semComp.join(', ')}.`);
  }

  // 4. usuários e segredos
  const usuarios = Array.isArray(dados.pm2_users) ? dados.pm2_users : [];
  const comSenha = usuarios.filter((u) => u && 'password' in u).length, comConf = usuarios.filter((u) => u && 'confirmPassword' in u).length;
  rel.usuarios = { total: usuarios.length, com_password: comSenha, com_confirmPassword: comConf, ids_repetidos: repetidos(usuarios.map((u) => u?.id)),
    emails_repetidos: repetidos(usuarios.map((u) => String(u?.email ?? '').toLowerCase())).length };
  if (rel.usuarios.ids_repetidos.length) problemas.push(`Id de usuário repetido: ${rel.usuarios.ids_repetidos.join(', ')}.`);
  if (rel.usuarios.emails_repetidos) problemas.push(`${rel.usuarios.emails_repetidos} e-mail(s) de usuário repetido(s) (não exibidos).`);
  rel.sessao_presente = 'pm2_auth_session' in textos;
  const senhas = usuarios.flatMap((u) => ['password', 'confirmPassword'].map((c) => u?.[c])).filter((v) => typeof v === 'string' && v.length >= 4);
  const semSenha = { ...dados, pm2_users: usuarios.map((u) => { const c = { ...u }; delete c.password; delete c.confirmPassword; return c; }) };
  delete semSenha.pm2_auth_session;
  const outrosSegredos = segredosEm(semSenha, '$', []);
  if (outrosSegredos.length) problemas.push(`Campo com nome de segredo fora do previsto: ${outrosSegredos.join(', ')}.`);
  const textoSemSenha = Object.entries(textos).filter(([k]) => k !== 'pm2_auth_session' && k !== 'pm2_users').map(([, t]) => t).join('\n') + JSON.stringify(semSenha.pm2_users);
  if (senhas.some((v) => textoSemSenha.includes(v))) problemas.push('Um valor de senha aparece em outro campo da exportação (valor não exibido). A cópia sanitizada seria recusada.');
  if (sanitizada) {
    if (comSenha || comConf) problemas.push('Cópia sanitizada ainda tem campo de senha.');
    if (rel.sessao_presente) problemas.push('Cópia sanitizada ainda tem a sessão (pm2_auth_session).');
    rel.sanitizacao = { em: meta.sanitizacao.em, ferramenta: meta.sanitizacao.ferramenta, campos_removidos: meta.sanitizacao.campos_removidos, chaves_descartadas: meta.sanitizacao.chaves_descartadas };
  } else if (comSenha || comConf || rel.sessao_presente) {
    alertas.push('Exportação ORIGINAL: contém senhas e/ou sessão (esperado). Guardar em local restrito; para a migração, usar a cópia sanitizada.');
  }

  // 5. comparação com o backup anterior
  if (brutoAnterior) {
    const a = ler(brutoAnterior, 'Backup anterior');
    if (a.erro) problemas.push(a.erro);
    else {
      const k0 = Object.keys(a.textos), k1 = Object.keys(textos);
      const ignorar = sanitizada ? (meta.sanitizacao.chaves_descartadas || []) : [];
      rel.comparacao = { backup_anterior: { sha256: sha(brutoAnterior), exportado_em: a.meta.exportadoEm ?? null },
        chaves_novas: k1.filter((k) => !k0.includes(k)), chaves_removidas: k0.filter((k) => !k1.includes(k) && !ignorar.includes(k)) };
      if (rel.comparacao.chaves_removidas.length) problemas.push(`Chaves que existiam no backup anterior e sumiram: ${rel.comparacao.chaves_removidas.join(', ')}.`);
      const m0 = Array.isArray(a.dados.pm2_monitorings) ? a.dados.pm2_monitorings : [];
      const m1 = mons || [];
      const por = (l) => new Map(l.filter((m) => m?.id).map((m) => [m.id, m]));
      const A = por(m0), B = por(m1);
      const removidas = [...A.keys()].filter((id) => !B.has(id));
      const novas = [...B.keys()].filter((id) => !A.has(id));
      const alteradas = [...A.keys()].filter((id) => B.has(id) && canonico(A.get(id)) !== canonico(B.get(id)))
        .map((id) => ({ id, situacao: `${A.get(id).status} → ${B.get(id).status}` }));
      rel.comparacao.monitorias = { anterior: m0.length, atual: m1.length, novas, alteradas, removidas };
      if (removidas.length) problemas.push(`Monitorias que existiam no backup anterior e SUMIRAM: ${removidas.join(', ')}. Não migrar até explicar.`);
      // outras listas com id
      const listasComId = ['pm2_users', 'pm2_collaborators', 'pm2_areas', 'pm2_criteria', 'pm2_allocations', 'pm2_cgoals', 'pm2_planos_metas'];
      rel.comparacao.outras_listas = {};
      for (const k of listasComId) {
        const l0 = Array.isArray(a.dados[k]) ? a.dados[k] : [], l1 = Array.isArray(dados[k]) ? dados[k] : [];
        const ids1 = new Set(l1.map((x) => x?.id));
        const sumiram = l0.map((x) => x?.id).filter((id) => id && !ids1.has(id));
        rel.comparacao.outras_listas[k] = { anterior: l0.length, atual: l1.length, sumiram };
        if (sumiram.length) alertas.push(`${k}: ids que existiam antes e não estão na exportação: ${sumiram.join(', ')} (confirmar se a retirada foi intencional).`);
      }
    }
  }

  // 6. ensaio sem efeito (reconstrução sem perda pelo gerador)
  if (Array.isArray(dados.pm2_criteria) && !desconhecidas.length && !invalidas.length) {
    try {
      const crit = dados.pm2_criteria;
      const semAdmin = Object.fromEntries(usuarios.filter((u) => Array.isArray(u?.perfis) && u.perfis.includes('ADMIN'))
        .map((u) => [u.id, { perfis: u.perfis.filter((p) => p !== 'ADMIN'), decisao: 'ENSAIO' }]));
      const r = gerar({ exportacaoBruta: bruto, agora: 0, regua1: { revisao: 'ensaio', commit: 'ensaio', sha256: sha(JSON.stringify(crit)), criterios: crit },
        decisoes: { responsavel_admin_id: 'adm-ensaio', perfis: semAdmin,
          regua1: { vigente_desde: '2026-08-31', datas: { commit_codigo: { situacao: 'comprovada' }, publicacao_producao: { situacao: 'nao_comprovada' } } },
          regua2: { vigente_desde: '2026-10-12' } } });
      rel.ensaio = { reconstrucao: r.manifesto.reconstrucao, contagens: r.manifesto.contagens, monitorias: r.manifesto.monitorias.map((m) => ({ id: m.id, situacao: m.status, enviada_na_origem: m.enviada_na_origem })) };
    } catch (x) {
      problemas.push(`Ensaio do gerador recusou: ${x.message}`);
    }
  } else alertas.push('Ensaio do gerador não executado (sem critérios ou com chaves inválidas).');

  return { ...rel, veredito: problemas.length ? 'NÃO APTO' : 'APTO', problemas, alertas };
};

// ---- linha de comando -------------------------------------------------------------------
const imprimir = (r) => {
  const L = (s = '') => console.log(s);
  L(`CONFERÊNCIA DA EXPORTAÇÃO — ${r.veredito}`);
  L(`  arquivo        sha256 ${r.arquivo.sha256} · ${r.arquivo.bytes} bytes · ${r.tipo ?? '?'}`);
  if (r.meta) L(`  exportado em   ${r.meta.exportado_em ?? '?'} · origem ${r.meta.origem ?? '?'} · versão do banco ${r.meta.versao_banco ?? '?'}`);
  if (r.chaves) L(`  chaves         ${r.chaves.length}`);
  if (r.monitorias) {
    L(`  monitorias     ${r.monitorias.total}`);
    L(`    por situação          ${JSON.stringify(r.monitorias.por_situacao)}`);
    L(`    por competência       ${JSON.stringify(r.monitorias.por_competencia)}`);
    L(`    rascunhos/competência ${JSON.stringify(r.monitorias.rascunhos_por_competencia)}`);
  }
  if (r.usuarios) L(`  usuários       ${r.usuarios.total} · com senha ${r.usuarios.com_password} · confirmPassword ${r.usuarios.com_confirmPassword} · sessão ${r.sessao_presente ? 'sim' : 'não'}`);
  if (r.comparacao?.monitorias) {
    const c = r.comparacao.monitorias;
    L(`  × backup anterior (${r.comparacao.backup_anterior.exportado_em ?? '?'}): ${c.anterior} → ${c.atual} monitorias`);
    L(`    novas ${c.novas.length ? c.novas.join(', ') : '—'}`);
    L(`    alteradas ${c.alteradas.length ? c.alteradas.map((x) => `${x.id} (${x.situacao})`).join(', ') : '—'}`);
    L(`    REMOVIDAS ${c.removidas.length ? c.removidas.join(', ') : '— nenhuma'}`);
  }
  if (r.ensaio) L(`  ensaio         ${Object.values(r.ensaio.reconstrucao).every((v) => v.startsWith('idêntico')) ? 'reconstrução idêntica em todas as chaves' : JSON.stringify(r.ensaio.reconstrucao)}`);
  for (const p of r.problemas) L(`  PROBLEMA  ${p}`);
  for (const a of r.alertas) L(`  alerta    ${a}`);
};

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const iRel = args.indexOf('--relatorio');
  const saidaRel = iRel >= 0 ? args[iRel + 1] : null;
  const pos = args.filter((_, i) => i !== iRel && i !== iRel + 1);
  const [atual, anterior] = pos;
  if (!atual) { console.error('uso: conferir-exportacao.mjs <exportacao.json> [backup-anterior.json] [--relatorio <saida.json>]'); process.exit(2); }
  try {
    if (saidaRel && [atual, anterior].filter(Boolean).some((p) => resolve(p).toLowerCase() === resolve(saidaRel).toLowerCase())) throw new Error('O relatório não pode ser gravado por cima de um arquivo de entrada.');
    if (saidaRel && existsSync(saidaRel)) throw new Error('Já existe um arquivo no destino do relatório (nada foi sobrescrito).');
    const r = conferir(readFileSync(atual, 'utf8'), anterior ? readFileSync(anterior, 'utf8') : null);
    imprimir(r);
    if (saidaRel) writeFileSync(saidaRel, JSON.stringify(r, null, 1), { flag: 'wx' });
    process.exit(r.veredito === 'APTO' ? 0 : 1);
  } catch (e) {
    console.error(`ERRO: ${e?.code === 'ENOENT' ? 'arquivo não encontrado' : e.message}`);
    process.exit(2);
  }
}
