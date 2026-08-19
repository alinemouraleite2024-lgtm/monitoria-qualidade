import type { User } from '../types/domain';

// Regras de autorização por papel.
// Extraídas do App.jsx na F0-12 sem alteração de regra.
//
// Limitação conhecida da Fase 0: esta checagem é client-side. O reforço real
// depende do backend (Fase 1) — ver histórias F0-08 e F1-10.

export const isManagerRole = (user: User | null | undefined): boolean =>
  Boolean(user && (user.role === 'GESTOR' || user.role === 'ADMIN'));
