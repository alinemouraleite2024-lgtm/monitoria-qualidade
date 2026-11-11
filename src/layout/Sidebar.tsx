import { Menu, LogOut, Repeat } from 'lucide-react';
import { perfisDe, ROTULO_PERFIL } from '../domain/perfis';
import type { BrandConfig, Role, User } from '../types/domain';
import type { MenuConfig } from './Topbar';

interface SidebarProps {
  brand: BrandConfig;
  currentUser: User;
  /** Perfil ativo: é ele que escolhe o menu, não os perfis que a pessoa possui. */
  perfilAtivo: Role | null;
  onTrocarPerfil: (perfil: Role) => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  menuConfig: MenuConfig;
  onLogout: () => void;
}

export const Sidebar = ({
  currentUser,
  perfilAtivo,
  onTrocarPerfil,
  activeTab,
  onNavigate,
  sidebarCollapsed,
  setSidebarCollapsed,
  menuConfig,
  onLogout
}: SidebarProps) => (
<aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
  <div className="sidebar-header">
    <a href="#" className="sidebar-brand" onClick={(e) => { e.preventDefault(); onNavigate('monitorings'); }}>
      {/* Árvore e letreiro oficiais, recortados do logotipo branco (arquivos do próprio portal, não da
          configuração). Barra aberta: árvore + letreiro + "Gestão da Qualidade"; recolhida: só a árvore. */}
      <img src="/marca/simbolo-branco.png" className="sidebar-simbolo" alt={sidebarCollapsed ? 'Moura Leite' : ''} />
      {!sidebarCollapsed && (
        <span className="sidebar-marca">
          <img src="/marca/nome-branco.png" className="sidebar-marca-nome" alt="Moura Leite" />
          <span className="sidebar-marca-sub">Gestão da Qualidade</span>
        </span>
      )}
    </a>
    <button className="btn-toggle-sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
      <Menu size={16} />
    </button>
  </div>

  <nav className="sidebar-menu">
    {menuConfig[perfilAtivo ?? 'MONITOR']?.map((item) => {
      const Icon = item.icon;
      return (
        <div key={item.id}>
          {/* Cabeçalho de grupo. Some quando a barra está recolhida: sem os rótulos dos itens,
              um título solto não agrupa nada — só ocupa altura. */}
          {item.grupo && !sidebarCollapsed && (
            <div className="sidebar-group-label">{item.grupo}</div>
          )}
          <a
            href="#"
            className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); onNavigate(item.id); }}
          >
            <Icon size={18} />
            <span className="sidebar-link-text">{item.label}</span>
          </a>
        </div>
      );
    })}
  </nav>

  <div className="sidebar-footer">
    {/* Troca de contexto (0.20.0). Só existe para quem tem mais de um perfil — para as demais
        pessoas o bloco inteiro não é renderizado, em vez de aparecer desabilitado. Fica no
        rodapé, junto à identidade, porque trocar de perfil é mudar quem você é aqui, não
        navegar para outro lugar. */}
    {!sidebarCollapsed && perfisDe(currentUser).length > 1 && (
      <div className="sidebar-perfis">
        <div className="sidebar-perfis-label">
          <Repeat size={12} /> Perfil ativo
        </div>
        <div className="sidebar-perfis-opcoes">
          {perfisDe(currentUser).map((p) => (
            <button
              key={p}
              type="button"
              className={`sidebar-perfil-btn ${p === perfilAtivo ? 'ativo' : ''}`}
              onClick={() => onTrocarPerfil(p)}
              aria-pressed={p === perfilAtivo}
            >
              {ROTULO_PERFIL[p]}
            </button>
          ))}
        </div>
      </div>
    )}

    <div className="sidebar-user">
      {!sidebarCollapsed && (
        <div className="sidebar-user-details">
          <span className="sidebar-user-name">{currentUser.name}</span>
          <span className="sidebar-user-role">
            {perfilAtivo ? ROTULO_PERFIL[perfilAtivo] : ''}
          </span>
        </div>
      )}
      <button className="btn-sidebar-logout" onClick={onLogout} title="Sair">
        <LogOut size={16} />
      </button>
    </div>
  </div>
</aside>
);
