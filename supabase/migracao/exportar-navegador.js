// MonitorIA · Exportação final do navegador — revisada em 13/10/2026 (só leitura, nada é transmitido)
//
// Onde: no portal antigo (https://monitoria-qualidade.vercel.app), logada, Console do navegador (F12).
// O que faz, em ordem:
//   1. LÊ as chaves do portal (as que começam com "pm2_"). Não lê nenhuma outra chave do site.
//   2. Monta o arquivo no mesmo formato do backup de 08/10: { meta, dados }, com o texto de cada
//      chave exatamente como está gravado.
//   3. Calcula a impressão digital SHA-256 do arquivo, aqui mesmo no navegador.
//   4. Baixa o arquivo para a pasta de downloads deste computador.
//   5. Mostra no console: impressão digital, quantidade de chaves e monitorias, monitorias por
//      situação e rascunhos por competência. Nenhum nome, e-mail ou senha é mostrado.
// O que NÃO faz: não altera, não apaga e não grava nada no navegador; não envia nada para a
// internet (o arquivo é montado e baixado localmente).
(async () => {
  const dados = {};
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith('pm2_')) dados[chave] = localStorage.getItem(chave);
  }

  let monitorias = [];
  try { monitorias = JSON.parse(dados['pm2_monitorings'] || '[]'); } catch { monitorias = []; }

  const meta = {
    exportadoEm: new Date().toISOString(),
    origem: location.origin,
    versaoBanco: localStorage.getItem('pm2_database_version'),
    chaves: Object.keys(dados).length,
    monitorias: Array.isArray(monitorias) ? monitorias.length : 0,
  };
  const texto = JSON.stringify({ meta, dados }, null, 2);

  const bytes = new TextEncoder().encode(texto);
  const resumo = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('');

  const nome = 'monitoria-exportacao-final-' + meta.exportadoEm.slice(0, 19).replace(/[:T]/g, '-') + '.json';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  link.download = nome;
  link.click();

  const porSituacao = {}, rascunhosPorCompetencia = {};
  for (const m of Array.isArray(monitorias) ? monitorias : []) {
    const s = (m && m.status) || '(sem situação)';
    porSituacao[s] = (porSituacao[s] || 0) + 1;
    if (s === 'Rascunho') {
      const c = (m && m.competencia) || '(sem competência)';
      rascunhosPorCompetencia[c] = (rascunhosPorCompetencia[c] || 0) + 1;
    }
  }
  console.log('Arquivo baixado:', nome);
  console.log('Impressão digital (SHA-256):', sha256);
  console.table(meta);
  console.table(porSituacao);
  console.table(rascunhosPorCompetencia);
  return { arquivo: nome, sha256, chaves: meta.chaves, monitorias: meta.monitorias };
})();
