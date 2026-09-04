import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { ReactNode } from 'react';
import type { BrandConfig, Role, User } from '../types/domain';
import type { MenuConfig } from './Topbar';

interface AppShellProps {
  brand: BrandConfig;
  currentUser: User;
  perfilAtivo: Role | null;
  onTrocarPerfil: (perfil: Role) => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  menuConfig: MenuConfig;
  onLogout: () => void;
  renderUserAvatar: (name: string) => ReactNode;
  children?: ReactNode;
}

export const AppShell = ({
  brand,
  currentUser,
  perfilAtivo,
  onTrocarPerfil,
  activeTab,
  onNavigate,
  sidebarCollapsed,
  setSidebarCollapsed,
  menuConfig,
  onLogout,
  renderUserAvatar,
  children
}: AppShellProps) => (
  <div className="layout-wrapper">

    {/* Collapsible Left Sidebar */}
    <Sidebar
      brand={brand}
      currentUser={currentUser}
      perfilAtivo={perfilAtivo}
      onTrocarPerfil={onTrocarPerfil}
      activeTab={activeTab}
      onNavigate={onNavigate}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      menuConfig={menuConfig}
      onLogout={onLogout}
    />

    {/* Main workspace layout */}
    <div className="app-container">

      <Topbar
        currentUser={currentUser}
        perfilAtivo={perfilAtivo}
        activeTab={activeTab}
        menuConfig={menuConfig}
        renderUserAvatar={renderUserAvatar}
      />

      <main className="main-content">
        {children}
      </main>
    </div>
  </div>
);
