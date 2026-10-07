import { KEYS, read, write } from './storage';
import { createRepository } from './createRepository';
import type { Loader } from './createRepository';
import {
  DEFAULT_BRAND_CONFIG,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_AREAS,
  INITIAL_CRITERIA,
  INITIAL_ALLOCATIONS,
  INITIAL_ALLOCATION_HISTORY,
  INITIAL_MONITOR_GOALS,
  INITIAL_COLABORADOR_GOALS,
  INITIAL_MONITORINGS,
  INITIAL_HOLIDAYS,
  INITIAL_DEMANDS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AGENDA,
} from '../mockData';
import { OFFICIAL_USERS, OFFICIAL_COLLABORATORS } from '../teamData';
import { REGUA_VALIDADA } from '../constants/regua';
import {
  OFFICIAL_EMPREENDIMENTOS,
  OFFICIAL_CATEGORIAS,
  OFFICIAL_CATEGORIAS_V1,
} from '../constants/catalogData';
import { competenciaDe } from '../domain/period';
import type { Criterion, LegacyMonitoring, Monitoring, PlanoMetas, Role, SystemSettings, User } from '../types/domain';

// Migrações silenciosas aplicadas no carregamento de monitorias.
// Transcritas do inicializador anterior à F0-12 sem alteração de regra: convertem dados
// gravados por versões antigas da aplicação. Remover isto corromperia sessões existentes.
const MONITORINGS_COMPETENCIA_VERSION = 1;

const migrateMonitorings = (
  parsed: Monitoring[],
  persist: (value: Monitoring[]) => void,
): Monitoring[] => {
  if (!Array.isArray(parsed)) return parsed;
  let needsSave = false;

  // Fronteira legada, declarada uma única vez: o que está gravado pode não satisfazer
  // Monitoring — nota na escala 0-10, tipo 'Fluxo' ou 'Fluxo / Processo'. É exatamente isso
  // que as duas migrações abaixo convertem. As expressões são cópia literal da versão
  // anterior à F0-15: nenhuma comparação foi alterada, nem para agradar o compilador.
  let result = parsed as unknown as LegacyMonitoring[];

  // Migração 1: pontuações antigas de 0-10 para 0-100.
  // Limitação herdada (não corrigida aqui, por paridade): a condição olha o valor, não uma
  // marca de versão no registro. Uma monitoria legitimamente avaliada com nota entre 1 e 10
  // na escala 0-100 volta a ser multiplicada. Corrigir exige versionar cada registro —
  // mudança de regra, fora do escopo da F0-12.
  if (result.some((m) => m.finalScore <= 10 && m.finalScore > 0)) {
    result = result.map((m) => {
      if (m.finalScore <= 10) {
        m.finalScore = m.finalScore * 10;
        if (m.scores) {
          // O `typeof number` é da 0.16.0 e não é zelo excessivo: `score` também guarda ''
          // (não respondido) e, desde a 0.16.0, o texto de uma classificação. Sem a guarda,
          // `'' <= 10` é verdadeiro e `'' * 10` vale 0 — o que transformaria "não respondido"
          // em zero, e zero num eliminatório significa "Sim, ocorreu".
          m.scores = m.scores.map((s) =>
            typeof s.score === 'number' && s.score <= 10 ? { ...s, score: s.score * 10 } : s,
          );
        }
      }
      return m;
    });
    needsSave = true;
  }

  // Migração 2: padronização de tipos de monitoria (Fluxo / Fluxo / Processo -> Processo)
  if (result.some((m) => m.tipo === 'Fluxo' || m.tipo === 'Fluxo / Processo')) {
    result = result.map((m) => {
      if (m.tipo === 'Fluxo' || m.tipo === 'Fluxo / Processo') {
        m.tipo = 'Processo';
      }
      return m;
    });
    needsSave = true;
  }

  // Única asserção de tipo da camada, e deliberada: aqui termina a fronteira legada. As duas
  // migrações acima são exatamente o que converte LegacyMonitoring em Monitoring.
  let migradas = result as unknown as Monitoring[];

  // Migração 3 (0.22.0) — competência explícita.
  //
  // `competencia = date.slice(0, 7)` **preserva exatamente o comportamento atual**: até aqui a
  // competência já era o mês de `date`, deduzido a cada leitura. Nenhuma monitoria muda de mês;
  // o que muda é que o eixo passa a estar declarado em vez de inferido de um campo cujo rótulo
  // na tela era só "Data".
  //
  // Marcador próprio, como as demais desta família: converter um campo não pode disparar a
  // limpeza geral do armazenamento.
  if (read<number>(KEYS.monitoringsCompetenciaVersion, 0) < MONITORINGS_COMPETENCIA_VERSION) {
    migradas = migradas.map((m) =>
      m.competencia ? m : { ...m, competencia: competenciaDe(m.date) },
    );
    write(KEYS.monitoringsCompetenciaVersion, MONITORINGS_COMPETENCIA_VERSION);
    needsSave = true;
  }

  if (needsSave) persist(migradas);
  return migradas;
};

/**
 * Troca do vocabulário do catálogo de categorias (0.14.0).
 *
 * O seed de um repositório só vale quando a chave NÃO existe no armazenamento. Como
 * `pm2_catalog_categorias` passa a existir assim que alguém cria uma categoria pelo formulário,
 * trocar a constante não bastaria: em um navegador que já gravou a chave, a lista antiga
 * ficaria congelada para sempre.
 *
 * O único mecanismo existente para forçar releitura era `DATABASE_VERSION` — que apaga TODAS as
 * chaves `pm2_*`, incluindo monitorias, metas, vínculos e critérios. Usá-lo para atualizar um
 * catálogo seria destruir a base para trocar uma lista. Daí este loader, com marcador de versão
 * próprio: ele escreve exatamente duas chaves e não lê nenhuma outra.
 *
 * O marcador é uma versão, não uma inspeção de conteúdo — diferente da limitação registrada em
 * `migrateMonitorings`, aqui a migração sabe se já rodou e é idempotente de fato.
 */
const CATEGORIAS_VERSION = 2;

const migrateCategorias: Loader<string[]> = (stored, persist) => {
  if (read<number>(KEYS.catalogCategoriasVersion, 0) >= CATEGORIAS_VERSION) return stored;
  if (!Array.isArray(stored)) return stored;

  // Sobrevive só o que a operação criou à mão: nem lista velha (descartada), nem lista nova
  // (já presente). Categoria inventada no formulário é decisão de quem usa, não ruído.
  const extras = stored.filter(
    (c) => !OFFICIAL_CATEGORIAS_V1.includes(c) && !OFFICIAL_CATEGORIAS.includes(c),
  );
  const next = [...OFFICIAL_CATEGORIAS, ...extras];

  persist(next);
  write(KEYS.catalogCategoriasVersion, CATEGORIAS_VERSION);
  return next;
};

/**
 * Classificação dos critérios de FORMAS DO CONTATO (0.16.0).
 *
 * Os três critérios de classificação nasceram `MULTIPLA_ESCOLHA` mas sem lugar para guardar as
 * opções — elas só existiam em prosa, dentro de `orientacao`. Sem opções, a tela caía na escala
 * pontuável e o motivo do contato aparecia como 2/1/0/N/A, como se fosse nota.
 *
 * Este loader leva `opcoes` para os critérios já gravados e desativa o critério 3, cujo dado o
 * Canal da etapa 1 já captura.
 *
 * **Só toca esses três, e só nesses campos.** Orientação, peso, âncoras e qualquer edição feita
 * pelo Admin em qualquer critério ficam intactas: o cadastro da 3A.0 vai morar aqui, e uma
 * migração que sobrescrevesse o registro inteiro apagaria esse trabalho.
 */
const CRITERIA_VERSION = 4;

const CLASSIFICACAO_0_16: Record<string, { opcoes: string[]; active?: boolean }> = {
  'crit-01': { opcoes: ['Informação', 'Solicitação', 'Reclamação', 'Sugestão'] },
  'crit-02': { opcoes: ['Ativo', 'Receptivo'] },
  'crit-03': { opcoes: ['WhatsApp', 'Telefone', 'Presencial', 'E-mail'], active: false },
};

/** Critério nascido na 0.18.0. Inserido se ainda não existir na base gravada. */
const CRITERIO_29 = INITIAL_CRITERIA.find((c) => c.id === 'crit-29');

const migrarReguaValidada: Loader<Criterion[]> = (stored, persist) => {
  const versaoAtual = read<number>(KEYS.criteriaVersion, 0);
  if (versaoAtual >= CRITERIA_VERSION) return stored;
  if (!Array.isArray(stored)) return stored;

  let next = stored.map((c) => {
    const opc = CLASSIFICACAO_0_16[c.id];
    const regua = REGUA_VALIDADA[c.id];
    if (!opc && !regua) return c;

    const atualizado: Criterion = { ...c };

    // 0.16.0 — opções da classificação e desativação do critério de canal.
    if (opc) {
      atualizado.opcoes = c.opcoes && c.opcoes.length > 0 ? c.opcoes : opc.opcoes;
      if (opc.active !== undefined) atualizado.active = opc.active;
    }

    // 0.18.0 — a régua validada. **Só preenche o que estiver ausente**: a governança passou a
    // ser da operação, e sobrescrever aqui apagaria edição feita no Admin.
    if (regua) {
      if (!atualizado.ancoras && regua.ancoras) atualizado.ancoras = regua.ancoras;
      if (!atualizado.quandoNA && regua.quandoNA) atualizado.quandoNA = regua.quandoNA;

      // `orientacao` é exceção declarada: existe na régua apenas para os critérios 14 e 27,
      // cujo texto no `Padrão Relatório` era cópia errada do 13 e do 28. Corrigir um valor
      // sabidamente errado não é o mesmo que sobrescrever cadastro.
      if (regua.orientacao) atualizado.orientacao = regua.orientacao;

      if (regua.subPerguntas && atualizado.subPerguntas) {
        atualizado.subPerguntas = atualizado.subPerguntas.map((sp) => {
          const r = regua.subPerguntas!.find((x: { id: string }) => x.id === sp.id);
          if (!r || sp.criterioSim) return sp;
          return { ...sp, criterioSim: r.criterioSim, criterioNao: r.criterioNao };
        });
      }
    }

    return atualizado;
  });

  if (CRITERIO_29 && !next.some((c) => c.id === 'crit-29')) {
    next = [...next, CRITERIO_29];
  }

  // 0.21.0 — `minExpectedScore` sai do registro. Era um número na escala 0-10, aposentada pela
  // 0.14.0, e nunca foi lido por cálculo nenhum: não entrava na nota, na régua, na validação
  // nem na instrução do assistente. Deixá-lo gravado manteria na base um campo que a próxima
  // pessoa a ler o dado tentaria interpretar como regra.
  next = next.map((c) => {
    const registro = c as Criterion & { minExpectedScore?: number };
    if (!('minExpectedScore' in registro)) return c;
    const limpo = { ...registro };
    delete limpo.minExpectedScore;
    return limpo as Criterion;
  });

  persist(next);
  write(KEYS.criteriaVersion, CRITERIA_VERSION);
  return next;
};

const SUB24_VERSION = 1;
const SUB_PESQUISA_SATISFACAO = 'sub-24-3';

/**
 * Remove do crit-24 a sub-pergunta "Realizou incentivo à pesquisa de satisfação?" (0.24.1).
 *
 * A operação descontinuou o procedimento, e manter a pergunta penalizava o atendente por não
 * executar uma ação que deixou de existir. O peso do critério não muda: ele passa a valer
 * 0, 1 ou 2, sem os intermediários de 0,67 e 1,33.
 *
 * **Marcador próprio, deliberadamente.** O caminho óbvio seria incrementar `CRITERIA_VERSION`,
 * mas aquele guarda o bloco inteiro das 0.16.0 e 0.18.0 — e reprocessá-lo força `active` nos
 * critérios de classificação e sobrescreve a `orientacao` dos critérios 14 e 27. Numa base
 * onde a operação já administra a régua, isso apagaria edição feita na tela. A regra desta
 * fase é a mesma de sempre: alcançar o que precisa ser alcançado, e nada além.
 *
 * Grava uma cópia do critério antes de alterá-lo. Não é paranoia: `pm2_criteria` é o dado
 * mais caro da base e não tem cópia automática.
 *
 * Idempotente nos dois sentidos — se a sub-pergunta já não existir (base nova, ou removida à
 * mão pelo Admin), nada é alterado; e o marcador impede que a verificação se repita a cada
 * carregamento.
 *
 * Não toca monitorias. As respostas gravadas mantêm `sub-24-3` dentro de `subRespostas` como
 * chave órfã, que o formulário ignora por ler apenas as sub-perguntas cadastradas, e nenhuma
 * nota é recalculada: `finalScore` é gravado no registro, não derivado na leitura.
 */
const removerPesquisaSatisfacao: Loader<Criterion[]> = (stored, persist) => {
  if (read<number>(KEYS.criteriaSub24Version, 0) >= SUB24_VERSION) return stored;
  if (!Array.isArray(stored)) return stored;

  const alvo = stored.find((c) => c.id === 'crit-24');
  const presente = alvo?.subPerguntas?.some((sp) => sp.id === SUB_PESQUISA_SATISFACAO);

  if (!alvo || !presente) {
    // Nada a remover. O marcador é gravado mesmo assim, para que a verificação não se repita.
    write(KEYS.criteriaSub24Version, SUB24_VERSION);
    return stored;
  }

  write(KEYS.criteriaSub24Backup, { em: new Date().toISOString(), criterio: alvo });

  const next = stored.map((c) => (
    c.id === 'crit-24'
      ? { ...c, subPerguntas: (c.subPerguntas || []).filter((sp) => sp.id !== SUB_PESQUISA_SATISFACAO) }
      : c
  ));

  persist(next);
  write(KEYS.criteriaSub24Version, SUB24_VERSION);
  return next;
};

/**
 * As duas migrações de critérios, em sequência e com marcadores independentes.
 *
 * Independentes porque têm alcances diferentes: uma completa a régua validada, a outra retira
 * uma sub-pergunta. Uma base que já passou pela primeira não deve reprocessá-la para receber
 * a segunda.
 */
const migrateCriterios: Loader<Criterion[]> = (stored, persist) =>
  removerPesquisaSatisfacao(migrarReguaValidada(stored, persist), persist);

// 0.20.0 — de um papel para vários.
//
// Converte `role` em `perfis` nos usuários já gravados. Roda uma vez, guardada por marcador
// próprio: trocar a forma de um campo não pode disparar a limpeza geral do armazenamento.
//
// A conta 'usr-1' é a única exceção nomeada, e não é privilégio: até a 0.19.0 ela acumulava
// administração e monitoria por meio de `getMonitors()` incluir ADMIN. A migração apenas
// escreve no dado o que já era verdade no comportamento — sem isso, quem já usava o sistema
// perderia a carteira ao atualizar.
const USERS_PERFIS_VERSION = 1;

const migrateUsuarios: Loader<User[]> = (stored, persist) => {
  const versaoAtual = read<number>(KEYS.usersPerfisVersion, 0);
  if (versaoAtual >= USERS_PERFIS_VERSION) return stored;
  if (!Array.isArray(stored)) return stored;

  const next = stored.map((u) => {
    // Já convertido (base nova, ou seed): não reprocessa.
    if (Array.isArray((u as User).perfis)) return u;

    const legado = (u as unknown as { role?: string }).role;
    const perfis: Role[] =
      u.id === 'usr-1' ? ['ADMIN', 'MONITOR']
      : legado === 'ADMIN' || legado === 'GESTOR' || legado === 'MONITOR' ? [legado]
      // 'COLABORADOR' e qualquer valor desconhecido viram lista vazia: sem perfil, sem acesso
      // — que é exatamente o que o login já fazia com esses registros.
      : [];

    // `role` sai do registro. Manter os dois campos deixaria a base com duas respostas para a
    // mesma pergunta, e a divergência apareceria na primeira edição feita pelo Admin.
    const resto = { ...(u as User & { role?: string }) };
    delete resto.role;
    return { ...resto, perfis } as User;
  });

  persist(next);
  write(KEYS.usersPerfisVersion, USERS_PERFIS_VERSION);
  return next;
};

// --- Coleções ---
export const areasRepository = createRepository(KEYS.areas, INITIAL_AREAS);
export const collaboratorsRepository = createRepository(KEYS.collaborators, OFFICIAL_COLLABORATORS);
export const usersRepository = createRepository(KEYS.users, OFFICIAL_USERS, migrateUsuarios);
export const criteriaRepository = createRepository(KEYS.criteria, INITIAL_CRITERIA, migrateCriterios);
export const allocationsRepository = createRepository(KEYS.allocations, INITIAL_ALLOCATIONS);
export const allocationHistoryRepository = createRepository(KEYS.allocationHistory, INITIAL_ALLOCATION_HISTORY);
export const monitorGoalsRepository = createRepository(KEYS.monitorGoals, INITIAL_MONITOR_GOALS);
export const colaboradorGoalsRepository = createRepository(KEYS.colaboradorGoals, INITIAL_COLABORADOR_GOALS);
// Seed vazio de propósito: o plano descreve a operação de uma empresa, não a estrutura do
// sistema. Gravá-lo no código faria toda base nova nascer com metas que não são dela.
export const planosMetasRepository = createRepository<PlanoMetas[]>(KEYS.planosMetas, []);
export const monitoringsRepository = createRepository(KEYS.monitorings, INITIAL_MONITORINGS, migrateMonitorings);
export const holidaysRepository = createRepository(KEYS.holidays, INITIAL_HOLIDAYS);
export const demandsRepository = createRepository(KEYS.demands, INITIAL_DEMANDS);
export const announcementsRepository = createRepository(KEYS.announcements, INITIAL_ANNOUNCEMENTS);
export const agendaRepository = createRepository(KEYS.agenda, INITIAL_AGENDA);
export const catalogEmpreendimentosRepository = createRepository(KEYS.catalogEmpreendimentos, OFFICIAL_EMPREENDIMENTOS);
export const catalogCategoriasRepository = createRepository(
  KEYS.catalogCategorias,
  OFFICIAL_CATEGORIAS,
  migrateCategorias,
);

// --- Singletons de configuração ---
export const brandRepository = createRepository(KEYS.brand, DEFAULT_BRAND_CONFIG);

/**
 * Preenche parâmetros de negócio que nasceram depois da base (0.24.0).
 *
 * Não é migração e não usa marcador de versão: `read` devolve o que está gravado, e um
 * singleton gravado antes da 0.24.0 simplesmente não tem `defasagemCompetencia`. Preencher
 * na leitura é idempotente e não destrói nada — o oposto de `DATABASE_VERSION`, que apaga.
 *
 * O valor escolhido é 1 porque é o que a operação já praticava à mão antes de existir campo.
 */
const completarSettings: Loader<SystemSettings> = (stored) => ({
  ...stored,
  defasagemCompetencia:
    typeof stored?.defasagemCompetencia === 'number' && stored.defasagemCompetencia >= 0
      ? stored.defasagemCompetencia
      : INITIAL_SYSTEM_SETTINGS.defasagemCompetencia,
});

export const settingsRepository = createRepository(KEYS.settings, INITIAL_SYSTEM_SETTINGS, completarSettings);

// --- Sessão (ciclo de vida próprio) ---
export { sessionRepository } from './sessionRepository';
