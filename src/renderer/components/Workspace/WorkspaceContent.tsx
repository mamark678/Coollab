import { Edit2, List, Plus, MoreHorizontal, Maximize2, Lock } from 'lucide-react';
import type { Editor } from '@tiptap/core';
import { useAppStore } from '../../store/useAppStore';
import { useBackground } from '../../context/BackgroundContext';
import CollaborativeEditor from '../Editor/CollaborativeEditor';
import { GraphView } from '../GraphView/GraphView';
import { Canvas } from '../Canvas/Canvas';
import FlashcardPanel from '../Flashcards/FlashcardPanel';
import { ActivityManager } from '../Activities/ActivityManager';
import { ActivityDashboard } from '../Activities/ActivityDashboard';
import { SlashCommand } from '../SlashCommand/SlashCommand';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { FindReplace } from '../FindReplace/FindReplace';
import { EditorToolbar } from '../EditorToolbar/EditorToolbar';
import { WordCountBar } from '../WordCount/WordCount';
import { Suspense, useState } from 'react';
import { Activity } from '../../services/activity';

type ActiveView = 'workspace' | 'activities' | 'flashcards' | 'graph' | 'canvas';

interface WorkspaceContentProps {
  activeView: ActiveView;
  currentNoteId: string | null;
  projectId: string;
  username: string;
  userId?: string;
  userColor: string;
  activeDocTitle: string;
  collaborators?: { id: string; name: string; color: string }[];
  onToggleOutline: () => void;
  onCreateDocument: (title?: string, type?: 'document' | 'folder' | 'canvas' | 'base', isFolder?: boolean) => void;
  onUpdateTitle: (title: string) => void;
  onContentUpdate: (text: string) => void;
  onEditorReady: (editor: Editor) => void;
  onNavigateToDoc: (docId: string, title?: string, type?: 'document' | 'canvas' | 'base' | 'folder' | null) => void;
  onCloseView: () => void;
  onKickMember: (uid: string, name: string) => void;
  onViewStudent: (studentId: string) => void;
  editor: Editor | null;
  viewerMode: boolean;
  viewingStudentId: string | null;
  showOutline: boolean;
  findOpen: boolean;
  findShowReplace: boolean;
  onCloseFind: () => void;
  documentText: string;
  onToggleFullscreenGraph: () => void;
  isAdmin: boolean;
  projectType: string | null;
}

export const WorkspaceContent: React.FC<WorkspaceContentProps> = ({ 
  activeView,
  currentNoteId,
  projectId,
  username,
  userId,
  userColor,
  activeDocTitle,
  collaborators = [],
  onToggleOutline,
  onCreateDocument,
  onUpdateTitle,
  onContentUpdate,
  onEditorReady,
  onNavigateToDoc,
  onCloseView,
  onKickMember,
  onViewStudent,
  editor,
  viewerMode,
  viewingStudentId,
  showOutline,
  findOpen,
  findShowReplace,
  onCloseFind,
  documentText,
  onToggleFullscreenGraph,
  isAdmin,
  projectType
}) => {
  const userRole = useAppStore(s => s.userRole);
  const sidebarSelectionId = useAppStore(s => s.sidebarSelectionId);
  const activityType = useAppStore(s => s.activityType);
  const syncStatus = useAppStore(s => s.syncStatus);
  const currentActivity = useAppStore(s => s.currentActivity);
  const currentActivityStatus = useAppStore(s => s.currentActivityStatus);
  const { activeProjectBackground } = useBackground();
  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState<Activity | null>(null);

  const isWorkspaceLocked = userRole === 'student' && 
                            currentActivity?.type === 'workspace' && 
                            currentActivityStatus === 'pending';

  // ── Render Helpers ────────────────────────────────────────────────────────

  const renderHeader = () => {
    if (activeView === 'graph') {
      return (
        <div style={{ 
          height: '48px', borderBottom: '1px  solid var(--theme-border)', 
          padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--theme-text-primary)' }}>Graph View</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onToggleFullscreenGraph} style={{ background: 'none', border: 'none', color: 'var(--theme-text-secondary)', cursor: 'pointer' }}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (activeView === 'workspace') {
      return (
        <div style={{
          height: '48px',
          borderBottom: '1px  solid var(--theme-border)',
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
              onClick={() => editor?.commands.focus()}
              style={{ background: 'none', border: 'none', color: 'var(--theme-primary)', cursor: 'pointer', padding: 0 }}
              title="Focus Editor"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={onToggleOutline}
              style={{ background: 'none', border: 'none', color: showOutline ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-secondary) 50%, transparent)', cursor: 'pointer', padding: 0 }}
              title="Document Outline"
            >
              <List size={18} />
            </button>
            {!viewingStudentId && !(isAdmin && projectType === 'activity') && (
              <button 
                onClick={() => onCreateDocument()}
                style={{ background: 'none', border: 'none', color: 'var(--theme-text-secondary)', cursor: 'pointer', padding: 0 }}
                title="Add Document"
              >
                <Plus size={18} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {collaborators.map((collab, i) => (
                <div 
                  key={collab.id}
                  title={collab.name}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: collab.color || 'var(--theme-primary)',
                    border: '2px solid var(--theme-background)',
                    marginLeft: i === 0 ? 0 : '-8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--theme-text-primary)'
                  }}
                >
                  {collab.name.substring(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
            <button style={{ background: 'none', border: 'none', color: 'var(--theme-text-secondary)', cursor: 'pointer', padding: 0 }}>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderContent = () => {
    switch (activeView) {
      case 'graph':
        return (
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Graph...</div>}>
            <GraphView
              activeDocId={sidebarSelectionId || currentNoteId}
              onNavigateToDoc={(docId) => onNavigateToDoc(docId)}
              isVisible={true}
              isFullscreen={false}
            />
          </Suspense>
        );
      case 'canvas':
        return (
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Canvas...</div>}>
            <Canvas
              roomName={`canvas-${projectId}`}
              username={username}
              userId={userId}
              readOnly={viewerMode || (!!viewingStudentId && viewingStudentId !== userId) || isWorkspaceLocked}
            />
          </Suspense>
        );
      case 'flashcards':
        return (
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Flashcards...</div>}>
            <FlashcardPanel
              documentContent={documentText || (editor?.getText() ?? '')}
              documentTitle={activeDocTitle}
              onClose={onCloseView}
            />
          </Suspense>
        );
      case 'activities':
        if (viewingSubmissionsFor) {
          return (
            <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Dashboard...</div>}>
              <ActivityDashboard
                projectId={projectId}
                onClose={() => setViewingSubmissionsFor(null)}
                onViewStudent={onViewStudent}
                onKickStudent={onKickMember}
                viewingStudentId={viewingStudentId}
                initialSubmissionsActivity={viewingSubmissionsFor}
              />
            </Suspense>
          );
        }

        return userRole === 'instructor' ? (
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Activity Manager...</div>}>
            <ActivityManager 
              projectId={projectId}
              onClose={onCloseView}
              onViewSubmissions={(activity) => setViewingSubmissionsFor(activity)}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Dashboard...</div>}>
            <ActivityDashboard
              projectId={projectId}
              onClose={onCloseView}
              onViewStudent={onViewStudent}
              onKickStudent={onKickMember}
              viewingStudentId={viewingStudentId}
            />
          </Suspense>
        );
      case 'workspace':
      default:
        return currentNoteId ? (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              borderBottom: '1px  solid var(--theme-border)',
              background: 'var(--theme-background)',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <EditorToolbar 
                editor={editor} 
                isSynced={syncStatus === 'synced'} 
                collaboratorCount={collaborators.length}
              />
            </div>
            
            <div style={{
              maxWidth: '720px',
              width: '100%',
              margin: '0 auto',
              padding: '48px 24px'
            }}>
            {editor && (
              <FindReplace
                editor={editor}
                isOpen={findOpen}
                onClose={onCloseFind}
                showReplace={findShowReplace}
              />
            )}

            <CollaborativeEditor
              key={currentNoteId}
              roomName={currentNoteId}
              projectId={projectId}
              username={username}
              userId={userId}
              color={userColor}
              title={activeDocTitle}
              onTitleChange={onUpdateTitle}
              onContentUpdate={onContentUpdate}
              onEditorReady={onEditorReady}
              readOnly={viewerMode || (!!viewingStudentId && viewingStudentId !== userId) || isWorkspaceLocked}
            />

            {editor && <SlashCommand editor={editor} />}
            {editor && <ContextMenu editor={editor} />}
          </div>

          {/* Word Count Integrated Footer */}
          {editor && !viewingStudentId && (
            <div style={{
              marginTop: 'auto',
              borderTop: '1px  solid var(--theme-border)',
              background: 'var(--theme-background)',
              padding: '4px 20px',
              flexShrink: 0
            }}>
              <WordCountBar editor={editor} />
            </div>
          )}
        </div>
        ) : isWorkspaceLocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--theme-text-secondary)', padding: '60px', textAlign: 'center' }}>
            <Lock size={48} style={{ marginBottom: '16px', color: 'var(--theme-secondary)', opacity: 0.8 }} />
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--theme-text-primary)' }}>Workspace Activity Locked</h2>
            <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--theme-text-secondary)', maxWidth: '400px', lineHeight: '1.6' }}>
              Read the instructions in the <strong>Active Objective</strong> panel on the bottom-right and click <strong>Complete Objective</strong> to unlock your files and begin.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--theme-text-secondary)', padding: '60px' }}>
            <Edit2 size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--theme-text-secondary)' }}>Project Workspace Active</h2>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Select a document from the library to begin.</p>
          </div>
        );
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: activeProjectBackground
        ? `url(${activeProjectBackground}) center/cover no-repeat`
        : 'var(--theme-background)',
      minWidth: 0,
      height: '100%',
      position: 'relative'
    }}>
      {activeProjectBackground && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'color-mix(in srgb, var(--theme-background) 80%, transparent)',
          pointerEvents: 'none',
          zIndex: 0
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {renderHeader()}
        <div className="custom-scrollbar" style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
