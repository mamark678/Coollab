import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Upload, Edit2, Check, X, FileText, Info, RefreshCcw, Wand2, Sparkles } from 'lucide-react';
import mammoth from 'mammoth';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { ShareService } from '../../services/share';
import { FirebaseService } from '../../services/firebase';
import { Activity } from '../../services/activity';

interface InstructionsPanelProps {
  projectId: string;
  readOnly?: boolean;
}

export const InstructionsPanel: React.FC<InstructionsPanelProps> = ({ projectId, readOnly = false }) => {
  const { state: { user } } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [role, setRole] = useState<'admin' | 'student'>('student');
  const [content, setContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomized, setIsCustomized] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projectName, setProjectName] = useState<string>('Project');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !projectId) return;
    ShareService.getInstance().getUserPermission(projectId, user.uid).then(permission => {
      setRole((permission === 'owner' || permission === 'admin') ? 'admin' : 'student');
    });

    const db = FirebaseService.getInstance().db;
    getDoc(doc(db, 'notes', projectId)).then(snap => {
      if (snap.exists()) setProjectName(snap.data().title || 'Project');
    });

    const activitiesQ = query(collection(db, `notes/${projectId}/activities`), orderBy('sequenceNumber', 'asc'));
    const unsubscribeActivities = onSnapshot(activitiesQ, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
    });

    const instructionsRef = doc(db, `notes/${projectId}/instructions`, 'auto');
    const unsubscribeInstructions = onSnapshot(instructionsRef, (snap) => {
      setIsLoading(false);
      if (snap.exists()) {
        const data = snap.data();
        setContent(data.content || '');
        setIsCustomized(!!data.isCustomized);
      } else {
        setContent('');
        setIsCustomized(false);
      }
    });

    return () => { unsubscribeActivities(); unsubscribeInstructions(); };
  }, [projectId, user]);

  useEffect(() => {
    if (isLoading || activities.length === 0 || isCustomized) return;
    const generated = generateContent(activities, projectName);
    if (generated !== content) saveInstructions(generated, false);
  }, [activities, isCustomized, projectName, isLoading]);

  const generateContent = (acts: Activity[], name: string) => {
    let text = `Welcome to ${name}.\n\nYou will be given a series of tasks to complete inside this workspace. Complete each task as instructed. New tasks will appear as you progress.\n\n`;
    acts.forEach((act, idx) => {
      text += `Activity ${idx + 1} — ${act.title}\n${act.description}\n\n`;
    });
    text += `Good luck!`;
    return text;
  };

  const saveInstructions = async (newContent: string, customized: boolean) => {
    try {
      const db = FirebaseService.getInstance().db;
      await setDoc(doc(db, `notes/${projectId}/instructions`, 'auto'), {
        content: newContent,
        isCustomized: customized,
        generatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid || 'system'
      }, { merge: true });
      setIsEditing(false);
    } catch (err) { console.error('[InstructionsPanel] Failed to save:', err); }
  };

  const handleReset = () => saveInstructions(generateContent(activities, projectName), false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      await saveInstructions(result.value, true);
    } catch (err) { alert('Failed to parse document.'); }
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  if (isLoading) return null;

  return (
    <div className="flex flex-col border-b border-[color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)]">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
            <FileText size={16} />
          </div>
          <span className="text-[13px] font-black text-[color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] uppercase tracking-widest">Syllabus Guide</span>
        </div>
        {isExpanded ? <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)]" /> : <ChevronRight size={16} className="text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)]" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-6 overflow-hidden"
          >
            {role === 'admin' && isCustomized && !isEditing && (
              <div className="mb-6 p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-warning,#f59e0b)_5%,transparent)] border border-[color-mix(in_srgb,var(--theme-warning,#f59e0b)_20%,transparent)] flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[var(--theme-warning,#f59e0b)]">
                   <Wand2 size={14} />
                   <span className="text-[11px] font-black uppercase tracking-widest">Customized Guidelines</span>
                </div>
                <button 
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 py-2 bg-[var(--theme-warning,#f59e0b)] text-[var(--theme-background)] font-black text-[10px] uppercase rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <RefreshCcw size={12} /> Reset to AI Auto-gen
                </button>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-3">
                <textarea 
                  value={editContent} onChange={e => setEditContent(e.target.value)}
                  placeholder="Mastery guidelines..."
                  className="w-full bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] rounded-xl p-4 text-[13px] text-[color-mix(in_srgb,var(--theme-text-primary)_80%,transparent)] font-medium min-h-[200px] focus:outline-none focus:border-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)] resize-none placeholder:text-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]"
                />
                <div className="flex gap-2">
                  <button onClick={() => saveInstructions(editContent, true)} className="flex-1 py-3 bg-[var(--theme-primary)] text-[var(--theme-on-primary)] font-black text-[11px] uppercase rounded-xl flex items-center justify-center gap-2">
                    <Check size={14} /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] font-black text-[11px] uppercase rounded-xl flex items-center justify-center gap-2">
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-2xl p-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
                     <Sparkles size={16} className="text-[var(--theme-primary)]" />
                  </div>
                  <div 
                    className="text-[13px] text-[color-mix(in_srgb,var(--theme-text-primary)_60%,transparent)] leading-relaxed font-medium max-h-[300px] overflow-y-auto custom-scrollbar prose prose-invert prose-sm"
                    dangerouslySetInnerHTML={{ __html: content.trim().startsWith('<') ? content : content.replace(/\n/g, '<br/>') }}
                  />
                </div>
                
                {role === 'admin' && !readOnly && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditContent(content); setIsEditing(true); }}
                      className="flex-1 py-3 bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] font-black text-[11px] uppercase rounded-xl hover:text-[var(--theme-text-primary)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)] transition-all flex items-center justify-center gap-2"
                    >
                      <Edit2 size={14} /> Write
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-3 bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] font-black text-[11px] uppercase rounded-xl hover:text-[var(--theme-text-primary)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)] transition-all flex items-center justify-center gap-2"
                    >
                      <Upload size={14} /> Import
                    </button>
                    <input type="file" accept=".docx" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
