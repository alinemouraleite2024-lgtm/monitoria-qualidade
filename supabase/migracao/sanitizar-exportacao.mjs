// =============================================================================
// MonitorIA · Cópia sanitizada da exportação do navegador (para a migração)
// =============================================================================
//
// Uso (da raiz do projeto):
//   node supabase/migracao/sanitizar-exportacao.mjs <exportacao-original.json> <copia-sanitizada.json>
//
// O que faz
//   Lê a exportação ORIGINAL (somente leitura) e grava uma CÓPIA, em outro arquivo, sem:
//     - os campos `password` e `confirmPassword` de cada usuário (pm2_users);
//     - a chave `pm2_auth_session` (sessão do navegador).
//   Todo o resto é copiado byte a byte — inclusive o texto de cada chave, exatamente como estava
//   no localStorage. Só o texto de pm2_users é regravado (sem os dois campos).
//   A cópia registra em `meta.sanitizacao` O QUE foi retirado e QUANTAS vezes, e a impressão
//   digital SHA-256 do original — nunca os valores.
//
// O que recusa (e não grava nada)
//   - gravar por cima do original, ou por cima de um arquivo que já existe;
//   - campo com nome de segredo fora de pm2_users (token, secret, senha, apiKey...): não é retirado
//     em silêncio — precisa ser revisto;
//   - valor de senha repetido em qualquer outro lugar da exportação (ex.: alguém anotou a senha nas
//     observações): retirar só o campo deixaria a senha na cópia.
//   A mensagem de recusa nunca mostra o valor.
//
// Garantias conferidas ao final (se alguma falhar, a cópia é apagada e nada fica)
//   - o original continua com a mesma impressão digital (não foi alterado);
//   - a cópia não tem campo de senha, sessão nem valor de senha;
//   - toda chave, exceto pm2_users, é idêntica ao original; e cada usuário é idêntico ao original
//     sem os dois campos.
// =============================================================================
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CHAVES, lerExportacao, canonico } from './gerar-09.mjs';

export const SANITIZADOR_VERSAO = 'sanitizar-1.0';
export const CAMPOS_SENHA = ['password', 'confirmPassword'];
export const CHAVES_DESCARTADAS = ['pm2_auth_session'];
const NOME_SEGREDO = /^(password|confirmpassword|senha|token|accesstoken|refreshtoken|secret|apikey|api_key|jwt|credential|credentials)$/i;

class Recusa extends Error {}
const recusar = (msg) => { throw new Recusa(msg); };
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const camposSegredo = (v, caminho, achados) => {
  if (Array.isArray(v)) v.forEach((x, i) => camposSegredo(x, `${caminho}[${i}]`, achados));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (NOME_SEGREDO.test(k)) achados.push(`${caminho}.${k}`); camposSegredo(x, `${caminho}.${k}`, achados); }
  return achados;
};

/** Sanitiza o conteúdo (texto) de uma exportação. Não toca em disco. */
export const sanitizar = (brutoOriginal, agora = new Date()) => {
  // A mensagem de erro do JSON.parse pode repetir um trecho do arquivo: nunca é exibida.
  let original;
  try { original = JSON.parse(brutoOriginal); } catch { recusar('O arquivo não é um JSON válido (trecho não exibido).'); }
  const { dados } = lerExportacao(brutoOriginal);
  const textos = original.dados;
  const usuarios = Array.isArray(dados.pm2_users) ? dados.pm2_users : [];
  if (dados.pm2_users !== undefined && !Array.isArray(dados.pm2_users)) recusar('pm2_users deveria ser uma lista.');

  // valores de senha (só em memória, para conferir que não aparecem em outro lugar)
  const valores = [];
  const contagem = Object.fromEntries(CAMPOS_SENHA.map((c) => [c, 0]));
  const limpos = usuarios.map((u, i) => {
    if (!u || typeof u !== 'object') recusar(`pm2_users[${i}]: item que não é objeto.`);
    const c = { ...u };
    for (const campo of CAMPOS_SENHA) if (campo in c) {
      contagem[campo]++;
      if (typeof c[campo] === 'string' && c[campo].length >= 4) valores.push(c[campo]);
      delete c[campo];
    }
    return c;
  });

  // nenhum outro campo com nome de segredo, em lugar nenhum (fora a sessão, que é descartada)
  const resto = { ...dados, pm2_users: limpos };
  for (const k of CHAVES_DESCARTADAS) delete resto[k];
  const segredos = camposSegredo(resto, '$', []);
  if (segredos.length) recusar(`Campo com nome de segredo fora do previsto: ${segredos.join(', ')}. Revisar a origem antes de sanitizar.`);

  // novos textos: pm2_users regravado; as demais chaves exatamente como vieram
  const novosTextos = {};
  for (const [k, t] of Object.entries(textos)) {
    if (CHAVES_DESCARTADAS.includes(k)) continue;
    novosTextos[k] = k === 'pm2_users' ? JSON.stringify(limpos) : t;
  }
  // valor de senha repetido em qualquer outro texto (inclusive outros campos do próprio usuário)
  const tudo = Object.values(novosTextos).join('\n') + JSON.stringify(original.meta ?? {});
  if (valores.some((v) => tudo.includes(v))) recusar('Um valor de senha aparece em outro campo da exportação (por exemplo, em observações). Revisar a origem antes de sanitizar; o valor não é exibido.');

  const camposRemovidos = CAMPOS_SENHA.filter((c) => contagem[c] > 0).map((campo) => ({ chave: 'pm2_users', campo, ocorrencias: contagem[campo] }));
  const meta = {
    ...(original.meta ?? {}),
    chaves: Object.keys(novosTextos).length,
    sanitizacao: {
      ferramenta: SANITIZADOR_VERSAO,
      em: agora.toISOString(),
      original_sha256: sha(Buffer.from(brutoOriginal, 'utf8')),
      original_chaves: Object.keys(textos).length,
      campos_removidos: camposRemovidos,
      chaves_descartadas: CHAVES_DESCARTADAS.filter((k) => k in textos),
    },
  };
  const saida = JSON.stringify({ meta, dados: novosTextos }, null, 2);

  // ---- conferência da cópia, antes de devolver ----
  const copia = JSON.parse(saida);
  if (/"(password|confirmPassword)"\s*:/.test(Object.values(copia.dados).join('\n'))) recusar('Conferência: campo de senha na cópia.');
  if (CHAVES_DESCARTADAS.some((k) => k in copia.dados)) recusar('Conferência: sessão na cópia.');
  if (valores.some((v) => saida.includes(v))) recusar('Conferência: valor de senha na cópia.');
  for (const [k, t] of Object.entries(textos)) {
    if (CHAVES_DESCARTADAS.includes(k) || k === 'pm2_users') continue;
    if (copia.dados[k] !== t) recusar(`Conferência: a chave ${k} difere do original.`);
  }
  const deVolta = JSON.parse(copia.dados.pm2_users ?? '[]');
  const esperado = usuarios.map((u) => { const c = { ...u }; for (const f of CAMPOS_SENHA) delete c[f]; return c; });
  if (canonico(deVolta) !== canonico(esperado)) recusar('Conferência: usuários diferentes do original (além dos campos de senha).');
  for (const k of Object.keys(copia.dados)) if (!(k in CHAVES)) recusar(`Conferência: chave desconhecida ${k}.`);

  return { texto: saida, relatorio: { original_sha256: meta.sanitizacao.original_sha256, copia_sha256: sha(Buffer.from(saida, 'utf8')),
    chaves_original: Object.keys(textos).length, chaves_copia: Object.keys(novosTextos).length, campos_removidos: camposRemovidos,
    chaves_descartadas: meta.sanitizacao.chaves_descartadas, usuarios: usuarios.length } };
};

/** Lê o original, grava a cópia em outro arquivo e confere que o original não mudou. */
export const sanitizarArquivo = (caminhoOriginal, caminhoCopia, agora = new Date()) => {
  const a = resolve(caminhoOriginal), b = resolve(caminhoCopia);
  if (a.toLowerCase() === b.toLowerCase()) recusar('A cópia não pode ser gravada por cima do original.');
  if (existsSync(b)) recusar('Já existe um arquivo no destino da cópia. Escolha outro nome (nada foi sobrescrito).');
  const bytesAntes = readFileSync(a);
  const shaAntes = sha(bytesAntes);
  const r = sanitizar(bytesAntes.toString('utf8'), agora);
  writeFileSync(b, r.texto, { flag: 'wx' });
  const shaDepois = sha(readFileSync(a));
  if (shaDepois !== shaAntes) { unlinkSync(b); recusar('O original mudou durante a sanitização. A cópia foi apagada.'); }
  if (sha(readFileSync(b)) !== r.relatorio.copia_sha256) { unlinkSync(b); recusar('A cópia gravada não confere. Ela foi apagada.'); }
  return { ...r.relatorio, original_intacto: true };
};

// ---- linha de comando -------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [orig, copia] = process.argv.slice(2);
  if (!orig || !copia) { console.error('uso: sanitizar-exportacao.mjs <exportacao-original.json> <copia-sanitizada.json>'); process.exit(2); }
  try {
    const r = sanitizarArquivo(orig, copia);
    console.log('CÓPIA SANITIZADA GRAVADA');
    console.log(`  original (intacto)  sha256 ${r.original_sha256}`);
    console.log(`  cópia               sha256 ${r.copia_sha256}`);
    console.log(`  chaves              ${r.chaves_original} no original → ${r.chaves_copia} na cópia`);
    for (const c of r.campos_removidos) console.log(`  retirado            ${c.chave}.${c.campo} × ${c.ocorrencias}`);
    for (const k of r.chaves_descartadas) console.log(`  descartada          ${k}`);
  } catch (e) {
    // As mensagens das recusas nunca contêm valores; erros inesperados também param aqui, sem pilha.
    console.error(`RECUSADO: ${e instanceof Recusa ? e.message : e?.code === 'ENOENT' ? 'arquivo não encontrado' : (e?.message?.startsWith('pm2_') || /^(Exportação|Chave)/.test(e?.message ?? '')) ? e.message : 'erro inesperado (detalhe não exibido)'}`);
    process.exit(1);
  }
}
