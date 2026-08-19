import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

// F0-13: com roteamento real, um id de destino inválido deixa de produzir uma área de
// conteúdo em branco e passa a mostrar esta tela.
export const NotFoundScreen = () => (
  <div className="animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px dashed var(--border-color)', margin: '2rem' }}>
    <Compass size={64} style={{ color: 'var(--text-muted)', opacity: 0.6, marginBottom: '1.5rem' }} />
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Página não encontrada</h2>
    <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
      O endereço acessado não corresponde a nenhuma tela da plataforma.
    </p>
    <Link className="btn btn-primary" to="/home">Voltar para a Home</Link>
  </div>
);
