// Importação de avaliação feita no ChatGPT — contrato `monitoria-chatgpt/1`.
//
// A monitoria continua sendo feita no ChatGPT, com o agente de qualidade e a régua oficial. Depois
// da revisão humana, o agente devolve um bloco JSON que a monitora cola na Nova Monitoria. Este
// módulo é a fronteira: lê o texto colado e devolve o que pode ser aplicado ao formulário, ou a
// lista do que impede a aplicação.
//
// O que ele NÃO faz, de propósito:
// - não grava nada. Devolve dados; quem escreve no estado do formulário é o formulário, e quem
//   grava a monitoria é o fluxo normal de salvamento;
// - não aceita a nota do ChatGPT. A nota é recalculada aqui com a mesma conta do formulário, e o
//   número do ChatGPT só serve para conferência (`conferencia.notaEsperada`);
// - não decide eliminatório. Ele lê a marcação e devolve a lista do que a monitora precisa
//   confirmar, item a item, antes de aplicar.
//
// Tudo é validado contra a régua cadastrada no sistema (`criteria`), e não contra uma cópia: se o
// Admin mudar um critério, o importador passa a exigir a régua nova sem mudança de código.
//
// Contrato documentado em docs/CONTRATO-IMPORTACAO-CHATGPT.md.

import type { Canal, Collaborator, Criterion, Monitoring, TipoMonitoria, User } from '../types/domain';
import { getCriteriosBloqueados } from './criterionGating';
import { calcularDuracao } from './duracao';
import { atendimentoJaRegistrado, possiveisDuplicidades } from './duplicidade';
import { mensagemColaboradoraInativa, vinculoNovoComInativa } from './colaboradoraAtiva';

export const SCHEMA_IMPORTACAO = 'monitoria-chatgpt/1';

const CANAIS_VALIDOS: Canal[] = ['WhatsApp', 'Telefone', 'Teams', 'Presencial', 'E-mail', 'Chat'];
/** "Ligação" é como a operação chama o canal `Telefone` — ver constants/canais. */
const SINONIMOS_CANAL: Record<string, Canal> = { ligacao: 'Telefone' };
const TIPOS_VALIDOS: TipoMonitoria[] = ['Regular', 'Direcionada', 'Processo', 'Calibração'];

/**
 * Canais sem pré-autenticação, onde o crit-29 é sempre "Não".
 *
 * Vem da orientação do crit-29 e da regra 5 do prompt operacional: só o roteiro do WhatsApp
 * autentica o cliente antes de a atendente assumir. Importa porque "Sim" no crit-29 dispensa o
 * eliminatório 25 (portão em criterionGating) — num telefonema, isso deixaria a confirmação de
 * dados de segurança sem avaliação. Foi exatamente o que aconteceu na AGO-001.
 */
export const CANAIS_SEM_PRE_AUTENTICACAO: Canal[] = ['Telefone', 'Presencial'];

/** `true` quando o crit-29 marca autenticação num canal que não autentica. */
export const violaRegraDeAutenticacao = (canal: string, respostaCrit29: unknown): boolean =>
  (CANAIS_SEM_PRE_AUTENTICACAO as string[]).includes(canal) && respostaCrit29 === 'Sim';

/**
 * Os seis blocos do relatório, com o nome que o contrato usa e o campo do formulário que recebe.
 * O contrato fala a língua do `Padrão Relatório de Monitoria`; `strengths` e `opportunities` são
 * nomes históricos do modelo, e não há motivo para o agente do ChatGPT conhecê-los.
 */
export const BLOCOS_IMPORTACAO = [
  { chave: 'contexto', campo: 'contexto', titulo: 'Contexto do Atendimento' },
  { chave: 'pontosPositivos', campo: 'strengths', titulo: 'Pontos Positivos' },
  { chave: 'pontosAtencao', campo: 'opportunities', titulo: 'Pontos de Atenção' },
  { chave: 'leituraTecnica', campo: 'leituraTecnica', titulo: 'Leitura Técnica' },
  { chave: 'errosIdentificados', campo: 'errosIdentificados', titulo: 'Erros Identificados' },
  { chave: 'conclusao', campo: 'conclusao', titulo: 'Conclusão' },
] as const;

export type CampoRelatorio = (typeof BLOCOS_IMPORTACAO)[number]['campo'];

export type Confianca = 'ALTA' | 'MEDIA' | 'BAIXA';

/** Resposta na forma em que o formulário a mantém (`ScoreEmEdicao` no MonitoringForm). */
export interface RespostaImportada {
  score: number | string;
  lowScoreReason: string;
  subRespostas: Record<string, 'SIM' | 'NAO'>;
}

/** Linha da prévia: o que vai para cada critério, e com que grau de certeza do agente. */
export interface ItemPrevia {
  criterionId: string;
  numero: number | null;
  nome: string;
  tipoResposta: Criterion['tipoResposta'];
  eliminatorio: boolean;
  /** Valor exibido na prévia — o mesmo que será gravado em `score`. */
  score: number | string;
  justificativa: string;
  confianca?: Confianca;
  revisaoHumana: boolean;
  sinalizacao?: string;
  /** Preenchido quando o portão 29→25 converteu a resposta em N/A. */
  bloqueadoPor?: string;
}

/**
 * Item que a monitora precisa confirmar individualmente antes de aplicar.
 *
 * Existe para que nenhum eliminatório — nem nenhuma resposta que o próprio agente marcou como
 * duvidosa — entre no formulário por um único clique em bloco.
 */
export interface RevisaoObrigatoria {
  criterionId: string;
  titulo: string;
  motivo: string;
  /** `true` quando a resposta importada diz que o eliminatório ocorreu. */
  grave: boolean;
}

export interface DadosAtendimento {
  colaboradorId: string;
  colaboradorNome: string;
  monitorId: string;
  competencia: string;
  /** 'YYYY-MM-DD', como o campo de data do formulário. */
  date: string;
  canal: Canal;
  categoriaAtendimento: string;
  tipo: TipoMonitoria;
  numeroAtendimento: string;
  numeroTitulo: string;
  inicioAtendimento: string;
  fimAtendimento: string;
  link?: string;
}

export interface ResultadoImportacao {
  /** Problemas que impedem a aplicação. Enquanto houver um, nada é aplicado. */
  erros: string[];
  /** Correções feitas na leitura e pontos de atenção que não bloqueiam. */
  avisos: string[];
  /** Presentes só quando não há erro. */
  dados?: DadosAtendimento;
  respostas?: Record<string, RespostaImportada>;
  relatorio?: Record<CampoRelatorio, string>;
  itens: ItemPrevia[];
  revisoes: RevisaoObrigatoria[];
  /** Monitorias já gravadas para o mesmo atendimento. Aplicar exige confirmação. */
  duplicidades: Monitoring[];
  /** Nota calculada pelo MonitorIA — nunca a do ChatGPT. */
  notaCalculada?: number;
  notaEsperada?: number;
  revisadoPor?: string;
}

export interface ContextoImportacao {
  criteria: Criterion[];
  collaborators: Collaborator[];
  currentUser: User | null;
  catalogCategorias: string[];
  monitorings: Monitoring[];
  /** Colaboradora já vinculada à monitoria em edição (vazio na monitoria nova). */
  colaboradorJaVinculadoId?: string;
}

// ---------------------------------------------------------------------------
// Utilitários de leitura
// ---------------------------------------------------------------------------

/** Comparação tolerante a caixa, acento e espaços — para nomes, nunca para ids. */
export const normalizar = (texto: unknown): string =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const textoOuVazio = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Tira o JSON de dentro do que foi colado.
 *
 * O ChatGPT costuma devolver o bloco entre crases, às vezes com uma frase antes ou depois. Pedir
 * à monitora que recorte à mão é pedir erro; o que se faz aqui é procurar o objeto.
 */
export const extrairJson = (texto: string): { valor?: unknown; erro?: string } => {
  const bruto = (texto || '').trim();
  if (!bruto) return { erro: 'Nenhum conteúdo foi colado.' };

  const semCercas = bruto.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
  const candidatos = [semCercas];
  const ini = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (ini >= 0 && fim > ini) candidatos.push(bruto.slice(ini, fim + 1));

  let ultimoErro = '';
  for (const c of candidatos) {
    try {
      return { valor: JSON.parse(c) };
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
    }
  }

  const aspasCurvas = /[“”]/.test(bruto)
    ? ' O texto tem aspas curvas (“ ”) — copie o bloco pelo botão "Copiar código" do ChatGPT, e não selecionando o texto.'
    : '';
  return {
    erro: `O conteúdo colado não é um JSON válido. Copie novamente o bloco gerado pelo ChatGPT, do "{" inicial ao "}" final.${aspasCurvas} Detalhe técnico: ${ultimoErro}`,
  };
};

const ROTULO_NUMERO = (c: Criterion) => (c.numero != null ? `critério ${c.numero}` : c.id);
const rotulo = (c: Criterion) => `${c.id} (${ROTULO_NUMERO(c)} — ${c.name})`;

/** Lê número escrito como número, "2" ou "1,33". Devolve `null` quando não é número. */
const lerNumero = (v: unknown): { n: number | null; convertido: boolean } => {
  if (typeof v === 'number' && Number.isFinite(v)) return { n: v, convertido: false };
  if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) {
    return { n: Number(v.trim().replace(',', '.')), convertido: true };
  }
  return { n: null, convertido: false };
};

const ehNA = (v: unknown) => typeof v === 'string' && /^n\s*\/\s*a$/i.test(v.trim());

/**
 * `true` quando a régua cadastrada proíbe N/A no critério.
 *
 * LIMITAÇÃO CONHECIDA: lê texto livre. `quandoNA` é prosa, e a única forma estável que a régua
 * validada usa para proibir é começar por "Nunca é N/A". O correto seria um campo estruturado
 * (`permiteNA`) no critério — fica como melhoria, porque mexer no modelo de `Criterion` foge do
 * escopo desta funcionalidade.
 */
export const naProibido = (c: Criterion): boolean => /^\s*nunca\s+(e|é)\s+n\s*\/\s*a/i.test(c.quandoNA || '');

/** Valores aceitos na escala do critério, iguais aos botões do formulário. */
const valoresDaEscala = (c: Criterion): number[] =>
  c.tipoResposta === 'FAIXA_TEMPO' ? [2, 1.33, 0.67, 0] : [2, 1, 0];

/** Mesma conta do `handleChecklistAnswer` do formulário. Não pode divergir dela. */
const scoreDoChecklist = (subs: { id: string }[], respostas: Record<string, 'SIM' | 'NAO'>): number => {
  const sim = subs.filter((s) => respostas[s.id] === 'SIM').length;
  return parseFloat(((sim / subs.length) * 2).toFixed(2));
};

/**
 * Nota final pela regra do formulário: soma de resposta × peso sobre 2 × peso, só para peso > 0
 * e resposta diferente de N/A e de vazio. Espelha o `useMemo` do MonitoringForm, que segue sendo
 * o cálculo que vale na gravação — esta função existe apenas para a prévia, e o formulário mostra
 * a nota oficial assim que a importação é aplicada.
 */
export const calcularNotaPrevia = (
  aplicaveis: Criterion[],
  respostas: Record<string, { score: number | string }>,
): number => {
  let obtido = 0;
  let possivel = 0;
  aplicaveis.forEach((c) => {
    const item = respostas[c.id];
    const peso = c.weight || 0;
    if (item && item.score !== '' && item.score !== 'N/A' && peso > 0) {
      obtido += Number(item.score) * peso;
      possivel += 2 * peso;
    }
  });
  const percent = possivel > 0 ? (obtido / possivel) * 100 : 0;
  return parseFloat(percent.toFixed(2));
};

const CONFIANCAS: Record<string, Confianca> = { alta: 'ALTA', media: 'MEDIA', baixa: 'BAIXA' };

/** Sugestões de categoria para quando o valor não está no catálogo. */
const sugerirCategorias = (valor: string, catalogo: string[]): string[] => {
  const alvo = normalizar(valor);
  // Decisão registrada em 07/10/2026 (constants/catalogData.ts): cessão de direitos é o
  // instrumento, e a categoria é TRANSFERÊNCIA DE TITULARIDADE.
  if (alvo.includes('cessao')) {
    const t = catalogo.find((c) => normalizar(c) === 'transferencia de titularidade');
    if (t) return [t];
  }
  const palavras = alvo.split(/[^a-z0-9]+/).filter((p) => p.length >= 4);
  return catalogo
    .map((c) => ({ c, pontos: palavras.filter((p) => normalizar(c).includes(p)).length }))
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 3)
    .map((x) => x.c);
};

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPETENCIA_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Formato do `datetime-local`: sem fuso. Fuso no meio deslocaria o horário em silêncio. */
const DATAHORA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

const dataValida = (s: string) => DATA_RE.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())
  && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

// Campos que pertencem ao sistema. Se vierem no JSON, são ignorados — e a monitora é avisada,
// porque um agente que manda nota final está seguindo instrução antiga.
const CAMPOS_DO_SISTEMA = ['notaFinal', 'finalScore', 'nota', 'protocolo', 'id', 'status', 'duracaoMinutos', 'conceito'];

// ---------------------------------------------------------------------------
// Validação principal
// ---------------------------------------------------------------------------

export const validarImportacao = (texto: string, ctx: ContextoImportacao): ResultadoImportacao => {
  const erros: string[] = [];
  const avisos: string[] = [];
  const vazio: ResultadoImportacao = { erros, avisos, itens: [], revisoes: [], duplicidades: [] };

  const { valor, erro } = extrairJson(texto);
  if (erro) {
    erros.push(erro);
    return vazio;
  }
  if (!ehObjeto(valor)) {
    erros.push('O JSON precisa ser um objeto, começando por "{". Copie o bloco completo gerado pelo ChatGPT.');
    return vazio;
  }
  const raiz = valor;

  // --- Versão do contrato -------------------------------------------------
  if (raiz.schema !== SCHEMA_IMPORTACAO) {
    erros.push(
      raiz.schema
        ? `Versão do formato não suportada: "${String(raiz.schema)}". Este MonitorIA lê "${SCHEMA_IMPORTACAO}". Atualize a instrução do agente do ChatGPT.`
        : `O campo "schema" está ausente. A primeira linha do JSON deve ser "schema": "${SCHEMA_IMPORTACAO}".`,
    );
    return vazio;
  }

  const ignorados = CAMPOS_DO_SISTEMA.filter((k) => k in raiz || (ehObjeto(raiz.atendimento) && k in raiz.atendimento));
  if (ignorados.length) {
    avisos.push(
      `Ignorado: ${ignorados.join(', ')}. Nota, protocolo, código e status são do MonitorIA — a nota é recalculada pelo sistema.`,
    );
  }

  const revisadoPor = textoOuVazio(raiz.revisadoPor) || undefined;

  // --- Atendimento --------------------------------------------------------
  const at = ehObjeto(raiz.atendimento) ? raiz.atendimento : null;
  if (!at) {
    erros.push('O bloco "atendimento" está ausente. Ele traz colaborador, canal, categoria, datas e identificadores.');
    return vazio;
  }

  const obrigatorio = (chave: string, nome: string): string => {
    const v = at[chave];
    if (typeof v === 'number') {
      erros.push(`${nome}: informe entre aspas ("${v}"). Como número, zeros à esquerda se perdem.`);
      return '';
    }
    const s = textoOuVazio(v);
    if (!s) erros.push(`${nome} não foi informado (campo "${chave}").`);
    return s;
  };

  // Colaborador — o id prevalece; o nome confere.
  let colaborador: Collaborator | undefined;
  const colabId = textoOuVazio(at.colaboradorId);
  const colabNome = textoOuVazio(at.colaborador);
  if (!colabId && !colabNome) {
    erros.push('Colaborador não informado. Envie "colaboradorId" (preferencial) e/ou "colaborador".');
  } else if (colabId) {
    colaborador = ctx.collaborators.find((c) => c.id === colabId);
    if (!colaborador) {
      erros.push(`Colaborador com id "${colabId}" não existe no cadastro do MonitorIA.`);
    } else if (colabNome && normalizar(colabNome) !== normalizar(colaborador.name)) {
      erros.push(
        `Colaborador divergente: o id "${colabId}" é de ${colaborador.name}, mas o nome informado é "${colabNome}". Corrija no ChatGPT qual dos dois está certo.`,
      );
      colaborador = undefined;
    }
  } else {
    const achados = ctx.collaborators.filter((c) => normalizar(c.name) === normalizar(colabNome));
    if (achados.length === 1) {
      colaborador = achados[0];
    } else if (achados.length > 1) {
      erros.push(`Há mais de um colaborador chamado "${colabNome}". Informe o "colaboradorId".`);
    } else {
      erros.push(`Colaborador "${colabNome}" não encontrado no cadastro. Confira a grafia ou informe o "colaboradorId".`);
    }
  }
  // Inativa não recebe monitoria nova (script 16); na monitoria antiga dela, só avisa.
  if (colaborador && vinculoNovoComInativa(colaborador, ctx.colaboradorJaVinculadoId)) {
    erros.push(mensagemColaboradoraInativa(colaborador.name));
    colaborador = undefined;
  } else if (colaborador && colaborador.active === false) {
    avisos.push(`${colaborador.name} está inativa no cadastro (monitoria antiga dela).`);
  }

  // Monitora — o formulário credita a monitoria a quem está logada. Se o JSON diz outra pessoa,
  // a importação gravaria trabalho de uma no nome da outra.
  const monId = textoOuVazio(at.monitoraId);
  const monNome = textoOuVazio(at.monitora);
  if (!ctx.currentUser) {
    erros.push('Não há usuária logada para receber a monitoria.');
  } else if (!monId && !monNome) {
    erros.push('Monitora não informada. Envie "monitora" com o nome de quem revisou a avaliação.');
  } else if ((monId && monId !== ctx.currentUser.id) || (!monId && normalizar(monNome) !== normalizar(ctx.currentUser.name))) {
    erros.push(
      `Esta avaliação está em nome de "${monNome || monId}", mas a sessão é de ${ctx.currentUser.name}. A monitoria é creditada a quem está logada — importe com o usuário da monitora responsável.`,
    );
  } else if (monId && monNome && normalizar(monNome) !== normalizar(ctx.currentUser.name)) {
    erros.push(`Monitora divergente: o id "${monId}" é de ${ctx.currentUser.name}, mas o nome informado é "${monNome}".`);
  }

  const competencia = obrigatorio('competencia', 'Competência');
  if (competencia && !COMPETENCIA_RE.test(competencia)) {
    erros.push(`Competência "${competencia}" fora do formato AAAA-MM (ex.: 2026-08).`);
  }

  const date = obrigatorio('dataAtendimento', 'Data do atendimento');
  if (date && !dataValida(date)) erros.push(`Data do atendimento "${date}" inválida. Use AAAA-MM-DD.`);

  // Canal
  let canal: Canal | undefined;
  const canalBruto = obrigatorio('canal', 'Canal');
  if (canalBruto) {
    canal = CANAIS_VALIDOS.find((c) => normalizar(c) === normalizar(canalBruto)) || SINONIMOS_CANAL[normalizar(canalBruto)];
    if (!canal) erros.push(`Canal "${canalBruto}" não existe. Opções: ${CANAIS_VALIDOS.join(', ')}.`);
    else if (canal !== canalBruto) avisos.push(`Canal "${canalBruto}" lido como "${canal}".`);
  }

  // Categoria
  let categoria = '';
  const categoriaBruta = obrigatorio('categoria', 'Categoria');
  if (categoriaBruta) {
    categoria = ctx.catalogCategorias.find((c) => normalizar(c) === normalizar(categoriaBruta)) || '';
    if (!categoria) {
      const sug = sugerirCategorias(categoriaBruta, ctx.catalogCategorias);
      erros.push(
        `Categoria "${categoriaBruta}" não está no catálogo.${sug.length ? ` Mais próximas: ${sug.join(' · ')}.` : ''} A importação não cria categoria nova.`,
      );
    } else if (categoria !== categoriaBruta) {
      avisos.push(`Categoria "${categoriaBruta}" lida como "${categoria}".`);
    }
  }

  // Tipo
  let tipo: TipoMonitoria | undefined;
  const tipoBruto = obrigatorio('tipo', 'Tipo de monitoria');
  if (tipoBruto) {
    tipo = TIPOS_VALIDOS.find((t) => normalizar(t) === normalizar(tipoBruto));
    if (!tipo) erros.push(`Tipo de monitoria "${tipoBruto}" não existe. Opções: ${TIPOS_VALIDOS.join(', ')}.`);
  }

  const numeroAtendimento = obrigatorio('numeroAtendimento', 'Nº do atendimento');
  const numeroTitulo = obrigatorio('numeroTitulo', 'Nº do título');

  const inicio = obrigatorio('inicioAtendimento', 'Início do atendimento');
  const fim = obrigatorio('fimAtendimento', 'Encerramento do atendimento');
  [[inicio, 'Início'], [fim, 'Encerramento']].forEach(([v, nome]) => {
    if (v && !DATAHORA_RE.test(v)) {
      erros.push(`${nome} do atendimento "${v}" fora do formato AAAA-MM-DDTHH:MM (sem fuso horário).`);
    }
  });
  if (inicio && fim && DATAHORA_RE.test(inicio) && DATAHORA_RE.test(fim) && calcularDuracao(inicio, fim) === null) {
    erros.push('O encerramento do atendimento é anterior ao início.');
  }
  if (date && inicio && DATAHORA_RE.test(inicio) && inicio.slice(0, 10) !== date) {
    erros.push(`Divergência de datas: o atendimento começa em ${inicio.slice(0, 10)}, mas a data do atendimento informada é ${date}.`);
  }
  if (competencia && inicio && DATAHORA_RE.test(inicio) && inicio.slice(0, 7) !== competencia) {
    avisos.push(
      `A competência ${competencia} difere do mês do atendimento (${inicio.slice(0, 7)}). Será mantida a competência informada — confira na etapa 1.`,
    );
  }

  const link = textoOuVazio(at.linkAtendimento) || undefined;

  // --- Critérios ----------------------------------------------------------
  const lista = raiz.criterios;
  if (!Array.isArray(lista) || lista.length === 0) {
    erros.push('O bloco "criterios" está ausente ou vazio.');
  }

  const aplicaveis = canal ? ctx.criteria.filter((c) => c.active && (c.channels as string[]).includes(canal)) : [];
  const respostas: Record<string, RespostaImportada> = {};
  const meta: Record<string, { confianca?: Confianca; revisaoHumana: boolean; sinalizacao?: string }> = {};
  const vistos = new Set<string>();

  (Array.isArray(lista) ? lista : []).forEach((linha, i) => {
    const pos = `Item ${i + 1} de "criterios"`;
    if (!ehObjeto(linha)) {
      erros.push(`${pos} não é um objeto.`);
      return;
    }
    const id = textoOuVazio(linha.criterionId);
    if (!id) {
      erros.push(`${pos} está sem "criterionId". Os critérios são identificados pelo id oficial (ex.: "crit-09"), nunca pela posição.`);
      return;
    }
    if (vistos.has(id)) {
      erros.push(`${id} aparece mais de uma vez.`);
      return;
    }
    vistos.add(id);

    const c = ctx.criteria.find((x) => x.id === id);
    if (!c) {
      erros.push(`Critério "${id}" não existe no MonitorIA. Use somente os ids oficiais.`);
      return;
    }
    if (!c.active) {
      erros.push(`${rotulo(c)} está inativo e não pode receber resposta.`);
      return;
    }
    if (canal && !(c.channels as string[]).includes(canal)) {
      erros.push(`${rotulo(c)} não se aplica ao canal ${canal}.`);
      return;
    }

    const nomeInformado = textoOuVazio(linha.criterioNome);
    if (nomeInformado && normalizar(nomeInformado) !== normalizar(c.name)) {
      avisos.push(`${id}: o nome informado ("${nomeInformado}") difere do cadastro ("${c.name}"). Vale o id.`);
    }

    // Confiança e pedido de revisão do agente
    let confianca: Confianca | undefined;
    if (linha.confianca != null && linha.confianca !== '') {
      confianca = CONFIANCAS[normalizar(linha.confianca)];
      if (!confianca) avisos.push(`${id}: confiança "${String(linha.confianca)}" não reconhecida (use ALTA, MEDIA ou BAIXA).`);
    }
    const revisaoHumana = linha.revisaoHumana === true || ['sim', 'true'].includes(normalizar(linha.revisaoHumana));
    const sinalizacao = textoOuVazio(linha.sinalizacao) || undefined;
    meta[id] = { confianca, revisaoHumana, sinalizacao };

    const justificativa = textoOuVazio(linha.justificativa);
    const evidencia = textoOuVazio(linha.evidencia);
    const r = linha.resposta;
    let score: number | string = '';
    const subRespostas: Record<string, 'SIM' | 'NAO'> = {};

    if (c.tipoResposta === 'CHECKLIST_SIM_NAO' && !c.eliminatorio) {
      const subs = c.subPerguntas || [];
      if (r != null && r !== '' && r !== '—' && r !== '-') {
        if (ehNA(r)) {
          erros.push(`${rotulo(c)} é checklist e não aceita N/A.`);
          return;
        }
        avisos.push(`${id}: a "resposta" do checklist foi ignorada — a nota sai das sub-perguntas.`);
      }
      const sr = linha.subRespostas;
      if (!ehObjeto(sr)) {
        erros.push(`${rotulo(c)} é checklist: informe "subRespostas" com ${subs.map((s) => s.id).join(', ')}.`);
        return;
      }
      const desconhecidas = Object.keys(sr).filter((k) => !subs.some((s) => s.id === k));
      if (desconhecidas.length) {
        if (id === 'crit-24' && desconhecidas.includes('sub-24-3')) {
          erros.push(
            'Este JSON foi gerado com a régua antiga: o crit-24 tem apenas duas sub-perguntas desde a 0.24.1 (sub-24-1 e sub-24-2). A pesquisa de satisfação (sub-24-3) não é mais avaliada — atualize a instrução do agente.',
          );
        } else {
          erros.push(`${id}: sub-pergunta inexistente — ${desconhecidas.join(', ')}. Válidas: ${subs.map((s) => s.id).join(', ')}.`);
        }
        return;
      }
      const faltando = subs.filter((s) => !(s.id in sr)).map((s) => s.id);
      if (faltando.length) {
        erros.push(`${id}: faltam sub-perguntas — ${faltando.join(', ')}. O checklist precisa de todas.`);
        return;
      }
      let invalida = false;
      subs.forEach((s) => {
        const v = normalizar(sr[s.id]);
        if (v === 'sim') subRespostas[s.id] = 'SIM';
        else if (v === 'nao') subRespostas[s.id] = 'NAO';
        else {
          erros.push(`${id}/${s.id}: resposta "${String(sr[s.id])}" inválida. Use "SIM" ou "NÃO".`);
          invalida = true;
        }
      });
      if (invalida) return;
      score = scoreDoChecklist(subs, subRespostas);
    } else if (c.eliminatorio) {
      if (ehNA(r)) {
        // N/A em eliminatório só existe pelo portão (crit-29 → crit-25), e lá é o sistema que o
        // grava. Se vier do JSON, aceita-se só quando o portão de fato bloquearia o critério.
        score = 'N/A';
      } else {
        const { n, convertido } = lerNumero(r);
        const textoR = normalizar(r);
        if (n === 2 || textoR === 'nao ocorreu') score = 2;
        else if (n === 0 || textoR === 'sim, ocorreu' || textoR === 'ocorreu') score = 0;
        else {
          erros.push(`${rotulo(c)} é eliminatório: responda 2 (não ocorreu) ou 0 (ocorreu). Recebido: ${JSON.stringify(r ?? null)}.`);
          return;
        }
        if (convertido) avisos.push(`${id}: "${String(r)}" lido como número ${score}.`);
      }
    } else if (c.tipoResposta === 'MULTIPLA_ESCOLHA') {
      const opcoes = c.opcoes || [];
      const opcao = opcoes.find((o) => normalizar(o) === normalizar(r));
      if (!opcao) {
        erros.push(`${rotulo(c)}: "${String(r ?? '')}" não é opção válida. Opções: ${opcoes.join(' · ')}.`);
        return;
      }
      if (opcao !== r) avisos.push(`${id}: "${String(r)}" lido como "${opcao}".`);
      score = opcao;
    } else {
      if (ehNA(r)) {
        if (naProibido(c)) {
          erros.push(`${rotulo(c)} não admite N/A pela metodologia: ${c.quandoNA}`);
          return;
        }
        score = 'N/A';
      } else {
        const { n, convertido } = lerNumero(r);
        const validos = valoresDaEscala(c);
        if (n === null || !validos.includes(n)) {
          erros.push(`${rotulo(c)}: resposta ${JSON.stringify(r ?? null)} inválida. Valores aceitos: ${[...validos, 'N/A'].join(', ')}.`);
          return;
        }
        if (convertido) avisos.push(`${id}: "${String(r)}" lido como número ${n}.`);
        score = n;
      }
    }

    // Justificativa — a mesma exigência do validateStep3, mais a evidência anexada ao texto.
    const precisaJustificar = c.tipoResposta !== 'MULTIPLA_ESCOLHA' && typeof score === 'number' && score < 2;
    const temCampoNaTela = c.tipoResposta !== 'MULTIPLA_ESCOLHA' && score !== 2;
    let lowScoreReason = '';
    if (precisaJustificar && !justificativa) {
      erros.push(`${rotulo(c)}: justificativa obrigatória para resposta abaixo da máxima.`);
      return;
    }
    if (temCampoNaTela) {
      lowScoreReason = [justificativa, evidencia ? `Evidência: ${evidencia}` : ''].filter(Boolean).join('\n\n');
    } else if (justificativa || evidencia) {
      // O formulário não exibe justificativa na nota máxima nem na classificação. Gravar texto
      // num campo que ninguém vê nem consegue editar seria dado escondido.
      avisos.push(`${id}: justificativa/evidência não aplicada — o formulário não tem esse campo para a resposta "${score}".`);
    }

    respostas[id] = { score, lowScoreReason, subRespostas };
  });

  // Regra de autenticação por canal — antes do portão, que dispensaria o crit-25 com base nela.
  if (canal && violaRegraDeAutenticacao(canal, respostas['crit-29']?.score)) {
    erros.push(
      `crit-29 = "Sim" não vale no canal ${canal}: telefone e presencial não têm pré-autenticação, e a régua manda responder "Não". Com "Sim", o crit-25 (confirmação de dados de segurança) seria dispensado sem avaliação. Corrija o crit-29 e avalie o crit-25 no ChatGPT.`,
    );
    delete respostas['crit-29'];
  }

  // Critérios aplicáveis sem resposta
  const bloqueadosPrevia = getCriteriosBloqueados(aplicaveis, respostas);
  // `vistos`, e não `respostas`: o critério que veio e foi recusado já tem erro próprio, e
  // repeti-lo como "ausente" só esconderia a causa real na lista.
  const ausentes = aplicaveis.filter((c) => !vistos.has(c.id) && !bloqueadosPrevia[c.id]);
  if (canal && ausentes.length) {
    erros.push(
      `Faltam respostas para ${ausentes.length} critério(s) ativo(s) do canal ${canal}: ${ausentes.map((c) => c.id).join(', ')}.`,
    );
  }

  // Portão 29 → 25: contradição bloqueia; dispensa vira N/A, como na tela.
  if (respostas['crit-29']?.score === 'Sim' && respostas['crit-25']?.score === 0) {
    erros.push(
      'Contradição: crit-29 diz que o cliente chegou autenticado, e crit-25 marca falha de confirmação de dados como ocorrida. Corrija uma das duas respostas no ChatGPT.',
    );
  }
  Object.entries(bloqueadosPrevia).forEach(([id, b]) => {
    const atual = respostas[id];
    if (atual && atual.score !== 'N/A') {
      avisos.push(`${id} passa a N/A: ${b.motivo} (resposta importada: ${atual.score}).`);
    }
    respostas[id] = { score: 'N/A', lowScoreReason: '', subRespostas: {} };
  });
  // N/A em eliminatório que o portão não justifica
  aplicaveis
    .filter((c) => c.eliminatorio && respostas[c.id]?.score === 'N/A' && !bloqueadosPrevia[c.id])
    .forEach((c) => erros.push(`${rotulo(c)} é eliminatório e não aceita N/A: responda 2 (não ocorreu) ou 0 (ocorreu).`));

  // --- Relatório ----------------------------------------------------------
  const rel = ehObjeto(raiz.relatorio) ? raiz.relatorio : null;
  const relatorio = {} as Record<CampoRelatorio, string>;
  if (!rel) {
    erros.push('O bloco "relatorio" está ausente. Ele traz os seis campos do relatório.');
  } else {
    BLOCOS_IMPORTACAO.forEach((b) => {
      if (!(b.chave in rel)) {
        erros.push(`Relatório: o campo "${b.chave}" (${b.titulo}) está ausente. Se não houver conteúdo, envie "".`);
      } else if (rel[b.chave] != null && typeof rel[b.chave] !== 'string') {
        erros.push(`Relatório: "${b.chave}" precisa ser texto.`);
      }
      relatorio[b.campo] = textoOuVazio(rel[b.chave]);
    });
    if (rel && !relatorio.contexto) erros.push('Relatório: o Contexto do Atendimento está vazio.');
    if (rel && !relatorio.conclusao) erros.push('Relatório: a Conclusão está vazia.');
  }

  // --- Conferência de nota ------------------------------------------------
  const notaCalculada = canal ? calcularNotaPrevia(aplicaveis, respostas) : undefined;
  let notaEsperada: number | undefined;
  const conf = ehObjeto(raiz.conferencia) ? raiz.conferencia : null;
  if (conf && conf.notaEsperada != null && conf.notaEsperada !== '') {
    const { n } = lerNumero(conf.notaEsperada);
    if (n === null) avisos.push('conferencia.notaEsperada não é número e foi ignorada.');
    else notaEsperada = n;
  }

  // Itens e revisões da prévia — montados mesmo com erro, para a monitora ver o conjunto.
  const itens: ItemPrevia[] = aplicaveis
    .filter((c) => respostas[c.id])
    .map((c) => ({
      criterionId: c.id,
      numero: c.numero,
      nome: c.name,
      tipoResposta: c.tipoResposta,
      eliminatorio: c.eliminatorio,
      score: respostas[c.id].score,
      justificativa: respostas[c.id].lowScoreReason,
      confianca: meta[c.id]?.confianca,
      revisaoHumana: meta[c.id]?.revisaoHumana || false,
      sinalizacao: meta[c.id]?.sinalizacao,
      bloqueadoPor: bloqueadosPrevia[c.id]?.origem,
    }));

  const revisoes: RevisaoObrigatoria[] = [];
  itens.forEach((it) => {
    const titulo = `${it.criterionId}${it.numero != null ? ` · ${it.numero}` : ''} — ${it.nome}`;
    if (it.eliminatorio && !it.bloqueadoPor) {
      const ocorreu = it.score === 0;
      revisoes.push({
        criterionId: it.criterionId,
        titulo,
        grave: ocorreu,
        motivo: ocorreu
          ? 'ELIMINATÓRIO MARCADO COMO OCORRIDO. Ao salvar, a monitoria vai à gestão para confirmar o zeramento.'
          : 'Eliminatório: confirme que você revisou e que de fato não ocorreu.',
      });
    } else if (it.confianca === 'BAIXA' || it.revisaoHumana) {
      revisoes.push({
        criterionId: it.criterionId,
        titulo,
        grave: false,
        motivo: it.revisaoHumana ? 'O agente pediu revisão humana desta resposta.' : 'Resposta com confiança BAIXA.',
      });
    }
  });

  // Duplicidade: mesmo atendimento já monitorado. Pelo número do atendimento não bloqueia —
  // calibração e reavaliação são casos legítimos —, mas exige confirmação explícita antes de
  // aplicar. Pela regra do script 15 (mesma monitora, colaboradora, canal e início ao minuto),
  // o banco vai recusar a gravação (MI410): entra aqui também, para o aviso vir antes — foi o
  // caso do AGO-009, com número e título digitados de outro jeito (29/10/2026).
  const porNumero = numeroAtendimento
    ? ctx.monitorings.filter(
        (m) =>
          m.status !== 'Cancelada' &&
          normalizar(m.numeroAtendimento) === normalizar(numeroAtendimento) &&
          (!numeroTitulo || !m.numeroTitulo || normalizar(m.numeroTitulo) === normalizar(numeroTitulo)),
      )
    : [];
  const mesmoAtendimento = colaborador && canal && ctx.currentUser
    ? atendimentoJaRegistrado({ id: '', colaboradorId: colaborador.id, canal, inicioAtendimento: inicio, status: 'Rascunho', tipo: tipo ?? 'Regular' }, ctx.currentUser.id, ctx.monitorings)
    : null;
  // Alerta complementar (29/10/2026): mesmo dia e colaboradora, início até 10 min ou mesmo número.
  const parecidas = colaborador && canal && ctx.currentUser
    ? possiveisDuplicidades({ id: '', colaboradorId: colaborador.id, canal, inicioAtendimento: inicio, numeroAtendimento, status: 'Rascunho', tipo: tipo ?? 'Regular' }, ctx.currentUser.id, ctx.monitorings)
    : [];
  const duplicidades = [...new Set([...porNumero, ...(mesmoAtendimento ? [mesmoAtendimento] : []), ...parecidas])];

  if (notaEsperada != null && notaCalculada != null && Math.abs(notaEsperada - notaCalculada) > 0.01 && erros.length === 0) {
    erros.push(
      `Divergência de nota: o ChatGPT informou ${notaEsperada.toFixed(2).replace('.', ',')}, e o MonitorIA calcula ${notaCalculada.toFixed(2).replace('.', ',')} com as mesmas respostas. Normalmente é régua desatualizada no agente. Revise as respostas no ChatGPT antes de importar.`,
    );
  }

  const base: ResultadoImportacao = {
    erros,
    avisos,
    itens,
    revisoes,
    duplicidades,
    notaCalculada,
    notaEsperada,
    revisadoPor,
  };
  if (erros.length) return base;

  return {
    ...base,
    dados: {
      colaboradorId: colaborador!.id,
      colaboradorNome: colaborador!.name,
      monitorId: ctx.currentUser!.id,
      competencia,
      date,
      canal: canal!,
      categoriaAtendimento: categoria,
      tipo: tipo!,
      numeroAtendimento,
      numeroTitulo,
      inicioAtendimento: inicio,
      fimAtendimento: fim,
      link,
    },
    respostas,
    relatorio,
  };
};
