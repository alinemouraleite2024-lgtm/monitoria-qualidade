// Segundo fator (MFA/TOTP) — tela entre a senha e o portal, no modo compartilhado (P2).
//
// Aparece só quando o banco diz que a sessão precisa dele (api.estado_do_meu_acesso, 12):
//   - cadastrar_mfa: conta ADMIN sem segundo fator → lê o QR code no app autenticador e confirma;
//   - verificar_mfa: conta com segundo fator e sessão só com senha → digita o código atual.
// MONITOR e GESTOR sem fator nunca passam por aqui.
//
// O segredo e o QR code ficam só na memória desta tela: não vão para o localStorage nem para o
// banco do MonitorIA. Mesmo que alguém pule esta tela, o banco não libera nada a um ADMIN sem aal2.
import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Smartphone, LogOut } from 'lucide-react';
import { MouraLeiteTree } from '../../shared/components/MouraLeiteTree';
import { codigoTotpValido } from '../../shared/compartilhado/mfa';
import { confirmarCodigoMfa, fatoresVerificados, iniciarCadastroMfa, type CadastroMfa, type FatorMfa, type LoginAtual } from '../../shared/compartilhado/supabase';
import { mensagemDoErro } from '../../shared/compartilhado/transporte';

interface MfaScreenProps {
  etapa: 'cadastrar_mfa' | 'verificar_mfa';
  onConcluido: (login: LoginAtual) => void;
  onSair: () => void;
}

const cartao: React.CSSProperties = {
  width: '100%', maxWidth: '440px', backgroundColor: '#fff', borderRadius: '16px', borderTop: '4px solid #f28c1c',
  padding: '2rem', boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
};
const campo: React.CSSProperties = {
  width: '100%', height: '52px', padding: '0 0.9rem', fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center',
  border: '1px solid #d1d5db', borderRadius: '10px', fontFamily: 'monospace',
};

export const MfaScreen = ({ etapa, onConcluido, onSair }: MfaScreenProps) => {
  const [cadastro, setCadastro] = useState<CadastroMfa | null>(null);
  const [fatores, setFatores] = useState<FatorMfa[]>([]);
  const [fatorId, setFatorId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Verificação: busca os fatores já cadastrados (o primeiro vem selecionado).
  useEffect(() => {
    if (etapa !== 'verificar_mfa') return;
    let vivo = true;
    fatoresVerificados()
      .then((f) => { if (vivo) { setFatores(f); setFatorId(f[0]?.id ?? ''); } })
      .catch((e) => { if (vivo) setErro(mensagemDoErro(e)); });
    return () => { vivo = false; };
  }, [etapa]);

  const gerarQr = async () => {
    setErro(''); setOcupado(true);
    try {
      const c = await iniciarCadastroMfa(`Autenticador ${new Date().toLocaleDateString('pt-BR')}`);
      setCadastro(c); setFatorId(c.factorId);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setErro('');
    const limpo = codigoTotpValido(codigo);
    if (!limpo) { setErro('Digite os 6 números que aparecem no app autenticador.'); return; }
    if (!fatorId) { setErro('Nenhum autenticador selecionado.'); return; }
    setOcupado(true);
    try {
      const login = await confirmarCodigoMfa(fatorId, limpo);
      setCadastro(null); setCodigo('');
      onConcluido(login);
    } catch (e) {
      setErro(mensagemDoErro(e)); setCodigo('');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d2e1c', padding: '1rem' }}>
      <div style={cartao}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
          <MouraLeiteTree size={34} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Verificação em duas etapas</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Exigida para a conta de Administração</div>
          </div>
        </div>

        {etapa === 'cadastrar_mfa' && !cadastro && (
          <>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.55, color: '#374151' }}>
              Esta conta precisa de um segundo fator. Instale no celular um app autenticador (por exemplo,
              Microsoft Authenticator ou Google Authenticator) e clique abaixo para gerar o QR code.
            </p>
            <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={gerarQr} disabled={ocupado}>
              <Smartphone size={16} /> {ocupado ? 'Gerando…' : 'Gerar QR code'}
            </button>
          </>
        )}

        {etapa === 'cadastrar_mfa' && cadastro && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: '#374151', textAlign: 'left' }}>
              1. No app autenticador, adicione uma conta e leia o QR code.
            </p>
            <img src={cadastro.qrCode} alt="QR code do segundo fator" style={{ width: '200px', height: '200px', margin: '0.5rem auto' }} />
            <p style={{ fontSize: '0.78rem', color: '#6b7280', wordBreak: 'break-all' }}>
              Sem câmera? Digite esta chave no app: <strong style={{ fontFamily: 'monospace' }}>{cadastro.segredo}</strong>
            </p>
            <p style={{ fontSize: '0.88rem', color: '#374151', textAlign: 'left', marginTop: '0.75rem' }}>2. Digite o código de 6 números que o app mostra.</p>
          </div>
        )}

        {etapa === 'verificar_mfa' && (
          <p style={{ fontSize: '0.9rem', lineHeight: 1.55, color: '#374151' }}>
            Digite o código de 6 números que aparece agora no seu app autenticador.
          </p>
        )}
        {etapa === 'verificar_mfa' && fatores.length > 1 && (
          <select className="form-control" value={fatorId} onChange={(e) => setFatorId(e.target.value)} style={{ marginBottom: '0.75rem' }}>
            {fatores.map((f) => <option key={f.id} value={f.id}>{f.apelido}</option>)}
          </select>
        )}

        {(etapa === 'verificar_mfa' || cadastro) && (
          <form onSubmit={confirmar}>
            <input
              style={campo} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus
              value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Código do app autenticador" placeholder="000000"
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.9rem' }} disabled={ocupado}>
              <ShieldCheck size={16} /> {ocupado ? 'Conferindo…' : 'Confirmar'}
            </button>
          </form>
        )}

        {erro && (
          <div role="alert" style={{ marginTop: '0.9rem', padding: '0.6rem 0.8rem', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '0.85rem' }}>
            {erro}
          </div>
        )}

        <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '1.25rem' }} onClick={onSair}>
          <LogOut size={16} /> Sair
        </button>
        <p style={{ fontSize: '0.74rem', color: '#9ca3af', marginTop: '1rem', lineHeight: 1.5 }}>
          Perdeu o celular ou o app? Não crie outra conta: siga o procedimento de recuperação de acesso da Administração.
        </p>
      </div>
    </div>
  );
};
