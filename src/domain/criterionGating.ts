// Dependências entre critérios — quando a resposta de um decide a de outro.
//
// É a primeira regra do sistema em que um critério olha para outro, e por isso mora aqui e não
// dentro do formulário: o dia em que houver uma segunda, ela entra nesta lista e não numa
// condição espalhada em JSX.
//
// O caso que a originou: o critério 25 (confirmação de dados de segurança) acionava eliminatório
// em atendimento correto. No processo do Blip o cliente pode chegar **já autenticado** — o
// roteiro de abertura tem duas versões, e a versão AUTENTICADO cumprimenta pelo nome porque o
// canal já sabe quem é. Exigir nova confirmação nesse caso penaliza quem fez certo.

import type { Criterion } from '../types/domain';

/** Resposta em edição, na forma em que o formulário a mantém. */
type RespostaEmEdicao = { score: number | string } | undefined;

export interface Bloqueio {
  /** Valor que o critério bloqueado assume. */
  valor: 'N/A';
  /** Texto exibido na tela, no lugar do controle. */
  motivo: string;
  /** Critério cuja resposta causou o bloqueio. */
  origem: string;
}

/** Marcação explícita de que o eliminatório ocorreu — o botão "Sim, ocorreu" grava 0. */
const FOI_MARCADO_COMO_OCORRIDO = (r: RespostaEmEdicao) => r?.score === 0;

/**
 * Critérios que a resposta de outro critério deixa sem pergunta a fazer.
 *
 * Devolve apenas os efetivamente bloqueados; ausência de chave significa "responder
 * normalmente". Não decide nota: só diz que aquele critério não se aplica, e por quê.
 */
export const getCriteriosBloqueados = (
  criteria: Criterion[],
  scores: Record<string, RespostaEmEdicao>,
): Record<string, Bloqueio> => {
  const bloqueios: Record<string, Bloqueio> = {};

  const crit29 = criteria.find((c) => c.id === 'crit-29' && c.active);
  const crit25 = criteria.find((c) => c.id === 'crit-25' && c.active);

  if (crit29 && crit25 && scores['crit-29']?.score === 'Sim') {
    // Exceção deliberada: se a monitora JÁ marcou que o eliminatório ocorreu, o portão não
    // apaga essa marcação. Sobrescrever um eliminatório em silêncio seria pior do que o
    // problema que este portão veio resolver — a tela avisa e ela decide.
    if (!FOI_MARCADO_COMO_OCORRIDO(scores['crit-25'])) {
      bloqueios['crit-25'] = {
        valor: 'N/A',
        origem: 'crit-29',
        motivo:
          'Cliente chegou autenticado: a autenticação do canal substitui a confirmação de '
          + 'dados no atendimento humano.',
      };
    }
  }

  return bloqueios;
};

/**
 * `true` quando o portão quer bloquear um eliminatório que já está marcado como ocorrido.
 *
 * A tela usa isto para avisar em vez de agir. É o caso em que as duas respostas se contradizem
 * — cliente autenticado, mas a monitora apontou falha de confirmação — e quem resolve é ela.
 */
export const temConflitoDeAutenticacao = (
  scores: Record<string, RespostaEmEdicao>,
): boolean =>
  scores['crit-29']?.score === 'Sim' && FOI_MARCADO_COMO_OCORRIDO(scores['crit-25']);
