// Modo compartilhado: o portal lê e grava no banco do Supabase em vez do localStorage.
//
// Liga sozinho quando o build tem as duas variáveis de ambiente (VITE_SUPABASE_URL e
// VITE_SUPABASE_ANON_KEY). Sem elas, o portal continua exatamente como era — localStorage —, e é
// isso que garante que publicar este código sem configurar a Vercel não muda nada para ninguém.
//
// No modo compartilhado o localStorage do portal antigo (chaves pm2_*) é INTOCÁVEL: nada é lido
// para a tela, nada é gravado, nada é apagado. Os dados de lá só saem pela migração (script 09).

interface AmbienteVite {
  env?: Record<string, string | undefined>;
}

const ambiente = (): Record<string, string | undefined> => (import.meta as unknown as AmbienteVite).env ?? {};

export const configSupabase = (): { url: string; chave: string } => ({
  url: ambiente().VITE_SUPABASE_URL ?? '',
  chave: ambiente().VITE_SUPABASE_ANON_KEY ?? '',
});

let forcadoEmTeste: boolean | null = null;

export const modoCompartilhado = (): boolean => {
  if (forcadoEmTeste !== null) return forcadoEmTeste;
  const { url, chave } = configSupabase();
  return Boolean(url && chave);
};

/** Só para os testes automatizados (Node não tem import.meta.env). */
export const definirModoParaTeste = (valor: boolean | null): void => {
  forcadoEmTeste = valor;
};
