import { ShieldAlert } from 'lucide-react';

export const AccessDeniedScreen = () => (
  <div className="animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', margin: '2rem' }}>
    <ShieldAlert size={64} style={{ color: 'var(--danger)', marginBottom: '1.5rem' }} />
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acesso Negado</h2>
    <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
      Você não possui permissão para acessar este módulo. Caso acredite que isto seja um erro, contate o administrador do sistema.
    </p>
  </div>
);
