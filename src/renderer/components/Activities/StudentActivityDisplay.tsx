import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Circle,
  Zap,
  Info,
  CheckCircle2,
  Play,
  ArrowRight
} from 'lucide-react';
import { Activity } from '../../services/activity';

interface StudentActivityDisplayProps {
  projectId: string;
}

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

const findPromptsInObject = (obj: any, visited = new Set()): string[] => {
  if (!obj || typeof obj !== 'object') return [];
  if (visited.has(obj)) return [];
  visited.add(obj);

  const results: string[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      const kLower = key.toLowerCase();
      if (kLower.includes('prompt') || kLower.includes('instruction') || kLower.includes('description')) {
        if (kLower !== 'assignedby' && kLower !== 'type' && kLower !== 'status') {
          results.push(val.trim());
        }
      }
    } else if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string' && item.trim().length > 0) {
          const kLower = key.toLowerCase();
          if (kLower.includes('prompt') || kLower.includes('instruction') || kLower.includes('description') || kLower.includes('step')) {
            results.push(item.trim());
          }
        } else if (item && typeof item === 'object') {
          results.push(...findPromptsInObject(item, visited));
        }
      }
    } else if (val && typeof val === 'object') {
      results.push(...findPromptsInObject(val, visited));
    }
  }
  return results;
};

const getDisplayInstructions = (activity: any): any[] => {
  const rawInstructions = activity.instructions || [];
  
  // 1. Try to get valid instructions from instructions array
  const validInstructions = rawInstructions
    .map((inst: any) => getInstructionText(inst).trim())
    .filter((inst: string) => inst.length > 0);

  if (validInstructions.length > 0) {
    return validInstructions;
  }

  // 2. Try to get description if it's non-empty and not just a default/fallback
  if (activity.description && activity.description.trim().length > 0 && activity.description.trim() !== 'Follow the activity details.') {
    return [activity.description.trim()];
  }

  // 3. Try to extract prompts from workspaceData
  const prompts: string[] = [];
  if (activity.workspaceData) {
    const ws = activity.workspaceData;
    // Check document
    if (ws.document?.prompt && ws.document.prompt.trim().length > 0) {
      prompts.push(ws.document.prompt.trim());
    }
    // Check graph
    if (ws.graph?.prompt && ws.graph.prompt.trim().length > 0) {
      prompts.push(ws.graph.prompt.trim());
    }
    // Check canvas
    if (ws.canvas?.prompt && ws.canvas.prompt.trim().length > 0) {
      prompts.push(ws.canvas.prompt.trim());
    }
    // Check database
    if (ws.database?.enabled) {
      const fields = (ws.database.fields || []).map((f: any) => `${f.name} (${f.type})`).join(', ');
      if (fields) {
        prompts.push(`Create database fields: ${fields}`);
      }
    }
  }

  if (prompts.length > 0) {
    return prompts;
  }

  // 4. Try deep recursive search for any prompt or description or instruction keys in the activity object
  const deepPrompts = findPromptsInObject(activity);
  const uniqueDeepPrompts = Array.from(new Set(deepPrompts))
    .filter(p => p !== 'Follow the activity details.' && p !== activity.title);
  
  if (uniqueDeepPrompts.length > 0) {
    return uniqueDeepPrompts;
  }

  // 5. Check taskData/discussionData fallbacks explicitly
  if (activity.taskData) {
    const td = activity.taskData;
    if (td.description) {
      return [td.description];
    }
    if (td.subtasks && td.subtasks.length > 0) {
      return td.subtasks.map((st: any) => st.text);
    }
  }

  if (activity.discussionData) {
    const dd = activity.discussionData;
    if (dd.prompt) {
      return [dd.prompt];
    }
  }

  // 6. Fallback based on workspace_zone
  if (activity.workspace_zone) {
    const zone = String(activity.workspace_zone).toLowerCase();
    if (zone === 'document') {
      return ['Draft the requested business plan or document in the workspace.'];
    }
    if (zone === 'canvas') {
      return ['Map out your ideas and design elements on the canvas workspace.'];
    }
    if (zone === 'graph' || zone === 'folder') {
      return ['Establish concept links and organize your documents in the workspace.'];
    }
    if (zone === 'base' || zone === 'database') {
      return ['Populate the base/database table with structured workspace columns and rows.'];
    }
  }

  // Last resort
  return ['Follow the activity details.'];
};

export const StudentActivityDisplay: React.FC<StudentActivityDisplayProps> = ({ projectId }) => {
  const [activityData, setActivityData] = useState<{ activity: Activity, status: string, startedAt: number | null } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const handleActivityChange = (e: any) => {
      setActivityData(e.detail);
      setShowConfirm(false);
    };

    window.addEventListener('current-activity-changed', handleActivityChange);

    return () => {
      window.removeEventListener('current-activity-changed', handleActivityChange);
    };
  }, []);

  if (!activityData) return null;

  const { activity, status } = activityData;

  // Render pending state ONLY for workspace activities, hide others
  if (status === 'pending' && activity.type !== 'workspace') return null;

  // Hide the floating widget for activities that have their own dedicated full-screen players.
  // These activities manage their own UI, timer, and completion flow.
  const hasDedicatedPlayer = ['quiz', 'gizmo', 'flashcard'].includes(activity.type);
  if (hasDedicatedPlayer) return null;

  const isLocked = status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-8 right-8 z-[1000] flex flex-col"
      style={{ width: isMinimized ? '260px' : '400px' }}
    >
      <div className="bg-[color-mix(in_srgb,var(--theme-surface)_95%,transparent)] backdrop-blur-2xl border border-[var(--theme-border)] rounded-[32px] overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.3)] flex flex-col" style={{ maxHeight: 'calc(100vh - 64px)' }}>
        {/* Header Toggle */}
        <div 
          onClick={() => setIsMinimized(!isMinimized)}
          className={`shrink-0 px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] transition-colors ${!isMinimized ? 'border-b border-[var(--theme-border)]' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner shadow-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] text-[var(--theme-primary)]">
              <Zap size={16} className="fill-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]" />
            </div>
            <span className="text-[11px] text-[var(--theme-text-secondary)] opacity-85 tracking-[0.1em] truncate">
              Active Objective
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {isMinimized ? <ChevronUp size={18} className="text-[var(--theme-text-secondary)] opacity-40" /> : <ChevronDown size={18} className="text-[var(--theme-text-secondary)] opacity-40" />}
          </div>
        </div>

        <AnimatePresence>
          {!isMinimized && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-y-auto custom-scrollbar" style={{ padding: '2rem' }}>
              <div className="mb-8">
                <h3 className="text-xl font-black text-[var(--theme-text-primary)] tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>{activity.title}</h3>
                <p className="text-[14px] text-[var(--theme-text-secondary)] leading-relaxed font-medium">{activity.description}</p>
              </div>

              <div className="space-y-3 mb-8">
                <span className="text-[10px] font-black text-[var(--theme-text-secondary)] opacity-40 uppercase tracking-[0.2em] mb-4 block">Task Instructions</span>
                {getDisplayInstructions(activity).map((instr, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_4%,transparent)] transition-all">
                    <div className="w-5 h-5 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)] flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black text-[var(--theme-primary)]">{idx + 1}</div>
                    <p className="text-[13px] text-[var(--theme-text-primary)] opacity-80 leading-relaxed font-medium">{getInstructionText(instr)}</p>
                  </div>
                ))}
              </div>

              {activity.type === 'task' && activity.taskData && (
                <div className="space-y-3 mb-8">
                  <span className="text-[10px] font-black text-[var(--theme-text-secondary)] opacity-40 uppercase tracking-[0.2em] mb-4 block">Subtasks</span>
                  {activity.taskData.subtasks.map((st: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)]">
                      <div className="mt-0.5"><Circle size={14} className="text-[var(--theme-success)]" /></div>
                      <p className="text-[13px] text-[var(--theme-text-primary)] opacity-80 leading-relaxed font-medium">{st.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {activity.type === 'discussion' && activity.discussionData && (
                <div className="space-y-4 mb-8">
                  <div className="rounded-lg border" style={{ padding: '1rem 1.25rem', backgroundColor: 'color-mix(in srgb, var(--theme-primary) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--theme-primary) 25%, transparent)' }}>
                    <span className="text-[11px] text-[var(--theme-text-secondary)] tracking-[0.1em] mb-3 block">Discussion Prompt</span>
                    <p className="text-[14px] leading-[1.7] text-[var(--theme-text-primary)] opacity-85">{activity.discussionData.prompt}</p>
                  </div>
                  {activity.discussionData.guidingQuestions?.length > 0 && (
                    <div className="mt-4">
                      <span className="text-[11px] text-[var(--theme-text-secondary)] tracking-[0.1em] mb-3 block">Guiding Questions</span>
                      <div className="flex flex-col" style={{ paddingLeft: '1.25rem', gap: '12px' }}>
                        {activity.discussionData.guidingQuestions.map((q: string, idx: number) => (
                          <div key={idx} className="flex text-[13px] leading-[1.6] text-[var(--theme-text-primary)] opacity-80" style={{ gap: '8px' }}>
                            <span className="text-[var(--theme-text-secondary)] shrink-0">•</span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showConfirm ? (
                <div className="space-y-4 p-6 bg-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] rounded-3xl">
                  <p className="text-center text-sm font-black text-[var(--theme-text-primary)]">Finalize and submit sequence?</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setShowConfirm(false); window.dispatchEvent(new Event('complete-current-activity')); }}
                      className="flex-1 py-4 bg-[var(--theme-primary)] text-[var(--theme-on-primary)] font-black text-sm rounded-2xl shadow-lg shadow-[var(--theme-primary)]/20 hover:opacity-90 transition-all"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[var(--theme-text-secondary)] opacity-60 font-black text-sm rounded-2xl hover:opacity-100 transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    if (isLocked) {
                      window.dispatchEvent(new Event('start-current-activity'));
                    } else {
                      setShowConfirm(true);
                    }
                  }}
                  className="w-full bg-[var(--theme-primary)] text-[var(--theme-on-primary)] text-[14px] font-semibold rounded-lg transition-all flex items-center justify-center cursor-pointer hover:opacity-90"
                  style={{ padding: '12px 24px', gap: '8px' }}
                >
                  <CheckCircle2 size={18} className="text-[var(--theme-on-primary)] shrink-0" /> 
                  {isLocked ? "Start Activity" : "Submit"}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
import { AlertTriangle } from 'lucide-react';
