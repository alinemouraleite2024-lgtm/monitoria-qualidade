// Piloto: evidências das monitorias abertas na própria tela do gestor, sem copiar arquivo nenhum.
//
// O arquivo continua no OneDrive; o portal só aponta para os visualizadores da Microsoft. Quem decide
// quem vê é a permissão da pasta no OneDrive, com a conta Microsoft de quem abriu — o identificador
// aqui não dá acesso a nada sozinho. O cadastro fica no código para o piloto não mexer no banco nem
// nas monitorias, que estão travadas para validação.

export type TipoEvidencia = 'audio' | 'documento';

export interface ArquivoEvidencia {
  /** UniqueId do arquivo no OneDrive. */
  id: string;
  tipo: TipoEvidencia;
  nome: string;
  tamanhoBytes: number;
  /** Última alteração do arquivo no OneDrive, DD/MM/AAAA. */
  data: string;
  /** Início do SHA-256 registrado em docs/EVIDENCIAS-AGOSTO.md. */
  codigo: string;
  /** Só com a permissão de download concedida no OneDrive; sem ela, o link cairia numa recusa. */
  downloadLiberado: boolean;
}

const ORIGEM = 'https://mouraleite1-my.sharepoint.com';
const SITE = '/personal/aline_oliveira_mouraleite_com_br';
const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PILOTO: Record<string, ArquivoEvidencia[]> = {
  'MON-10024': [
    { id: '65f1cdec-41c1-4441-9d83-4666df8e954e', tipo: 'audio', nome: 'AGO-007_Monitoria_Qualidade_Allanis_Maquea_Silva.wav', tamanhoBytes: 3425878, data: '13/10/2026', codigo: '555cdf80e925e8ac', downloadLiberado: false },
    { id: 'bf72e459-dff1-4baa-8312-13a0f7b20169', tipo: 'documento', nome: 'AGO-007_Monitoria_Qualidade_Allanis_Maquea_Silva.docx', tamanhoBytes: 41182, data: '13/10/2026', codigo: 'be3183ec05068f02', downloadLiberado: false },
  ],
  'MON-10025': [
    { id: '5ec83983-ebd8-4d17-bc79-117c7ac71bf4', tipo: 'audio', nome: 'AGO-008_Monitoria_Qualidade_Allanis_Maquea_Silva.wav', tamanhoBytes: 8605036, data: '13/10/2026', codigo: 'bd91492d0228479f', downloadLiberado: false },
    { id: 'b15a8dc0-d9d6-43de-acf7-8b41d40fe7c1', tipo: 'documento', nome: 'AGO-008_Monitoria_Qualidade_Allanis_Maquea_Silva.docx', tamanhoBytes: 42824, data: '13/10/2026', codigo: 'fe3a319b6bf7f68e', downloadLiberado: false },
  ],
};

export const arquivosDaMonitoria = (monitoriaId: string): ArquivoEvidencia[] =>
  Object.hasOwn(PILOTO, monitoriaId) ? PILOTO[monitoriaId] : [];

const camada = (pagina: string, arquivo: ArquivoEvidencia): string => {
  if (!FORMATO_ID.test(arquivo.id)) throw new Error('Identificador de evidência inválido.');
  return `${ORIGEM}${SITE}/_layouts/15/${pagina}`;
};

/** Endereço do visualizador embutido: player do OneDrive para áudio, Word para a web para documento. */
export const urlVisualizador = (arquivo: ArquivoEvidencia): string =>
  arquivo.tipo === 'audio'
    ? `${camada('embed.aspx', arquivo)}?UniqueId=${arquivo.id}`
    : `${camada('Doc.aspx', arquivo)}?sourcedoc=%7B${arquivo.id}%7D&action=embedview`;

/** Mesmo arquivo em aba própria: saída para quando o navegador não mostra o quadro embutido. */
export const urlNovaAba = (arquivo: ArquivoEvidencia): string =>
  arquivo.tipo === 'audio'
    ? urlVisualizador(arquivo)
    : `${camada('Doc.aspx', arquivo)}?sourcedoc=%7B${arquivo.id}%7D&action=view`;

export const urlDownload = (arquivo: ArquivoEvidencia): string =>
  `${camada('download.aspx', arquivo)}?UniqueId=${arquivo.id}`;

/** "WAV · 3,27 MB · 13/10/2026" */
export const descricaoDoArquivo = (arquivo: ArquivoEvidencia): string => {
  const extensao = /\.([a-z0-9]{1,6})$/i.exec(arquivo.nome)?.[1]?.toUpperCase() ?? '';
  const mb = (arquivo.tamanhoBytes / 1024 / 1024).toFixed(2).replace('.', ',');
  return [extensao, `${mb} MB`, arquivo.data].filter(Boolean).join(' · ');
};
