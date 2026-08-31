// Vocabulário de canais — fonte única do que o usuário lê.
//
// Decisão de produto: a operação fala "ligação", o dado guarda `Telefone`. Obrigar a equipe a traduzir mentalmente a cada tela é atrito diário, e trocar o valor gravado exigiria
// migrar todas as monitorias já registradas.
//
// A separação entre valor e rótulo é a saída, mas ela só funciona com UM dono. O canal é
// exibido em nove pontos diferentes da aplicação — formulário, filtro, tabela, detalhe, Home,
// Dashboard, modal de critérios, CSV e PDF. Se cada um decidir seu texto, o sistema passa a
// dizer "Ligação" na tela e "Telefone" no relatório que a gestora envia por e-mail, e alguém
// vai perguntar se são canais diferentes.
//
// Nada aqui é regra de negócio: é vocabulário. O que conta, o que abate meta e o que é de quem
// continua em src/domain.

import type { Canal } from '../types/domain';

/** Todos os canais, na ordem em que devem ser oferecidos ao usuário. */
export const CANAIS: Canal[] = ['WhatsApp', 'Telefone', 'Teams', 'Presencial', 'E-mail', 'Chat'];

/**
 * Rótulo de exibição de cada canal.
 *
 * `Telefone` é o único caso em que rótulo e valor divergem — e é divergência deliberada.
 */
const ROTULOS: Record<Canal, string> = {
  WhatsApp: 'WhatsApp',
  Telefone: 'Ligação',
  Teams: 'Teams',
  Presencial: 'Presencial',
  'E-mail': 'E-mail',
  Chat: 'Chat',
};

/**
 * Como o canal deve aparecer para o usuário, em qualquer tela ou arquivo exportado.
 *
 * Valor desconhecido é devolvido como veio, em vez de virar vazio ou "undefined": dado
 * legado ou digitado fora do domínio deve continuar legível.
 */
export const canalLabel = (canal?: string | null): string => {
  if (!canal) return '';
  return ROTULOS[canal as Canal] ?? canal;
};
