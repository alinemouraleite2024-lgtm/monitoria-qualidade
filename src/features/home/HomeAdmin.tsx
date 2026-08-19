import { Users, CheckCircle2, ShieldAlert, Settings2, Plug } from 'lucide-react';
import type { User } from '../../types/domain';

// currentUser é recebido para manter o contrato com os demais Home*, mas esta tela não o usa.
export const HomeAdmin = (_props: { currentUser: User }) => (
  <div className="animate-fade-in" style={{ padding: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Centro de Operações (Admin)
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Visão geral de saúde do sistema e integrações.</p>
      </div>
    </div>
    
    <div className="grid-cols-4" style={{ marginBottom: '2rem' }}>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Usuários Ativos</div>
          <Users size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>24</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>+3</span> esta semana</div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Integrações</div>
          <Plug size={20} style={{ color: 'var(--info)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>3</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Microsoft, Slack, ERP</span></div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Versão Atual</div>
          <Settings2 size={20} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>v2.0.0</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Ambiente de Homologação</span></div>
      </div>
      <div className="executive-card">
        <div className="executive-card-header">
          <div className="executive-card-title">Status do Sistema</div>
          <CheckCircle2 size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginTop: '0.5rem' }}>Operacional</div>
        <div className="executive-card-meta"><span style={{ color: 'var(--text-muted)' }}>Uptime 99.9%</span></div>
      </div>
    </div>

    <div className="grid-cols-2">
      <div className="section-card">
        <h2 className="section-card-title"><ShieldAlert size={18} /> Alertas de Segurança & Logs</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px' }}>
            <div style={{ fontWeight: '600', color: '#ca8a04', marginBottom: '0.25rem' }}>Tentativa de Acesso Inválido</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>IP 192.168.1.100 tentou acessar /admin há 2 horas.</div>
          </div>
          <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Backup Automático Concluído</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sincronização com o Azure finalizada com sucesso.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
