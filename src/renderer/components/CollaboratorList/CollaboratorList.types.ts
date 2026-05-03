export interface Collaborator {
  id: string;
  name: string;
  color: string;
  photoURL?: string;
  isOnline: boolean;
  role: 'Owner' | 'Can Edit' | 'Can View' | 'Guest';
}

export interface CollaboratorListProps {
  members: Collaborator[];
  onKick?: (userId: string, name: string) => void;
  isOwner?: boolean;
  currentUserId?: string;
}
