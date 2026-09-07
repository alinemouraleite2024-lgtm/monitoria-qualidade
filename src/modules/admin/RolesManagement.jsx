import { Fragment } from 'react';
import { Check, Minus, ShieldAlert } from 'lucide-react';
import { PERMISSIONS } from '../../auth';
import { PRECEDENCIA, ROTULO_PERFIL } from '../../domain/perfis';

/**
 * Referência de acesso por perfil (0.21.0).
 *
 * A versão anterior listava **nomes técnicos de permissão** em monospace — `VIEW_DASHBOARD`,
 * `MANAGE_INTEGRATIONS` — agrupados por uma lista escrita à mão. Dois problemas graves:
 *
 * 1. Onze das permissões listadas **não existiam mais** (removidas na 0.19.0). Como
 *    `PERMISSIONS[chave]` devolvia `undefined`, cada uma aparecia com ✗ vermelho, exatamente
 *    como uma permissão negada. A tela afirmava, com confiança, coisas falsas sobre o sistema.
 * 2. Quatro permissões reais não estavam em grupo nenhum e simplesmente não apareciam.
 *
 * A correção não é atualizar a lista à mão — é parar de manter uma segunda lista. Agora a
 * tabela é derivada de `PERMISSIONS`, a mesma fonte que o RouteGuard consulta: o que a tela
 * mostra é, por construção, o que o sistema faz.
 *
 * E mostra em linguagem de negócio: quem administra precisa saber que o Gestor vê "Metas", não
 * que ele possui `VIEW_PLANNING`.
 */

/**
 * O que cada permissão significa para quem lê. Permissão sem tradução aqui não aparece — é a
 * escolha deliberada: uma linha "MANAGE_INTEGRATIONS" não informa nada a quem administra, e o
 * dia em que uma permissão nova importar para a operação, ela ganha um nome aqui.
 */
const ACESSOS = [
  { grupo: 'Operação', chave: 'VIEW_MONITORINGS', rotulo: 'Monitorias', o_que: 'Ver a fila de trabalho do mês' },
  { grupo: 'Operação', chave: 'VIEW_MONITORING_FORM', rotulo: 'Realizar monitoria', o_que: 'Abrir e preencher o formulário de avaliação' },
  { grupo: 'Operação', chave: 'APPROVE_MONITORING', rotulo: 'Validar monitoria', o_que: 'Aprovar, devolver e confirmar critério eliminatório' },
  { grupo: 'Operação', chave: 'DELETE_MONITORING', rotulo: 'Cancelar monitoria', o_que: 'Cancelar um registro já gravado' },

  { grupo: 'Acompanhamento', chave: 'VIEW_REPORTS', rotulo: 'Relatórios', o_que: 'Consultar e filtrar monitorias por competência' },
  { grupo: 'Acompanhamento', chave: 'EXPORT_REPORTS', rotulo: 'Exportar relatórios', o_que: 'Gerar o documento consolidado do período' },
  { grupo: 'Acompanhamento', chave: 'VIEW_DASHBOARD', rotulo: 'Painel', o_que: 'Indicadores de produtividade e cumprimento de meta' },

  { grupo: 'Gestão da equipe', chave: 'VIEW_COLLABORATORS', rotulo: 'Equipe e Carteiras', o_que: 'Vincular colaboradoras às monitoras' },
  { grupo: 'Gestão da equipe', chave: 'VIEW_PLANNING', rotulo: 'Metas', o_que: 'Definir a meta de monitorias do período' },

  { grupo: 'Configuração', chave: 'VIEW_ADMINISTRATION', rotulo: 'Administração', o_que: 'Critérios, áreas, colaboradores, fluxo e marca' },
  { grupo: 'Configuração', chave: 'MANAGE_USERS', rotulo: 'Usuários e acessos', o_que: 'Cadastrar pessoas e conceder perfis' },
];

const GRUPOS = [...new Set(ACESSOS.map((a) => a.grupo))];

export const RolesManagement = () => (
  <div className="section-card animate-fade-in">
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>
        O que cada perfil pode fazer
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
        Uma pessoa pode acumular perfis e alterna entre eles pela barra lateral. O acesso segue
        sempre o <strong>perfil ativo</strong> no momento — não a soma dos perfis que ela tem.
      </p>
    </div>

    <div className="table-responsive">
      <table className="table-premium">
        <thead>
          <tr>
            <th>Acesso</th>
            {PRECEDENCIA.map((perfil) => (
              <th key={perfil} style={{ width: '120px', textAlign: 'center' }}>
                {ROTULO_PERFIL[perfil]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GRUPOS.map((grupo) => (
            <Fragment key={grupo}>
              <tr>
                <td colSpan={1 + PRECEDENCIA.length} style={{ backgroundColor: 'var(--bg-main)', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '0.5rem 0.75rem' }}>
                  {grupo.toUpperCase()}
                </td>
              </tr>
              {ACESSOS.filter((a) => a.grupo === grupo).map((acesso) => (
                <tr key={acesso.chave}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{acesso.rotulo}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{acesso.o_que}</div>
                  </td>
                  {PRECEDENCIA.map((perfil) => {
                    const tem = (PERMISSIONS[acesso.chave] || []).includes(perfil);
                    return (
                      <td key={perfil} style={{ textAlign: 'center' }}>
                        {tem
                          ? <Check size={17} style={{ color: 'var(--success)' }} aria-label="Tem acesso" />
                          : <Minus size={17} style={{ color: 'var(--border-color)' }} aria-label="Sem acesso" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>

    <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <ShieldAlert size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '1px' }} />
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Esta tabela é de consulta: os acessos de cada perfil são fixos e valem para todos os
        usuários daquele perfil. Para dar ou tirar acesso de uma pessoa, altere os
        <strong> perfis</strong> dela em <strong>Usuários</strong>.
      </div>
    </div>
  </div>
);
