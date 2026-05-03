import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Upload, Edit2, Check, X } from 'lucide-react';
import mammoth from 'mammoth';
import { 
  collection, 
  onSnapshot, 
  query, 
  limit, 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  orderBy,
  where
} from 'firebase/firestore';
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
  const [error, setError] = useState<string | null>(null);
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
      if (permission === 'owner' || permission === 'admin') {
        setRole('admin');
      } else {
        setRole('student');
      }
    });

    const db = FirebaseService.getInstance().db;
    
    // Fetch project name
    getDoc(doc(db, 'notes', projectId)).then(snap => {
      if (snap.exists()) setProjectName(snap.data().title || 'Project');
    });

    // Listen to activities
    const activitiesQ = query(collection(db, `notes/${projectId}/activities`), orderBy('sequenceNumber', 'asc'));
    const unsubscribeActivities = onSnapshot(activitiesQ, (snap) => {
      const acts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
      setActivities(acts);
    });

    // Listen to instructions
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

    return () => {
      unsubscribeActivities();
      unsubscribeInstructions();
    };
  }, [projectId, user]);

  // Auto-generate logic
  useEffect(() => {
    if (isLoading || activities.length === 0) return;
    if (isCustomized) return;

    const generated = generateContent(activities, projectName);
    if (generated !== content) {
      saveInstructions(generated, false);
    }
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
      const ref = doc(db, `notes/${projectId}/instructions`, 'auto');

      await setDoc(ref, {
        content: newContent,
        isCustomized: customized,
        generatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid || 'system'
      }, { merge: true });

      setIsEditing(false);
    } catch (err) {
      console.error('[InstructionsPanel] Failed to save:', err);
    }
  };

  const handleReset = () => {
    const generated = generateContent(activities, projectName);
    saveInstructions(generated, false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      await saveInstructions(result.value, true);
    } catch (err) {
      console.error('[InstructionsPanel] Failed to parse docx:', err);
      alert('Failed to parse document. Ensure it is a valid .docx file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (error) {
    return (
      <div style={{ padding: '12px', color: '#ef4444', fontSize: '12px' }}>
        Failed to load instructions. Please refresh.
      </div>
    );
  }

  if (isLoading) return null;

  return (
    <div className="sidebar__section">
      <div 
        className="sidebar__section-header" 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {isExpanded ? <ChevronDown size={14} style={{ marginRight: 6 }} /> : <ChevronRight size={14} style={{ marginRight: 6 }} />}
          Instructions
        </span>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '0 12px 12px', fontSize: 13, color: '#a0a4b8' }}>
          {role === 'admin' && isCustomized && !isEditing && (
            <div style={{ 
              background: 'rgba(245, 158, 11, 0.1)', 
              border: '1px solid rgba(245, 158, 11, 0.2)', 
              borderRadius: 6, 
              padding: '8px 10px', 
              marginBottom: 12,
              fontSize: '11px',
              color: '#f59e0b',
              display: 'flex',
              flexDirection: 'column',
              gap: 6
            }}>
              <div style={{ fontWeight: 600 }}>You have customized these instructions.</div>
              <button 
                onClick={handleReset}
                style={{ 
                  background: '#f59e0b', 
                  color: '#000', 
                  border: 'none', 
                  padding: '2px 8px', 
                  borderRadius: 4, 
                  fontSize: '10px', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                Reset to auto-generated
              </button>
            </div>
          )}

          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea 
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 150,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e8eaf0',
                  borderRadius: 4,
                  padding: 8,
                  fontSize: 13,
                  resize: 'vertical'
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => saveInstructions(editContent, true)}
                  style={{ flex: 1, background: '#7c6bf0', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Check size={12} style={{ marginRight: 4 }}/> Save
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={12} style={{ marginRight: 4 }}/> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {content ? (
                <div 
                  className="instructions-content"
                  style={{ 
                    maxHeight: 300, 
                    overflowY: 'auto', 
                    marginBottom: 12,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '13px',
                    lineHeight: '1.6'
                  }}
                >
                  {/* If it looks like HTML (from mammoth), render as HTML, otherwise as plain text */}
                  {content.trim().startsWith('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                  ) : (
                    content
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 12, fontStyle: 'italic' }}>
                  No instructions provided yet.
                </div>
              )}
              
              {role === 'admin' && !readOnly && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    onClick={() => {
                      setEditContent(content);
                      setIsEditing(true);
                    }}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Edit2 size={12} style={{ marginRight: 4 }}/> Write
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#e8eaf0', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Upload size={12} style={{ marginRight: 4 }}/> Import .docx
                  </button>
                  <input 
                    type="file" 
                    accept=".docx" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleFileUpload}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
