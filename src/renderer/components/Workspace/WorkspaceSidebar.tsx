import React, { useEffect, useState, startTransition, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, 
  Layout, 
  Activity, 
  CreditCard, 
  Network, 
  Layers,
  FileText, 
  Plus, 
  Users, 
  Settings, 
  ChevronLeft,
  Folder as FolderIcon,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Database,
  Palette,
  Lock
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { FirebaseService, DocumentSchema } from '../../services/firebase';
import { YjsService } from '../../services/yjs';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { getUserAvatar } from '../../utils/avatar.utils';

type ActiveView = 'workspace' | 'activities' | 'flashcards' | 'graph' | 'canvas';

interface SidebarItemProps {
  doc: DocumentSchema;
  level: number;
  allDocs: DocumentSchema[];
  currentNoteId: string | null;
  onSelect: (doc: DocumentSchema) => void;
  onDrop: (draggedId: string, targetId: string | null, position: 'inside' | 'before' | 'after') => void;
  onContextMenu: (e: React.MouseEvent, doc: DocumentSchema) => void;
  renamingItemId: string | null;
  renameValue: string;
  setRenameValue: (val: string) => void;
  onRenameComplete: (docId: string, newTitle: string) => void;
  onRenameCancel: () => void;
  isLocked?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  doc, level, allDocs, currentNoteId, onSelect, onDrop, 
  onContextMenu, renamingItemId, renameValue, setRenameValue, onRenameComplete, onRenameCancel,
  isLocked = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState<'inside' | 'before' | 'after' | null>(null);

  const children = allDocs.filter(d => d.parentId === doc.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  const isFolder = doc.type === 'folder' || doc.isFolder;
  const isActive = currentNoteId === doc.id;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/coollab-doc-id', doc.id);
    e.dataTransfer.effectAllowed = 'move';
    // Use a small delay to allow the drag image to be captured before hiding the original if needed
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    if (isFolder) {
      if (y < rect.height * 0.25) setIsDragOver('before');
      else if (y > rect.height * 0.75) setIsDragOver('after');
      else setIsDragOver('inside');
    } else {
      if (y < rect.height * 0.5) setIsDragOver('before');
      else setIsDragOver('after');
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('application/coollab-doc-id');
    if (draggedId && draggedId !== doc.id) {
      onDrop(draggedId, doc.id, isDragOver || 'after');
    }
    setIsDragOver(null);
  };

  const getIcon = () => {
    if (isLocked) return <Lock size={14} style={{ color: 'var(--theme-text-secondary)' }} />;
    if (isFolder) return isOpen ? <FolderOpen size={14} /> : <FolderIcon size={14} />;
    if (doc.type === 'canvas') return <Layers size={14} />;
    if (doc.type === 'base') return <Database size={14} />;
    return <FileText size={14} />;
  };

  return (
    <div 
      className="sidebar-item-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Drop indicators */}
      {isDragOver === 'before' && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--theme-primary)', zIndex: 10 }} />}
      {isDragOver === 'after' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--theme-primary)', zIndex: 10 }} />}

      <div 
        draggable={!isLocked}
        onDragStart={isLocked ? undefined : handleDragStart}
        onClick={(e) => {
          e.stopPropagation();
          if (isLocked) return;
          if (renamingItemId === doc.id) return;
          if (isFolder) {
            setIsOpen(!isOpen);
            return;
          }
          onSelect(doc);
        }}
        onContextMenu={(e) => {
          if (isLocked) return;
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, doc);
        }}
        style={{
          padding: '6px 12px',
          paddingLeft: `${12 + level * 12}px`,
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: isLocked 
            ? 'color-mix(in srgb, var(--theme-text-secondary) 30%, transparent)' 
            : isActive 
              ? 'var(--theme-text-primary)' 
              : 'var(--theme-text-secondary)',
          background: isDragOver === 'inside' 
            ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)' 
            : isActive 
              ? 'color-mix(in srgb, var(--theme-text-primary) 6%, transparent)' 
              : 'transparent',
          borderLeft: isActive ? '3px solid var(--theme-primary)' : '3px solid transparent',
          fontSize: '13px',
          cursor: isLocked ? 'not-allowed' : 'pointer',
          marginBottom: '1px',
          transition: 'all 0.2s ease',
          opacity: isDragOver === 'inside' ? 0.8 : 1
        }}
      >
        <span style={{ 
          fontSize: '10px', 
          color: 'var(--theme-text-secondary)', 
          transition: 'transform 0.2s', 
          transform: (isFolder && isOpen) ? 'rotate(90deg)' : 'rotate(0deg)',
          width: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isFolder ? '›' : ''}
        </span>
        <span style={{ 
          color: isActive 
            ? 'var(--theme-primary)' 
            : 'color-mix(in srgb, var(--theme-text-secondary) 50%, transparent)', 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          {getIcon()}
        </span>
        <span style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          flex: 1
        }}>
          {renamingItemId === doc.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onRenameComplete(doc.id, renameValue);
                }
                if (e.key === 'Escape') {
                  onRenameCancel();
                }
              }}
              onBlur={() => onRenameComplete(doc.id, renameValue)}
              onClick={e => e.stopPropagation()}
              style={{
                background: `color-mix(in srgb, var(--theme-primary) ${0.15 * 100}%, transparent)`,
                border: '1px  solid var(--theme-primary)',
                borderRadius: '4px',
                color: 'var(--theme-text-primary)',
                fontSize: '13px',
                padding: '2px 6px',
                width: '100%',
                outline: 'none'
              }}
            />
          ) : (
            doc.title || 'Untitled'
          )}
        </span>
      </div>

      {isFolder && isOpen && (
        <div className="sidebar-item-children" style={{ paddingLeft: '8px' }}>
          {children.length > 0 ? (
            children.map(child => (
              <SidebarItem 
                key={child.id} 
                doc={child} 
                level={level + 1} 
                allDocs={allDocs} 
                currentNoteId={currentNoteId}
                onSelect={onSelect}
                onDrop={onDrop}
                onContextMenu={onContextMenu}
                renamingItemId={renamingItemId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onRenameComplete={onRenameComplete}
                onRenameCancel={onRenameCancel}
                isLocked={isLocked}
              />
            ))
          ) : (
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--theme-text-secondary)', 
              padding: '4px 12px',
              paddingLeft: `${24 + level * 12}px`
            }}>
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface WorkspaceSidebarProps {
  onBackToDashboard: () => void;
  onSetWorkspaceView: () => void;
  onToggleActivities: () => void;
  onToggleFlashcards: () => void;
  onToggleGraph: () => void;
  onToggleCanvas: () => void;
  onToggleTeam: () => void;
  onToggleSettings: () => void;
  onCreateDocument: (title?: string, type?: 'document' | 'folder' | 'canvas' | 'base', isFolder?: boolean) => void;
  onSelectDoc: (docId: string, title?: string, type?: 'document' | 'canvas' | 'base' | 'folder' | null) => void;
  isAdmin: boolean;
  userRole: string | null;
  projectId: string;
  projectType: string | null;
  activeView: ActiveView;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  onBackToDashboard,
  onSetWorkspaceView,
  onToggleActivities,
  onToggleFlashcards,
  onToggleGraph,
  onToggleCanvas,
  onToggleTeam,
  onToggleSettings,
  onCreateDocument,
  onSelectDoc,
  isAdmin,
  userRole,
  projectId,
  projectType,
  activeView
}) => {
  const { 
    currentNoteId, 
    setCurrentNoteId, 
    setActiveDocTitle,
    setCurrentDocType,
    activityType,
    viewingStudentId,
    currentActivity,
    currentActivityStatus
  } = useAppStore();

  const isWorkspaceLocked = userRole === 'student' && 
                            currentActivity?.type === 'workspace' && 
                            currentActivityStatus === 'pending';
  const handleBack = () => {
    if (projectType === 'activity') {
      onToggleActivities();
    } else {
      onToggleFlashcards();
    }
  };
  const { state: { user } } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const displayName = useMemo(() => {
    if (profile?.name) return profile.name;
    if (!user) return 'Guest';
    return user.displayName || user.email?.split('@')[0] || 'Guest';
  }, [user, profile]);

  const initials = useMemo(() => {
    return displayName.substring(0, 2).toUpperCase();
  }, [displayName]);

  const avatarUrl = useMemo(() => {
    return getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL });
  }, [user, profile]);

  const [allDocs, setAllDocs] = useState<DocumentSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: DocumentSchema } | null>(null);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const handleScroll = () => setContextMenu(null);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setAllDocs([]);
      setLoading(false);
      return;
    }

    const targetUserId = activityType === 'individual'
      ? (viewingStudentId || user?.uid)
      : undefined;

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = FirebaseService.getInstance().listenToProjectNotes(
        projectId,
        (newDocs) => {
          startTransition(() => {
            // Fix: Ensure uniqueness by document ID to prevent duplication
            const uniqueDocs = new Map();
            newDocs.forEach(d => {
              if (!d.isProject) uniqueDocs.set(d.id, d);
            });
            setAllDocs(Array.from(uniqueDocs.values()));
            setLoading(false);
          });
        },
        targetUserId
      );
    } catch (err) {
      console.error('[WorkspaceSidebar] Failed to set up listener:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [projectId, activityType, user?.uid, viewingStudentId]);

  const navItems = [
    { id: 'workspace' as ActiveView, label: 'Workspace', icon: Layout, onClick: onSetWorkspaceView },
    ...(projectType === 'activity' ? [{ id: 'activities' as ActiveView, label: 'Activities', icon: Activity, onClick: onToggleActivities }] : []),
    { id: 'flashcards' as ActiveView, label: 'Flashcards', icon: CreditCard, onClick: onToggleFlashcards },
    { id: 'graph' as ActiveView, label: 'Graph View', icon: Network, onClick: onToggleGraph },
  ];

  const handleCreate = (type: string) => {
    const title = type === 'folder' ? 'Untitled Folder' : 
                  type === 'canvas' ? 'Untitled Canvas' : 
                  type === 'base' ? 'Untitled Base' : 'Untitled Document';
    
    const docType = type === 'note' ? 'document' : (type as any);
    const isFolder = type === 'folder';
    
    onCreateDocument(title, docType, isFolder);
  };

  const handleRenameComplete = async (docId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || !projectId) {
      setRenamingItemId(null);
      return;
    }
    
    const doc = allDocs.find(d => d.id === docId);
    if (doc && doc.title === trimmed) {
      setRenamingItemId(null);
      return;
    }

    try {
      const targetUserId = activityType === 'individual' ? (viewingStudentId || user?.uid) : undefined;
      await FirebaseService.getInstance().saveNote(
        docId, 
        { title: trimmed }, 
        projectId, 
        targetUserId
      );
      setAllDocs(prev => prev.map(d => d.id === docId ? { ...d, title: trimmed } : d));
      if (currentNoteId === docId) {
        setActiveDocTitle(trimmed);
        const yjsService = YjsService.getInstance();
        if (yjsService.isInitialized()) {
          const yjsDoc = yjsService.getDoc();
          const sharedTitle = yjsDoc.getText('title');
          yjsDoc.transact(() => {
            sharedTitle.delete(0, sharedTitle.length);
            if (trimmed) sharedTitle.insert(0, trimmed);
          }, 'title-sync');
        }
      }
    } catch (err) {
      console.error('[Sidebar] Rename failed:', err);
    }
    setRenamingItemId(null);
  };

  const handleDrop = useCallback(async (draggedId: string, targetId: string | null, position: 'inside' | 'before' | 'after') => {
    const draggedDoc = allDocs.find(d => d.id === draggedId);
    const targetDoc = targetId ? allDocs.find(d => d.id === targetId) : null;
    
    if (!draggedDoc) return;

    let newParentId: string | null = null;
    let newOrder = 0;

    if (targetDoc) {
      if (position === 'inside') {
        newParentId = targetDoc.id;
        const siblings = allDocs.filter(d => d.parentId === targetDoc.id);
        newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order || 0)) + 1 : 0;
      } else {
        newParentId = targetDoc.parentId || null;
        const siblings = allDocs.filter(d => d.parentId === newParentId).sort((a, b) => (a.order || 0) - (b.order || 0));
        const targetIdx = siblings.findIndex(s => s.id === targetDoc.id);
        
        if (position === 'before') {
          newOrder = (targetDoc.order || 0) - 0.5;
        } else {
          newOrder = (targetDoc.order || 0) + 0.5;
        }
      }
    } else {
      // Root level drop
      newParentId = null;
      const rootDocs = allDocs.filter(d => !d.parentId);
      newOrder = rootDocs.length > 0 ? Math.max(...rootDocs.map(r => r.order || 0)) + 1 : 0;
    }

    try {
      const targetUserId = activityType === 'individual' ? (viewingStudentId || user?.uid) : undefined;
      await FirebaseService.getInstance().saveNote(
        draggedId, 
        { parentId: newParentId, order: newOrder }, 
        projectId, 
        targetUserId
      );
    } catch (err) {
      console.error('[Sidebar] Failed to update document position:', err);
    }
  }, [allDocs, projectId, activityType, user?.uid, viewingStudentId]);

  const rootDocs = allDocs
    .filter(d => !d.parentId || d.parentId === projectId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <aside style={{
      width: '192px',
      background: 'var(--theme-background)',
      borderRight: '1px  solid var(--theme-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: '100%'
    }}>
      <div style={{ padding: '16px 20px 8px' }}>
        {activeView === 'workspace' ? (
          <button 
            onClick={handleBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--theme-text-secondary)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <ArrowLeft size={12} />
            Back to Menu
          </button>
        ) : (
          <button 
            onClick={onBackToDashboard}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--theme-text-secondary)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <ArrowLeft size={12} />
            Back to Projects
          </button>
        )}
      </div>

      {activeView !== 'workspace' && (
        <nav style={{ padding: '8px' }}>
          {navItems.map(item => {
            const isTabLocked = isWorkspaceLocked && ['flashcards', 'graph'].includes(item.id);
            return (
              <div 
                key={item.id}
                onClick={() => {
                  if (isTabLocked) return;
                  item.onClick();
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: isTabLocked 
                    ? 'color-mix(in srgb, var(--theme-text-secondary) 30%, transparent)' 
                    : activeView === item.id 
                      ? 'var(--theme-text-primary)' 
                      : 'var(--theme-text-secondary)',
                  background: !isTabLocked && activeView === item.id 
                    ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)' 
                    : 'transparent',
                  fontSize: '13px',
                  fontWeight: activeView === item.id ? 600 : 500,
                  cursor: isTabLocked ? 'not-allowed' : 'pointer',
                  marginBottom: '2px',
                  transition: 'all 0.2s ease'
                }}
              >
                {isTabLocked ? (
                  <Lock size={16} style={{ color: 'var(--theme-text-secondary)' }} />
                ) : (
                  <item.icon size={16} style={{ color: activeView === item.id ? 'var(--theme-primary)' : 'inherit' }} />
                )}
                {item.label}
              </div>
            );
          })}
        </nav>
      )}

      {activeView === 'workspace' && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', marginBottom: '8px' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => {
              const draggedId = e.dataTransfer.getData('application/coollab-doc-id');
              if (draggedId) handleDrop(draggedId, null, 'after');
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--theme-text-secondary)', textTransform: 'uppercase' }}>Library</span>
          </div>

          {/* Compact Horizontal Creation Icons */}
          {!viewingStudentId && !(isAdmin && projectType === 'activity') && !isWorkspaceLocked && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 8px 16px',
              borderBottom: '1px  solid var(--theme-border)',
              marginBottom: '12px'
            }}>
            {[
              { icon: FileText, label: 'Document', type: 'note' },
              { icon: FolderIcon, label: 'Folder', type: 'folder' },
              { icon: Database, label: 'Base', type: 'base' },
              { icon: Palette, label: 'Canvas', type: 'canvas' },
            ].map(item => (
              <button
                key={item.type}
                onClick={(e) => { e.stopPropagation(); handleCreate(item.type); }}
                title={`Create ${item.label}`}
                style={{
                  background: `color-mix(in srgb, var(--theme-text-primary) ${0.03 * 100}%, transparent)`,
                  border: '1px  solid var(--theme-border)',
                  borderRadius: '6px',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: 'var(--theme-text-secondary)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-primary) 10%, transparent)';
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--theme-primary) 30%, transparent)';
                  e.currentTarget.style.color = 'var(--theme-text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-text-primary) 3%, transparent)';
                  e.currentTarget.style.borderColor = 'var(--theme-border)';
                  e.currentTarget.style.color = 'var(--theme-text-secondary)';
                }}
              >
                <item.icon size={16} />
              </button>
            ))}
          </div>
          )}

          <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '0 8px' }}>
            {loading ? (
              <div style={{ padding: '12px', color: 'var(--theme-text-secondary)', fontSize: '12px' }}>Loading...</div>
            ) : rootDocs.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--theme-text-secondary)', fontSize: '12px', textAlign: 'center' }}>No documents found</div>
            ) : (
              rootDocs.map(doc => (
                <SidebarItem 
                  key={doc.id} 
                  doc={doc} 
                  level={0} 
                  allDocs={allDocs} 
                  currentNoteId={currentNoteId}
                  onSelect={(selected) => {
                    onSelectDoc(selected.id, selected.title, (selected.type as any) || 'document');
                  }}
                  onDrop={handleDrop}
                  onContextMenu={(e, item) => {
                    const menuWidth = 180;
                    const menuHeight = 100;
                    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX;
                    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY;
                    setContextMenu({ x, y, item });
                  }}
                  renamingItemId={renamingItemId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  onRenameComplete={handleRenameComplete}
                  onRenameCancel={() => setRenamingItemId(null)}
                  isLocked={isWorkspaceLocked}
                />
              ))
            )}
          </div>

          {contextMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
                onClick={() => setContextMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
              />
              <div style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                zIndex: 10000,
                background: 'var(--theme-surface)',
                border: '1px  solid var(--theme-border)',
                borderRadius: '10px',
                padding: '6px',
                minWidth: '180px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                animation: 'fadeIn 0.1s ease-out'
              }}>
                <button
                  onClick={() => {
                    setRenamingItemId(contextMenu.item.id);
                    setRenameValue(contextMenu.item.title || '');
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'transparent',
                    border: 'none', borderRadius: '6px', color: 'var(--theme-text-primary)',
                    fontSize: '13px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '10px', textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-text-primary) 6%, transparent)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  ✏️ Rename
                </button>
                <div style={{ height: '1px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)`, margin: '4px 0' }} />
                <button
                  onClick={async () => {
                    const confirmed = confirm(`Delete "${contextMenu.item.title}"? This cannot be undone.`);
                    if (!confirmed) { setContextMenu(null); return; }
                    try {
                      const targetUserId = activityType === 'individual' ? (viewingStudentId || user?.uid) : undefined;
                      await FirebaseService.getInstance().deleteNote(
                        contextMenu.item.id, 
                        projectId, 
                        targetUserId, 
                        contextMenu.item.type, 
                        contextMenu.item.isFolder || contextMenu.item.type === 'folder'
                      );
                      if (currentNoteId === contextMenu.item.id) {
                        setCurrentNoteId(null);
                      }
                    } catch (err) {
                      console.error('[Sidebar] Delete failed:', err);
                    }
                    setContextMenu(null);
                  }}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'transparent',
                    border: 'none', borderRadius: '6px', color: 'var(--theme-error)',
                    fontSize: '13px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '10px', textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  🗑️ Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeView !== 'workspace' && (
        <div style={{ padding: '8px', borderTop: '1px  solid var(--theme-border)', marginTop: 'auto' }}>
          {[
            { icon: Users, label: 'Team', onClick: onToggleTeam },
            { icon: Settings, label: 'Settings', onClick: onToggleSettings }
          ].map((item, i) => (
            <div 
              key={i} 
              onClick={item.onClick}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--theme-text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)';
                e.currentTarget.style.color = 'var(--theme-text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--theme-text-secondary)';
              }}
            >
              <item.icon size={16} />
              {item.label}
            </div>
          ))}
          
          <div style={{
            marginTop: '4px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--theme-text-secondary)',
            fontSize: '13px',
            cursor: 'not-allowed'
          }}>
            <ChevronLeft size={16} />
            Collapse
          </div>

          {/* User Profile Card */}
          <div 
            onClick={onToggleSettings}
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              background: `color-mix(in srgb, var(--theme-text-primary) ${0.02 * 100}%, transparent)`,
              border: '1px  solid var(--theme-border)',
              transition: 'background 0.2s ease, border-color 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-text-primary) 6%, transparent)';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--theme-text-primary) 8%, transparent)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-text-primary) 2%, transparent)';
              e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--theme-text-primary) 4%, transparent)';
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--theme-text-primary)',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={displayName} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: 600, 
                color: 'var(--theme-text-primary)', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {displayName}
              </span>
              <span style={{ 
                fontSize: '10px', 
                color: 'var(--theme-text-secondary)', 
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                {userRole || 'STUDENT'}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
