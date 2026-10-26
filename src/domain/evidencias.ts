// Descrição curta de um anexo no painel de análise do gestor (Etapa A, 26/10/2026).
//
// O anexo guarda o tipo MIME como veio do navegador — "application/vnd.openxmlformats-
// officedocument.wordprocessingml.document" para um .docx —, longo demais para a linha e sem
// sentido para quem valida. Aqui vira "DOCX · 0,04 MB · 25/10/2026". Só exibição.

type Anexo = { name?: string; type?: string; size?: string; date?: string };

/** "DOCX", "WAV", "PDF" — pela extensão do nome; sem extensão, pelo fim do tipo MIME. */
export const tipoAmigavel = (nome?: string, mime?: string): string => {
  const ext = /\.([a-z0-9]{1,6})$/i.exec(nome ?? '')?.[1];
  if (ext) return ext.toUpperCase();
  const sub = (mime ?? '').split('/')[1]?.split(/[.+;-]/)[0];
  return sub ? sub.toUpperCase() : '';
};

/** "0.04 MB" → "0,04 MB" (vírgula decimal); outro formato passa como está. */
export const tamanhoAmigavel = (size?: string): string =>
  (size ?? '').replace(/^(\d+)\.(\d+)(\s*[KMG]?B)$/i, '$1,$2$3');

/** "DOCX · 0,04 MB · 25/10/2026" — partes ausentes são omitidas. */
export const descricaoDoAnexo = (ev: Anexo): string =>
  [tipoAmigavel(ev.name, ev.type), tamanhoAmigavel(ev.size), ev.date ?? ''].filter(Boolean).join(' · ');
