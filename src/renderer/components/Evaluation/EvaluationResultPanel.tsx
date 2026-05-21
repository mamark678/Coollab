import React from 'react';
import { X, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface InstructionResult {
  status: 'met' | 'not_met';
  reason: string;
}

interface EvaluationResultPanelProps {
  verdict: 'completed' | 'partially_completed' | 'not_completed';
  instructions: InstructionResult[];
  instructionTexts: string[];
  onClose: () => void;
}

const EvaluationResultPanel: React.FC<EvaluationResultPanelProps> = ({
  verdict,
  instructions,
  instructionTexts = [],
  onClose
}) => {
  const getVerdictColor = () => {
    switch (verdict) {
      case 'completed': return 'var(--theme-success)';
      case 'partially_completed': return 'var(--theme-secondary)';
      case 'not_completed': return 'var(--theme-error)';
      default: return 'var(--theme-primary)';
    }
  };

  const getVerdictText = () => {
    switch (verdict) {
      case 'completed': return 'Work Completed';
      case 'partially_completed': return 'Partially Completed';
      case 'not_completed': return 'Not Completed Yet';
      default: return 'Evaluation Result';
    }
  };

  return (
    <div 
      className="evaluation-result-panel"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '360px',
        maxHeight: '80vh',
        background: 'color-mix(in srgb, var(--theme-background) 95%, transparent)',
        backdropFilter: 'blur(12px)',
        border: `1px solid color-mix(in srgb, var(--theme-primary) 30%, transparent)`,
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        overflow: 'hidden',
        color: 'var(--theme-text-primary)',
        animation: 'slide-in-right 0.3s ease-out'
      }}
    >
      <div style={{
        padding: '16px',
        borderBottom: '1px  solid var(--theme-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'color-mix(in srgb, var(--theme-primary) 5%, transparent)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: getVerdictColor(),
            boxShadow: `0 0 8px ${getVerdictColor()}`
          }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: getVerdictColor() }}>
            {getVerdictText()}
          </h3>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--theme-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text-secondary)'}
        >
          <X size={18} />
        </button>
      </div>

      <div style={{ 
        padding: '16px', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {instructions && instructions.map((res, index) => (
          <div key={index} style={{
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.03 * 100}%, transparent)`,
            borderRadius: '12px',
            padding: '12px',
            border: '1px  solid var(--theme-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              {res.status === 'met' ? (
                 <CheckCircle size={16} color="var(--theme-success)" style={{ marginTop: '2px', flexShrink: 0 }} />
              ) : (
                 <XCircle size={16} color="var(--theme-error)" style={{ marginTop: '2px', flexShrink: 0 }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--theme-text-primary)' }}>
                  {instructionTexts[index] || `Instruction ${index + 1}`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', lineHeight: '1.4' }}>
                  {res.reason}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px', borderTop: '1px  solid var(--theme-border)' }}>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px',
            background: 'var(--theme-primary)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--theme-text-primary)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'filter 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}
        >
          Close
        </button>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default EvaluationResultPanel;
