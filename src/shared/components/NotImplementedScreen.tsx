import { Settings2 } from 'lucide-react';

export const NotImplementedScreen = ({ title }: { title?: string }) => (
  <div className="animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed var(--border-color)', margin: '2rem' }}>
    <Settings2 size={64} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: '1.5rem' }} />
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{title || 'Em Desenvolvimento'}</h2>
    <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
      Este módulo ainda não foi implementado. Estamos trabalhando para disponibilizar esta funcionalidade nas próximas atualizações da plataforma.
    </p>
  </div>
);
