import { KEYS, read, write, remove } from './storage';
import { usersRepository } from './index';
import { perfilAtivoValido } from '../domain/perfis';
import type { AuthSession, Role, User } from '../types/domain';

/** O que uma sessão restaurada devolve. `user` nulo significa "ninguém logado". */
export interface SessaoAtiva {
  user: User | null;
  perfilAtivo: Role | null;
}

export const sessionRepository = {
  /**
   * Restaura a sessão a partir do que está gravado.
   *
   * 0.20.0 — duas mudanças:
   *
   * 1. **A pessoa é procurada no repositório**, não mais em `HOMOLOG_USERS`. Enquanto a busca
   *    era feita no array estático do código, quem fosse cadastrado pela Administração
   *    simplesmente não existia para a sessão: o Admin criava um usuário que nunca conseguia
   *    entrar. É o que torna o cadastro de gestores e monitores realmente utilizável.
   *
   * 2. **O perfil ativo é revalidado.** O perfil lembrado só vale enquanto a pessoa ainda o
   *    tiver — o Admin pode revogá-lo depois que a sessão foi aberta, e honrar a escolha
   *    antiga daria acesso a telas que já não são dela. Sem perfil válido não há sessão.
   */
  load: (): SessaoAtiva => {
    const saved = read<AuthSession | null>(KEYS.authSession, null);
    if (!saved) return { user: null, perfilAtivo: null };

    const user = usersRepository.load().find((u) => u.email === saved.email) || null;
    const perfilAtivo = perfilAtivoValido(user, saved.perfilAtivo);

    if (!user || !perfilAtivo) return { user: null, perfilAtivo: null };
    return { user, perfilAtivo };
  },

  save: (user: User, perfilAtivo: Role): void => {
    write(KEYS.authSession, { email: user.email, perfilAtivo });
  },

  clear: (): void => {
    remove(KEYS.authSession);
  },
};
