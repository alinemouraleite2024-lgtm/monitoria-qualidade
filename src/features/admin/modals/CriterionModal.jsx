import { CRITERION_CATEGORIES, RESPONSE_TYPES, CHANNELS } from '../../../constants/criteria';
import { canalLabel } from '../../../constants/canais';

// Níveis da escala, por tipo de resposta. As chaves são as mesmas com que a resposta é gravada
// em MonitoringScore.score — é isso que permite ao instructionBuilder (3A.1) ler a âncora certa
// a partir do valor, sem interpretar texto.
const NIVEIS_POR_TIPO = {
  ESCALA_4: [
    { valor: '2', rotulo: 'Excelente' },
    { valor: '1', rotulo: 'Parcial' },
    { valor: '0', rotulo: 'Não realizou' },
  ],
  FAIXA_TEMPO: [
    { valor: '2', rotulo: 'Excelente — menos de 5 min' },
    { valor: '1.33', rotulo: 'Bom — 5 a 15 min' },
    { valor: '0.67', rotulo: 'Regular — acima de 15 min' },
    { valor: '0', rotulo: 'Ruim — pediu um momento no início' },
  ],
  SIM_NAO: [
    { valor: '0', rotulo: 'Sim, ocorreu — aciona o eliminatório' },
    { valor: '2', rotulo: 'Não ocorreu' },
  ],
};

const rotuloAncora = (tipo) => (tipo === 'SIM_NAO' ? 'Quando acionar' : 'Âncoras da escala');

export const CriterionModal = ({
  newCriterion,
  setNewCriterion,
  setShowCriterionModal,
  onSave
}) => {
  const tipo = newCriterion.tipoResposta;
  const niveis = NIVEIS_POR_TIPO[tipo] || [];
  const opcoes = newCriterion.opcoes || [];
  const subPerguntas = newCriterion.subPerguntas || [];
  const ancoras = newCriterion.ancoras || {};

  const setAncora = (chave, texto) =>
    setNewCriterion({ ...newCriterion, ancoras: { ...ancoras, [chave]: texto } });

  const setOpcao = (i, texto) => {
    const proximas = [...opcoes];
    proximas[i] = texto;
    setNewCriterion({ ...newCriterion, opcoes: proximas });
  };

  // Remover a opção leva junto a régua dela: a âncora de classificação é indexada pelo texto
  // da opção, e deixá-la para trás criaria uma entrada órfã que ninguém mais consegue editar.
  const removerOpcao = (i) => {
    const alvo = opcoes[i];
    const resto = Object.fromEntries(Object.entries(ancoras).filter(([chave]) => chave !== alvo));
    setNewCriterion({ ...newCriterion, opcoes: opcoes.filter((_, j) => j !== i), ancoras: resto });
  };

  const setSub = (i, campo, texto) => {
    const proximas = subPerguntas.map((sp, j) => (j === i ? { ...sp, [campo]: texto } : sp));
    setNewCriterion({ ...newCriterion, subPerguntas: proximas });
  };

  return (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          {newCriterion.id ? 'Editar Critério' : 'Cadastrar Novo Critério'}
        </h3>
        <button className="modal-close" onClick={() => setShowCriterionModal(false)}>&times;</button>
      </div>

      <form onSubmit={onSave}>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: '120px' }}>
            <label className="form-label">Nº</label>
            <input
              type="number"
              min="1"
              max="28"
              className="form-control"
              placeholder="1-28"
              value={newCriterion.numero || ''}
              onChange={(e) => setNewCriterion({ ...newCriterion, numero: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria*</label>
            <select
              className="form-control"
              value={newCriterion.category || ''}
              onChange={(e) => setNewCriterion({ ...newCriterion, category: e.target.value })}
              required
            >
              <option value="" disabled>Selecione...</option>
              {CRITERION_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nome do Critério*</label>
          <input
            type="text"
            className="form-control"
            placeholder="Ex: Comunicação"
            value={newCriterion.name}
            onChange={(e) => setNewCriterion({ ...newCriterion, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea
            rows="3"
            className="form-control"
            placeholder="Descreva o escopo do critério..."
            value={newCriterion.description}
            onChange={(e) => setNewCriterion({ ...newCriterion, description: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Orientação (rubrica oficial para o monitor)</label>
          <textarea
            rows="4"
            className="form-control"
            placeholder="Texto de orientação exibido ao monitor durante a avaliação..."
            value={newCriterion.orientacao || ''}
            onChange={(e) => setNewCriterion({ ...newCriterion, orientacao: e.target.value })}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tipo de Resposta*</label>
            <select
              className="form-control"
              value={newCriterion.tipoResposta || 'ESCALA_4'}
              onChange={(e) => setNewCriterion({ ...newCriterion, tipoResposta: e.target.value })}
              required
            >
              {RESPONSE_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <div className="switch-group" style={{ alignSelf: 'flex-end' }}>
            <label className="form-label" style={{ margin: 0 }}>Critério Eliminatório</label>
            <input
              type="checkbox"
              style={{ height: '18px', width: '18px', cursor: 'pointer' }}
              checked={!!newCriterion.eliminatorio}
              onChange={(e) => setNewCriterion({ ...newCriterion, eliminatorio: e.target.checked })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Nota Mínima Esperada</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              className="form-control"
              value={newCriterion.minExpectedScore}
              onChange={(e) => setNewCriterion({ ...newCriterion, minExpectedScore: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Peso do Critério</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="form-control"
              value={newCriterion.weight}
              onChange={(e) => setNewCriterion({ ...newCriterion, weight: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Canais Aplicáveis</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
            {CHANNELS.map(chan => {
              const isChecked = newCriterion.channels.includes(chan);
              return (
                <label key={chan} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const updatedChans = isChecked 
                        ? newCriterion.channels.filter(c => c !== chan) 
                        : [...newCriterion.channels, chan];
                      setNewCriterion({ ...newCriterion, channels: updatedChans });
                    }}
                  />
                  {canalLabel(chan)}
                </label>
              );
            })}
          </div>
        </div>

        {/* A régua de decisão — o que separa "orientação" (prosa para quem lê) de "âncora"
            (o que cada valor significa). É daqui que o instructionBuilder monta a instrução,
            então o formato acompanha o tipo de resposta e não é texto livre. */}
        {niveis.length > 0 && (
          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <label className="form-label">{rotuloAncora(tipo)}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {niveis.map((n) => (
                <div key={n.valor} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '0.6rem', alignItems: 'start' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                    <b style={{ color: 'var(--text-main)' }}>{n.valor}</b> · {n.rotulo}
                  </div>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="O que caracteriza este valor"
                    value={ancoras[n.valor] || ''}
                    onChange={(e) => setAncora(n.valor, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Classificação: as opções e, para cada uma, quando usá-la. */}
        {tipo === 'MULTIPLA_ESCOLHA' && (
          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <label className="form-label">Opções e régua de classificação</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {opcoes.map((op, i) => (
                <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <input
                      className="form-control"
                      value={op}
                      placeholder="Texto da opção"
                      onChange={(e) => setOpcao(i, e.target.value)}
                    />
                    <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removerOpcao(i)}>
                      Remover
                    </button>
                  </div>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Quando usar esta opção"
                    value={ancoras[op] || ''}
                    onChange={(e) => setAncora(op, e.target.value)}
                  />
                </div>
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setNewCriterion({ ...newCriterion, opcoes: [...opcoes, ''] })}>
                + Adicionar opção
              </button>
              {opcoes.length === 0 && (
                <span style={{ fontSize: '0.8rem', color: '#b45309', fontStyle: 'italic' }}>
                  Critério de classificação sem opções não pode ser respondido no formulário.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Checklist: a régua é por sub-pergunta, não por nível — o valor agregado é
            (SIM ÷ total) × 2 e não tem significado próprio. */}
        {tipo === 'CHECKLIST_SIM_NAO' && (
          <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <label className="form-label">Sub-perguntas e critérios de decisão</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {subPerguntas.map((sp, i) => (
                <div key={sp.id || i} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <input
                      className="form-control"
                      value={sp.texto || ''}
                      placeholder="Texto da sub-pergunta"
                      onChange={(e) => setSub(i, 'texto', e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setNewCriterion({ ...newCriterion, subPerguntas: subPerguntas.filter((_, j) => j !== i) })}
                    >
                      Remover
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <textarea className="form-control" rows={2} placeholder="SIM quando…" value={sp.criterioSim || ''} onChange={(e) => setSub(i, 'criterioSim', e.target.value)} />
                    <textarea className="form-control" rows={2} placeholder="NÃO quando…" value={sp.criterioNao || ''} onChange={(e) => setSub(i, 'criterioNao', e.target.value)} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setNewCriterion({
                  ...newCriterion,
                  subPerguntas: [...subPerguntas, { id: `sub-${Date.now()}`, texto: '', criterioSim: '', criterioNao: '' }],
                })}
              >
                + Adicionar sub-pergunta
              </button>
            </div>
          </div>
        )}

        {/* N/A é decisão, não observação: o assistente da 3A.2 precisa saber quando marcar.
            Classificação não tem N/A — a resposta é sempre uma das opções. */}
        {tipo !== 'MULTIPLA_ESCOLHA' && (
          <div className="form-group">
            <label className="form-label">Quando marcar N/A</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Em que situação este critério não se aplica"
              value={newCriterion.quandoNA || ''}
              onChange={(e) => setNewCriterion({ ...newCriterion, quandoNA: e.target.value })}
            />
          </div>
        )}

        <div className="switch-group">
          <label className="form-label" style={{ margin: 0 }}>Critério Ativo</label>
          <input
            type="checkbox"
            style={{ height: '18px', width: '18px', cursor: 'pointer' }}
            checked={newCriterion.active}
            onChange={(e) => setNewCriterion({ ...newCriterion, active: e.target.checked })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowCriterionModal(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar Critério
          </button>
        </div>
      </form>
    </div>
  </div>
  );
};
