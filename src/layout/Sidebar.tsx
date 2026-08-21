import { Menu, LogOut } from 'lucide-react';
import type { BrandConfig, User } from '../types/domain';
import type { MenuConfig } from './Topbar';

interface SidebarProps {
  brand: BrandConfig;
  currentUser: User;
  activeTab: string;
  onNavigate: (tab: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  menuConfig: MenuConfig;
  onLogout: () => void;
}

export const Sidebar = ({
  brand,
  currentUser,
  activeTab,
  onNavigate,
  sidebarCollapsed,
  setSidebarCollapsed,
  menuConfig,
  onLogout
}: SidebarProps) => (
<aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
  <div className="sidebar-header">
    <a href="#" className="sidebar-brand" onClick={(e) => { e.preventDefault(); onNavigate('home'); }}>
      <img src={brand.logoUrl} className="sidebar-logo" alt={brand.name} />
      <span className="sidebar-title sidebar-brand-text" style={{ marginLeft: '0.5rem' }}>{brand.name}</span>
    </a>
    <button className="btn-toggle-sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
      <Menu size={16} />
    </button>
  </div>

  <nav className="sidebar-menu">
    {menuConfig[currentUser.role]?.map((item) => {
      const Icon = item.icon;
      return (
        <a 
          key={item.id}
          href="#" 
          className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); onNavigate(item.id); }}
        >
          <Icon size={18} />
          <span className="sidebar-link-text">{item.label}</span>
        </a>
      );
    })}
  </nav>

  <div className="sidebar-footer">
    <div className="sidebar-user">
      {!sidebarCollapsed && (
        <div className="sidebar-user-details">
          <span className="sidebar-user-name">{currentUser.name}</span>
          <span className="sidebar-user-role">{currentUser.role}</span>
        </div>
      )}
      <button className="btn-sidebar-logout" onClick={onLogout} title="Sair">
        <LogOut size={16} />
      </button>
    </div>
  </div>
</aside>
);
