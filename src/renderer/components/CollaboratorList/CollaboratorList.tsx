import React, { useState, useEffect, memo } from 'react';
import type { CollaboratorListProps } from './CollaboratorList.types';
import { getUserAvatar } from '../../utils/avatar.utils';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';

interface CollaboratorItemProps {
  member: any;
  isOwner: boolean;
  currentUserId: string | null;
  onContextMenu: (e: React.MouseEvent, userId: string, name: string) => void;
  onKick?: (uid: string, name: string) => void;
}

const CollaboratorItem: React.FC<CollaboratorItemProps> = memo(({
  member: c, isOwner, currentUserId, onContextMenu, onKick
}) => {
  console.log('[CollaboratorItem] isOwner:', isOwner, '| member:', c.name, '| role:', c.role, '| currentUserId:', currentUserId, '| c.id:', c.id);
  return (
  <div 
    className="collaborator-item"
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
    {isOwner && c.id !== currentUserId && c.role !== 'Guest' && (
      <button
        onClick={() => onKick?.(c.id, c.name)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,99,99,0.7)',
          cursor: 'pointer',
          fontSize: '11px',
          padding: '2px 6px',
          borderRadius: '4px',
          opacity: 0,
          transition: 'opacity 0.2s',
        }}
        className="kick-btn"
        title={`Remove ${c.name} from project`}
      >
        Remove
      </button>
    )}
  </div>
  );
});

export const CollaboratorList: React.FC<CollaboratorListProps> = memo(({ 
  members, 
  onKick, 
  isOwner,
  currentUserId,
  onClose
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string; name: string } | null>(null);

  // BUG 1 FIX: Deduplicate members by id
  const uniqueMembers = Array.from(
    new Map(members.map(m => [m.id, m])).values()
  );

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // BUG 2 FIX: Log onKick prop to verify it's being passed
  console.log('[CollaboratorList] onKick prop:', typeof onKick, onKick);

  // Derive isOwner from members data - more reliable than prop chain
  const derivedIsOwner = uniqueMembers.some(m => m.id === currentUserId && m.role === 'Owner');
  const effectiveIsOwner = isOwner || derivedIsOwner;

  if (!uniqueMembers || uniqueMembers.length === 0) return null;

  const onlineMembers = uniqueMembers.filter(m => m.isOnline);
  const offlineMembers = uniqueMembers.filter(m => !m.isOnline);

  const handleMemberContextMenu = (e: React.MouseEvent, userId: string, name: string) => {
    const member = uniqueMembers.find(m => m.id === userId);
    if (!effectiveIsOwner || userId === currentUserId || member?.role === 'Guest') return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, userId, name });
  };

  return (
    <div className="collaborator-list-panel">
      <div className="collaborator-list-panel__header" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Collaborators</h2>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '4px', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

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
                isOwner={effectiveIsOwner} 
                currentUserId={currentUserId ?? null} 
                onContextMenu={handleMemberContextMenu} 
                onKick={onKick}
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
                isOwner={effectiveIsOwner} 
                currentUserId={currentUserId ?? null} 
                onContextMenu={handleMemberContextMenu} 
                onKick={onKick}
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
          background: 'var(--theme-background)',
          border: '1px solid #1e1e3f',
          borderRadius: '6px',
          padding: '4px',
          zIndex: 10000,
          boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
          minWidth: '160px'
        }}>
          {/* User details */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px  solid var(--theme-border)',
            marginBottom: '4px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--theme-text-secondary)', marginBottom: '2px' }}>USER ID</div>
            <div style={{
              fontSize: '10px',
              color: 'var(--theme-text-secondary)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              userSelect: 'text'
            }}>
              {contextMenu.userId}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.userId);
              }}
              style={{
                marginTop: '4px',
                fontSize: '10px',
                color: 'var(--theme-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Copy UID
            </button>
          </div>
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

