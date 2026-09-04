import { hasPermission } from '../auth';
import { tabPermissionMap } from './routeAccess';
import { AccessDeniedScreen } from '../shared/components/AccessDeniedScreen';
import type { ReactNode } from 'react';
import type { Role } from '../types/domain';

// Guard de rota (F0-14). Ponto único de decisão de acesso da aplicação: nenhuma tela decide
// sozinha se pode ser exibida.
//
// Regra: rota sem entrada em tabPermissionMap é tratada como NEGADA, não como liberada. É a
// inversão que fecha o buraco encontrado na F0-13 — antes, esquecer de declarar a permissão
// deixava a rota aberta a qualquer papel autenticado.
//
// Limitação conhecida da Fase 0: esta barreira é client-side e vale como usabilidade, não como
// segurança. O reforço real depende do backend (Fase 1).
interface RouteGuardProps {
  tab: string;
  /** Perfil ATIVO, não os perfis que a pessoa possui: é o contexto atual que decide. */
  perfil: Role | null;
  children?: ReactNode;
}

export const RouteGuard = ({ tab, perfil, children }: RouteGuardProps) => {
  const declarada = Object.prototype.hasOwnProperty.call(tabPermissionMap, tab);
  if (!declarada) return <AccessDeniedScreen />;

  const reqPerm = tabPermissionMap[tab];
  if (reqPerm && !hasPermission(perfil, reqPerm)) return <AccessDeniedScreen />;

  return children ?? null;
};
