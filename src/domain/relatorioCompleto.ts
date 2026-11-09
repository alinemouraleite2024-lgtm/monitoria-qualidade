// Relatório Completo da Monitoria: regras sem navegador. Complementar aos seis blocos do relatório;
// não entra na nota, nos critérios nem na classificação.

/** Mesmo limite de app.conferir_relatorio_completo (script 17). */
export const LIMITE_RELATORIO_BYTES = 200_000;

export const tamanhoEmBytes = (html: string): number => new TextEncoder().encode(html).length;

export const excedeLimite = (html: string): boolean => tamanhoEmBytes(html) > LIMITE_RELATORIO_BYTES;

export const tamanhoAmigavel = (html: string): string =>
  `${(tamanhoEmBytes(html) / 1024).toFixed(1).replace('.', ',')} KB de ${LIMITE_RELATORIO_BYTES / 1000} KB`;

/**
 * O que parece dado pessoal no texto. Só avisa: nome não é detectável, e o número pode ser outra
 * coisa. Não substitui a conferência de quem cola.
 */
export const dadosPessoaisNoTexto = (texto: string): string[] => {
  const achados: string[] = [];
  if (/(?<![\d.-])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\d.-])/.test(texto)) achados.push('CPF');
  if (/(?<![\d.-])(\(?\d{2}\)?[\s-]?)9?\d{4}[\s-]\d{4}(?![\d-])|(?<![\d.-])\(?\d{2}\)?[\s-]?9\d{8}(?![\d-])/.test(texto)) achados.push('telefone');
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(texto)) achados.push('e-mail');
  return achados;
};

export const MENSAGEM_LIMITE_RELATORIO = `O relatório completo passou do limite de ${LIMITE_RELATORIO_BYTES / 1000} KB. Retire o que não for necessário antes de salvar.`;

/** Texto do HTML sem depender do navegador: basta para o aviso de dados pessoais. */
export const textoAproximado = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
