// Fonte única de verdade para o conceito textual/visual de uma nota de monitoria (0-100).
// Antes desta função existirem 3 cópias divergentes em formato (App.jsx, MonitoringList.jsx,
// MonitoringForm.jsx) e uma referência quebrada (MonitoringHistory.jsx).
export interface ScoreConcept {
  label: string;
  color: string;
}

export const getScoreConcept = (score: number): ScoreConcept => {
  if (score >= 95) return { label: 'Excelente', color: '#10b981' }; // Emerald 500
  if (score >= 85) return { label: 'Muito Bom', color: '#059669' }; // Emerald 600
  if (score >= 75) return { label: 'Bom', color: '#3b82f6' }; // Blue 500
  if (score >= 50) return { label: 'Atenção', color: '#f59e0b' }; // Amber 500
  return { label: 'Crítico', color: '#ef4444' }; // Red 500
};
