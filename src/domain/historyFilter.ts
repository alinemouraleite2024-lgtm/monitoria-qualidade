// O filtro do histórico de Relatórios — um predicado, um dono.
//
// 2B.5: até aqui os cinco filtros viviam como estado interno da MonitoringList, e as
// exportações usavam outro caminho. O efeito era uma mentira silenciosa: a gestora filtrava a
// tabela por "Status: Pendente", via 2 linhas, e o botão continuava dizendo "Exportar 4
// registros" — e exportava 4.
//
// É a mesma classe de problema que a Fatia 2A resolveu nas regras de contagem: a mesma decisão
// escrita em dois lugares diverge. A regra agora é uma só, e tabela, CSV e PDF a consomem.
//
// Isto não é regra de negócio — é consulta. Não decide o que conta para meta nem de quem é a
// colaboradora; decide o que o usuário pediu para ver. Mora em domain porque precisa ser
// compartilhado entre a tela e a exportação, não porque seja regra.

import type { Collaborator, Monitoring } from '../types/domain';

export interface FiltrosHistorico {
  /** Código, protocolo ou nome da colaboradora. Vazio não filtra. */
  busca: string;
  /** Id da monitora, ou 'ALL'. */
  monitorId: string;
  /** Canal, ou 'ALL'. */
  canal: string;
  /** Status, ou 'ALL'. */
  status: string;
  /** Dia específico em YYYY-MM-DD. Vazio não filtra. */
  data: string;
}

export const FILTROS_VAZIOS: FiltrosHistorico = {
  busca: '',
  monitorId: 'ALL',
  canal: 'ALL',
  status: 'ALL',
  data: '',
};

export const temFiltroAtivo = (f: FiltrosHistorico): boolean =>
  f.busca.trim() !== '' ||
  f.monitorId !== 'ALL' ||
  f.canal !== 'ALL' ||
  f.status !== 'ALL' ||
  f.data !== '';

/**
 * Os registros que o usuário pediu para ver.
 *
 * O que sai daqui é exatamente o que a tabela mostra e o que as exportações levam. Se alguém
 * precisar de uma variação, ela entra nesta função — nunca num filtro paralelo na tela.
 */
export const aplicaFiltrosDeHistorico = (
  monitorings: Monitoring[],
  filtros: FiltrosHistorico,
  collaborators: Collaborator[] = []
): Monitoring[] => {
  const termo = filtros.busca.trim().toLowerCase();

  return monitorings.filter((m) => {
    if (filtros.monitorId !== 'ALL' && m.monitorId !== filtros.monitorId) return false;
    if (filtros.canal !== 'ALL' && m.canal !== filtros.canal) return false;
    if (filtros.status !== 'ALL' && m.status !== filtros.status) return false;
    if (filtros.data && !m.date.startsWith(filtros.data)) return false;

    if (termo) {
      const colab = collaborators.find((c) => c.id === m.colaboradorId);
      const alvo = [
        colab?.name ?? '',
        m.id,
        m.protocolo ?? '',
      ].join(' ').toLowerCase();
      if (!alvo.includes(termo)) return false;
    }

    return true;
  });
};
