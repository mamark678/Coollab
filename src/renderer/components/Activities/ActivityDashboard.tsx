import React, { useState, useEffect, useCallback } from 'react';
import { X, Trophy, Users, LayoutList, CheckCircle2, Timer, Lock, GripVertical, Save, Star, Eye, Trash2, Loader2, Clock, PenTool } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { ActivityService, Activity, ActivityCompletion } from '../../services/activity';
import { useAuth } from '../../hooks/useAuth';
import { ShareService } from '../../services/share';
import { FirebaseService } from '../../services/firebase';
import { collection, onSnapshot, orderBy, query, doc, setDoc, deleteDoc, writeBatch, getDocs, collectionGroup, where } from 'firebase/firestore';
import { ManualActivityForm } from './ManualActivityForm';
import './Activities.css';

interface ActivityDashboardProps {
  projectId: string;
  onClose: () => void;
  onViewStudent?: (studentId: string) => void;
  onKickStudent?: (studentId: string, studentName: string) => void;
  viewingStudentId?: string | null;
}

export const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ projectId, onClose, onViewStudent, onKickStudent, viewingStudentId }) => {
  const { state: { user } } = useAuth();
  const [tab, setTab] = useState<'progress' | 'builder'>('progress');
  const [role, setRole] = useState<'admin' | 'student'>('student');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ activities: Activity[], studentData: any[] } | null>(null);
  const [orderedActivities, setOrderedActivities] = useState<Activity[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !projectId) return;
    try {
      const permission = await ShareService.getInstance().getUserPermission(projectId, user.uid);
      const isAdmin = permission === 'owner' || permission === 'admin';
      setRole(isAdmin ? 'admin' : 'student');

      if (isAdmin) {
        const dashboardData = await ActivityService.getInstance().getAdminDashboardData(projectId);
        setData(dashboardData);
        setOrderedActivities(dashboardData.activities);
      }
    } catch (err) {
      console.error('[ActivityDashboard] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    loadData();

    const db = FirebaseService.getInstance().db;
    const activitiesRef = collection(db, 'notes', projectId, 'activities');
    const q = query(activitiesRef, orderBy('sequenceNumber', 'asc'));
    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Activity[];
      setOrderedActivities(activities);
    });

    const handleActivityListUpdated = (e: any) => {
      if (e.detail?.projectId === projectId) {
        loadData();
      }
    };

    // ── Real-time Completions Listener ────────────────────────────────────
    const completionsQ = query(
      collectionGroup(db, 'completions'),
      where('projectId', '==', projectId)
    );

    const unsubscribeCompletions = onSnapshot(completionsQ, (snapshot) => {
      setData(prev => {
        if (!prev) return prev;
        const newStudentData = [...prev.studentData];
        
        snapshot.docChanges().forEach((change) => {
          const compData = change.doc.data() as ActivityCompletion & { userId: string, activityId: string };
          const studentIdx = newStudentData.findIndex(s => s.userId === compData.userId);
          
          if (studentIdx !== -1) {
            const student = { ...newStudentData[studentIdx] };
            student.completions = { ...student.completions, [compData.activityId]: compData };
            newStudentData[studentIdx] = student;
          }
        });

        return { ...prev, studentData: newStudentData };
      });
    });

    window.addEventListener('activity-list-updated', handleActivityListUpdated);
    return () => {
      unsubscribeSnapshot();
      unsubscribeCompletions();
      window.removeEventListener('activity-list-updated', handleActivityListUpdated);
    };
  }, [loadData, projectId]);

  const handleReorder = async (newOrder: Activity[]) => {
    setOrderedActivities(newOrder);
    try {
      setSaving(true);
      await ActivityService.getInstance().reorderActivities(projectId, newOrder.map(a => a.id));
    } catch (err) {
      console.error('[ActivityDashboard] Failed to reorder:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleManualScore = async (userId: string, activityId: string, points: number) => {
    try {
      await ActivityService.getInstance().manualScoreOverride(projectId, activityId, userId, points);
      await loadData();
      showToast("Score updated successfully", "success");
    } catch (err) {
      console.error('[ActivityDashboard] Failed to update score:', err);
      showToast("Failed to update score", "error");
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!window.confirm("Are you sure you want to delete this activity? This cannot be undone.")) return;

    try {
      setSaving(true);
      const db = FirebaseService.getInstance().db;
      
      const completionsRef = collection(db, `notes/${projectId}/activities/${activityId}/completions`);
      const compSnap = await getDocs(completionsRef);
      const batch = writeBatch(db);
      compSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      const activityRef = doc(db, `notes/${projectId}/activities/${activityId}`);
      await deleteDoc(activityRef);

      const remaining = orderedActivities.filter(a => a.id !== activityId);
      const reorderBatch = writeBatch(db);
      remaining.forEach((act, idx) => {
        const ref = doc(db, `notes/${projectId}/activities`, act.id);
        reorderBatch.update(ref, { sequenceNumber: idx + 1 });
      });
      await reorderBatch.commit();

      showToast("Activity deleted successfully", "success");
      // Global fix for focus bug on Windows: force reload after delete
      window.location.reload();
    } catch (err: any) {
      console.error('[ActivityDashboard] Delete failed:', err);
      showToast(`Delete failed: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="activity-panel">
      <div className="activity-loading">
        <div className="activity-loading__spinner" />
      </div>
    </div>
  );

  if (role !== 'admin') {
    return (
      <div className="activity-panel">
        <div className="activity-panel__header">
          <div className="activity-panel__header-left">
            <Trophy size={18} color="#f59e0b" />
            <span className="activity-panel__title">My Progress</span>
          </div>
          <button className="activity-panel__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, textAlign: 'center', color: '#a0a4b8' }}>
          Personal progress tracking is coming soon.
        </div>
      </div>
    );
  }

  return (
    <div className="activity-panel" style={{ position: 'relative' }}>
      <div className="activity-panel__header">
        <div className="activity-panel__header-left">
          <Trophy size={18} color="#f59e0b" />
          <span className="activity-panel__title">Activity Dashboard</span>
        </div>
        <button className="activity-panel__close" onClick={onClose}><X size={16} /></button>
      </div>

      {toast && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#6dd49e' : '#e66b7a',
          color: '#000', padding: '8px 16px', borderRadius: '8px',
          zIndex: 100, fontSize: '12px', fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          {toast.message}
        </div>
      )}

      <div className="activity-tabs">
        <button 
          className={`activity-tabs__btn ${tab === 'progress' ? 'activity-tabs__btn--active' : ''}`}
          onClick={() => setTab('progress')}
        >
          <Users size={14} /> Student Progress
        </button>
        <button 
          className={`activity-tabs__btn ${tab === 'builder' ? 'activity-tabs__btn--active' : ''}`}
          onClick={() => setTab('builder')}
        >
          <LayoutList size={14} /> Activity Builder
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'progress' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {data?.studentData.map(student => {
              const totalActivities = data.activities.length;
              const completedOrTimedOutCount = Object.values(student.completions).filter((c: any) => c.status === 'completed' || c.status === 'timed_out').length;
              const percentage = totalActivities > 0 ? Math.round((completedOrTimedOutCount / totalActivities) * 100) : 0;
              const totalPoints = Object.values(student.completions).reduce((sum: number, c: any) => sum + (c.pointsEarned || 0), 0);

              return (
                <div key={student.userId} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    {student.avatar ? (
                      <img src={student.avatar} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7c6bf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                        {student.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{student.name}</div>
                      <div style={{ fontSize: 12, color: '#9485f5' }}>{totalPoints} Total Points</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{percentage}%</div>
                      <div style={{ fontSize: 11, color: '#a0a4b8' }}>Completion</div>
                    </div>
                  </div>

                  {onViewStudent && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button 
                        className={`btn ${viewingStudentId === student.userId ? 'btn--primary' : 'btn--secondary'} btn--small`}
                        onClick={() => onViewStudent(viewingStudentId === student.userId ? '' : student.userId)}
                        style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Eye size={14} />
                        {viewingStudentId === student.userId ? 'Viewing Workspace' : 'View Student Workspace'}
                      </button>
                      
                      {onKickStudent && (
                        <button 
                          className="btn btn--secondary btn--small"
                          onClick={() => onKickStudent(student.userId, student.name)}
                          style={{ flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={14} />
                          Kick
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.activities.map(activity => {
                      const comp = student.completions[activity.id] as ActivityCompletion;
                      let statusIcon = <Lock size={12} color="#4b5563" />;
                      let statusText = 'Not reached';
                      let statusColor = '#4b5563';

                      if (comp) {
                        if (comp.status === 'completed') {
                          statusIcon = <CheckCircle2 size={12} color="#6dd49e" />;
                          statusText = `Completed (${comp.timeTaken || 0}s) • ${comp.pointsEarned} pts`;
                          statusColor = '#6dd49e';
                        } else if (comp.status === 'timed_out') {
                          statusIcon = <Clock size={12} color="#e6c96e" />;
                          statusText = 'Timed Out';
                          statusColor = '#e6c96e';
                        } else if (comp.status === 'in_progress') {
                          statusIcon = <Loader2 size={12} color="#7c6bf0" style={{ animation: 'spin 2s linear infinite' }} />;
                          statusText = 'In Progress';
                          statusColor = '#7c6bf0';
                        }
                      }

                      return (
                        <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ width: 14, display: 'flex', justifyContent: 'center' }}>{statusIcon}</div>
                          <div style={{ flex: 1, fontSize: 12, color: '#e8eaf0' }}>
                            {(activity as any).title || (activity as any).name || (activity as any).activityTitle || 'Untitled Activity'}
                          </div>
                          <div style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{statusText}</div>
                          
                          {comp?.status === 'timed_out' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input 
                                type="number"
                                placeholder="Pts"
                                defaultValue={comp.manualPointsOverride !== null ? comp.manualPointsOverride : undefined}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val)) handleManualScore(student.userId, activity.id, val);
                                }}
                                style={{ width: 40, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, padding: '2px 4px', borderRadius: 4, textAlign: 'center' }}
                              />
                              <span style={{ fontSize: 9, color: '#6b6f82' }}>pts</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {editingActivity ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Edit Activity</div>
                  <button 
                    onClick={() => setEditingActivity(null)}
                    style={{ background: 'transparent', border: 'none', color: '#6b6f82', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <ManualActivityForm 
                  projectId={projectId}
                  existingCount={orderedActivities.length}
                  initialData={editingActivity}
                  onCancel={() => setEditingActivity(null)}
                  onSaved={() => {
                    setEditingActivity(null);
                    loadData();
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#a0a4b8', marginBottom: 8 }}>
                  Drag to reorder activities. Students will complete them in this sequence.
                </div>
                <Reorder.Group axis="y" values={orderedActivities} onReorder={handleReorder} style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
                  {orderedActivities.map((activity, index) => (
                    <Reorder.Item key={activity.id} value={activity}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'grab' }}>
                        <GripVertical size={14} color="#4b5563" />
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(124,107,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#7c6bf0' }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {(activity as any).title || (activity as any).name || (activity as any).activityTitle || 'Untitled Activity'}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b6f82' }}>{activity.points} pts</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingActivity(activity);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#6b6f82',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#7c6bf0'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#6b6f82'}
                            title="Edit Activity"
                          >
                            <PenTool size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteActivity(activity.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#6b6f82',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#e66b7a'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#6b6f82'}
                            title="Delete Activity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
                {saving && (
                  <div style={{ fontSize: 11, color: '#9485f5', textAlign: 'center', marginTop: 8 }}>
                    Saving sequence...
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
