// Duração do atendimento — fonte única do cálculo e da apresentação.
//
// Até a 0.13.0 a duração era texto livre digitado à mão ("00:05"), o que a tornava inútil para
// qualquer agregação e sujeita a erro de digitação. Na 0.14.0 ela passa a ser derivada de um par
// de datas completas.
//
// Por que data e hora, e não só hora: atendimento de WhatsApp atravessa o dia. Um contato
// aberto às 16h de terça e encerrado às 8h de quarta é caso normal da operação, e com apenas
// HH:MM não há como distinguir isso de um erro de digitação.

/**
 * Minutos entre início e encerramento, ou `null` quando o par não permite cálculo.
 *
 * Devolve `null` — e não zero — para entrada ausente, data inválida ou encerramento anterior ao
 * início. Zero é resultado legítimo: um atendimento pode durar menos de um minuto, e tratá-lo
 * como erro obrigaria a monitora a mentir na hora do registro.
 */
export const calcularDuracao = (
  inicio?: string | null,
  fim?: string | null,
): number | null => {
  if (!inicio || !fim) return null;

  const inicioMs = new Date(inicio).getTime();
  const fimMs = new Date(fim).getTime();
  if (Number.isNaN(inicioMs) || Number.isNaN(fimMs)) return null;
  if (fimMs < inicioMs) return null;

  return Math.round((fimMs - inicioMs) / 60000);
};

/**
 * Duração em texto, na unidade que o número pede: minutos abaixo de uma hora, horas abaixo de
 * um dia, dias acima disso. Escrever "95 minutos" ou "1560 minutos" é tecnicamente correto e
 * ilegível — quem lê o relatório precisa da ordem de grandeza, não do número bruto.
 */
export const formatarDuracao = (minutos?: number | null): string => {
  if (minutos == null || !Number.isFinite(minutos) || minutos < 0) return '—';
  if (minutos === 0) return 'menos de 1 minuto';
  if (minutos < 60) return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

  const totalHoras = Math.floor(minutos / 60);
  const min = minutos % 60;

  if (totalHoras < 24) {
    return min === 0 ? `${totalHoras}h` : `${totalHoras}h ${min}min`;
  }

  const dias = Math.floor(totalHoras / 24);
  const horas = totalHoras % 24;
  const partes = [`${dias} ${dias === 1 ? 'dia' : 'dias'}`];
  if (horas > 0) partes.push(`${horas}h`);
  if (min > 0) partes.push(`${min}min`);
  return partes.join(' ');
};

/**
 * O que exibir no lugar da duração, para qualquer monitoria.
 *
 * Registro da 0.14.0 em diante tem `duracaoMinutos`. Registro anterior tem apenas o `tempo`
 * legado, digitado à mão — que continua sendo mostrado como está, sem recálculo e sem ficar em
 * branco. Uma única regra, para que tela de detalhe, resumo do formulário e CSV não divirjam.
 */
export const exibirDuracao = (
  duracaoMinutos?: number | null,
  tempoLegado?: string | null,
): string => {
  if (duracaoMinutos != null) return formatarDuracao(duracaoMinutos);
  return tempoLegado || '—';
};
