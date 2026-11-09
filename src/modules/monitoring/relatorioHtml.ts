import DOMPurify from 'dompurify';

// O que o relatório pode conter. Mesma lista de app.conferir_relatorio_completo (script 17).
const TAGS = ['h1', 'h2', 'h3', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'];
const ATRIBUTOS = ['href', 'colspan', 'rowspan', 'start'];

export const sanitizarRelatorio = (html: string): string =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATRIBUTOS, ALLOWED_URI_REGEXP: /^https?:\/\//i });

export const textoDoRelatorio = (html: string): string => {
  const doc = new DOMParser().parseFromString(sanitizarRelatorio(html), 'text/html');
  doc.querySelectorAll('p,h1,h2,h3,li,tr,hr').forEach((e) => e.append('\n'));
  doc.querySelectorAll('td,th').forEach((e) => e.append('\t'));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
};

/** O editor devolve <p></p> quando está vazio: para o banco, isso é não ter relatório. */
export const relatorioParaGravar = (html: string): string => {
  const limpo = sanitizarRelatorio(html);
  return textoDoRelatorio(limpo) ? limpo : '';
};

/**
 * Adapta o que o Word copia ao que o editor entende: destaque por estilo vira <mark>, e o estilo
 * "Título" vira título. Devolve o documento inteiro porque a definição das listas do Word fica no
 * <head>, e a extensão de colagem do Office depende dela.
 */
export const adaptarColagemDoWord = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll<HTMLElement>('span[style]').forEach((s) => {
    const estilo = s.getAttribute('style') ?? '';
    if (/mso-highlight|background(-color)?\s*:\s*(yellow|#ffff00)/i.test(estilo)) {
      const m = doc.createElement('mark');
      m.innerHTML = s.innerHTML;
      s.replaceWith(m);
    }
  });
  doc.querySelectorAll('p.MsoTitle').forEach((p) => {
    const h = doc.createElement('h1');
    h.innerHTML = p.innerHTML;
    p.replaceWith(h);
  });
  return doc.documentElement.outerHTML;
};

export const copiarRelatorio = async (html: string): Promise<void> => {
  const limpo = sanitizarRelatorio(html);
  await navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([limpo], { type: 'text/html' }),
    'text/plain': new Blob([textoDoRelatorio(limpo)], { type: 'text/plain' }),
  })]);
};
