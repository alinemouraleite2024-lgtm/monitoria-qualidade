// Perfis de uma pessoa e qual deles está ativo (0.20.0).
//
// Até a 0.19.0 o sistema tinha um papel por usuário, e a Aline — que administra e monitora —
// só cabia nesse modelo por meio de uma regra: `getMonitors()` incluía ADMIN. A regra resolvia
// o caso dela e criava outro problema, porque *todo* ADMIN passava a contar como monitor.
//
// Aqui a acumulação vira dado: `User.perfis` diz o que a pessoa pode ser, e o perfil ativo da
// sessão diz o que ela é agora. Quem monitora, monitora porque tem o perfil MONITOR — não
// porque o sistema deduziu isso de outro papel.

import type { Role, User } from '../types/domain';

/**
 * Ordem de precedência para escolher o perfil inicial de quem tem mais de um.
 *
 * O trabalho diário vem primeiro: quem monitora entra monitorando. Administrar é episódico, e
 * abrir o sistema na tela de configuração faria a exceção parecer a rotina.
 */
export const PRECEDENCIA: Role[] = ['MONITOR', 'GESTOR', 'ADMIN'];

/** Perfis da pessoa, na ordem de precedência — a ordem do cadastro não é significativa. */
export const perfisDe = (user: User | null | undefined): Role[] => {
  if (!user?.perfis) return [];
  return PRECEDENCIA.filter((p) => user.perfis.includes(p));
};

export const temPerfil = (user: User | null | undefined, perfil: Role): boolean =>
  perfisDe(user).includes(perfil);

/** `true` quando faz sentido oferecer troca de contexto — nunca para quem tem um perfil só. */
export const temMultiplosPerfis = (user: User | null | undefined): boolean =>
  perfisDe(user).length > 1;

/** Perfil de entrada de quem ainda não escolheu um contexto. `null` = sem acesso ao portal. */
export const perfilPadrao = (user: User | null | undefined): Role | null =>
  perfisDe(user)[0] ?? null;

/**
 * Resolve qual perfil deve ficar ativo, dado o que a sessão guardou.
 *
 * O perfil lembrado só vale enquanto a pessoa ainda o tiver: o Admin pode revogar um perfil
 * depois que a sessão foi aberta, e continuar honrando a escolha antiga daria acesso a telas
 * que não são mais dela. Quando o lembrado não serve, cai para o padrão; quando não sobra
 * nenhum, devolve null e o chamador encerra a sessão.
 */
export const perfilAtivoValido = (
  user: User | null | undefined,
  lembrado: Role | null | undefined,
): Role | null => {
  const disponiveis = perfisDe(user);
  if (lembrado && disponiveis.includes(lembrado)) return lembrado;
  return disponiveis[0] ?? null;
};

/** Rótulo de exibição. Concentrado aqui para não divergir entre menu, topo e perfil. */
export const ROTULO_PERFIL: Record<Role, string> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  MONITOR: 'Monitor',
};
