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
      case 'completed': return '#6dd49e';
      case 'partially_completed': return '#facc15';
      case 'not_completed': return '#ef4444';
      default: return '#7c6bf0';
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
        background: 'rgba(13, 13, 26, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid rgba(124, 107, 240, 0.3)`,
        borderRadius: '16px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        overflow: 'hidden',
        color: '#e8eaf0',
        animation: 'slide-in-right 0.3s ease-out'
      }}
    >
      <div style={{
        padding: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(124, 107, 240, 0.05)'
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
            color: '#a0a4b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#a0a4b8'}
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
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            padding: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              {res.status === 'met' ? (
                <CheckCircle size={16} color="#6dd49e" style={{ marginTop: '2px', flexShrink: 0 }} />
              ) : (
                <XCircle size={16} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  {instructionTexts[index] || `Instruction ${index + 1}`}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
                  {res.reason}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px',
            background: '#7c6bf0',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
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
