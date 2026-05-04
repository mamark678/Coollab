export interface ToolbarProps {
  title: string;
  onTitleChange?: (newTitle: string) => void;
  syncIndicator: 'offline' | 'syncing' | 'synced';
  onShareClick?: () => void;
  collaborators?: { id: string; name: string; color: string; photoURL?: string }[];
  onCollaboratorsClick?: () => void;
}
