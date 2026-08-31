// Escopo de visão por papel — quem enxerga o trabalho de quem.
//
// Até a 0.16.0 não havia escopo: a fila de validação era global no período, e qualquer gestão
// via tudo. Funcionava porque havia uma gestora só. Com vários gestores isso deixa de ser
// simplificação e vira vazamento: o gestor de uma área acompanharia — e validaria — monitorias
// de equipes que não são dele.
//
// A unidade de escopo é a **Área**: ela já declara o gestor responsável (`gestorId`) e, desde a
// 0.17.0, os monitores que a compõem (`monitorIds`). Não foi preciso inventar vínculo novo.

import { ROLES } from '../constants/auth';
import type { Area, User } from '../types/domain';

/**
 * Ids dos monitores que um usuário pode acompanhar.
 *
 * `null` significa **sem restrição** — e é diferente de lista vazia, que significa "não
 * acompanha ninguém". Confundir os dois é o erro que transformaria um gestor recém-cadastrado,
 * ainda sem área, em alguém que vê a operação inteira.
 */
export const getEquipeDoGestor = (
  user: User | null | undefined,
  areas: Area[],
): string[] | null => {
  if (!user) return [];
  // ADMIN acumula administração e operação: vê tudo, por definição do papel.
  if (user.role === ROLES.ADMIN) return null;
  if (user.role !== ROLES.GESTOR) return [user.id];

  const ids = areas
    .filter((a) => a.active && a.gestorId === user.id)
    .flatMap((a) => a.monitorIds || []);

  return [...new Set(ids)];
};

/** `true` quando o usuário pode acompanhar o trabalho daquele monitor. */
export const podeVerMonitor = (
  user: User | null | undefined,
  areas: Area[],
  monitorId: string,
): boolean => {
  const equipe = getEquipeDoGestor(user, areas);
  return equipe === null || equipe.includes(monitorId);
};
