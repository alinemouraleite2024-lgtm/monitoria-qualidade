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
import type { EstadoDoAcesso } from './mfa';

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
    async alterar(tabela: string, chave: Record<string, unknown>, valores: Record<string, unknown>, versaoLida: number): Promise<number> {
      const { data, error } = await sb.from(tabela).update({ ...valores, versao_lida: versaoLida }).match(chave).select('versao');
      if (error) throw erro(error);
      if (!data || data.length !== 1) throw new ErroBanco('42501', 'O banco não aceitou a alteração (registro não encontrado ou sem permissão).');
      return Number((data[0] as { versao: number }).versao);
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

// ---- segundo fator (MFA/TOTP) — P2 ---------------------------------------------------------
// O banco exige aal2 do ADMIN (07). Estas funções só conduzem o cadastro e a verificação; o
// segredo TOTP e o QR code nunca são gravados no navegador nem no banco do MonitorIA.

const erroMfa = (e: { status?: number; name?: string; message?: string } | null, padrao: string): ErroBanco => {
  if (e && (e.status === 0 || /fetch/i.test(e.name ?? ''))) {
    return new ErroBanco('CONEXAO', 'Não foi possível falar com o servidor do MonitorIA. Verifique a internet e tente de novo.');
  }
  return new ErroBanco('MFA', padrao);
};

/**
 * Estado do acesso da própria sessão (api.estado_do_meu_acesso, script 12). Devolve `null` se o
 * script 12 ainda não estiver aplicado no banco — aí o portal segue o fluxo anterior, e o banco
 * continua barrando o ADMIN sem aal2 do mesmo jeito.
 */
export const estadoDoAcesso = async (t: Transporte): Promise<EstadoDoAcesso | null> => {
  try {
    return await t.chamar<EstadoDoAcesso>('estado_do_meu_acesso', {});
  } catch (e) {
    if (e instanceof ErroBanco && ['PGRST202', '42883'].includes(e.codigo)) return null;
    throw e;
  }
};

/**
 * Avisa a cada renovação automática do token (a cada ~1 h, pelo supabase-js). Só esse evento:
 * entrada, saída e troca de senha continuam pelos fluxos que já existiam. Devolve o cancelamento.
 */
export const aoRenovarSessao = (aviso: () => void): (() => void) => {
  const { data } = clienteSupabase().auth.onAuthStateChange((evento) => {
    if (evento === 'TOKEN_REFRESHED') setTimeout(aviso, 0);   // fora do callback do supabase-js
  });
  return () => data.subscription.unsubscribe();
};

export interface CadastroMfa {
  factorId: string;
  /** Imagem SVG (data URL) do QR code, para o app autenticador. */
  qrCode: string;
  /** O mesmo segredo, para digitar à mão se a câmera não ler o QR. */
  segredo: string;
}

/** Inicia o cadastro de um fator TOTP. Descarta antes cadastros interrompidos (não verificados). */
export const iniciarCadastroMfa = async (apelido: string): Promise<CadastroMfa> => {
  const sb = clienteSupabase();
  const { data: lista } = await sb.auth.mfa.listFactors();
  for (const f of lista?.all ?? []) {
    if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: apelido });
  if (error || !data || data.type !== 'totp') throw erroMfa(error, 'Não foi possível iniciar o cadastro do segundo fator. Tente de novo.');
  return { factorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret };
};

/** Confirma um código TOTP para o fator (cadastro novo ou login). Devolve o login já em aal2. */
export const confirmarCodigoMfa = async (factorId: string, codigo: string): Promise<LoginAtual> => {
  const sb = clienteSupabase();
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) throw erroMfa(error, 'Código inválido ou vencido. Confira o app autenticador e digite o código atual.');
  const login = await loginRestaurado();
  if (!login || login.nivel !== 'aal2') throw new ErroBanco('MFA', 'A verificação não foi concluída. Entre novamente.');
  return login;
};

export interface FatorMfa {
  id: string;
  apelido: string;
  criadoEm: string;
}

/** Fatores TOTP verificados da própria conta. */
export const fatoresVerificados = async (): Promise<FatorMfa[]> => {
  const { data, error } = await clienteSupabase().auth.mfa.listFactors();
  if (error) throw erroMfa(error, 'Não foi possível consultar os fatores de autenticação.');
  return (data?.totp ?? []).filter((f) => f.status === 'verified')
    .map((f) => ({ id: f.id, apelido: f.friendly_name || 'Autenticador', criadoEm: f.created_at }));
};

export const sairDoSupabase = async (): Promise<void> => {
  await clienteSupabase().auth.signOut();
};
