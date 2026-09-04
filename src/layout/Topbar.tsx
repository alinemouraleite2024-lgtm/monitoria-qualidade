import type { ReactNode } from 'react';
import { ROTULO_PERFIL } from '../domain/perfis';
import type { Role, User } from '../types/domain';

/** Item de menu de um perfil. */
export interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  /**
   * Grupo do item na barra lateral. Preenchido apenas no PRIMEIRO item de cada grupo — é ele
   * que faz o cabeçalho aparecer. Separa o que se faz hoje (Operação) do que se ajusta no mês
   * (Gestão) e do que se configura raramente (Configuração); numa lista plana, validar uma
   * monitoria competia visualmente com cadastrar uma meta.
   */
  grupo?: string;
}

export type MenuConfig = Partial<Record<Role, MenuItem[]>>;

interface TopbarProps {
  currentUser: User;
  /** Perfil ativo: decide o menu consultado e o rótulo ao lado do nome (0.20.0). */
  perfilAtivo: Role | null;
  activeTab: string;
  menuConfig: MenuConfig;
  renderUserAvatar: (name: string) => ReactNode;
}

export const Topbar = ({ currentUser, perfilAtivo, activeTab, menuConfig, renderUserAvatar }: TopbarProps) => (
<header className="app-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
  
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
    <div className="breadcrumb">
      <span className="breadcrumb-item">Workspace</span>
      <span style={{ color: 'var(--text-muted)' }}>/</span>
      <span className="breadcrumb-item active">
        {menuConfig[perfilAtivo ?? 'MONITOR']?.find(m => m.id === activeTab)?.label || 'MonitorIA'}
      </span>
    </div>
  </div>

  <div className="global-search" style={{ margin: '0 auto', maxWidth: '400px' }}>
    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    </div>
    <input type="text" placeholder="Pesquisar em toda a plataforma (Ctrl+K)..." disabled />
  </div>

  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      cursor: 'pointer'
    }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.2' }}>{currentUser.name}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '600' }}>{perfilAtivo ? ROTULO_PERFIL[perfilAtivo] : ''}</div>
      </div>
      {renderUserAvatar(currentUser.name)}
    </div>
  </div>
</header>
);
