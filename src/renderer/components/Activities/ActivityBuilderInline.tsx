import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Check, RefreshCw, Loader2, SkipForward, Ban, Zap, Clock, Target, BookOpen, Trash2, PenTool } from 'lucide-react';
import { collection, getDocs, addDoc, getDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebase';
import { ActivityService, Activity } from '../../services/activity';
import { chatWithActivityAgent, ActivitySchema } from '../../services/groq';
import { ManualActivityForm } from './ManualActivityForm';
import { OverlapConfirmationModal } from './OverlapConfirmationModal';

interface ActivityBuilderInlineProps {
  projectId: string;
}

interface GeneratedActivity {
  id: string;
  activity: ActivitySchema;
  status: 'preview' | 'saving' | 'saved';
}

type BuilderMode = 'ai' | 'manual';

export const ActivityBuilderInline: React.FC<ActivityBuilderInlineProps> = ({ projectId }) => {
  const { state: { user } } = useAuth();
  
  const [mode, setMode] = useState<BuilderMode>('ai');

  // AI Form inputs
  const [numActivities, setNumActivities] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [topic, setTopic] = useState('');
  const [activityTypes, setActivityTypes] = useState<string[]>(['document', 'folder', 'canvas']);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedActivities, setGeneratedActivities] = useState<GeneratedActivity[]>([]);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [existingCount, setExistingCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState<{ 
    isOpen: boolean, 
    type: 'single' | 'all', 
    activity?: GeneratedActivity, 
    index?: number 
  }>({ isOpen: false, type: 'all' });
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;
    const db = FirebaseService.getInstance().db;
    getDocs(collection(db, `notes/${projectId}/activities`)).then(snap => {
      setExistingCount(snap.size);
    });
  }, [projectId, successMessage]);

  const toggleActivityType = (type: string) => {
    setActivityTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const resetAIForm = () => {
    setTopic(''); setNumActivities(3); setDurationMinutes(5);
    setDifficulty('medium'); setAdditionalNotes('');
    setActivityTypes(['document', 'folder', 'canvas']);
    setGeneratedActivities([]); setError(null); setSuccessMessage(null);
    setStatusMessage(null);
  };

  const durationSeconds = durationMinutes * 60;

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) { setError('Please enter a topic or description for the activities.'); return; }
    if (activityTypes.length === 0) { setError('Please select at least one activity type.'); return; }

    setError(null); setSuccessMessage(null); setIsGenerating(true); setStatusMessage(null);
    setGeneratedActivities([]); setGenerationProgress({ current: 0, total: numActivities });

    const typeStr = activityTypes.join(', ');
    try {
      const results: GeneratedActivity[] = [];
      for (let i = 1; i <= numActivities; i++) {
        setGenerationProgress({ current: i, total: numActivities });
        const prompt = `Generate activity ${i} of ${numActivities} for a learning project about: "${topic}".
${i > 1 ? `Previous activities generated: ${results.map(r => r.activity.title).join(', ')}. Make this activity build on previous ones and be progressively more challenging.` : ''}
Requirements:
- IMPORTANT: The student starts with a COMPLETELY BLANK workspace. There are NO pre-existing files, folders, documents, or data.
- Activity 1 MUST only ask the student to CREATE something new (a folder, a document, etc.). 
- Each subsequent activity can ONLY reference items that were created in PREVIOUS activities.
- NEVER ask the student to open, connect, or use something that hasn't been explicitly created in an earlier activity.
- Activity types to use: ${typeStr}
- Duration per activity: ${durationMinutes} minutes (${durationSeconds} seconds)
- Difficulty: ${difficulty}
- This is activity ${i} of ${numActivities} in a sequential learning path.
- "instructions" array MUST contain clear, step-by-step bullet points for the student to follow.
${additionalNotes ? `- Additional notes: ${additionalNotes}` : ''}

IMPORTANT: Return ONLY a valid JSON object with EXACTLY this schema:
{
  "title": "string",
  "description": "string",
  "difficulty": "easy|medium|hard",
  "workspace_zone": "document|canvas|base|folder",
  "instructions": ["string array of bullet points describing what the student must do in detail"],
  "timer_config": {"duration_seconds": ${durationSeconds}, "on_timeout": "auto_submit", "grace_period_seconds": 30, "max_retries": 1},
  "points": 10,
  "tags": ["string"]
}`;

        const history = [{ role: 'user' as const, content: prompt }];
        
        const responseContent = await chatWithActivityAgent(
          history, 
          'admin', 
          (msg) => setStatusMessage(msg)
        );
        
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as ActivitySchema;
          results.push({ id: `gen-${Date.now()}-${i}`, activity: parsed, status: 'preview' });
          setGeneratedActivities([...results]);
          setStatusMessage(null); // Clear retry status on success
        }
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
    } catch (err: any) {
      console.error('[ActivityBuilder] Generation error:', err);
      setError("Generation is taking longer than usual, please wait...");
    } finally {
      setIsGenerating(false);
      setStatusMessage(null);
    }
  }, [topic, numActivities, durationMinutes, durationSeconds, activityTypes, difficulty, additionalNotes]);

  const handleSaveActivity = async (genActivity: GeneratedActivity, index: number, isConfirmed = false, mode: 'add' | 'replace' = 'add') => {
    if (genActivity.status === 'saved' || genActivity.status === 'saving') return;
    
    if (!isConfirmed && existingCount > 0) {
      setShowConfirm({ isOpen: true, type: 'single', activity: genActivity, index });
      return;
    }

    setShowConfirm({ isOpen: false, type: 'all' });
    setGeneratedActivities(prev => prev.map(g => g.id === genActivity.id ? { ...g, status: 'saving' } : g));
    
    try {
      const db = FirebaseService.getInstance().db;

      if (mode === 'replace') {
        await ActivityService.getInstance().clearExistingActivitiesAndWorkspaces(projectId);
      }

      const activitiesRef = collection(db, 'notes', projectId, 'activities');
      // Re-fetch count if replaced
      const snap = await getDocs(activitiesRef);
      const sequenceNumber = snap.size + 1;

      const activityData = {
        title: genActivity.activity.title || 'Untitled Activity',
        description: genActivity.activity.description || '',
        difficulty: genActivity.activity.difficulty || 'medium',
        workspace_zone: genActivity.activity.workspace_zone || 'document',
        instructions: genActivity.activity.instructions || ['Follow the activity details.'],
        timer_config: {
          duration_seconds: genActivity.activity.timer_config?.duration_seconds || durationSeconds,
          on_timeout: genActivity.activity.timer_config?.on_timeout || 'auto_submit',
          grace_period_seconds: genActivity.activity.timer_config?.grace_period_seconds || 30,
          max_retries: genActivity.activity.timer_config?.max_retries || 1
        },
        points: genActivity.activity.points || 10,
        tags: genActivity.activity.tags || [],
        sequenceNumber, createdAt: serverTimestamp(), assignedBy: 'ai', status: 'active'
      };
      await addDoc(activitiesRef, activityData);
      setGeneratedActivities(prev => prev.map(g => g.id === genActivity.id ? { ...g, status: 'saved' } : g));
      window.dispatchEvent(new CustomEvent('activity-list-updated', { detail: { projectId } }));
      
      if (mode === 'replace') {
        setSuccessMessage("Activities replaced and student workspaces cleared successfully");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
      setGeneratedActivities(prev => prev.map(g => g.id === genActivity.id ? { ...g, status: 'preview' } : g));
    }
  };

  const handleSaveAll = async (isConfirmed = false, mode: 'add' | 'replace' = 'add') => {
    const unsaved = generatedActivities.filter(g => g.status === 'preview');
    if (unsaved.length === 0) return;

    if (!isConfirmed && existingCount > 0) {
      setShowConfirm({ isOpen: true, type: 'all' });
      return;
    }

    setShowConfirm({ isOpen: false, type: 'all' });

    try {
      if (mode === 'replace') {
        await ActivityService.getInstance().clearExistingActivitiesAndWorkspaces(projectId);
      }

      for (let i = 0; i < unsaved.length; i++) { 
        // Call individual save with isConfirmed=true and 'add' mode since we already cleared if needed
        await handleSaveActivity(unsaved[i], i, true, 'add'); 
      }
      
      setSuccessMessage(mode === 'replace' ? "Activities replaced and student workspaces cleared successfully" : `${unsaved.length} activities saved to project!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(`Bulk save failed: ${err.message}`);
    }
  };

  const handleRemoveGenerated = (id: string) => {
    setGeneratedActivities(prev => prev.filter(g => g.id !== id));
  };

  const typeOptions = [
    { value: 'document', label: 'Document', icon: '📝' },
    { value: 'folder', label: 'Folder', icon: '📁' },
    { value: 'canvas', label: 'Canvas', icon: '🎨' },
    { value: 'base', label: 'Base/Table', icon: '📊' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '32px 48px', background: 'transparent' }}>
      {/* Confirmation Modal for AI Driven Mode */}
      <OverlapConfirmationModal 
        isOpen={showConfirm.isOpen}
        existingCount={existingCount}
        newCount={showConfirm.type === 'single' ? 1 : generatedActivities.filter(g => g.status === 'preview').length}
        onProceed={(mode) => {
          if (showConfirm.type === 'single' && showConfirm.activity) {
            handleSaveActivity(showConfirm.activity, showConfirm.index || 0, true, mode);
          } else {
            handleSaveAll(true, mode);
          }
        }}
        onCancel={() => setShowConfirm({ isOpen: false, type: 'all' })}
      />

      {/* Header */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <Sparkles size={22} color="#7c6bf0" />
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Activity Builder</span>
        </div>
        <div style={{ fontSize: 13, color: '#6b6f82' }}>
          {mode === 'ai' ? 'Configure your requirements below. The AI will generate activities with triggers stored in Firestore.' : 'Manually create a single activity with custom steps, triggers, and timing.'}
        </div>
        {existingCount > 0 && (
          <div style={{ fontSize: 12, color: '#7c6bf0', marginTop: 6 }}>
            {existingCount} activit{existingCount === 1 ? 'y' : 'ies'} already in this project
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div style={{ maxWidth: 600, width: '100%', margin: '0 auto 24px', display: 'flex', background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setMode('ai')} style={{
          flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
          background: mode === 'ai' ? 'rgba(124,107,240,0.15)' : 'transparent',
          color: mode === 'ai' ? '#c4b5fd' : '#6b6f82',
          boxShadow: mode === 'ai' ? '0 2px 8px rgba(124,107,240,0.15)' : 'none',
        }}>
          <Sparkles size={15} /> AI Driven
        </button>
        <button onClick={() => setMode('manual')} style={{
          flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s',
          background: mode === 'manual' ? 'rgba(124,107,240,0.15)' : 'transparent',
          color: mode === 'manual' ? '#c4b5fd' : '#6b6f82',
          boxShadow: mode === 'manual' ? '0 2px 8px rgba(124,107,240,0.15)' : 'none',
        }}>
          <PenTool size={15} /> Manual
        </button>
      </div>

      {/* Form Area */}
      <div style={{ maxWidth: 600, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {mode === 'manual' ? (
          <ManualActivityForm 
            projectId={projectId} 
            existingCount={existingCount}
            initialData={editingActivity}
            onCancel={() => {
              setEditingActivity(null);
              setMode('ai');
            }} 
            onSaved={() => {
              const db = FirebaseService.getInstance().db;
              getDocs(collection(db, `notes/${projectId}/activities`)).then(snap => setExistingCount(snap.size));
              setEditingActivity(null);
              setMode('ai');
            }} 
          />
        ) : (
          <>
            {/* Topic */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6, display: 'block' }}>
                <BookOpen size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Topic / Description
              </label>
              <textarea value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g., Introduction to the French Revolution — students should explore key events, figures, and causes..."
                style={{ width: '100%', minHeight: 80, padding: '10px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e8eaf0', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = 'rgba(124,107,240,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            {/* Row: Number + Duration + Difficulty */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6, display: 'block' }}>
                  <Target size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Number of Activities
                </label>
                <input type="number" min={1} max={10} value={numActivities}
                  onChange={e => setNumActivities(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e8eaf0', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6, display: 'block' }}>
                  <Clock size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Duration (minutes)
                </label>
                <input type="number" min={1} max={60} step={1} value={durationMinutes}
                  onChange={e => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 5))}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e8eaf0', fontSize: 14, outline: 'none' }}
                />
                <div style={{ fontSize: 11, color: '#6b6f82', marginTop: 3 }}>{durationMinutes} minute{durationMinutes !== 1 ? 's' : ''} per activity</div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6, display: 'block' }}>
                  <Zap size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> Difficulty
                </label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e8eaf0', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
                  <option value="easy">Beginner</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Activity Types */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 8, display: 'block' }}>Activity Types (workspace zones)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {typeOptions.map(opt => (
                  <button key={opt.value} onClick={() => toggleActivityType(opt.value)}
                    style={{ padding: '8px 16px', background: activityTypes.includes(opt.value) ? 'rgba(124,107,240,0.15)' : 'rgba(0,0,0,0.2)', border: activityTypes.includes(opt.value) ? '1px solid rgba(124,107,240,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 8, color: activityTypes.includes(opt.value) ? '#c4b5fd' : '#6b6f82', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                    <span>{opt.icon}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6, display: 'block' }}>
                Additional Notes <span style={{ fontWeight: 400, color: '#6b6f82' }}>(optional)</span>
              </label>
              <input type="text" value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)}
                placeholder="e.g., Focus on cause-and-effect relationships, include a timeline activity..."
                style={{ width: '100%', padding: '8px 14px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#e8eaf0', fontSize: 13, outline: 'none' }}
              />
            </div>

            {/* Status / Error / Success */}
            {statusMessage && (
              <div style={{ padding: '10px 14px', background: 'rgba(124,107,240,0.05)', border: '1px solid rgba(124,107,240,0.15)', borderRadius: 8, color: '#9485f5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {statusMessage}
              </div>
            )}
            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(230,107,122,0.1)', border: '1px solid rgba(230,107,122,0.2)', borderRadius: 8, color: '#e66b7a', fontSize: 13 }}>{error}</div>
            )}
            {successMessage && (
              <div style={{ padding: '10px 14px', background: 'rgba(109,212,158,0.1)', border: '1px solid rgba(109,212,158,0.2)', borderRadius: 8, color: '#6dd49e', fontSize: 13 }}>✓ {successMessage}</div>
            )}

            {/* Generate + Cancel Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleGenerate} disabled={isGenerating} style={{
                flex: 1, padding: '12px 24px',
                background: isGenerating ? 'rgba(124,107,240,0.3)' : 'linear-gradient(135deg, #7c6bf0, #6558d4)',
                border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', boxShadow: isGenerating ? 'none' : '0 4px 20px rgba(124,107,240,0.3)'
              }}>
                {isGenerating ? (
                  <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> {statusMessage ? 'Retrying...' : `Generating ${generationProgress.current} of ${generationProgress.total}...`}</>
                ) : (
                  <><Sparkles size={18} /> Generate {numActivities} Activit{numActivities === 1 ? 'y' : 'ies'}</>
                )}
              </button>
              <button onClick={resetAIForm} style={{
                padding: '12px 24px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                color: '#a0a4b8', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              }}>Cancel</button>
            </div>
          </>
        )}
      </div>

      {/* Generated Activities Preview (AI mode only) */}
      {mode === 'ai' && generatedActivities.length > 0 && (
        <div ref={resultRef} style={{ maxWidth: 600, width: '100%', margin: '32px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
              Generated Activities ({generatedActivities.filter(g => g.status === 'saved').length}/{generatedActivities.length} saved)
            </div>
            {generatedActivities.some(g => g.status === 'preview') && (
              <button onClick={() => handleSaveAll()} style={{ padding: '6px 16px', background: 'rgba(109,212,158,0.12)', border: '1px solid rgba(109,212,158,0.3)', borderRadius: 6, color: '#6dd49e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Check size={12} style={{ marginRight: 4, verticalAlign: -1 }} /> Save All to Project
              </button>
            )}
          </div>
          {generatedActivities.map((gen, idx) => (
            <div key={gen.id} style={{ background: gen.status === 'saved' ? 'rgba(109,212,158,0.04)' : 'rgba(255,255,255,0.02)', border: gen.status === 'saved' ? '1px solid rgba(109,212,158,0.15)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 20px', marginBottom: 10, transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: gen.status === 'saved' ? '#6dd49e' : 'rgba(124,107,240,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {gen.status === 'saved' ? <Check size={12} /> : idx + 1}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{gen.activity.title}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {gen.status === 'preview' && (
                    <>
                      <button 
                        onClick={() => {
                          const activity = gen.activity;
                          const mapped: Activity = {
                            id: gen.id,
                            title: activity.title || '',
                            description: activity.description || '',
                            sequenceNumber: 0,
                            points: activity.points || 10,
                            timer_config: {
                              duration_seconds: activity.timer_config?.duration_seconds || durationSeconds,
                              grace_period_seconds: activity.timer_config?.grace_period_seconds || 30,
                              max_retries: activity.timer_config?.max_retries || 1,
                              on_timeout: activity.timer_config?.on_timeout || 'auto_submit'
                            },
                            instructions: activity.instructions || [],
                            tags: activity.tags || []
                          };
                          setEditingActivity(mapped);
                          setMode('manual');
                        }} 
                        style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#6b6f82', fontSize: 11, cursor: 'pointer' }}
                        title="Edit Activity"
                      >
                        <PenTool size={10} />
                      </button>
                      <button onClick={() => handleSaveActivity(gen, idx)} style={{ padding: '4px 12px', background: 'rgba(109,212,158,0.12)', border: '1px solid rgba(109,212,158,0.3)', borderRadius: 6, color: '#6dd49e', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        <Check size={10} style={{ marginRight: 3 }} /> Save
                      </button>
                      <button onClick={() => handleRemoveGenerated(gen.id)} style={{ padding: '4px 8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#6b6f82', fontSize: 11, cursor: 'pointer' }}>
                        <Trash2 size={10} />
                      </button>
                    </>
                  )}
                  {gen.status === 'saving' && (<span style={{ fontSize: 11, color: '#7c6bf0', display: 'flex', alignItems: 'center', gap: 4 }}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</span>)}
                  {gen.status === 'saved' && (<span style={{ fontSize: 11, color: '#6dd49e', fontWeight: 600 }}>✓ Saved</span>)}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#8b8fa3', lineHeight: 1.5, marginBottom: 8 }}>{gen.activity.description}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(124,107,240,0.1)', color: '#9485f5' }}>{gen.activity.workspace_zone}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(78,161,247,0.1)', color: '#4ea1f7' }}>{gen.activity.difficulty}</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(109,212,158,0.1)', color: '#6dd49e' }}>{gen.activity.points || 10} pts</span>
                {gen.activity.instructions?.length > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: '#6b6f82' }}>{gen.activity.instructions.length} instruction{gen.activity.instructions.length > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
