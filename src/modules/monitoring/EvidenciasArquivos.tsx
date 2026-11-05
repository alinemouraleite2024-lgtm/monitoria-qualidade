import { useState } from 'react';
import { Download, ExternalLink, FileText, Headphones, X } from 'lucide-react';
import { descricaoDoArquivo, urlDownload, urlNovaAba, urlVisualizador } from '../../domain/evidenciasOneDrive';
import type { ArquivoEvidencia } from '../../domain/evidenciasOneDrive';

// Cada evidência numa linha própria. O quadro só é carregado quando o gestor pede: abrir o painel de
// análise não consulta o OneDrive nem registra acesso a arquivo que ninguém abriu.
export function EvidenciasArquivos({ arquivos }: { arquivos: ArquivoEvidencia[] }) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {arquivos.map((arquivo) => {
        const aberto = Boolean(abertos[arquivo.id]);
        const audio = arquivo.tipo === 'audio';
        return (
          <div key={arquivo.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', minWidth: 0, flex: '1 1 16rem' }}>
                {audio ? <Headphones size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} /> : <FileText size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{audio ? 'Gravação da ligação' : 'Documento Word'}</div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{arquivo.nome}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {descricaoDoArquivo(arquivo)}{arquivo.codigo ? ` · código ${arquivo.codigo}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                <button type="button" className="btn btn-primary btn-sm" aria-expanded={aberto} onClick={() => setAbertos((a) => ({ ...a, [arquivo.id]: !aberto }))}>
                  {aberto ? <><X size={14} /> Fechar</> : audio ? <><Headphones size={14} /> Ouvir</> : <><FileText size={14} /> Visualizar</>}
                </button>
                <a className="btn btn-outline btn-sm" href={urlNovaAba(arquivo)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} /> Abrir em nova aba
                </a>
                {arquivo.downloadLiberado && (
                  <a className="btn btn-outline btn-sm" href={urlDownload(arquivo)} target="_blank" rel="noopener noreferrer">
                    <Download size={14} /> Baixar
                  </a>
                )}
              </div>
            </div>
            {aberto && (
              <iframe
                title={`${audio ? 'Gravação' : 'Documento'}: ${arquivo.nome}`}
                src={urlVisualizador(arquivo)}
                referrerPolicy="no-referrer"
                style={{ display: 'block', width: '100%', height: audio ? '260px' : '560px', border: '1px solid var(--border-color)', borderRadius: '6px', marginTop: '0.75rem' }}
              />
            )}
          </div>
        );
      })}
      <div role="note" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Os arquivos ficam no OneDrive e abrem com a sua conta Microsoft corporativa. Se o quadro não carregar, entre nessa conta ou use "Abrir em nova aba".
      </div>
    </div>
  );
}
