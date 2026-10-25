// Contrato mínimo entre o portal e o banco.
//
// A camada de dados (carga e operações) fala só com esta interface. No navegador, quem a
// implementa é o cliente oficial do Supabase (transporteSupabase.ts); nos testes automatizados,
// um banco Postgres local com os mesmos scripts 00–09a, as mesmas regras RLS e as mesmas funções
// do schema `api`. Assim o teste exercita o banco de verdade, não uma imitação dele.

export interface Transporte {
  /** `select *` de uma tabela de public, já filtrado pela RLS do usuário logado. */
  selecionar<T = Record<string, unknown>>(tabela: string): Promise<T[]>;
  /** Chama uma operação do schema `api` (08). */
  chamar<T = unknown>(funcao: string, args: Record<string, unknown>): Promise<T>;
  /** Inclusão simples numa tabela de public (histórico de acessos, metas e planos). */
  incluir(tabela: string, linha: Record<string, unknown>): Promise<void>;
  /**
   * Alteração de UMA linha de public, identificada pela chave, com a versão lida (controle de
   * concorrência do 00: sem ela, MI428; divergente, MI409). Devolve a versão nova.
   *
   * A RLS não dá erro quando barra um UPDATE — ela só não encontra a linha. Por isso "nenhuma
   * linha alterada" vira erro aqui (42501): sem isso, a tela diria "salvo" sem ter salvo nada.
   */
  alterar(tabela: string, chave: Record<string, unknown>, valores: Record<string, unknown>, versaoLida: number): Promise<number>;
}

/** Erro devolvido pelo banco, com o código (MI401, MI403, MI404, MI409, MI422, MI428 ou SQLSTATE). */
export class ErroBanco extends Error {
  codigo: string;
  dica: string;

  constructor(codigo: string, mensagem: string, dica = '') {
    super(mensagem);
    this.name = 'ErroBanco';
    this.codigo = codigo;
    this.dica = dica;
  }
}

/** Mensagem para a tela. As do banco já são em português; só os casos genéricos ganham texto. */
export const mensagemDoErro = (e: unknown): string => {
  if (e instanceof ErroBanco) {
    switch (e.codigo) {
      case 'MI409':
        return 'Outra pessoa alterou esta monitoria depois que ela foi aberta. Os dados foram recarregados — confira e refaça a ação.';
      case 'MI428':
        return 'Não foi possível identificar a versão da monitoria. Recarregue a página e tente de novo.';
      case 'MI401':
        return 'Sessão sem identificação. Entre novamente.';
      case '42501':
        return 'Você não tem permissão para esta ação.';
      case 'PGRST301':
      case 'PGRST303':
        return 'Sua sessão expirou. Entre novamente.';
      default:
        return e.dica ? `${e.message}\n\n${e.dica}` : e.message;
    }
  }
  if (e instanceof TypeError && /fetch/i.test(e.message)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return e instanceof Error ? e.message : 'Erro inesperado.';
};
