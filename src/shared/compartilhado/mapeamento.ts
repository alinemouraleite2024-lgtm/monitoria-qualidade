// Conversão entre as linhas do banco e os objetos que as telas já usam.
//
// Regra: a tela recebe o valor EFETIVO das colunas (é o que vale para a operação — por exemplo, o
// supervisor da área definido pela migração). Campos antigos que a migração guardou em `extras`
// voltam para o objeto como estavam; as marcas de fidelidade (`_nulos`, `_<campo>_original`,
// `_listas_vazias`, `_criado_na_migracao`...) ficam no banco e não aparecem na tela.
import type {
  Allocation, Area, BrandConfig, Collaborator, Criterion, EventoCalibracao, Monitoring, MonitoringScore, SystemSettings, User,
} from '../../types/domain';

export type Linha = Record<string, unknown>;

const txt = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === '' ? undefined : Number(v));
const extrasVisiveis = (extras: unknown): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  if (extras && typeof extras === 'object' && !Array.isArray(extras)) {
    for (const [k, v] of Object.entries(extras as Record<string, unknown>)) if (!k.startsWith('_')) o[k] = v;
  }
  return o;
};
const porOrdem = (a: Linha, b: Linha) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0);
const ativo = (l: Linha) => l.ativo !== false;

// ---- perfis -------------------------------------------------------------------------------
export interface PerfilDoBanco {
  usuario: User;
  authUserId: string | null;
}

export const paraUsuario = (l: Linha): PerfilDoBanco => {
  const ex = extrasVisiveis(l.extras);
  delete ex.password;
  delete ex.confirmPassword;
  const usuario = {
    ...ex,
    id: txt(l.id),
    name: txt(l.nome),
    email: txt(l.email),
    perfis: (Array.isArray(l.perfis) ? l.perfis : []) as User['perfis'],
    // status nulo = ausente no portal antigo, que o tratava como ativo (01)
    status: (txt(l.status) || 'ACTIVE') as User['status'],
  } as User;
  return { usuario, authUserId: typeof l.auth_user_id === 'string' ? l.auth_user_id : null };
};

// ---- estrutura ----------------------------------------------------------------------------
export const paraColaborador = (l: Linha): Collaborator => ({
  ...(extrasVisiveis(l.extras) as Partial<Collaborator>),
  id: txt(l.id), name: txt(l.nome), email: txt(l.email), cargo: txt(l.cargo), areaId: txt(l.area_id), active: l.ativo !== false,
});

export const paraAreas = (areas: Linha[], monitores: Linha[]): Area[] =>
  [...areas].sort(porOrdem).map((a) => ({
    ...(extrasVisiveis(a.extras) as Partial<Area>),
    id: txt(a.id), name: txt(a.nome), gestorId: txt(a.gestor_id), active: a.ativo !== false,
    monitorIds: monitores.filter((m) => m.area_id === a.id && ativo(m)).sort(porOrdem).map((m) => txt(m.monitor_id)),
  }));

export const paraAlocacao = (l: Linha): Allocation => ({
  id: txt(l.id), monitorId: txt(l.monitor_id), colaboradorId: txt(l.colaborador_id),
  startDate: txt(l.data_inicio).slice(0, 10), endDate: l.data_fim ? txt(l.data_fim).slice(0, 10) : null, active: l.ativo !== false,
});

// ---- régua ----------------------------------------------------------------------------------
export const paraCriterios = (criterios: Linha[], subs: Linha[]): Criterion[] =>
  [...criterios].sort(porOrdem).map((c) => {
    const o: Record<string, unknown> = {
      ...extrasVisiveis(c.extras),
      id: txt(c.id), numero: c.numero === null || c.numero === undefined ? null : Number(c.numero),
      category: txt(c.bloco), name: txt(c.nome), description: txt(c.descricao), orientacao: txt(c.orientacao),
      tipoResposta: c.tipo_resposta, eliminatorio: c.eliminatorio === true, weight: Number(c.peso ?? 0),
      active: c.ativo === true, channels: Array.isArray(c.canais) ? c.canais : [],
    };
    if (Array.isArray(c.opcoes)) o.opcoes = c.opcoes;
    if (c.ancoras && typeof c.ancoras === 'object') o.ancoras = c.ancoras;
    if (typeof c.quando_na === 'string') o.quandoNA = c.quando_na;
    const minhas = subs.filter((s) => s.criterio_id === c.id && ativo(s)).sort(porOrdem);
    if (minhas.length) {
      o.subPerguntas = minhas.map((s) => {
        const sp: Record<string, unknown> = { ...extrasVisiveis(s.extras), id: txt(s.id), texto: txt(s.texto) };
        if (typeof s.criterio_sim === 'string') sp.criterioSim = s.criterio_sim;
        if (typeof s.criterio_nao === 'string') sp.criterioNao = s.criterio_nao;
        return sp;
      });
    }
    return o as unknown as Criterion;
  });

// ---- monitorias -----------------------------------------------------------------------------
// coluna do banco -> campo do portal (mesma tabela da migração)
const COLUNAS_MONITORIA: Record<string, string> = {
  protocolo: 'protocolo', competencia: 'competencia', data: 'date', monitor_id: 'monitorId', colaborador_id: 'colaboradorId',
  gestor_id: 'gestorId', canal: 'canal', tipo: 'tipo', status: 'status', numero_atendimento: 'numeroAtendimento',
  numero_titulo: 'numeroTitulo', categoria_atendimento: 'categoriaAtendimento', empreendimento: 'empreendimento', tempo: 'tempo',
  inicio_atendimento: 'inicioAtendimento', fim_atendimento: 'fimAtendimento', comentarios: 'comments', pontos_fortes: 'strengths',
  oportunidades: 'opportunities', contexto: 'contexto', leitura_tecnica: 'leituraTecnica', erros_identificados: 'errosIdentificados',
  conclusao: 'conclusao', evidencia_observacoes: 'evidenciaObservacoes', eliminatorio_confirmado_por: 'eliminatoryConfirmedBy',
  eliminatorio_confirmado_em: 'eliminatoryConfirmedAt', aprovado_por: 'approvedBy', aprovado_em: 'approvedAt',
  revisado_por: 'reviewedBy', revisado_em: 'reviewedAt', motivo_ajuste: 'adjustmentReason', motivo_reprovacao: 'motivoReprovacao',
  regua_versao_id: 'reguaVersaoId', origem: 'origem', cancelado_motivo: 'motivoCancelamento', duplicata_de: 'duplicataDe',
};

/** Linha de monitoria_eventos (script 14) → evento do histórico. */
export const paraEvento = (l: Linha): EventoCalibracao => ({
  id: String(l.id),
  tipo: txt(l.tipo) as EventoCalibracao['tipo'],
  rodada: Number(l.rodada),
  statusResultante: txt(l.status_resultante) as EventoCalibracao['statusResultante'],
  nota: num(l.nota) ?? null,
  consideracoes: typeof l.consideracoes === 'string' ? l.consideracoes : null,
  criterios: Array.isArray(l.criterios) ? (l.criterios as EventoCalibracao['criterios']) : null,
  responsavelId: txt(l.responsavel_id),
  ocorridoEm: l.ocorrido_em instanceof Date ? l.ocorrido_em.toISOString() : txt(l.ocorrido_em),
  origem: l.origem === 'reconstituido' ? 'reconstituido' : 'portal',
});

/**
 * `eventos` nulo = o banco ainda não tem o histórico (script 14): as monitorias ficam sem o
 * campo `historico`, e a tela diz que ele não está disponível — em vez de mostrar "vazio".
 */
export const paraMonitorias = (monitorias: Linha[], respostas: Linha[], evidencias: Linha[], eventos: Linha[] | null = null): Monitoring[] =>
  [...monitorias]
    .sort((a, b) => txt(b.id).localeCompare(txt(a.id), 'pt-BR', { numeric: true }))
    .map((m) => {
      const o: Record<string, unknown> = { ...extrasVisiveis(m.extras), id: txt(m.id) };
      for (const [col, campo] of Object.entries(COLUNAS_MONITORIA)) if (m[col] !== null && m[col] !== undefined) o[campo] = m[col];
      for (const campo of ['competencia', 'date', 'monitorId', 'colaboradorId', 'canal', 'tipo']) if (o[campo] === undefined) o[campo] = '';
      o.status = o.status ?? 'Rascunho';
      o.finalScore = num(m.nota) ?? 0;
      const dur = num(m.duracao_minutos); if (dur !== undefined) o.duracaoMinutos = dur;
      if (m.eliminatorio_pendente !== null && m.eliminatorio_pendente !== undefined) o.eliminatoryPending = m.eliminatorio_pendente === true;
      if (m.zerada !== null && m.zerada !== undefined) o.zerada = m.zerada === true;
      if (m.retroativo === true) o.lancamentoRetroativo = { por: txt(m.retroativo_por), em: txt(m.retroativo_em) };
      o.versao = Number(m.versao);
      const nh = num(m.nota_historica); if (nh !== undefined) o.notaHistorica = nh;
      const nc = num(m.nota_calculada); if (nc !== undefined) o.notaCalculada = nc;
      o.scores = respostas.filter((r) => r.monitoria_id === m.id && ativo(r)).sort(porOrdem).map((r): MonitoringScore => ({
        criterionId: txt(r.criterio_id),
        score: (r.resposta === null || r.resposta === undefined ? '' : r.resposta) as MonitoringScore['score'],
        lowScoreReason: txt(r.justificativa),
        subRespostas: (r.sub_respostas ?? null) as MonitoringScore['subRespostas'],
      }));
      for (const lista of ['evidencias', 'links']) {
        const itens = evidencias.filter((e) => e.monitoria_id === m.id && e.lista === lista && ativo(e)).sort(porOrdem).map((e) => e.conteudo);
        o[lista] = itens;
      }
      if (eventos) o.historico = eventos.filter((e) => e.monitoria_id === m.id).map(paraEvento);
      else delete o.historico;
      return o as unknown as Monitoring;
    });

// ---- documentos, catálogos, configurações --------------------------------------------------------
export const documentosDa = <T,>(documentos: Linha[], colecao: string): T[] =>
  documentos.filter((d) => d.colecao === colecao && ativo(d)).sort(porOrdem).map((d) => d.conteudo as T);

export const catalogo = (catalogos: Linha[], nome: string): string[] =>
  catalogos.filter((c) => c.catalogo === nome && ativo(c)).sort(porOrdem).map((c) => txt(c.valor));

export const configuracao = <T,>(configuracoes: Linha[], chave: string, padrao: T): T => {
  const l = configuracoes.find((c) => c.chave === chave);
  return l && l.valor && typeof l.valor === 'object' ? ({ ...padrao, ...(l.valor as object) } as T) : padrao;
};
export type { SystemSettings, BrandConfig };

// ---- monitoria -> operação do banco ---------------------------------------------------------------
const CAMPOS_ENVIADOS = ['colaboradorId', 'categoriaAtendimento', 'numeroAtendimento', 'numeroTitulo', 'canal', 'date', 'competencia',
  'inicioAtendimento', 'fimAtendimento', 'duracaoMinutos', 'tipo', 'comments', 'strengths', 'opportunities', 'contexto',
  'leituraTecnica', 'errosIdentificados', 'conclusao', 'evidenciaObservacoes', 'evidencias', 'links'] as const;

/**
 * Monta `p_dados` de api.salvar_monitoria.
 *
 * - Monitoria nova não leva id nem protocolo: quem gera os dois é o banco (08). Mandar um id que o
 *   banco não conhece seria tratado como edição de algo inexistente.
 * - Sub-respostas que não existem na régua atual são retiradas (ex.: sub-24-3, que saiu em
 *   07/10/2026). O banco recusaria o envio misturando versões (E2); o portal limpa antes.
 * - A nota do portal só vai no envio, como conferência: o banco calcula a oficial (E1).
 */
export const montarDadosParaSalvar = (m: Monitoring, criterios: Criterion[], jaNoBanco: boolean, enviar: boolean): Record<string, unknown> => {
  const dados: Record<string, unknown> = {};
  if (jaNoBanco) dados.id = m.id;
  // Só na criação: a mesma chave repetida (clique duplo, nova tentativa) não cria outra (15).
  else if (m.chaveCriacao) dados.chaveCriacao = m.chaveCriacao;
  const fonte = m as unknown as Record<string, unknown>;
  for (const k of CAMPOS_ENVIADOS) if (fonte[k] !== undefined && fonte[k] !== null) dados[k] = fonte[k];
  const subsDe = new Map(criterios.map((c) => [c.id, new Set((c.subPerguntas || []).map((s) => s.id))]));
  dados.scores = (m.scores || []).map((s) => {
    let sub = s.subRespostas;
    if (sub && typeof sub === 'object') {
      const validas = subsDe.get(s.criterionId);
      sub = Object.fromEntries(Object.entries(sub).filter(([k]) => validas?.has(k))) as typeof sub;
    }
    return { criterionId: s.criterionId, score: s.score, lowScoreReason: s.lowScoreReason || '', subRespostas: sub ?? null };
  });
  if (enviar && typeof m.finalScore === 'number' && Number.isFinite(m.finalScore)) dados.finalScore = m.finalScore;
  return dados;
};
