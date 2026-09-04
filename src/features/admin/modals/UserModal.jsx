import { PRECEDENCIA, ROTULO_PERFIL } from '../../../domain/perfis';

/**
 * Cadastro de usuário do portal.
 *
 * 0.20.0 — duas mudanças, e as duas vêm do mesmo lugar: até aqui este formulário produzia
 * contas que não funcionavam.
 *
 * 1. **Perfis, no plural.** Era um `<select>` de valor único, então uma pessoa que administra e
 *    monitora não cabia no cadastro — só cabia numa regra do código. Agora são caixas de
 *    seleção, e nenhum perfil é obrigatório: quem não marca nenhum fica sem acesso ao portal,
 *    que é como se registra uma colaboradora avaliada mas que não usa o sistema.
 *
 * 2. **Credenciais.** O formulário gravava nome, e-mail e papel — sem login nem senha. Como a
 *    autenticação exige senha, todo usuário criado por aqui era um cadastro que nunca
 *    conseguia entrar. Sem isto, "o Admin pode cadastrar gestores e monitores" seria falso.
 */
export const UserModal = ({
  users = /** @type {import('../../../types/domain').User[]} */ ([]),
  setUsers,
  newUser,
  setNewUser,
  setShowUserModal
}) => {
  const perfis = newUser.perfis || [];

  const alternarPerfil = (perfil) => {
    setNewUser({
      ...newUser,
      perfis: perfis.includes(perfil)
        ? perfis.filter((p) => p !== perfil)
        : [...perfis, perfil]
    });
  };

  const limpar = () => setNewUser({ email: '', name: '', login: '', password: '', perfis: ['MONITOR'], team: '' });

  return (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '450px' }}>
      <div className="modal-header">
        <h3 className="modal-title">Registrar Novo Usuário</h3>
        <button className="modal-close" onClick={() => setShowUserModal(false)}>&times;</button>
      </div>

      <form onSubmit={(e) => {
        e.preventDefault();
        if (!newUser.email || !newUser.name) {
          alert('Preencha os campos obrigatórios.');
          return;
        }
        // Só exige senha de quem vai acessar o portal: sem perfil não há login a proteger.
        if (perfis.length > 0 && !newUser.password) {
          alert('Defina uma senha: sem ela o usuário não consegue entrar no sistema.');
          return;
        }
        if (users.some((u) => u.email.toLowerCase() === newUser.email.toLowerCase())) {
          alert('Já existe um usuário com este e-mail.');
          return;
        }
        setUsers([...users, {
          id: `usr-${Date.now()}`,
          name: newUser.name,
          email: newUser.email,
          login: newUser.login || newUser.email,
          password: newUser.password || '',
          perfis,
          team: perfis.length === 0 ? newUser.team : '',
          status: 'ACTIVE',
          provider: 'INTERNAL',
          active: true
        }]);
        setShowUserModal(false);
        limpar();
      }}>
        <div className="form-group">
          <label className="form-label">Nome Completo*</label>
          <input
            type="text"
            className="form-control"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">E-mail Corporativo M365*</label>
          <input
            type="email"
            className="form-control"
            placeholder="nome@mouraleite.com.br"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Perfis de acesso</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.6rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {PRECEDENCIA.map((perfil) => (
              <label key={perfil} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.87rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={perfis.includes(perfil)}
                  onChange={() => alternarPerfil(perfil)}
                />
                {ROTULO_PERFIL[perfil]}
              </label>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.5 }}>
            {perfis.length > 1
              ? 'Com mais de um perfil, a pessoa alterna o contexto pela barra lateral — sem precisar de uma segunda conta.'
              : perfis.length === 0
                ? 'Sem nenhum perfil marcado, a pessoa é registrada mas não acessa o portal.'
                : 'Marque mais de um se a pessoa acumula funções.'}
          </div>
        </div>

        {perfis.length > 0 && (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Login</label>
              <input
                type="text"
                className="form-control"
                placeholder="opcional — usa o e-mail"
                value={newUser.login || ''}
                onChange={(e) => setNewUser({ ...newUser, login: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha de acesso*</label>
              <input
                type="password"
                className="form-control"
                value={newUser.password || ''}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
          </div>
        )}

        {perfis.length === 0 && (
          <div className="form-group">
            <label className="form-label">Equipe</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: Vendas"
              value={newUser.team || ''}
              onChange={(e) => setNewUser({ ...newUser, team: e.target.value })}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Registrar Usuário
          </button>
        </div>
      </form>
    </div>
  </div>
  );
};
