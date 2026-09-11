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

/**
 * Meta resolvida, com a origem que a tela de Metas usa para desenhar o chip.
 *
 *   'plano'    herdada, ninguém tocou.
 *   'ajuste'   o plano mais o delta da gestão (0.25.0). `ajuste` e `alvoDoPlano` vêm junto.
 *   'excecao'  meta absoluta: competência sem plano, ou exceção anterior à 0.25.0.
 */
export interface MetaEfetiva extends ColaboradorGoal {
  origem: 'plano' | 'ajuste' | 'excecao';
  /**
   * Alvo que o plano previa, presente quando a linha foi ajustada ou substituída E existe
   * plano por trás. Alimenta o chip "Ajustada +3 · plano 5" — sem plano, não se inventa um
   * valor de comparação.
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

/** Chave do escopo: é nela que o ajuste da gestão pousa, e não na pessoa. */
const chaveEscopo = (monitorId: string, colaboradorId: string, canal?: string) =>
  `${monitorId}::${colaboradorId}::${canal ?? 'geral'}`;

/** O plano que cobre a competência. `null` quando nenhum cobre — situação normal, não erro. */
export const getPlanoVigente = (planos: PlanoMetas[], period: Period): PlanoMetas | null => {
  const c = periodToCompetencia(period);
  return planos.find((p) => p.vigenciaInicio <= c && c <= p.vigenciaFim) ?? null;
};

/**
 * Metas efetivas de uma competência.
 *
 * Desde a 0.25.0 há DOIS donos e três formas de exceção, e a granularidade de cada uma é
 * diferente — é isso que a função precisa acertar:
 *
 *   semMeta      vale pela PESSOA. Férias tiram a colaboradora do mês inteiro, em todo canal.
 *   ajuste       vale pelo ESCOPO. "+1 no WhatsApp" não toca a meta de Ligação dela.
 *   targetQty    vale pela PESSOA, e substitui o plano. É o caso sem plano, e o das exceções
 *                gravadas antes da 0.25.0 — por isso não houve migração.
 *
 * A absoluta continua substituindo a pessoa inteira pelo motivo de sempre: se o plano dá 5 de
 * WhatsApp e 5 de Ligação e a exceção é uma meta geral de 30, sobrepor só uma linha faria
 * coexistirem meta geral e meta por canal, que é o estado que `assertMetasConsistentes` proíbe
 * desde a 2A.6.3.
 *
 * Um ajuste cujo escopo saiu do plano fica órfão e é ignorado: um delta sem base não tem o que
 * ajustar, e inventar um alvo para ele seria criar meta que ninguém declarou.
 */
export const resolverMetasDoPeriodo = (
  planos: PlanoMetas[],
  excecoes: ColaboradorGoal[],
  period: Period,
): MetasDoPeriodo => {
  const competencia = periodToCompetencia(period);
  const doMes = excecoes.filter((g) => g.year === period.year && g.month === period.month);
  const plano = getPlanoVigente(planos, period);

  // Linhas do plano que valem nesta competência. Quem entra no meio da vigência não aparece
  // nas competências anteriores à entrada.
  const linhasDoPlano = plano
    ? plano.linhas.filter((l) => !(l.entraEm && l.entraEm > competencia))
    : [];

  const semMeta: SemMetaEfetiva[] = [];
  const foraDoMes = new Set<string>();
  const absolutas: ColaboradorGoal[] = [];
  const ajustes = new Map<string, ColaboradorGoal>();

  for (const g of doMes) {
    const kPessoa = chave(g.monitorId, g.colaboradorId);
    if (g.semMeta) {
      semMeta.push({ monitorId: g.monitorId, colaboradorId: g.colaboradorId, motivo: g.motivo });
      foraDoMes.add(kPessoa);
    } else if (typeof g.ajuste === 'number') {
      ajustes.set(chaveEscopo(g.monitorId, g.colaboradorId, g.canal), g);
    } else {
      absolutas.push(g);
    }
  }

  const substituidas = new Set(absolutas.map((g) => chave(g.monitorId, g.colaboradorId)));

  // Alvos do plano: por pessoa alimenta o chip da exceção absoluta, por escopo alimenta o do
  // ajuste. São contas diferentes porque as duas exceções têm granularidades diferentes.
  const alvoPorPessoa = new Map<string, number>();
  const alvoPorEscopo = new Map<string, number>();
  for (const l of linhasDoPlano) {
    const kPessoa = chave(l.monitorId, l.colaboradorId);
    alvoPorPessoa.set(kPessoa, (alvoPorPessoa.get(kPessoa) ?? 0) + l.targetQty);
    alvoPorEscopo.set(chaveEscopo(l.monitorId, l.colaboradorId, l.canal), l.targetQty);
  }

  const metas: MetaEfetiva[] = [];

  for (const g of absolutas) {
    const kPessoa = chave(g.monitorId, g.colaboradorId);
    if (foraDoMes.has(kPessoa)) continue;
    metas.push({
      ...g,
      origem: 'excecao',
      ...(alvoPorPessoa.has(kPessoa) ? { alvoDoPlano: alvoPorPessoa.get(kPessoa) } : {}),
    });
  }

  for (const linha of linhasDoPlano) {
    const kPessoa = chave(linha.monitorId, linha.colaboradorId);
    if (foraDoMes.has(kPessoa)) continue;
    if (substituidas.has(kPessoa)) continue;

    const ajuste = ajustes.get(chaveEscopo(linha.monitorId, linha.colaboradorId, linha.canal));
    // Piso de 1: o ajuste nunca zera a meta. Zerar é outra decisão, e tem mecanismo próprio —
    // "sem meta neste mês", que diz que a pessoa está fora, e não que o alvo dela é nada.
    const alvo = ajuste ? Math.max(1, linha.targetQty + (ajuste.ajuste ?? 0)) : linha.targetQty;

    metas.push({
      // Com ajuste, o id é o do registro gravado — a tela precisa dele para remover o ajuste.
      // Sem ajuste, um id sintético e estável: a linha de plano não existe como registro, e
      // as chaves de React e `getEscopoProgresso` precisam de um.
      id: ajuste ? ajuste.id : `plano:${plano!.id}:${linha.colaboradorId}:${linha.canal ?? 'geral'}`,
      monitorId: linha.monitorId,
      colaboradorId: linha.colaboradorId,
      year: period.year,
      month: period.month,
      targetQty: alvo,
      ...(linha.canal ? { canal: linha.canal } : {}),
      ...(ajuste
        ? {
            ajuste: ajuste.ajuste,
            ajustadoPor: ajuste.ajustadoPor,
            ajustadoEm: ajuste.ajustadoEm,
            origem: 'ajuste' as const,
            alvoDoPlano: linha.targetQty,
          }
        : { origem: 'plano' as const }),
    });
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
