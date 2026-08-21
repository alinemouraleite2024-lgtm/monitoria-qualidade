import { Bell } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AnyRole, User } from '../types/domain';

/** Item de menu de um perfil. */
export interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

export type MenuConfig = Partial<Record<AnyRole, MenuItem[]>>;

interface TopbarProps {
  currentUser: User;
  activeTab: string;
  menuConfig: MenuConfig;
  renderUserAvatar: (name: string) => ReactNode;
}

export const Topbar = ({ currentUser, activeTab, menuConfig, renderUserAvatar }: TopbarProps) => (
<header className="app-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
  
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
    <div className="breadcrumb">
      <span className="breadcrumb-item">Workspace</span>
      <span style={{ color: 'var(--text-muted)' }}>/</span>
      <span className="breadcrumb-item active">
        {menuConfig[currentUser.role]?.find(m => m.id === activeTab)?.label || 'MonitorIA'}
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
    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative' }}>
      <Bell size={20} />
      <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', backgroundColor: 'var(--danger)', borderRadius: '50%' }}></span>
    </button>

    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>

    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      cursor: 'pointer'
    }}>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.2' }}>{currentUser.name}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '600' }}>{currentUser.role}</div>
      </div>
      {renderUserAvatar(currentUser.name)}
    </div>
  </div>
</header>
);
