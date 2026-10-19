// Para onde a pessoa vai depois de entrar (login novo ou sessão restaurada).
//
// Até aqui, a rota /login devolvia todo perfil para `location.state.from || PATH_ENTRADA`
// (`/monitorings`). Desde a 0.20.0 o ADMIN não tem acesso a /monitorings — e o primeiro ADMIN
// do ambiente compartilhado (19/10/2026) caiu num "acesso negado" logo após o MFA. O mapa
// ENTRADA_POR_PERFIL já existia, mas só era usado na troca de perfil.
//
// Esta função NÃO decide acesso: ela só escolhe o destino, consultando a MESMA regra do
// RouteGuard (tabPermissionMap + PERMISSIONS). Quem barra continua sendo o RouteGuard na tela
// e, de verdade, o banco (RLS do 07 — ADMIN só em aal2).
import { PERMISSIONS } from '../constants/auth';
import type { Role } from '../types/domain';
import { ENTRADA_POR_PERFIL, PATH_ENTRADA, PATH_LOGIN, pathToTab } from './paths';
import { tabPermissionMap } from './routeAccess';

/** Entrada do perfil ativo; sem perfil conhecido, a entrada geral (comportamento anterior). */
export const entradaDoPerfil = (perfil: Role | null | undefined): string =>
  (perfil && ENTRADA_POR_PERFIL[perfil]) || PATH_ENTRADA;

/** O perfil ativo pode abrir esta rota? Mesma regra do RouteGuard: rota sem entrada = negada. */
export const perfilPodeAbrir = (perfil: Role | null | undefined, caminho: string): boolean => {
  const { tab } = pathToTab(caminho);
  if (!tab || !Object.prototype.hasOwnProperty.call(tabPermissionMap, tab)) return false;
  const permissao = tabPermissionMap[tab];
  if (permissao === null) return true;
  return Boolean(perfil) && (PERMISSIONS[permissao] as readonly string[] | undefined)?.includes(perfil as string) === true;
};

/**
 * Destino depois de entrar: a rota pretendida antes do login, se o perfil ativo puder abri-la;
 * senão, a entrada do próprio perfil. `/`, `/home` e `/login` contam como "sem rota pretendida".
 */
export const destinoAposEntrar = (perfil: Role | null | undefined, pretendida?: string | null): string => {
  const entrada = entradaDoPerfil(perfil);
  const limpa = (pretendida ?? '').replace(/\/+$/, '');
  if (!limpa || limpa === '/home' || limpa === PATH_LOGIN) return entrada;
  return perfilPodeAbrir(perfil, limpa) ? limpa : entrada;
};
