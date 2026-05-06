import type { Editor } from '@tiptap/core'
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, memo } from 'react'
import * as Y from 'yjs'
import { Capacitor } from '@capacitor/core'
import { Base } from './components/Base/Base'
import { Canvas } from './components/Canvas/Canvas'
import { DocumentDashboard } from './components/Dashboard/DocumentDashboard'
import CollaborativeEditor from './components/Editor/CollaborativeEditor'
import { EditorToolbar } from './components/EditorToolbar/EditorToolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Toolbar } from './components/Toolbar/Toolbar'
import { FirebaseService } from './services/firebase'
import { motion, AnimatePresence } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'

import {
  Eye,
  FileText,
  GitBranch,
  Home,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  Menu,
  Search,
  Sliders,
  Sparkles,
  Target,
  Trophy,
  WifiOff,
  X
} from 'lucide-react'
// Lazy loaded heavy components
const ActivityDashboard = lazy(() => import('./components/Activities/ActivityDashboard').then(m => ({ default: m.ActivityDashboard })));
const ActivityPanel = lazy(() => import('./components/Activities/ActivityPanel').then(m => ({ default: m.ActivityPanel })));
const FlashcardPanel = lazy(() => import('./components/Flashcards/FlashcardPanel').then(m => ({ default: m.FlashcardPanel })));
const GraphView = lazy(() => import('./components/GraphView/GraphView').then(m => ({ default: m.GraphView })));
const ActivityAIAgent = lazy(() => import('./components/Activities/ActivityAIAgent').then(m => ({ default: m.ActivityAIAgent })));
const StudentActivityDisplay = lazy(() => import('./components/Activities/StudentActivityDisplay').then(m => ({ default: m.StudentActivityDisplay })));
const BacklinksPanel = lazy(() => import('./components/Backlinks/BacklinksPanel').then(m => ({ default: m.BacklinksPanel })));
const CollaboratorList = lazy(() => import('./components/CollaboratorList/CollaboratorList').then(m => ({ default: m.CollaboratorList })));
const CommentsPanel = lazy(() => import('./components/CommentsPanel/CommentsPanel').then(m => ({ default: m.CommentsPanel })));
const DocumentOutline = lazy(() => import('./components/DocumentOutline/DocumentOutline').then(m => ({ default: m.DocumentOutline })));
const ExportMenu = lazy(() => import('./components/ExportMenu/ExportMenu').then(m => ({ default: m.ExportMenu })));
const FindReplace = lazy(() => import('./components/FindReplace/FindReplace').then(m => ({ default: m.FindReplace })));
const PropertiesPanel = lazy(() => import('./components/PropertiesPanel/PropertiesPanel').then(m => ({ default: m.PropertiesPanel })));
const QuickSwitcher = lazy(() => import('./components/QuickSwitcher/QuickSwitcher').then(m => ({ default: m.QuickSwitcher })));
const SearchModal = lazy(() => import('./components/Search/SearchModal').then(m => ({ default: m.SearchModal })));
const SlashCommand = lazy(() => import('./components/SlashCommand/SlashCommand').then(m => ({ default: m.SlashCommand })));
const VersionHistoryPanel = lazy(() => import('./components/VersionHistory/VersionHistoryPanel').then(m => ({ default: m.VersionHistoryPanel })));
const ShareDialog = lazy(() => import('./components/ShareDialog/ShareDialog').then(m => ({ default: m.ShareDialog })));
const ContextMenu = lazy(() => import('./components/ContextMenu/ContextMenu').then(m => ({ default: m.ContextMenu })));
const WordCountBar = lazy(() => import('./components/WordCount/WordCount').then(m => ({ default: m.WordCountBar })));
const ActivityBuilderInline = lazy(() => import('./components/Activities/ActivityBuilderInline').then(m => ({ default: m.ActivityBuilderInline })));
const EvaluationResultPanel = lazy(() => import('./components/Evaluation/EvaluationResultPanel'));
import { VerificationBanner } from './components/auth/VerificationBanner'
import { NotificationsDropdown } from './components/Notifications/NotificationsDropdown'
import { useAuth } from './hooks/useAuth'
import { useUserProfile } from './hooks/useUserProfile'
import { ActivityFlowService } from './services/ActivityFlowService'
import { EvaluationResult, StudentEvaluationService } from './services/StudentEvaluationService'
import { useAppStore } from './store/useAppStore'
import { getUserAvatar } from './utils/avatar.utils'
import { useNotifications } from './context/NotificationContext'

// Stable random identity per app session (re-renders won't change it)
const SESSION_COLORS = ['#7c6bf0', '#6dd49e', '#4ea1f7', '#e67a7a', '#e6c96e', '#9485f5']
const SESSION_COLOR = SESSION_COLORS[Math.floor(Math.random() * SESSION_COLORS.length)]

type RightPanelTab = 'collaborators' | 'comments' | 'outline' | 'backlinks' | 'graph'

// ── Presence Tracker Component (Isolated Renders) ────────────────────────
const PresenceTracker = memo(() => {
  const { state: { user } } = useAuth();
  const { 
    currentNoteId, 
    activeDocTitle,
    setOnlineCollaborators 
  } = useAppStore(useShallow(s => ({
    currentNoteId: s.currentNoteId,
    activeDocTitle: s.activeDocTitle,
    setOnlineCollaborators: s.setOnlineCollaborators
  })));
  const { addNotification } = useNotifications();
  const { profile } = useUserProfile(user?.uid);
  const color = profile?.color || '#7c6bf0';
  const username = profile?.name || user?.displayName || 'User';
  const userPhoto = profile?.photoURL || null;

  useEffect(() => {
    if (!user?.uid || !currentNoteId) {
      setOnlineCollaborators([]);
      return;
    }

    const firebase = FirebaseService.getInstance();
    const heartbeat = setInterval(() => {
      firebase.updatePresence(currentNoteId, user.uid, {
        name: username,
        status: 'editing',
        photoURL: userPhoto,
        color: color,
        platform: Capacitor.getPlatform() === 'web' ? (window.electronAPI ? 'desktop' : 'web') : 'mobile',
        lastSeen: Date.now()
      });
    }, 10000);

    firebase.updatePresence(currentNoteId, user.uid, {
      name: username,
      status: 'editing',
      photoURL: userPhoto,
      color: color,
      platform: Capacitor.getPlatform() === 'web' ? (window.electronAPI ? 'desktop' : 'web') : 'mobile',
      lastSeen: Date.now()
    });

    const unsubscribe = firebase.listenToPresence(currentNoteId, (users) => {
      const now = Date.now();
      const active = users.filter(u => {
        const lastSeenMs = (u.lastSeen && typeof u.lastSeen === 'object' && 'seconds' in u.lastSeen)
          ? u.lastSeen.seconds * 1000
          : (typeof u.lastSeen === 'number' ? u.lastSeen : 0);
        return (now - lastSeenMs) < 60000;
      }).map(u => ({
        id: u.uid,
        name: u.name || 'Collaborator',
        color: u.color || '#7c6bf0',
        photoURL: u.photoURL,
        platform: u.platform || 'unknown'
      }));

      // Only notify if we have the notification hook access (which we do here)
      setOnlineCollaborators(active);
    });

    return () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
  }, [user?.uid, currentNoteId, username, color, userPhoto, setOnlineCollaborators]);

  return null;
});

export function App() {
  const {
    currentProjectId,
    currentNoteId,
    sidebarSelectionId,
    activeDocTitle,
    syncStatus,
    viewerMode,
    projectMembers,
    activityType,
    viewingStudentId,
    onlineCollaborators,
    currentDocType,
    setCurrentProjectId,
    setCurrentNoteId,
    setSidebarSelectionId,
    setActiveDocTitle,
    setSyncStatus,
    setCurrentDocType,
    setProjectMembers,
    setActivityType,
    setViewingStudentId
  } = useAppStore(useShallow(s => ({
    currentProjectId: s.currentProjectId,
    currentNoteId: s.currentNoteId,
    sidebarSelectionId: s.sidebarSelectionId,
    activeDocTitle: s.activeDocTitle,
    syncStatus: s.syncStatus,
    viewerMode: s.viewerMode,
    projectMembers: s.projectMembers,
    activityType: s.activityType,
    viewingStudentId: s.viewingStudentId,
    onlineCollaborators: s.onlineCollaborators,
    currentDocType: s.currentDocType,
    setCurrentProjectId: s.setCurrentProjectId,
    setCurrentNoteId: s.setCurrentNoteId,
    setSidebarSelectionId: s.setSidebarSelectionId,
    setActiveDocTitle: s.setActiveDocTitle,
    setSyncStatus: s.setSyncStatus,
    setCurrentDocType: s.setCurrentDocType,
    setProjectMembers: s.setProjectMembers,
    setActivityType: s.setActivityType,
    setViewingStudentId: s.setViewingStudentId
  })));
  const { state: { user } } = useAuth()

  const { profile } = useUserProfile(user?.uid)

  const username = useMemo(() => {
    if (profile?.name) return profile.name
    if (!user) return 'Guest'
    return user.displayName || user.email?.split('@')[0] || 'Guest'
  }, [user, profile])

  const userPhoto = useMemo(() => {
    return getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL })
  }, [profile, user])

  const userProviderData = useMemo(() => {
    return user?.providerData?.map(p => ({ providerId: p.providerId })) || []
  }, [user])

  // Bug 1: Move useRef hooks to the top level of the component
  const presenceDocRef = useRef<Y.Doc | null>(null);
  const presenceProviderRef = useRef<any>(null);

  const color = useMemo(() => SESSION_COLOR, [])
  const [editor, setEditor] = useState<Editor | null>(null)

  const [showWordCount, setShowWordCount] = useState(true)
  const [showOutline, setShowOutline] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showProperties, setShowProperties] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [isDistractionFree, setIsDistractionFree] = useState(false)

  // New Obsidian panels
  const [showGraphPanel, setShowGraphPanel] = useState(false)
  const [showBacklinks, setShowBacklinks] = useState(false)
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false)
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)

  // AI Learning panels
  const [showFlashcards, setShowFlashcards] = useState(false)
  const [showActivities, setShowActivities] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // Track document text content for AI features
  const documentTextRef = useRef<string>('')

  // Active right panel tab
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('collaborators')
  const [showCollaboratorsMobile, setShowCollaboratorsMobile] = useState(false)

  // Find & Replace
  const [findOpen, setFindOpen] = useState(false)
  const [findShowReplace, setFindShowReplace] = useState(false)

  // Share Dialog
  const [showShareDialog, setShowShareDialog] = useState(false)

  // AI Evaluation
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Activity Trigger Service persistence
  const triggerServiceRef = useRef<ActivityFlowService | null>(null)
  const { addNotification } = useNotifications();
  const [isInitializingApp, setIsInitializingApp] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      addNotification({ message: 'Working offline — changes will sync when reconnected', type: 'warning', duration: Infinity });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    if (!navigator.onLine) {
      addNotification({ message: 'Working offline — changes will sync when reconnected', type: 'warning', duration: Infinity });
    }

    // Hide splash after initial load
    const timer = setTimeout(() => setIsInitializingApp(false), 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
    };
  }, [addNotification]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance)
  }, [])

  // Navigation handler for graph / backlinks
  const handleNavigateToDoc = useCallback((docId: string, title?: string, type?: 'document' | 'canvas' | 'base' | null) => {
    setCurrentNoteId(docId)
    setSidebarSelectionId(docId)
    if (title) {
      setActiveDocTitle(title)
    }
    if (type) {
      setCurrentDocType(type)
    }
  }, [setCurrentNoteId, setActiveDocTitle, setSidebarSelectionId, setCurrentDocType])

  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [projectType, setProjectType] = useState<string | null>(null);

  // Admin in activity project, NOT viewing a student workspace = dashboard mode
  // In this mode: hide editor, toolbar, graph/backlinks/activity icons. Show dashboard only.
  const isAdminDashboardMode = isAdmin && projectType === 'activity' && !viewingStudentId;

  useEffect(() => {
    if (!currentProjectId) {
      setProjectMembers([]);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => {
      const firebase = FirebaseService.getInstance();
      unsubscribe = firebase.listenToNote(currentProjectId, async (projectDoc) => {
        if (projectDoc) {
          const isProjectOwner = projectDoc.ownerId === user?.uid;

          // ── Kick Redirection ──────────────────────────────────────────
          // If the project exists but user is not owner and not in collaborators, kick them out
          if (user?.uid && !isProjectOwner && !projectDoc.collaborators.includes(user.uid)) {
            console.log('[App] User is no longer a member of this project. Redirecting...');
            setCurrentProjectId(null);
            setCurrentNoteId(null);
            return;
          }

          setIsOwner(isProjectOwner);
          setProjectType(projectDoc.type || null);
          setActivityType(projectDoc.activityType || null);

          // Check if user is admin
          if (isProjectOwner) {
            setIsAdmin(true);
          } else {
            const db = FirebaseService.getInstance().db;
            const { getDoc, doc } = await import('firebase/firestore');
            const permSnap = await getDoc(doc(db, 'projectPermissions', `${currentProjectId}_${user?.uid}`));
            if (permSnap.exists() && permSnap.data().role === 'admin') {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          }

          // Silent initialization for students in individual mode
          if (projectDoc.activityType === 'individual' && user?.uid && !isProjectOwner) {
            setIsInitializingWorkspace(true);
            try {
              await firebase.initializeIndividualWorkspace(currentProjectId, user.uid);
              // Silent cleanup of "Untitled" documents
              cleanupWorkspace(currentProjectId, user.uid);
            } finally {
              setIsInitializingWorkspace(false);
            }
          }

          // Fetch profiles for all members
          const uids = [...projectDoc.collaborators];
          if (projectDoc.ownerId && !uids.includes(projectDoc.ownerId)) {
            uids.push(projectDoc.ownerId);
          }

          try {
            const profiles = await firebase.getUserProfiles(uids);
            const members = uids.map(uid => ({
              uid,
              name: profiles[uid]?.name || (uid === projectDoc.ownerId ? 'Owner' : 'Collaborator'),
              photoBase64: profiles[uid]?.photoBase64 || null,
              role: (uid === projectDoc.ownerId ? 'Owner' : 'Can Edit') as 'Owner' | 'Can Edit'
            }));
            startTransition(() => {
              setProjectMembers(members);
            });
          } catch (err) {
            console.error('[App] Failed to fetch member profiles:', err);
            startTransition(() => {
              setProjectMembers(uids.map(uid => ({
                uid,
                name: uid === projectDoc.ownerId ? 'Owner' : 'Collaborator',
                role: (uid === projectDoc.ownerId ? 'Owner' : 'Can Edit') as 'Owner' | 'Can Edit'
              })));
            });
          }
        }
      });
    }, 250); // Bug 2: Defer project info listener

    return () => {
      clearTimeout(timer);
      unsubscribe?.();
    };
  }, [currentProjectId, user?.uid, setActivityType, setProjectMembers]);

  // ── Activity Trigger Service Lifecycle ──────────────────────────────────
  useEffect(() => {
    // 1. Basic checks
    if (!currentProjectId || !user?.uid || isAdmin || activityType !== 'individual') {
      if (triggerServiceRef.current) {
        triggerServiceRef.current.stop();
        triggerServiceRef.current = null;
      }
      return;
    }

    // 2. Don't restart if already running for the same project
    // This surviving logic handles React Strict Mode double-invokes
    if (triggerServiceRef.current?.projectId === currentProjectId) {
      // Mark as active so any pending cleanup from a previous (Strict Mode) mount won't stop it
      (triggerServiceRef.current as any)._isEffectActive = true;
      return;
    }

    const startService = () => {
      // Stop any existing instance just in case
      triggerServiceRef.current?.stop();

      console.log('[App] Starting ActivityFlowService...');
      const service = new ActivityFlowService(currentProjectId, user.uid);
      (service as any)._isEffectActive = true;
      triggerServiceRef.current = service;
      service.start();
    };

    startService();

    return () => {
      const serviceToStop = triggerServiceRef.current;
      if (serviceToStop) {
        (serviceToStop as any)._isEffectActive = false;
      }

      // Add a small delay before stopping to survive Strict Mode double-invoke
      setTimeout(() => {
        // Only stop if the service is still not "re-claimed" by a new mount
        if (serviceToStop && !(serviceToStop as any)._isEffectActive) {
          console.log('[App] Stopping ActivityFlowService...');
          serviceToStop.stop();
          if (triggerServiceRef.current === serviceToStop) {
            triggerServiceRef.current = null;
          }
        }
      }, 100);
    };
  }, [currentProjectId, user?.uid, isAdmin, activityType]);

  useEffect(() => {
    if (!currentNoteId) return;
    // One-shot fetch — doc type never changes after creation
    // Using a live listener here causes an infinite render loop via:
    // Yjs sync → TipTap dispatch → Zustand rerender → App re-renders → repeat
    FirebaseService.getInstance().getNote(
      currentNoteId,
      activityType === 'individual' ? currentProjectId! : undefined,
      activityType === 'individual' ? (viewingStudentId || user?.uid) : undefined,
    ).then(doc => {
      if (doc) {
        const newType = (doc.type as any) || 'document';
        if (useAppStore.getState().currentDocType !== newType) {
          startTransition(() => setCurrentDocType(newType));
        }
      }
    });
  }, [currentNoteId, activityType, currentProjectId, viewingStudentId, user?.uid]);
  // Sync Status Effect
  useEffect(() => {
    if (!currentNoteId) {
      setSyncStatus('offline');
      return;
    }

    // Set to syncing while components initialize their Firestore listeners
    setSyncStatus('syncing');

    // Since SyncService and Base components handle Firestore sync, 
    // they update the global syncStatus. We don't want to overwrite 
    // their 'synced' status with Yjs 'syncing' status if Firestore is healthy.

    // However, we can listen for extreme cases (like total WebRTC disconnection)
    // but we'll trust the SyncService to report 'synced' once Firestore is live.
  }, [currentNoteId]);

  const cleanupWorkspace = useCallback(async (pId: string, uId: string) => {
    const runCleanup = async () => {
      try {
        const firebase = FirebaseService.getInstance();
        const defaultTitles = ['Untitled Canvas', 'Untitled Base', 'New Document', 'Untitled Document', ''];

        // Fetch all notes for this specific student workspace
        const docs = await firebase.listProjectNotes(pId, uId);

        for (const d of docs) {
          const title = d.title?.trim() || '';
          if (defaultTitles.includes(title) || !d.title) {
            console.log(`[App] Silently cleaning up default ${d.type || 'item'}: "${title}" (${d.id})`);
            await firebase.deleteNote(d.id, pId, uId, d.type || 'document', d.isFolder).catch(() => { });

            // If the deleted document was currently open, clear it
            if (useAppStore.getState().currentNoteId === d.id) {
              useAppStore.getState().setCurrentNoteId(null);
              useAppStore.getState().setSidebarSelectionId(null);
            }
          }
        }
      } catch (err) {
        console.error('[App] Workspace cleanup pass failed:', err);
      }
    };

    // Run immediately
    await runCleanup();
    // Run second pass after a short delay to catch any items created during initialization race conditions
    setTimeout(runCleanup, 2000);
  }, []);

  const handleKickMember = useCallback(async (uid: string, name: string) => {
    if (!currentProjectId) return;

    const confirmMessage = `Are you sure you want to remove ${name} from this project? Their workspace and all progress will be permanently deleted. If they rejoin with the invite code, they will start completely fresh.`;

    if (window.confirm(confirmMessage)) {
      try {
        const firebase = FirebaseService.getInstance();
        const db = firebase.db;
        const { writeBatch, collection, getDocs, doc, deleteDoc, arrayRemove, updateDoc } = await import('firebase/firestore');

        console.log(`[Kick] Starting full cleanup for user ${uid}...`);

        // A. Remove from collaborators
        const projectRef = doc(db, 'notes', currentProjectId);
        await updateDoc(projectRef, {
          collaborators: arrayRemove(uid),
          updatedAt: Date.now()
        });

        // B. Delete student workspace (batched)
        const collections = ['documents', 'folders', 'canvas', 'base'];
        for (const colName of collections) {
          const colRef = collection(db, `notes/${currentProjectId}/studentWorkspaces/${uid}/${colName}`);
          const snap = await getDocs(colRef);

          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach(d => {
              // Special case for base rows/columns
              if (colName === 'base') {
                // We'd need to delete subcollections here too, but for speed we'll do the main doc
                // Ideally we'd recursively delete, but Firestore client SDK doesn't support it easily.
                // We'll delete rows/columns if we can find them.
              }
              batch.delete(d.ref);
            });
            await batch.commit();
          }
        }

        // Delete the workspace document itself
        const workspaceRef = doc(db, `notes/${currentProjectId}/studentWorkspaces`, uid);
        await deleteDoc(workspaceRef).catch(() => { });

        // C. Delete all activity completions
        const activitiesRef = collection(db, `notes/${currentProjectId}/activities`);
        const activitiesSnap = await getDocs(activitiesRef);
        const completionBatch = writeBatch(db);
        activitiesSnap.docs.forEach(actDoc => {
          const compRef = doc(db, `notes/${currentProjectId}/activities/${actDoc.id}/completions`, uid);
          completionBatch.delete(compRef);
        });
        await completionBatch.commit();

        // D. Delete project permissions
        const permRef = doc(db, 'projectPermissions', `${currentProjectId}_${uid}`);
        await deleteDoc(permRef).catch(() => { });

        console.log(`[Kick] Successfully removed user ${uid} from project ${currentProjectId}`);

        // Show success toast
        const toast = document.createElement('div');
        toast.className = 'activity-toast';
        toast.innerText = `${name} has been removed from the project`;
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.remove();
          // Global fix for focus bug on Windows: force reload after delete/kick
          window.location.reload();
        }, 1500);

      } catch (err) {
        console.error('[Kick] Failed to remove member:', err);
        alert('Failed to remove member completely. Please check console for details.');
      }
    }
  }, [currentProjectId]);

  // Sync searchable text for Graph View + keep ref for AI features
  const handleContentUpdate = useCallback((text: string) => {
    // Keep a live reference of the document text for AI features (flashcards, activities)
    documentTextRef.current = text

    if (!currentNoteId) return

    // Simple debounce via window ref to avoid too many writes
    if ((window as any)._graphSyncTimer) {
      clearTimeout((window as any)._graphSyncTimer)
    }

    (window as any)._graphSyncTimer = setTimeout(async () => {
      FirebaseService.getInstance().saveNote(
        currentNoteId,
        { searchText: text },
        activityType === 'individual' ? currentProjectId! : undefined,
        activityType === 'individual' ? (viewingStudentId || user?.uid) : undefined
      )

      // Activity triggers are now event-driven from the UI
    }, 500)
  }, [currentNoteId, currentProjectId, user, activityType, viewingStudentId])

  const onContentUpdateRef = useRef(handleContentUpdate);
  onContentUpdateRef.current = handleContentUpdate;

  const stableOnContentUpdate = useCallback((text: string) => {
    onContentUpdateRef.current(text);
  }, []);

  // Save title edits to Firebase
  const handleUpdateTitle = useCallback(async (newTitle: string) => {
    setActiveDocTitle(newTitle); // Optimistic UI update

    // Bug 2: Debounce Firestore write for title updates
    if ((window as any)._titleSyncTimer) {
      clearTimeout((window as any)._titleSyncTimer)
    }

    (window as any)._titleSyncTimer = setTimeout(async () => {
      try {
        const dbId = currentNoteId || currentProjectId;
        if (dbId) {
          await FirebaseService.getInstance().saveNote(
            dbId,
            { title: newTitle },
            activityType === 'individual' && currentNoteId ? currentProjectId! : undefined,
            activityType === 'individual' && currentNoteId ? (viewingStudentId || user?.uid) : undefined
          );
        }
      } catch (err) {
        console.error('[App] Failed to save title:', err);
      }
    }, 500)
  }, [currentNoteId, currentProjectId, setActiveDocTitle, activityType, viewingStudentId, user?.uid]);

  // ── Auto-select first note in project ──────────────────────────────────
  useEffect(() => {
    if (currentProjectId && !currentNoteId && !viewingStudentId) {
      const targetUserId = activityType === 'individual' ? user?.uid : undefined;

      FirebaseService.getInstance().listProjectNotes(currentProjectId, targetUserId).then(notes => {
        const firstNote = notes.find(n => !n.isProject && !n.isFolder);
        if (firstNote) {
          handleNavigateToDoc(firstNote.id, firstNote.title, (firstNote.type as any) || 'document');
        }
      });
    }
  }, [currentProjectId, currentNoteId, activityType, user?.uid, viewingStudentId, handleNavigateToDoc]);

  useEffect(() => {
    // If we are in a project but no note is open, fetch project details to show its name
    if (currentProjectId && !currentNoteId) {
      FirebaseService.getInstance().getNote(currentProjectId).then(doc => {
        if (doc && doc.title) {
          setActiveDocTitle(doc.title);
        }
      });
    }
  }, [currentProjectId, currentNoteId, setActiveDocTitle]);

  // ── Global Keyboard Shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't intercept shortcuts if the user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+O or Ctrl+P — Quick Switcher
      if (ctrl && (e.key === 'o' || e.key === 'p') && !e.shiftKey) {
        e.preventDefault()
        setShowQuickSwitcher((v) => !v)
        return
      }

      // Ctrl+F — Find
      if (ctrl && e.key === 'f' && !e.shiftKey) {
        e.preventDefault()
        setFindOpen(true)
        setFindShowReplace(false)
      }

      // Ctrl+H — Find & Replace
      if (ctrl && e.key === 'h') {
        e.preventDefault()
        setFindOpen(true)
        setFindShowReplace(true)
      }

      // Ctrl+Shift+F — Distraction-Free Mode
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setIsDistractionFree((v) => !v)
      }

      // Ctrl+Shift+G — Toggle Graph
      if (ctrl && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        setShowGraphPanel((v) => !v)
      }

      // Escape — Close panels/popups
      if (e.key === 'Escape') {
        if (showQuickSwitcher) {
          setShowQuickSwitcher(false)
          return
        }
        if (findOpen) {
          setFindOpen(false)
          return
        }
        if (isGraphFullscreen) {
          setIsGraphFullscreen(false)
          return
        }
        if (isDistractionFree) {
          setIsDistractionFree(false)
          return
        }
      }

      // Ctrl+Shift+C — Copy as Markdown
      if (ctrl && e.shiftKey && e.key === 'C' && editor) {
        e.preventDefault()
        const html = editor.getHTML()
        // Simple HTML to text for clipboard
        const temp = document.createElement('div')
        temp.innerHTML = html
        const text = temp.textContent || ''
        navigator.clipboard.writeText(text).catch(() => {
          // Fallback handled silently
        })
      }

      // Ctrl+K — Open Global Search
      if (ctrl && e.key === 'k' && !e.shiftKey) {
        e.preventDefault()
        setShowSearchModal(prev => !prev)
      }

      // Ctrl+Shift+K — Remove Link
      if (ctrl && e.shiftKey && e.key === 'K' && editor) {
        e.preventDefault()
        editor.chain().focus().unsetLink().run()
      }

      // Ctrl+Alt+1-4 — Set Heading
      if (ctrl && e.altKey && editor) {
        const level = parseInt(e.key, 10) as 1 | 2 | 3 | 4
        if (level >= 1 && level <= 4) {
          e.preventDefault()
          editor.chain().focus().toggleHeading({ level }).run()
        }
      }

      // Ctrl+Shift+0 — Set Paragraph
      if (ctrl && e.shiftKey && e.key === ')' && editor) {
        e.preventDefault()
        editor.chain().focus().setParagraph().run()
      }
    }

    const handleActivityCompleted = (e: any) => {
      const { title, points, isLate } = e.detail;
      addNotification({
        title: isLate ? 'Late Submission' : 'Success',
        message: isLate 
          ? `⚠️ Submitted late — points deducted ("${title}" +${points} pts)` 
          : `🎉 Activity Completed: "${title}" (+${points} pts)`,
        type: isLate ? 'warning' : 'success'
      });
    };

    const handleFirebaseError = (e: any) => {
      const { title, message, type } = e.detail;
      addNotification({ title, message, type: type || 'error' });
    };

    const handleAIError = (e: any) => {
      const { title, message, type } = e.detail;
      addNotification({ title, message, type: type || 'warning' });
    };

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('activity-completed', handleActivityCompleted)
    window.addEventListener('firebase-error', handleFirebaseError)
    window.addEventListener('ai-error', handleAIError)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('activity-completed', handleActivityCompleted)
      window.removeEventListener('firebase-error', handleFirebaseError)
      window.removeEventListener('ai-error', handleAIError)
    }
  }, [editor, findOpen, isDistractionFree, showQuickSwitcher, isGraphFullscreen])

  // ── Close all right panels helper ──────────────────────────────────────
  // IMPORTANT: Declared before any early returns to satisfy React’s Rules of Hooks.
  const closeAllRightPanels = useCallback(() => {
    setShowComments(false)
    setShowHistory(false)
    setShowProperties(false)
    setShowOutline(false)
    setShowBacklinks(false)
    setShowFlashcards(false)
    setShowActivities(false)
    setShowLeaderboard(false)
  }, [])

  const handleEvaluateWork = async () => {
    if (!currentProjectId || !viewingStudentId) return;

    setIsEvaluating(true);
    setEvaluationResult(null);
    try {
      const result = await StudentEvaluationService.evaluateWork(currentProjectId, viewingStudentId, currentNoteId);
      setEvaluationResult(result);
    } catch (err) {
      console.error('[App] Evaluation failed:', err);
      alert('Failed to evaluate work. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Distraction-Free Mode ──────────────────────────────────────────────
  if (isDistractionFree) {
    return (
      <div className="app-distraction-free">
        <div className="distraction-free-editor">
          <CollaborativeEditor
            roomName={currentNoteId || 'proof-of-life-room'}
            projectId={currentProjectId}
            username={username}
            userId={user?.uid}
            color={color}
            onEditorReady={handleEditorReady}
          />
        </div>

        {editor && <SlashCommand editor={editor} />}
        <button
          className="distraction-free-exit"
          onClick={() => setIsDistractionFree(false)}
          title="Exit Distraction-Free Mode (Ctrl+Shift+F)"
        >
          ✕ Exit
        </button>

        {/* Floating Student Activity Card */}
        {activityType === 'individual' && !isAdmin && currentProjectId && (
          <StudentActivityDisplay projectId={currentProjectId} />
        )}
      </div>
    )
  }

  // ── Fullscreen Graph View ──────────────────────────────────────────────
  if (isGraphFullscreen) {
    return (
      <div className="app-layout">
        <Sidebar collapsed={false} onToggleCollapse={() => { }} />
        <div className="app-main" style={{ borderRadius: 0 }}>
          <div className="graph-panel__header" style={{ background: '#0d0d1a' }}>
            <div className="graph-panel__title">Graph View</div>
            <div className="graph-panel__actions">
              <button
                className="graph-panel__action-btn"
                onClick={() => setIsGraphFullscreen(false)}
                title="Exit Fullscreen"
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Graph...</div>}>
            <GraphView
              activeDocId={sidebarSelectionId || currentNoteId}
              onNavigateToDoc={(docId) => {
                handleNavigateToDoc(docId)
                setIsGraphFullscreen(false)
              }}
              isVisible={true}
            />
          </Suspense>
        </div>
      </div>
    )
  }


  // ── Determine right panel ──────────────────────────────────────────────
  const renderRightPanel = (): React.ReactNode => {

    if (showFlashcards) {
      return (
        <div className="app-right-panel" style={{ width: 380 }}>
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Flashcards...</div>}>
            <FlashcardPanel
              documentContent={documentTextRef.current || (editor?.getText() ?? '')}
              documentTitle={activeDocTitle}
              onClose={() => setShowFlashcards(false)}
            />
          </Suspense>
        </div>
      )
    }

    if (showActivities) {
      return (
        <div className="app-right-panel" style={{ width: 380 }}>
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Activities...</div>}>
            <ActivityPanel
              onClose={() => setShowActivities(false)}
            />
          </Suspense>
        </div>
      )
    }

    if (showLeaderboard) {
      return (
        <div className="app-right-panel" style={{ width: 380 }}>
          <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Dashboard...</div>}>
            <ActivityDashboard
              projectId={currentProjectId!}
              onClose={() => setShowLeaderboard(false)}
              onViewStudent={(studentId) => {
                if (activityType === 'individual') {
                  setViewingStudentId(studentId);
                  setShowLeaderboard(false);
                  setCurrentNoteId(null); // Force reload
                }
              }}
              onKickStudent={handleKickMember}
              viewingStudentId={viewingStudentId}
            />
          </Suspense>
        </div>
      )
    }

    if (showBacklinks) {
      return (
        <div className="app-right-panel">
          <BacklinksPanel
            currentDocId={currentNoteId}
            currentDocTitle={activeDocTitle}
            onNavigateToDoc={(docId, title) => handleNavigateToDoc(docId, title)}
            onClose={() => setShowBacklinks(false)}
            docType={currentDocType}
          />
        </div>
      )
    }

    if (showProperties && currentNoteId) {
      return (
        <div className="app-right-panel">
          <PropertiesPanel
            noteId={currentNoteId}
            onClose={() => setShowProperties(false)}
          />
        </div>
      )
    }

    if (showComments && editor) {
      return (
        <div className="app-right-panel">
          <CommentsPanel editor={editor} username={username} userColor={color} />
        </div>
      )
    }

    if (showHistory && editor) {
      return (
        <div className="app-right-panel">
          <VersionHistoryPanel
            editor={editor}
            onRestore={(content) => {
              editor.commands.setContent(content);
            }}
          />
        </div>
      )
    }

    if (showOutline && editor) {
      return (
        <div className="app-right-panel">
          <DocumentOutline editor={editor} />
        </div>
      )
    }

    // Map full member list with online status for the right panel
    const mappedMembers = [
      ...projectMembers.map(pm => {
        const onlineInfo = onlineCollaborators.find(oc => oc.id === pm.uid || oc.name === pm.uid);
        const photo = getUserAvatar(onlineInfo || pm);
        return {
          id: pm.uid,
          name: pm.name,
          color: onlineInfo?.color || '#4b5563',
          photoURL: photo || undefined,
          isOnline: !!onlineInfo,
          role: pm.role as any
        };
      }),
      // Add guests (online but not in persistent members)
      ...onlineCollaborators
        .filter(oc => !projectMembers.some(pm => pm.uid === oc.id || pm.uid === oc.name))
        .map(oc => ({
          id: oc.id,
          name: oc.name,
          color: oc.color,
          photoURL: getUserAvatar(oc) || undefined,
          isOnline: true,
          role: 'Guest' as const
        }))
    ];

    if (Capacitor.isNativePlatform() && !showCollaboratorsMobile) {
      return null;
    }

    return (
      <Suspense fallback={<div className="app-right-panel-loading">Loading List...</div>}>
        <CollaboratorList
          members={mappedMembers}
          onKick={handleKickMember}
          isOwner={isOwner}
          currentUserId={user?.uid}
          onClose={() => setShowCollaboratorsMobile(false)}
        />
      </Suspense>
    )
  }

  if (!currentProjectId) {
    return (
      <div className="app-layout">
        <div className="app-main">
          <DocumentDashboard
            onSelectProject={(id, title) => {
              setCurrentProjectId(id);
              setCurrentNoteId(null);
              setActiveDocTitle(title || 'Untitled Project');
            }}
          />
        </div>

        {/* Quick Switcher (available even on dashboard) */}
        <Suspense fallback={null}>
          <QuickSwitcher
            isOpen={showQuickSwitcher}
            onClose={() => setShowQuickSwitcher(false)}
            onSelectDoc={(docId, title) => handleNavigateToDoc(docId, title)}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={`app-layout ${viewingStudentId ? 'app-layout--viewing-student' : ''}`}>
      <PresenceTracker />
      <AnimatePresence>
        {isInitializingApp && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="splash-screen"
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: '#0d0d1a', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 20000
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                width: '64px', height: '64px', background: 'var(--accent-primary)',
                borderRadius: '16px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: '24px', margin: '0 auto'
              }}>
                <FileText size={32} color="#fff" />
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Coollab</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Preparing your collaborative workspace...</p>
              <div className="skeleton" style={{ width: '120px', height: '4px', marginTop: '24px', borderRadius: '2px' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOnline && (
        <div className="offline-banner">
          <WifiOff size={14} />
          <span>Working offline — changes will sync when reconnected</span>
        </div>
      )}

      {isInitializingWorkspace && (
        <div className="initialization-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(13, 13, 26, 0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, color: '#fff'
        }}>
          <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(124, 107, 240, 0.1)', borderTopColor: '#7c6bf0', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Initializing your workspace...</div>
          <div style={{ fontSize: '14px', color: '#a0a4b8', marginTop: '8px' }}>Setting up your personal learning environment.</div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
      <VerificationBanner user={user} />
      {viewingStudentId && (
        <div className="viewing-student-banner" style={{
          background: 'linear-gradient(90deg, #7c6bf0, #6558d4)',
          color: '#fff',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} />
            <span>Viewing student workspace: {projectMembers.find(m => m.uid === viewingStudentId)?.name || 'Unknown Student'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn--primary btn--small"
              style={{
                background: '#fff',
                border: 'none',
                color: '#7c6bf0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: isEvaluating ? 0.7 : 1,
                cursor: isEvaluating ? 'not-allowed' : 'pointer'
              }}
              onClick={handleEvaluateWork}
              disabled={isEvaluating}
            >
              {isEvaluating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Evaluate Work with AI
                </>
              )}
            </button>
            <button
              className="btn btn--secondary btn--small"
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff' }}
              onClick={() => setViewingStudentId(null)}
            >
              Back to my Workspace
            </button>
          </div>
        </div>
      )}
      {/* Icon Rail (Obsidian-style left icon strip) */}
      <div className="app-icon-rail">
        <button
          className="app-icon-rail__btn"
          onClick={() => {
            setCurrentProjectId(null);
            setCurrentNoteId(null);
          }}
          title="Home (Projects)"
          type="button"
        >
          <Home size={18} />
        </button>

        {/* Editor, Graph, Backlinks — hidden when admin is in dashboard mode (not viewing student) */}
        {!isAdminDashboardMode && (
          <>
            <button
              className={`app-icon-rail__btn ${!showGraphPanel && !showBacklinks ? 'app-icon-rail__btn--active' : ''}`}
              onClick={() => {
                setShowGraphPanel(false)
                setShowBacklinks(false)
              }}
              title="Editor"
              type="button"
              id="icon-rail-editor"
            >
              <FileText size={18} />
            </button>
            <button
              className={`app-icon-rail__btn ${showGraphPanel ? 'app-icon-rail__btn--active' : ''}`}
              onClick={() => {
                setShowGraphPanel((v) => !v)
                if (!showGraphPanel) {
                  setShowBacklinks(false)
                  setShowComments(false)
                  setShowHistory(false)
                  setShowProperties(false)
                  setShowOutline(false)
                }
              }}
              title="Graph View (Ctrl+Shift+G)"
              type="button"
              id="icon-rail-graph"
            >
              <GitBranch size={18} />
            </button>
            <button
              className={`app-icon-rail__btn ${showBacklinks ? 'app-icon-rail__btn--active' : ''}`}
              onClick={() => {
                setShowBacklinks((v) => !v)
                if (!showBacklinks) {
                  setShowGraphPanel(false)
                  closeAllRightPanels()
                  setShowBacklinks(true)
                }
              }}
              title="Backlinks"
              type="button"
              id="icon-rail-backlinks"
            >
              <Link2 size={18} />
            </button>
          </>
        )}

        <div style={{ width: '60%', height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 0' }} />

        {/* Flashcards — visible for both students and admin */}
        <button
          className={`app-icon-rail__btn ${showFlashcards ? 'app-icon-rail__btn--active' : ''}`}
          onClick={() => {
            const opening = !showFlashcards
            closeAllRightPanels()
            if (opening) {
              setShowFlashcards(true)
              setShowGraphPanel(false)
            }
          }}
          title="Flashcards"
          type="button"
          id="icon-rail-flashcards"
        >
          <Layers size={18} />
        </button>

        {/* Activities — only show for students (non-admin), NOT for admin */}
        {!isAdmin && (
          <button
            className={`app-icon-rail__btn ${showActivities ? 'app-icon-rail__btn--active' : ''}`}
            onClick={() => {
              const opening = !showActivities
              closeAllRightPanels()
              if (opening) {
                setShowActivities(true)
                setShowGraphPanel(false)
              }
            }}
            title="Activities"
            type="button"
            id="icon-rail-activities"
          >
            <Target size={18} />
          </button>
        )}

        {/* Activity Dashboard — admin only */}
        {projectType === 'activity' && isAdmin && (
          <button
            className={`app-icon-rail__btn ${showLeaderboard ? 'app-icon-rail__btn--active' : ''}`}
            onClick={() => {
              const opening = !showLeaderboard
              closeAllRightPanels()
              if (opening) {
                setShowLeaderboard(true)
                setShowGraphPanel(false)
              }
            }}
            title="Activity Dashboard"
            type="button"
          >
            <Trophy size={18} />
          </button>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onlineUsers={onlineCollaborators}
        projectMembers={projectMembers}
        viewingStudentId={viewingStudentId}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="app-main" style={{ borderRadius: 0 }}>
        {/* Title bar + sync indicator */}
        <div className="app-top-bar">
          <button
            className="app-mobile-menu-btn"
            onClick={() => setIsMobileSidebarOpen(true)}
            style={{ display: 'none', background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '8px', cursor: 'pointer', marginLeft: '8px' }}
          >
            <Menu size={20} />
          </button>
          <Toolbar
            title={activeDocTitle}
            onTitleChange={handleUpdateTitle}
            syncIndicator={syncStatus}
            onShareClick={() => setShowShareDialog(true)}
            collaborators={onlineCollaborators}
            onCollaboratorsClick={() => setShowCollaboratorsMobile(true)}
          />
          <div className="app-top-bar__actions">
            {!isAdminDashboardMode && (
              <>
                <button
                  className="app-top-bar__panel-btn"
                  onClick={() => setShowSearchModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    color: '#e8eaf0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  title="Search (Ctrl+K)"
                  type="button"
                >
                  <Search size={16} />
                </button>
                <NotificationsDropdown />
                <button
                  className={`app-top-bar__panel-btn ${showHistory ? 'app-top-bar__panel-btn--active' : ''}`}
                  onClick={() => {
                    setShowHistory((v) => !v)
                    if (!showHistory) {
                      setShowComments(false)
                      setShowProperties(false)
                      setShowOutline(false)
                      setShowBacklinks(false)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 16px',
                    height: 32,
                    background: showHistory ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    border: showHistory ? '1px solid #6dd49e' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    color: showHistory ? '#6dd49e' : '#e8eaf0',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Version History"
                  type="button"
                >
                  History
                </button>
                <button
                  className={`app-top-bar__panel-btn ${showComments ? 'app-top-bar__panel-btn--active' : ''}`}
                  onClick={() => {
                    setShowComments((v) => !v)
                    if (!showComments) {
                      setShowHistory(false)
                      setShowProperties(false)
                      setShowOutline(false)
                      setShowBacklinks(false)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 16px',
                    height: 32,
                    background: showComments ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    border: showComments ? '1px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    color: showComments ? '#7c3aed' : '#e8eaf0',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Toggle Comments Panel"
                  type="button"
                >
                  Comment
                </button>
                <button
                  className={`app-top-bar__panel-btn ${showProperties ? 'app-top-bar__panel-btn--active' : ''}`}
                  onClick={() => {
                    setShowProperties((v) => !v)
                    if (!showProperties) {
                      setShowComments(false)
                      setShowHistory(false)
                      setShowOutline(false)
                      setShowBacklinks(false)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 16px',
                    height: 32,
                    background: showProperties ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                    border: showProperties ? '1px solid #7c6bf0' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    color: showProperties ? '#7c6bf0' : '#e8eaf0',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Toggle Properties Panel"
                  type="button"
                >
                  <Sliders size={14} />
                  Properties
                </button>
                <div style={{ flexShrink: 0 }}>
                  {editor && <ExportMenu editor={editor} />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Editor Toolbar — hidden in admin dashboard mode */}
        {!isAdminDashboardMode && (
          <EditorToolbar
            editor={editor}
            onToggleWordCount={() => setShowWordCount((v) => !v)}
            onToggleOutline={() => {
              setShowOutline((v) => !v)
              if (!showOutline) {
                setShowComments(false)
                setShowProperties(false)
              }
            }}
            onToggleDistractionFree={() => setIsDistractionFree(true)}
            showWordCount={showWordCount}
            showOutline={showOutline}
            isDistractionFree={isDistractionFree}
          />
        )}

        {/* Main content area */}
        <div className="app-content">
          <div className="app-editor-area">
            {isAdminDashboardMode ? (
              <ActivityBuilderInline projectId={currentProjectId!} />
            ) : (
              <>
                {/* Find & Replace panel */}
                {editor && (
                  <FindReplace
                    editor={editor}
                    isOpen={findOpen}
                    onClose={() => setFindOpen(false)}
                    showReplace={findShowReplace}
                  />
                )}

                {currentNoteId ? (
                  <>
                    {currentDocType === 'canvas' ? (
                      <Canvas
                        key={currentNoteId}
                        roomName={currentNoteId}
                        username={username}
                        userId={user?.uid}
                        readOnly={viewerMode || (!!viewingStudentId && viewingStudentId !== user?.uid)}
                      />
                    ) : currentDocType === 'base' ? (
                      <Base
                        key={currentNoteId}
                        roomName={currentNoteId}
                        readOnly={viewerMode || (!!viewingStudentId && viewingStudentId !== user?.uid)}
                      />
                    ) : (
                      <CollaborativeEditor
                        key={currentNoteId}
                        roomName={currentNoteId}
                        projectId={currentProjectId}
                        username={username}
                        userId={user?.uid}
                        color={color}
                        title={activeDocTitle}
                        onTitleChange={handleUpdateTitle}
                        onContentUpdate={stableOnContentUpdate}
                        onEditorReady={handleEditorReady}
                        readOnly={viewerMode || (!!viewingStudentId && viewingStudentId !== user?.uid)}
                      />
                    )}
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    Select or create a document to start editing.
                  </div>
                )}

                {/* Slash Command + Context Menu — only render when editor is available */}
                {editor && <SlashCommand editor={editor} />}
                {editor && <ContextMenu editor={editor} />}
              </>
            )}
          </div>

          {/* Graph panel — always mounted to preserve canvas DPR state */}
          <div
            className="graph-panel"
            style={{ display: showGraphPanel ? 'flex' : 'none', flexDirection: 'column' }}
          >
            <div className="graph-panel__header">
              <div className="graph-panel__title">Graph View</div>
              <div className="graph-panel__actions">
                <button
                  className="graph-panel__action-btn"
                  onClick={() => setIsGraphFullscreen(true)}
                  title="Fullscreen"
                  type="button"
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  className="graph-panel__action-btn"
                  onClick={() => setShowGraphPanel(false)}
                  title="Close"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <Suspense fallback={<div style={{ padding: '20px', color: 'var(--text-faint)' }}>Loading Graph...</div>}>
              <GraphView
                activeDocId={sidebarSelectionId || currentNoteId}
                onNavigateToDoc={(docId) => handleNavigateToDoc(docId)}
                isVisible={showGraphPanel}
              />
            </Suspense>
          </div>

          {renderRightPanel()}
        </div>

        {/* Word Count Status Bar — hidden in admin dashboard mode */}
        {showWordCount && editor && !isAdminDashboardMode && (
          <Suspense fallback={null}>
            <WordCountBar editor={editor} />
          </Suspense>
        )}
      </div>

      {/* Overlays and Modals */}
      <Suspense fallback={null}>
        {/* Quick Switcher Overlay */}
        <QuickSwitcher
          isOpen={showQuickSwitcher}
          onClose={() => setShowQuickSwitcher(false)}
          onSelectDoc={(docId, title) => handleNavigateToDoc(docId, title)}
        />

        {/* Share Dialog Overlay */}
        <ShareDialog
          isOpen={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          projectId={currentProjectId || ''}
          projectTitle={activeDocTitle}
        />

        {/* Global Search Modal */}
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onNavigateToDoc={(docId, title) => handleNavigateToDoc(docId, title)}
          projectId={currentProjectId}
        />

        {/* Activity AI Agent */}
        {projectType === 'activity' && currentProjectId && isAdmin && !isAdminDashboardMode && (
          <ActivityAIAgent projectId={currentProjectId} />
        )}

        {/* Floating Student Activity Card */}
        {activityType === 'individual' && !isAdmin && currentProjectId && (
          <StudentActivityDisplay projectId={currentProjectId} />
        )}

        {/* Floating Evaluation Result Panel */}
        {evaluationResult && (
          <EvaluationResultPanel
            verdict={evaluationResult.verdict}
            instructions={evaluationResult.instructions}
            instructionTexts={evaluationResult.instructionTexts}
            onClose={() => setEvaluationResult(null)}
          />
        )}
      </Suspense>
    </div>
  )
}

export default App