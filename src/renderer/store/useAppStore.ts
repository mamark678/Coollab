import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AppState {
  currentProjectId: string | null;
  currentNoteId: string | null;
  sidebarSelectionId: string | null;
  activeDocTitle: string;
  syncStatus: 'offline' | 'syncing' | 'synced';
  viewerMode: boolean;
  projectMembers: { uid: string; name: string; photoBase64?: string | null; role: 'Owner' | 'Can Edit' | 'Guest' }[];
  activityType: 'individual' | 'group' | null;
  viewingStudentId: string | null;
  onlineCollaborators: { id: string; name: string; color: string; photoURL?: string; platform?: string }[];
  userRole: 'student' | 'instructor' | null;
  setCurrentProjectId: (id: string | null) => void;
  setCurrentNoteId: (id: string | null) => void;
  setSidebarSelectionId: (id: string | null) => void;
  setActiveDocTitle: (title: string) => void;
  setSyncStatus: (status: 'offline' | 'syncing' | 'synced') => void;
  setViewerMode: (viewer: boolean) => void;
  setProjectMembers: (members: AppState['projectMembers']) => void;
  setActivityType: (type: 'individual' | 'group' | null) => void;
  setViewingStudentId: (id: string | null) => void;
  setOnlineCollaborators: (users: AppState['onlineCollaborators']) => void;
  setUserRole: (role: 'student' | 'instructor' | null) => void;
  currentDocType: 'document' | 'canvas' | 'base' | 'folder' | null;
  setCurrentDocType: (type: 'document' | 'canvas' | 'base' | 'folder' | null) => void;
  pendingRole: string | null;
  setPendingRole: (role: string | null) => void;
  currentActivity: any | null;
  currentActivityStatus: 'pending' | 'in_progress' | 'completed' | 'graded' | null;
  setCurrentActivity: (activity: any | null) => void;
  setCurrentActivityStatus: (status: 'pending' | 'in_progress' | 'completed' | 'graded' | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      currentNoteId: null,
      sidebarSelectionId: null,
      activeDocTitle: 'Untitled Document',
      syncStatus: 'offline',
      viewerMode: false,
      projectMembers: [],
      activityType: null,
      viewingStudentId: null,
      onlineCollaborators: [],
      userRole: null,
      currentActivity: null,
      currentActivityStatus: null,
      setCurrentProjectId: (id) => set({ currentProjectId: id }),
      setCurrentNoteId: (id) => set({ currentNoteId: id }),
      setSidebarSelectionId: (id) => set({ sidebarSelectionId: id }),
      setActiveDocTitle: (title) => set({ activeDocTitle: title }),
      setSyncStatus: (status) => set({ syncStatus: status }),
      setViewerMode: (viewer) => set({ viewerMode: viewer }),
      setProjectMembers: (members) => set({ projectMembers: members }),
      setActivityType: (type) => set({ activityType: type }),
      setViewingStudentId: (id) => set({ viewingStudentId: id }),
      setOnlineCollaborators: (users) => set({ onlineCollaborators: users }),
      setUserRole: (role) => set({ userRole: role }),
      currentDocType: null,
      setCurrentDocType: (type) => set({ currentDocType: type }),
      pendingRole: null,
      setPendingRole: (role) => set({ pendingRole: role }),
      setCurrentActivity: (activity) => set({ currentActivity: activity }),
      setCurrentActivityStatus: (status) => set({ currentActivityStatus: status }),
      reset: () => set({
        currentProjectId: null,
        currentNoteId: null,
        sidebarSelectionId: null,
        activeDocTitle: 'Untitled Document',
        syncStatus: 'offline',
        viewerMode: false,
        projectMembers: [],
        activityType: null,
        viewingStudentId: null,
        onlineCollaborators: [],
        userRole: null,
        currentDocType: null,
        pendingRole: null,
        currentActivity: null,
        currentActivityStatus: null,
      }),
    }),
    {
      name: 'coollab-app-state',
      storage: createJSONStorage(() => localStorage),
      // Only persist essential navigation state
      partialize: (state) => ({ 
        currentProjectId: state.currentProjectId,
        currentNoteId: state.currentNoteId,
        sidebarSelectionId: state.sidebarSelectionId,
        activityType: state.activityType,
        viewingStudentId: state.viewingStudentId,
        currentDocType: state.currentDocType,
        pendingRole: state.pendingRole,
        activeDocTitle: state.activeDocTitle
      }),
    }
  )
);
