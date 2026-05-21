import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Lock, 
  Zap, 
  Clock, 
  Layers, 
  BrainCircuit, 
  MousePointer2, 
  Layout, 
  Star,
  ChevronRight,
  TrendingUp,
  Award,
  Users,
  FileText,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ActivityType, ActivityCompletion } from '../../services/activity';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';

interface ActivityCurriculumProps {
  projectId: string;
  userRole: 'student' | 'instructor' | null;
  onSelectActivity: (activity: Activity) => void;
  studentCompletionStats?: Record<string, number>;
  totalStudents?: number;
}

export const ActivityCurriculum: React.FC<ActivityCurriculumProps> = ({ 
  projectId, 
  userRole, 
  onSelectActivity,
  studentCompletionStats = {},
  totalStudents = 0
}) => {
  const { state: { user } } = useAuth();
  const [activities, setActivities] = useState<(Activity & { completion?: ActivityCompletion })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const db = FirebaseService.getInstance().db;
    const activitiesRef = collection(db, `notes/${projectId}/activities`);
    const q = query(activitiesRef, orderBy('sequenceNumber', 'asc'));

    let unsubscribes: (() => void)[] = [];

    const unsubscribeActivities = onSnapshot(q, (snapshot) => {
      const activityList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      
      if (userRole === 'student' && user?.uid) {
        // Clear previous listeners
        unsubscribes.forEach(unsub => unsub());
        unsubscribes = [];
        
        // Initialize activities to allow UI to render immediately
        setActivities(activityList.map(a => ({ ...a })));
        setLoading(false);

        // Listen to each activity's completion for this user
        activityList.forEach(activity => {
          const compRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${user.uid}`);
          const unsub = onSnapshot(compRef, (compSnap) => {
            setActivities(prev => {
              const newActivities = [...prev];
              const idx = newActivities.findIndex(a => a.id === activity.id);
              if (idx !== -1) {
                newActivities[idx] = { 
                  ...newActivities[idx], 
                  completion: compSnap.exists() ? (compSnap.data() as ActivityCompletion) : undefined 
                };
              }
              return newActivities;
            });
          });
          unsubscribes.push(unsub);
        });
      } else {
        setActivities(activityList.map(a => ({ ...a })));
        setLoading(false);
      }
    });

    return () => {
      unsubscribeActivities();
      unsubscribes.forEach(unsub => unsub());
    };
  }, [projectId, user?.uid, userRole]);

  const stats = useMemo(() => {
    const totalXP = activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const earnedXP = activities.reduce((sum, a) => sum + (a.completion?.pointsEarned || 0), 0);
    const completedCount = activities.filter(a => a.completion?.status === 'completed').length;
    const totalCount = activities.length;
    return { totalXP, earnedXP, completedCount, totalCount };
  }, [activities]);

  const getTypeIcon = (type: ActivityType) => {
    const props = { size: 24, className: "group-hover:scale-110 transition-transform" };
    switch (type) {
      case 'flashcard': return <BrainCircuit {...props} />;
      case 'quiz': return <Zap {...props} />;
      case 'gizmo': return <MousePointer2 {...props} />;
      case 'base': return <Layout {...props} />;
      case 'reading': return <FileText {...props} />;
      case 'task': return <Target {...props} />;
      case 'discussion': return <Users {...props} />;
      case 'workspace': return <Layers {...props} />;
      default: return <Layers {...props} />;
    }
  };

  const getStatusInfo = (activity: Activity & { completion?: ActivityCompletion }, index: number) => {
    if (userRole === 'instructor') {
      const completed = studentCompletionStats[activity.id] || 0;
      return { label: `${completed}/${totalStudents} Completed`, color: 'var(--theme-primary)', icon: <Users size={12} />, isLocked: false };
    }
    const isCompleted = activity.completion?.status === 'completed';
    const isUnlocked = index === 0 || activities[index - 1].completion?.status === 'completed';
    if (isCompleted) return { label: 'Mastered', color: 'var(--theme-success)', icon: <CheckCircle2 size={12} className="text-[var(--theme-success)]" />, isLocked: false };
    if (isUnlocked) return { label: 'Ready', color: 'var(--theme-primary)', icon: <Circle size={12} className="text-[var(--theme-primary)] fill-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]" />, isLocked: false };
    return { label: 'Locked', color: 'var(--theme-text-secondary)', icon: <Lock size={12} />, isLocked: true };
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Stats row (XP Progress + Modules) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderBottom: '1px  solid var(--theme-border)'
      }}>
        <div style={{
          flex: 1, background: `color-mix(in srgb, var(--theme-primary) 8%, transparent)`,
          border: '1px solid color-mix(in srgb, var(--theme-primary) 15%, transparent)',
          borderRadius: '10px', padding: '10px 12px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--theme-text-secondary)', letterSpacing: '0.08em', marginBottom: '4px' }}>XP PROGRESS</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--theme-secondary)' }}>⭐ {stats.earnedXP} / {stats.totalXP}</div>
        </div>
        <div style={{
          flex: 1, background: `color-mix(in srgb, var(--theme-text-primary) 3%, transparent)`,
          border: '1px  solid var(--theme-border)',
          borderRadius: '10px', padding: '10px 12px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--theme-text-secondary)', letterSpacing: '0.08em', marginBottom: '4px' }}>MODULES</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--theme-text-primary)' }}>✅ {stats.completedCount} / {stats.totalCount}</div>
        </div>
      </div>

      {/* Activity Modules */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {activities.map((activity, index) => {
          const status = getStatusInfo(activity, index);
          const isLocked = status.isLocked && userRole === 'student';
          const isCompleted = activity.completion?.status === 'completed';

          return (
            <div
              key={activity.id}
              onClick={() => !isLocked && onSelectActivity(activity)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                margin: '4px 8px',
                borderRadius: '12px',
                border: '1px solid transparent',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.4 : 1,
                transition: 'all 0.15s',
                background: isCompleted ? 'color-mix(in srgb, var(--theme-success) 4%, transparent)' : 'transparent',
                borderColor: isCompleted ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' : 'transparent'
              }}
              onMouseEnter={e => { if (!isLocked) { e.currentTarget.style.background = 'color-mix(in srgb, var(--theme-primary) 8%, transparent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = isCompleted ? 'color-mix(in srgb, var(--theme-success) 4%, transparent)' : 'transparent'; e.currentTarget.style.borderColor = isCompleted ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' : 'transparent'; }}
            >
              {/* Icon circle */}
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                background: isCompleted ? 'color-mix(in srgb, var(--theme-success) 15%, transparent)' : 'color-mix(in srgb, var(--theme-primary) 15%, transparent)',
                border: `2px solid ${isCompleted ? 'var(--theme-success)' : isLocked ? 'color-mix(in srgb, var(--theme-text-primary) 10%, transparent)' : 'var(--theme-primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
              }}>
                {isLocked ? '🔒' : isCompleted ? '✅' : getTypeIcon(activity.type)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: isLocked ? 'color-mix(in srgb, var(--theme-text-primary) 40%, transparent)' : 'var(--theme-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activity.title}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--theme-secondary)', background: `color-mix(in srgb, var(--theme-primary) ${0.15 * 100}%, transparent)`, padding: '2px 6px', borderRadius: '999px', flexShrink: 0 }}>
                    {activity.type}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--theme-text-secondary)' }}>
                  <span>⭐ {activity.points} XP</span>
                  <span>🕐 {activity.estimatedTime || '5m'}</span>
                </div>
              </div>

              {/* Status */}
              <span style={{
                fontSize: '11px', fontWeight: 700, flexShrink: 0,
                color: isCompleted ? 'var(--theme-success)' : isLocked ? 'color-mix(in srgb, var(--theme-text-primary) 20%, transparent)' : 'var(--theme-secondary)'
              }}>
                {isCompleted ? 'MASTERED' : isLocked ? 'LOCKED' : 'READY'}
              </span>
              <span style={{ color: 'var(--theme-text-secondary)', fontSize: '16px' }}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
