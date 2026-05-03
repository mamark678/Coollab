import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, X, Layers, Trash2 } from 'lucide-react';

interface OverlapConfirmationModalProps {
  isOpen: boolean;
  existingCount: number;
  newCount: number;
  onProceed: (mode: 'add' | 'replace') => void;
  onCancel: () => void;
}

export const OverlapConfirmationModal: React.FC<OverlapConfirmationModalProps> = ({
  isOpen,
  existingCount,
  newCount,
  onProceed,
  onCancel
}) => {
  const [mode, setMode] = useState<'add' | 'replace'>('add');

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        maxWidth: 520, width: '100%',
        background: '#1a1b1e',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
        position: 'relative',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <button 
          onClick={onCancel}
          style={{
            position: 'absolute', top: 24, right: 24,
            background: 'transparent', border: 'none', color: '#6b6f82',
            cursor: 'pointer', padding: 4, borderRadius: '50%',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(124, 107, 240, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: '#7c6bf0'
          }}>
            <AlertTriangle size={32} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            Existing Activities Found
          </h2>
          <p style={{ fontSize: 14, color: '#6b6f82', marginTop: 8 }}>
            This project already has {existingCount} activities. How would you like to proceed?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {/* Option A: Add to existing */}
          <div 
            onClick={() => setMode('add')}
            style={{
              padding: 16, borderRadius: 12, cursor: 'pointer',
              background: mode === 'add' ? 'rgba(124, 107, 240, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: mode === 'add' ? '1px solid rgba(124, 107, 240, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
              transition: 'all 0.2s', display: 'flex', gap: 14
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', border: `2px solid ${mode === 'add' ? '#7c6bf0' : '#4b5563'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
            }}>
              {mode === 'add' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c6bf0' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: mode === 'add' ? '#fff' : '#a0a4b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} /> Option A — Add to existing
              </div>
              <div style={{ fontSize: 13, color: '#6b6f82', lineHeight: 1.4 }}>
                Add new activities after existing ones. Student progress and workspaces will be preserved.
              </div>
            </div>
          </div>

          {/* Option B: Replace all */}
          <div 
            onClick={() => setMode('replace')}
            style={{
              padding: 16, borderRadius: 12, cursor: 'pointer',
              background: mode === 'replace' ? 'rgba(230, 107, 122, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: mode === 'replace' ? '1px solid rgba(230, 107, 122, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
              transition: 'all 0.2s', display: 'flex', gap: 14
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', border: `2px solid ${mode === 'replace' ? '#e66b7a' : '#4b5563'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
            }}>
              {mode === 'replace' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e66b7a' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: mode === 'replace' ? '#fff' : '#a0a4b8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} /> Option B — Replace all activities
              </div>
              <div style={{ fontSize: 13, color: '#6b6f82', lineHeight: 1.4 }}>
                Delete all existing activities and replace with new ones.
              </div>
            </div>
          </div>
        </div>

        {mode === 'replace' && (
          <div style={{
            background: 'rgba(230, 107, 122, 0.1)',
            border: '1px solid rgba(230, 107, 122, 0.2)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 24,
            display: 'flex', gap: 12, alignItems: 'flex-start'
          }}>
            <AlertTriangle size={18} color="#e66b7a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: '#e66b7a', fontWeight: 500, lineHeight: 1.5 }}>
              ⚠️ WARNING: All student workspaces and progress will be permanently cleared. This cannot be undone.
            </div>
          </div>
        )}

        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: 16, marginBottom: 32
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#6b6f82' }}>Existing activities:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0' }}>{existingCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#6b6f82' }}>New activities to add:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: mode === 'replace' ? '#e66b7a' : '#7c6bf0' }}>
              {mode === 'replace' ? 'REPLACING' : `+ ${newCount}`}
            </span>
          </div>
          <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Total after proceeding:</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{mode === 'replace' ? newCount : existingCount + newCount}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => onProceed(mode)}
            style={{
              flex: 1, padding: '14px 24px',
              background: mode === 'replace' ? 'linear-gradient(135deg, #e66b7a, #d44d5d)' : 'linear-gradient(135deg, #7c6bf0, #6558d4)',
              border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s', boxShadow: mode === 'replace' ? '0 4px 15px rgba(230, 107, 122, 0.3)' : '0 4px 15px rgba(124, 107, 240, 0.3)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {mode === 'replace' ? 'Replace All' : 'Proceed'}
          </button>
          <button 
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px 24px',
              background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12, color: '#a0a4b8',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.color = '#a0a4b8';
            }}
          >
            Cancel
          </button>
        </div>

        <style>{`
          @keyframes modalSlideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};
