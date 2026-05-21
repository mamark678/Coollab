import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, X, Clock, Zap, Save, Loader2, Tag, Target, FileText, 
  Folder, Palette, Database, BrainCircuit, MousePointer2, 
  Layout, GripVertical, Trash2, ChevronRight, ChevronLeft,
  CheckCircle2, Info, Settings, ListChecks, Users, Sparkles
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { FirebaseService } from '../../services/firebase';
import { ActivityService, Activity, ActivityType } from '../../services/activity';
import { OverlapConfirmationModal } from './OverlapConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

interface ManualActivityFormProps {
  projectId: string;
  existingCount: number;
  onCancel: () => void;
  onSaved: () => void;
  initialData?: Activity | null;
}

interface StepRow {
  id: string;
  instruction: string;
}

const STEPS = [
  { id: 'details', label: 'Activity Details', icon: Info },
  { id: 'content', label: 'Content Builder', icon: ListChecks },
  { id: 'settings', label: 'Settings & XP', icon: Settings },
  { id: 'review', label: 'Review & Publish', icon: CheckCircle2 },
];

const TYPE_OPTIONS = [
  { value: 'quiz', label: 'Quiz', icon: Zap, color: '#f59e0b', description: 'Test knowledge with multiple choice questions' },
  { value: 'reading', label: 'Reading', icon: FileText, color: '#3b82f6', description: 'Structured reading with comprehension checks' },
  { value: 'task', label: 'Task', icon: ListChecks, color: '#10b981', description: 'Practical tasks with subtasks and criteria' },
  { value: 'discussion', label: 'Discussion', icon: Users, color: '#f472b6', description: 'Promote engagement with guiding questions' },
  { value: 'workspace', label: 'Workspace', icon: Layout, color: 'var(--theme-primary)', description: 'Students build knowledge through documents, database, graphs, and canvas' },
];

const ZONE_OPTIONS = [
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'folder', label: 'Folder', icon: Folder },
  { value: 'canvas', label: 'Canvas', icon: Palette },
  { value: 'base', label: 'Base/Table', icon: Database },
];

const InputGroup = ({ label, children, icon: Icon }: any) => (
  <div className="flex flex-col gap-2">
    <label className="text-[13px] font-bold text-[var(--theme-text-primary)] flex items-center gap-2">
      {Icon && <Icon size={14} className="text-[var(--theme-primary)]" />}
      {label}
    </label>
    {children}
  </div>
);

const getInstructionText = (instr: any): string => {
  if (!instr) return '';
  if (typeof instr === 'string') return instr;
  if (typeof instr === 'object') {
    if (typeof instr.instruction === 'string') return instr.instruction;
    if (typeof instr.text === 'string') return instr.text;
    if (typeof instr.description === 'string') return instr.description;
    if (typeof instr.step === 'string') return instr.step;
    if (typeof instr.step_text === 'string') return instr.step_text;
    if (typeof instr.content === 'string') return instr.content;
    
    for (const key of Object.keys(instr)) {
      if (typeof instr[key] === 'string' && !['id', 'type', 'status', 'step_number', 'stepNumber'].includes(key)) {
        return instr[key];
      }
    }
    
    try {
      return JSON.stringify(instr);
    } catch (e) {
      return '';
    }
  }
  return String(instr);
};

export const ManualActivityForm: React.FC<ManualActivityFormProps> = ({ projectId, existingCount, onCancel, onSaved, initialData }) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  
  // Form State
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>((initialData as any)?.difficulty || 'medium');
  const [zone, setZone] = useState((initialData as any)?.workspace_zone || 'document');
  const [steps, setSteps] = useState<StepRow[]>(
    initialData?.instructions?.map((inst: any, i: number) => ({ id: `step-${i}`, instruction: getInstructionText(inst) })) || 
    [{ id: 'step-1', instruction: '' }]
  );
  const [durationMin, setDurationMin] = useState(initialData?.timer_config?.duration_seconds ? Math.floor(initialData.timer_config.duration_seconds / 60) : 5);
  const [onTimeout, setOnTimeout] = useState(initialData?.timer_config?.on_timeout || 'auto_submit');
  const [maxRetries, setMaxRetries] = useState(initialData?.timer_config?.max_retries || 1);
  const [gracePeriodMin, setGracePeriodMin] = useState(initialData?.timer_config?.grace_period_seconds ? Math.floor(initialData.timer_config.grace_period_seconds / 60) : 1);
  const [points, setPoints] = useState(initialData?.points || 10);
  const [type, setType] = useState<ActivityType>(initialData?.type || 'quiz');
  const [estimatedTime, setEstimatedTime] = useState(initialData?.estimatedTime || '15 min');
  const [quizQuestions, setQuizQuestions] = useState<any[]>(initialData?.quizData?.questions || []);
  
  // New Activity Types State
  const [readingData, setReadingData] = useState(initialData?.readingData || { passage: '', questions: [] });
  const [taskData, setTaskData] = useState(initialData?.taskData || { description: '', subtasks: [], successCriteria: [] });
  const [discussionData, setDiscussionData] = useState(initialData?.discussionData || { prompt: '', guidingQuestions: [] });
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
  const [gizmoType, setGizmoType] = useState(initialData?.gizmoData?.gizmoType || 'timeline');
  const [gizmoItems, setGizmoItems] = useState<any[]>(initialData?.gizmoData?.items || []);
  const [showAnswers, setShowAnswers] = useState<boolean>((initialData as any)?.showAnswers ?? true);
  const [visibility, setVisibility] = useState<'draft' | 'published'>(initialData?.status === 'published' ? 'published' : 'draft');
  
  const [workspaceData, setWorkspaceData] = useState<any>(initialData?.workspaceData || {
    document: { enabled: true, prompt: '', minWords: 0 },
    database: { enabled: false, fields: [{ name: 'Name', type: 'Text' }] },
    graph: { enabled: false, prompt: '', minNodes: 0, minConnections: 0 },
    canvas: { enabled: false, prompt: '', requiredElements: [] }
  });

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAIModal, setShowAIModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialData) return;
    setTitle(initialData.title || '');
    setDescription(initialData.description || '');
    setDifficulty((initialData as any).difficulty || 'medium');
    setZone((initialData as any).workspace_zone || 'document');
    setSteps(initialData.instructions?.map((inst: any, i: number) => ({ id: `step-${i}-${Date.now()}`, instruction: getInstructionText(inst) })) || [{ id: 'step-1', instruction: '' }]);
    setDurationMin(initialData.timer_config?.duration_seconds ? Math.floor(initialData.timer_config.duration_seconds / 60) : 5);
    setOnTimeout(initialData.timer_config?.on_timeout || 'auto_submit');
    setMaxRetries(initialData.timer_config?.max_retries || 1);
    setGracePeriodMin(initialData.timer_config?.grace_period_seconds ? Math.floor(initialData.timer_config.grace_period_seconds / 60) : 1);
    setPoints(initialData.points || 10);
    setTags(initialData.tags?.join(', ') || '');
    setType(initialData.type || 'base');
    setEstimatedTime(initialData.estimatedTime || '5 min');
    setQuizQuestions(initialData.quizData?.questions || []);
    setGizmoType(initialData.gizmoData?.gizmoType || 'timeline');
    setGizmoItems(initialData.gizmoData?.items || []);
    setShowAnswers((initialData as any).showAnswers ?? true);
    setVisibility(initialData.status === 'published' ? 'published' : 'draft');
  }, [initialData]);

  const handleNext = () => {
    if (currentStepIdx === 0 && !title.trim()) {
      setError('Title is required to proceed.');
      return;
    }
    setError(null);
    setCurrentStepIdx(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStepIdx(prev => Math.max(prev - 1, 0));
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDifficulty('medium'); setZone('document');
    setSteps([{ id: 'step-1', instruction: '' }]);
    setDurationMin(5); setOnTimeout('auto_submit'); setMaxRetries(1);
    setGracePeriodMin(1); setPoints(10); setTags('');
    setShowAnswers(true); setVisibility('draft');
    setError(null);
    setCurrentStepIdx(0);
  };

  const handleSave = useCallback(async (statusToSave: 'draft' | 'published') => {
    if (!title.trim()) { setError('Title is required.'); return; }
    
    setError(null);
    setSaving(true);
    try {
      const db = FirebaseService.getInstance().db;
      const { doc, updateDoc, addDoc, serverTimestamp } = await import('firebase/firestore');

      const activitiesRef = collection(db, 'notes', projectId, 'activities');
      const tagArr = tags.split(',').map((t: string) => t.trim()).filter(Boolean);

      const activityData: any = {
        title: title.trim(),
        description: description.trim(),
        difficulty,
        workspace_zone: zone,
        instructions: steps.map(s => s.instruction.trim()),
        timer_config: {
          duration_seconds: durationMin * 60,
          on_timeout: onTimeout,
          grace_period_seconds: onTimeout === 'grace_period' ? gracePeriodMin * 60 : 30,
          max_retries: onTimeout === 'allow_retry' ? maxRetries : 1,
        },
        points,
        tags: tagArr,
        type,
        estimatedTime,
        quizData: type === 'quiz' ? { questions: quizQuestions } : null,
        readingData: type === 'reading' ? readingData : null,
        taskData: type === 'task' ? taskData : null,
        discussionData: type === 'discussion' ? discussionData : null,
        workspaceData: type === 'workspace' ? workspaceData : null,
        showAnswers,
        visibility: statusToSave,
        status: statusToSave,
        updatedAt: serverTimestamp(),
      };

      if (initialData && !initialData.id.startsWith('gen-')) {
        const activityRef = doc(db, `notes/${projectId}/activities`, initialData.id);
        await updateDoc(activityRef, activityData);
        setSuccessMsg('Activity updated successfully!');
      } else {
        const currentSnap = await getDocs(activitiesRef);
        activityData.sequenceNumber = currentSnap.size + 1;
        activityData.assignedBy = initialData?.id.startsWith('gen-') ? 'ai' : 'manual';
        activityData.createdAt = serverTimestamp();
        await addDoc(activitiesRef, activityData);
        setSuccessMsg('Activity saved successfully!');
      }

      window.dispatchEvent(new CustomEvent('activity-list-updated', { detail: { projectId } }));
      if (!initialData) resetForm();
      setTimeout(() => { setSuccessMsg(null); onSaved(); }, 2000);
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [title, description, difficulty, zone, steps, durationMin, onTimeout, maxRetries, gracePeriodMin, points, tags, projectId, onSaved, existingCount, initialData, type, estimatedTime, quizQuestions, gizmoType, gizmoItems, showAnswers, visibility]);

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAI(true);
    setError(null);
    try {
      const { generateActivityContent } = await import('../../services/groq');
      const content = await generateActivityContent(type, aiPrompt);
      
      if (content.activityTitle) setTitle(content.activityTitle);
      if (content.activityDescription) setDescription(content.activityDescription);

      if (type === 'quiz') setQuizQuestions(content.questions || []);
      if (type === 'reading') setReadingData(content);
      if (type === 'task') setTaskData(content);
      if (type === 'discussion') setDiscussionData(content);
      if (type === 'workspace') setWorkspaceData({
        document: { enabled: !!content.document, prompt: content.document?.prompt || '', minWords: content.document?.minWords || 0 },
        database: { enabled: !!content.database, fields: content.database?.fields || [] },
        graph: { enabled: !!content.graph, prompt: content.graph?.prompt || '', minNodes: content.graph?.minNodes || 0, minConnections: content.graph?.minConnections || 0 },
        canvas: { enabled: !!content.canvas, prompt: content.canvas?.prompt || '', requiredElements: content.canvas?.requiredElements || [] }
      });

      setShowAIModal(false);
      setCurrentStepIdx(1); 
    } catch (err: any) {
      setError(`AI Generation failed: ${err.message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const currentStep = STEPS[currentStepIdx];

  const cardStyle = "bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,var(--theme-surface))] border border-[var(--theme-border)] rounded-2xl p-6";
  const inputBaseStyle = "w-full bg-[color-mix(in_srgb,var(--theme-background)_30%,transparent)] border border-[var(--theme-border)] rounded-xl px-4 py-3 text-[14px] text-[var(--theme-text-primary)] focus:outline-none focus:border-[var(--theme-primary)] transition-all placeholder:text-[color-mix(in_srgb,var(--theme-text-primary)_30%,transparent)]";

  return (
    <div className="flex flex-col gap-8 max-w-[800px] mx-auto w-full self-center py-6">

      {/* AI Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[color-mix(in_srgb,var(--theme-background)_80%,transparent)] backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[32px] max-w-xl w-full shadow-2xl" style={{ padding: '24px' }}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] rounded-2xl flex items-center justify-center text-[var(--theme-primary)]">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--theme-text-primary)]">AI Activity Designer</h3>
                    <p className="text-xs text-[var(--theme-text-secondary)] opacity-60 uppercase tracking-widest font-black">Powered by Llama 3.3</p>
                  </div>
                </div>
                <button onClick={() => setShowAIModal(false)} className="text-[var(--theme-text-secondary)] opacity-40 hover:opacity-100">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-[var(--theme-text-secondary)] opacity-80">Describe what you want students to learn or do...</label>
                  <textarea 
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g. Generate a deep analysis task about the impact of the printing press on the Reformation, focusing on social changes."
                    className="w-full bg-[color-mix(in_srgb,var(--theme-background)_50%,transparent)] border border-[var(--theme-border)] rounded-2xl text-[var(--theme-text-primary)] text-sm focus:outline-none focus:border-[var(--theme-primary)] transition-all placeholder:text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)]"
                    style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', minHeight: '120px' }}
                  />
                </div>

                <button 
                  onClick={handleGenerateWithAI}
                  disabled={isGeneratingAI || !aiPrompt.trim()}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    background: 'var(--theme-primary)',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'var(--theme-text-primary)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Llama is thinking...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      Generate Activity
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Progress Header */}
      <div className="flex items-center justify-between" style={{ padding: '16px 32px' }}>
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentStepIdx;
          const isPast = idx < currentStepIdx;
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-[0_0_20px_color-mix(in_srgb,var(--theme-primary)_30%,transparent)] scale-110' : 
                  isPast ? 'bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] text-[var(--theme-primary)]' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_30%,transparent)]'
                }`}>
                  <StepIcon size={18} />
                </div>
                <span className={`text-[11px] font-bold uppercase tracking-wider`} style={{ color: isActive ? 'var(--theme-text-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 30%, transparent)' }}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-4 transition-colors duration-500`} style={{ backgroundColor: isPast ? 'color-mix(in srgb, var(--theme-primary) 30%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className={cardStyle} style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '24px 32px' }}>
        <AnimatePresence mode="wait">
          {currentStep.id === 'details' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-2xl font-black text-[var(--theme-text-primary)]">Activity Details</h2>
                <p className="text-sm" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Define the core identity of this learning experience.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Activity Title" icon={Info}>
                  <input 
                    key="activity-title-input"
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="e.g. Master the Golden Ratio" 
                    className={inputBaseStyle} 
                    style={{
                      padding: '12px 16px',
                      width: '100%',
                      boxSizing: 'border-box',
                      background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                      border: '1px  solid var(--theme-border)',
                      borderRadius: '10px',
                      color: 'var(--theme-text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </InputGroup>
                <InputGroup label="Activity Type" icon={Layout}>
                  <div className="grid grid-cols-1 gap-2" style={{ overflow: 'visible', width: '100%' }}>
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setType(opt.value as ActivityType)}
                        className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                          type === opt.value 
                          ? `bg-[${opt.color}]/10 border-[${opt.color}] text-[var(--theme-text-primary)]` 
                          : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]'
                        }`}
                        style={{
                          backgroundColor: type === opt.value ? `color-mix(in srgb, ${opt.color} 15%, transparent)` : undefined,
                          borderColor: type === opt.value ? opt.color : undefined,
                        }}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: type === opt.value ? opt.color : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)', color: type === opt.value ? (opt.color.startsWith('#') ? '#ffffff' : 'var(--theme-on-primary)') : 'inherit' }}>
                          <opt.icon size={20} />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-black block">{opt.label}</span>
                          <span className="text-[10px] opacity-60 font-medium">{opt.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </InputGroup>
              </div>

              <div className="mt-4 border flex items-center justify-between" style={{ borderRadius: "12px", padding: "16px 20px", backgroundColor: "color-mix(in srgb, var(--theme-primary) 5%, transparent)", borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)" }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)", color: "var(--theme-primary)" }}>
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[var(--theme-text-primary)]">Generate with AI</h4>
                    <p className="text-xs text-[color-mix(in_srgb,var(--theme-text-primary)_50%,transparent)]">Llama 3.3 can build this activity for you in seconds.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAIModal(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px  solid var(--theme-primary)',
                    color: 'var(--theme-secondary)',
                    background: 'transparent',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  Open AI Designer
                </button>
              </div>

              <InputGroup label="Description (Optional)" icon={FileText}>
                <textarea 
                  key="activity-description-input"
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="What will students learn in this module?" 
                  rows={3} 
                  className={`${inputBaseStyle} resize-none`} 
                  style={{
                    padding: '12px 16px',
                    width: '100%',
                    boxSizing: 'border-box',
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                />
              </InputGroup>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Estimated Time" icon={Clock}>
                  <input 
                    key="activity-estimated-time-input"
                    value={estimatedTime} 
                    onChange={e => setEstimatedTime(e.target.value)} 
                    placeholder="e.g. 15 min" 
                    className={inputBaseStyle} 
                    style={{
                      padding: '12px 16px',
                      width: '100%',
                      boxSizing: 'border-box',
                      background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                      border: '1px  solid var(--theme-border)',
                      borderRadius: '10px',
                      color: 'var(--theme-text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </InputGroup>
                <InputGroup label="Tags" icon={Tag}>
                  <input 
                    key="activity-tags-input"
                    value={tags} 
                    onChange={e => setTags(e.target.value)} 
                    placeholder="UI/UX, Design Systems, Figma" 
                    className={inputBaseStyle} 
                    style={{
                      padding: '12px 16px',
                      width: '100%',
                      boxSizing: 'border-box',
                      background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                      border: '1px  solid var(--theme-border)',
                      borderRadius: '10px',
                      color: 'var(--theme-text-primary)',
                      fontSize: '14px'
                    }}
                  />
                </InputGroup>
              </div>
            </div>
          )}

          {currentStep.id === 'content' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-2xl font-black text-[var(--theme-text-primary)]">Content Builder</h2>
                <p className="text-white/40 text-sm">Add questions, instructions, or interactive elements.</p>
              </div>

              {type === 'quiz' && (
                <div className="flex flex-col gap-4">
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="rounded-2xl relative group" style={{ padding: '24px', backgroundColor: 'color-mix(in srgb, var(--theme-text-primary) 3%, var(--theme-surface))', borderColor: 'var(--theme-border)', borderStyle: 'solid', borderWidth: '1px' }}>
                      <button 
                        onClick={() => setQuizQuestions(quizQuestions.filter((_, i) => i !== idx))}
                        className="absolute top-5 right-5 hover:text-red-400 transition-colors" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 30%, transparent)" }}
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className="text-[10px] font-black uppercase tracking-widest mb-4 block" style={{ color: "var(--theme-secondary)" }}>Question {idx + 1}</span>
                      <textarea 
                        value={q.question} 
                        onChange={e => {
                          setQuizQuestions(prev => {
                            const newQ = [...prev];
                            newQ[idx] = { ...newQ[idx], question: e.target.value };
                            return newQ;
                          });
                        }}
                        className={`${inputBaseStyle} mb-5 bg-white/5 resize-none`}
                        placeholder="Enter your question..."
                        rows={2}
                        style={{
                          padding: '14px 20px',
                          width: '100%',
                          boxSizing: 'border-box',
                          background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                          border: '1px  solid var(--theme-border)',
                          borderRadius: '12px',
                          color: 'var(--theme-text-primary)',
                          fontSize: '14px',
                          minHeight: '60px'
                        }}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        {q.options.map((opt: string, oIdx: number) => (
                          <div 
                            key={oIdx} 
                            className="flex items-center gap-4 rounded-xl hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] transition-all focus-within:border-[var(--theme-primary)]" style={{ padding: "12px 20px", boxSizing: "border-box", backgroundColor: "color-mix(in srgb, var(--theme-text-primary) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--theme-text-primary) 10%, transparent)" }}
                          >
                            <input 
                              type="radio" 
                              name={`correct-${idx}`}
                              checked={q.correctAnswer === oIdx} 
                              onChange={() => {
                                setQuizQuestions(prev => {
                                  const newQ = [...prev];
                                  newQ[idx] = { ...newQ[idx], correctAnswer: oIdx };
                                  return newQ;
                                });
                              }}
                              className="w-4 h-4 cursor-pointer shrink-0" style={{ accentColor: "var(--theme-primary)" }}
                            />
                            <input 
                              value={opt}
                              onChange={e => {
                                setQuizQuestions(prev => {
                                  const newQ = [...prev];
                                  const newOptions = [...newQ[idx].options];
                                  newOptions[oIdx] = e.target.value;
                                  newQ[idx] = { ...newQ[idx], options: newOptions };
                                  return newQ;
                                });
                              }}
                              className="flex-1 bg-transparent border-none outline-none text-[14px] p-0 focus:ring-0" style={{ color: "var(--theme-text-primary)" }}
                              placeholder={`Option ${oIdx + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => setQuizQuestions([...quizQuestions, { question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' }])}
                    className="w-full py-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-2 font-bold text-sm" style={{ backgroundColor: "transparent", borderColor: "color-mix(in srgb, var(--theme-text-primary) 15%, transparent)", color: "color-mix(in srgb, var(--theme-text-primary) 50%, transparent)" }}
                  >
                    <Plus size={18} /> Add New Question
                  </button>
                </div>
              )}

              {type === 'reading' && (
                <div className="flex flex-col gap-6">
                   <InputGroup label="Reading Passage" icon={FileText}>
                    <textarea 
                      value={readingData.passage} 
                      onChange={e => setReadingData(prev => ({ ...prev, passage: e.target.value }))} 
                      placeholder="Enter the reading material here..." 
                      rows={8} 
                      className={`${inputBaseStyle} resize-none`} 
                      style={{
                        padding: '12px 16px',
                        width: '100%',
                        boxSizing: 'border-box',
                        background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                        border: '1px  solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'var(--theme-text-primary)',
                        fontSize: '14px'
                      }}
                    />
                  </InputGroup>
                  <div className="flex flex-col gap-4">
                    <label className="text-[13px] font-bold text-[var(--theme-text-primary)] flex items-center gap-2">
                      <ListChecks size={14} style={{ color: "var(--theme-primary)" }} />
                      Comprehension Questions
                    </label>
                    {readingData.questions.map((q: any, idx: number) => (
                      <div key={idx} className="rounded-2xl relative" style={{ padding: '24px', backgroundColor: 'color-mix(in srgb, var(--theme-text-primary) 3%, var(--theme-surface))', borderColor: 'var(--theme-border)', borderStyle: 'solid', borderWidth: '1px' }}>
                        <button 
                          onClick={() => setReadingData({ ...readingData, questions: readingData.questions.filter((_: any, i: number) => i !== idx) })}
                          className="absolute top-5 right-5 hover:text-red-400 transition-colors"
                          style={{ color: "color-mix(in srgb, var(--theme-text-primary) 20%, transparent)" }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <textarea 
                          value={q.question} 
                          onChange={e => {
                            setReadingData(prev => {
                              const newQ = [...prev.questions];
                              newQ[idx] = { ...newQ[idx], question: e.target.value };
                              return { ...prev, questions: newQ };
                            });
                          }}
                          className={`${inputBaseStyle} mb-5 bg-white/5 resize-none`}
                          placeholder="Question..."
                          rows={2}
                          style={{
                            padding: '14px 20px',
                            width: '100%',
                            boxSizing: 'border-box',
                            background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                            border: '1px  solid var(--theme-border)',
                            borderRadius: '12px',
                            color: 'var(--theme-text-primary)',
                            fontSize: '14px',
                            minHeight: '60px'
                          }}
                        />
                         <div className="grid grid-cols-2 gap-4">
                          {q.options.map((opt: string, oIdx: number) => (
                            <div 
                              key={oIdx} 
                              className="flex items-center gap-4 rounded-xl hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] transition-all focus-within:border-[var(--theme-primary)]" style={{ padding: "12px 20px", boxSizing: "border-box", backgroundColor: "color-mix(in srgb, var(--theme-text-primary) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--theme-text-primary) 10%, transparent)" }}
                            >
                              <input 
                                type="radio" 
                                name={`reading-correct-${idx}`}
                                checked={q.correctAnswer === oIdx} 
                                onChange={() => {
                                  setReadingData(prev => {
                                    const newQ = [...prev.questions];
                                    newQ[idx] = { ...newQ[idx], correctAnswer: oIdx };
                                    return { ...prev, questions: newQ };
                                  });
                                }}
                                className="w-4 h-4 cursor-pointer shrink-0" style={{ accentColor: "var(--theme-primary)" }}
                              />
                              <input 
                                value={opt}
                                onChange={e => {
                                  setReadingData(prev => {
                                    const newQ = [...prev.questions];
                                    const newOptions = [...newQ[idx].options];
                                    newOptions[oIdx] = e.target.value;
                                    newQ[idx] = { ...newQ[idx], options: newOptions };
                                    return { ...prev, questions: newQ };
                                  });
                                }}
                                className="flex-1 bg-transparent border-none outline-none text-[14px] p-0 focus:ring-0 placeholder:opacity-30"
                                style={{ color: "var(--theme-text-primary)" }}
                                placeholder={`Option ${oIdx + 1}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setReadingData({ ...readingData, questions: [...readingData.questions, { question: '', options: ['', '', '', ''], correctAnswer: 0 }] })}
                      className="w-full py-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-2 font-bold text-sm" style={{ backgroundColor: "transparent", borderColor: "color-mix(in srgb, var(--theme-text-primary) 15%, transparent)", color: "color-mix(in srgb, var(--theme-text-primary) 50%, transparent)" }}
                    >
                      <Plus size={18} /> Add Comprehension Question
                    </button>
                  </div>
                </div>
              )}

              {type === 'task' && (
                <div className="flex flex-col gap-6">
                  <InputGroup label="Task Description" icon={Target}>
                    <textarea 
                      value={taskData.description} 
                      onChange={e => setTaskData(prev => ({ ...prev, description: e.target.value }))} 
                      placeholder="Describe the overall task..." 
                      rows={3} 
                      className={`${inputBaseStyle} resize-none`} 
                      style={{
                        padding: '12px 16px',
                        width: '100%',
                        boxSizing: 'border-box',
                        background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                        border: '1px  solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'var(--theme-text-primary)',
                        fontSize: '14px'
                      }}
                    />
                  </InputGroup>
                  <div className="flex flex-col gap-4">
                    <label className="text-[13px] font-bold text-[var(--theme-text-primary)] flex items-center gap-2">
                      <ListChecks size={14} style={{ color: "var(--theme-primary)" }} />
                      Subtasks
                    </label>
                    {taskData.subtasks.map((st: any, idx: number) => (
                      <div key={st.id} className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: "color-mix(in srgb, var(--theme-text-primary) 3%, transparent)", borderColor: "color-mix(in srgb, var(--theme-text-primary) 5%, transparent)" }}>
                        <input 
                          value={st.text} 
                          onChange={e => {
                            setTaskData(prev => {
                              const newSt = [...prev.subtasks];
                              newSt[idx] = { ...newSt[idx], text: e.target.value };
                              return { ...prev, subtasks: newSt };
                            });
                          }}
                          className="flex-1 bg-transparent text-sm focus:outline-none"
                          placeholder="Subtask description..."
                          style={{
                            padding: '12px 16px',
                            width: '100%',
                            boxSizing: 'border-box',
                            background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                            border: '1px  solid var(--theme-border)',
                            borderRadius: '10px',
                            color: 'var(--theme-text-primary)',
                            fontSize: '14px'
                          }}
                        />
                        <button onClick={() => setTaskData({ ...taskData, subtasks: taskData.subtasks.filter((_: any, i: number) => i !== idx) })} className="hover:text-red-400 transition-colors" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 20%, transparent)" }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setTaskData({ ...taskData, subtasks: [...taskData.subtasks, { id: Date.now().toString(), text: '', completed: false }] })}
                      className="w-full py-3 rounded-xl border border-dashed transition-all flex items-center justify-center gap-2 text-xs font-bold" style={{ backgroundColor: "transparent", borderColor: "color-mix(in srgb, var(--theme-text-primary) 15%, transparent)", color: "color-mix(in srgb, var(--theme-text-primary) 50%, transparent)" }}
                    >
                      <Plus size={14} /> Add Subtask
                    </button>
                  </div>
                </div>
              )}

              {type === 'discussion' && (
                <div className="flex flex-col gap-6">
                  <InputGroup label="Discussion Prompt" icon={Users}>
                    <textarea 
                      value={discussionData.prompt} 
                      onChange={e => setDiscussionData(prev => ({ ...prev, prompt: e.target.value }))} 
                      placeholder="What should students discuss?" 
                      rows={4} 
                      className={`${inputBaseStyle} resize-none`} 
                      style={{
                        padding: '12px 16px',
                        width: '100%',
                        boxSizing: 'border-box',
                        background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                        border: '1px  solid var(--theme-border)',
                        borderRadius: '10px',
                        color: 'var(--theme-text-primary)',
                        fontSize: '14px'
                      }}
                    />
                  </InputGroup>
                  <div className="flex flex-col gap-4">
                    <label className="text-[13px] font-bold text-[var(--theme-text-primary)] flex items-center gap-2">
                      <Info size={14} style={{ color: "var(--theme-primary)" }} />
                      Guiding Questions
                    </label>
                    {discussionData.guidingQuestions.map((q: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: "color-mix(in srgb, var(--theme-text-primary) 5%, transparent)", borderColor: "color-mix(in srgb, var(--theme-text-primary) 5%, transparent)" }}>
                        <input 
                          value={q} 
                          onChange={e => {
                            setDiscussionData(prev => {
                              const newQ = [...prev.guidingQuestions];
                              newQ[idx] = e.target.value;
                              return { ...prev, guidingQuestions: newQ };
                            });
                          }}
                          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:opacity-30"
                          placeholder="e.g. How does this relate to X?"
                          style={{
                            padding: '12px 16px',
                            width: '100%',
                            boxSizing: 'border-box',
                            background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                            border: '1px  solid var(--theme-border)',
                            borderRadius: '10px',
                            color: 'var(--theme-text-primary)',
                            fontSize: '14px'
                          }}
                        />
                        <button onClick={() => setDiscussionData({ ...discussionData, guidingQuestions: discussionData.guidingQuestions.filter((_, i) => i !== idx) })} className="hover:text-red-400 transition-colors" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 20%, transparent)" }}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setDiscussionData({ ...discussionData, guidingQuestions: [...discussionData.guidingQuestions, ''] })}
                      className="w-full py-3 rounded-xl border border-dashed transition-all flex items-center justify-center gap-2 text-xs font-bold" style={{ backgroundColor: "transparent", borderColor: "color-mix(in srgb, var(--theme-text-primary) 15%, transparent)", color: "color-mix(in srgb, var(--theme-text-primary) 50%, transparent)" }}
                    >
                      <Plus size={14} /> Add Guiding Question
                    </button>
                  </div>
                </div>
              )}

              {type === 'workspace' && (
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-black text-[var(--theme-text-primary)]">Workspace Components</h3>
                    <p className="text-xs" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Enable the tools students will use for this activity.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className={`p-6 rounded-2xl border transition-all`} style={{ backgroundColor: workspaceData.document.enabled ? 'color-mix(in srgb, var(--theme-primary) 5%, var(--theme-surface))' : 'color-mix(in srgb, var(--theme-text-primary) 3%, var(--theme-surface))', borderColor: workspaceData.document.enabled ? 'var(--theme-primary)' : 'var(--theme-border)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: workspaceData.document?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)', color: workspaceData.document?.enabled ? 'var(--theme-on-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 20%, transparent)' }}>
                            <FileText size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-[var(--theme-text-primary)]">Document Writing</h4>
                            <p className="text-[10px]" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Students write about a specific topic in a document editor</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setWorkspaceData({ ...workspaceData, document: { ...workspaceData.document, enabled: !workspaceData.document?.enabled } })}
                          className={`w-12 h-6 rounded-full relative transition-colors`} style={{ backgroundColor: workspaceData.document?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)' }}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all`} style={{ backgroundColor: 'var(--theme-surface)', left: workspaceData.document?.enabled ? 'calc(100% - 20px)' : '4px' }} />
                        </button>
                      </div>
                      {workspaceData.document?.enabled && (
                        <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--theme-border)" }}>
                          <InputGroup label="Document Prompt">
                            <textarea 
                              value={workspaceData.document?.prompt || ''}
                              onChange={e => setWorkspaceData((prev: any) => ({ ...prev, document: { ...prev.document, prompt: e.target.value } }))}
                              placeholder="e.g. Write a 500-word analysis of the French Revolution's causes"
                              className={`${inputBaseStyle}`}
                              rows={2}
                              style={{
                                padding: '12px 16px',
                                width: '100%',
                                boxSizing: 'border-box',
                                background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
                                border: '1px  solid var(--theme-border)',
                                borderRadius: '10px',
                                color: 'var(--theme-text-primary)',
                                fontSize: '14px'
                              }}
                            />
                          </InputGroup>
                          <div className="flex items-center gap-3">
                            <label className="text-xs" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 60%, transparent)" }}>Min. Word Count (Optional)</label>
                            <input 
                              type="number"
                              value={workspaceData.document?.minWords || ''}
                              onChange={e => setWorkspaceData((prev: any) => ({ ...prev, document: { ...prev.document, minWords: parseInt(e.target.value) || 0 } }))}
                              className="w-20 rounded-lg px-2 py-1 text-xs" style={{ backgroundColor: "color-mix(in srgb, var(--theme-text-primary) 3%, transparent)", border: "1px solid var(--theme-border)", color: "var(--theme-text-primary)" }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`p-6 rounded-2xl border transition-all`} style={{ backgroundColor: workspaceData.database?.enabled ? 'color-mix(in srgb, var(--theme-primary) 5%, var(--theme-surface))' : 'color-mix(in srgb, var(--theme-text-primary) 3%, var(--theme-surface))', borderColor: workspaceData.database?.enabled ? 'var(--theme-primary)' : 'var(--theme-border)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: workspaceData.database?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)', color: workspaceData.database?.enabled ? 'var(--theme-on-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 20%, transparent)' }}>
                            <Database size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-[var(--theme-text-primary)]">Knowledge Base</h4>
                            <p className="text-[10px]" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Students add structured data entries to a database</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setWorkspaceData({ ...workspaceData, database: { ...workspaceData.database, enabled: !workspaceData.database?.enabled } })}
                          className={`w-12 h-6 rounded-full relative transition-colors`} style={{ backgroundColor: workspaceData.database?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)' }}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all`} style={{ backgroundColor: 'var(--theme-surface)', left: workspaceData.database?.enabled ? 'calc(100% - 20px)' : '4px' }} />
                        </button>
                      </div>
                      {workspaceData.database?.enabled && (
                        <div className="space-y-4 pt-4 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--theme-text-primary) 5%, transparent)" }}>
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 60%, transparent)" }}>Database Fields</label>
                            {workspaceData.database?.fields?.map((field: any, idx: number) => (
                              <div key={idx} className="flex gap-2">
                                <input 
                                  value={field.name}
                                  onChange={e => {
                                    setWorkspaceData((prev: any) => {
                                      const newFields = [...(prev.database?.fields || [])];
                                      newFields[idx] = { ...newFields[idx], name: e.target.value };
                                      return { ...prev, database: { ...prev.database, fields: newFields } };
                                    });
                                  }}
                                  placeholder="Field Name"
                                  className="flex-1"
                                  style={{ padding: '10px 14px', fontSize: '13px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '8px', color: 'var(--theme-text-primary)', boxSizing: 'border-box' }}
                                />
                                <select 
                                  value={field.type}
                                  onChange={e => {
                                    setWorkspaceData((prev: any) => {
                                      const newFields = [...(prev.database?.fields || [])];
                                      newFields[idx] = { ...newFields[idx], type: e.target.value };
                                      return { ...prev, database: { ...prev.database, fields: newFields } };
                                    });
                                  }}
                                  className="font-bold"
                                  style={{ padding: '10px 14px', fontSize: '13px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '8px', color: 'var(--theme-text-primary)', boxSizing: 'border-box' }}
                                >
                                  <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }}>Text</option>
                                  <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }}>Number</option>
                                  <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }}>Date</option>
                                  <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }}>Select</option>
                                </select>
                                <button onClick={() => {
                                  const newFields = (workspaceData.database?.fields || []).filter((_: any, i: number) => i !== idx);
                                  setWorkspaceData({ ...workspaceData, database: { ...workspaceData.database, fields: newFields } });
                                }} className="p-2 hover:text-red-400" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 20%, transparent)" }}><X size={14} /></button>
                              </div>
                            ))}
                            <button 
                              onClick={() => setWorkspaceData({ ...workspaceData, database: { ...workspaceData.database, fields: [...(workspaceData.database?.fields || []), { name: '', type: 'Text' }] } })}
                              className="text-left text-[10px] font-black uppercase tracking-widest hover:underline" style={{ color: "var(--theme-primary)" }}
                            >
                              + Add Field
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`p-6 rounded-2xl border transition-all`} style={{ backgroundColor: workspaceData.graph?.enabled ? 'color-mix(in srgb, var(--theme-primary) 5%, var(--theme-surface))' : 'color-mix(in srgb, var(--theme-text-primary) 3%, var(--theme-surface))', borderColor: workspaceData.graph?.enabled ? 'var(--theme-primary)' : 'var(--theme-border)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: workspaceData.graph?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)', color: workspaceData.graph?.enabled ? 'var(--theme-on-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 20%, transparent)' }}>
                            <BrainCircuit size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-[var(--theme-text-primary)]">Concept Graph</h4>
                            <p className="text-[10px]" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Students connect concepts and documents in a node graph</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setWorkspaceData({ ...workspaceData, graph: { ...workspaceData.graph, enabled: !workspaceData.graph?.enabled } })}
                          className={`w-12 h-6 rounded-full relative transition-colors`} style={{ backgroundColor: workspaceData.graph?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)' }}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all`} style={{ backgroundColor: 'var(--theme-surface)', left: workspaceData.graph?.enabled ? 'calc(100% - 20px)' : '4px' }} />
                        </button>
                      </div>
                      {workspaceData.graph?.enabled && (
                        <div className="space-y-4 pt-4 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--theme-text-primary) 5%, transparent)" }}>
                          <InputGroup label="Graph Prompt">
                            <textarea 
                              value={workspaceData.graph?.prompt || ''}
                              onChange={e => setWorkspaceData((prev: any) => ({ ...prev, graph: { ...prev.graph, prompt: e.target.value } }))}
                              placeholder="e.g. Connect at least 5 concepts related to the French Revolution"
                              className={`${inputBaseStyle}`}
                              rows={2}
                              style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '10px', color: 'var(--theme-text-primary)', fontSize: '14px' }}
                            />
                          </InputGroup>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="flex flex-col gap-2">
                               <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Min. Nodes</label>
                               <input 
                                 type="number"
                                 value={workspaceData.graph?.minNodes || ''}
                                 onChange={e => setWorkspaceData((prev: any) => ({ ...prev, graph: { ...prev.graph, minNodes: parseInt(e.target.value) || 0 } }))}
                                 className=""
                                 style={{ padding: '10px 14px', fontSize: '14px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '8px', color: 'var(--theme-text-primary)', width: '100%', boxSizing: 'border-box' }}
                               />
                             </div>
                             <div className="flex flex-col gap-2">
                               <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Min. Edges</label>
                               <input 
                                 type="number"
                                 value={workspaceData.graph?.minConnections || ''}
                                 onChange={e => setWorkspaceData((prev: any) => ({ ...prev, graph: { ...prev.graph, minConnections: parseInt(e.target.value) || 0 } }))}
                                 className=""
                                 style={{ padding: '10px 14px', fontSize: '14px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '8px', color: 'var(--theme-text-primary)', width: '100%', boxSizing: 'border-box' }}
                               />
                             </div>
                           </div>
                        </div>
                      )}
                    </div>

                    <div className={`p-6 rounded-2xl border transition-all`} style={{ backgroundColor: workspaceData.canvas?.enabled ? 'color-mix(in srgb, var(--theme-primary) 5%, var(--theme-surface))' : 'color-mix(in srgb, var(--theme-text-primary) 3%, var(--theme-surface))', borderColor: workspaceData.canvas?.enabled ? 'var(--theme-primary)' : 'var(--theme-border)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: workspaceData.canvas?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)', color: workspaceData.canvas?.enabled ? 'var(--theme-on-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 20%, transparent)' }}>
                            <Palette size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-[var(--theme-text-primary)]">Canvas Board</h4>
                            <p className="text-[10px]" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Students add boxes, images, and sticky notes to a canvas</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setWorkspaceData({ ...workspaceData, canvas: { ...workspaceData.canvas, enabled: !workspaceData.canvas?.enabled } })}
                          className={`w-12 h-6 rounded-full relative transition-colors`} style={{ backgroundColor: workspaceData.canvas?.enabled ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)' }}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all`} style={{ backgroundColor: 'var(--theme-surface)', left: workspaceData.canvas?.enabled ? 'calc(100% - 20px)' : '4px' }} />
                        </button>
                      </div>
                      {workspaceData.canvas?.enabled && (
                        <div className="space-y-4 pt-4 border-t" style={{ borderTopColor: "color-mix(in srgb, var(--theme-text-primary) 5%, transparent)" }}>
                          <InputGroup label="Canvas Prompt">
                            <textarea 
                              value={workspaceData.canvas?.prompt || ''}
                              onChange={e => setWorkspaceData((prev: any) => ({ ...prev, canvas: { ...prev.canvas, prompt: e.target.value } }))}
                              placeholder="e.g. Create a visual timeline of key events"
                              className={`${inputBaseStyle}`}
                              rows={2}
                              style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '10px', color: 'var(--theme-text-primary)', fontSize: '14px' }}
                            />
                          </InputGroup>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Required Elements</label>
                            <div className="flex flex-wrap gap-2">
                              {['Text Box', 'Image', 'Sticky Note', 'Shape'].map(el => (
                                <button
                                  key={el}
                                  onClick={() => {
                                    const current = workspaceData.canvas?.requiredElements || [];
                                    const next = current.includes(el) ? current.filter((c: string) => c !== el) : [...current, el];
                                    setWorkspaceData({ ...workspaceData, canvas: { ...workspaceData.canvas, requiredElements: next } });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all`} style={{
                                    backgroundColor: (workspaceData.canvas?.requiredElements || []).includes(el) ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 3%, transparent)',
                                    borderColor: (workspaceData.canvas?.requiredElements || []).includes(el) ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 8%, transparent)',
                                    color: (workspaceData.canvas?.requiredElements || []).includes(el) ? 'var(--theme-text-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 40%, transparent)'
                                  }}
                                >
                                  {el}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep.id === 'settings' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-2xl font-black text-[var(--theme-text-primary)]">Settings & XP</h2>
                <p className="text-sm" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Configure timing, rewards, and difficulty levels.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="XP Rewards" icon={Target}>
                  <input 
                    key="activity-points-input"
                    type="number" 
                    value={points} 
                    onChange={e => setPoints(parseInt(e.target.value) || 0)} 
                    className={inputBaseStyle}
                    style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '10px', color: 'var(--theme-text-primary)', fontSize: '14px' }}
                  />
                </InputGroup>
                <InputGroup label="Difficulty Level" icon={Zap}>
                  <select 
                    value={difficulty} 
                    onChange={e => setDifficulty(e.target.value as any)} 
                    className={`${inputBaseStyle} appearance-none cursor-pointer`}
                    style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '10px', color: 'var(--theme-text-primary)', fontSize: '14px' }}
                  >
                    <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }} value="easy">Beginner (Level 1)</option>
                    <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }} value="medium">Intermediate (Level 2)</option>
                    <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }} value="hard">Expert (Level 3)</option>
                  </select>
                </InputGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Duration (Minutes)" icon={Clock}>
                  <input 
                    key="activity-duration-input"
                    type="number" 
                    value={durationMin} 
                    onChange={e => setDurationMin(parseInt(e.target.value) || 1)} 
                    className={inputBaseStyle}
                    style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '10px', color: 'var(--theme-text-primary)', fontSize: '14px' }}
                  />
                </InputGroup>
                <InputGroup label="On Timeout" icon={Settings}>
                  <select 
                    value={onTimeout} 
                    onChange={e => setOnTimeout(e.target.value)} 
                    className={`${inputBaseStyle} appearance-none cursor-pointer`}
                    style={{ padding: '12px 16px', width: '100%', boxSizing: 'border-box', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', borderRadius: '10px', color: 'var(--theme-text-primary)', fontSize: '14px' }}
                  >
                    <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }} value="auto_submit">Auto Submit Work</option>
                    <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }} value="allow_retry">Allow Retry Session</option>
                    <option style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-primary)' }} value="mark_failed">Mark as Incomplete</option>
                  </select>
                </InputGroup>
              </div>

              {type === 'workspace' && (
                 <div className="p-6 rounded-2xl" style={{ backgroundColor: "color-mix(in srgb, var(--theme-primary) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--theme-primary) 20%, transparent)" }}>
                    <div className="flex items-center gap-3 mb-2" style={{ color: "var(--theme-primary)" }}>
                      <Info size={18} />
                      <h4 className="text-sm font-black uppercase tracking-widest">Workspace Mode</h4>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 60%, transparent)" }}>
                      In Workspace mode, students will have access to the components you enabled. 
                      Their work is automatically saved and can be reviewed in real-time.
                    </p>
                 </div>
              )}

              {/* Show Answers After Completion toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px  solid var(--theme-border)' }}>
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--theme-text-primary)', margin: 0 }}>Show Answers After Completion</p>
                  <p style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', margin: '4px 0 0' }}>Students can review correct answers after submitting</p>
                </div>
                <button 
                  onClick={() => setShowAnswers(!showAnswers)}
                  className={`w-12 h-6 rounded-full relative transition-colors`} style={{ backgroundColor: showAnswers ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)' }}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all`} style={{ backgroundColor: 'var(--theme-surface)', left: showAnswers ? 'calc(100% - 20px)' : '4px' }} />
                </button>
              </div>

              {/* Visibility radio */}
              <div style={{ marginTop: '10px' }}>
                <p style={{ fontWeight: 600, color: 'var(--theme-text-primary)', marginBottom: '12px' }}>Visibility</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setVisibility('draft')} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: `2px solid ${visibility === 'draft' ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)'}`, background: visibility === 'draft' ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 2%, transparent)', textAlign: 'left', cursor: 'pointer' }}>
                    <p style={{ fontWeight: 600, color: 'var(--theme-text-primary)', margin: '0 0 4px 0' }}>Draft</p>
                    <p style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', margin: 0 }}>Only you can see this</p>
                  </button>
                  <button onClick={() => setVisibility('published')} style={{ flex: 1, padding: '16px', borderRadius: '12px', border: `2px solid ${visibility === 'published' ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)'}`, background: visibility === 'published' ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 2%, transparent)', textAlign: 'left', cursor: 'pointer' }}>
                    <p style={{ fontWeight: 600, color: 'var(--theme-text-primary)', margin: '0 0 4px 0' }}>Published</p>
                    <p style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', margin: 0 }}>Visible to all students</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep.id === 'review' && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1 mb-2">
                <h2 className="text-2xl font-black text-[var(--theme-text-primary)]">Review & Publish</h2>
                <p className="text-sm" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}>Double check everything before going live.</p>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Activity Info', data: `${title} • ${type} • ${estimatedTime}`, step: 0 },
                  { label: 'Content', data: `${type === 'quiz' ? quizQuestions.length : type === 'workspace' ? Object.values(workspaceData).filter((v:any)=>v.enabled).length : 1} items configured`, step: 1 },
                  { label: 'Rules', data: `${points} XP • ${durationMin}m • ${difficulty}`, step: 2 },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '12px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`, border: '1px  solid var(--theme-border)' }}>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 30%, transparent)" }}>{row.label}</h4>
                      <p className="text-sm font-medium" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 80%, transparent)", marginTop: '4px' }}>{row.data}</p>
                    </div>
                    <button onClick={() => setCurrentStepIdx(row.step)} className="text-xs font-bold hover:underline" style={{ color: "var(--theme-primary)", padding: '6px 10px', flexShrink: 0 }}>Edit</button>
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  {successMsg}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between" style={{ padding: '12px 32px', borderTop: '1px  solid var(--theme-border)' }}>
        <button 
          onClick={currentStepIdx === 0 ? onCancel : handleBack}
          className="flex items-center gap-2 px-6 py-3 rounded-xl transition-colors font-bold text-sm" style={{ color: "color-mix(in srgb, var(--theme-text-primary) 40%, transparent)" }}
        >
          <ChevronLeft size={18} />
          {currentStepIdx === 0 ? 'Cancel' : 'Back'}
        </button>

        <div className="flex gap-4">
          {currentStepIdx < STEPS.length - 1 ? (
            <button 
              onClick={handleNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 28px',
                borderRadius: '16px',
                background: 'var(--theme-primary)',
                color: 'var(--theme-text-primary)',
                fontWeight: 900,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 10px 30px color-mix(in srgb, var(--theme-primary) 30%, transparent)',
                transition: 'all 0.2s ease',
                lineHeight: '1',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 15px 40px color-mix(in srgb, var(--theme-primary) 40%, transparent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 30px color-mix(in srgb, var(--theme-primary) 30%, transparent)'; }}
            >
              Continue
              <ChevronRight size={18} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => handleSave('draft')}
                disabled={saving}
                style={{ padding: '14px 28px', borderRadius: '12px', background: 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)', fontWeight: 600, cursor: 'pointer' }}
                className="transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button 
                onClick={() => handleSave('published')}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                  color: 'var(--theme-text-primary)',
                  fontWeight: 900,
                  fontSize: '14px',
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 30px color-mix(in srgb, var(--theme-primary) 30%, transparent)',
                  transition: 'all 0.2s ease',
                  lineHeight: '1',
                  opacity: saving ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!saving) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 15px 40px color-mix(in srgb, var(--theme-primary) 40%, transparent)'; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 30px color-mix(in srgb, var(--theme-primary) 30%, transparent)'; }}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {initialData ? 'Update Activity' : 'Publish Activity'}
              </button>
            </div>
          ) }
        </div>
      </div>
    </div>
  );
};
