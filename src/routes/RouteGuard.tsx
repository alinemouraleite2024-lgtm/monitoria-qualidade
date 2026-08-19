import { hasPermission } from '../auth';
import { tabPermissionMap } from './routeAccess';
import { AccessDeniedScreen } from '../shared/components/AccessDeniedScreen';
import type { ReactNode } from 'react';
import type { AnyRole } from '../types/domain';

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
  role: AnyRole;
  children?: ReactNode;
}

export const RouteGuard = ({ tab, role, children }: RouteGuardProps) => {
  const declarada = Object.prototype.hasOwnProperty.call(tabPermissionMap, tab);
  if (!declarada) return <AccessDeniedScreen />;

  const reqPerm = tabPermissionMap[tab];
  if (reqPerm && !hasPermission(role, reqPerm)) return <AccessDeniedScreen />;

  return children ?? null;
};
