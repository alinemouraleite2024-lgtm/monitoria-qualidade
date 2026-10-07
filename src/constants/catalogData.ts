/**
 * Legado. Catálogo de empreendimentos usado pelo campo que saiu da tela de Nova Monitoria na
 * 0.14.0. Preservado — e não removido — porque o valor continua gravado em monitorias
 * anteriores; a constante existe para que o dado antigo tenha origem documentada.
 */
export const OFFICIAL_EMPREENDIMENTOS = [
  'Reserva Moura Leite',
  'Jardim dos Ipês',
  'Parque das Águas',
  'Residencial Paineiras',
  'Vila dos Pássaros'
];

/**
 * Catálogo de categorias até a 0.13.0.
 *
 * Não é mais oferecido em lugar nenhum. Existe para que `migrateCategorias` saiba distinguir
 * três coisas no que está gravado no navegador: o que é lista velha (descarta), o que é lista
 * nova (já está lá) e o que a operação criou à mão pelo formulário (preserva).
 *
 * Quatro destes saíram por não serem assunto de atendimento — Dúvida, Solicitação, Reclamação
 * e Elogio são *motivo do contato*, que o critério 1 da monitoria já classifica. Manter os dois
 * eixos no mesmo campo era a duplicação que a lista nova elimina.
 */
export const OFFICIAL_CATEGORIAS_V1 = [
  'Dúvida',
  'Reclamação',
  'Solicitação',
  'Elogio',
  '2ª Via de Boleto',
  'Renegociação'
];

/**
 * Catálogo operacional de categorias, adotado na 0.14.0. São 27 — a lista da área tem 28, mas
 * `REGISTRO (I)` ficou de fora até a operação definir o que o distingue de `REGISTRO`.
 *
 * A assimetria justifica a espera: incluir depois é adição pura, enquanto remover uma categoria
 * já usada deixaria valor órfão em monitoria real. Enquanto isso, o formulário permite criar
 * categoria na hora (`allowCreate`), e a migração preserva o que for criado assim.
 *
 * Nota de operação: `EMPREENDIMENTO` aqui é *assunto do atendimento* — não confundir com o
 * campo Empreendimento, que saiu da tela nesta mesma versão. São conceitos diferentes.
 *
 * TRANSFERÊNCIA DE TITULARIDADE × TRANSFERÊNCIA DE LOTE (definido em 07/10/2026): a primeira é
 * mudança de **quem** detém os direitos do contrato, com o lote inalterado — é onde entra a
 * **cessão de direitos**. A segunda é mudança de **qual** lote, com o mesmo titular. "CESSÃO DE
 * DIREITOS" não é categoria: é o instrumento jurídico pelo qual a titularidade muda. Sem esta
 * nota o catálogo é só uma lista de rótulos, e a escolha passa a depender de interpretação.
 * Ver docs/METODOLOGIA-MONITORIA.md §6.3.
 */
export const OFFICIAL_CATEGORIAS = [
  'ANTECIPAÇÃO PAGAMENTOS',
  'ASSOCIAÇÃO',
  'AUTORIZAÇÃO TERCEIROS',
  'BOLETOS',
  'CADASTRO',
  'CHECAGEM DE VENDA',
  'COMUNICAÇÃO ENTRE CLIENTES',
  'CONTRATO',
  'DISTRATO',
  'DOCUMENTOS EMPRESA',
  'EMPREENDIMENTO',
  'FINANCIAMENTO',
  'INFORME RENDIMENTOS',
  'IPTU',
  'JURÍDICO',
  'MANIFESTAÇÃO CLIENTE',
  'NEGOCIAÇÃO CONTRATUAL',
  'NEGOCIAÇÃO DE DÍVIDA',
  'ONBOARDING',
  'PREFEITURA',
  'PROGRAMA INDICAÇÃO',
  'RECADO',
  'REGISTRO',
  'TRANSFERÊNCIA DE LOTE',
  'TRANSFERÊNCIA DE TITULARIDADE',
  'UNIDADE',
  'VENCIMENTO'
];
