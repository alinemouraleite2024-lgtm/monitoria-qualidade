import type { Canal, TipoResposta } from '../types/domain';

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

export const CHANNELS: Canal[] = ['Chat', 'WhatsApp', 'E-mail', 'Telefone', 'Presencial', 'Teams'];
