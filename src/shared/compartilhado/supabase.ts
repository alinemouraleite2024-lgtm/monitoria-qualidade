// Cliente oficial do Supabase e a implementação do Transporte para o navegador.
//
// Chave usada: a pública do projeto (anon / publishable). Ela não dá acesso a nada sozinha —
// sem login, a RLS do 07 não libera tabela nenhuma, e o schema `api` não é executável pelo
// anônimo (08). A chave secreta (service_role) NUNCA entra no portal.
//
// A sessão do Supabase fica numa chave própria do localStorage, separada das chaves pm2_* do
// portal antigo, que este modo não toca.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configSupabase } from './modo';
import { ErroBanco, type Transporte } from './transporte';

const CHAVE_SESSAO = 'monitoria-sessao-supabase';
const PAGINA = 1000; // limite padrão de linhas por resposta da Data API

let cliente: SupabaseClient | null = null;

export const clienteSupabase = (): SupabaseClient => {
  if (!cliente) {
    const { url, chave } = configSupabase();
    if (!url || !chave) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
    cliente = createClient(url, chave, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: CHAVE_SESSAO, detectSessionInUrl: false },
    });
  }
  return cliente;
};

const erro = (e: { code?: string; message?: string; hint?: string | null } | null): ErroBanco =>
  new ErroBanco(e?.code || 'ERRO', e?.message || 'Erro ao falar com o banco.', e?.hint || '');

export const transporteSupabase = (): Transporte => {
  const sb = clienteSupabase();
  return {
    async selecionar<T>(tabela: string): Promise<T[]> {
      const todas: T[] = [];
      for (let de = 0; ; de += PAGINA) {
        const { data, error } = await sb.from(tabela).select('*').range(de, de + PAGINA - 1);
        if (error) throw erro(error);
        todas.push(...((data ?? []) as T[]));
        if (!data || data.length < PAGINA) return todas;
      }
    },
    async chamar<T>(funcao: string, args: Record<string, unknown>): Promise<T> {
      const { data, error } = await sb.schema('api').rpc(funcao, args);
      if (error) throw erro(error);
      return data as T;
    },
    async incluir(tabela: string, linha: Record<string, unknown>): Promise<void> {
      const { error } = await sb.from(tabela).insert(linha);
      if (error) throw erro(error);
    },
  };
};

// ---- sessão (Supabase Auth) ---------------------------------------------------------------
export interface LoginAtual {
  authUserId: string;
  email: string;
  /** aal2 = entrou com MFA. Exigido para ADMIN (07). */
  nivel: string | null;
}

const doToken = (token: string | undefined): string | null => {
  try {
    if (!token) return null;
    const corpo = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof corpo.aal === 'string' ? corpo.aal : null;
  } catch {
    return null;
  }
};

export const entrarComSenha = async (email: string, senha: string): Promise<LoginAtual> => {
  const { data, error } = await clienteSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  // Falha de rede não é senha errada: dizer "senha inválida" sem conexão levaria a pessoa a
  // trocar uma senha que está certa.
  if (error && (error.status === 0 || /fetch/i.test(error.name ?? ''))) {
    throw new ErroBanco('CONEXAO', 'Não foi possível falar com o servidor do MonitorIA. Verifique a internet e tente de novo.');
  }
  if (error || !data.session) throw new ErroBanco('LOGIN', 'E-mail ou senha inválidos.');
  return { authUserId: data.session.user.id, email: data.session.user.email ?? '', nivel: doToken(data.session.access_token) };
};

export const loginRestaurado = async (): Promise<LoginAtual | null> => {
  const { data } = await clienteSupabase().auth.getSession();
  const s = data.session;
  return s ? { authUserId: s.user.id, email: s.user.email ?? '', nivel: doToken(s.access_token) } : null;
};

/** Regras mínimas da senha nova (a do Supabase pode ser mais rígida; aí vale a dele). */
export const problemaDaSenhaNova = (atual: string, nova: string, confirmacao: string): string | null => {
  if (nova !== confirmacao) return 'A confirmação não é igual à nova senha.';
  if (nova.length < 10) return 'A nova senha precisa ter pelo menos 10 caracteres.';
  if (nova === atual) return 'A nova senha precisa ser diferente da atual.';
  return null;
};

/**
 * Troca a própria senha. Confirma a senha atual antes (quem só encontrou o computador
 * desbloqueado não troca a senha de ninguém) e grava a nova no Supabase Auth — a senha nunca
 * passa pelo banco do MonitorIA nem fica no navegador.
 */
export const trocarSenha = async (email: string, atual: string, nova: string): Promise<void> => {
  const sb = clienteSupabase();
  const { error: conferida } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: atual });
  if (conferida) {
    if (conferida.status === 0 || /fetch/i.test(conferida.name ?? '')) throw new ErroBanco('CONEXAO', 'Não foi possível falar com o servidor do MonitorIA. Verifique a internet e tente de novo.');
    throw new ErroBanco('SENHA_ATUAL', 'A senha atual não confere.');
  }
  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) throw new ErroBanco('SENHA', `A senha não foi alterada: ${error.message}`);
};

export const sairDoSupabase = async (): Promise<void> => {
  await clienteSupabase().auth.signOut();
};
