import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, ChevronRight, ChevronLeft, UploadCloud, File, Image, FileText, Video, Link as LinkIcon, Trash2, AlertTriangle, Save, Download } from 'lucide-react';

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
  const totalSteps = 5;

  // Form States
  const [formData, setFormData] = useState({
    id: '',
    colaboradorId: '',
    monitorId: currentUser?.id || '',
    gestorId: '',
    date: new Date().toISOString().split('T')[0],
    canal: 'WhatsApp',
    empreendimento: '',
    categoriaAtendimento: '',
    protocolo: '',
    tempo: '00:05',
    tipo: 'Regular',
    
    // Evidencias (Mock)
    evidencias: [],
    links: [],
    evidenciaObservacoes: '',
    
    // Feedback
    strengths: '',
    opportunities: '',
    comments: '',
    
    // Status
    status: 'Rascunho'
  });

  // Scores State: { critId: { score: 0|1|2|'N/A', lowScoreReason: string } }
  const [scores, setScores] = useState({});

  // Auto-save control
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        date: initialData.date.split('T')[0],
        evidencias: initialData.evidencias || [],
        links: initialData.links || [],
        evidenciaObservacoes: initialData.evidenciaObservacoes || '',
        strengths: initialData.strengths || '',
        opportunities: initialData.opportunities || '',
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
  const applicableCriteria = useMemo(() => {
    return criteria.filter(c => c.active && c.channels.includes(formData.canal));
  }, [criteria, formData.canal]);

  // Group criteria by category
  const groupedCriteria = useMemo(() => {
    return applicableCriteria.reduce((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {});
  }, [applicableCriteria]);

  // Initialize scores when canal changes and not editing existing
  useEffect(() => {
    if (!initialData) {
      const initialScores = {};
      applicableCriteria.forEach(c => {
        // Initialize as empty or N/A? Let's leave empty so user has to fill
        initialScores[c.id] = { score: '', lowScoreReason: '' };
      });
      setScores(initialScores);
    }
  }, [formData.canal, initialData, applicableCriteria]);

  const { finalScore, totalObtained, totalPossible, qtdAvaliados, qtdNA } = useMemo(() => {
    let obtained = 0;
    let possible = 0;
    let avaliados = 0;
    let naCount = 0;

    applicableCriteria.forEach(c => {
      const item = scores[c.id];
      if (item && item.score !== '' && item.score !== 'N/A') {
        const val = parseInt(item.score, 10);
        obtained += val;
        possible += 2; // Maximum score per item is 2
        avaliados++;
      } else if (item && item.score === 'N/A') {
        naCount++;
      }
    });

    const percent = possible > 0 ? (obtained / possible) * 100 : 0;
    
    return {
      finalScore: parseFloat(percent.toFixed(2)),
      totalObtained: obtained,
      totalPossible: possible,
      qtdAvaliados: avaliados,
      qtdNA: naCount
    };
  }, [scores, applicableCriteria]);

  const getScoreConcept = (score) => {
    if (score >= 95) return { label: 'Excelente', color: 'var(--success)' };
    if (score >= 85) return { label: 'Muito Bom', color: '#10b981' };
    if (score >= 75) return { label: 'Bom', color: '#3b82f6' };
    if (score >= 50) return { label: 'Atenção', color: 'var(--warning)' };
    return { label: 'Crítico', color: 'var(--danger)' };
  };
  
  const conceito = getScoreConcept(finalScore);

  const validateStep1 = () => {
    if (!formData.colaboradorId) return 'Por favor, selecione o Colaborador Avaliado.';
    if (!formData.date) return 'A Data do Atendimento é obrigatória.';
    if (!formData.empreendimento) return 'O Empreendimento é obrigatório.';
    if (!formData.categoriaAtendimento) return 'A Categoria do Atendimento é obrigatória.';
    return null;
  };

  const validateStep3 = () => {
    let error = null;
    applicableCriteria.forEach(c => {
      const item = scores[c.id];
      if (!item || item.score === '') {
        error = 'Por favor, avalie todos os critérios antes de avançar.';
      } else if (item.score !== 'N/A' && item.score < 2 && !item.lowScoreReason.trim()) {
        error = 'Justificativa obrigatória para notas menores que 2.';
      }
    });
    return error;
  };

  const handleNext = () => {
    if (step === 1) {
      const error = validateStep1();
      if (error) return alert(error);
    }
    if (step === 3) {
      const error = validateStep3();
      if (error) return alert(error);
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const handlePrev = () => {
    setStep(s => Math.max(s - 1, 1));
  };

  const buildFinalData = (isDraft) => {
    const id = formData.id || `mon-${Math.floor(Math.random() * 10000)}`;
    const formattedScores = applicableCriteria.map(c => ({
      criterionId: c.id,
      score: scores[c.id]?.score || 0,
      lowScoreReason: scores[c.id]?.lowScoreReason || ''
    }));

    return {
      ...formData,
      id,
      date: formData.date + 'T12:00:00Z',
      finalScore,
      scores: formattedScores,
      status: isDraft ? 'Rascunho' 
            : (currentUser?.role === 'MONITOR' ? 'Pendente' : 'Validada')
    };
  };

  const handleSaveDraft = () => {
    const data = buildFinalData(true);
    onSave(data);
    setLastSaved(new Date().toLocaleTimeString());
    // Auto-save is stealthy, so we don't alert. But if clicked manually:
    alert('Rascunho salvo com sucesso!');
  };

  const handleSaveFinal = (e) => {
    e.preventDefault();
    const data = buildFinalData(false);
    onSave(data);
  };

  // Auto-save logic
  useEffect(() => {
    if (formData.colaboradorId && formData.empreendimento) {
      const timer = setTimeout(() => {
        const data = buildFinalData(true);
        onSave(data);
        setLastSaved(new Date().toLocaleTimeString());
      }, 30000); // Auto-save every 30s if valid data exists
      return () => clearTimeout(timer);
    }
  }, [formData, scores]); // eslint-disable-line react-hooks/exhaustive-deps

  // Evidencias Upload
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

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="slide-over-overlay" style={{ zIndex: 1050 }}>
      <div className="slide-over-panel" style={{ width: '800px' }}>
        <div className="slide-over-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', margin: 0 }}>
              {initialData ? 'Editar Monitoria' : 'Nova Monitoria'}
            </h2>
            {lastSaved && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salvo automaticamente às {lastSaved}</span>}
          </div>
          <button type="button" className="btn-sidebar-logout" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Progress Bar Header */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-color)' }}>
          <div className="stepper-container" style={{ margin: 0, padding: 0 }}>
            <div className={`step-item ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 1 ? <CheckCircle2 size={16} /> : 1}</div>
              <div className="step-label">Info Gerais</div>
            </div>
            <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 2 ? <CheckCircle2 size={16} /> : 2}</div>
              <div className="step-label">Evidências</div>
            </div>
            <div className={`step-item ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 3 ? <CheckCircle2 size={16} /> : 3}</div>
              <div className="step-label">Avaliação</div>
            </div>
            <div className={`step-item ${step >= 4 ? 'active' : ''} ${step > 4 ? 'completed' : ''}`}>
              <div className="step-badge">{step > 4 ? <CheckCircle2 size={16} /> : 4}</div>
              <div className="step-label">Observações</div>
            </div>
            <div className={`step-item ${step >= 5 ? 'active' : ''}`}>
              <div className="step-badge">5</div>
              <div className="step-label">Conclusão</div>
            </div>
          </div>
          {/* Visual Progress Line */}
          <div style={{ height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', backgroundColor: 'var(--primary)', width: `${((step - 1) / (totalSteps - 1)) * 100}%`, transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        <div className="slide-over-body" style={{ padding: '1.5rem', overflowY: 'auto', backgroundColor: '#fff' }}>
          <form id="monitoring-form" onSubmit={handleSaveFinal} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* ETAPA 1: Informações Gerais */}
            {step === 1 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Colaborador Avaliado *</label>
                    <select 
                      className="form-control"
                      value={formData.colaboradorId}
                      onChange={(e) => setFormData({...formData, colaboradorId: e.target.value})}
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
                      disabled
                    >
                      <option value="">Selecione...</option>
                      {users.filter(u => u.role === 'MONITOR' || u.role === 'GESTOR').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Empreendimento *</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: Reserva Moura Leite"
                      value={formData.empreendimento}
                      onChange={(e) => setFormData({...formData, empreendimento: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria do Atendimento *</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: 2ª Via de Boleto"
                      value={formData.categoriaAtendimento}
                      onChange={(e) => setFormData({...formData, categoriaAtendimento: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nº Protocolo (Opcional)</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="Ex: 20261234"
                      value={formData.protocolo}
                      onChange={(e) => setFormData({...formData, protocolo: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Canal *</label>
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
                  <div className="form-group">
                    <label className="form-label">Data *</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tempo</label>
                    <input 
                      type="time" 
                      className="form-control"
                      value={formData.tempo}
                      onChange={(e) => setFormData({...formData, tempo: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo</label>
                    <select 
                      className="form-control"
                      value={formData.tipo}
                      onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                    >
                      <option value="Regular">Regular</option>
                      <option value="Direcionada">Direcionada</option>
                      <option value="Fluxo">Fluxo/Processo</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 2: Evidências */}
            {step === 2 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label className="form-label">Link do Atendimento</label>
                  <input 
                    type="url" 
                    className="form-control" 
                    placeholder="URL para o áudio, ticket ou conversa..." 
                    value={formData.links[0] || ''}
                    onChange={(e) => setFormData({...formData, links: [e.target.value]})}
                  />
                </div>

                <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', backgroundColor: '#fafbfc' }}>
                  <UploadCloud size={32} style={{ color: 'var(--primary)', opacity: 0.8, margin: '0 auto 0.5rem auto' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>Upload de Evidências</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Suporta Áudio, PDF, e Imagens (Máx 50MB)</p>
                  
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button type="button" className="btn btn-secondary btn-sm">Selecionar Arquivo</button>
                    <input 
                      type="file" 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      onChange={handleFileUpload}
                    />
                  </div>
                </div>

                {formData.evidencias.length > 0 && (
                  <div>
                    <label className="form-label">Arquivos Anexados</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {formData.evidencias.map(evd => (
                        <div key={evd.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {getFileIcon(evd.type)}
                            <span style={{ fontSize: '0.85rem' }}>{evd.name}</span>
                          </div>
                          <button type="button" className="btn-sidebar-logout" onClick={() => removeEvidencia(evd.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Observações sobre a Evidência</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Descreva algum contexto sobre os arquivos ou links enviados..."
                    value={formData.evidenciaObservacoes}
                    onChange={(e) => setFormData({...formData, evidenciaObservacoes: e.target.value})}
                  ></textarea>
                </div>
              </div>
            )}

            {/* ETAPA 3: Avaliação */}
            {step === 3 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '1rem 1.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: '-1.5rem', zIndex: 10, border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>Desempenho Atual</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1 }}>{finalScore}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Classificação Parcial</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: conceito.color }}>{conceito.label}</div>
                  </div>
                </div>

                {Object.keys(groupedCriteria).map(category => (
                  <div key={category} style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                      {category}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {groupedCriteria[category].map(c => (
                        <div key={c.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', backgroundColor: '#fff', transition: 'border-color 0.2s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h4 style={{ fontWeight: '600', fontSize: '0.95rem' }}>{c.name}</h4>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{c.description}</p>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', alignItems: 'start' }}>
                            <div>
                              <label className="form-label">Avaliação</label>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[2, 1, 0, 'N/A'].map(val => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setScores({...scores, [c.id]: { ...scores[c.id], score: val }})}
                                    style={{
                                      flex: 1, padding: '0.5rem', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer',
                                      border: `1px solid ${scores[c.id]?.score === val ? 'var(--primary)' : 'var(--border-color)'}`,
                                      backgroundColor: scores[c.id]?.score === val ? 'var(--primary)' : '#fff',
                                      color: scores[c.id]?.score === val ? '#fff' : 'var(--text-main)',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {val}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                Justificativa
                                {scores[c.id]?.score !== 'N/A' && scores[c.id]?.score < 2 && scores[c.id]?.score !== '' && (
                                  <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>*Obrigatória</span>
                                )}
                              </label>
                              <textarea 
                                className="form-control"
                                rows="2"
                                placeholder="Comente sobre o desempenho..."
                                value={scores[c.id]?.lowScoreReason || ''}
                                onChange={(e) => setScores({...scores, [c.id]: { ...scores[c.id], lowScoreReason: e.target.value }})}
                                style={{ 
                                  borderColor: scores[c.id]?.score !== 'N/A' && scores[c.id]?.score < 2 && scores[c.id]?.score !== '' && !scores[c.id]?.lowScoreReason.trim() ? 'var(--danger)' : 'var(--border-color)'
                                }}
                              ></textarea>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ETAPA 4: Feedback */}
            {step === 4 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Pontos Fortes</label>
                  <textarea 
                    className="form-control"
                    rows="4"
                    placeholder="Descreva o que o colaborador fez de melhor..."
                    value={formData.strengths}
                    onChange={(e) => setFormData({...formData, strengths: e.target.value})}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Oportunidades de Melhoria</label>
                  <textarea 
                    className="form-control"
                    rows="4"
                    placeholder="Pontos onde o colaborador pode evoluir..."
                    value={formData.opportunities}
                    onChange={(e) => setFormData({...formData, opportunities: e.target.value})}
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Observações Gerais</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="Comentários adicionais sobre a monitoria..."
                    value={formData.comments}
                    onChange={(e) => setFormData({...formData, comments: e.target.value})}
                  ></textarea>
                </div>
              </div>
            )}

            {/* ETAPA 5: Conclusão */}
            {step === 5 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Resumo da Monitoria</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Revise os dados antes de finalizar o processo.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  
                  {/* Bloco 1: Infos */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', backgroundColor: '#fafbfc' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Dados do Atendimento</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Colaborador:</span> <span style={{ fontWeight: '600' }}>{collaborators.find(c => c.id === formData.colaboradorId)?.name || '-'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Monitor:</span> <span style={{ fontWeight: '600' }}>{users.find(u => u.id === formData.monitorId)?.name || '-'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Canal:</span> <span style={{ fontWeight: '600' }}>{formData.canal}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Data:</span> <span style={{ fontWeight: '600' }}>{new Date(formData.date).toLocaleDateString('pt-BR')}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Empreendimento:</span> <span style={{ fontWeight: '600' }}>{formData.empreendimento || '-'}</span></div>
                    </div>
                  </div>

                  {/* Bloco 2: Resultado */}
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', backgroundColor: '#fafbfc', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Resultado Final</div>
                    <div style={{ fontSize: '3rem', fontWeight: '800', color: conceito.color, lineHeight: 1 }}>{finalScore}%</div>
                    <div className="badge-pill" style={{ marginTop: '0.5rem', backgroundColor: conceito.color, color: '#fff', padding: '0.25rem 1rem', fontSize: '0.9rem' }}>{conceito.label}</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem', width: '100%' }}>
                      <div style={{ textAlign: 'center', backgroundColor: '#fff', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pontos Obtidos</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{totalObtained} / {totalPossible}</div>
                      </div>
                      <div style={{ textAlign: 'center', backgroundColor: '#fff', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Critérios Avaliados</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{qtdAvaliados} <span style={{fontSize: '0.75rem', fontWeight:'normal'}}>({qtdNA} N/A)</span></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </form>
        </div>

        {/* Footer Navigation */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', backgroundColor: '#fafbfc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={handlePrev}>
              <ChevronLeft size={16} /> Anterior
            </button>
          ) : <div></div>}
          
          {step < totalSteps ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handleSaveDraft}>
                <Save size={16} /> Salvar Rascunho
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Próximo <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={exportPDF}>
                <Download size={16} /> Exportar PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleSaveDraft}>
                <Save size={16} /> Rascunho
              </button>
              <button type="submit" form="monitoring-form" className="btn btn-primary" style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                <CheckCircle2 size={16} /> Salvar Monitoria
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
