import type { FormEvent } from 'react';
import { ShieldAlert, Lock, KeyRound, ArrowRight } from 'lucide-react';
import { MouraLeiteTree } from '../../shared/components/MouraLeiteTree';

// Identidade visual alinhada ao Portal de Simulações da Moura Leite: fundo verde profundo
// com textura de grade discreta, card branco com faixa laranja no topo, árvore do logo e
// tipografia da marca. Alteração exclusivamente visual — os campos, o onSubmit, o botão
// Microsoft e as ferramentas de preenchimento continuam exatamente como estavam.
const MOURA = {
  greenDeep: '#0d2e1c',
  green: '#166534',
  greenDark: '#14532d',
  orange: '#f28c1c',
};

// Grade quase imperceptível, o mesmo recurso do Portal de Simulações. Fica inline porque
// só esta tela usa.
const fundoInstitucional: React.CSSProperties = {
  backgroundColor: MOURA.greenDeep,
  backgroundImage: [
    'radial-gradient(circle at 50% -10%, rgba(255,255,255,0.06), transparent 55%)',
    'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px)',
    'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 32px)',
  ].join(', '),
};

const campo: React.CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 0.9rem',
  fontSize: '0.925rem',
  color: '#111827',
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  outline: 'none',
  transition: 'border-color .15s, box-shadow .15s, background-color .15s',
};

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6b7280',
  marginBottom: '0.4rem',
};

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
  <div className="login-container" style={fundoInstitucional}>

    {/* O autofill do navegador pinta o campo de azul/amarelo por padrão; isto força o
        preenchimento automático a acompanhar o visual do input. */}
    <style>{`
      .ml-login-input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #f9fafb inset; -webkit-text-fill-color: #111827; }
      .ml-login-input:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px #ffffff inset; }
      .ml-login-input:focus { background-color: #fff; border-color: ${MOURA.green}; box-shadow: 0 0 0 4px rgba(22,101,52,0.13); }
      .ml-login-submit { background-color: ${MOURA.green}; }
      .ml-login-submit:hover { background-color: ${MOURA.greenDark}; box-shadow: 0 0 0 4px rgba(242,140,28,0.24); }
      .ml-login-submit:focus-visible { outline: 3px solid ${MOURA.orange}; outline-offset: 2px; }
      .ml-login-ghost:hover { color: ${MOURA.green}; }
    `}</style>

    <div style={{ width: '100%', maxWidth: '420px' }}>

      <div className="login-card animate-scale-in">
        {/* Faixa laranja: assinatura visual compartilhada com o Portal de Simulações */}
        <div style={{ height: '6px', backgroundColor: MOURA.orange }} />

        <div style={{ padding: '1.75rem 1.75rem 1.75rem' }}>

          {/* marca */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1.25rem' }}>
            <MouraLeiteTree size={62} showSun />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827', letterSpacing: '0.02em' }}>
                MOURA LEITE
              </div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.16em', color: MOURA.orange }}>
                LOTEAMENTOS
              </div>
            </div>
          </div>

          {/* identidade do produto */}
          <div style={{ paddingBottom: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid #f0f1f0' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
              MonitorIA
            </div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.15rem' }}>
              Plataforma de Gestão da Qualidade
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.55rem', backgroundColor: '#f3f4f6', borderRadius: '999px', color: '#6b7280' }}>
                v2.0.0
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.55rem', backgroundColor: 'rgba(242,140,28,0.12)', color: '#b26a12', borderRadius: '999px' }}>
                Ambiente de Homologação
              </span>
            </div>
          </div>

          {loginError && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', padding: '0.7rem 0.85rem', borderRadius: '8px', marginBottom: '1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <label style={rotulo} htmlFor="ml-login-email">Usuário</label>
              <input
                id="ml-login-email"
                type="email"
                className="ml-login-input"
                style={campo}
                placeholder="seu.email@mouraleite.com.br"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={rotulo} htmlFor="ml-login-senha">Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="ml-login-senha"
                  type="password"
                  className="ml-login-input"
                  style={{ ...campo, paddingLeft: '2.5rem' }}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <KeyRound size={16} style={{ color: '#9ca3af', position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            <button
              type="submit"
              className="ml-login-submit"
              style={{
                width: '100%', height: '48px', marginTop: '0.35rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
                color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                transition: 'background-color .15s, box-shadow .15s',
              }}
            >
              Entrar
              <ArrowRight size={17} />
            </button>
          </form>

          <div style={{ margin: '1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#eef0ef' }}></div>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af' }}>OU</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#eef0ef' }}></div>
          </div>

          <button type="button" className="microsoft-btn" style={{ width: '100%', height: '46px', justifyContent: 'center' }} onClick={() => alert('Integração com Microsoft 365 em desenvolvimento.')}>
            <div className="microsoft-icon">
              <div className="ms-block ms-r"></div>
              <div className="ms-block ms-g"></div>
              <div className="ms-block ms-b"></div>
              <div className="ms-block ms-y"></div>
            </div>
            Entrar com Microsoft
          </button>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.1rem', borderTop: '1px solid #f0f1f0', fontSize: '0.76rem', color: '#9ca3af', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
              <Lock size={12} />
              <span>Acesso restrito a colaboradores Moura Leite</span>
            </div>

            {/* Dev Tools Toggle */}
            <div style={{ marginTop: '0.75rem' }}>
              <button
                className="ml-login-ghost"
                onClick={() => setShowDevTools(!showDevTools)}
                style={{ background: 'none', border: 'none', color: '#b8c0bb', cursor: 'pointer', fontSize: '0.74rem', textDecoration: 'underline', transition: 'color .15s' }}
              >
                {showDevTools ? 'Esconder Ferramentas Dev' : 'Ferramentas Dev (Mock Login)'}
              </button>
            </div>

            {showDevTools && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.85rem', padding: '0.85rem', backgroundColor: '#f7f9f8', borderRadius: '8px' }}>
                <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('admin@mouraleite.com.br'); setLoginPassword('Admin@123'); }}>Preencher Admin</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('raquel@mouraleite.com.br'); setLoginPassword('Gestor@123'); }}>Preencher Gestor (Raquel)</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setLoginEmail('aline@mouraleite.com.br'); setLoginPassword('Monitor@123'); }}>Preencher Monitor (Aline)</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* rodapé institucional, fora do card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', marginTop: '1.75rem' }}>
        <div style={{ width: '2rem', height: '1px', backgroundColor: 'rgba(242,140,28,0.5)' }} />
        <p style={{ margin: 0, textAlign: 'center', fontSize: '0.7rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.55)' }}>
          <span style={{ color: 'rgba(255,255,255,0.78)', fontWeight: 500 }}>© Moura Leite Loteamentos</span>
          <br />
          Uso interno
        </p>
      </div>
    </div>
  </div>
);
