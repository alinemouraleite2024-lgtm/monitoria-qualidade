// Camada de dados do modo compartilhado: carga do banco e operações das monitorias.
//
// Nenhuma regra de negócio é decidida aqui. Quem decide é o banco (08): quem pode, em que
// situação, com qual versão da régua e com qual nota. Esta camada só leva e traz, e devolve o
// erro do banco como ele veio — a tela mostra a mensagem.
import type { Transporte } from './transporte';
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
  settings: SystemSettings;
  brand: BrandConfig;
}

const TABELAS = ['perfis', 'colaboradores', 'areas', 'area_monitores', 'alocacoes', 'criterios', 'criterio_subperguntas',
  'monitorias', 'monitoria_respostas', 'monitoria_evidencias', 'documentos', 'catalogos', 'configuracoes'] as const;

/** Lê tudo o que o usuário logado pode ver (a RLS do 07 filtra) e converte para as telas. */
export const carregarDados = async (t: Transporte, padroes: { settings: SystemSettings; brand: BrandConfig }): Promise<DadosCompartilhados> => {
  const lidas = await Promise.all(TABELAS.map((tb) => t.selecionar<Linha>(tb)));
  const d = Object.fromEntries(TABELAS.map((tb, i) => [tb, lidas[i]])) as Record<(typeof TABELAS)[number], Linha[]>;
  const perfis = [...d.perfis].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)).map(paraUsuario);
  return {
    perfis,
    usuarios: perfis.map((p) => p.usuario),
    colaboradores: [...d.colaboradores].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0)).map(paraColaborador),
    areas: paraAreas(d.areas, d.area_monitores),
    alocacoes: d.alocacoes.map(paraAlocacao),
    criterios: paraCriterios(d.criterios, d.criterio_subperguntas),
    monitorias: paraMonitorias(d.monitorias, d.monitoria_respostas, d.monitoria_evidencias),
    categorias: catalogo(d.catalogos, 'categorias'),
    metasColaborador: documentosDa(d.documentos, 'metas_colaborador'),
    planosMetas: documentosDa<PlanoMetas>(d.documentos, 'planos_metas'),
    feriados: documentosDa(d.documentos, 'feriados'),
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
}

const resultado = (r: unknown): ResultadoMonitoria => {
  const o = (r ?? {}) as Record<string, unknown>;
  return { id: String(o.id), protocolo: String(o.protocolo ?? ''), status: String(o.status ?? ''), versao: Number(o.versao),
    nota: Number(o.nota ?? 0), regua_versao_id: (o.regua_versao_id as string) ?? null };
};

/** Salva rascunho ou envia para validação (api.salvar_monitoria). */
export const salvarMonitoria = async (t: Transporte, m: Monitoring, criterios: Criterion[], jaNoBanco: boolean, enviar: boolean) =>
  resultado(await t.chamar('salvar_monitoria', {
    p_dados: montarDadosParaSalvar(m, criterios, jaNoBanco, enviar),
    p_versao_lida: jaNoBanco ? (m.versao ?? null) : null,
    p_enviar: enviar,
  }));

const acao = async (t: Transporte, funcao: string, m: Monitoring, motivo?: string) =>
  resultado(await t.chamar(funcao, motivo === undefined
    ? { p_id: m.id, p_versao_lida: m.versao ?? null }
    : { p_id: m.id, p_versao_lida: m.versao ?? null, p_motivo: motivo }));

export const validarMonitoria = (t: Transporte, m: Monitoring) => acao(t, 'validar_monitoria', m);
export const reprovarMonitoria = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'reprovar_monitoria', m, motivo);
export const devolverMonitoria = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'devolver_monitoria', m, motivo);
export const confirmarZeramento = (t: Transporte, m: Monitoring) => acao(t, 'confirmar_zeramento', m);
export const afastarEliminatorio = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'afastar_eliminatorio', m, motivo);
export const cancelarMonitoria = (t: Transporte, m: Monitoring, motivo: string) => acao(t, 'cancelar_monitoria', m, motivo);

/** Histórico de acessos no banco (o 05 carimba quem e quando). Falha aqui nunca bloqueia o uso. */
export const registrarAcesso = async (t: Transporte, evento: string, usuario: User | null, perfil: string | null, detalhes = '') => {
  try {
    await t.incluir('acessos_log', { tipo_evento: evento, usuario_email: usuario?.email ?? null, usuario_nome: usuario?.name ?? null,
      usuario_perfil: perfil, detalhes });
  } catch {
    // o registro de acesso é informativo; a auditoria do 06 continua registrando toda gravação
  }
};
