import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { 
  X, CheckCircle2, ChevronRight, ChevronLeft, UploadCloud, File, Image, 
  FileText, Video, Link as LinkIcon, Trash2, AlertTriangle, Save, Download,
  Lightbulb, Target, BookOpen, ChevronDown, ChevronUp, HelpCircle 
} from 'lucide-react';
import { SearchableSelect } from '../../components/SearchableSelect';
import { CANAIS, canalLabel } from '../../constants/canais';
import { getScoreConcept } from '../../scoreUtils';
import type { Collaborator, Criterion, Monitoring, User } from '../../types/domain';

/**
 * Contrato do formulário de monitoria.
 *
 * onSave recebe UM objeto já completo. Declarar isso é precisamente o que teria impedido
 * BUG-02, em que o formulário chamava onSave(data) e o App.jsx esperava dois argumentos —
 * um TypeError que bloqueava 100% do salvamento e só apareceu em runtime.
 */
export interface MonitoringFormProps {
  initialData?: Monitoring | null;
  /**
   * Contexto vindo da fila operacional: abrir o formulário já sabendo quem monitorar e de que
   * canal. Só valem para monitoria nova — na edição, initialData manda.
   *
   * O canal importa duas vezes: além de poupar um passo, ele determina quais critérios se
   * aplicam (applicableCriteria filtra por canal), então abrir com o canal certo já traz o
   * checklist certo.
   */
  colaboradorIdInicial?: string;
  canalInicial?: string;
  users?: User[];
  collaborators?: Collaborator[];
  criteria?: Criterion[];
  currentUser?: User | null;
  catalogEmpreendimentos?: string[];
  catalogCategorias?: string[];
  onAddEmpreendimento?: (novo: string) => void;
  onAddCategoria?: (nova: string) => void;
  onClose: () => void;
  onSave: (monitoring: Monitoring) => void;
}

/** Estado do formulário. Espelha Monitoring, com os campos ainda soltos durante a edição. */
interface FormDataMonitoria {
  id: string;
  colaboradorId: string;
  monitorId: string;
  gestorId?: string;
  date: string;
  canal: string;
  empreendimento?: string;
  categoriaAtendimento?: string;
  protocolo?: string;
  tempo?: string;
  tipo: string;
  evidencias: Evidencia[];
  links: string[];
  evidenciaObservacoes: string;
  strengths: string;
  opportunities: string;
  comments: string;
  status: string;
}

/** Arquivo de evidência anexado ao atendimento. */
interface Evidencia {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
}

/** Agregado de nota por categoria, montado durante o cálculo da nota final. */
interface CategoriaAgregada {
  obtained: number;
  possible: number;
  totalCriteria: number;
  evaluated: number;
  percent?: number;
}

/** Resposta em edição, antes de virar MonitoringScore. */
interface ScoreEmEdicao {
  score: number | 'N/A' | '';
  lowScoreReason: string;
  subRespostas: Record<string, 'SIM' | 'NAO'>;
}

// Opções do widget de escolha única (score 0-2), por tipo de resposta.
// FAIXA_TEMPO usa rótulos e valores próprios; qualquer outro tipo (ESCALA_4 e o fallback
// atual para MULTIPLA_ESCOLHA/SIM_NAO, ainda não implementados) usa a escala padrão.
const getScaleOptions = (tipoResposta: string) => {
  if (tipoResposta === 'FAIXA_TEMPO') {
    return [
      { val: 2, display: '<5min', label: 'Excelente', color: '#10b981', bg: '#d1fae5' },
      { val: 1.33, display: '5-15min', label: 'Bom', color: '#3b82f6', bg: '#dbeafe' },
      { val: 0.67, display: '>15min', label: 'Regular', color: '#f59e0b', bg: '#fef3c7' },
      { val: 0, display: '—', label: 'Ruim', color: '#ef4444', bg: '#fee2e2' },
      { val: 'N/A', display: 'N/A', label: 'Não se aplica', color: '#6b7280', bg: '#f3f4f6' }
    ];
  }
  return [
    { val: 2, display: 2, label: 'Excelente', color: '#10b981', bg: '#d1fae5' },
    { val: 1, display: 1, label: 'Parcial', color: '#f59e0b', bg: '#fef3c7' },
    { val: 0, display: 0, label: 'Não realizou', color: '#ef4444', bg: '#fee2e2' },
    { val: 'N/A', display: 'N/A', label: 'Não se aplica', color: '#6b7280', bg: '#f3f4f6' }
  ];
};

export const MonitoringForm = ({
  initialData = null,
  users = [],
  collaborators = [],
  criteria = [],
  currentUser = null,
  catalogEmpreendimentos = [],
  catalogCategorias = [],
  onAddEmpreendimento = () => {},
  onAddCategoria = () => {},
  colaboradorIdInicial = '',
  canalInicial = '',
  onClose,
  onSave
}: MonitoringFormProps) => {
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Form States
  const [formData, setFormData] = useState<FormDataMonitoria>({
    id: '',
    colaboradorId: colaboradorIdInicial,
    monitorId: currentUser?.id || '',
    gestorId: '',
    date: new Date().toISOString().split('T')[0],
    canal: canalInicial,
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

  const [scores, setScores] = useState<Record<string, ScoreEmEdicao>>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [expandedOrientacao, setExpandedOrientacao] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    COMUNICAÇÃO: true,
    ATENDIMENTO: false,
    PROCESSO: false,
    ENCERRAMENTO: false
  });
  
  // Validation attempts
  const [hasAttemptedNext, setHasAttemptedNext] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        date: initialData.date.split('T')[0],
        evidencias: (initialData.evidencias || []) as Evidencia[],
        links: (initialData.links || []) as string[],
        evidenciaObservacoes: initialData.evidenciaObservacoes || '',
        // Sem este fallback, abrir uma monitoria gravada antes de o protocolo existir traz
        // `undefined` para dentro do estado e o campo deixa de ser controlado ("A component is
        // changing a controlled input to be uncontrolled"). Com a regra que passou a exigir o
        // protocolo também na edição, esse é justamente o caminho mais percorrido: toda
        // monitoria antiga aberta para ajuste passa por aqui.
        protocolo: initialData.protocolo || '',
        strengths: initialData.strengths || '',
        opportunities: initialData.opportunities || '',
        comments: initialData.comments || ''
      });
      
      const initialScores: Record<string, ScoreEmEdicao> = {};
      if (initialData.scores) {
        initialData.scores.forEach(s => {
          initialScores[s.criterionId] = { score: s.score, lowScoreReason: s.lowScoreReason || '', subRespostas: s.subRespostas || {} };
        });
      }
      setScores(initialScores);
    }
  }, [initialData]);

  // Derived
  const applicableCriteria = useMemo(() => {
    if (!formData.canal) return criteria.filter(c => c.active);
    return criteria.filter(c => c.active && (c.channels as string[]).includes(formData.canal));
  }, [criteria, formData.canal]);

  // Group criteria by category
  const groupedCriteria = useMemo(() => {
    return applicableCriteria.reduce<Record<string, Criterion[]>>((acc, c) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {});
  }, [applicableCriteria]);

  // Initialize scores when canal changes and not editing existing
  useEffect(() => {
    if (!initialData) {
      const initialScores: Record<string, ScoreEmEdicao> = {};
      applicableCriteria.forEach(c => {
        initialScores[c.id] = { score: '', lowScoreReason: '', subRespostas: {} };
      });
      setScores(initialScores);
    }
  }, [formData.canal, initialData, applicableCriteria]);

  const { finalScore, totalObtained, totalPossible, qtdAvaliados, qtdNA, categoryScores, hasEliminatoryTrigger, triggeredEliminatoryCriteria } = useMemo(() => {
    let obtained = 0;
    let possible = 0;
    let avaliados = 0;
    let naCount = 0;
    const catScores: Record<string, CategoriaAgregada> = {};

    Object.keys(groupedCriteria).forEach(cat => {
      catScores[cat] = { obtained: 0, possible: 0, totalCriteria: groupedCriteria[cat].length, evaluated: 0 };
    });

    applicableCriteria.forEach(c => {
      const item = scores[c.id];
      // Critérios de peso 0 (classificação e eliminatórios) não compõem a média ponderada —
      // ainda assim contam para o contador de "avaliados" e para o status do grupo,
      // senão a barra de progresso nunca chegaria a 100% quando eles fossem respondidos.
      const weight = c.weight || 0;
      if (item && item.score !== '' && item.score !== 'N/A') {
        const val = Number(item.score);
        if (weight > 0) {
          obtained += val * weight;
          possible += 2 * weight;
          if (catScores[c.category]) {
            catScores[c.category].obtained += val * weight;
            catScores[c.category].possible += 2 * weight;
          }
        }
        avaliados++;
        if (catScores[c.category]) {
          catScores[c.category].evaluated++;
        }
      } else if (item && item.score === 'N/A') {
        naCount++;
        if (catScores[c.category]) {
          catScores[c.category].evaluated++;
        }
      }
    });

    const percent = possible > 0 ? (obtained / possible) * 100 : 0;

    // Calc percentage per category
    Object.keys(catScores).forEach(cat => {
      catScores[cat].percent = catScores[cat].possible > 0 ? (catScores[cat].obtained / catScores[cat].possible) * 100 : 100;
    });

    // Critérios eliminatórios marcados como "Sim, ocorreu" (score 0) — não zeram a nota aqui;
    // apenas sinalizam a monitoria como pendente de confirmação por um Gestor/Admin (F0-08).
    const triggered = applicableCriteria.filter(c => c.eliminatorio && scores[c.id]?.score === 0);

    return {
      finalScore: parseFloat(percent.toFixed(2)),
      totalObtained: obtained,
      totalPossible: possible,
      qtdAvaliados: avaliados,
      qtdNA: naCount,
      categoryScores: catScores,
      hasEliminatoryTrigger: triggered.length > 0,
      triggeredEliminatoryCriteria: triggered
    };
  }, [scores, applicableCriteria, groupedCriteria]);

  const conceito = getScoreConcept(finalScore);

  // Registra a resposta de uma sub-pergunta de um critério do tipo CHECKLIST_SIM_NAO.
  // O score agregado (0-2) só é calculado quando todas as sub-perguntas estiverem respondidas;
  // enquanto incompleto, score permanece '' para que validateStep3 continue bloqueando o avanço
  // com a mesma lógica genérica já usada pelos demais tipos de critério.
  const handleChecklistAnswer = (criterionId: string, subPerguntaId: string, valor: 'SIM' | 'NAO') => {
    const criterion = applicableCriteria.find(c => c.id === criterionId);
    const subPerguntas = criterion?.subPerguntas || [];
    const subRespostas = { ...(scores[criterionId]?.subRespostas || {}), [subPerguntaId]: valor };
    const allAnswered = subPerguntas.length > 0 && subPerguntas.every(sp => subRespostas[sp.id]);
    const simCount = subPerguntas.filter(sp => subRespostas[sp.id] === 'SIM').length;
    const newScore = allAnswered ? parseFloat(((simCount / subPerguntas.length) * 2).toFixed(2)) : '';
    setScores({
      ...scores,
      [criterionId]: { ...scores[criterionId], subRespostas, score: newScore }
    });
  };

  const validateStep1 = () => {
    if (!formData.colaboradorId) return 'Por favor, selecione o Colaborador Avaliado.';
    if (!formData.empreendimento) return 'O Empreendimento é obrigatório.';
    if (!formData.categoriaAtendimento) return 'A Categoria do Atendimento é obrigatória.';
    // O protocolo passou a ser obrigatório: é a única chave que liga uma monitoria ao
    // atendimento e, por consequência, ao cliente. Enquanto era opcional, o campo era gravado
    // e nunca lido — nem na busca, nem em relatório. A regra vale também na edição, de
    // propósito: as monitorias registradas antes desta mudança ganham a chave ao serem
    // abertas, em vez de deixar a base com dois padrões. Preparação para a visão de Cliente
    // como entidade central (ver docs/VISAO-PRODUTO.md).
    if (!formData.protocolo || !formData.protocolo.trim()) return 'O Nº do Protocolo é obrigatório.';
    if (!formData.canal) return 'O Canal é obrigatório.';
    if (!formData.date) return 'A Data é obrigatória.';
    return null;
  };

  const validateStep3 = () => {
    let error = null;
    applicableCriteria.forEach(c => {
      const item = scores[c.id];
      if (!item || item.score === '') {
        error = 'Por favor, avalie todos os critérios antes de avançar.';
      } else if (item.score !== 'N/A' && item.score < 2 && !item.lowScoreReason.trim()) {
        error = 'Justificativa obrigatória para notas menores que a máxima.';
      }
    });
    return error;
  };

  const handleNext = () => {
    setHasAttemptedNext(true);
    if (step === 1) {
      const error = validateStep1();
      if (error) return; // UI reflects it
    }
    if (step === 3) {
      const error = validateStep3();
      if (error) {
        alert(error);
        return;
      }
    }
    setHasAttemptedNext(false);
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const handlePrev = () => {
    setHasAttemptedNext(false);
    setStep(s => Math.max(s - 1, 1));
  };

  const buildFinalData = (isDraft: boolean): Monitoring => {
    const id = formData.id || `MON-${Math.floor(Math.random() * 90000) + 10000}`;
    const formattedScores = applicableCriteria.map(c => ({
      criterionId: c.id,
      score: scores[c.id]?.score || 0,
      lowScoreReason: scores[c.id]?.lowScoreReason || '',
      subRespostas: scores[c.id]?.subRespostas || null
    }));

    // Fronteira entre o estado de edição (strings livres) e o objeto de domínio: canal, tipo
    // e status são uniões fechadas em Monitoring, mas campos de formulário durante a edição.
    return {
      ...formData,
      canal: formData.canal as Monitoring['canal'],
      tipo: formData.tipo as Monitoring['tipo'],
      id,
      date: formData.date + 'T12:00:00Z',
      finalScore,
      scores: formattedScores,
      status: (isDraft ? 'Rascunho'
            : (currentUser?.role === 'MONITOR' ? 'Pendente' : 'Validada')) as Monitoring['status'],
      // F0-08: sinalização de eliminatório é independente do status de aprovação de conteúdo.
      // A nota (finalScore) NUNCA é zerada aqui — só a confirmação de um Gestor/Admin
      // (handleConfirmZerada, em App.jsx) pode zerar. Nunca é reaberta a false no re-save de
      // um rascunho: se já estava zerada, permanece zerada até decisão explícita do Gestor.
      eliminatoryPending: initialData?.zerada ? false : (hasEliminatoryTrigger || initialData?.eliminatoryPending || false),
      zerada: initialData?.zerada || false
    };
  };

  const handleSaveDraft = () => {
    const data = buildFinalData(true);
    onSave(data);
    setLastSaved(new Date().toLocaleTimeString());
    alert('Rascunho salvo com sucesso!');
  };

  const handleSaveFinal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (window.confirm("Deseja concluir esta monitoria? Após salvar ela seguirá para validação.")) {
      const data = buildFinalData(false);
      onSave(data);
      alert(`Monitoria salva com sucesso!\nCódigo: ${data.id}\nNota: ${data.finalScore}% (${getScoreConcept(data.finalScore).label})`);
    }
  };

  // Evidencias Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Simulate progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploading(false);
            const newEvidencia = {
              id: `evd-${Math.floor(Math.random() * 1000)}`,
              name: file.name,
              type: file.type,
              size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
              date: new Date().toLocaleDateString('pt-BR')
            };
            setFormData(prevForm => ({ ...prevForm, evidencias: [...prevForm.evidencias, newEvidencia] }));
            return 0;
          }
          return prev + 25;
        });
      }, 300);
    }
  };

  const removeEvidencia = (id: string) => {
    setFormData(prev => ({
      ...prev,
      evidencias: prev.evidencias.filter(ev => ev.id !== id)
    }));
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <Image size={24} style={{color: '#3b82f6'}} />;
    if (type.includes('pdf')) return <FileText size={24} style={{color: '#ef4444'}} />;
    if (type.includes('video')) return <Video size={24} style={{color: '#8b5cf6'}} />;
    if (type.includes('audio')) return <File size={24} style={{color: '#10b981'}} />;
    return <File size={24} style={{color: '#6b7280'}} />;
  };

  const toggleAccordion = (cat: string) => {
    setExpandedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Status de grupo da barra lateral
  const getGroupStatus = (cat: string) => {
    const data = categoryScores[cat];
    if (!data) return null;
    if (data.evaluated === 0) return <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Não iniciado</span>;
    if (data.evaluated === data.totalCriteria) return <span style={{ color: '#10b981', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12}/> Concluído</span>;
    return <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>{data.evaluated} de {data.totalCriteria}</span>;
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="monitoring-page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', backgroundColor: '#f9fafb' }}>
      
      {/* Sticky Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 2rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', margin: 0, fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: 0, marginRight: '0.5rem' }} title="Voltar">
                <ChevronLeft size={24} />
              </button>
              {initialData ? 'Editar Monitoria' : 'Nova Monitoria'}
            </h2>
            {lastSaved && <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '3rem', marginTop: '0.25rem', display: 'inline-block' }}>Salvo automaticamente às {lastSaved}</span>}
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleSaveDraft} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> Salvar Rascunho
            </button>
            <button type="button" className="btn-sidebar-logout" onClick={onClose} title="Fechar e Voltar" style={{ marginLeft: '0.5rem' }}><X size={20} /></button>
          </div>
        </div>

        {/* Progress Bar Header */}
        <div style={{ padding: '1rem 2rem', backgroundColor: '#fff' }}>
          <div className="stepper-container" style={{ margin: 0, padding: 0, maxWidth: '1000px', marginInline: 'auto' }}>
            {['Info Gerais', 'Evidências', 'Avaliação', 'Observações', 'Conclusão'].map((label, i) => {
              const num = i + 1;
              const isActive = step >= num;
              const isCompleted = step > num;
              return (
                <div key={label} className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                  <div className="step-badge" style={{
                    backgroundColor: isCompleted ? '#10b981' : (isActive ? '#008443' : '#e5e7eb'),
                    color: (isActive || isCompleted) ? '#fff' : '#6b7280',
                    border: 'none',
                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: '600', fontSize: '1.1rem'
                  }}>
                    {isCompleted ? <CheckCircle2 size={18} /> : num}
                  </div>
                  <div className="step-label" style={{ fontWeight: isActive ? '600' : '400', color: isActive ? '#111827' : '#6b7280', fontSize: '0.9rem' }}>{label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', marginTop: '1.5rem', overflow: 'hidden', maxWidth: '1000px', marginInline: 'auto' }}>
            <div style={{ height: '100%', backgroundColor: '#008443', width: `${((step - 1) / (totalSteps - 1)) * 100}%`, transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1000px' }}>
          <form id="monitoring-form" onSubmit={handleSaveFinal} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '6rem' }}>
              
              {/* ETAPA 1: Informações Gerais */}
              {step === 1 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      INFORMAÇÕES DO ATENDIMENTO
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>👤 Colaborador *</label>
                        <select 
                          className="form-control"
                          value={formData.colaboradorId}
                          onChange={(e) => setFormData({...formData, colaboradorId: e.target.value})}
                          style={{ borderColor: (hasAttemptedNext && !formData.colaboradorId) ? '#ef4444' : '#d1d5db', backgroundColor: '#f9fafb' }}
                        >
                          <option value="">Selecione na lista...</option>
                          {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>👨 Monitor</label>
                        <select 
                          className="form-control"
                          value={formData.monitorId}
                          onChange={(e) => setFormData({...formData, monitorId: e.target.value})}
                          disabled
                          style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                        >
                          <option value="">Automático...</option>
                          {users.filter(u => u.role === 'MONITOR' || u.role === 'GESTOR').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🏘 Empreendimento *</label>
                        <SearchableSelect 
                          options={catalogEmpreendimentos}
                          value={formData.empreendimento}
                          onChange={(val) => setFormData({...formData, empreendimento: val})}
                          hasError={hasAttemptedNext && !formData.empreendimento}
                          allowCreate={true}
                          onCreate={(novo) => onAddEmpreendimento(novo)}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📂 Categoria *</label>
                        <SearchableSelect 
                          options={catalogCategorias}
                          value={formData.categoriaAtendimento}
                          onChange={(val) => setFormData({...formData, categoriaAtendimento: val})}
                          hasError={hasAttemptedNext && !formData.categoriaAtendimento}
                          allowCreate={true}
                          onCreate={(nova) => onAddCategoria(nova)}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📞 Canal *</label>
                        <select 
                          className="form-control"
                          value={formData.canal}
                          onChange={(e) => setFormData({...formData, canal: e.target.value})}
                          style={{ borderColor: (hasAttemptedNext && !formData.canal) ? '#ef4444' : '#d1d5db', backgroundColor: '#f9fafb' }}
                        >
                          <option value="">Selecione...</option>
                          {CANAIS.map(c => (
                            <option key={c} value={c}>{canalLabel(c)}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🔖 Tipo de Monitoria *
                          <HelpCircle 
                            size={16} 
                            style={{ color: '#6b7280', cursor: 'help' }} 
                            {...({ title: 'Regular: Monitoria prevista no cronograma mensal da equipe.\n\nDirecionada: Aberta devido a necessidade específica (reclamações, CSAT, solicitação de supervisão).\n\nProcesso: Validação de um fluxo operacional específico e cumprimento de POPs.\n\nCalibração: Alinhamento de critérios entre monitores e supervisão.' } as React.SVGProps<SVGSVGElement>)}
                          />
                        </label>
                        <select 
                          className="form-control"
                          value={formData.tipo}
                          onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                          style={{ backgroundColor: '#f9fafb' }}
                        >
                          <option value="Regular">Regular</option>
                          <option value="Direcionada">Direcionada</option>
                          <option value="Processo">Processo</option>
                          <option value="Calibração">Calibração</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📝 Nº do Protocolo *</label>
                        <input 
                          type="text" 
                          className="form-control"
                          placeholder="Nº do atendimento..."
                          value={formData.protocolo}
                          onChange={(e) => setFormData({...formData, protocolo: e.target.value})}
                          style={{ borderColor: (hasAttemptedNext && !formData.protocolo) ? '#ef4444' : '#d1d5db', backgroundColor: '#f9fafb' }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📅 Data *</label>
                        <input 
                          type="date" 
                          className="form-control"
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value})}
                          style={{ borderColor: (hasAttemptedNext && !formData.date) ? '#ef4444' : '#d1d5db', backgroundColor: '#f9fafb' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>⏱ Tempo *</label>
                        <input 
                          type="time" 
                          className="form-control"
                          value={formData.tempo}
                          onChange={(e) => setFormData({...formData, tempo: e.target.value})}
                          style={{ backgroundColor: '#f9fafb' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ETAPA 2: Evidências */}
              {step === 2 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <LinkIcon size={18} style={{ color: '#008443' }} /> Link do Atendimento
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <input 
                        type="url" 
                        className="form-control" 
                        placeholder="Cole aqui a URL para o áudio, ticket ou histórico de conversa..." 
                        value={formData.links[0] || ''}
                        onChange={(e) => setFormData({...formData, links: [e.target.value]})}
                        style={{ padding: '0.75rem', backgroundColor: '#f9fafb' }}
                      />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                        <UploadCloud size={18} style={{ color: '#008443' }} /> Arquivos de Evidência
                      </h3>
                      {formData.evidencias.length > 0 && (
                        <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '12px' }}>
                          {formData.evidencias.length} evidência{formData.evidencias.length !== 1 ? 's' : ''} anexada{formData.evidencias.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', transition: 'all 0.2s', cursor: 'pointer', position: 'relative' }}>
                      <input 
                        type="file" 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
                        onChange={handleFileUpload}
                      />
                      <UploadCloud size={36} style={{ color: '#9ca3af', margin: '0 auto 1rem auto' }} />
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', margin: 0 }}>Clique ou arraste arquivos aqui</h4>
                      <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem' }}>Suporta Áudio, PDF, Imagens e Vídeos (Máx 50MB)</p>
                    </div>

                    {isUploading && (
                      <div style={{ marginTop: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151', fontWeight: '500' }}>
                          <span>Enviando arquivo...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#008443', transition: 'width 0.2s' }}></div>
                        </div>
                      </div>
                    )}

                    {formData.evidencias.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                        {formData.evidencias.map(evd => (
                          <div key={evd.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ backgroundColor: '#f3f4f6', padding: '0.75rem', borderRadius: '8px' }}>
                                {getFileIcon(evd.type)}
                              </div>
                              <div>
                                <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>{evd.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', gap: '0.5rem' }}>
                                  <span>{evd.size}</span> • <span>{evd.date}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button type="button" className="btn btn-outline btn-sm" style={{ padding: '0.4rem 0.6rem' }}><Download size={14} /></button>
                              <button type="button" className="btn btn-outline btn-sm" style={{ padding: '0.4rem 0.6rem', color: '#ef4444', borderColor: '#fee2e2' }} onClick={() => removeEvidencia(evd.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ETAPA 3: Avaliação */}
              {step === 3 && (
                <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                  
                  {/* Area Principal - Accordions */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.keys(groupedCriteria).map(category => (
                      <div key={category} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <button 
                          type="button"
                          onClick={() => toggleAccordion(category)}
                          style={{ width: '100%', padding: '1.25rem 1.5rem', backgroundColor: expandedGroups[category] ? '#f8fafc' : '#fff', borderBottom: expandedGroups[category] ? '1px solid #e5e7eb' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                        >
                          <span style={{ fontSize: '1rem', fontWeight: '700', color: '#111827' }}>▼ {category}</span>
                          {expandedGroups[category] ? <ChevronUp size={20} style={{color: '#6b7280'}}/> : <ChevronDown size={20} style={{color: '#6b7280'}}/>}
                        </button>
                        
                        {expandedGroups[category] && (
                          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {groupedCriteria[category].map(c => (
                              <div key={c.id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div>
                                  <h4 style={{ fontWeight: '600', fontSize: '1rem', color: '#111827', marginBottom: '0.25rem' }}>{c.name}</h4>
                                  <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>{c.description}</p>
                                  {c.orientacao && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedOrientacao({ ...expandedOrientacao, [c.id]: !expandedOrientacao[c.id] })}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: '#3b82f6' }}
                                      >
                                        <HelpCircle size={14} />
                                        {expandedOrientacao[c.id] ? 'Ocultar orientação' : 'Ver orientação do critério'}
                                      </button>
                                      {expandedOrientacao[c.id] && (
                                        <div className="animate-fade-in" style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#eff6ff', borderLeft: '3px solid #3b82f6', borderRadius: '6px', fontSize: '0.8rem', color: '#1e3a8a', lineHeight: '1.5' }}>
                                          {c.orientacao}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  {c.eliminatorio ? (
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                      {[
                                        { val: 2, label: 'Não ocorreu', color: '#10b981', bg: '#d1fae5' },
                                        { val: 0, label: 'Sim, ocorreu', color: '#ef4444', bg: '#fee2e2' }
                                      ].map(opt => {
                                        const isSelected = scores[c.id]?.score === opt.val;
                                        return (
                                          <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => setScores({...scores, [c.id]: { ...scores[c.id], score: opt.val as ScoreEmEdicao['score'] }})}
                                            style={{
                                              flex: 1, padding: '0.85rem 0.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer',
                                              border: `2px solid ${isSelected ? opt.color : '#e5e7eb'}`,
                                              backgroundColor: isSelected ? opt.bg : '#fff',
                                              color: isSelected ? opt.color : '#374151',
                                              transition: 'all 0.15s'
                                            }}
                                          >
                                            {opt.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : c.tipoResposta === 'CHECKLIST_SIM_NAO' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {(c.subPerguntas || []).map(sub => {
                                        const respostaAtual = scores[c.id]?.subRespostas?.[sub.id];
                                        return (
                                          <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.6rem 0.85rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#374151', flex: 1 }}>{sub.texto}</span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                              {['SIM', 'NAO'].map(valor => {
                                                const isSelected = respostaAtual === valor;
                                                const color = valor === 'SIM' ? '#10b981' : '#ef4444';
                                                const bg = valor === 'SIM' ? '#d1fae5' : '#fee2e2';
                                                return (
                                                  <button
                                                    key={valor}
                                                    type="button"
                                                    onClick={() => handleChecklistAnswer(c.id, sub.id, valor as 'SIM' | 'NAO')}
                                                    style={{
                                                      padding: '0.4rem 1.1rem', borderRadius: '6px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer',
                                                      border: `2px solid ${isSelected ? color : '#e5e7eb'}`,
                                                      backgroundColor: isSelected ? bg : '#fff',
                                                      color: isSelected ? color : '#374151',
                                                      transition: 'all 0.15s'
                                                    }}
                                                  >
                                                    {valor === 'SIM' ? 'Sim' : 'Não'}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                      {getScaleOptions(c.tipoResposta).map(opt => {
                                        const isSelected = scores[c.id]?.score === opt.val;
                                        return (
                                          <button
                                            key={opt.val}
                                            type="button"
                                            onClick={() => setScores({...scores, [c.id]: { ...scores[c.id], score: opt.val as ScoreEmEdicao['score'] }})}
                                            style={{
                                              flex: 1, padding: '0.75rem 0.5rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                              border: `2px solid ${isSelected ? opt.color : '#e5e7eb'}`,
                                              backgroundColor: isSelected ? opt.bg : '#fff',
                                              color: isSelected ? opt.color : '#374151',
                                              transition: 'all 0.15s'
                                            }}
                                          >
                                            <span style={{ fontSize: '1.1rem' }}>{opt.display}</span>
                                            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{opt.label}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Mostrar Justificativa somente se < 2 ou N/A */}
                                  {(scores[c.id]?.score !== '' && scores[c.id]?.score !== 2) && (
                                    <div className="animate-fade-in">
                                      <label className="form-label" style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Justificativa / Comentário</span>
                                        {scores[c.id]?.score !== 'N/A' && <span style={{ color: '#ef4444' }}>*Obrigatória</span>}
                                      </label>
                                      <textarea 
                                        className="form-control"
                                        rows={2}
                                        placeholder="Por que esta nota foi atribuída?"
                                        value={scores[c.id]?.lowScoreReason || ''}
                                        onChange={(e) => setScores({...scores, [c.id]: { ...scores[c.id], lowScoreReason: e.target.value }})}
                                        style={{ 
                                          borderColor: (hasAttemptedNext && scores[c.id]?.score !== 'N/A' && !scores[c.id]?.lowScoreReason.trim()) ? '#ef4444' : '#d1d5db',
                                          backgroundColor: '#f9fafb'
                                        }}
                                      ></textarea>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Barra Lateral Fixa */}
                  <div style={{ width: '280px', position: 'sticky', top: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Monitoria</div>
                        
                        {/* Progress Bar simulada */}
                        <div style={{ display: 'flex', height: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
                          <div style={{ width: `${finalScore}%`, backgroundColor: conceito.color, transition: 'width 0.5s ease, background-color 0.5s ease' }}></div>
                        </div>

                        <div style={{ fontSize: '3rem', fontWeight: '800', color: conceito.color, lineHeight: 1, marginBottom: '0.25rem' }}>{finalScore}%</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>{conceito.label}</div>
                      </div>

                      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#6b7280' }}>Critérios avaliados</span>
                          <span style={{ fontWeight: '600', color: '#111827' }}>{qtdAvaliados + qtdNA} de {applicableCriteria.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: '#6b7280' }}>Tempo de análise</span>
                          <span style={{ fontWeight: '600', color: '#111827' }}>{formData.tempo}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#374151', marginBottom: '1rem' }}>Progresso por Grupo</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Object.keys(groupedCriteria).map(cat => (
                          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>{cat.substring(0, 15)}...</span>
                            {getGroupStatus(cat)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* ETAPA 4: Observações */}
              {step === 4 && (
                <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                  
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ backgroundColor: '#22c55e', color: '#fff', padding: '0.5rem', borderRadius: '8px' }}><Target size={20} /></div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#166534', margin: 0 }}>Pontos Fortes</h3>
                    </div>
                    <textarea 
                      className="form-control"
                      rows={3}
                      placeholder="Descreva o que o colaborador fez de melhor neste atendimento..."
                      value={formData.strengths}
                      onChange={(e) => setFormData({...formData, strengths: e.target.value})}
                      style={{ backgroundColor: '#fff', borderColor: '#bbf7d0' }}
                    ></textarea>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#15803d', marginTop: '0.25rem' }}>{formData.strengths.length} caracteres</div>
                  </div>

                  <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(234, 179, 8, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ backgroundColor: '#eab308', color: '#fff', padding: '0.5rem', borderRadius: '8px' }}><Lightbulb size={20} /></div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#854d0e', margin: 0 }}>Oportunidades de Melhoria</h3>
                    </div>
                    <textarea 
                      className="form-control"
                      rows={3}
                      placeholder="Pontos onde o colaborador precisa ter atenção ou evoluir..."
                      value={formData.opportunities}
                      onChange={(e) => setFormData({...formData, opportunities: e.target.value})}
                      style={{ backgroundColor: '#fff', borderColor: '#fef08a' }}
                    ></textarea>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#a16207', marginTop: '0.25rem' }}>{formData.opportunities.length} caracteres</div>
                  </div>

                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ backgroundColor: '#3b82f6', color: '#fff', padding: '0.5rem', borderRadius: '8px' }}><BookOpen size={20} /></div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e40af', margin: 0 }}>Plano de Desenvolvimento</h3>
                    </div>
                    <textarea 
                      className="form-control"
                      rows={3}
                      placeholder="Ações práticas, treinamentos ou combinados para o próximo ciclo..."
                      value={formData.comments}
                      onChange={(e) => setFormData({...formData, comments: e.target.value})}
                      style={{ backgroundColor: '#fff', borderColor: '#bfdbfe' }}
                    ></textarea>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#1d4ed8', marginTop: '0.25rem' }}>{formData.comments.length} caracteres</div>
                  </div>

                </div>
              )}

              {/* ETAPA 5: Conclusão */}
              {step === 5 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#111827', margin: 0 }}>Resumo Executivo</h2>
                    <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Revise os dados abaixo. Após salvar, o documento será travado para validação.</p>
                  </div>

                  {hasEliminatoryTrigger && (
                    <div style={{ border: '2px solid #ef4444', backgroundColor: '#fee2e2', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: '800', color: '#991b1b', fontSize: '1rem', marginBottom: '0.4rem' }}>
                        Atenção: Critério eliminatório sinalizado
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#7f1d1d', lineHeight: '1.5' }}>
                        Esta monitoria será zerada, mas apenas após confirmação de um Gestor ou Administrador. Até lá, a nota abaixo permanece a calculada normalmente. Item(ns): {triggeredEliminatoryCriteria.map(c => c.name).join(', ')}.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    
                    {/* Bloco 1: Identificação */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#4b5563', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '1rem' }}>IDENTIFICAÇÃO</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>Colaborador:</span> <span style={{ fontWeight: '600', color: '#111827' }}>{collaborators.find(c => c.id === formData.colaboradorId)?.name || '-'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>Monitor:</span> <span style={{ fontWeight: '600', color: '#111827' }}>{users.find(u => u.id === formData.monitorId)?.name || '-'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>Empreendimento:</span> <span style={{ fontWeight: '600', color: '#111827' }}>{formData.empreendimento || '-'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>Protocolo:</span> <span style={{ fontWeight: '600', color: '#111827' }}>{formData.protocolo || '-'}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>Canal / Data:</span> <span style={{ fontWeight: '600', color: '#111827' }}>{formData.canal} • {formData.date.split('-').reverse().join('/')}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>Evidências:</span> <span style={{ fontWeight: '600', color: '#111827' }}>{formData.evidencias.length} arquivos</span></div>
                      </div>
                    </div>

                    {/* Bloco 2: Nota e Métricas */}
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#4b5563', marginBottom: '1rem' }}>CLASSIFICAÇÃO GERAL</div>
                      <div style={{ fontSize: '4rem', fontWeight: '800', color: conceito.color, lineHeight: 1 }}>{finalScore}%</div>
                      <div style={{ marginTop: '0.5rem', backgroundColor: conceito.color, color: '#fff', padding: '0.25rem 1.25rem', borderRadius: '16px', fontSize: '1rem', fontWeight: '600' }}>{conceito.label}</div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1.5rem', width: '100%' }}>
                        <div style={{ textAlign: 'center', backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{formData.tempo}</div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginTop: '4px' }}>Tempo</div>
                        </div>
                        <div style={{ textAlign: 'center', backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{qtdAvaliados}</div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginTop: '4px' }}>Avaliados</div>
                        </div>
                        <div style={{ textAlign: 'center', backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{qtdNA}</div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', marginTop: '4px' }}>N/A</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Gráficos de Categoria */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#4b5563', marginBottom: '1.5rem' }}>DESEMPENHO POR CATEGORIA</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      {Object.keys(categoryScores).map(cat => {
                        const scoreData = categoryScores[cat];
                        const perc = scoreData.percent ?? 0;
                        const color = getScoreConcept(perc).color;
                        return (
                          <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: '600', color: '#374151' }}>{cat}</span>
                              <span style={{ fontWeight: '700', color }}>{perc.toFixed(1)}%</span>
                            </div>
                            <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${perc}%`, backgroundColor: color, borderRadius: '4px' }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                </div>
              )}

            </form>
        </div>
      </div>

      {/* Footer Navigation (Sticky) */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 100, padding: '1.25rem 2rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center', backgroundColor: '#fff', boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', justifyContent: 'space-between' }}>
          {step > 1 ? (
            <button type="button" className="btn btn-secondary" onClick={handlePrev} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ChevronLeft size={16} /> Anterior
            </button>
          ) : <div></div>}
          
          {step < totalSteps ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handleSaveDraft} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Save size={16} /> Salvar Rascunho
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Próximo <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={16} /> Exportar PDF
              </button>
              <button type="submit" form="monitoring-form" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#10b981', borderColor: '#10b981' }}>
                <CheckCircle2 size={16} /> Concluir Monitoria
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
