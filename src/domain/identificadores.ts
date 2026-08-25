// Identificadores de uma monitoria — geração e unicidade.
//
// Até a 0.14.0 o código da monitoria era `MON-${Math.random()*90000+10000}`, sem nenhuma
// verificação contra a base. O efeito não era um código feio: era perda de dado. O salvamento
// decide entre criar e atualizar comparando o id com os existentes
// (`monitorings.some(m => m.id === data.id)` em App), então um sorteio repetido fazia uma
// monitoria nova ser tratada como edição e **sobrescrever a anterior**, sem erro e sem aviso.
//
// Com 90.000 valores possíveis, a chance de ao menos uma colisão passa de 20% em 200 registros
// e de 50% em 350 — dentro do primeiro ano de operação.
//
// A regra aqui é a mesma para os dois identificadores: derivar do que já existe e conferir
// contra a base antes de devolver. Nenhum deles depende de sorte.

import type { Monitoring } from '../types/domain';

/** Extrai o maior número já usado num conjunto de strings, dado o padrão de captura. */
const maiorSequencial = (valores: (string | undefined)[], padrao: RegExp): number =>
  valores.reduce<number>((maior, valor) => {
    if (!valor) return maior;
    const m = padrao.exec(valor);
    if (!m) return maior;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > maior ? n : maior;
  }, 0);

/**
 * Código interno da monitoria. Mantém o formato `MON-#####` que já aparece na tabela como
 * "Código" — o que muda é como o número é escolhido: sucessor do maior existente, e não
 * sorteio.
 *
 * O laço final não é redundância defensiva: a base pode conter ids em formatos antigos
 * (`mon-1`, dos dados de exemplo) que o padrão não captura, e é ele que garante que o
 * resultado não colida com nenhum deles.
 */
export const gerarIdMonitoria = (monitorings: Monitoring[]): string => {
  const usados = new Set(monitorings.map((m) => m.id));
  const base = Math.max(10000, maiorSequencial(monitorings.map((m) => m.id), /^MON-(\d+)$/i));

  let n = base + 1;
  while (usados.has(`MON-${n}`)) n += 1;
  return `MON-${n}`;
};

/**
 * Protocolo da monitoria, no formato `MON-2026-0001`.
 *
 * Sequência por ano, tirada do ano da monitoria (`date`) e não do momento da geração: uma
 * monitoria de 2025 avaliada em 2026 entra na sequência de 2025, que é onde ela pertence.
 *
 * Protocolos anteriores à 0.15.0 foram digitados à mão e têm formato livre; o padrão não os
 * captura, então eles não interferem na sequência nem são reescritos.
 */
export const gerarProtocolo = (monitorings: Monitoring[], dataMonitoria: string): string => {
  const ano = new Date(dataMonitoria).getFullYear();
  const anoValido = Number.isFinite(ano) ? ano : new Date().getFullYear();

  const usados = new Set(monitorings.map((m) => m.protocolo).filter(Boolean));
  const padrao = new RegExp(`^MON-${anoValido}-(\\d+)$`);
  const ultimo = maiorSequencial(monitorings.map((m) => m.protocolo), padrao);

  let n = ultimo + 1;
  let candidato = `MON-${anoValido}-${String(n).padStart(4, '0')}`;
  while (usados.has(candidato)) {
    n += 1;
    candidato = `MON-${anoValido}-${String(n).padStart(4, '0')}`;
  }
  return candidato;
};
