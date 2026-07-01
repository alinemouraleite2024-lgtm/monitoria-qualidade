import { useState } from 'react';
import { Shield, Check, X, ShieldAlert } from 'lucide-react';
import { ROLES, PERMISSIONS } from '../../auth';

export const RolesManagement = () => {
  const [activeRole, setActiveRole] = useState(ROLES.ADMIN);

  // Group permissions for better visualization
  const groupedPermissions = {
    'Visão e Dashboards': ['VIEW_DASHBOARD', 'VIEW_PLANNING', 'VIEW_CENTRAL_DEMANDS', 'VIEW_MONITORINGS', 'VIEW_SURVEYS', 'VIEW_REPORTS', 'VIEW_COLLABORATORS'],
    'Operação': ['VIEW_MY_DEMANDS', 'VIEW_MY_MONITORINGS', 'VIEW_CALENDAR', 'VIEW_OPERATIONAL_CALENDAR'],
    'Administração': ['VIEW_USERS', 'VIEW_ADMINISTRATION', 'VIEW_ROLES', 'VIEW_AUDIT_LOGS', 'VIEW_SETTINGS', 'VIEW_INTEGRATIONS'],
    'Ações de Monitoria': ['CREATE_MONITORING', 'EDIT_MONITORING', 'DELETE_MONITORING', 'APPROVE_MONITORING'],
    'Relatórios e Configurações': ['EXPORT_REPORTS', 'MANAGE_USERS', 'MANAGE_INTEGRATIONS']
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Perfis e Permissões</h1>
        <p className="page-subtitle">Controle granular de acessos por perfil</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
        <div className="section-card" style={{ padding: '0' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>Perfis do Sistema</div>
          {Object.values(ROLES).map(role => (
            <div 
              key={role}
              onClick={() => setActiveRole(role)}
              style={{ 
                padding: '1rem', 
                cursor: 'pointer', 
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: activeRole === role ? 'var(--bg-main)' : 'transparent',
                borderLeft: activeRole === role ? '4px solid var(--primary)' : '4px solid transparent',
                display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}
            >
              <Shield size={16} style={{ color: activeRole === role ? 'var(--primary)' : 'var(--text-muted)' }} />
              {role}
            </div>
          ))}
        </div>

        <div className="section-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Permissões do Perfil: <span className="badge-pill badge-primary">{activeRole}</span>
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>As permissões marcadas estão concedidas para este perfil.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {Object.entries(groupedPermissions).map(([group, perms]) => (
              <div key={group}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                  {group}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {perms.map(p => {
                    const hasAccess = PERMISSIONS[p]?.includes(activeRole);
                    return (
                      <div key={p} style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        padding: '0.75rem 1rem', 
                        backgroundColor: hasAccess ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-main)',
                        border: hasAccess ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-color)',
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{p}</span>
                        {hasAccess ? <Check size={16} style={{ color: 'var(--success)' }} /> : <X size={16} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <ShieldAlert style={{ color: 'var(--danger)' }} />
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Atenção:</strong> A edição dinâmica de permissões está restrita na versão atual (Homologação). Para alterar permanentemente, solicite à equipe técnica a atualização do arquivo <code>auth.js</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
