import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CANAIS, canalLabel } from '../../constants/canais';
import { periodToCompetencia, competenciaLabel } from '../../domain/period';

/**
 * Editor do plano de metas (0.23.0).
 *
 * O plano declara o padrão uma vez, com vigência. Antes, a mesma meta era recadastrada mês a
 * mês — cinco colaboradoras por doze competências, sessenta cadastros por ano para dizer sempre
 * a mesma coisa, e a competência esquecida ficava sem denominador.
 *
 * A edição de um plano em curso **não reescreve o passado**: quem salva vê, antes, de qual
 * competência em diante a mudança vale. A mecânica está em `sucederPlano`; aqui só se avisa,
 * porque uma alteração que reavalia meses fechados sem dizer nada é a forma mais silenciosa de
 * corromper um histórico.
 */
export const PlanoMetasEditor = ({
  plano = /** @type {import('../../types/domain').PlanoMetas | null} */ (null),
  periodoAtual,
  getMonitors,
  getCollaborators,
  onSalvar,
  onFechar,
}) => {
  const competenciaAtual = periodToCompetencia(periodoAtual);
  const monitores = getMonitors();
  const colaboradoras = getCollaborators();

  const [nome, setNome] = useState(plano?.nome ?? `Plano ${periodoAtual.year}`);
  const [inicio, setInicio] = useState(plano?.vigenciaInicio ?? competenciaAtual);
  const [fim, setFim] = useState(plano?.vigenciaFim ?? `${periodoAtual.year}-12`);
  const [linhas, setLinhas] = useState(plano?.linhas ?? []);

  const [nova, setNova] = useState({
    monitorId: monitores[0]?.id ?? '',
    colaboradorId: colaboradoras[0]?.id ?? '',
    canal: '',
    targetQty: 10,
    entraEm: '',
  });

  const nomeDe = (id) =>
    colaboradoras.find(c => c.id === id)?.name ?? monitores.find(m => m.id === id)?.name ?? 'N/A';

  // A sucessão só acontece quando a vigência JÁ começou; senão a edição é no lugar.
  const vaiSuceder = Boolean(plano) && plano.vigenciaInicio < competenciaAtual;

  const totalMensal = linhas.reduce((s, l) => s + Number(l.targetQty || 0), 0);

  const adicionar = () => {
    if (!nova.monitorId || !nova.colaboradorId) return;
    const jaTem = linhas.some(l =>
      l.monitorId === nova.monitorId
      && l.colaboradorId === nova.colaboradorId
      && (l.canal ?? '') === nova.canal);
    if (jaTem) {
      alert(`${nomeDe(nova.colaboradorId)} já tem uma linha com este escopo no plano.`);
      return;
    }
    setLinhas([...linhas, {
      monitorId: nova.monitorId,
      colaboradorId: nova.colaboradorId,
      targetQty: parseInt(String(nova.targetQty), 10) || 0,
      ...(nova.canal ? { canal: nova.canal } : {}),
      ...(nova.entraEm ? { entraEm: nova.entraEm } : {}),
    }]);
  };

  const salvar = () => {
    if (!nome.trim()) { alert('Dê um nome ao plano.'); return; }
    if (fim < inicio) { alert('A vigência termina antes de começar.'); return; }
    if (linhas.length === 0) { alert('Um plano sem linhas não define meta nenhuma.'); return; }

    onSalvar({
      id: plano?.id ?? `plano-${Date.now()}`,
      nome: nome.trim(),
      vigenciaInicio: inicio,
      vigenciaFim: fim,
      linhas,
      criadoPor: plano?.criadoPor ?? '',
      criadoEm: plano?.criadoEm ?? new Date().toISOString(),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '860px' }}>
        <div className="modal-header">
          <h3 className="modal-title">{plano ? 'Editar plano de metas' : 'Novo plano de metas'}</h3>
          <button className="modal-close" onClick={onFechar}>&times;</button>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Nome do plano</label>
            <input
              className="form-control"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Plano 2026 · 2º semestre"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vigência — início</label>
            <input type="month" className="form-control" value={inicio}
              onChange={(e) => setInicio(e.target.value)} disabled={vaiSuceder} />
          </div>
          <div className="form-group">
            <label className="form-label">Vigência — fim</label>
            <input type="month" className="form-control" value={fim}
              onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>

        {vaiSuceder && (
          <div style={{
            display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
            padding: '0.7rem 0.85rem', marginBottom: '1rem',
            backgroundColor: 'var(--warning-light)', border: '1px solid var(--warning)',
            borderRadius: 'var(--border-radius-sm)', fontSize: '0.83rem',
          }}>
            <span aria-hidden="true">🗓️</span>
            <span>
              A alteração vale a partir de <strong>{competenciaLabel(competenciaAtual)}</strong>.
              As competências anteriores mantêm os valores que já tinham — o cumprimento
              histórico não muda.
            </span>
          </div>
        )}

        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label className="form-label">Colaboradora</label>
            <select className="form-control" value={nova.colaboradorId}
              onChange={(e) => setNova({ ...nova, colaboradorId: e.target.value })}>
              {colaboradoras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Monitora</label>
            <select className="form-control" value={nova.monitorId}
              onChange={(e) => setNova({ ...nova, monitorId: e.target.value })}>
              {monitores.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Escopo</label>
            <select className="form-control" value={nova.canal}
              onChange={(e) => setNova({ ...nova, canal: e.target.value })}>
              <option value="">Meta geral</option>
              {CANAIS.map(c => <option key={c} value={c}>Somente {canalLabel(c)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ maxWidth: '110px' }}>
            <label className="form-label">Por mês</label>
            <input type="number" min="1" className="form-control" value={nova.targetQty}
              onChange={(e) => setNova({ ...nova, targetQty: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: '150px' }}>
            <label className="form-label">Entra em</label>
            <input type="month" className="form-control" value={nova.entraEm}
              onChange={(e) => setNova({ ...nova, entraEm: e.target.value })} />
          </div>
          <button type="button" className="btn btn-secondary" onClick={adicionar}
            style={{ marginBottom: '1rem' }}>
            <Plus size={15} /> Adicionar
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.5rem' }}>
          <strong>Entra em</strong> é opcional: preencha para quem começa depois do início da
          vigência. A linha não aparece nas competências anteriores à data informada.
        </p>

        <div className="table-responsive" style={{ marginTop: '1rem' }}>
          <table className="table-premium">
            <thead>
              <tr>
                <th>Colaboradora</th>
                <th>Monitora</th>
                <th>Escopo</th>
                <th>Meta mensal</th>
                <th>Entra em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nenhuma linha ainda. Um plano sem linhas não define meta nenhuma.
                  </td>
                </tr>
              )}
              {linhas.map((l, i) => (
                <tr key={`${l.monitorId}::${l.colaboradorId}::${l.canal ?? 'geral'}`}>
                  <td style={{ fontWeight: '600' }}>{nomeDe(l.colaboradorId)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{nomeDe(l.monitorId)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {l.canal ? canalLabel(l.canal) : 'Qualquer canal'}
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{l.targetQty}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {l.entraEm ? competenciaLabel(l.entraEm) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
                      onClick={() => setLinhas(linhas.filter((_, k) => k !== i))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {linhas.length} {linhas.length === 1 ? 'linha' : 'linhas'} · {totalMensal} monitorias por mês
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={salvar}>Salvar plano</button>
          </div>
        </div>
      </div>
    </div>
  );
};
