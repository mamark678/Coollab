import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Circle,
  Zap,
  Info
} from 'lucide-react';
import { Activity } from '../../services/activity';

interface StudentActivityDisplayProps {
  projectId: string;
}

export const StudentActivityDisplay: React.FC<StudentActivityDisplayProps> = ({ projectId }) => {
  const [activityData, setActivityData] = useState<{ activity: Activity, status: string, startedAt: number | null } | null>(null);
  const [timer, setTimer] = useState<{ remaining: number; total: number; isLate?: boolean } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const handleActivityChange = (e: any) => {
      setActivityData(e.detail);
      setTimer(null); // Reset timer when activity changes
      setShowConfirm(false);
    };

    const handleTimerTick = (e: any) => {
      setTimer(e.detail);
    };

    window.addEventListener('current-activity-changed', handleActivityChange);
    window.addEventListener('activity-timer-tick', handleTimerTick);

    return () => {
      window.removeEventListener('current-activity-changed', handleActivityChange);
      window.removeEventListener('activity-timer-tick', handleTimerTick);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (!timer) return '#7c3aed';
    if (timer.isLate) return '#ef4444';
    const percent = (timer.remaining / timer.total) * 100;
    if (percent < 20) return '#ef4444';
    if (percent < 50) return '#f59e0b';
    return '#7c3aed';
  };

  if (!activityData) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="student-activity-finished"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'rgba(13, 13, 26, 0.95)',
            border: '1px solid rgba(110, 212, 158, 0.3)',
            borderRadius: '12px',
            padding: '16px 24px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <Trophy size={24} color="#6dd49e" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>All Done!</div>
            <div style={{ fontSize: '13px', color: '#6dd49e' }}>You've completed all tasks. Well done!</div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  const { activity, status } = activityData;

  // Pending State (Full Screen Lobby)
  if (status === 'pending') {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13, 13, 26, 0.98)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        padding: '20px'
      }}>
        <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <Trophy size={64} color="#7c6bf0" style={{ marginBottom: '24px' }} />
          <h1 style={{ fontSize: '36px', marginBottom: '16px', fontWeight: 800 }}>{activity.title}</h1>
          <div style={{ fontSize: '18px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '40px' }}>
            <p style={{ marginBottom: '16px' }}>{activity.description}</p>
            <p style={{ fontWeight: 'bold', color: '#cbd5e1' }}>
              Read the instructions carefully. Be aware of the timer. After you're done, submit your work.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '40px', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} />
              <span>{Math.floor((activity.timer_config?.duration_seconds || 0) / 60)} minutes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} />
              <span>{activity.points} points</span>
            </div>
          </div>

          <button 
            onClick={() => window.dispatchEvent(new Event('start-current-activity'))}
            style={{
              background: '#7c6bf0',
              color: '#fff',
              border: 'none',
              padding: '16px 48px',
              borderRadius: '12px',
              fontSize: '20px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(124, 107, 240, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Start Activity
          </button>
        </div>
      </div>
    );
  }

  // In Progress State (Floating Display)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      className={`student-activity-card ${isMinimized ? 'minimized' : ''}`}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: isMinimized ? '240px' : (timer?.isLate ? '440px' : '360px'),
        background: 'rgba(13, 13, 26, 0.95)',
        border: '1px solid rgba(124, 107, 240, 0.3)',
        borderRadius: '16px',
        color: '#fff',
        zIndex: 1000,
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh'
      }}
    >
      {/* Header */}
      <div 
        style={{ 
          padding: '12px 16px', 
          background: 'rgba(124, 107, 240, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isMinimized ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <Zap size={18} color={timer?.isLate ? '#ef4444' : '#7c6bf0'} style={{ flexShrink: 0 }} />
          <span style={{ 
            fontWeight: 700, 
            fontSize: '14px', 
            letterSpacing: '0.5px', 
            textTransform: 'uppercase', 
            color: timer?.isLate ? '#ef4444' : '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {timer?.isLate ? (isMinimized ? "TIME'S UP" : "TIME'S UP — Late submissions accepted") : "Current Task"}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {timer?.isLate && (
            <div style={{
              background: '#ef4444',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>LATE</div>
          )}
          {timer && (
            <motion.div 
              animate={timer.isLate ? { 
                boxShadow: ['0 0 0px rgba(239, 68, 68, 0)', '0 0 12px rgba(239, 68, 68, 0.8)', '0 0 0px rgba(239, 68, 68, 0)'] 
              } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              background: `${getTimerColor()}22`,
              color: getTimerColor(),
              padding: '2px 8px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 800
            }}>
              <Clock size={14} />
              {formatTime(timer.remaining)}
            </motion.div>
          )}
          {isMinimized ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflowY: 'auto' }}
          >
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0', color: '#fff' }}>{activity.title}</h3>
                <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>{activity.description}</p>
              </div>

              {/* Instructions as a unified block */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Instructions
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(activity.instructions || []).map((instruction, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px' }}>
                      <Circle size={14} color="#7c6bf0" style={{ marginTop: '3px', flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>{instruction}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                <Info size={14} />
                {timer?.isLate ? (
                  <span style={{ color: '#ef4444' }}>
                    Submitted late — {Math.max(0, activity.points - (activity.timer_config?.late_penalty !== undefined ? activity.timer_config.late_penalty : activity.points))} points earned
                  </span>
                ) : (
                  <span>Earning {activity.points} points upon completion</span>
                )}
              </div>

              {/* Submit Section */}
              {showConfirm ? (
                <div style={{ background: 'rgba(124, 107, 240, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(124, 107, 240, 0.2)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textAlign: 'center', color: '#fff' }}>Are you sure you want to submit your work?</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      style={{ background: '#7c6bf0', color: '#fff', padding: '10px', border: 'none', borderRadius: '8px', flex: 1, cursor: 'pointer', fontWeight: 800 }} 
                      onClick={() => { 
                        setShowConfirm(false); 
                        window.dispatchEvent(new Event('complete-current-activity')); 
                      }}
                    >
                      Yes, Submit
                    </button>
                    <button 
                      style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '10px', borderRadius: '8px', flex: 1, cursor: 'pointer', fontWeight: 600 }} 
                      onClick={() => setShowConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  style={{ 
                    width: '100%', 
                    background: '#6dd49e', 
                    color: '#000', 
                    border: 'none', 
                    padding: '14px', 
                    borderRadius: '12px', 
                    fontWeight: 800, 
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(109, 212, 158, 0.3)'
                  }} 
                  onClick={() => setShowConfirm(true)}
                >
                  Submit Work
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
