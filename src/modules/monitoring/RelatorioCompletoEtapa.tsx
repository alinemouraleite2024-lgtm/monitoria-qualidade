import { lazy, Suspense, useMemo } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { MENSAGEM_LIMITE_RELATORIO, dadosPessoaisNoTexto, excedeLimite, tamanhoAmigavel, textoAproximado } from '../../domain/relatorioCompleto';

const EditorRelatorioCompleto = lazy(() => import('./EditorRelatorioCompleto'));

export function RelatorioCompletoEtapa({ valor, aoMudar }: { valor: string; aoMudar: (html: string) => void }) {
  const achados = useMemo(() => dadosPessoaisNoTexto(textoAproximado(valor)), [valor]);
  const passou = excedeLimite(valor);
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ backgroundColor: '#008443', color: '#fff', padding: '0.5rem', borderRadius: '8px', display: 'flex' }}>
          <FileText size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#111827', margin: 0 }}>Relatório Completo da Monitoria</h3>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '2px 0 0' }}>
            Opcional. Cole aqui o relatório do Word. Use o nº do atendimento e o CR como referência, sem nome de cliente, CPF, telefone ou e-mail.
          </p>
        </div>
      </div>
      <Suspense fallback={<div style={{ fontSize: '0.85rem', color: '#6b7280', padding: '1rem' }}>Carregando o editor...</div>}>
        <EditorRelatorioCompleto valor={valor} aoMudar={aoMudar} />
      </Suspense>
      {achados.length > 0 && (
        <div role="alert" className="relatorio-alerta">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>O texto parece conter {achados.join(', ')}. Confira e retire antes de salvar. Este aviso não substitui a conferência: nomes de clientes não são detectados.</span>
        </div>
      )}
      {passou && (
        <div role="alert" className="relatorio-alerta relatorio-alerta-erro">
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{MENSAGEM_LIMITE_RELATORIO}</span>
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: passou ? 'var(--danger)' : '#6b7280', marginTop: '0.5rem', textAlign: 'right' }}>{tamanhoAmigavel(valor)}</div>
    </div>
  );
}
