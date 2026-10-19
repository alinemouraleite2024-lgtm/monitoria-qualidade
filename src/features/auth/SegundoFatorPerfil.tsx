// Meu Perfil › Segurança: segundos fatores da conta ADMIN (P2).
//
// Mostra os autenticadores cadastrados e permite cadastrar MAIS UM — a recomendação é ter dois
// (por exemplo, dois celulares), porque o Supabase não tem códigos de recuperação: perder o único
// autenticador tranca a conta até o procedimento de recuperação. Remover fator não é feito por
// aqui de propósito: é um ato de recuperação, com registro (supabase/MFA-ADMIN.md).
import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { codigoTotpValido } from '../../shared/compartilhado/mfa';
import { confirmarCodigoMfa, fatoresVerificados, iniciarCadastroMfa, type CadastroMfa, type FatorMfa } from '../../shared/compartilhado/supabase';
import { mensagemDoErro } from '../../shared/compartilhado/transporte';

export const SegundoFatorPerfil = () => {
  const [fatores, setFatores] = useState<FatorMfa[] | null>(null);
  const [cadastro, setCadastro] = useState<CadastroMfa | null>(null);
  const [codigo, setCodigo] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = () => fatoresVerificados().then(setFatores).catch((e) => setMsg({ tipo: 'erro', texto: mensagemDoErro(e) }));
  useEffect(() => { void recarregar(); }, []);

  const gerar = async () => {
    setMsg(null); setOcupado(true);
    try { setCadastro(await iniciarCadastroMfa(`Autenticador ${(fatores?.length ?? 0) + 1} — ${new Date().toLocaleDateString('pt-BR')}`)); }
    catch (e) { setMsg({ tipo: 'erro', texto: mensagemDoErro(e) }); }
    finally { setOcupado(false); }
  };

  const confirmar = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const limpo = codigoTotpValido(codigo);
    if (!limpo || !cadastro) { setMsg({ tipo: 'erro', texto: 'Digite os 6 números que aparecem no novo autenticador.' }); return; }
    setOcupado(true);
    try {
      await confirmarCodigoMfa(cadastro.factorId, limpo);
      setCadastro(null); setCodigo('');
      setMsg({ tipo: 'ok', texto: 'Autenticador cadastrado.' });
      await recarregar();
    } catch (e) {
      setMsg({ tipo: 'erro', texto: mensagemDoErro(e) }); setCodigo('');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
      <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <ShieldCheck size={18} /> Verificação em duas etapas
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 0 }}>
        Obrigatória para a conta de Administração. Mantenha <strong>dois autenticadores</strong> cadastrados: sem nenhum, a conta fica bloqueada até a recuperação de acesso.
      </p>
      {fatores === null ? (
        <p style={{ fontSize: '0.85rem' }}>Carregando…</p>
      ) : (
        <ul style={{ fontSize: '0.88rem', paddingLeft: '1.1rem' }}>
          {fatores.map((f) => <li key={f.id}>{f.apelido} · cadastrado em {new Date(f.criadoEm).toLocaleDateString('pt-BR')}</li>)}
          {fatores.length === 0 && <li>Nenhum autenticador verificado.</li>}
        </ul>
      )}
      {fatores && fatores.length < 2 && !cadastro && (
        <p style={{ fontSize: '0.85rem', color: 'var(--warning)' }}>Recomendado: cadastre um segundo autenticador.</p>
      )}
      {!cadastro ? (
        <button type="button" className="btn btn-secondary" onClick={gerar} disabled={ocupado}>
          <Smartphone size={16} /> {ocupado ? 'Gerando…' : 'Cadastrar outro autenticador'}
        </button>
      ) : (
        <form onSubmit={confirmar} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '320px' }}>
          <img src={cadastro.qrCode} alt="QR code do novo autenticador" style={{ width: '180px', height: '180px' }} />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            Chave para digitar à mão: <strong style={{ fontFamily: 'monospace' }}>{cadastro.segredo}</strong>
          </span>
          <input className="form-control" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="Código de 6 números"
            value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Código do novo autenticador" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={ocupado}>{ocupado ? 'Conferindo…' : 'Confirmar'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setCadastro(null); setCodigo(''); }}>Cancelar</button>
          </div>
        </form>
      )}
      {msg && <p role="status" style={{ fontSize: '0.85rem', color: msg.tipo === 'ok' ? 'var(--primary)' : 'var(--danger)' }}>{msg.texto}</p>}
    </div>
  );
};
