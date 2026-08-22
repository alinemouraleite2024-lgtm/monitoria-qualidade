// Regras de contagem de monitoria — o que conta para a meta, e o que conta à parte.
//
// Antes da 2A.2 estas regras não existiam como regra: existiam como a expressão
// `(m.status === 'Validada' || m.status === 'Concluída')` copiada inline em cinco pontos
// (App, Dashboard ×2, Planejamento, Calendário). Além de duplicada, ela estava errada de
// duas maneiras:
//
//   1. `Pendente` ficava de fora. Como a monitoria da monitora nasce `Pendente` — a
//      validação da gestora está ligada —, o trabalho feito não aparecia no progresso até
//      alguém validar. O contador exibiria zero depois de um mês inteiro de trabalho.
//   2. `Concluída` está na regra e nenhum caminho do código a grava. O formulário produz
//      `Rascunho`, `Pendente` ou `Validada`; a aprovação produz `Validada`. Metade da
//      condição era letra morta.
//
// Decisões de produto que estas funções materializam:
//   - feito conta no ENVIO, sem esperar validação;
//   - validado continua visível à parte, dentro do mesmo total;
//   - direcionada e calibração contam separadamente, sem abater quota de ninguém;
//   - reprovação reabre a lacuna.
//
// Sobre a última: ela não precisa de código. `Reprovada` simplesmente não está entre os
// status que contam, então a lacuna da colaboradora reabre sozinha. Não há regra de
// "reabrir" a escrever — há uma regra de contagem a não violar.

import type { Monitoring, MonitoringStatus, TipoMonitoria } from '../types/domain';

/**
 * Status que representam trabalho entregue.
 *
 * `Concluída` permanece por tolerância a dado antigo: nada o grava hoje, mas registros
 * anteriores podem tê-lo, e removê-lo faria essas monitorias sumirem da contagem.
 */
export const STATUS_QUE_CONTAM: MonitoringStatus[] = ['Pendente', 'Validada', 'Concluída'];

/** Tipos que não abatem a quota de nenhuma colaboradora. */
export const TIPOS_FORA_DA_CARTEIRA: TipoMonitoria[] = ['Direcionada', 'Calibração'];

/** A monitoria representa trabalho entregue? Rascunho, Reprovada e Cancelada não. */
export const countsTowardGoal = (m: Monitoring): boolean =>
  STATUS_QUE_CONTAM.includes(m.status);

/** Já passou pela validação da gestora. Subconjunto de countsTowardGoal. */
export const isValidated = (m: Monitoring): boolean => m.status === 'Validada';

/** Entregue e ainda na fila da gestora. Subconjunto de countsTowardGoal. */
export const isAwaitingValidation = (m: Monitoring): boolean => m.status === 'Pendente';

/** Abate quota de colaboradora? Direcionada e calibração não. */
export const isCarteiraType = (m: Monitoring): boolean =>
  !TIPOS_FORA_DA_CARTEIRA.includes(m.tipo);

/** Conta para a meta da carteira: trabalho entregue E de um tipo que abate quota. */
export const countsForCarteiraGoal = (m: Monitoring): boolean =>
  countsTowardGoal(m) && isCarteiraType(m);

/** Entregue, mas fora da carteira — exibida à parte para que nada desapareça em silêncio. */
export const countsOutsideCarteira = (m: Monitoring): boolean =>
  countsTowardGoal(m) && !isCarteiraType(m);
