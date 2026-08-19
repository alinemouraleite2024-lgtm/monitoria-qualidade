import { KEYS } from './storage';
import { createRepository } from './createRepository';
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
import { OFFICIAL_EMPREENDIMENTOS, OFFICIAL_CATEGORIAS } from '../constants/catalogData';
import type { LegacyMonitoring, Monitoring } from '../types/domain';

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
          m.scores = m.scores.map((s) => ({ ...s, score: s.score <= 10 ? s.score * 10 : s.score }));
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

// --- Coleções ---
export const areasRepository = createRepository(KEYS.areas, INITIAL_AREAS);
export const collaboratorsRepository = createRepository(KEYS.collaborators, OFFICIAL_COLLABORATORS);
export const usersRepository = createRepository(KEYS.users, OFFICIAL_USERS);
export const criteriaRepository = createRepository(KEYS.criteria, INITIAL_CRITERIA);
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
export const catalogCategoriasRepository = createRepository(KEYS.catalogCategorias, OFFICIAL_CATEGORIAS);

// --- Singletons de configuração ---
export const brandRepository = createRepository(KEYS.brand, DEFAULT_BRAND_CONFIG);
export const settingsRepository = createRepository(KEYS.settings, INITIAL_SYSTEM_SETTINGS);

// --- Sessão (ciclo de vida próprio) ---
export { sessionRepository } from './sessionRepository';
