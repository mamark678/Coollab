import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Clock, Zap, Save, Loader2, Tag, Target, FileText, Folder, Palette, Database } from 'lucide-react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { FirebaseService } from '../../services/firebase';
import { ActivityService, Activity } from '../../services/activity';
import { OverlapConfirmationModal } from './OverlapConfirmationModal';

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

const ZONE_OPTIONS = [
  { value: 'document', label: 'Document', icon: <FileText size={14} /> },
  { value: 'folder', label: 'Folder', icon: <Folder size={14} /> },
  { value: 'canvas', label: 'Canvas', icon: <Palette size={14} /> },
  { value: 'base', label: 'Base/Table', icon: <Database size={14} /> },
];

const TIMEOUT_OPTIONS = [
  { value: 'mark_failed', label: 'Mark as Failed' },
  { value: 'allow_retry', label: 'Allow Retry' },
  { value: 'auto_submit', label: 'Auto Submit' },
  { value: 'grace_period', label: 'Grace Period' },
];

function autoSuggestCriteria(zone: string, steps: StepRow[]) {
  return {};
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, color: '#e8eaf0', fontSize: 13, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#e8eaf0', marginBottom: 6, display: 'block',
};

export const ManualActivityForm: React.FC<ManualActivityFormProps> = ({ projectId, existingCount, onCancel, onSaved, initialData }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>((initialData as any)?.difficulty || 'medium');
  const [zone, setZone] = useState((initialData as any)?.workspace_zone || 'document');
  const [steps, setSteps] = useState<StepRow[]>(
    initialData?.instructions?.map((inst: string, i: number) => ({ id: `step-${i}`, instruction: inst })) || 
    [{ id: 'step-1', instruction: '' }]
  );
  const [durationMin, setDurationMin] = useState(initialData?.timer_config?.duration_seconds ? Math.floor(initialData.timer_config.duration_seconds / 60) : 5);
  const [onTimeout, setOnTimeout] = useState(initialData?.timer_config?.on_timeout || 'auto_submit');
  const [maxRetries, setMaxRetries] = useState(initialData?.timer_config?.max_retries || 1);
  const [gracePeriodMin, setGracePeriodMin] = useState(initialData?.timer_config?.grace_period_seconds ? Math.floor(initialData.timer_config.grace_period_seconds / 60) : 1);
  const [points, setPoints] = useState(initialData?.points || 10);
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Removed auto-suggest criteria

  // Pre-fill when initialData changes (e.g. user clicks edit on a different card)
  useEffect(() => {
    if (!initialData) return;
    setTitle(initialData.title || '');
    setDescription(initialData.description || '');
    setDifficulty((initialData as any).difficulty || 'medium');
    setZone((initialData as any).workspace_zone || 'document');
    setSteps(initialData.instructions?.map((inst: string, i: number) => ({ id: `step-${i}-${Date.now()}`, instruction: inst })) || [{ id: 'step-1', instruction: '' }]);
    setDurationMin(initialData.timer_config?.duration_seconds ? Math.floor(initialData.timer_config.duration_seconds / 60) : 5);
    setOnTimeout(initialData.timer_config?.on_timeout || 'auto_submit');
    setMaxRetries(initialData.timer_config?.max_retries || 1);
    setGracePeriodMin(initialData.timer_config?.grace_period_seconds ? Math.floor(initialData.timer_config.grace_period_seconds / 60) : 1);
    setPoints(initialData.points || 10);
    setTags(initialData.tags?.join(', ') || '');
  }, [initialData]);

  const addStep = () => {
    setSteps(prev => [...prev, { id: `step-${Date.now()}`, instruction: '' }]);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const updateStep = (id: string, field: 'instruction', value: string) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDifficulty('medium'); setZone('document');
    setSteps([{ id: 'step-1', instruction: '' }]);
    setDurationMin(5); setOnTimeout('auto_submit'); setMaxRetries(1);
    setGracePeriodMin(1); setPoints(10); setTags('');
    setError(null);
  };

  const handleSave = useCallback(async (isConfirmed = false, mode: 'add' | 'replace' = 'add') => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (steps.some(s => !s.instruction.trim())) { setError('All steps must have an instruction.'); return; }

    // Confirmation logic only applies to NEW activities, not EDITS
    if (!initialData && !isConfirmed && existingCount > 0) {
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    setError(null);
    setSaving(true);
    try {
      const db = FirebaseService.getInstance().db;
      const { doc, updateDoc, addDoc, serverTimestamp } = await import('firebase/firestore');

      if (mode === 'replace' && !initialData) {
        await ActivityService.getInstance().clearExistingActivitiesAndWorkspaces(projectId);
      }

      const activitiesRef = collection(db, 'notes', projectId, 'activities');
      
      const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean);

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
        updatedAt: serverTimestamp(),
      };

      if (initialData && !initialData.id.startsWith('gen-')) {
        // UPDATE EXISTING
        const activityRef = doc(db, `notes/${projectId}/activities`, initialData.id);
        await updateDoc(activityRef, activityData);
        setSuccessMsg('Activity updated successfully!');
      } else {
        // CREATE NEW (or saving a preview activity)
        // Re-fetch count if replaced
        const currentSnap = await getDocs(activitiesRef);
        const sequenceNumber = currentSnap.size + 1;
        
        activityData.sequenceNumber = sequenceNumber;
        activityData.assignedBy = initialData?.id.startsWith('gen-') ? 'ai' : 'manual';
        activityData.status = 'active';
        activityData.createdAt = serverTimestamp();
        
        await addDoc(activitiesRef, activityData);
        setSuccessMsg(mode === 'replace' ? 'Activities replaced and student workspaces cleared successfully' : 'Activity saved successfully!');
      }

      window.dispatchEvent(new CustomEvent('activity-list-updated', { detail: { projectId } }));
      if (!initialData) resetForm();
      setTimeout(() => { setSuccessMsg(null); onSaved(); }, 2000);
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [title, description, difficulty, zone, steps, durationMin, onTimeout, maxRetries, gracePeriodMin, points, tags, projectId, onSaved, existingCount, initialData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <OverlapConfirmationModal 
        isOpen={showConfirm}
        existingCount={existingCount}
        newCount={1}
        onProceed={(mode) => handleSave(true, mode)}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Title */}
      <div>
        <label style={labelStyle}>Title <span style={{ color: '#e66b7a' }}>*</span></label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Create Unit 1 Folder" style={inputStyle} />
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: '#6b6f82' }}>(optional)</span></label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this activity is about..." rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 50 }} />
      </div>

      {/* Difficulty + Zone row */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}><Zap size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Difficulty</label>
          <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="easy">Beginner</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Workspace Zone</label>
          <select value={zone} onChange={e => setZone(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {ZONE_OPTIONS.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </div>
      </div>

      {/* Steps */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Steps</label>
          <button onClick={addStep} style={{ padding: '4px 12px', background: 'rgba(124,107,240,0.12)', border: '1px solid rgba(124,107,240,0.3)', borderRadius: 6, color: '#c4b5fd', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={12} /> Add Step
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((step, idx) => (
            <div key={step.id} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#7c6bf0', background: 'rgba(124,107,240,0.12)', padding: '2px 8px', borderRadius: 4 }}>Step {idx + 1}</span>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(step.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#6b6f82', cursor: 'pointer', padding: 2 }} title="Remove step"><X size={14} /></button>
                )}
              </div>
              <input value={step.instruction} onChange={e => updateStep(step.id, 'instruction', e.target.value)} placeholder="Instruction (required)" style={{ ...inputStyle, marginBottom: 6 }} />

            </div>
          ))}
        </div>
      </div>

      {/* Duration + Points row */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}><Clock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Duration (minutes)</label>
          <input type="number" min={1} max={120} value={durationMin} onChange={e => setDurationMin(Math.max(1, parseInt(e.target.value) || 1))} placeholder="5" style={inputStyle} />
          <div style={{ fontSize: 11, color: '#6b6f82', marginTop: 3 }}>{durationMin} minute{durationMin !== 1 ? 's' : ''} per activity</div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}><Target size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Points</label>
          <input type="number" min={0} max={100} value={points} onChange={e => setPoints(Math.max(0, parseInt(e.target.value) || 0))} style={inputStyle} />
        </div>
      </div>

      {/* Timeout behavior */}
      <div>
        <label style={labelStyle}>On Timeout</label>
        <select value={onTimeout} onChange={e => setOnTimeout(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {TIMEOUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {onTimeout === 'allow_retry' && (
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#9485f5', marginBottom: 4, display: 'block' }}>Max Retries</label>
            <input type="number" min={1} max={5} value={maxRetries} onChange={e => setMaxRetries(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 100 }} />
          </div>
        )}
        {onTimeout === 'grace_period' && (
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12, color: '#9485f5', marginBottom: 4, display: 'block' }}>Grace Period (minutes)</label>
            <input type="number" min={1} max={30} value={gracePeriodMin} onChange={e => setGracePeriodMin(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 100 }} />
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label style={labelStyle}><Tag size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Tags <span style={{ fontWeight: 400, color: '#6b6f82' }}>(comma-separated, optional)</span></label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g., unit-1, research, beginner" style={inputStyle} />
      </div>



      {/* Error / Success */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(230,107,122,0.1)', border: '1px solid rgba(230,107,122,0.2)', borderRadius: 8, color: '#e66b7a', fontSize: 13 }}>{error}</div>
      )}
      {successMsg && (
        <div style={{ padding: '10px 14px', background: 'rgba(109,212,158,0.1)', border: '1px solid rgba(109,212,158,0.2)', borderRadius: 8, color: '#6dd49e', fontSize: 13 }}>✓ {successMsg}</div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => handleSave()} disabled={saving} style={{
          flex: 1, padding: '12px 24px',
          background: saving ? 'rgba(124,107,240,0.3)' : 'linear-gradient(135deg, #7c6bf0, #6558d4)',
          border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: saving ? 'none' : '0 4px 20px rgba(124,107,240,0.3)', transition: 'all 0.2s',
        }}>
          {saving ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={18} /> {initialData ? 'Update Activity' : 'Save Activity'}</>}
        </button>
        <button onClick={() => { resetForm(); onCancel(); }} style={{
          padding: '12px 24px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
          color: '#a0a4b8', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
        }}>Cancel</button>
      </div>
    </div>
  );
};
