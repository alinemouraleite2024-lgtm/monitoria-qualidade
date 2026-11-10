// Camada de dados do modo compartilhado: carga do banco e operações das monitorias.
//
// Nenhuma regra de negócio é decidida aqui. Quem decide é o banco (08): quem pode, em que
// situação, com qual versão da régua e com qual nota. Esta camada só leva e traz, e devolve o
// erro do banco como ele veio — a tela mostra a mensagem.
import { ErroBanco, type Transporte } from './transporte';
import { indexarDocumentos, type IndiceDocumentos } from './documentos';
import {
  paraAlocacao, paraAreas, paraColaborador, paraCriterios, paraMonitorias, paraUsuario,
  documentosDa, catalogo, configuracao, montarDadosParaSalvar,
  type Linha, type PerfilDoBanco,
} from './mapeamento';
import type {
  Allocation, Area, BrandConfig, Collaborator, Criterion, Monitoring, PlanoMetas, SystemSettings, User,
} from '../../types/domain';

export interface DadosCompartilhados {
  perfis: PerfilDoBanco[];
  usuarios: User[];
  colaboradores: Collaborator[];
  areas: Area[];
  alocacoes: Allocation[];
  criterios: Criterion[];
  monitorias: Monitoring[];
  categorias: string[];
  metasColaborador: unknown[];
  planosMetas: PlanoMetas[];
  feriados: unknown[];
  /** Versão e posição de cada documento ativo — o que a gravação de metas e planos precisa. */
  indiceDocumentos: IndiceDocumentos;
  settings: SystemSettings;
  brand: BrandConfig;
}

const TABELAS = ['perfis', 'colaboradores', 'areas', 'area_monitores', 'alocacoes', 'criterios', 'criterio_subperguntas',
  'monitorias', 'monitoria_respostas', 'monitoria_evidencias', 'documentos', 'catalogos', 'configuracoes'] as const;

/**
 * Histórico de calibração (script 14). Lido à parte: enquanto o banco não tiver a tabela, a
 * carga continua funcionando sem ele (nulo = indisponível). Qualquer outro erro sobe.
 */
const lerHistorico = async (t: Transporte): Promise<Linha[] | null> => {
  try {
    return await t.selecionar<Linha>('monitoria_eventos');
  } catch (e) {
    const codigo = e instanceof ErroBanco ? e.codigo : String((e as { code?: unknown })?.code ?? '');
    if (codigo === '42P01' || codigo.startsWith('PGRST2')) return null;
    throw e;
  }
};

/** Lê tudo o que o usuário logado pode ver (a RLS do 07 filtra) e converte para as telas. */
export const carregarDados = async (t: Transporte, padroes: { settings: SystemSettings; brand: BrandConfig }): Promise<DadosCompartilhados> => {
  const lidas = await Promise.all(TABELAS.map((tb) => t.selecionar<Linha>(tb)));
  const d = Object.fromEntries(TABELAS.map((tb, i) => [tb, lidas[i]])) as Record<(typeof TABELAS)[number], Linha[]>;
  const eventos = await lerHistorico(t);
  const perfis = [...d.perfis].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)).map(paraUsuario);
  return {
    perfis,
    usuarios: perfis.map((p) => p.usuario),
    colaboradores: [...d.colaboradores].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)).map(paraColaborador),
    areas: paraAreas(d.areas, d.area_monitores),
    alocacoes: d.alocacoes.map(paraAlocacao),
    criterios: paraCriterios(d.criterios, d.criterio_subperguntas),
    monitorias: paraMonitorias(d.monitorias, d.monitoria_respostas, d.monitoria_evidencias, eventos),
    categorias: catalogo(d.catalogos, 'categorias'),
    metasColaborador: documentosDa(d.documentos, 'metas_colaborador'),
    planosMetas: documentosDa<PlanoMetas>(d.documentos, 'planos_metas'),
    feriados: documentosDa(d.documentos, 'feriados'),
    indiceDocumentos: indexarDocumentos(d.documentos),
    settings: configuracao(d.configuracoes, 'settings', padroes.settings),
    brand: configuracao(d.configuracoes, 'brand', padroes.brand),
  };
};

/** Perfil do login atual, pelo vínculo auth_user_id (01). Nulo = login sem perfil liberado. */
export const perfilDoLogin = (dados: DadosCompartilhados, authUserId: string): User | null =>
  dados.perfis.find((p) => p.authUserId === authUserId)?.usuario ?? null;

export interface ResultadoMonitoria {
  id: string;
  protocolo: string;
  status: string;
  versao: number;
  nota: number;
  regua_versao_id: string | null;
  /** A mesma chave de criação já tinha gravado esta monitoria: nada novo foi criado (script 15). */
  repetida?: boolean;
}

const resultado = (r: unknown): ResultadoMonitoria => {
  const o = (r ?? {}) as Record<string, unknown>;
  return { id: String(o.id), protocolo: String(o.protocolo ?? ''), status: String(o.status ?? ''), versao: Number(o.versao),
    nota: Number(o.nota ?? 0), regua_versao_id: (o.regua_versao_id as string) ?? null, ...(o.repetida === true ? { repetida: true } : {}) };
};

/** Salva rascunho ou envia para validação (api.salvar_monitoria). */
export const salvarMonitoria = async (t: Transporte, m: Monitoring, criterios: Criterion[], jaNoBanco: boolean, enviar: boolean, guardar = false) =>
  resultado(await t.chamar('salvar_monitoria', {
    p_dados: montarDadosParaSalvar(m, criterios, jaNoBanco, enviar, guardar),
    p_versao_lida: jaNoBanco ? (m.versao ?? null) : null,
    p_enviar: enviar,
  }));

/** Envia as guardadas para validação (script 19). Tudo ou nada; a já enviada é só informada. */
export const liberarMonitorias = async (t: Transporte, itens: Monitoring[]) =>
  (await t.chamar('liberar_monitorias', { p_itens: itens.map((m) => ({ id: m.id, versao: m.versao ?? null })) })) as { liberadas: string[]; ja_enviadas: string[] };

const acao = async (t: Transporte, funcao: string, m: Monitoring, motivo?: string) =>
  resultado(await t.chamar(funcao, motivo === undefined
    ? { p_id: m.id, p_versao_lida: m.versao ?? null }
    : { p_id: m.id, p_versao_lida: m.versao ?? null, p_motivo: motivo }));

/** Considerações vazias não vão: o banco aceita a chamada sem elas (script 14). */
export const validarMonitoria = async (t: Transporte, m: Monitoring, consideracoes?: string) => {
  const texto = (consideracoes ?? '').trim();
  if (!texto) return acao(t, 'validar_monitoria', m);
  return resultado(await t.chamar('validar_monitoria', { p_id: m.id, p_versao_lida: m.versao ?? null, p_consideracoes: texto }));
};
export const reprovarMonitoria = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'reprovar_monitoria', m, motivo);
export const devolverMonitoria = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'devolver_monitoria', m, motivo);
export const confirmarZeramento = (t: Transporte, m: Monitoring) => acao(t, 'confirmar_zeramento', m);
export const afastarEliminatorio = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'afastar_eliminatorio', m, motivo);
export const cancelarMonitoria = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'cancelar_monitoria', m, motivo);

/**
 * Cancela a CÓPIA de uma monitoria criada em dobro (script 15, ADMIN com MFA). O banco confere
 * que as duas são o mesmo registro antes de cancelar e preenche o motivo padrão.
 */
export const cancelarPorDuplicidade = async (t: Transporte, copia: Monitoring, originalId: string) =>
  resultado(await t.chamar('cancelar_por_duplicidade', { p_id: copia.id, p_versao_lida: copia.versao ?? null, p_original: originalId }));

/**
 * Observação complementar (script 14): só acrescenta um evento — a monitoria não muda. A chave
 * identifica a requisição: repetir a mesma chave (nova tentativa) não grava outra observação.
 */
export const registrarObservacao = async (t: Transporte, m: Monitoring, texto: string, chave: string) =>
  t.chamar('registrar_observacao', { p_id: m.id, p_texto: texto, p_chave: chave });

/** Histórico de acessos no banco (o 05 carimba quem e quando). Falha aqui nunca bloqueia o uso. */
export const registrarAcesso = async (t: Transporte, evento: string, usuario: User | null, perfil: string | null, detalhes = '') => {
  try {
    await t.incluir('acessos_log', { tipo_evento: evento, usuario_email: usuario?.email ?? null, usuario_nome: usuario?.name ?? null,
      usuario_perfil: perfil, detalhes });
  } catch {
    // o registro de acesso é informativo; a auditoria do 06 continua registrando toda gravação
  }
};
