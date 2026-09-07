// Metas herdadas de um plano com vigência (0.23.0).
//
// O problema: a meta era cadastrada mês a mês. Cinco colaboradoras × doze competências são
// sessenta cadastros por ano para dizer sempre a mesma coisa, e a gestora que esquecesse um mês
// deixava a competência sem denominador — o progresso daquele mês simplesmente não existia.
//
// O modelo: o **plano** é o padrão; a **exceção** é o mês que fugiu dele. `ColaboradorGoal` não
// mudou de forma — passou a ser a exceção. Foi por isso que esta versão não teve migração: o que
// já estava gravado continua valendo, agora lido como exceção.
//
// A resolução acontece aqui e devolve algo que se parece exatamente com o que `goalService` já
// consumia. É o que permitiu que Painel, Relatórios, fila e todo o goalService ficassem sem
// nenhuma alteração: eles não sabem que herança existe.

import type { ColaboradorGoal, PlanoMetas } from '../types/domain';
import type { Period } from './period';
import { periodToCompetencia, previousPeriod } from './period';

/** Meta resolvida, com a origem que a tela de Metas usa para desenhar o chip. */
export interface MetaEfetiva extends ColaboradorGoal {
  origem: 'plano' | 'excecao';
  /**
   * Alvo que o plano previa, presente só quando a linha é exceção E existe plano por trás.
   * Alimenta o chip "Ajustada · plano 5" — sem plano, não se inventa um valor de comparação.
   */
  alvoDoPlano?: number;
}

/** Linha declarada "sem meta neste mês". Não é meta: a tela desenha, o cálculo ignora. */
export interface SemMetaEfetiva {
  monitorId: string;
  colaboradorId: string;
  motivo?: string;
}

export interface MetasDoPeriodo {
  /** O que alimenta `goalService`. Nunca contém linhas de "sem meta". */
  metas: MetaEfetiva[];
  /** Só para a tela de Metas. */
  semMeta: SemMetaEfetiva[];
}

const chave = (monitorId: string, colaboradorId: string) => `${monitorId}::${colaboradorId}`;

/** O plano que cobre a competência. `null` quando nenhum cobre — situação normal, não erro. */
export const getPlanoVigente = (planos: PlanoMetas[], period: Period): PlanoMetas | null => {
  const c = periodToCompetencia(period);
  return planos.find((p) => p.vigenciaInicio <= c && c <= p.vigenciaFim) ?? null;
};

/**
 * Metas efetivas de uma competência.
 *
 * A sobreposição é **por colaboradora**, não por linha. Se o plano dá a alguém 5 de WhatsApp e 5
 * de Ligação e a exceção do mês é uma meta geral de 30, a exceção precisa substituir as duas
 * linhas — sobrepor uma só faria coexistirem meta geral e meta por canal, que é exatamente o
 * estado que `assertMetasConsistentes` proíbe desde a 2A.6.3.
 */
export const resolverMetasDoPeriodo = (
  planos: PlanoMetas[],
  excecoes: ColaboradorGoal[],
  period: Period,
): MetasDoPeriodo => {
  const competencia = periodToCompetencia(period);

  const doMes = excecoes.filter((g) => g.year === period.year && g.month === period.month);
  const colaboradorasComExcecao = new Set(doMes.map((g) => chave(g.monitorId, g.colaboradorId)));

  const plano = getPlanoVigente(planos, period);

  // Alvo previsto pelo plano, por colaboradora — só para o comparativo do chip.
  const alvoPrevisto = new Map<string, number>();
  if (plano) {
    for (const linha of plano.linhas) {
      if (linha.entraEm && linha.entraEm > competencia) continue;
      const k = chave(linha.monitorId, linha.colaboradorId);
      alvoPrevisto.set(k, (alvoPrevisto.get(k) ?? 0) + linha.targetQty);
    }
  }

  const metas: MetaEfetiva[] = [];
  const semMeta: SemMetaEfetiva[] = [];

  for (const g of doMes) {
    const k = chave(g.monitorId, g.colaboradorId);
    if (g.semMeta) {
      semMeta.push({ monitorId: g.monitorId, colaboradorId: g.colaboradorId, motivo: g.motivo });
      continue;
    }
    metas.push({
      ...g,
      origem: 'excecao',
      ...(alvoPrevisto.has(k) ? { alvoDoPlano: alvoPrevisto.get(k) } : {}),
    });
  }

  if (plano) {
    for (const linha of plano.linhas) {
      const k = chave(linha.monitorId, linha.colaboradorId);
      // Exceção manda: quem tem ajuste ou "sem meta" no mês não herda nada do plano.
      if (colaboradorasComExcecao.has(k)) continue;
      // Quem entra no meio da vigência não aparece nas competências anteriores à entrada.
      if (linha.entraEm && linha.entraEm > competencia) continue;

      metas.push({
        // Id sintético e estável: as chaves de React e `getEscopoProgresso` precisam de um id,
        // e uma linha de plano não existe como registro gravado.
        id: `plano:${plano.id}:${linha.colaboradorId}:${linha.canal ?? 'geral'}`,
        monitorId: linha.monitorId,
        colaboradorId: linha.colaboradorId,
        year: period.year,
        month: period.month,
        targetQty: linha.targetQty,
        ...(linha.canal ? { canal: linha.canal } : {}),
        origem: 'plano',
      });
    }
  }

  return { metas, semMeta };
};

/**
 * Sucessão de planos — como a edição não reescreve o passado.
 *
 * Editar um plano em curso não altera meses decorridos: o plano corrente é encerrado na
 * competência anterior e um novo nasce da competência atual em diante. Sem isso, mudar a meta em
 * dezembro reavaliaria agosto, setembro e outubro contra um alvo que não valia quando o trabalho
 * foi feito — e o cumprimento histórico mudaria sem que ninguém soubesse por quê.
 *
 * Dois casos não sucedem, e sim editam no lugar:
 * - plano cuja vigência ainda não começou (não há passado a congelar);
 * - plano que já começa na competência corrente (suceder deixaria o anterior com fim antes do
 *   início — uma vigência vazia).
 */
export const sucederPlano = (
  plano: PlanoMetas,
  linhasNovas: PlanoMetas['linhas'],
  period: Period,
  autor: string,
): { substitui: PlanoMetas; novo?: PlanoMetas } => {
  const corrente = periodToCompetencia(period);

  if (plano.vigenciaInicio >= corrente) {
    return { substitui: { ...plano, linhas: linhasNovas } };
  }

  const fimDoAnterior = periodToCompetencia(previousPeriod(period));
  return {
    substitui: { ...plano, vigenciaFim: fimDoAnterior },
    novo: {
      id: `plano-${Date.now()}`,
      nome: plano.nome,
      vigenciaInicio: corrente,
      vigenciaFim: plano.vigenciaFim,
      linhas: linhasNovas,
      criadoPor: autor,
      criadoEm: new Date().toISOString(),
    },
  };
};

/**
 * Rede de proteção sobre os planos gravados, no padrão de `assertMetasConsistentes` e
 * `assertRouteAccessIsConsistent`: um erro de cadastro não pode virar regra silenciosa.
 *
 * Vigências sobrepostas são o estado proibido aqui — com dois planos cobrindo agosto, a meta
 * herdada dependeria da ordem do array.
 */
export const assertPlanosConsistentes = (planos: PlanoMetas[]): string[] => {
  const violacoes: string[] = [];
  const ordenados = [...planos].sort((a, b) => a.vigenciaInicio.localeCompare(b.vigenciaInicio));

  for (const p of ordenados) {
    if (p.vigenciaFim < p.vigenciaInicio) {
      violacoes.push(`${p.nome}: vigência termina antes de começar (${p.vigenciaInicio} a ${p.vigenciaFim})`);
    }
  }

  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    const seguinte = ordenados[i + 1];
    if (seguinte.vigenciaInicio <= atual.vigenciaFim) {
      violacoes.push(
        `${atual.nome} e ${seguinte.nome} cobrem a mesma competência — dois planos ativos no mesmo mês`,
      );
    }
  }

  return violacoes;
};

/** `true` quando a vigência proposta colide com algum plano existente. Recusa na criação. */
export const vigenciaColide = (
  planos: PlanoMetas[],
  inicio: string,
  fim: string,
  ignorarId?: string,
): boolean =>
  planos.some((p) => p.id !== ignorarId && inicio <= p.vigenciaFim && p.vigenciaInicio <= fim);
