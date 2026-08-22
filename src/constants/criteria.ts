import type { TipoResposta } from '../types/domain';

// Taxonomia oficial dos critérios de monitoria (CYF: 24 critérios + 4 eliminatórios).
// Single Source of Truth para categorias, tipos de resposta e canais aplicáveis a um Critério.

export const CRITERION_CATEGORIES: string[] = [
  'FORMAS DO CONTATO',
  'ABERTURA',
  'COMUNICAÇÃO',
  'CONHECIMENTO DO PRODUTO/SERVIÇO',
  'PRECISÃO DAS INFORMAÇÕES',
  'ENCERRAMENTO',
  'MANDOU MAL',
];

// value = armazenado no critério; label = exibido na UI.
export const RESPONSE_TYPES: { value: TipoResposta; label: string }[] = [
  { value: 'ESCALA_4', label: 'Escala (Ótimo / Bom / Regular / Ruim)' },
  { value: 'SIM_NAO', label: 'Sim / Não' },
  { value: 'CHECKLIST_SIM_NAO', label: 'Checklist (múltiplas perguntas Sim/Não)' },
  { value: 'FAIXA_TEMPO', label: 'Faixa de Tempo' },
  { value: 'MULTIPLA_ESCOLHA', label: 'Múltipla Escolha (classificação)' },
];

// Reexportado de canais.ts: duas listas de canais em arquivos diferentes é a mesma
// duplicação que a 2A eliminou nas regras de contagem. A ordem passa a ser a de CANAIS.
export { CANAIS as CHANNELS } from './canais';
