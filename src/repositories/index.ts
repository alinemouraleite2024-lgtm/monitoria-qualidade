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
import type { Criterion, LegacyMonitoring, Monitoring } from '../types/domain';

// Migrações silenciosas aplicadas no carregamento de monitorias.
// Transcritas do inicializador anterior à F0-12 sem alteração de regra: convertem dados
// gravados por versões antigas da aplicação. Remover isto corromperia sessões existentes.
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
  const migradas = result as unknown as Monitoring[];
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
const CRITERIA_VERSION = 3;

const CLASSIFICACAO_0_16: Record<string, { opcoes: string[]; active?: boolean }> = {
  'crit-01': { opcoes: ['Informação', 'Solicitação', 'Reclamação', 'Sugestão'] },
  'crit-02': { opcoes: ['Ativo', 'Receptivo'] },
  'crit-03': { opcoes: ['WhatsApp', 'Telefone', 'Presencial', 'E-mail'], active: false },
};

/** Critério nascido na 0.18.0. Inserido se ainda não existir na base gravada. */
const CRITERIO_29 = INITIAL_CRITERIA.find((c) => c.id === 'crit-29');

const migrateCriterios: Loader<Criterion[]> = (stored, persist) => {
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

  persist(next);
  write(KEYS.criteriaVersion, CRITERIA_VERSION);
  return next;
};

// --- Coleções ---
export const areasRepository = createRepository(KEYS.areas, INITIAL_AREAS);
export const collaboratorsRepository = createRepository(KEYS.collaborators, OFFICIAL_COLLABORATORS);
export const usersRepository = createRepository(KEYS.users, OFFICIAL_USERS);
export const criteriaRepository = createRepository(KEYS.criteria, INITIAL_CRITERIA, migrateCriterios);
export const allocationsRepository = createRepository(KEYS.allocations, INITIAL_ALLOCATIONS);
export const allocationHistoryRepository = createRepository(KEYS.allocationHistory, INITIAL_ALLOCATION_HISTORY);
export const monitorGoalsRepository = createRepository(KEYS.monitorGoals, INITIAL_MONITOR_GOALS);
export const colaboradorGoalsRepository = createRepository(KEYS.colaboradorGoals, INITIAL_COLABORADOR_GOALS);
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
export const settingsRepository = createRepository(KEYS.settings, INITIAL_SYSTEM_SETTINGS);

// --- Sessão (ciclo de vida próprio) ---
export { sessionRepository } from './sessionRepository';
