import { ArrowLeft, Check, RefreshCw, Share2, WifiOff } from 'lucide-react';
import React, { memo } from 'react';
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

export const Toolbar: React.FC<ToolbarProps> = memo(({ title, onTitleChange, syncIndicator, onShareClick, collaborators = [], onCollaboratorsClick }) => {
  const { setCurrentNoteId } = useAppStore();
  const config = statusConfig[syncIndicator];
  const StatusIcon = statusIcons[syncIndicator] || Check;

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
            <div
              key={c.id}
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
                overflow: 'hidden'
              }}
            >
              {c.photoURL ? (
                <img src={c.photoURL} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                c.name.charAt(0).toUpperCase()
              )}
            </div>
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
              transition: 'transform 0.2s, opacity 0.2s, box-shadow 0.2s',
              willChange: 'transform, opacity',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(124, 107, 240, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(124, 107, 240, 0.45)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(124, 107, 240, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            title="Share project"
            type="button"
            id="toolbar-share"
          >
            <Share2 size={14} />
            Share
          </button>
        )}

        {/* Sync status badge - Outline Style */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 12px',
          height: 32,
          borderRadius: '8px',
          border: `1px solid ${config.color}`,
          color: config.color,
          fontSize: '12px',
          fontWeight: 600,
          background: 'transparent',
          flexShrink: 0,
          transition: 'transform 0.4s ease, opacity 0.4s ease',
          willChange: 'transform, opacity',
        }}>
          <StatusIcon size={14} style={{ animation: syncIndicator === 'syncing' ? 'spin 2s linear infinite' : 'none' }} />
          <span>{config.label}</span>
        </div>
      </div>
    </div>
  );
});

