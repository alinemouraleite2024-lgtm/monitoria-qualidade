// Colaboradora inativa não recebe monitoria nova (29/10/2026).
//
// A desativação da colaboradora fictícia do teste (script 11b) mostrou que o formulário listava
// TODAS as colaboradoras, inclusive as inativas, e que o banco aceitava monitoria nova para elas.
// A regra: inativa não aparece para seleção e não recebe monitoria NOVA — nem pelo formulário,
// nem pela importação. O que já existe continua como está: a monitoria antiga de uma colaboradora
// que depois ficou inativa abre, é editada (se ainda for rascunho), enviada, validada, devolvida,
// reprovada e cancelada normalmente. É a mesma regra do gatilho do script 16 — o banco é quem
// decide; aqui o portal só evita oferecer o que o banco vai recusar.

import type { Collaborator } from '../types/domain';

/**
 * Colaboradoras que o formulário oferece para seleção: as ativas, mais a já vinculada à monitoria
 * em edição (se ela tiver ficado inativa depois), para que a monitoria antiga continue mostrando
 * quem foi avaliada.
 */
export const colaboradorasSelecionaveis = (todas: Collaborator[], jaVinculadaId?: string): Collaborator[] =>
  todas.filter((c) => c.active !== false || (!!jaVinculadaId && c.id === jaVinculadaId));

/** Rótulo da opção: a inativa mantida numa monitoria antiga aparece marcada. */
export const rotuloColaboradora = (c: Collaborator): string => (c.active === false ? `${c.name} (inativa)` : c.name);

/**
 * A colaboradora escolhida está inativa e a gravação criaria vínculo NOVO com ela (monitoria nova,
 * ou troca de colaboradora num rascunho). Manter a colaboradora que a monitoria já tinha não conta.
 */
export const vinculoNovoComInativa = (colab: Collaborator | undefined, jaVinculadaId?: string): boolean =>
  !!colab && colab.active === false && colab.id !== jaVinculadaId;

export const mensagemColaboradoraInativa = (nome: string): string =>
  `${nome} está inativa no cadastro e não recebe monitoria nova. As monitorias antigas dela continuam consultáveis. ` +
  'Se ela voltou à equipe, peça ao Administrador para reativá-la.';
