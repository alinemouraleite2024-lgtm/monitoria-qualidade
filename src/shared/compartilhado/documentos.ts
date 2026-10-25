// Gravação das coleções de `public.documentos` no modo compartilhado: metas por colaboradora e
// planos de metas.
//
// O portal antigo regravava a coleção inteira a cada mudança. Com duas pessoas usando o mesmo
// banco, isso faria o último a salvar apagar o trabalho do outro. Aqui a tela continua
// produzindo a lista nova inteira — os handlers não mudaram de forma —, mas o que vai ao banco
// é só a DIFERENÇA, item a item:
//
//   item novo                 → inclusão
//   item com conteúdo mudado  → alteração com a versão lida (MI409 se alguém mexeu antes)
//   item que saiu da lista    → `ativo = false` (remoção lógica: o 05 não apaga nada)
//
// Quem pode gravar é o banco que decide (07: só GESTOR inclui e altera documentos).
import type { Transporte } from './transporte';
import { ErroBanco } from './transporte';

/** Versão e posição de cada item carregado, por coleção e id. */
export type IndiceDocumentos = Record<string, { chave: string; versao: number; ordem: number }>;

const k = (colecao: string, id: string) => `${colecao}/${id}`;

type Linha = Record<string, unknown>;

/** Índice dos documentos ativos, a partir das linhas lidas do banco. */
export const indexarDocumentos = (linhas: Linha[]): IndiceDocumentos => {
  const indice: IndiceDocumentos = {};
  for (const l of linhas) {
    if (l.ativo === false) continue;
    const conteudo = (l.conteudo ?? {}) as Linha;
    const id = typeof conteudo.id === 'string' && conteudo.id ? conteudo.id : String(l.id);
    indice[k(String(l.colecao), id)] = { chave: String(l.id), versao: Number(l.versao), ordem: Number(l.ordem) };
  }
  return indice;
};

/** Texto canônico (chaves em ordem): o jsonb do banco não preserva a ordem das chaves. */
const canonico = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Linha).filter((c) => (v as Linha)[c] !== undefined).sort()
      .map((c) => `${JSON.stringify(c)}:${canonico((v as Linha)[c])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
};

/** Retira `undefined` (o jsonb não tem) e devolve um objeto simples. */
const limpo = (v: object): Linha => JSON.parse(JSON.stringify(v)) as Linha;

export interface Operacao {
  tipo: 'incluir' | 'alterar' | 'retirar';
  id: string;
}

/** O que mudou entre a lista carregada e a lista nova. Puro: não fala com o banco. */
export const diferencas = <T extends { id: string }>(antes: T[], depois: T[]): Operacao[] => {
  const ids = new Set<string>();
  for (const item of depois) {
    if (!item.id) throw new Error('Item sem id: não é possível gravar no banco compartilhado.');
    if (ids.has(item.id)) throw new Error(`Id repetido na lista: ${item.id}.`);
    ids.add(item.id);
  }
  const porId = new Map(antes.map((a) => [a.id, a]));
  const ops: Operacao[] = [];
  for (const item of depois) {
    const anterior = porId.get(item.id);
    if (!anterior) ops.push({ tipo: 'incluir', id: item.id });
    else if (canonico(anterior) !== canonico(item)) ops.push({ tipo: 'alterar', id: item.id });
  }
  for (const a of antes) if (!ids.has(a.id)) ops.push({ tipo: 'retirar', id: a.id });
  return ops;
};

/**
 * Grava a diferença de uma coleção. Para na primeira recusa do banco e diz quantas operações
 * já tinham entrado — a tela recarrega do banco em seguida, então o que aparece é o que ficou.
 */
export const gravarColecao = async <T extends { id: string }>(
  t: Transporte,
  colecao: 'metas_colaborador' | 'planos_metas',
  indice: IndiceDocumentos,
  antes: T[],
  depois: T[],
): Promise<number> => {
  const ops = diferencas(antes, depois);
  const porId = new Map(depois.map((d) => [d.id, d]));
  let proximaOrdem = Math.max(-1, ...Object.entries(indice)
    .filter(([chave]) => chave.startsWith(`${colecao}/`)).map(([, v]) => v.ordem)) + 1;

  let feitas = 0;
  for (const op of ops) {
    const reg = indice[k(colecao, op.id)];
    try {
      if (op.tipo === 'incluir') {
        await t.incluir('documentos', { colecao, id: op.id, conteudo: limpo(porId.get(op.id)!), ordem: proximaOrdem++ });
      } else {
        if (!reg) throw new ErroBanco('MI428', 'Versão do item não encontrada. Recarregue a página e refaça a alteração.');
        const valores = op.tipo === 'alterar' ? { conteudo: limpo(porId.get(op.id)!) } : { ativo: false };
        await t.alterar('documentos', { colecao, id: reg.chave }, valores, reg.versao);
      }
      feitas += 1;
    } catch (e) {
      if (e instanceof ErroBanco && ops.length > 1) {
        throw new ErroBanco(e.codigo, `${e.message}\n\n${feitas} de ${ops.length} alterações já tinham sido gravadas; a tela foi recarregada com o que está no banco.`, e.dica);
      }
      throw e;
    }
  }
  return feitas;
};
