import { KEYS, read, write, remove } from './storage';
import { HOMOLOG_USERS } from '../teamData';
import type { AuthSession, User } from '../types/domain';

// Sessão do usuário autenticado.
// Separado dos demais repositórios porque tem ciclo de vida e formato próprios:
// grava apenas { email, role }, mas devolve o usuário completo, re-resolvido na leitura.
// Comportamento idêntico ao inicializador de `currentUser` anterior à F0-12.
export const sessionRepository = {
  load: (): User | null => {
    const saved = read<AuthSession | null>(KEYS.authSession, null);
    if (!saved) return null;
    return HOMOLOG_USERS.find((u) => u.email === saved.email) || null;
  },

  save: (user: User): void => {
    write(KEYS.authSession, { email: user.email, role: user.role });
  },

  clear: (): void => {
    remove(KEYS.authSession);
  },
};
