// Quem valida o quê, e quando uma monitoria precisa de validação (0.20.0).
//
// Duas regras moravam espalhadas e olhavam para o papel de quem estava logado:
//
//  - o status inicial saía de `role === 'MONITOR' ? 'Pendente' : 'Validada'`, o que fazia a
//    mesma monitoria nascer validada ou pendente conforme quem a salvasse;
//  - a validação era liberada por `role === 'GESTOR' || role === 'ADMIN'`, sem olhar de quem
//    era a monitoria.
//
// Aqui as duas passam a depender do **fluxo configurado** e do **vínculo do registro**, não do
// papel de quem clicou. A diferença aparece quando alguém acumula perfis: o resultado deixa de
// mudar conforme o contexto em que a pessoa estava.

import type { Area, Monitoring, MonitoringStatus, Role, SystemSettings, User } from '../types/domain';

/**
 * Gestor responsável pelo trabalho de um monitor, via área.
 *
 * A área é a unidade de escopo desde a 0.17.0: ela declara o gestor (`gestorId`) e os monitores
 * (`monitorIds`). Devolve `null` quando ninguém responde por aquele monitor — o que é uma
 * situação real e não um erro: uma área recém-criada não tem gestor.
 */
export const getGestorDaArea = (monitorId: string, areas: Area[]): string | null => {
  const area = areas.find((a) => a.active && (a.monitorIds || []).includes(monitorId));
  return area?.gestorId || null;
};

/**
 * Status com que uma monitoria nasce ao ser concluída.
 *
 * Decisão da 0.20.0: **o papel de quem salva não entra na conta.**
 *
 *  - existe gestor para a área  -> 'Pendente', sempre. Havendo quem valide, valida-se.
 *  - não existe gestor          -> decide `requireGestorValidation`.
 *
 * O segundo caso é o que deixa o fluxo mal configurado visível em vez de silencioso: com o
 * parâmetro ligado e nenhum gestor cadastrado, a monitoria fica pendente e ninguém pode
 * liberá-la. É proposital — `temGestorConfigurado` existe para que a interface avise antes de
 * salvar, e para que a Administração mostre quantas monitorias estão nessa situação.
 */
export const resolverStatusInicial = (params: {
  isDraft: boolean;
  monitorId: string;
  areas: Area[];
  settings: Pick<SystemSettings, 'requireGestorValidation'>;
}): MonitoringStatus => {
  if (params.isDraft) return 'Rascunho';
  if (getGestorDaArea(params.monitorId, params.areas)) return 'Pendente';
  return params.settings.requireGestorValidation ? 'Pendente' : 'Validada';
};

/** `true` quando há gestor respondendo pelo monitor — usado pelos avisos da interface. */
export const temGestorConfigurado = (monitorId: string, areas: Area[]): boolean =>
  getGestorDaArea(monitorId, areas) !== null;

export interface ResultadoValidacao {
  pode: boolean;
  motivo?: string;
}

/**
 * Se esta pessoa, no contexto atual, pode aprovar, devolver ou confirmar eliminatório.
 *
 * Duas barreiras independentes:
 *
 * 1. **Perfil ativo** — validar é ato de gestão. Quem acumula GESTOR e MONITOR precisa estar
 *    no contexto GESTOR; o ADMIN não valida em nenhum contexto, porque administrar o sistema
 *    não é responder pela qualidade de uma avaliação.
 *
 * 2. **Autoria** — ninguém valida a própria monitoria, quaisquer que sejam seus perfis. A
 *    regra é de imparcialidade, não de hierarquia: acumular perfis não pode virar caminho
 *    para autoaprovação, ou o acúmulo enfraqueceria justamente a rastreabilidade que a
 *    separação entre monitorar e validar existe para proteger.
 */
export const podeValidar = (
  user: User | null | undefined,
  perfilAtivo: Role | null | undefined,
  monitoring: Monitoring | null | undefined,
): ResultadoValidacao => {
  if (!user || !monitoring) return { pode: false };

  if (perfilAtivo !== 'GESTOR') {
    return { pode: false, motivo: 'A validação é feita no perfil Gestor.' };
  }

  if (monitoring.monitorId === user.id) {
    return {
      pode: false,
      motivo: 'Você realizou esta monitoria. A validação cabe a outro gestor.',
    };
  }

  return { pode: true };
};
