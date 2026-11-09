import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { copiarRelatorio, sanitizarRelatorio } from './relatorioHtml';

// Carregado sob demanda, só em monitoria que tem relatório. O conteúdo é limpo de novo aqui, mesmo
// que já tenha sido limpo ao colar e conferido pelo banco: exibir é o momento em que ele pode agir.
export default function RelatorioCompletoVisualizacao({ html }: { html: string }) {
  const limpo = useMemo(() => sanitizarRelatorio(html), [html]);
  const [aviso, setAviso] = useState('');
  const copiar = async () => {
    try {
      await copiarRelatorio(limpo);
      setAviso('Relatório copiado com a formatação.');
    } catch {
      setAviso('O navegador não permitiu copiar. Selecione o texto e copie manualmente.');
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Relatório Completo</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copiar}><Copy size={14} /> Copiar relatório</button>
      </div>
      {aviso && <div role="status" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{aviso}</div>}
      <div className="relatorio-rolagem">
        <div className="relatorio-conteudo" dangerouslySetInnerHTML={{ __html: limpo }} />
      </div>
    </div>
  );
}
