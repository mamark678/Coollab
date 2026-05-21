import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, 
  Trophy, 
  Users, 
  LayoutList, 
  CheckCircle2, 
  Star, 
  Eye, 
  Trash2, 
  Clock, 
  PenTool, 
  GripVertical,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Target
} from 'lucide-react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { ActivityService, Activity, ActivityCompletion } from '../../services/activity';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebase';
import { 
  collection, 
  onSnapshot, 
  orderBy, 
  query, 
  doc, 
  deleteDoc, 
  writeBatch, 
  getDocs, 
  collectionGroup, 
  where,
  setDoc
} from 'firebase/firestore';
import { ManualActivityForm } from './ManualActivityForm';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { DuolingoQuiz } from './DuolingoQuiz';
import { GizmoInteractive } from './GizmoInteractive';
import { ActivityCurriculum } from './ActivityCurriculum';
import { FlashcardPanel } from '../Flashcards/FlashcardPanel';
import { WorkspacePlayer } from './WorkspacePlayer';
import { StudentWorkspaceViewer } from './StudentWorkspaceViewer';

interface ActivityDashboardProps {
  projectId: string;
  onClose: () => void;
  onViewStudent?: (studentId: string) => void;
  onKickStudent?: (studentId: string, studentName: string) => void;
  viewingStudentId?: string | null;
  initialSubmissionsActivity?: Activity | null;
}

import { ReadingPlayer } from './ReadingPlayer';

export const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ 
  projectId, 
  onClose, 
  onViewStudent, 
  onKickStudent, 
  viewingStudentId,
  initialSubmissionsActivity
}) => {
  const { state: { user } } = useAuth();
  const { userRole } = useAppStore(useShallow(s => ({ userRole: s.userRole })));
  
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'builder' | 'curriculum'>('curriculum');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ activities: Activity[], studentData: any[] } | null>(null);
  const [orderedActivities, setOrderedActivities] = useState<Activity[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedActivity, setCompletedActivity] = useState<Activity | null>(null);

  const isInstructor = userRole === 'instructor';

  const loadData = useCallback(async () => {
    if (!user || !projectId) return;
    try {
      const dashboardData = await ActivityService.getInstance().getAdminDashboardData(projectId);
      setData(dashboardData);
      setOrderedActivities(dashboardData.activities);
    } catch (err) {
      console.error('[ActivityDashboard] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    if (!projectId) return;
    loadData();

    const db = FirebaseService.getInstance().db;
    const activitiesRef = collection(db, 'notes', projectId, 'activities');
    const q = query(activitiesRef, orderBy('sequenceNumber', 'asc'));
    
    let unsubscribeSnapshot: (() => void) | null = null;
    try {
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const activities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Activity[];
        setOrderedActivities(activities);
      }, (error) => {
        console.error('[ActivityDashboard] Activities listener error:', error);
      });
    } catch (err) {
      console.error('[ActivityDashboard] Failed to set up activities listener:', err);
    }

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [loadData, projectId]);

  // Real-time listener for completions (avoids collectionGroup index requirement)
  useEffect(() => {
    if (!projectId || !orderedActivities.length) return;
    const db = FirebaseService.getInstance().db;
    const unsubscribes: (() => void)[] = [];

    orderedActivities.forEach(activity => {
      const compRef = collection(db, `notes/${projectId}/activities/${activity.id}/completions`);
      const unsub = onSnapshot(compRef, (snapshot) => {
        setData(prev => {
          if (!prev) return prev;
          const newStudentData = [...prev.studentData];
          let changed = false;
          
          snapshot.docChanges().forEach((change) => {
            const compData = change.doc.data() as ActivityCompletion;
            const userId = compData.userId || change.doc.id; // Fallback to doc ID just in case
            
            const studentIdx = newStudentData.findIndex(s => s.userId === userId);
            if (studentIdx !== -1) {
              changed = true;
              const student = { ...newStudentData[studentIdx] };
              student.completions = { ...student.completions, [activity.id]: compData };
              newStudentData[studentIdx] = student;
            }
          });
          
          return changed ? { ...prev, studentData: newStudentData } : prev;
        });
      }, (error) => {
        console.warn(`[ActivityDashboard] Completions listener error for activity ${activity.id}:`, error.message);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [projectId, orderedActivities]);

  const leaderboardData = useMemo(() => {
    if (!data) return [];
    return data.studentData
      .map(student => {
        const totalPoints = Object.values(student.completions).reduce((sum: number, c: any) => sum + (c.pointsEarned || 0), 0);
        const completedCount = Object.values(student.completions).filter((c: any) => c.status === 'completed').length;
        return { ...student, totalPoints, completedCount };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [data]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleResetProgress = async () => {
    if (!user || !projectId || !orderedActivities.length) return;
    if (!confirm('DEBUG: Reset your progress for all activities in this project?')) return;
    
    setLoading(true);
    try {
      const db = FirebaseService.getInstance().db;
      const batch = writeBatch(db);
      for (const activity of orderedActivities) {
        const compRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${user.uid}`);
        batch.delete(compRef);
      }
      await batch.commit();
      window.dispatchEvent(new Event('activity-progress-reset'));
      showToast('Progress reset successfully');
      loadData();
    } catch (err) {
      console.error('Reset failed:', err);
      showToast('Reset failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<{ studentId: string, activity: Activity } | null>(null);
  const [showSubmissionsList, setShowSubmissionsList] = useState<Activity | null>(initialSubmissionsActivity || null);

  useEffect(() => {
    if (initialSubmissionsActivity) {
      setShowSubmissionsList(initialSubmissionsActivity);
    }
  }, [initialSubmissionsActivity]);

  const handleSelectActivity = (activity: Activity) => {
    if (activity.type === 'base') {
      onClose();
    } else if (isInstructor) {
      // For instructors, show the submissions list / activity overview
      setShowSubmissionsList(activity);
    } else {
      setSelectedActivity(activity);
      setShowStartModal(true);
    }
  };

  const startActivity = (activity: Activity) => {
    setActiveActivity(activity);
  };

  const handleActivityComplete = async (score: number) => {
    if (!activeActivity || !user) return;
    try {
      const db = FirebaseService.getInstance().db;
      const compRef = doc(db, `notes/${projectId}/activities/${activeActivity.id}/completions/${user.uid}`);
      await setDoc(compRef, {
        userId: user.uid,
        projectId,
        activityId: activeActivity.id,
        status: 'completed',
        pointsEarned: score,
        completedAt: Date.now()
      }, { merge: true });
      setCompletedActivity(activeActivity);
      setShowCompletionModal(true);
      setActiveActivity(null);
      loadData();
    } catch (err) {
      showToast('Failed to save progress', 'error');
    }
  };

  if (loading) return (
    <div className="flex flex-col h-full bg-[var(--theme-background)] items-center justify-center">
      <div className="w-10 h-10 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" style={{ boxShadow: '0 0 20px color-mix(in srgb, var(--theme-primary) 30%, transparent)' }} />
    </div>
  );

  const tabs = [
    { id: 'leaderboard', label: 'Leaderboard', icon: Award },
    { id: 'curriculum', label: 'Curriculum', icon: LayoutList },
    ...(isInstructor ? [
      { id: 'progress', label: 'Students', icon: Users }
    ] : [])
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--theme-background)] text-[var(--theme-text-primary)] overflow-hidden relative border-l border-[var(--theme-border)]">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] blur-[100px] pointer-events-none" />

      {/* Overlays */}
      <AnimatePresence>
        {activeActivity?.type === 'quiz' && (
          <DuolingoQuiz activity={activeActivity} onComplete={handleActivityComplete} onClose={() => setActiveActivity(null)} />
        )}
        {activeActivity?.type === 'gizmo' && (
          <GizmoInteractive activity={activeActivity} onComplete={handleActivityComplete} onClose={() => setActiveActivity(null)} />
        )}
        {activeActivity?.type === 'reading' && (
          <ReadingPlayer activity={activeActivity} onComplete={handleActivityComplete} onClose={() => setActiveActivity(null)} />
        )}
        {activeActivity?.type === 'flashcard' && (
          <div className="fixed inset-0 z-[10000] bg-[var(--theme-background)]">
            <FlashcardPanel documentContent={activeActivity.description} documentTitle={activeActivity.title} onClose={() => setActiveActivity(null)} />
          </div>
        )}
        {activeActivity?.type === 'workspace' && (
          <WorkspacePlayer 
            activity={activeActivity} 
            studentId={user?.uid || ''} 
            studentName={user?.displayName || 'Student'} 
            projectId={projectId} 
            onClose={() => setActiveActivity(null)} 
          />
        )}


        {viewingSubmission && (
          <StudentWorkspaceViewer 
            activity={viewingSubmission.activity}
            studentId={viewingSubmission.studentId}
            projectId={projectId}
            onClose={() => setViewingSubmission(null)}
          />
        )}

        {showSubmissionsList && (
          <div className="fixed inset-0 z-[4000] bg-[color-mix(in_srgb,var(--theme-background)_80%,transparent)] backdrop-blur-md flex items-center justify-end">
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="w-[500px] h-full bg-[var(--theme-surface)] border-l border-[var(--theme-border)] p-10 flex flex-col gap-8 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">{showSubmissionsList.title}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-primary)]">Student Submissions</p>
                </div>
                <button onClick={() => setShowSubmissionsList(null)} className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] text-[var(--theme-text-primary)]"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {data?.studentData.map(student => {
                  const comp = student.completions[showSubmissionsList.id];
                  const hasSubmitted = comp?.status === 'completed' || comp?.status === 'graded';
                  return (
                    <div key={student.userId} className={`p-5 rounded-2xl border transition-all ${hasSubmitted ? 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border-[var(--theme-border)]' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] opacity-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] flex items-center justify-center font-bold text-xs text-[var(--theme-text-primary)]">
                            {student.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[var(--theme-text-primary)]">{student.name}</h4>
                            <p className="text-[10px] text-[var(--theme-text-secondary)] opacity-50 uppercase font-black">{comp?.status || 'No attempt'}</p>
                          </div>
                        </div>
                        {hasSubmitted && (
                          <button 
                            onClick={() => {
                              setViewingSubmission({ studentId: student.userId, activity: showSubmissionsList });
                              setShowSubmissionsList(null);
                            }}
                            className="px-4 py-2 bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] text-[var(--theme-primary)] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[var(--theme-primary)] hover:text-[var(--theme-on-primary)] transition-all"
                          >
                            View Work
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="p-8 pb-6 flex items-center justify-between">
        {import.meta.env.DEV && (
          <button 
            onClick={handleResetProgress}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white transition-all z-50"
          >
            Reset My Progress (Dev)
          </button>
        )}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] rounded-2xl flex items-center justify-center text-[var(--theme-primary)] shadow-inner shadow-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)]">
            <Trophy size={24} className="fill-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Project Arena</h2>
            <p className="text-[var(--theme-text-secondary)] opacity-40 text-[11px] font-black uppercase tracking-widest">Mastery & Rankings</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-all hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)]">
          <X size={20} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{ padding: '0 24px 20px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--theme-border)' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--theme-primary)' : '2px solid transparent',
                color: tab === t.id ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
                opacity: tab === t.id ? 1 : 0.4,
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: '-1px'
              }}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8">
        <AnimatePresence mode="wait">
          {tab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              {leaderboardData.length === 0 ? (
                <div className="py-24 flex flex-col items-center text-center opacity-20">
                  <Trophy size={64} className="mb-4 text-[var(--theme-text-primary)]" />
                  <p className="font-bold text-[var(--theme-text-primary)]">Waiting for challengers...</p>
                </div>
              ) : (
                leaderboardData.map((student, index) => (
                  <motion.div
                    key={student.userId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: student.userId === user?.uid ? 'color-mix(in srgb, var(--theme-primary) 8%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 2%, transparent)',
                      border: `1px solid ${student.userId === user?.uid ? 'color-mix(in srgb, var(--theme-primary) 25%, transparent)' : 'var(--theme-border)'}`,
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: '12px',
                      background: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)',
                      color: index < 3 ? '#000' : 'var(--theme-text-secondary)',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] ring-2 ring-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)]">
                      {student.avatar ? (
                        <img src={student.avatar} className="w-full h-full object-cover" alt={student.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--theme-text-secondary)] opacity-30 font-black">{student.name.substring(0, 2).toUpperCase()}</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[var(--theme-text-primary)] font-bold text-[15px] truncate">{student.name}</h3>
                        {student.userId === user?.uid && <span className="text-[9px] font-black uppercase tracking-widest text-[var(--theme-primary)]">You</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--theme-text-secondary)] opacity-50">
                           <CheckCircle2 size={12} className="text-emerald-400" />
                          {student.completedCount} / {data?.activities.length} Complete
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-[var(--theme-text-primary)] flex items-center justify-end gap-1.5">
                        <Star size={16} style={{ color: 'color-mix(in srgb, #e6c96e 60%, var(--theme-text-primary))' }} className="fill-current opacity-80" />
                        {student.totalPoints}
                      </div>
                      <span className="text-[9px] text-[var(--theme-text-secondary)] opacity-30 font-black uppercase tracking-widest">Mastery XP</span>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {tab === 'progress' && isInstructor && (
            <motion.div key="progress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {data?.studentData.map(student => {
                const total = data.activities.length;
                const completed = Object.values(student.completions).filter((c: any) => c.status === 'completed' || c.status === 'timed_out').length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div key={student.userId} className="p-6 rounded-[32px] bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] transition-all">
                    <div className="flex items-center gap-5 mb-6">
                      <div className="w-14 h-14 rounded-[20px] overflow-hidden bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] ring-4 ring-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)]">
                        {student.avatar ? (
                          <img src={student.avatar} className="w-full h-full object-cover" alt={student.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--theme-text-secondary)] opacity-30 font-black text-lg">{student.name.substring(0, 2).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[17px] font-black text-[var(--theme-text-primary)]">{student.name}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-[var(--theme-primary)] uppercase tracking-widest">
                            <TrendingUp size={12} /> {percent}% Mastered
                          </div>
                          <div className="flex items-center gap-1.5 uppercase tracking-widest text-[11px] font-black" style={{ color: 'color-mix(in srgb, #e6c96e 60%, var(--theme-text-primary))' }}>
                            <Star size={12} /> {Object.values(student.completions).reduce((s: number, c: any) => s + (c.pointsEarned || 0), 0)} XP
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => onViewStudent?.(viewingStudentId === student.userId ? '' : student.userId)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                          viewingStudentId === student.userId ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-xl shadow-[var(--theme-primary)]/20' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[var(--theme-text-secondary)] opacity-60 hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] hover:text-[var(--theme-text-primary)]'
                        }`}
                      >
                        <Eye size={20} />
                      </button>
                    </div>
                    <div className="relative h-2 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]" />
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {tab === 'curriculum' && (
            <motion.div key="curriculum" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ActivityCurriculum 
                projectId={projectId} 
                userRole={userRole as any} 
                onSelectActivity={handleSelectActivity}
                studentCompletionStats={data?.activities.reduce((acc, act) => {
                  acc[act.id] = data.studentData.filter(s => s.completions[act.id]?.status === 'completed').length;
                  return acc;
                }, {} as Record<string, number>) || {}}
                totalStudents={data?.studentData.length || 0}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 40, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 40, x: '-50%' }}
            className="fixed bottom-12 left-1/2 px-8 py-4 rounded-[20px] font-black text-sm shadow-2xl z-[100]"
            style={{
              backgroundColor: toast.type === 'success' ? 'var(--theme-success)' : 'var(--theme-error)',
              color: 'var(--theme-background)',
              boxShadow: `0 10px 30px color-mix(in srgb, ${toast.type === 'success' ? 'var(--theme-success)' : 'var(--theme-error)'} 25%, transparent)`
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Activity Modal */}
      {showStartModal && selectedActivity && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 6000,
          background: `color-mix(in srgb, var(--theme-background) ${0.7 * 100}%, transparent)`, backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--theme-background)',
            border: '1px  solid var(--theme-border)',
            borderRadius: '24px',
            padding: '40px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
            position: 'relative'
          }}>
            {/* X button to exit */}
            <button
              onClick={() => setShowStartModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                width: '32px', height: '32px', borderRadius: '8px',
                background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)`, border: 'none',
                color: 'var(--theme-text-secondary)', fontSize: '18px',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              ✕
            </button>

            {/* Icon */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: `color-mix(in srgb, var(--theme-primary) ${0.15 * 100}%, transparent)`,
              border: '2px  solid var(--theme-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '28px'
            }}>
              ⚡
            </div>

            {/* Title */}
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--theme-text-primary)', marginBottom: '8px' }}>
              {selectedActivity.title}
            </h2>

            {/* Type badge */}
            <span style={{
              fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'var(--theme-secondary)',
              background: `color-mix(in srgb, var(--theme-primary) ${0.15 * 100}%, transparent)`, padding: '4px 12px',
              borderRadius: '999px', display: 'inline-block', marginBottom: '24px'
            }}>
              {selectedActivity.type}
            </span>

            {/* Stats row */}
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '32px',
              padding: '20px 0', borderTop: '1px  solid var(--theme-border)',
              borderBottom: '1px  solid var(--theme-border)', marginBottom: '28px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--theme-text-secondary)', marginBottom: '4px' }}>TIME LIMIT</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                  {selectedActivity.timer_config?.duration_seconds ? `${Math.floor(selectedActivity.timer_config.duration_seconds / 60)}m` : 'No limit'}
                </div>
              </div>
              <div style={{ width: '1px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)` }} />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--theme-text-secondary)', marginBottom: '4px' }}>MASTERY POINTS</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                  {selectedActivity.points || 10} XP
                </div>
              </div>
            </div>

            {/* Begin button */}
            <button
              onClick={() => {
                setShowStartModal(false);
                if (['task', 'discussion', 'workspace'].includes(selectedActivity.type)) {
                  // Fire ActivityFlowService to start timer
                  window.dispatchEvent(new Event('start-current-activity'));
                  // Close dashboard so user is back in workspace with the floating widget
                  onClose();
                } else {
                  startActivity(selectedActivity);
                  // Fire ActivityFlowService to start timer
                  window.dispatchEvent(new Event('start-current-activity'));
                }
              }}
              style={{
                width: '100%', padding: '16px',
                background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                border: 'none', borderRadius: '14px',
                color: 'var(--theme-on-primary)', fontSize: '16px', fontWeight: 700,
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--theme-primary) 30%, transparent)'
              }}
            >
              Begin Sequence →
            </button>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 11000,
          background: `color-mix(in srgb, var(--theme-background) ${0.8 * 100}%, transparent)`, backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--theme-background)',
            border: '1px  solid var(--theme-border)',
            borderRadius: '24px', padding: '48px 40px',
            maxWidth: '420px', width: '90%', textAlign: 'center'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--theme-text-primary)', marginBottom: '8px' }}>
              You're Done!
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--theme-text-secondary)', marginBottom: '24px' }}>
              Great job! You've completed this activity.
            </p>
            {/* XP earned */}
            <div style={{
              background: `color-mix(in srgb, var(--theme-primary) ${0.1 * 100}%, transparent)`, border: '1px solid color-mix(in srgb, var(--theme-primary) 30%, transparent)',
              borderRadius: '14px', padding: '16px', marginBottom: '28px'
            }}>
              <div style={{ fontSize: '13px', color: 'var(--theme-text-secondary)', marginBottom: '4px' }}>XP EARNED</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--theme-secondary)' }}>
                +{completedActivity?.points || 10} ⭐
              </div>
            </div>
            {/* Back to activities button */}
            <button
              onClick={() => {
                setShowCompletionModal(false);
                setActiveActivity(null); // redundancy check
              }}
              style={{
                width: '100%', padding: '14px',
                background: 'var(--theme-primary)', border: 'none',
                borderRadius: '12px', color: 'var(--theme-text-primary)',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Back to Activities
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
