import React from 'react';
import { Search, Bell, Share2, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { getUserAvatar } from '../../utils/avatar.utils';

interface WorkspaceHeaderProps {
  onOpenSearch: () => void;
  onOpenShare: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  onOpenSearch,
  onOpenShare
}) => {
  const { currentProjectId, activeDocTitle, setCurrentNoteId, userRole } = useAppStore();
  const { state: { user } } = useAuth();
  const { profile } = useUserProfile(user?.uid);

  const displayName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const userInitials = displayName.substring(0, 2).toUpperCase();
  const userPhoto = user?.photoURL || (user?.uid ? getUserAvatar(user.uid) : null);

  return (
    <header style={{
      height: '52px',
      background: 'var(--theme-background)',
      borderBottom: '1px  solid var(--theme-border)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      zIndex: 100
    }}>
      {/* Left: Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          color: 'var(--theme-text-primary)',
          fontSize: '13px',
          fontWeight: 600
        }}>
          {activeDocTitle || 'Project Name'}
        </span>
        
        {/* Role Badge */}
        <div style={{
          marginLeft: '12px',
          background: 'var(--theme-primary)',
          color: 'var(--theme-text-primary)',
          fontSize: '11px',
          fontWeight: 800,
          padding: '4px 14px',
          borderRadius: '999px',
          letterSpacing: '0.02em'
        }}>
          {userRole?.toUpperCase()}
        </div>
      </div>

      {/* Right: Search + Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Search Bar */}
        <div 
          onClick={onOpenSearch}
          style={{
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.03 * 100}%, transparent)`,
            border: '1px  solid var(--theme-border)',
            borderRadius: '8px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '240px',
            cursor: 'text'
          }}
        >
          <Search size={14} style={{ color: 'var(--theme-text-secondary)' }} />
          <span style={{ color: 'var(--theme-text-secondary)', fontSize: '12px' }}>
            Quick switch... (Ctrl+K)
          </span>
        </div>

        {/* Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--theme-text-secondary)', cursor: 'pointer', padding: '4px' }}>
            <Bell size={18} />
          </button>
          <button 
            onClick={onOpenShare}
            style={{ background: 'none', border: 'none', color: 'var(--theme-text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <Share2 size={18} />
          </button>
        </div>

        {/* User Avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--theme-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px  solid var(--theme-border)'
        }}>
          {userPhoto ? (
            <img src={userPhoto} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>{userInitials}</span>
          )}
        </div>
      </div>
    </header>
  );
};
