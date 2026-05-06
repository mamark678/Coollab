import React, { useState, useEffect, memo } from 'react';
import type { CollaboratorListProps } from './CollaboratorList.types';
import { getUserAvatar } from '../../utils/avatar.utils';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';

export const CollaboratorList: React.FC<CollaboratorListProps> = memo(({ 
  members, 
  onKick, 
  isOwner,
  currentUserId,
  onClose
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

interface CollaboratorItemProps {
  member: any;
  isOwner: boolean;
  currentUserId: string | null;
  onContextMenu: (e: React.MouseEvent, userId: string, name: string) => void;
}

const CollaboratorItem: React.FC<CollaboratorItemProps> = memo(({
  member: c, isOwner, currentUserId, onContextMenu
}) => (
  <div 
    onContextMenu={(e) => onContextMenu(e, c.id, c.name)}
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      padding: '6px 0',
      cursor: (isOwner && c.id !== currentUserId && c.role !== 'Guest') ? 'context-menu' : 'default',
      opacity: c.isOnline ? 1 : 0.6,
      transition: 'opacity 0.2s ease',
      transform: 'translateZ(0)'
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
));

  const handleMemberContextMenu = (e: React.MouseEvent, userId: string, name: string) => {
    const member = members.find(m => m.id === userId);
    if (!isOwner || userId === currentUserId || member?.role === 'Guest') return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, userId, name });
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div style={{
      width: isNative ? '100%' : '240px',
      background: 'var(--surface-mantle)',
      borderLeft: '1px solid var(--border-primary)',
      padding: '20px 16px',
      position: isNative ? 'absolute' : 'relative',
      right: 0,
      top: 0,
      height: '100%',
      overflowY: 'auto',
      zIndex: isNative ? 100 : 1,
      transform: 'translateZ(0)',
      willChange: 'transform'
    }}>
      {isNative && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Collaborators</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '4px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
      )}

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
            {onlineMembers.map(m => (
              <CollaboratorItem 
                key={m.id} 
                member={m} 
                isOwner={isOwner ?? false} 
                currentUserId={currentUserId ?? null} 
                onContextMenu={handleMemberContextMenu} 
              />
            ))}
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
            {offlineMembers.map(m => (
              <CollaboratorItem 
                key={m.id} 
                member={m} 
                isOwner={isOwner ?? false} 
                currentUserId={currentUserId ?? null} 
                onContextMenu={handleMemberContextMenu} 
              />
            ))}
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
});
