import React, { useState, useEffect } from 'react';
import { 
  FileText, Database, BrainCircuit, Palette, 
  ChevronLeft, Info, MessageSquare, Star, 
  Download, ExternalLink, User, Clock, 
  CheckCircle2, AlertCircle, Loader2, Send,
  Award, BookOpen, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Activity } from '../../services/activity';
import { FirebaseService } from '../../services/firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { useAppStore } from '../../store/useAppStore';

interface StudentWorkspaceViewerProps {
  activity: Activity;
  studentId: string;
  projectId: string;
  onClose: () => void;
}

export const StudentWorkspaceViewer: React.FC<StudentWorkspaceViewerProps> = ({ 
  activity, 
  studentId, 
  projectId,
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'document' | 'database' | 'graph' | 'canvas'>('document');
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(activity.points);
  const [savingFeedback, setSavingFeedback] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: false
  });

  const enabledTabs = [
    { id: 'document', label: 'Document', icon: FileText, enabled: activity.workspaceData?.document?.enabled },
    { id: 'database', label: 'Database', icon: Database, enabled: activity.workspaceData?.database?.enabled },
    { id: 'graph', label: 'Graph', icon: BrainCircuit, enabled: activity.workspaceData?.graph?.enabled },
    { id: 'canvas', label: 'Canvas', icon: Palette, enabled: activity.workspaceData?.canvas?.enabled }
  ].filter(t => t.enabled);

  useEffect(() => {
    const loadSubmission = async () => {
      setLoading(true);
      const db = FirebaseService.getInstance().db;
      const studentName = useAppStore.getState().projectMembers.find(m => m.uid === studentId)?.name || 'Student';

      // Step 1: Try to load the rich workspace submission document
      let submissionLoaded = false;
      try {
        const subRef = doc(db, 'submissions', `${activity.id}_${studentId}`);
        const snap = await getDoc(subRef);
        if (snap.exists()) {
          const data = snap.data();
          setSubmission(data);
          if (data.components?.document?.content) {
            editor?.commands.setContent(data.components.document.content);
          }
          if (data.feedback) setFeedback(data.feedback);
          if (data.score !== undefined) setScore(data.score);
          submissionLoaded = true;
        }
      } catch (err) {
        // Permission error or network error reading submissions — fall through to completion fallback
        console.warn('[StudentWorkspaceViewer] Could not read /submissions (will try completions fallback):', err);
      }

      // Step 2: If no workspace submission found, synthesize from the completion record
      // This covers: quiz, reading, task, discussion, or workspace before Firestore rules were deployed
      if (!submissionLoaded) {
        try {
          const compRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${studentId}`);
          const compSnap = await getDoc(compRef);
          if (compSnap.exists()) {
            const compData = compSnap.data();
            setSubmission({
              activityId: activity.id,
              studentId,
              studentName,
              projectId,
              submittedAt: compData.completedAt ? { toDate: () => new Date(compData.completedAt) } : null,
              status: compData.status,
              timeTaken: compData.timeTaken,
              feedback: compData.feedback || '',
              score: compData.pointsEarned !== undefined ? compData.pointsEarned : activity.points,
              isSynthesized: true
            });
            if (compData.feedback) setFeedback(compData.feedback);
            if (compData.pointsEarned !== undefined) setScore(compData.pointsEarned);
          }
        } catch (err) {
          console.error('[StudentWorkspaceViewer] Could not read completion fallback:', err);
        }
      }

      setLoading(false);
    };
    if (editor) loadSubmission();
  }, [activity.id, studentId, projectId, editor]);

  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    try {
      const db = FirebaseService.getInstance().db;
      const subRef = doc(db, 'submissions', `${activity.id}_${studentId}`);
      await setDoc(subRef, {
        activityId: activity.id,
        studentId,
        studentName: submission.studentName,
        projectId,
        feedback,
        score,
        gradedAt: serverTimestamp(),
        status: 'graded'
      }, { merge: true });
      
      // Update completion record
      const compRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${studentId}`);
      await setDoc(compRef, {
        pointsEarned: score,
        feedback: feedback,
        status: 'graded'
      }, { merge: true });

      // Update local submission state to show status changes immediately
      setSubmission((prev: any) => prev ? { ...prev, status: 'graded', feedback, score } : null);
    } catch (err) {
      console.error('Failed to save feedback:', err);
    } finally {
      setSavingFeedback(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={32} className="animate-spin text-[var(--theme-primary)]" />
    </div>
  );

  if (!submission) return (
    <div className="flex flex-col items-center justify-center h-full text-[var(--theme-text-secondary)] opacity-60 gap-4">
      <AlertCircle size={48} />
      <p>No submission found for this student.</p>
      <button onClick={onClose} className="text-[var(--theme-primary)] font-bold">Return to Dashboard</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[5000] flex flex-col bg-[var(--theme-background)] text-[var(--theme-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-[var(--theme-border)] px-8 flex items-center justify-between bg-[color-mix(in_srgb,var(--theme-surface)_30%,transparent)]">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--theme-text-primary)]">{submission.studentName}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-primary)]">Submission Review</span>
                <span className="text-[10px] text-[var(--theme-text-secondary)] opacity-60 font-bold flex items-center gap-1">
                  <Clock size={10} />
                  Submitted {submission.submittedAt?.toDate?.()?.toLocaleString() || 'Recently'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]"
          >
            <Download size={14} />
            Export as PDF
          </button>
          <button 
            onClick={handleSaveFeedback}
            disabled={savingFeedback}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-on-primary)] font-black text-sm shadow-xl shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {savingFeedback ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            Finalize Grade
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Review Area */}
        <div className="flex-1 flex flex-col bg-[var(--theme-background)]">
          {/* Tab Bar */}
          <div className="h-14 border-b border-[var(--theme-border)] flex px-8 bg-[color-mix(in_srgb,var(--theme-surface)_20%,transparent)]">
            {enabledTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-8 relative h-full flex items-center gap-2 transition-all ${
                  activeTab === t.id ? 'text-[var(--theme-primary)]' : 'text-[var(--theme-text-secondary)] opacity-50 hover:opacity-80'
                }`}
              >
                <t.icon size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                {activeTab === t.id && (
                  <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--theme-primary)]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {enabledTabs.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="h-full p-12 overflow-y-auto custom-scrollbar flex items-center justify-center"
                >
                  <div className="max-w-xl w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[32px] p-8 flex flex-col gap-6 shadow-[0_16px_32px_color-mix(in_srgb,var(--theme-text-primary)_15%,transparent)]">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
                        {activity.type === 'quiz' && <Award size={24} />}
                        {activity.type === 'reading' && <BookOpen size={24} />}
                        {activity.type === 'discussion' && <MessageSquare size={24} />}
                        {activity.type === 'task' && <CheckSquare size={24} />}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[var(--theme-text-primary)]">{activity.title}</h3>
                        <p className="text-xs text-[var(--theme-text-secondary)] opacity-60 uppercase tracking-widest font-black">{activity.type} Activity Completed</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)]">
                        <span className="text-[10px] text-[var(--theme-text-secondary)] opacity-60 font-black uppercase tracking-wider block mb-1">Status</span>
                        <span className="text-sm font-bold text-[var(--theme-success)] capitalize">{submission.status || 'completed'}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)]">
                        <span className="text-[10px] text-[var(--theme-text-secondary)] opacity-60 font-black uppercase tracking-wider block mb-1">Time Taken</span>
                        <span className="text-sm font-bold text-[var(--theme-text-primary)] opacity-80">{submission.timeTaken ? `${Math.floor(submission.timeTaken / 60)}m ${submission.timeTaken % 60}s` : 'N/A'}</span>
                      </div>
                    </div>

                    {activity.type === 'quiz' && submission.score !== undefined && (
                      <div className="p-6 rounded-2xl flex justify-between items-center" style={{ backgroundColor: "color-mix(in srgb, var(--theme-success) 5%, transparent)", borderColor: "color-mix(in srgb, var(--theme-success) 20%, transparent)", borderStyle: "solid", borderWidth: "1px" }}>
                        <div>
                          <span className="text-[10px] text-[var(--theme-text-secondary)] opacity-60 font-black uppercase tracking-wider block mb-1">Quiz Score</span>
                          <span className="text-lg font-black text-[var(--theme-success)]">{submission.score} <span className="text-xs font-bold text-[var(--theme-text-secondary)] opacity-60">/ {activity.points} XP</span></span>
                        </div>
                        <Award size={32} className="opacity-80" style={{ color: "var(--theme-success)" }} />
                      </div>
                    )}

                    {activity.type === 'task' && activity.taskData?.subtasks && (
                      <div className="space-y-3">
                        <span className="text-[10px] text-[var(--theme-text-secondary)] opacity-60 font-black uppercase tracking-wider block">Assigned Subtasks</span>
                        <div className="space-y-2">
                          {activity.taskData.subtasks.map((st: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)]">
                              <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: "var(--theme-success)" }} />
                              <p className="text-xs text-[var(--theme-text-secondary)] opacity-80 leading-relaxed font-medium">{st.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.type === 'discussion' && activity.discussionData?.prompt && (
                      <div className="space-y-3">
                        <span className="text-[10px] text-[var(--theme-text-secondary)] opacity-60 font-black uppercase tracking-wider block">Discussion Prompt</span>
                        <div className="p-5 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] text-xs text-[var(--theme-text-secondary)] opacity-80 leading-relaxed font-medium">
                          {activity.discussionData.prompt}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <>
                  {activeTab === 'document' && (
                    <motion.div key="doc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-12 overflow-y-auto custom-scrollbar">
                       <div className="max-w-3xl mx-auto tiptap-editor-activity">
                        <EditorContent editor={editor} />
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'database' && (
                    <motion.div key="db" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full p-12 overflow-y-auto custom-scrollbar">
                       <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl overflow-hidden">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border-b border-[var(--theme-border)]">
                              {activity.workspaceData?.database?.fields.map((f, i) => (
                                <th key={i} className="px-6 py-4 text-[10px] font-black text-[var(--theme-text-secondary)] opacity-60 uppercase tracking-widest">{f.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--theme-border)]">
                            {submission.components?.database?.entries.map((row: any, rIdx: number) => (
                              <tr key={rIdx} className="hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)]">
                                {activity.workspaceData?.database?.fields.map((f, fIdx) => (
                                  <td key={fIdx} className="px-6 py-4 text-sm text-[var(--theme-text-secondary)] opacity-80">{row[f.name] || '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                  {activeTab === 'graph' && (
                    <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full relative">
                      <ActivityGraphPreview data={submission.components?.graph} />
                    </motion.div>
                  )}
                  {activeTab === 'canvas' && (
                    <motion.div key="canvas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full relative">
                      <ActivityCanvasPreview elements={submission.components?.canvas?.elements} />
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Feedback Panel */}
        <div className="w-96 border-l border-[var(--theme-border)] bg-[color-mix(in_srgb,var(--theme-surface)_50%,transparent)] flex flex-col">
          <div className="p-8 flex flex-col gap-8 h-full">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--theme-success) 10%, transparent)", color: "var(--theme-success)" }}>
                  <Star size={16} />
                </div>
                <h3 className="text-sm font-black text-[var(--theme-text-primary)] uppercase tracking-widest">Grading</h3>
              </div>
              <div className="p-6 rounded-2xl bg-[color-mix(in_srgb,var(--theme-background)_50%,transparent)] border border-[var(--theme-border)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[var(--theme-text-secondary)] opacity-60">Total XP</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={score} 
                      onChange={e => setScore(parseInt(e.target.value) || 0)}
                      className="w-16 bg-[color-mix(in_srgb,var(--theme-background)_40%,transparent)] border border-[var(--theme-border)] rounded-lg px-2 py-1 text-center text-sm font-black text-[var(--theme-text-primary)]"
                    />
                    <span className="text-sm font-black text-[var(--theme-text-secondary)] opacity-40">/ {activity.points}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${(score / activity.points) * 100}%`, backgroundColor: "var(--theme-success)" }} />
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
                  <MessageSquare size={16} />
                </div>
                <h3 className="text-sm font-black text-[var(--theme-text-primary)] uppercase tracking-widest">Instructor Feedback</h3>
              </div>
              <textarea 
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Enter feedback for the student..."
                className="flex-1 bg-[color-mix(in_srgb,var(--theme-background)_20%,transparent)] border border-[var(--theme-border)] rounded-2xl p-6 text-sm text-[var(--theme-text-primary)] focus:outline-none focus:border-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)] transition-all resize-none placeholder:text-[var(--theme-text-secondary)] placeholder:opacity-30"
              />
            </div>

            <div className="p-6 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]">
              <div className="flex items-center gap-3 text-[var(--theme-primary)] mb-2">
                <Info size={14} />
                <h4 className="text-[10px] font-black uppercase tracking-widest">Auto-Generated Summary</h4>
              </div>
              <p className="text-[11px] text-[var(--theme-text-secondary)] opacity-60 leading-relaxed">
                Student completed {submission.components?.document?.wordCount || 0} words in document.
                Added {submission.components?.database?.entries?.length || 0} database rows.
                Created {submission.components?.graph?.nodes?.length || 0} nodes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tiptap-editor-activity .ProseMirror {
          outline: none;
          color: var(--theme-text-primary);
          font-size: 1.1rem;
          line-height: 1.7;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--theme-text-primary) 10%, transparent);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

// --- Read-only Previews ---
const ActivityGraphPreview: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="w-full h-full bg-[var(--theme-background)] relative overflow-hidden">
      <svg className="w-full h-full">
        {data.edges?.map((edge: any, i: number) => {
          const s = data.nodes.find((n: any) => n.id === edge.source);
          const t = data.nodes.find((n: any) => n.id === edge.target);
          if (!s || !t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--theme-border)" strokeWidth="2" />;
        })}
      </svg>
      {data.nodes?.map((node: any) => (
        <div 
          key={node.id}
          style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
          className="absolute p-4 rounded-2xl border-2 bg-[var(--theme-surface)] border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)] text-[var(--theme-text-primary)] text-xs font-bold"
        >
          {node.label}
        </div>
      ))}
    </div>
  );
};

const ActivityCanvasPreview: React.FC<{ elements: any[] }> = ({ elements }) => {
  if (!elements) return null;
  return (
    <div className="w-full h-full bg-[var(--theme-background)] relative overflow-hidden">
      <div className="w-full h-full canvas-bg">
        {elements.map((el) => (
          <div
            key={el.id}
            style={{ 
              left: el.x, top: el.y, width: el.w, height: el.h,
              backgroundColor: el.color, border: el.type === 'shape' ? '2px solid var(--theme-primary)' : 'none',
              position: 'absolute'
            }}
            className={`p-4 rounded-xl shadow-2xl overflow-hidden text-sm font-bold ${el.type === 'sticky' ? 'text-black' : 'text-[var(--theme-text-primary)]'}`}
          >
            {el.content}
          </div>
        ))}
      </div>
       <style>{`
        .canvas-bg {
          background-image: radial-gradient(color-mix(in srgb, var(--theme-text-primary) 5%, transparent) 1px, transparent 0);
          background-size: 40px 40px;
        }
      `}</style>
    </div>
  );
};
