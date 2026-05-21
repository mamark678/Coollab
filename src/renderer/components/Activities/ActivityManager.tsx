import React, { useState, useEffect } from 'react';
import { ActivityListView } from './ActivityListView';
import { ActivityDetailView } from './ActivityDetailView';
import { ManualActivityForm } from './ManualActivityForm';
import { Activity } from '../../services/activity';
import { FirebaseService } from '../../services/firebase';
import { deleteDoc, doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

interface ActivityManagerProps {
  projectId: string;
  onClose: () => void;
  onViewSubmissions?: (activity: Activity) => void;
}

export const ActivityManager: React.FC<ActivityManagerProps> = ({ projectId, onClose, onViewSubmissions }) => {
  const { userRole } = useAppStore(useShallow(s => ({ userRole: s.userRole })));
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New selection and modal states
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteModalActivities, setDeleteModalActivities] = useState<Activity[]>([]);
  const [duplicateModalActivity, setDuplicateModalActivity] = useState<Activity | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [devResetUid, setDevResetUid] = useState('');

  const db = FirebaseService.getInstance().db;

  useEffect(() => {
    const activitiesRef = collection(db, `notes/${projectId}/activities`);
    const q = query(activitiesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const acts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(acts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [projectId, db]);

  const handleEdit = (activity: Activity) => {
    setSelectedActivity(activity);
    setView('edit');
  };

  const handleDetail = (activity: Activity) => {
    setSelectedActivity(activity);
    setView('detail');
  };

  const handleDelete = (activity: Activity) => {
    setDeleteModalActivities([activity]);
  };

  const handleDeleteSelected = () => {
    if (selectedActivities.size === 0) return;
    const toDelete = activities.filter(a => selectedActivities.has(a.id));
    setDeleteModalActivities(toDelete);
  };

  const confirmDelete = async () => {
    setIsProcessing(true);
    try {
      for (const activity of deleteModalActivities) {
        const ref = doc(db, 'notes', projectId, 'activities', activity.id);
        await deleteDoc(ref);
      }
      setSelectedActivities(new Set());
      setIsSelectionMode(false);
      setDeleteModalActivities([]);
      if (selectedActivity && deleteModalActivities.some(a => a.id === selectedActivity.id)) {
        setView('list');
        setSelectedActivity(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicate = (activity: Activity) => {
    // Strip ALL existing (Copy) or (Copy N) suffixes at the end of the string
    const baseTitle = activity.title.replace(/(\s\(Copy(\s\d+)?\))+$/, '');
    setDuplicateTitle(`${baseTitle} (Copy)`);
    setDuplicateModalActivity(activity);
  };

  const confirmDuplicate = async () => {
    if (!duplicateModalActivity) return;
    setIsProcessing(true);
    try {
      const { id, ...rest } = duplicateModalActivity;
      const newActivity = {
        ...rest,
        title: duplicateTitle || `${duplicateModalActivity.title} (Copy)`,
        status: 'draft',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await addDoc(collection(db, 'notes', projectId, 'activities'), newActivity);
      setDuplicateModalActivity(null);
      setDuplicateTitle('');
    } catch (err) {
      console.error('Duplicate failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublishToggle = async (activityToToggle?: Activity) => {
    const activity = activityToToggle || selectedActivity;
    if (!activity) return;
    const newStatus = activity.status === 'published' ? 'draft' : 'published';
    await updateDoc(doc(db, 'notes', projectId, 'activities', activity.id), { status: newStatus });
    if (selectedActivity?.id === activity.id) {
      setSelectedActivity({ ...selectedActivity, status: newStatus });
    }
  };

  if (view === 'create' || view === 'edit') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <ManualActivityForm 
          projectId={projectId} 
          existingCount={0} 
          onCancel={() => setView('list')} 
          onSaved={() => setView('list')}
          initialData={view === 'edit' ? selectedActivity : null}
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {view === 'detail' && selectedActivity ? (
        <ActivityDetailView 
          activity={selectedActivity}
          onBack={() => setView('list')}
          onEdit={() => handleEdit(selectedActivity)}
          onDuplicate={() => handleDuplicate(selectedActivity)}
          onDelete={() => handleDelete(selectedActivity)}
          onPublishToggle={() => handlePublishToggle(selectedActivity)}
          onViewSubmissions={() => onViewSubmissions?.(selectedActivity)}
          onWorkspace={() => onClose()}
        />
      ) : (
        <>
          {/* Selection Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 24px' }}>
            {import.meta.env.DEV && userRole === 'instructor' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto', background: 'color-mix(in srgb, var(--theme-secondary) 5%, transparent)', padding: '4px 8px', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--theme-secondary) 15%, transparent)' }}>
                <input 
                  placeholder="Student UID..." 
                  value={devResetUid}
                  onChange={e => setDevResetUid(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--theme-text-primary)', fontSize: '10px', width: '100px', outline: 'none' }}
                />
                <button
                  onClick={async () => {
                    if (!devResetUid) return alert('Enter a Student UID first');
                    if (!confirm(`Reset all activity progress for student ${devResetUid}?`)) return;
                    
                    const { collection, getDocs, deleteDoc } = await import('firebase/firestore');
                    const db = FirebaseService.getInstance().db;
                    const activitiesSnap = await getDocs(collection(db, `notes/${projectId}/activities`));
                    for (const actDoc of activitiesSnap.docs) {
                      const compRef = doc(db, `notes/${projectId}/activities/${actDoc.id}/completions/${devResetUid}`);
                      await deleteDoc(compRef).catch(() => {});
                    }
                    alert('Progress reset successfully!');
                    setDevResetUid('');
                  }}
                  style={{
                    padding: '4px 8px', borderRadius: '6px',
                    border: '1px solid color-mix(in srgb, var(--theme-secondary) 30%, transparent)',
                    background: 'color-mix(in srgb, var(--theme-secondary) 10%, transparent)',
                    color: 'var(--theme-secondary)',
                    fontSize: '10px', cursor: 'pointer'
                  }}
                >
                  🛠 Reset
                </button>
              </div>
            )}
            {isSelectionMode ? (
              <>
                <span style={{ fontSize: '13px', color: 'var(--theme-text-secondary)' }}>{selectedActivities.size} selected</span>
                <button onClick={() => { setSelectedActivities(new Set()); setIsSelectionMode(false); }}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px  solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => setSelectedActivities(new Set(activities.map(a => a.id)))}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px  solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                  Select All
                </button>
                {selectedActivities.size > 0 && (
                  <button onClick={handleDeleteSelected}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: 'color-mix(in srgb, var(--theme-error) 15%, transparent)', color: 'var(--theme-error)', fontSize: '12px', cursor: 'pointer' }}>
                    Delete ({selectedActivities.size})
                  </button>
                )}
              </>
            ) : (
              <button onClick={() => setIsSelectionMode(true)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '1px  solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                Select
              </button>
            )}
          </div>

          <ActivityListView 
            projectId={projectId}
            activities={activities}
            loading={loading}
            onCreateClick={() => { setSelectedActivity(null); setView('create'); }}
            onEditClick={handleEdit}
            onDuplicateClick={handleDuplicate}
            onDeleteClick={handleDelete}
            onViewSubmissions={(act) => onViewSubmissions?.(act)}
            onCardClick={handleDetail}
            selectedActivities={selectedActivities}
            isSelectionMode={isSelectionMode}
            onToggleSelect={(id) => setSelectedActivities(prev => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            })}
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalActivities.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: `color-mix(in srgb, var(--theme-background) ${0.6 * 100}%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => !isProcessing && setDeleteModalActivities([])}>
          <div style={{ background: 'var(--theme-surface)', border: '1px  solid var(--theme-border)', borderRadius: '16px', padding: '24px', width: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
              Delete {deleteModalActivities.length === 1 ? `"${deleteModalActivities[0].title}"` : `${deleteModalActivities.length} Activities`}?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--theme-text-secondary)', lineHeight: 1.5 }}>
              This will permanently delete {deleteModalActivities.length === 1 ? 'this activity' : 'these activities'} and all student submissions. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteModalActivities([])} disabled={isProcessing}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px  solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={isProcessing}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: isProcessing ? 'color-mix(in srgb, var(--theme-error) 40%, transparent)' : 'var(--theme-error)', color: 'var(--theme-on-primary)', fontSize: '13px', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {duplicateModalActivity && (
        <div style={{ position: 'fixed', inset: 0, background: `color-mix(in srgb, var(--theme-background) ${0.6 * 100}%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => !isProcessing && setDuplicateModalActivity(null)}>
          <div style={{ background: 'var(--theme-surface)', border: '1px  solid var(--theme-border)', borderRadius: '16px', padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>Duplicate Activity</div>
            <div style={{ fontSize: '13px', color: 'var(--theme-text-secondary)' }}>Give the duplicate a new name or keep the default.</div>
            <input
              value={duplicateTitle}
              onChange={e => setDuplicateTitle(e.target.value)}
              placeholder="Activity title..."
              autoFocus
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px  solid var(--theme-border)', background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`, color: 'var(--theme-text-primary)', fontSize: '14px', outline: 'none' }}
              onKeyDown={e => e.key === 'Enter' && confirmDuplicate()}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDuplicateModalActivity(null)} disabled={isProcessing}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px  solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDuplicate} disabled={isProcessing}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: isProcessing ? 'color-mix(in srgb, var(--theme-primary) 40%, transparent)' : 'var(--theme-primary)', color: 'var(--theme-on-primary)', fontSize: '13px', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                {isProcessing ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
