export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onlineUsers?: { id: string; name: string; color: string }[];
  projectMembers?: { uid: string; name: string; role: 'Owner' | 'Can Edit' }[];
}
