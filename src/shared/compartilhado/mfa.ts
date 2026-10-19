// Segundo fator (MFA/TOTP) no modo compartilhado — a decisão de para onde a sessão vai.
//
// Quem protege os dados é o BANCO: a RLS do 07 só libera uma conta ADMIN numa sessão aal2, lida
// do token assinado pelo Supabase Auth. Esta regra só decide a TELA: liberar o portal, pedir o
// cadastro do segundo fator ou pedir o código. É a mesma regra de api.estado_do_meu_acesso (12);
// o banco devolve a etapa e o portal a confere por aqui, ficando com a mais restritiva.
//
// MONITOR e GESTOR sem fator cadastrado — o caso da Aline e do Erivan — caem sempre em
// 'liberado': o login deles não muda.

export type EtapaDeAcesso = 'liberado' | 'cadastrar_mfa' | 'verificar_mfa' | 'sem_perfil' | 'inativo';

export interface EstadoDoAcesso {
  tem_perfil: boolean;
  admin: boolean;
  ativo: boolean;
  /** aal da sessão segundo o token: 'aal1' (só senha) ou 'aal2' (senha + segundo fator). */
  nivel: string | null;
  fator_verificado: boolean;
  etapa: EtapaDeAcesso;
}

export const etapaDeAcesso = (e: Omit<EstadoDoAcesso, 'etapa'>): EtapaDeAcesso => {
  if (!e.tem_perfil) return 'sem_perfil';
  if (!e.ativo) return 'inativo';
  const aal2 = e.nivel === 'aal2';
  if (e.admin && !aal2 && !e.fator_verificado) return 'cadastrar_mfa';
  if (!aal2 && e.fator_verificado) return 'verificar_mfa';
  return 'liberado';
};

const ORDEM: EtapaDeAcesso[] = ['sem_perfil', 'inativo', 'cadastrar_mfa', 'verificar_mfa', 'liberado'];

/**
 * Etapa final: a do banco conferida pela regra local. Se discordarem, vale a mais restritiva —
 * a tela nunca libera o que o banco não liberou.
 */
export const etapaFinal = (doBanco: EstadoDoAcesso): EtapaDeAcesso => {
  const local = etapaDeAcesso(doBanco);
  const banco = ORDEM.includes(doBanco.etapa) ? doBanco.etapa : 'sem_perfil';
  return ORDEM[Math.min(ORDEM.indexOf(local), ORDEM.indexOf(banco))];
};

/** Código TOTP: exatamente 6 dígitos (espaços digitados no meio são ignorados). */
export const codigoTotpValido = (codigo: string): string | null => {
  const limpo = codigo.replace(/\s+/g, '');
  return /^\d{6}$/.test(limpo) ? limpo : null;
};
