import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FileText, Database, BrainCircuit, Palette, Save, 
  Send, ChevronLeft, ChevronRight, Plus, Trash2, 
  Info, CheckCircle2, AlertCircle, Loader2, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Activity } from '../../services/activity';
import { FirebaseService } from '../../services/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Rnd } from 'react-rnd';

interface WorkspacePlayerProps {
  activity: Activity;
  studentId: string;
  studentName: string;
  projectId: string;
  onClose: () => void;
}

export const WorkspacePlayer: React.FC<WorkspacePlayerProps> = ({ 
  activity, 
  studentId, 
  studentName, 
  projectId,
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'document' | 'database' | 'graph' | 'canvas'>('document');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  // Local State for each component
  const [docContent, setDocContent] = useState('');
  const [dbEntries, setDbEntries] = useState<any[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [canvasElements, setCanvasElements] = useState<any[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: activity.workspaceData?.document?.prompt || 'Start writing...' })
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setDocContent(editor.getHTML());
    }
  });

  const enabledTabs = [
    { id: 'document', label: 'Document', icon: FileText, enabled: activity.workspaceData?.document?.enabled },
    { id: 'database', label: 'Database', icon: Database, enabled: activity.workspaceData?.database?.enabled },
    { id: 'graph', label: 'Graph', icon: BrainCircuit, enabled: activity.workspaceData?.graph?.enabled },
    { id: 'canvas', label: 'Canvas', icon: Palette, enabled: activity.workspaceData?.canvas?.enabled }
  ].filter(t => t.enabled);

  useEffect(() => {
    if (enabledTabs.length > 0 && !enabledTabs.find(t => t.id === activeTab)) {
      setActiveTab(enabledTabs[0].id as any);
    }
  }, [enabledTabs]);

  // Load existing submission
  useEffect(() => {
    const loadSubmission = async () => {
      const db = FirebaseService.getInstance().db;
      const subRef = doc(db, 'submissions', `${activity.id}_${studentId}`);
      const snap = await getDoc(subRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.components?.document?.content) {
          setDocContent(data.components.document.content);
          editor?.commands.setContent(data.components.document.content);
        }
        if (data.components?.database?.entries) setDbEntries(data.components.database.entries);
        if (data.components?.graph) setGraphData(data.components.graph);
        if (data.components?.canvas?.elements) setCanvasElements(data.components.canvas.elements);
      }
    };
    if (editor) loadSubmission();
  }, [activity.id, studentId, editor]);

  // Auto-save logic
  const saveSubmission = useCallback(async (isFinal = false) => {
    if (saving || isSubmitting) return;
    setSaving(true);
    try {
      const db = FirebaseService.getInstance().db;
      const subRef = doc(db, 'submissions', `${activity.id}_${studentId}`);
      
      const submissionData = {
        activityId: activity.id,
        studentId,
        studentName,
        projectId,
        submittedAt: isFinal ? serverTimestamp() : null,
        status: isFinal ? 'submitted' : 'draft',
        components: {
          document: { 
            content: docContent, 
            wordCount: docContent.split(/\s+/).filter(Boolean).length,
            completedAt: docContent.length > 10 ? serverTimestamp() : null
          },
          database: { 
            entries: dbEntries, 
            completedAt: dbEntries.length > 0 ? serverTimestamp() : null 
          },
          graph: { 
            nodes: graphData.nodes, 
            edges: graphData.edges, 
            completedAt: graphData.nodes.length > 0 ? serverTimestamp() : null 
          },
          canvas: { 
            elements: canvasElements, 
            completedAt: canvasElements.length > 0 ? serverTimestamp() : null 
          }
        }
      };

      await setDoc(subRef, submissionData, { merge: true });
      setLastSaved(new Date());

      // Update completion stats in activity completions
      if (isFinal) {
        const compRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${studentId}`);
        await setDoc(compRef, {
          status: 'completed',
          completedAt: Date.now(),
          pointsEarned: activity.points
        }, { merge: true });
      }
    } catch (err) {
      console.error('Failed to save submission:', err);
    } finally {
      setSaving(false);
    }
  }, [activity, studentId, studentName, projectId, docContent, dbEntries, graphData, canvasElements]);

  useEffect(() => {
    const interval = setInterval(() => saveSubmission(), 30000);
    return () => clearInterval(interval);
  }, [saveSubmission]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await saveSubmission(true);
    setIsSubmitting(false);
    onClose();
  };

  const isComplete = () => {
    if (activity.workspaceData?.document?.enabled && docContent.length < 10) return false;
    if (activity.workspaceData?.database?.enabled && dbEntries.length === 0) return false;
    if (activity.workspaceData?.graph?.enabled && graphData.nodes.length === 0) return false;
    if (activity.workspaceData?.canvas?.enabled && canvasElements.length === 0) return false;
    return true;
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-[var(--theme-background)] text-[var(--theme-text-primary)] flex flex-col">
      {/* Header */}
      <div className="h-20 border-b border-[var(--theme-border)] px-8 flex items-center justify-between bg-[color-mix(in_srgb,var(--theme-background)_80%,transparent)] backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] text-[var(--theme-text-primary)] transition-all">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black">{activity.title}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-primary)]">Workspace Activity</span>
              {lastSaved && (
                <span className="text-[10px] text-[var(--theme-text-secondary)]/65 font-bold">Saved {lastSaved.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => saveSubmission()}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-xs font-bold hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] text-[var(--theme-text-primary)] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Manual Save
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !isComplete()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--theme-primary)] text-[var(--theme-on-primary)] font-black text-sm shadow-xl shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Submit Activity
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Prompt Panel */}
        <div className="w-80 border-r border-[var(--theme-border)] p-8 flex flex-col gap-6 bg-[color-mix(in_srgb,var(--theme-surface)_30%,transparent)] overflow-y-auto custom-scrollbar">
          <div className="p-5 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]">
            <div className="flex items-center gap-2 text-[var(--theme-primary)] mb-3">
              <Info size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest">Active Prompt</h4>
            </div>
            <p className="text-sm text-[color-mix(in_srgb,var(--theme-text-primary)_80%,transparent)] leading-relaxed italic">
              {activeTab === 'document' && activity.workspaceData?.document?.prompt}
              {activeTab === 'database' && "Populate the database with structured entries based on the activity goals."}
              {activeTab === 'graph' && activity.workspaceData?.graph?.prompt}
              {activeTab === 'canvas' && activity.workspaceData?.canvas?.prompt}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-[var(--theme-text-secondary)]/50 uppercase tracking-[0.2em]">Components</h4>
            {enabledTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  activeTab === t.id 
                  ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]' 
                  : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-secondary)_70%,transparent)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <t.icon size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">{t.label}</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${completed[t.id] ? 'bg-[var(--theme-success)]' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)]'}`} />
              </button>
            ))}
          </div>

          <div className="mt-auto p-4 rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border border-[var(--theme-border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-[var(--theme-text-secondary)]/60 uppercase tracking-widest">Overall Progress</span>
              <span className="text-[10px] font-black text-[var(--theme-primary)]">{Math.round((Object.values(completed).filter(Boolean).length / enabledTabs.length) * 100)}%</span>
            </div>
            <div className="h-1 bg-[var(--theme-border)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--theme-primary)] transition-all" style={{ width: `${(Object.values(completed).filter(Boolean).length / enabledTabs.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[var(--theme-background)] relative flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'document' && (
              <motion.div 
                key="document" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 p-12 overflow-y-auto custom-scrollbar"
              >
                <div className="max-w-3xl mx-auto">
                  <EditorContent editor={editor} className="tiptap-editor-activity min-h-[500px]" />
                </div>
              </motion.div>
            )}

            {activeTab === 'database' && (
              <motion.div 
                key="database" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 p-12 overflow-y-auto custom-scrollbar"
              >
                <div className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border-b border-[var(--theme-border)]">
                        {activity.workspaceData?.database?.fields.map((f, i) => (
                          <th key={i} className="px-6 py-4 text-[10px] font-black text-[var(--theme-text-secondary)] uppercase tracking-widest">{f.name}</th>
                        ))}
                        <th className="px-6 py-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-border)]">
                      {dbEntries.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] transition-all">
                          {activity.workspaceData?.database?.fields.map((f, fIdx) => (
                            <td key={fIdx} className="px-6 py-4">
                              <input 
                                value={row[f.name] || ''}
                                onChange={e => {
                                    const newRows = [...dbEntries];
                                    newRows[rIdx][f.name] = e.target.value;
                                    setDbEntries(newRows);
                                }}
                                className="w-full bg-transparent text-[var(--theme-text-primary)] text-sm focus:outline-none placeholder:text-[var(--theme-text-secondary)]/30 placeholder:opacity-30"
                                placeholder={`Enter ${f.name}...`}
                              />
                            </td>
                          ))}
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setDbEntries(dbEntries.filter((_, i) => i !== rIdx))} className="text-[var(--theme-text-secondary)]/30 hover:text-[var(--theme-error)] transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    onClick={() => setDbEntries([...dbEntries, {}])}
                    className="w-full p-4 bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] text-[color-mix(in_srgb,var(--theme-text-secondary)_60%,transparent)] hover:text-[var(--theme-text-primary)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] transition-all flex items-center justify-center gap-2 text-xs font-bold"
                  >
                    <Plus size={14} /> Add New Row
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'graph' && (
              <motion.div 
                key="graph" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 relative overflow-hidden"
              >
                <ActivityGraphEditor data={graphData} onChange={setGraphData} />
              </motion.div>
            )}

            {activeTab === 'canvas' && (
              <motion.div 
                key="canvas" 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 relative overflow-hidden"
              >
                <ActivityCanvasEditor elements={canvasElements} onChange={setCanvasElements} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .tiptap-editor-activity .ProseMirror {
          outline: none;
          color: var(--theme-text-primary);
          font-size: 1.1rem;
          line-height: 1.7;
        }
        .tiptap-editor-activity .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: color-mix(in srgb, var(--theme-text-primary) 20%, transparent);
          pointer-events: none;
          height: 0;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--theme-text-primary) 5%, transparent);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, var(--theme-text-primary) 10%, transparent);
        }
      `}</style>
    </div>
  );
};

// --- Simple Graph Editor Component ---
const ActivityGraphEditor: React.FC<{ data: any, onChange: (d: any) => void }> = ({ data, onChange }) => {
  const [nodes, setNodes] = useState<any[]>(data.nodes || []);
  const [edges, setEdges] = useState<any[]>(data.edges || []);
  const [isLinking, setIsLinking] = useState<string | null>(null);

  const addNode = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const newNode = {
      id: Date.now().toString(),
      label: 'New Concept',
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    onChange({ nodes: nextNodes, edges });
  };

  const startLinking = (id: string) => setIsLinking(id);
  const endLinking = (id: string) => {
    if (isLinking && isLinking !== id) {
      const nextEdges = [...edges, { source: isLinking, target: id }];
      setEdges(nextEdges);
      onChange({ nodes, edges: nextEdges });
    }
    setIsLinking(null);
  };

  return (
    <div className="w-full h-full bg-[var(--theme-background)] cursor-crosshair relative overflow-hidden" onClick={addNode}>
      <div className="absolute top-6 left-6 p-4 rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border border-[var(--theme-border)] text-[10px] font-bold text-[var(--theme-text-secondary)] uppercase tracking-widest pointer-events-none">
        Click anywhere to add a node • Click a node to start linking
      </div>
      <svg className="w-full h-full pointer-events-none">
        {edges.map((edge, i) => {
          const s = nodes.find(n => n.id === edge.source);
          const t = nodes.find(n => n.id === edge.target);
          if (!s || !t) return null;
          return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--theme-primary)" strokeOpacity="0.3" strokeWidth="2" />;
        })}
      </svg>
      {nodes.map(node => (
        <div 
          key={node.id}
          style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
          className={`absolute p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            isLinking === node.id ? 'bg-[var(--theme-primary)] border-[var(--theme-on-primary)] scale-110 shadow-2xl' : 'bg-[var(--theme-surface)] border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)] hover:border-[var(--theme-primary)]'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (isLinking) endLinking(node.id);
            else startLinking(node.id);
          }}
        >
          <input 
            value={node.label}
            onChange={(e) => {
              const next = nodes.map(n => n.id === node.id ? { ...n, label: e.target.value } : n);
              setNodes(next);
              onChange({ nodes: next, edges });
            }}
            className="bg-transparent text-[var(--theme-text-primary)] text-xs font-bold text-center focus:outline-none border-b border-transparent focus:border-[var(--theme-border)]"
          />
        </div>
      ))}
    </div>
  );
};

// --- Simple Canvas Editor Component ---
const ActivityCanvasEditor: React.FC<{ elements: any[], onChange: (e: any[]) => void }> = ({ elements, onChange }) => {
  const addElement = (type: 'text' | 'sticky' | 'shape') => {
    const newEl = {
      id: Date.now().toString(),
      type,
      x: 100,
      y: 100,
      w: 200,
      h: 150,
      content: type === 'text' ? 'Double click to edit text' : 'New sticky note',
      color: type === 'sticky' ? '#fde047' : 'transparent'
    };
    onChange([...elements, newEl]);
  };

  return (
    <div className="w-full h-full bg-[var(--theme-background)] relative overflow-hidden">
      <div className="absolute top-6 left-6 flex gap-2 z-10">
        <button onClick={() => addElement('text')} className="px-4 py-2 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-xl border border-[var(--theme-border)] text-xs font-bold hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] text-[var(--theme-text-primary)]">Add Text</button>
        <button onClick={() => addElement('sticky')} className="px-4 py-2 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-xl border border-[var(--theme-border)] text-xs font-bold hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] text-[var(--theme-text-primary)]">Add Sticky</button>
        <button onClick={() => addElement('shape')} className="px-4 py-2 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-xl border border-[var(--theme-border)] text-xs font-bold hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] text-[var(--theme-text-primary)]">Add Shape</button>
      </div>

      <div className="w-full h-full canvas-bg">
        {elements.map((el, idx) => (
          <Rnd
            key={el.id}
            default={{ x: el.x, y: el.y, width: el.w, height: el.h }}
            onDragStop={(e: any, d: any) => {
              const next = [...elements];
              next[idx] = { ...next[idx], x: d.x, y: d.y };
              onChange(next);
            }}
            onResizeStop={(e: any, dir: any, ref: any, delta: any, pos: any) => {
              const next = [...elements];
              next[idx] = { ...next[idx], w: ref.style.width, h: ref.style.height, ...pos };
              onChange(next);
            }}
            className={`p-4 rounded-xl shadow-2xl ${el.type === 'sticky' ? 'text-black' : 'text-[var(--theme-text-primary)]'}`}
            style={{ backgroundColor: el.color, border: el.type === 'shape' ? '2px solid var(--theme-primary)' : 'none' }}
          >
            <textarea 
              value={el.content}
              onChange={(e) => {
                const next = [...elements];
                next[idx].content = e.target.value;
                onChange(next);
              }}
              className="w-full h-full bg-transparent resize-none focus:outline-none font-bold"
            />
          </Rnd>
        ))}
      </div>
      <style>{`
        .canvas-bg {
          background-image: radial-gradient(color-mix(in srgb, var(--theme-text-primary) 8%, transparent) 1px, transparent 0);
          background-size: 40px 40px;
        }
      `}</style>
    </div>
  );
};
