import type { FormEvent } from 'react';
import { ShieldAlert, Clock } from 'lucide-react';

interface LoginScreenProps {
  loginEmail: string;
  setLoginEmail: (v: string) => void;
  loginPassword: string;
  setLoginPassword: (v: string) => void;
  loginError: string;
  showDevTools: boolean;
  setShowDevTools: (v: boolean) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export const LoginScreen = ({
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  loginError,
  showDevTools,
  setShowDevTools,
  onSubmit
}: LoginScreenProps) => (
  <div className="login-container" style={{ width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="login-card animate-scale-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '420px', backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          height: '60px', 
          width: '60px', 
          backgroundColor: 'rgba(0,132,67,0.08)', 
          color: 'var(--primary)', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          fontSize: '1.75rem',
          fontWeight: 'bold'
        }}>
          ML
        </div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Plataforma de Gestão da Qualidade
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>v2.0.0</span>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04', borderRadius: '12px', fontWeight: '500' }}>Ambiente de Homologação</span>
        </div>
      </div>

      {loginError && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={16} />
          <span>{loginError}</span>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.85rem' }}>Usuário</label>
          <input 
            type="email" 
            className="form-input" 
            placeholder="Seu e-mail de acesso..."
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ fontSize: '0.85rem' }}>Senha</label>
          <input 
            type="password" 
            className="form-input" 
            placeholder="••••••••"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', justifyContent: 'center', fontSize: '0.95rem' }}>
          Entrar
        </button>
      </form>

      <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OU</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
      </div>

      <button type="button" className="microsoft-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => alert('Integração com Microsoft 365 em desenvolvimento.')}>
        <div className="microsoft-icon">
          <div className="ms-block ms-r"></div>
          <div className="ms-block ms-g"></div>
          <div className="ms-block ms-b"></div>
          <div className="ms-block ms-y"></div>
        </div>
        Entrar com Microsoft
      </button>


      <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <Clock size={14} />
          <span>Simulação Comercial: 05 de Junho, 2026</span>
        </div>
        
        {/* Dev Tools Toggle */}
        <div style={{ marginTop: '1rem' }}>
          <button 
            onClick={() => setShowDevTools(!showDevTools)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            {showDevTools ? 'Esconder Ferramentas Dev' : 'Ferramentas Dev (Mock Login)'}
          </button>
        </div>

        {showDevTools && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-app)', borderRadius: '8px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('admin@mouraleite.com.br'); setLoginPassword('Admin@123'); }}>Preencher Admin</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('raquel@mouraleite.com.br'); setLoginPassword('Gestor@123'); }}>Preencher Gestor (Raquel)</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('aline@mouraleite.com.br'); setLoginPassword('Monitor@123'); }}>Preencher Monitor (Aline)</button>
          </div>
        )}
      </div>
    </div>
  </div>
);
