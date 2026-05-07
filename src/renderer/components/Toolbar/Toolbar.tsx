import { ArrowLeft, Check, RefreshCw, Share2, Users, WifiOff } from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ToolbarProps } from './Toolbar.types';

const statusIcons = {
  synced: Check,
  syncing: RefreshCw,
  offline: WifiOff
};

const statusConfig = {
  synced: { color: '#6dd49e', label: 'Synced', shadow: 'rgba(109, 212, 158, 0.5)' },
  syncing: { color: '#e6c96e', label: 'Syncing…', shadow: 'rgba(230, 201, 110, 0.5)' },
  offline: { color: '#e66b7a', label: 'Offline', shadow: 'rgba(230, 107, 122, 0.5)' }
};

interface CollaboratorAvatarProps {
  collaborator: { id: string; name: string; color?: string; photoURL?: string };
}

const CollaboratorAvatar: React.FC<CollaboratorAvatarProps> = memo(({ collaborator: c }) => (
  <div
    title={c.name}
    style={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      backgroundColor: c.color || '#7c6bf0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '11px',
      fontWeight: 700,
      border: '2px solid var(--surface-mantle)',
      marginLeft: '-8px',
      cursor: 'default',
      overflow: 'hidden',
      transform: 'translateZ(0)'
    }}
  >
    {c.photoURL ? (
      <img src={c.photoURL} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      c.name.charAt(0).toUpperCase()
    )}
  </div>
));

export const Toolbar: React.FC<ToolbarProps> = memo(({ title, onTitleChange, syncIndicator, onShareClick, collaborators = [], onCollaboratorsClick }) => {
  const { setCurrentNoteId } = useAppStore();
  const config = statusConfig[syncIndicator];
  const StatusIcon = statusIcons[syncIndicator] || Check;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Mobile layout: Title + active count on the left ──
  if (isMobile) {
    return (
      <div style={{
        padding: '6px 8px 6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1,
        minWidth: 0,
      }}>
        {/* Title + Active count */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: '1.3',
          }}>
            {title || 'Untitled'}
          </div>
          <div
            onClick={onCollaboratorsClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontWeight: 500,
              cursor: onCollaboratorsClick ? 'pointer' : 'default',
              lineHeight: '1.2',
              marginTop: '1px',
            }}
          >
            <Users size={11} style={{ opacity: 0.7 }} />
            <span>{collaborators.length > 0 ? `${collaborators.length} active` : 'No collaborators'}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop layout: original design ──
  return (
    <div style={{
      padding: '10px 16px 10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexShrink: 0,
      paddingRight: '16px'
    }}>
      <div style={{ flex: 1 }} /> {/* Spacer to push actions to the right */}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Presence Avatars */}
        <div 
          onClick={onCollaboratorsClick}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginRight: '8px', 
            cursor: onCollaboratorsClick ? 'pointer' : 'default' 
          }}
        >
          {collaborators.length > 0 && (
            <span style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '13px', 
              marginRight: '12px',
              fontWeight: 500 
            }}>
              {collaborators.length} other collaborator{collaborators.length === 1 ? '' : 's'}
            </span>
          )}
          {collaborators.map((c) => (
            <CollaboratorAvatar key={c.id} collaborator={c} />
          ))}
        </div>

        {/* Share button */}
        {onShareClick && (
          <button
            onClick={onShareClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 16px',
              height: 32,
              background: '#7c6bf0',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease, box-shadow 0.15s ease',
              willChange: 'transform, box-shadow',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(124, 107, 240, 0.3)',
              transform: 'translateZ(0)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 107, 240, 0.45)';
              e.currentTarget.style.transform = 'translateY(-1px) translateZ(0)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 107, 240, 0.3)';
              e.currentTarget.style.transform = 'translateY(0) translateZ(0)';
            }}
            title="Share project"
            type="button"
            id="toolbar-share"
          >
            <Share2 size={14} />
            Share
          </button>
        )}

        {/* Sync status badge - Premium Pill Style */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 14px',
          height: 30,
          borderRadius: '15px',
          background: `${config.color}15`, // 15% opacity
          border: `1px solid ${config.color}30`, // 30% opacity
          color: config.color,
          fontSize: '12px',
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: `0 0 10px ${config.color}10`,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, border-color 0.3s ease',
          transform: 'translateZ(0)'
        }}>
          <StatusIcon 
            size={14} 
            style={{ 
              animation: syncIndicator === 'syncing' ? 'spin 2s linear infinite' : 'none',
              filter: `drop-shadow(0 0 2px ${config.color})`
            }} 
          />
          <span style={{ letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: '10px' }}>
            {config.label}
          </span>
        </div>
      </div>
    </div>
  );
});
