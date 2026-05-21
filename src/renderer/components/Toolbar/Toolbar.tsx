import { ArrowLeft, Check, RefreshCw, Share2, Users, WifiOff } from 'lucide-react';
import React, { memo } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAppStore } from '../../store/useAppStore';
import type { ToolbarProps } from './Toolbar.types';

const statusIcons = {
  synced: Check,
  syncing: RefreshCw,
  offline: WifiOff
};

const statusConfig = {
  synced: { color: 'var(--theme-success)', label: 'Synced' },
  syncing: { color: 'var(--theme-secondary)', label: 'Syncing…' },
  offline: { color: 'var(--theme-error)', label: 'Offline' }
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
      backgroundColor: c.color || 'var(--theme-primary)',
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

  const isMobile = useIsMobile();

  // ── Mobile layout: Title on left, avatars & share on right ──
  if (isMobile) {
    return (
      <div style={{
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
        minWidth: 0,
        height: '48px'
      }}>
        {/* Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1
        }}>
          {title || 'Untitled'}
        </div>
        
        {/* Right actions: Avatars + Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Presence Avatars */}
          <div 
            onClick={onCollaboratorsClick}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            {collaborators.map((c) => (
              <CollaboratorAvatar key={c.id} collaborator={c} />
            ))}
          </div>
          
          {/* Share icon */}
          {onShareClick && (
            <button
              onClick={onShareClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                background: 'transparent',
                border: 'none',
                color: 'var(--theme-text-primary)',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <Share2 size={18} />
            </button>
          )}
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
            <span className="toolbar-collaborators-label" style={{ 
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
              background: 'var(--theme-primary)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--theme-on-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s ease, box-shadow 0.15s ease',
              willChange: 'transform, box-shadow',
              flexShrink: 0,
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-primary) 30%, transparent)',
              transform: 'translateZ(0)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px color-mix(in srgb, var(--theme-primary) 45%, transparent)';
              e.currentTarget.style.transform = 'translateY(-1px) translateZ(0)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px color-mix(in srgb, var(--theme-primary) 30%, transparent)';
              e.currentTarget.style.transform = 'translateY(0) translateZ(0)';
            }}
            title="Share project"
            type="button"
            id="toolbar-share"
          >
            <Share2 size={14} />
            <span>Share</span>
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
          background: `color-mix(in srgb, ${config.color} 15%, transparent)`, // 15% opacity
          border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`, // 30% opacity
          color: config.color,
          fontSize: '12px',
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: `0 0 10px color-mix(in srgb, ${config.color} 10%, transparent)`,
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
