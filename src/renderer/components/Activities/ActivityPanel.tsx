import {
  CheckCircle,
  Target,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Activity, ActivityService } from '../../services/activity';
import { FirebaseService } from '../../services/firebase';
import { useAppStore } from '../../store/useAppStore';
import './Activities.css';

interface ActivityPanelProps {
  /** Called when the user closes the panel */
  onClose: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  onClose,
}) => {
  const { state: { user } } = useAuth();
  const { currentProjectId } = useAppStore();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerPhase, setTimerPhase] = useState<'normal' | 'grace'>('normal');
  const [retryCount, setRetryCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNextActivity = useCallback(async (isInitial = false) => {
    if (!user || !currentProjectId) return;

    if (!isInitial) {
      setIsTransitioning(true);
      await new Promise(resolve => setTimeout(resolve, 400));
    } else {
      setLoading(true);
    }

    try {
      const next = await ActivityService.getInstance().getNextActivity(currentProjectId, user.uid);
      if (next) {
        setActivity(next);
        setIsFinished(false);
        setShowConfirm(false);

        // Fetch completion to get startedAt
        const db = FirebaseService.getInstance().db;
        const { getDoc, doc } = require('firebase/firestore');
        const compSnap = await getDoc(doc(db, `notes/${currentProjectId}/activities/${next.id}/completions/${user.uid}`));
        let startedAt = Date.now();
        if (compSnap.exists() && compSnap.data().startedAt) {
          startedAt = compSnap.data().startedAt;
        }

        if (next.timer_config && next.timer_config.duration_seconds > 0) {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          const remaining = Math.max(0, next.timer_config.duration_seconds - elapsed);
          setTimeLeft(remaining);
          setTimerPhase('normal');
          setRetryCount(0);
        } else {
          setTimeLeft(0);
        }
      } else {
        setActivity(null);
        setIsFinished(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load activity');
    } finally {
      setLoading(false);
      setIsTransitioning(false);
    }
  }, [user, currentProjectId]);

  useEffect(() => {
    loadNextActivity(true);

    const handleTransition = () => {
      loadNextActivity();
    };

    window.addEventListener('activity-transition', handleTransition);
    return () => window.removeEventListener('activity-transition', handleTransition);
  }, [loadNextActivity]);

  // ── Timer Logic ──────────────────────────────────────────────────────────
  // ── Timer Logic — UNIFIED with ActivityTriggerService ───────────────────
  // Instead of running our own setInterval (which conflicts), we consume
  // the single timer-tick events dispatched by ActivityTriggerService.
  useEffect(() => {
    if (!activity || !activity.timer_config || isFinished) return;

    const handleTimerTick = (e: any) => {
      const { remaining, isLate } = e.detail;
      setTimeLeft(remaining);

      // Handle timeout actions when timer reaches 0
      if (remaining <= 0 && isLate && currentProjectId && user && activity) {
        const config = activity.timer_config!;
        const timeoutAction = config.on_timeout || 'auto_submit';

        if (timeoutAction === 'grace_period' && timerPhase === 'normal' && config.grace_period_seconds > 0) {
          setTimerPhase('grace');
        } else if (timeoutAction === 'auto_submit') {
          // Auto-submit is handled by ActivityTriggerService — no duplicate writes needed
          // The trigger service will fire activity-transition which calls loadNextActivity
        } else if (timeoutAction !== 'grace_period') {
          // mark_failed or exhausted retry/grace
          ActivityService.getInstance().markTimedOut(
            currentProjectId, 
            user.uid, 
            activity.id, 
            config.duration_seconds
          );
        }
      }
    };

    window.addEventListener('activity-timer-tick', handleTimerTick);
    return () => window.removeEventListener('activity-timer-tick', handleTimerTick);
  }, [activity, isFinished, currentProjectId, user, timerPhase, retryCount]);

  const handleSubmit = useCallback(() => {
    window.dispatchEvent(new Event('complete-current-activity'));
    setShowConfirm(false);
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="activity-panel">
        <div className="activity-panel__header">
          <div className="activity-panel__header-left">
            <div className="activity-panel__icon">
              <Target size={16} />
            </div>
            <span className="activity-panel__title">Activities</span>
          </div>
          <button className="activity-panel__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="activity-loading">
          <div className="activity-loading__spinner" />
          <span className="activity-loading__text">Loading next activity...</span>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="activity-panel">
        <div className="activity-panel__header">
          <div className="activity-panel__header-left">
            <div className="activity-panel__icon">
              <Target size={16} />
            </div>
            <span className="activity-panel__title">Activities</span>
          </div>
          <button className="activity-panel__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="activity-completion-screen">
          <div className="activity-completion-screen__icon">🎉</div>
          <div className="activity-completion-screen__title">All Done!</div>
          <div className="activity-completion-screen__subtitle">
            You have completed all activities!
          </div>
        </div>
      </div>
    );
  }

  if (!activity) return null;

  const totalDuration = timerPhase === 'grace'
    ? (activity.timer_config?.grace_period_seconds || 1)
    : (activity.timer_config?.duration_seconds || 1);
  const timerProgress = timeLeft / totalDuration;
  const timerCircumference = 2 * Math.PI * 16;

  let timerColor = '#6dd49e'; // default green
  if (timerPhase === 'grace') {
    timerColor = '#e66b7a';
  } else if (timeLeft <= 10) {
    timerColor = '#e66b7a'; // red
  } else if (timeLeft <= 30) {
    timerColor = '#e6c96e'; // yellow
  }

  return (
    <div className={`activity-panel ${isTransitioning ? 'activity-panel--transitioning' : ''}`}>
      <div className="activity-panel__header">
        <div className="activity-panel__header-left">
          <div className="activity-panel__icon">
            <Target size={16} />
          </div>
          <span className="activity-panel__title">Activities</span>
        </div>
        <button className="activity-panel__close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="activity-active">
        <div className="activity-active__info">
          <div className="activity-active__title">{activity.title}</div>
          <div className="activity-active__description">{activity.description}</div>
        </div>

        {activity.timer_config && activity.timer_config.duration_seconds > 0 && (
          <div className="activity-timer">
            <div className="activity-timer__ring">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <circle className="activity-timer__ring-bg" cx="20" cy="20" r="16" />
                <circle
                  className="activity-timer__ring-fill"
                  cx="20" cy="20" r="16"
                  stroke={timerColor}
                  strokeDasharray={timerCircumference}
                  strokeDashoffset={timerCircumference * (1 - timerProgress)}
                />
              </svg>
            </div>
            <div>
              <div className="activity-timer__text">
                {formatTime(timeLeft)}
              </div>
              <div className="activity-timer__label">Time remaining</div>
            </div>
          </div>
        )}

        <div className="activity-steps">
          <div className="activity-steps__title">Your Task</div>
          {activity.instructions?.map((inst, idx) => {
            return (
              <div key={idx} className="activity-step">
                <span className="activity-step__number">
                  {idx + 1}
                </span>
                <div className="activity-step__content">
                  <div className="activity-step__instruction">{inst}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          {showConfirm ? (
            <div style={{ background: 'rgba(124, 107, 240, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(124, 107, 240, 0.2)' }}>
              <div style={{ marginBottom: 12, fontSize: 13, textAlign: 'center', color: '#fff' }}>Are you sure you want to submit?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={handleSubmit}
                  style={{ flex: 1, padding: '8px', background: '#7c6bf0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Yes
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  style={{ flex: 1, padding: '8px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowConfirm(true)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #7c6bf0, #6558d4)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(124, 107, 240, 0.3)'
              }}
            >
              Submit Work
            </button>
          )}
        </div>


      </div>
    </div>
  );
};

export default ActivityPanel;
