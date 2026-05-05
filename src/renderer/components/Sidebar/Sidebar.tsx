import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Database,
  FileEdit,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings
} from 'lucide-react';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { DocumentSchema, FirebaseService } from '../../services/firebase';
import { YjsService } from '../../services/yjs';
import { useAppStore } from '../../store/useAppStore';
import { getUserAvatar } from '../../utils/avatar.utils';
import { ActivityProjectSettings } from '../Activities/ActivityProjectSettings';
import { InstructionsPanel } from '../Activities/InstructionsPanel';
import { SettingsModal } from '../Settings/SettingsModal';
import './Sidebar.css';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onlineUsers?: { id: string; name: string; color: string }[];
  projectMembers?: { uid: string; name: string; role: 'Guest' | 'Owner' | 'Can Edit' }[];
  viewingStudentId?: string | null;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type SortOrder = 'manual' | 'updated' | 'alpha-asc' | 'alpha-desc';
type DropPosition = 'before' | 'inside' | 'after';
interface DropIndicator {
  id: string;        // target doc id, or 'root'
  position: DropPosition;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  collapsed = false,
  onToggleCollapse,
  onlineUsers = [],
  projectMembers = [],
  viewingStudentId = null,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { currentNoteId, setCurrentNoteId, setActiveDocTitle, currentProjectId, setCurrentProjectId, setSidebarSelectionId, currentDocType, setCurrentDocType } = useAppStore();
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

  const [allDocs, setAllDocs] = useState<DocumentSchema[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [sortOrder, setSortOrder] = useState<SortOrder>('manual');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; doc: DocumentSchema | null } | null>(null);
  const [memberContextMenu, setMemberContextMenu] = useState<{ x: number; y: number; memberUid: string } | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocTitle, setEditingDocTitle] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<'individual' | 'group' | null>(null);
  const [showActivitySettings, setShowActivitySettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Drag state lives in refs to avoid stale-closure issues ──────────────
  const draggedDocId = useRef<string | null>(null);
  const isCreating = useRef(false);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const expansionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  // ── Data loading (Real-time listener) ───────────────────────────────────
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const pid = currentProjectId;
    if (!pid) {
      setAllDocs([]);
      setLoadingDocs(false);
      return;
    }

    let isMounted = true;
    setLoadingDocs(true);

    const startListener = (pType: string | null, aType: 'individual' | 'group' | null, adminStatus: boolean) => {
      if (!isMounted) return;

      // Clean up previous subscription if any
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      // Individual activity: ALWAYS scope to a specific student workspace.
      // - Non-admins: always use their own uid
      // - Admins viewing a student: use viewingStudentId
      // - Admins NOT viewing a student: use their own uid (their own workspace)
      // Non-individual projects: no userId scoping (use global notes path)
      const targetUserId = aType === 'individual'
        ? (viewingStudentId || user?.uid)
        : undefined;

      // If it's an activity project, wait until we know the activityType to avoid path mismatch
      if (pType === 'activity' && aType === null) {
        return;
      }

      console.log(`[Sidebar] Subscribing to ${targetUserId ? 'Individual' : 'Global'} workspace for project ${pid}`);

      unsubscribeRef.current = FirebaseService.getInstance().listenToProjectNotes(
        pid,
        (docs) => {
          if (!isMounted) return;
          startTransition(() => {
            // Deduplicate docs by ID as safety net (individual workspace fires 4 subcollection listeners)
            const uniqueDocs = Array.from(
              new Map(docs.map(d => [d.id, d])).values()
            );
            setAllDocs(uniqueDocs.filter((d) => !d.isProject));
            setLoadingDocs(false);
          });
        },
        targetUserId
      );
    };

    // ✅ Fixed
    let unsubAuth: (() => void) | null = null;

    const timer = setTimeout(() => {
      unsubAuth = FirebaseService.getInstance().auth.onAuthStateChanged((firebaseUser) => {
        if (!firebaseUser || !isMounted) return;

        // Auth is confirmed — safe to proceed with Firestore calls
        FirebaseService.getInstance().getNote(pid).then(async (projectDoc) => {
          if (!isMounted) return;

          if (projectDoc) {
            const isProjectOwner = projectDoc.ownerId === firebaseUser.uid;
            setIsOwner(isProjectOwner);
            const pType = projectDoc.type || null;
            const aType = projectDoc.activityType || null;
            setProjectType(pType);
            setActivityType(aType);

            let adminStatus = false;
            if (isProjectOwner) {
              adminStatus = true;
            } else {
              const db = FirebaseService.getInstance().db;
              const { getDoc, doc } = await import('firebase/firestore');
              const permSnap = await getDoc(doc(db, 'projectPermissions', `${pid}_${firebaseUser.uid}`));
              if (permSnap.exists() && permSnap.data().role === 'admin') {
                adminStatus = true;
              }
            }
            setIsAdmin(adminStatus);
            startListener(pType, aType, adminStatus);
          } else {
            setLoadingDocs(false);
          }
        });
      });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubAuth?.();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [currentProjectId, user?.uid, viewingStudentId]);

  // ── Document interaction ─────────────────────────────────────────────────
  const handleOpenDoc = useCallback((doc: DocumentSchema) => {
    setSidebarSelectionId(doc.id);
    if (doc.isFolder) {
      setExpandedFolders(prev => ({ ...prev, [doc.id]: !prev[doc.id] }));
    } else {
      setCurrentNoteId(doc.id);
      setActiveDocTitle(doc.title || 'Untitled Document');
      setCurrentDocType((doc.type as any) || 'document');
    }
  }, [setCurrentNoteId, setActiveDocTitle, setSidebarSelectionId, setCurrentDocType]);

  const handleCreateNewFile = useCallback(async () => {
    if (isCreating.current) return;

    const fileName = newFileName.trim();
    if (!user || !fileName) {
      setIsCreatingFile(false);
      setNewFileName('');
      return;
    }

    isCreating.current = true;
    // Immediate UI cleanup to prevent double-firing from onBlur
    setIsCreatingFile(false);
    setNewFileName('');

    try {
      const newRoomId = `room-${Math.random().toString(36).substr(2, 9)}`;
      const newDoc: DocumentSchema = {
        id: newRoomId, title: fileName, content: null, ownerId: user.uid,
        collaborators: [], createdAt: Date.now(), updatedAt: Date.now(),
        isFolder: false, parentId: null, projectId: currentProjectId,
      };
      await FirebaseService.getInstance().createNote(
        newRoomId,
        newDoc,
        activityType === 'individual' && !isAdmin ? currentProjectId || undefined : undefined,
        activityType === 'individual' && !isAdmin ? user.uid : undefined
      );

      setActiveDocTitle(newDoc.title);
      setCurrentNoteId(newRoomId);
      setCurrentDocType('document');

      window.dispatchEvent(new CustomEvent('workspace-action', {
        detail: { type: 'document_created', title: fileName }
      }));
    } catch (err) {
      console.error('[Sidebar] Failed to create file:', err);
    } finally {
      isCreating.current = false;
    }
  }, [user, setCurrentNoteId, setActiveDocTitle, currentProjectId, newFileName, activityType, isAdmin, setCurrentDocType]);

  const handleCreateNewFolder = useCallback(async () => {
    if (isCreating.current) return;

    const folderName = newFolderName.trim();
    if (!user || !folderName) {
      setIsCreatingFolder(false);
      setNewFolderName('');
      return;
    }

    isCreating.current = true;
    // Immediate UI cleanup to prevent double-firing from onBlur
    setIsCreatingFolder(false);
    setNewFolderName('');

    try {
      const newRoomId = `folder-${Math.random().toString(36).substr(2, 9)}`;
      const newDoc: DocumentSchema = {
        id: newRoomId, title: folderName, content: null, ownerId: user.uid,
        collaborators: [], createdAt: Date.now(), updatedAt: Date.now(),
        isFolder: true, parentId: null, projectId: currentProjectId,
      };
      await FirebaseService.getInstance().createNote(
        newRoomId,
        newDoc,
        activityType === 'individual' && !isAdmin ? currentProjectId || undefined : undefined,
        activityType === 'individual' && !isAdmin ? user.uid : undefined
      );
      setExpandedFolders(prev => ({ ...prev, [newRoomId]: true }));

      window.dispatchEvent(new CustomEvent('workspace-action', {
        detail: { type: 'folder_created', name: folderName }
      }));
    } catch (err) {
      console.error('[Sidebar] Failed to create folder:', err);
    } finally {
      isCreating.current = false;
    }
  }, [user, currentProjectId, newFolderName, activityType, isAdmin]);

  const handleCreateCanvas = useCallback(async () => {
    if (isCreating.current || !user || !currentProjectId) return;
    isCreating.current = true;
    try {
      const id = `canvas-${Math.random().toString(36).substr(2, 9)}`;
      await FirebaseService.getInstance().createNote(id, {
        id, title: 'Untitled Canvas', content: JSON.stringify({ nodes: [], edges: [] }),
        ownerId: user.uid, collaborators: [], createdAt: Date.now(), updatedAt: Date.now(),
        type: 'canvas', projectId: currentProjectId
      },
        activityType === 'individual' && !isAdmin ? currentProjectId : undefined,
        activityType === 'individual' && !isAdmin ? user.uid : undefined);
      setCurrentNoteId(id);
      setActiveDocTitle('Untitled Canvas');
      setCurrentDocType('canvas');
    } finally {
      isCreating.current = false;
    }
  }, [user, currentProjectId, activityType, isAdmin, setCurrentNoteId, setActiveDocTitle]);

  const handleCreateBase = useCallback(async () => {
    if (isCreating.current || !user || !currentProjectId) return;
    isCreating.current = true;
    try {
      const id = `base-${Math.random().toString(36).substr(2, 9)}`;
      await FirebaseService.getInstance().createNote(id, {
        id, title: 'Untitled Base', content: JSON.stringify({ views: [] }),
        ownerId: user.uid, collaborators: [], createdAt: Date.now(), updatedAt: Date.now(),
        type: 'base', projectId: currentProjectId
      },
        activityType === 'individual' && !isAdmin ? currentProjectId : undefined,
        activityType === 'individual' && !isAdmin ? user.uid : undefined);
      setCurrentNoteId(id);
      setActiveDocTitle('Untitled Base');
      setCurrentDocType('base');
    } finally {
      isCreating.current = false;
    }
  }, [user, currentProjectId, activityType, isAdmin, setCurrentNoteId, setActiveDocTitle]);

  const handleToggleSort = useCallback(() => {
    setSortOrder(prev => {
      if (prev === 'manual') return 'updated';
      if (prev === 'updated') return 'alpha-asc';
      if (prev === 'alpha-asc') return 'alpha-desc';
      return 'manual';
    });
  }, []);

  const handleToggleExpandAll = useCallback(() => {
    const folders = allDocs.filter(d => d.isFolder);
    const anyCollapsed = folders.some(f => !expandedFolders[f.id]);
    const newExpanded: Record<string, boolean> = {};
    folders.forEach(f => { newExpanded[f.id] = anyCollapsed; });
    setExpandedFolders(newExpanded);
  }, [allDocs, expandedFolders]);

  // ── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent, doc: DocumentSchema) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, doc });
  };
  const closeContextMenu = () => setContextMenu(null);

  const startRenaming = useCallback((doc: DocumentSchema) => {
    setEditingDocId(doc.id);
    setEditingDocTitle(doc.title);
    closeContextMenu();
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingDocId) return;
    const trimmedTitle = editingDocTitle.trim() || 'Untitled Note';

    // Bug 2: Debounce write (though rename is usually a one-off, 
    // it helps if the user rapid-fires or if the UI re-renders)
    try {
      await FirebaseService.getInstance().saveNote(
        editingDocId,
        { title: trimmedTitle },
        activityType === 'individual' && !isAdmin ? currentProjectId || undefined : undefined,
        activityType === 'individual' && !isAdmin ? user?.uid : undefined
      );
      startTransition(() => {
        setAllDocs(prev => prev.map(d => d.id === editingDocId ? { ...d, title: trimmedTitle } : d));
        if (currentNoteId === editingDocId) setActiveDocTitle(trimmedTitle);
      });
    } catch (err) {
      console.error('[Sidebar] Failed to rename:', err);
    } finally {
      setEditingDocId(null);
    }
  }, [editingDocId, editingDocTitle, currentNoteId, setActiveDocTitle, activityType, isAdmin, currentProjectId, user?.uid]);

  const handleDeleteDoc = useCallback(async (doc: DocumentSchema) => {
    if (!confirm(`Are you sure you want to delete "${doc.title}"?`)) { closeContextMenu(); return; }
    try {
      await FirebaseService.getInstance().deleteNote(
        doc.id,
        activityType === 'individual' && !isAdmin ? currentProjectId || undefined : undefined,
        activityType === 'individual' && !isAdmin ? user?.uid : undefined,
        doc.type,
        doc.isFolder
      );
      setAllDocs(prev => prev.filter(d => d.id !== doc.id));
      if (currentNoteId === doc.id) setCurrentNoteId(null);
      window.dispatchEvent(new CustomEvent('coollab-doc-deleted', { detail: { docId: doc.id } }));
      // Global fix for focus bug on Windows: force reload after delete
      window.location.reload();
    } catch (err) {
      console.error('[Sidebar] Failed to delete:', err);
      setDeleteError(`Failed to delete "${doc.title}". Please try again.`);
      setTimeout(() => setDeleteError(null), 3000);
    } finally {
      closeContextMenu();
    }
  }, [currentNoteId, setCurrentNoteId, activityType, isAdmin, currentProjectId, user?.uid]);

  const handleMemberKick = async (uid: string) => {
    if (!currentProjectId) return;
    if (window.confirm('Are you sure you want to remove this member? They will lose access immediately.')) {
      try {
        await FirebaseService.getInstance().removeCollaborator(currentProjectId, uid);
        setMemberContextMenu(null);
      } catch (err) {
        console.error('[Sidebar] Failed to kick member:', err);
        alert('Failed to remove member. You might not have sufficient permissions.');
      }
    }
  };

  useEffect(() => {
    const hide = () => { setContextMenu(null); setMemberContextMenu(null); };
    window.addEventListener('click', hide);
    return () => window.removeEventListener('click', hide);
  }, []);

  // ── Drag helpers ─────────────────────────────────────────────────────────
  const clearExpansionTimer = () => {
    if (expansionTimer.current) {
      clearTimeout(expansionTimer.current);
      expansionTimer.current = null;
    }
  };

  const resetDragState = useCallback(() => {
    draggedDocId.current = null;
    dragCounter.current = {};
    setDropIndicator(null);
    clearExpansionTimer();
  }, []);

  const getDropPosition = (e: React.DragEvent, target: DocumentSchema): DropPosition => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    if (target.isFolder) {
      if (ratio < 0.2) return 'before';
      if (ratio > 0.8) return 'after';
      return 'inside';
    }
    return ratio < 0.5 ? 'before' : 'after';
  };

  const isDescendant = useCallback((docId: string, ancestorId: string): boolean => {
    let current = allDocs.find(d => d.id === docId);
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true;
      const parentId = current.parentId;
      current = allDocs.find(d => d.id === parentId);
    }
    return false;
  }, [allDocs]);

  const handleDragStart = useCallback((e: React.DragEvent, doc: DocumentSchema) => {
    draggedDocId.current = doc.id;
    dragCounter.current = {};
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', doc.id);
    setTimeout(() => {
      const el = e.currentTarget as HTMLElement;
      el.style.opacity = '0.4';
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '';
    resetDragState();
  }, [resetDragState]);

  const handleDragEnter = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current[id] = (dragCounter.current[id] ?? 0) + 1;
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, id: string) => {
    dragCounter.current[id] = (dragCounter.current[id] ?? 1) - 1;
    if (dragCounter.current[id] <= 0) {
      dragCounter.current[id] = 0;
      setDropIndicator(prev => (prev?.id === id ? null : prev));
      clearExpansionTimer();
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, target: DocumentSchema | 'root') => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedDocId.current) return;

    if (target === 'root') {
      e.dataTransfer.dropEffect = 'move';
      setDropIndicator({ id: 'root', position: 'inside' });
      clearExpansionTimer();
      return;
    }

    const dragId = draggedDocId.current;
    if (target.id === dragId || isDescendant(target.id, dragId)) return;

    e.dataTransfer.dropEffect = 'move';
    const position = getDropPosition(e, target);
    setDropIndicator({ id: target.id, position });

    if (target.isFolder && position === 'inside') {
      if (!expansionTimer.current) {
        expansionTimer.current = setTimeout(() => {
          setExpandedFolders(prev => ({ ...prev, [target.id]: true }));
          expansionTimer.current = null;
        }, 600);
      }
    } else {
      clearExpansionTimer();
    }
  }, [isDescendant]);

  const handleDrop = useCallback(async (e: React.DragEvent, target: DocumentSchema | 'root') => {
    e.preventDefault();
    e.stopPropagation();

    const dragId = draggedDocId.current;
    const indicator = dropIndicator;
    resetDragState();

    if (!dragId || !indicator) return;

    const getSiblings = (parentId: string | null) =>
      allDocs
        .filter(d => (d.parentId ?? null) === parentId && d.id !== dragId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let newParentId: string | null = null;
    let newOrder = Date.now();

    if (target !== 'root' && indicator.position === 'inside') {
      if (target.id === dragId || isDescendant(target.id, dragId)) return;
      newParentId = target.id;
      const siblings = getSiblings(newParentId);
      newOrder = siblings.length > 0 ? (siblings[siblings.length - 1].order ?? 0) + 100 : 100;
    } else if (target !== 'root') {
      newParentId = target.parentId ?? null;
      const siblings = getSiblings(newParentId);
      const idx = siblings.findIndex(s => s.id === target.id);

      if (idx !== -1) {
        if (indicator.position === 'before') {
          const prev = siblings[idx - 1];
          const cur = siblings[idx].order ?? 0;
          newOrder = prev ? ((prev.order ?? 0) + cur) / 2 : cur - 100;
        } else {
          const next = siblings[idx + 1];
          const cur = siblings[idx].order ?? 0;
          newOrder = next ? (cur + (next.order ?? 0)) / 2 : cur + 100;
        }
      }
    } else {
      newParentId = null;
      const siblings = getSiblings(null);
      newOrder = siblings.length > 0 ? (siblings[siblings.length - 1].order ?? 0) + 100 : 100;
    }

    setAllDocs(prev =>
      prev.map(d => d.id === dragId ? { ...d, parentId: newParentId, order: newOrder } : d)
    );
    if (newParentId) {
      setExpandedFolders(prev => ({ ...prev, [newParentId!]: true }));
    }
    setSortOrder('manual');

    try {
      await FirebaseService.getInstance().saveNote(
        dragId,
        { parentId: newParentId, order: newOrder },
        activityType === 'individual' && !isAdmin ? currentProjectId || undefined : undefined,
        activityType === 'individual' && !isAdmin ? user?.uid : undefined
      );
    } catch (err) {
      console.error('[Sidebar] Drop save failed:', err);
    }
  }, [dropIndicator, allDocs, isDescendant, resetDragState, activityType, isAdmin, currentProjectId, user?.uid]);

  // ── Tree rendering ────────────────────────────────────────────────────────
  const renderDocs = useMemo(() => {
    // Deduplicate by ID to prevent flicker/duplication
    const uniqueDocs = Array.from(
      new Map(allDocs.map(doc => [doc.id, doc])).values()
    );
    const sorted = [...uniqueDocs].sort((a, b) => {
      if (sortOrder === 'manual') {
        const oa = a.order ?? Number.MAX_SAFE_INTEGER;
        const ob = b.order ?? Number.MAX_SAFE_INTEGER;
        return oa === ob ? (b.updatedAt || 0) - (a.updatedAt || 0) : oa - ob;
      }
      if (sortOrder === 'updated') return (b.updatedAt || 0) - (a.updatedAt || 0);
      if (sortOrder === 'alpha-asc') return a.title.localeCompare(b.title);
      return b.title.localeCompare(a.title);
    });

    const rootDocs = sorted.filter(d => !d.parentId);
    const childrenByParent = sorted.reduce((acc, doc) => {
      if (doc.parentId) {
        if (!acc[doc.parentId]) acc[doc.parentId] = [];
        acc[doc.parentId].push(doc);
      }
      return acc;
    }, {} as Record<string, DocumentSchema[]>);

    const renderNode = (doc: DocumentSchema, depth = 0): React.ReactNode => {
      const isExpanded = !!expandedFolders[doc.id];
      const children = childrenByParent[doc.id] || [];
      const dropPos = dropIndicator?.id === doc.id ? dropIndicator.position : null;

      const dropClass = dropPos
        ? dropPos === 'inside'
          ? 'sidebar__doc-item--drop-inside'
          : dropPos === 'before'
            ? 'sidebar__doc-item--drop-before'
            : 'sidebar__doc-item--drop-after'
        : '';

      return (
        <React.Fragment key={doc.id}>
          <div
            role="button"
            tabIndex={0}
            draggable
            data-doc-id={doc.id}
            onDragStart={e => handleDragStart(e, doc)}
            onDragEnd={handleDragEnd}
            onDragEnter={e => handleDragEnter(e, doc.id)}
            onDragLeave={e => handleDragLeave(e, doc.id)}
            onDragOver={e => handleDragOver(e, doc)}
            onDrop={e => handleDrop(e, doc)}
            className={`sidebar__doc-item ${currentNoteId === doc.id ? 'sidebar__doc-item--active' : ''} ${dropClass}`}
            onClick={() => handleOpenDoc(doc)}
            onContextMenu={e => handleContextMenu(e, doc)}
            title={doc.title || (doc.isFolder ? 'New Folder' : 'Untitled Document')}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {doc.isFolder
              ? isExpanded
                ? <ChevronDown size={14} className="sidebar-folder-chevron" />
                : <ChevronRight size={14} className="sidebar-folder-chevron" />
              : null}

            {!doc.isFolder && (
              <>
                {doc.type === 'canvas' ? (
                  <LayoutGrid size={16} className="sidebar__doc-icon" style={{ color: '#7c3aed' }} />
                ) : doc.type === 'base' ? (
                  <Database size={16} className="sidebar__doc-icon" style={{ color: '#0ea5e9' }} />
                ) : (
                  <FileText size={16} className="sidebar__doc-icon" />
                )}
              </>
            )}
            {doc.isFolder && isExpanded && <FolderOpen size={16} className="sidebar__doc-icon" />}
            {doc.isFolder && !isExpanded && <Folder size={16} className="sidebar__doc-icon" />}

            {editingDocId === doc.id ? (
              <input
                type="text"
                value={editingDocTitle}
                ref={(el) => {
                  if (el) {
                    setTimeout(() => el.focus(), 50); // Bug 2.5: Focus fix
                  }
                }}
                onChange={e => { e.stopPropagation(); setEditingDocTitle(e.target.value); }}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditingDocId(null);
                }}
                onKeyUp={e => e.stopPropagation()}
                onBlur={commitRename}
                className="sidebar__rename-input"
              />
            ) : (
              <span className="sidebar__doc-name">{doc.title}</span>
            )}
          </div>

          {doc.isFolder && isExpanded && (
            <div className="sidebar__folder-children">
              {children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </React.Fragment>
      );
    };

    return <>{rootDocs.map(f => renderNode(f, 0))}</>;
  }, [allDocs, expandedFolders, currentNoteId, sortOrder, handleOpenDoc, editingDocId, editingDocTitle, commitRename, dropIndicator, handleDragStart, handleDragEnd, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return (
    <>
      <div className={`sidebar-overlay ${isMobileOpen ? 'mobile-open' : ''}`} onClick={onCloseMobile} />
      <div className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar__brand">
          <img src={logo} alt="Coollab Logo" className="sidebar__logo" />
          {!collapsed && <span className="sidebar__brand-name">Coollab</span>}
        </div>
        <div className="sidebar__explorer-header">
          {!collapsed && (
            <div className="sidebar__explorer-actions">
              {currentProjectId && (
                <>
                  {/* Hide creation buttons when admin is viewing a student workspace OR in admin dashboard mode */}
                  {!viewingStudentId && !(isAdmin && projectType === 'activity') && (
                    <>
                      <button className="sidebar__action-btn" onClick={() => { setIsCreatingFile(true); setNewFileName('New Document'); }} title="New document">
                        <FileEdit size={16} />
                      </button>
                      <button className="sidebar__action-btn" onClick={handleCreateCanvas} title="New Canvas">
                        <LayoutGrid size={16} />
                      </button>
                      <button className="sidebar__action-btn" onClick={handleCreateBase} title="New Base">
                        <Database size={16} />
                      </button>
                      <button className="sidebar__action-btn" onClick={() => setIsCreatingFolder(true)} title="New folder">
                        <FolderPlus size={16} />
                      </button>
                    </>
                  )}
                  {/* Activity Settings — only for admin in activity projects, and only when not viewing student */}
                  {isAdmin && projectType === 'activity' && !viewingStudentId && (
                    <button className="sidebar__action-btn" onClick={() => setShowActivitySettings(true)} title="Activity Project Settings">
                      <Settings size={16} color="#7c6bf0" />
                    </button>
                  )}
                  {/* Sort and Expand — always available unless in admin dashboard mode */}
                  {!(isAdmin && projectType === 'activity' && !viewingStudentId) && (
                    <>
                      <button className="sidebar__action-btn" onClick={handleToggleSort} title={`Sort: ${sortOrder}`}>
                        <ArrowUpDown size={16} />
                      </button>
                      <button className="sidebar__action-btn" onClick={handleToggleExpandAll} title="Expand/collapse all">
                        <ChevronsUpDown size={16} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <button onClick={onToggleCollapse} className="sidebar__toggle"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}>
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {!collapsed && (
          <div
            className={`sidebar__documents file-tree ${dropIndicator?.id === 'root' ? 'sidebar__documents--drop-target' : ''}`}
            onDragEnter={e => handleDragEnter(e, 'root')}
            onDragLeave={e => handleDragLeave(e, 'root')}
            onDragOver={e => handleDragOver(e, 'root')}
            onDrop={e => handleDrop(e, 'root')}
          >
            <button
              className="sidebar__doc-item sidebar__doc-item--nav"
              onClick={() => {
                setCurrentProjectId(null);
                setCurrentNoteId(null);
              }}
            >
              <Home size={16} className="sidebar__doc-icon" />
              <span className="sidebar__doc-name">Back to Dashboard</span>
            </button>

            {projectType === 'activity' && currentProjectId && (
              <InstructionsPanel projectId={currentProjectId} readOnly={!!viewingStudentId} />
            )}

            {viewingStudentId && (
              <div style={{ padding: '8px 12px', background: 'rgba(124, 107, 240, 0.1)', borderRadius: '6px', margin: '8px', border: '1px solid rgba(124, 107, 240, 0.2)' }}>
                <div style={{ fontSize: '11px', color: '#9485f5', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Viewing Student</div>
                <div style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{projectMembers.find(m => m.uid === viewingStudentId)?.name || 'Unknown'}</div>
              </div>
            )}

            {isCreatingFolder && (
              <div style={{ padding: '4px 8px' }}>
                <input
                  type="text"
                  placeholder="Folder name..."
                  ref={(el) => {
                    if (el) setTimeout(() => el.focus(), 50);
                  }}
                  value={newFolderName}
                  onChange={e => { e.stopPropagation(); setNewFolderName(e.target.value); }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleCreateNewFolder();
                    if (e.key === 'Escape') { setIsCreatingFolder(false); setNewFolderName(''); }
                  }}
                  onKeyUp={e => e.stopPropagation()}
                  onBlur={() => newFolderName.trim() ? handleCreateNewFolder() : setIsCreatingFolder(false)}
                  style={{
                    width: '100%', padding: '4px 8px', borderRadius: '4px',
                    background: '#0d0d1a', border: '1px solid #1e1e3f',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>
            )}

            {isCreatingFile && (
              <div style={{ padding: '4px 8px' }}>
                <input
                  type="text"
                  placeholder="Document name..."
                  ref={(el) => {
                    if (el) setTimeout(() => el.focus(), 50);
                  }}
                  value={newFileName}
                  onChange={e => { e.stopPropagation(); setNewFileName(e.target.value); }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleCreateNewFile();
                    if (e.key === 'Escape') { setIsCreatingFile(false); setNewFileName(''); }
                  }}
                  onKeyUp={e => e.stopPropagation()}
                  onBlur={() => newFileName.trim() ? handleCreateNewFile() : setIsCreatingFile(false)}
                  style={{
                    width: '100%', padding: '4px 8px', borderRadius: '4px',
                    background: '#0d0d1a', border: '1px solid #1e1e3f',
                    color: '#fff', fontSize: '13px', outline: 'none'
                  }}
                />
              </div>
            )}

            {loadingDocs ? (
              <div className="sidebar__loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '12px' }}>
                <div className="sidebar__loading-spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(124, 107, 240, 0.1)', borderTopColor: '#7c6bf0', borderRadius: '50%', animation: 'spin 1.5s linear infinite' }} />
                <span style={{ fontSize: '12px', color: '#a0a4b8' }}>Fetching workspace...</span>
                <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
              `}</style>
              </div>
            ) : allDocs.length > 0 ? renderDocs : (
              <div className="sidebar__empty">No documents yet.</div>
            )}
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="sidebar__footer">
          <div className="sidebar__footer-content">
            <button
              className="sidebar__user"
              onClick={() => setShowSettingsModal(true)}
              title="Profile Settings"
            >
              <div className="sidebar__user-avatar">
                {getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) ? (
                  <img
                    src={getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL })!}
                    alt={displayName}
                    className="sidebar__user-avatar-img"
                  />
                ) : initials}
              </div>
              {!collapsed && <span className="sidebar__user-name">{displayName}</span>}
            </button>

            {!collapsed && (
              <div className="sidebar__footer-actions">
                <button className="sidebar__footer-btn" onClick={() => setShowSettingsModal(true)}>
                  <Settings size={14} />
                  <span>Settings</span>
                </button>
                <button className="sidebar__footer-btn sidebar__footer-btn--logout" onClick={() => setShowLogoutConfirm(true)}>
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {contextMenu && !viewingStudentId && (
          <div
            className="sidebar-context-menu"
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: contextMenu.y, left: contextMenu.x,
              background: '#0a0a14', border: '1px solid #1e1e3f', borderRadius: '6px',
              padding: '4px', zIndex: 10000, display: 'flex', flexDirection: 'column',
              minWidth: '130px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
            }}
          >
            <button type="button"
              onClick={e => { e.stopPropagation(); startRenaming(contextMenu.doc!); }}
              style={{
                padding: '8px 12px', textAlign: 'left', background: 'transparent',
                border: 'none', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px', fontSize: '13px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e1e3f'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Rename</button>
            {contextMenu.doc?.ownerId === user?.uid && (
              <button type="button"
                onClick={e => { e.stopPropagation(); handleDeleteDoc(contextMenu.doc!); }}
                style={{
                  padding: '8px 12px', textAlign: 'left', background: 'transparent',
                  border: 'none', color: '#ff4d4f', cursor: 'pointer', borderRadius: '4px', fontSize: '13px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e3f'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >Delete</button>
            )}
          </div>
        )}

        {memberContextMenu && (
          <div
            className="sidebar-context-menu"
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'fixed', top: memberContextMenu.y, left: memberContextMenu.x,
              background: '#0a0a14', border: '1px solid #1e1e3f', borderRadius: '6px',
              padding: '4px', zIndex: 10001, display: 'flex', flexDirection: 'column',
              minWidth: '160px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
            }}
          >
            <button type="button"
              onClick={e => { e.stopPropagation(); handleMemberKick(memberContextMenu.memberUid); }}
              style={{
                padding: '8px 12px', textAlign: 'left', background: 'transparent',
                border: 'none', color: '#ff4d4f', cursor: 'pointer', borderRadius: '4px', fontSize: '13px',
                fontWeight: 500
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 77, 79, 0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Remove from Project</button>
          </div>
        )}
        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div className="modal-content modal-content--small" onClick={e => e.stopPropagation()}>
              <h3>Log out?</h3>
              <p>Are you sure you want to log out?</p>
              <div className="modal-actions">
                <button className="btn btn--secondary" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
                <button className="btn btn--danger" onClick={async () => {
                  try {
                    sessionStorage.setItem('explicitly_logged_out', 'true');
                    useAppStore.getState().reset();
                    await YjsService.getInstance().clearAllPersistence();
                    await FirebaseService.getInstance().auth.signOut();
                    window.location.hash = '#/login';
                  } catch (err) {
                    console.error('[Sidebar] Logout failed:', err);
                    window.location.reload();
                  }
                }}>Log out</button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />

        {/* Activity Project Settings Modal */}
        {currentProjectId && (
          <ActivityProjectSettings
            isOpen={showActivitySettings}
            onClose={() => setShowActivitySettings(false)}
            projectId={currentProjectId}
          />
        )}

        {deleteError && (
          <div style={{
            position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
            background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '4px',
            zIndex: 1000, fontSize: '13px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}>
            {deleteError}
          </div>
        )}
      </div>
    </>
  );
});