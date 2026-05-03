import React, { useState, useEffect } from 'react';
import type { CollaboratorListProps } from './CollaboratorList.types';
import { getUserAvatar } from '../../utils/avatar.utils';

export const CollaboratorList: React.FC<CollaboratorListProps> = ({ 
  members, 
  onKick, 
  isOwner,
  currentUserId 
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; name: string } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  if (!members || members.length === 0) return null;

  const onlineMembers = members.filter(m => m.isOnline);
  const offlineMembers = members.filter(m => !m.isOnline);

  const renderMember = (c: any) => (
    <div 
      key={c.id} 
      onContextMenu={(e) => {
        if (!isOwner || c.id === currentUserId || c.role === 'Guest') return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, userId: c.id, name: c.name });
      }}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        padding: '6px 0',
        cursor: (isOwner && c.id !== currentUserId && c.role !== 'Guest') ? 'context-menu' : 'default',
        opacity: c.isOnline ? 1 : 0.6
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: c.color || '#4b5563',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '12px',
          overflow: 'hidden'
        }}>
          {getUserAvatar(c) ? (
            <img src={getUserAvatar(c)!} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            c.name.substring(0, 2).toUpperCase()
          )}
        </div>
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: c.isOnline ? '#22c55e' : '#ef4444',
          border: '2px solid var(--surface-mantle)',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}>
          {c.name} {c.id === currentUserId && '(You)'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
          {c.role}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      width: '240px',
      background: 'var(--surface-mantle)',
      borderLeft: '1px solid var(--border-primary)',
      padding: '20px 16px',
      position: 'relative',
      height: '100%',
      overflowY: 'auto'
    }}>
      {onlineMembers.length > 0 && (
        <>
          <h3 style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            marginBottom: '12px',
            fontWeight: 700,
          }}>
            Online ({onlineMembers.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
            {onlineMembers.map(renderMember)}
          </div>
        </>
      )}

      {onlineMembers.length > 0 && offlineMembers.length > 0 && (
        <div style={{ height: '1px', background: 'var(--border-primary)', margin: '16px 0', opacity: 0.5 }} />
      )}

      {offlineMembers.length > 0 && (
        <>
          <h3 style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            marginBottom: '12px',
            fontWeight: 700,
          }}>
            Offline ({offlineMembers.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {offlineMembers.map(renderMember)}
          </div>
        </>
      )}

      {/* Kick Context Menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          background: '#0a0a14',
          border: '1px solid #1e1e3f',
          borderRadius: '6px',
          padding: '4px',
          zIndex: 10000,
          boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
          minWidth: '160px'
        }}>
          <button 
            onClick={() => onKick?.(contextMenu.userId, contextMenu.name)}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              color: '#ff4d4f',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 77, 79, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Kick from Project
          </button>
        </div>
      )}
    </div>
  );
};
