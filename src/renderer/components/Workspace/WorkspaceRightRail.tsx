import React from 'react';
import { Users, MessageSquare, History } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { CollaboratorList } from '../CollaboratorList/CollaboratorList';
import { CommentsPanel } from '../CommentsPanel/CommentsPanel';
import { VersionHistoryPanel as VersionHistory } from '../VersionHistory/VersionHistoryPanel';
import { ActivityPanel as CurriculumPanel } from '../Activities/ActivityPanel';

interface WorkspaceRightRailProps {
  onToggleCollaborators: () => void;
  onToggleComments: () => void;
  onToggleHistory: () => void;
  activePanel: 'collaborators' | 'comments' | 'history' | null;
  projectId: string;
  selectedDocumentId: string | null;
  yjsProvider?: any;
  // Instructor needs these for CollaboratorList
  projectMembers?: any[];
  onlineCollaborators?: any[];
  onKick?: (uid: string, name: string) => void;
  isOwner?: boolean;
  kickedUserIds?: Set<string>;
  userId?: string;
  editor?: any;
  username?: string;
  userColor?: string;
}

export const WorkspaceRightRail: React.FC<WorkspaceRightRailProps> = ({
  onToggleCollaborators,
  onToggleComments,
  onToggleHistory,
  activePanel,
  projectId,
  selectedDocumentId,
  yjsProvider,
  projectMembers = [],
  onlineCollaborators = [],
  onKick,
  isOwner,
  kickedUserIds = new Set(),
  userId,
  editor,
  username,
  userColor
}) => {
  const { userRole } = useAppStore(useShallow(s => ({ userRole: s.userRole })));

  return (
    <aside style={{
      width: activePanel ? '320px' : '40px',
      background: 'var(--theme-background)',
      borderLeft: '1px  solid var(--theme-border)',
      display: 'flex',
      flexDirection: 'row', // Buttons on the right, panel on the left? Or buttons on left, panel on right?
      flexShrink: 0,
      transition: 'width 0.2s ease'
    }}>
      {/* Main content area for active panel */}
      <div style={{ flex: 1, display: activePanel ? 'flex' : 'none', flexDirection: 'column', borderRight: '1px  solid var(--theme-border)', overflow: 'hidden', width: 'calc(100% - 40px)' }}>
        {activePanel === 'collaborators' && (
          <CollaboratorList 
            members={[
              ...projectMembers
                .filter(pm => !kickedUserIds.has(pm.uid))
                .map(pm => {
                  const onlineInfo = onlineCollaborators.find(oc => oc.id === pm.uid || oc.name === pm.uid);
                  return {
                    id: pm.uid, name: pm.name, color: onlineInfo?.color || 'var(--theme-text-secondary)',
                    isOnline: !!onlineInfo, role: pm.role as any
                  };
                }),
              ...onlineCollaborators
                .filter(oc => 
                  !projectMembers.some(pm => pm.uid === oc.id || pm.uid === oc.name) &&
                  !kickedUserIds.has(oc.id) &&
                  !kickedUserIds.has(oc.name)
                )
                .map(oc => ({
                  id: oc.id, name: oc.name, color: oc.color,
                  isOnline: true, role: 'Guest' as const
                }))
            ]}
            onKick={onKick}
            isOwner={isOwner && userRole === 'instructor'}
            currentUserId={userId}
            onClose={onToggleCollaborators}
          />
        )}
        {activePanel === 'comments' && editor && (
          <CommentsPanel 
            editor={editor} 
            username={username || ''} 
            userColor={userColor || ''} 
          />
        )}
        {activePanel === 'history' && editor && (
          <VersionHistory 
            editor={editor}
            onRestore={(content) => editor.commands.setContent(content)}
          />
        )}
      </div>
      
      {/* Icon Buttons Rail (for both roles) */}
      <div style={{
        width: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        gap: '20px',
        flexShrink: 0
      }}>
        <button 
          onClick={onToggleCollaborators}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activePanel === 'collaborators' ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-secondary) 50%, transparent)', 
            cursor: 'pointer', 
            padding: '8px' 
          }}
        >
          <Users size={20} />
        </button>
        <button 
          onClick={onToggleComments}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activePanel === 'comments' ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-secondary) 50%, transparent)', 
            cursor: 'pointer', 
            padding: '8px' 
          }}
        >
          <MessageSquare size={20} />
        </button>
        <button 
          onClick={onToggleHistory}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: activePanel === 'history' ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-secondary) 50%, transparent)', 
            cursor: 'pointer', 
            padding: '8px' 
          }}
        >
          <History size={20} />
        </button>
      </div>
    </aside>
  );
};
