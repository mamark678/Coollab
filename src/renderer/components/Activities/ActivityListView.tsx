import React from 'react';
import { Plus, Edit2, Copy, Trash2, Eye, FileText, Zap, ListChecks, Users, Layout, Clock, Target } from 'lucide-react';
import { Activity } from '../../services/activity';

interface ActivityListViewProps {
  projectId: string;
  activities: Activity[];
  loading: boolean;
  onCreateClick: () => void;
  onEditClick: (activity: Activity) => void;
  onDuplicateClick: (activity: Activity) => void;
  onDeleteClick: (activity: Activity) => void;
  onViewSubmissions: (activity: Activity) => void;
  onCardClick: (activity: Activity) => void;
  selectedActivities?: Set<string>;
  isSelectionMode?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const ActivityListView: React.FC<ActivityListViewProps> = ({ 
  projectId, 
  activities,
  loading,
  onCreateClick, 
  onEditClick,
  onDuplicateClick,
  onDeleteClick,
  onViewSubmissions,
  onCardClick,
  selectedActivities,
  isSelectionMode,
  onToggleSelect
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quiz': return <Zap size={16} style={{ color: 'var(--theme-primary)' }} />;
      case 'reading': return <FileText size={16} style={{ color: 'var(--theme-secondary)' }} />;
      case 'task': return <ListChecks size={16} style={{ color: 'var(--theme-success)' }} />;
      case 'discussion': return <Users size={16} style={{ color: 'var(--theme-text-secondary)' }} />;
      case 'workspace': return <Layout size={16} style={{ color: 'var(--theme-primary)' }} />;
      default: return <FileText size={16} />;
    }
  };

  const getQuestionCount = (activity: Activity) => {
    if (activity.type === 'quiz') return `${activity.quizData?.questions?.length || 0} questions`;
    if (activity.type === 'workspace') return `${Object.values(activity.workspaceData || {}).filter((v:any)=>v.enabled).length} components`;
    return '1 item';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--theme-background)' }}>
        <div style={{ width: '32px', height: '32px', border: '4px  solid var(--theme-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-background)', borderRadius: '20px', overflow: 'hidden' }}>
      {/* Stats Header — gradient background */}
      <div style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-surface) 90%, var(--theme-primary)) 0%, color-mix(in srgb, var(--theme-surface) 95%, var(--theme-secondary)) 100%)',
        padding: '32px 48px 28px',
        borderRadius: '20px',
        margin: '16px 16px 0 16px',
        border: '1px solid var(--theme-border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0 }}>Activities</h1>
          <button onClick={onCreateClick} style={{
            padding: '10px 20px', background: 'var(--theme-primary)', border: 'none',
            borderRadius: '10px', color: 'var(--theme-on-primary)', fontWeight: 700,
            fontSize: '14px', cursor: 'pointer'
          }}>
            + Create Activity
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`,
            border: '1px  solid var(--theme-border)',
            borderRadius: '12px', padding: '20px 24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span>⚡</span>
              <span style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Activities</span>
            </div>
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--theme-text-primary)' }}>{activities.length}</span>
          </div>
          <div style={{
            background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`,
            border: '1px  solid var(--theme-border)',
            borderRadius: '12px', padding: '20px 24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span>✅</span>
              <span style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Published</span>
            </div>
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--theme-text-primary)' }}>
              {activities.filter(a => a.status === 'published').length}/{activities.length}
            </span>
          </div>
        </div>
      </div>

      {/* Activity List — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 48px' }}>
        {activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--theme-text-secondary)' }}>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>No activities yet.</p>
            <button onClick={onCreateClick} style={{
              padding: '10px 20px', background: 'var(--theme-primary)', border: 'none',
              borderRadius: '10px', color: 'var(--theme-on-primary)', fontWeight: 700, cursor: 'pointer'
            }}>Create your first activity</button>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => {
                if (isSelectionMode) {
                  onToggleSelect?.(activity.id);
                } else {
                  onCardClick(activity);
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                background: selectedActivities?.has(activity.id) 
                  ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)' 
                  : 'color-mix(in srgb, var(--theme-text-primary) 3%, transparent)',
                border: `1px solid ${selectedActivities?.has(activity.id) 
                  ? 'color-mix(in srgb, var(--theme-primary) 40%, transparent)' 
                  : 'var(--theme-border)'}`,
                borderRadius: '16px', padding: '20px 24px',
                marginBottom: '12px', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {/* Selection Checkbox */}
              {isSelectionMode && (
                <div
                  onClick={e => { e.stopPropagation(); onToggleSelect?.(activity.id); }}
                  style={{ 
                    width: '20px', height: '20px', borderRadius: '50%', 
                    border: `2px solid ${selectedActivities?.has(activity.id) 
                      ? 'var(--theme-primary)' 
                      : 'color-mix(in srgb, var(--theme-text-primary) 30%, transparent)'}`, 
                    background: selectedActivities?.has(activity.id) ? 'var(--theme-primary)' : 'transparent', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    flexShrink: 0, cursor: 'pointer', marginRight: '4px' 
                  }}>
                  {selectedActivities?.has(activity.id) && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--theme-on-primary)' }} />}
                </div>
              )}

              {/* Status Icon */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                background: activity.status === 'published' 
                  ? 'color-mix(in srgb, var(--theme-success) 15%, transparent)' 
                  : 'color-mix(in srgb, var(--theme-primary) 15%, transparent)',
                border: `2px solid ${activity.status === 'published' ? 'var(--theme-success)' : 'var(--theme-primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px'
              }}>
                {activity.status === 'published' ? '✅' : '⭐'}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--theme-text-primary)', margin: 0 }}>
                    {activity.title}
                  </h3>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '999px',
                    background: `color-mix(in srgb, var(--theme-primary) ${0.15 * 100}%, transparent)`, color: 'var(--theme-secondary)'
                  }}>
                    {activity.type}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', padding: '3px 8px', borderRadius: '999px',
                    background: activity.status === 'published' 
                      ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' 
                      : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)',
                    color: activity.status === 'published' ? 'var(--theme-success)' : 'var(--theme-text-secondary)'
                  }}>
                    {activity.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--theme-text-secondary)', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activity.description || 'No description provided.'}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexDirection: 'row'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🏆 {activity.points || 0} XP
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🕐 {new Date(activity.createdAt?.toMillis ? activity.createdAt.toMillis() : (activity.createdAt || Date.now())).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📝 {getQuestionCount(activity)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              {!isSelectionMode && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => onViewSubmissions(activity)} style={{ padding: '6px 12px', borderRadius: '8px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', color: 'var(--theme-text-secondary)', fontSize: '12px', cursor: 'pointer' }}>👁️ Subs</button>
                  <button onClick={() => onDuplicateClick(activity)} style={{ padding: '6px 12px', borderRadius: '8px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', color: 'var(--theme-text-secondary)', fontSize: '12px', cursor: 'pointer' }}>👁️ Dup</button>
                  <button onClick={() => onEditClick(activity)} style={{ padding: '6px 12px', borderRadius: '8px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`, border: '1px  solid var(--theme-border)', color: 'var(--theme-text-secondary)', fontSize: '12px', cursor: 'pointer' }}>✏️ Edit</button>
                  <button onClick={() => onDeleteClick(activity)} style={{ padding: '6px 12px', borderRadius: '8px', background: 'color-mix(in srgb, var(--theme-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--theme-error) 20%, transparent)', color: 'var(--theme-error)', fontSize: '12px', cursor: 'pointer' }}>🗑️ Delete</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
