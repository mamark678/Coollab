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
      backgroundColor: 'color-mix(in srgb, var(--theme-background) 80%, black)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        maxWidth: 520, width: '100%',
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderRadius: 20,
        padding: 32,
        boxShadow: '0 25px 60px color-mix(in srgb, var(--theme-text-primary) 12%, transparent)',
        position: 'relative',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Close Button */}
        <button 
          onClick={onCancel}
          style={{
            position: 'absolute', top: 24, right: 24,
            background: 'transparent', border: 'none', color: 'var(--theme-text-secondary)',
            cursor: 'pointer', padding: 8, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-text-primary) 8%, transparent)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <X size={18} />
        </button>

        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--theme-primary) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: 'var(--theme-primary)'
          }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            Existing Activities Found
          </h2>
          <p style={{ fontSize: 14, color: 'var(--theme-text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
            This project already has {existingCount} activities. How would you like to proceed?
          </p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {/* Option A: Add to existing */}
          <div 
            onClick={() => setMode('add')}
            style={{
              padding: 16, borderRadius: 12, cursor: 'pointer',
              background: mode === 'add' ? 'color-mix(in srgb, var(--theme-primary) 8%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 2%, transparent)',
              border: mode === 'add' ? '1px solid var(--theme-primary)' : '1px solid color-mix(in srgb, var(--theme-text-primary) 8%, transparent)',
              transition: 'all 0.2s', display: 'flex', gap: 14
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', border: `2px solid ${mode === 'add' ? 'var(--theme-primary)' : 'color-mix(in srgb, var(--theme-text-primary) 30%, transparent)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
            }}>
              {mode === 'add' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--theme-primary)' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} className={mode === 'add' ? 'text-[var(--theme-primary)]' : 'text-[var(--theme-text-secondary)]'} /> Option A — Add to existing
              </div>
              <div style={{ fontSize: 13, color: 'var(--theme-text-secondary)', lineHeight: 1.4 }}>
                Add new activities after existing ones. Student progress and workspaces will be preserved.
              </div>
            </div>
          </div>

          {/* Option B: Replace all */}
          <div 
            onClick={() => setMode('replace')}
            style={{
              padding: 16, borderRadius: 12, cursor: 'pointer',
              background: mode === 'replace' ? 'color-mix(in srgb, var(--theme-error) 8%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 2%, transparent)',
              border: mode === 'replace' ? '1px solid var(--theme-error)' : '1px solid color-mix(in srgb, var(--theme-text-primary) 8%, transparent)',
              transition: 'all 0.2s', display: 'flex', gap: 14
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%', border: `2px solid ${mode === 'replace' ? 'var(--theme-error)' : 'color-mix(in srgb, var(--theme-text-primary) 30%, transparent)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2
            }}>
              {mode === 'replace' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--theme-error)' }} />}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} className={mode === 'replace' ? 'text-[var(--theme-error)]' : 'text-[var(--theme-text-secondary)]'} /> Option B — Replace all activities
              </div>
              <div style={{ fontSize: 13, color: 'var(--theme-text-secondary)', lineHeight: 1.4 }}>
                Delete all existing activities and replace with new ones.
              </div>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        {mode === 'replace' && (
          <div style={{
            background: 'color-mix(in srgb, var(--theme-error) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--theme-error) 20%, transparent)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 24,
            display: 'flex', gap: 12, alignItems: 'flex-start'
          }}>
            <AlertTriangle size={18} color="var(--theme-error)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--theme-error)', fontWeight: 600, lineHeight: 1.5 }}>
              ⚠️ WARNING: All student workspaces and progress will be permanently cleared. This cannot be undone.
            </div>
          </div>
        )}

        {/* Stats Table */}
        <div style={{
          background: 'color-mix(in srgb, var(--theme-background) 30%, var(--theme-surface))',
          borderRadius: 12, border: '1px solid var(--theme-border)',
          padding: 16, marginBottom: 32
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--theme-text-secondary)' }}>Existing activities:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-primary)' }}>{existingCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--theme-text-secondary)' }}>New activities to add:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: mode === 'replace' ? 'var(--theme-error)' : 'var(--theme-primary)' }}>
              {mode === 'replace' ? 'REPLACING' : `+ ${newCount}`}
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--theme-border)', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--theme-text-primary)' }}>Total after proceeding:</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--theme-text-primary)' }}>{mode === 'replace' ? newCount : existingCount + newCount}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => onProceed(mode)}
            style={{
              flex: 1, padding: '14px 24px',
              background: mode === 'replace' ? 'linear-gradient(135deg, var(--theme-error), color-mix(in srgb, var(--theme-error) 80%, black))' : 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
              border: 'none', borderRadius: 12, color: 'var(--theme-on-primary)',
              fontSize: 15, fontWeight: 800, cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: mode === 'replace' ? '0 8px 20px color-mix(in srgb, var(--theme-error) 30%, transparent)' : '0 8px 20px color-mix(in srgb, var(--theme-primary) 30%, transparent)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {mode === 'replace' ? 'Replace All' : 'Proceed'}
          </button>
          <button 
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px 24px',
              background: 'transparent', border: '1px solid var(--theme-border)',
              borderRadius: 12, color: 'var(--theme-text-secondary)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--theme-primary)';
              e.currentTarget.style.color = 'var(--theme-text-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--theme-border)';
              e.currentTarget.style.color = 'var(--theme-text-secondary)';
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
