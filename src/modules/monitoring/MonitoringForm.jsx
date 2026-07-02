import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ChevronRight, ChevronLeft, UploadCloud, File, Image, FileText, Video, Link as LinkIcon, Trash2, HelpCircle } from 'lucide-react';

export const MonitoringForm = ({
  initialData = null,
  users = [],
  collaborators = [],
  criteria = [],
  currentUser = null,
  onClose,
  onSave
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Form States
  const [formData, setFormData] = useState({
    id: '',
    colaboradorId: '',
    monitorId: currentUser?.id || '',
    gestorId: '', // To be filled dynamically based on colab or area
    date: new Date().toISOString().split('T')[0],
    canal: 'WhatsApp',
    produto: 'Geral',
    categoria: 'Atendimento',
    tempo: '00:05',
    tipo: 'Regular',
    
    // Evidencias (Mock)
    evidencias: [],
    
    // Feedback
    strengths: '',
    opportunities: '',
    actionPlan: '',
    comments: '',
    
    // Status
    status: 'Concluída' // Ou 'Rascunho', 'Pendente', etc
  });

  // Scores State: { critId: { score: number, lowScoreReason: string } }
  const [scores, setScores] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        date: initialData.date.split('T')[0],
        evidencias: initialData.evidencias || [],
        strengths: initialData.strengths || '',
        opportunities: initialData.opportunities || '',
        actionPlan: initialData.actionPlan || '',
        comments: initialData.comments || ''
      });
      
      const initialScores = {};
      if (initialData.scores) {
        initialData.scores.forEach(s => {
          initialScores[s.criterionId] = { score: s.score, lowScoreReason: s.lowScoreReason || '' };
        });
      }
      setScores(initialScores);
    }
  }, [initialData]);

  // Derived
  const getCriteriaForChannel = (channel) => {
    return criteria.filter(c => c.active && c.channels.includes(channel));
  };

  const applicableCriteria = getCriteriaForChannel(formData.canal);

  // Initialize scores when canal changes and not editing existing
  useEffect(() => {
    if (!initialData) {
      const initialScores = {};
      applicableCriteria.forEach(c => {
        initialScores[c.id] = { score: 10, lowScoreReason: '' };
      });
      setScores(initialScores);
    }
  }, [formData.canal, initialData, criteria]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculateFinalScore = () => {
    if (applicableCriteria.length === 0) return 0;
    let weightedSum = 0;
    let weightTotal = 0;
    
    applicableCriteria.forEach(c => {
      const item = scores[c.id];
      const val = item && item.score !== undefined ? parseFloat(item.score) : 10;
      weightedSum += val * c.weight;
      weightTotal += c.weight;
    });

    return weightTotal > 0 ? parseFloat((weightedSum / weightTotal).toFixed(2)) : 0;
  };

  const finalScore = calculateFinalScore();
  const percentual = finalScore * 10;
  
  const getScoreConcept = (score) => {
    if (score >= 9) return 'Excelente';
    if (score >= 7.5) return 'Bom';
    if (score >= 5) return 'Regular';
    return 'Necessita melhoria';
  };
  const conceito = getScoreConcept(finalScore);

  const handleNext = () => {
    if (step === 1 && !formData.colaboradorId) {
      alert('Por favor, selecione um Colaborador.');
      return;
    }
    if (step === 3) {
      // Validate scores
      let isValid = true;
      applicableCriteria.forEach(c => {
        const item = scores[c.id];
        if (!item || item.score === undefined || item.score === '') {
          isValid = false;
        } else if (item.score < c.minExpectedScore && !item.lowScoreReason.trim()) {
          isValid = false;
        }
      });
      if (!isValid) {
        alert('Por favor, preencha todas as notas e insira a justificativa para notas abaixo da esperada.');
        return;
      }
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const handlePrev = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSave = (e) => {
    e.preventDefault();
    
    // Auto-generate ID if new
    const id = formData.id || `mon-${Math.floor(Math.random() * 10000)}`;
    
    const formattedScores = applicableCriteria.map(c => ({
      criterionId: c.id,
      score: scores[c.id]?.score || 0,
      lowScoreReason: scores[c.id]?.lowScoreReason || ''
    }));

    const finalData = {
      ...formData,
      id,
      date: formData.date + 'T12:00:00Z', // mockup time
      finalScore,
      scores: formattedScores,
      // Se for monitor e não for rascunho, envia para pendente. 
      // Se for gestor/admin, envia para validada/concluída direto.
      status: formData.status === 'Rascunho' ? 'Rascunho' 
            : (currentUser?.role === 'MONITOR' ? 'Pendente' : formData.status)
    };

    onSave(finalData);
  };

  // Evidencias Mock Upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const newEvidencia = {
        id: `evd-${Math.floor(Math.random() * 1000)}`,
        name: file.name,
        type: file.type,
        size: file.size
      };
      setFormData(prev => ({ ...prev, evidencias: [...prev.evidencias, newEvidencia] }));
    }
  };

  const removeEvidencia = (id) => {
    setFormData(prev => ({
      ...prev,
      evidencias: prev.evidencias.filter(e => e.id !== id)
    }));
  };

  const getFileIcon = (type) => {
    if (type.includes('image')) return <Image size={18} />;
    if (type.includes('pdf')) return <FileText size={18} />;
    if (type.includes('video')) return <Video size={18} />;
    if (type.includes('audio')) return <File size={18} />;
    return <File size={18} />;
  };

  return (
    <div className="slide-over-overlay">
      <div className="slide-over-panel" style={{ width: '700px' }}>
        <div className="slide-over-header">
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>
            {initialData ? 'Editar Monitoria' : 'Nova Monitoria'}
          </h2>
          <button className="btn-sidebar-logout" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="slide-over-body">
          {/* Stepper */}
          <div className="stepper-container">
            <div className={`step-item ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 1 ? <CheckCircle2 size={16} /> : 1}</div>
              <div className="step-label">Infos Gerais</div>
            </div>
            <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 2 ? <CheckCircle2 size={16} /> : 2}</div>
              <div className="step-label">Evidências</div>
            </div>
            <div className={`step-item ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 3 ? <CheckCircle2 size={16} /> : 3}</div>
              <div className="step-label">Avaliação</div>
            </div>
            <div className={`step-item ${step >= 4 ? 'active' : ''}`}>
              <div className="step-badge">4</div>
              <div className="step-label">Feedback</div>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            
            {/* ETAPA 1: Informações Gerais */}
            {step === 1 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Colaborador Avaliado *</label>
                    <select 
                      className="form-control"
                      value={formData.colaboradorId}
                      onChange={(e) => setFormData({...formData, colaboradorId: e.target.value})}
                      required
                    >
                      <option value="">Selecione...</option>
                      {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Monitor Responsável</label>
                    <select 
                      className="form-control"
                      value={formData.monitorId}
                      onChange={(e) => setFormData({...formData, monitorId: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {users.filter(u => u.role === 'MONITOR' || u.role === 'GESTOR').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Data do Atendimento *</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Canal de Atendimento *</label>
                    <select 
                      className="form-control"
                      value={formData.canal}
                      onChange={(e) => setFormData({...formData, canal: e.target.value})}
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Telefone">Telefone</option>
                      <option value="Teams">Teams</option>
                      <option value="Presencial">Presencial</option>
                      <option value="E-mail">E-mail</option>
                      <option value="Chat">Chat</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Monitoria</label>
                    <select 
                      className="form-control"
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    >
                      <option value="Regular">Regular (Aleatória)</option>
                      <option value="Direcionada">Direcionada (Reclamação/Foco)</option>
                      <option value="Fluxo">Avaliação de Fluxo/Processo</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tempo do Atendimento</label>
                    <input 
                      type="time" 
                      className="form-control"
                      value={formData.tempo}
                      onChange={(e) => setFormData({...formData, tempo: e.target.value})}
                      step="1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 2: Evidências */}
            {step === 2 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '2rem', textAlign: 'center', backgroundColor: '#fafbfc' }}>
                  <UploadCloud size={48} style={{ color: 'var(--primary)', opacity: 0.8, margin: '0 auto 1rem auto' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>Arraste arquivos ou clique para fazer upload</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Suporta Áudio, PDF, Imagens e Vídeos (Máx 50MB)</p>
                  
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button type="button" className="btn btn-primary">
                      Selecionar Arquivos
                    </button>
                    <input 
                      type="file" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label className="form-label">Links (Teams, WhatsApp, etc)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="url" className="form-control" placeholder="https://..." />
                    <button type="button" className="btn btn-secondary"><Plus size={16} /> Adicionar</button>
                  </div>
                </div>

                {formData.evidencias.length > 0 && (
                  <div>
                    <label className="form-label">Arquivos Anexados</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {formData.evidencias.map(evd => (
                        <div key={evd.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {getFileIcon(evd.type)}
                            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{evd.name}</span>
                          </div>
                          <button type="button" className="btn-sidebar-logout" onClick={() => removeEvidencia(evd.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ETAPA 3: Avaliação */}
            {step === 3 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>Nota Parcial</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1 }}>{finalScore.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Conceito</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>{conceito}</div>
                  </div>
                </div>

                {applicableCriteria.map(c => (
                  <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h4 style={{ fontWeight: '600', fontSize: '0.95rem' }}>{c.name}</h4>
                      <span className="badge-pill badge-info">Peso: {c.weight}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{c.description}</p>
                    
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{ width: '120px' }}>
                        <label className="form-label">Nota</label>
                        <select 
                          className="form-control"
                          style={{ fontSize: '1.1rem', fontWeight: '700' }}
                          value={scores[c.id]?.score ?? 10}
                          onChange={(e) => setScores({...scores, [c.id]: { ...scores[c.id], score: parseFloat(e.target.value) }})}
                        >
                          <option value="10">10</option>
                          <option value="9">9.0</option>
                          <option value="8">8.0</option>
                          <option value="7">7.0</option>
                          <option value="6">6.0</option>
                          <option value="5">5.0</option>
                          <option value="0">0.0</option>
                        </select>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          Justificativa / Comentário
                          {scores[c.id]?.score < c.minExpectedScore && <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>(Obrigatório pois nota &lt; {c.minExpectedScore})</span>}
                        </label>
                        <textarea 
                          className="form-control"
                          rows="2"
                          placeholder="Adicione observações sobre a avaliação deste critério..."
                          value={scores[c.id]?.lowScoreReason || ''}
                          onChange={(e) => setScores({...scores, [c.id]: { ...scores[c.id], lowScoreReason: e.target.value }})}
                          style={{ 
                            borderColor: scores[c.id]?.score < c.minExpectedScore && !scores[c.id]?.lowScoreReason.trim() ? 'var(--danger)' : 'var(--border-color)'
                          }}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                ))}
                
                {applicableCriteria.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum critério ativo para o canal {formData.canal}.
                  </div>
                )}
              </div>
            )}

            {/* ETAPA 4: Feedback e Conclusão */}
            {step === 4 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
                
                <div className="form-group">
                  <label className="form-label">Pontos Fortes</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Descreva o que o colaborador fez de melhor..."
                    value={formData.strengths}
                    onChange={(e) => setFormData({...formData, strengths: e.target.value})}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Oportunidades de Melhoria</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Pontos onde o colaborador pode evoluir..."
                    value={formData.opportunities}
                    onChange={(e) => setFormData({...formData, opportunities: e.target.value})}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Plano de Ação</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Ex: Refazer treinamento de objeções até 10/07."
                    value={formData.actionPlan}
                    onChange={(e) => setFormData({...formData, actionPlan: e.target.value})}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Comentários Gerais do Monitor</label>
                  <textarea 
                    className="form-control"
                    rows="2"
                    value={formData.comments}
                    onChange={(e) => setFormData({...formData, comments: e.target.value})}
                  ></textarea>
                </div>

                <div className="form-group" style={{ marginTop: 'auto' }}>
                  <label className="form-label">Ação de Conclusão</label>
                  <select 
                    className="form-control"
                    style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)', fontWeight: '600' }}
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Concluída">Finalizar e Submeter (Pendente Aprovação)</option>
                    <option value="Rascunho">Salvar como Rascunho (Continuar depois)</option>
                    {currentUser?.role !== 'MONITOR' && <option value="Validada">Aprovar Diretamente (Gestor/Admin)</option>}
                  </select>
                </div>
              </div>
            )}

            {/* Footer Navigation */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              {step > 1 ? (
                <button type="button" className="btn btn-secondary" onClick={handlePrev}>
                  <ChevronLeft size={16} /> Anterior
                </button>
              ) : <div></div>}
              
              {step < totalSteps ? (
                <button type="button" className="btn btn-primary" onClick={handleNext}>
                  Próximo <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} /> Salvar Monitoria
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
