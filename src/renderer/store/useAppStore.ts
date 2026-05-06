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
  currentDocType: 'document' | 'canvas' | 'base' | null;
  setCurrentDocType: (type: 'document' | 'canvas' | 'base' | null) => void;
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
      currentDocType: null,
      setCurrentDocType: (type) => set({ currentDocType: type }),
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
        currentDocType: null,
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
        currentDocType: state.currentDocType
      }),
    }
  )
);
