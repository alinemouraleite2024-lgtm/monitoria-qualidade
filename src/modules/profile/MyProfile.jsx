import React, { useState } from 'react';
import { Shield, Key, Mail, Building, Briefcase, Clock, CheckCircle2 } from 'lucide-react';
import { logAuthEvent } from '../../auth';

export const MyProfile = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert("As novas senhas não coincidem!");
      return;
    }
    alert("Senha alterada com sucesso!");
    logAuthEvent('CHANGE_PASSWORD', currentUser, 'Usuário alterou a própria senha');
    setPasswordForm({ current: '', new: '', confirm: '' });
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">Meu Perfil</h1>
        <p className="page-subtitle">Gerencie suas informações e credenciais</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Sidebar Card */}
        <div className="section-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ 
            width: '100px', height: '100px', backgroundColor: 'var(--primary)', color: 'white', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem',
            backgroundImage: currentUser.photoUrl ? `url(${currentUser.photoUrl})` : 'none',
            backgroundSize: 'cover'
          }}>
            {!currentUser.photoUrl && currentUser.name?.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{currentUser.name}</h2>
          <span className="badge-pill badge-primary" style={{ marginBottom: '1.5rem' }}>{currentUser.role}</span>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className={`btn ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('info')}>
              <Building size={18} /> Informações Pessoais
            </button>
            <button className={`btn ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`} style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setActiveTab('security')}>
              <Key size={18} /> Segurança e Senha
            </button>
          </div>
        </div>

        {/* Content Card */}
        <div className="section-card">
          {activeTab === 'info' && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Informações da Conta</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><Mail size={16}/> E-mail</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.email}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><Briefcase size={16}/> Cargo</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.cargo || '-'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><Building size={16}/> Área</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.area || '-'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}><Clock size={16}/> Último Acesso</div>
                  <div style={{ color: 'var(--text-main)', fontWeight: '500' }}>{currentUser.lastAccess ? new Date(currentUser.lastAccess).toLocaleString('pt-BR') : '-'}</div>
                </div>
              </div>

              <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '8px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                <h4 style={{ color: '#2563eb', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} /> Provider de Autenticação
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Sua conta está configurada com login <strong>{currentUser.provider}</strong>.
                  O sistema está estruturalmente preparado para futuras integrações (Microsoft 365, Google Workspace, Azure AD).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Alterar Senha</h3>
              
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '400px' }}>
                <div>
                  <label className="form-label">Senha Atual</label>
                  <input type="password" required className="form-control" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Nova Senha</label>
                  <input type="password" required className="form-control" value={passwordForm.new} onChange={e => setPasswordForm({...passwordForm, new: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Confirmar Nova Senha</label>
                  <input type="password" required className="form-control" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
                </div>
                
                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}>
                  Atualizar Senha
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
