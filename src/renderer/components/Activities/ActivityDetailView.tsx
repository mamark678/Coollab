import React from 'react';
import { 
  ArrowLeft, Edit2, Copy, Trash2, Eye, Layout, FileText, Zap, 
  ListChecks, Users, Clock, Target, CheckCircle2, ChevronRight,
  MoreVertical, Globe, Lock
} from 'lucide-react';
import { Activity } from '../../services/activity';

interface ActivityDetailViewProps {
  activity: Activity;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPublishToggle: () => void;
  onViewSubmissions: () => void;
  onWorkspace?: () => void;
}

export const ActivityDetailView: React.FC<ActivityDetailViewProps> = ({
  activity, onBack, onEdit, onDuplicate, onDelete, onPublishToggle, onViewSubmissions, onWorkspace
}) => {
  const getTypeIcon = (type: string, size = 20) => {
    switch (type) {
      case 'quiz': return <Zap size={size} style={{ color: 'var(--theme-primary)' }} />;
      case 'reading': return <FileText size={size} style={{ color: 'var(--theme-secondary)' }} />;
      case 'task': return <ListChecks size={size} style={{ color: 'var(--theme-success)' }} />;
      case 'discussion': return <Users size={size} style={{ color: 'var(--theme-text-secondary)' }} />;
      case 'workspace': return <Layout size={size} style={{ color: 'var(--theme-primary)' }} />;
      default: return <FileText size={size} />;
    }
  };

  const getQuestionCount = () => {
    if (activity.type === 'quiz') return `${activity.quizData?.questions?.length || 0} Questions`;
    if (activity.type === 'workspace') {
      const componentCount = Object.values(activity.workspaceData || {}).filter((v: any) => v.enabled).length;
      return `${componentCount} Components`;
    }
    return '1 Item';
  };

  const isPublished = activity.status === 'published';

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      background: 'var(--theme-background)',
      color: 'var(--theme-text-primary)',
      padding: '24px 32px',
      overflowY: 'auto' as const,
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: 'transparent',
      border: 'none',
      color: 'var(--theme-text-secondary)',
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
      padding: '0',
      marginBottom: '20px',
      transition: 'color 0.2s',
    },
    headerCard: {
      background: `color-mix(in srgb, var(--theme-text-primary) ${0.02 * 100}%, transparent)`,
      border: '1px  solid var(--theme-border)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '16px',
    },
    topRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '20px',
    },
    titleSection: {
      display: 'flex',
      gap: '16px',
      alignItems: 'flex-start',
    },
    iconBox: {
      width: '56px',
      height: '56px',
      borderRadius: '14px',
      background: `color-mix(in srgb, var(--theme-text-primary) ${0.04 * 100}%, transparent)`,
      border: '1px  solid var(--theme-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    statusBadge: {
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginBottom: '8px',
      background: isPublished ? 'color-mix(in srgb, var(--theme-success) 10%, transparent)' : 'color-mix(in srgb, var(--theme-text-primary) 5%, transparent)',
      color: isPublished ? 'var(--theme-success)' : 'color-mix(in srgb, var(--theme-text-primary) 40%, transparent)',
    },
    activityTitle: {
      fontSize: '24px',
      fontWeight: 800,
      margin: '0 0 6px 0',
      color: 'var(--theme-text-primary)',
    },
    activityDesc: {
      fontSize: '14px',
      color: 'var(--theme-text-secondary)',
      lineHeight: 1.5,
      margin: 0,
      maxWidth: '600px',
    },
    mainActions: {
      display: 'flex',
      gap: '10px',
    },
    primaryBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 20px',
      borderRadius: '10px',
      background: 'var(--theme-primary)',
      border: 'none',
      color: 'var(--theme-on-primary)',
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: '0 4px 15px color-mix(in srgb, var(--theme-primary) 20%, transparent)',
    },
    secondaryBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 18px',
      borderRadius: '10px',
      background: `color-mix(in srgb, var(--theme-text-primary) ${0.05 * 100}%, transparent)`,
      border: '1px  solid var(--theme-border)',
      color: 'var(--theme-text-primary)',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
    },
    statsRow: {
      display: 'flex',
      gap: '24px',
      padding: '16px 24px',
      background: `color-mix(in srgb, var(--theme-text-primary) ${0.03 * 100}%, transparent)`,
      borderRadius: '12px',
      border: '1px  solid var(--theme-border)',
    },
    statItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    statLabel: {
      fontSize: '10px',
      fontWeight: 800,
      color: 'var(--theme-text-secondary)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      marginBottom: '2px',
    },
    statValue: {
      fontSize: '14px',
      fontWeight: 700,
      color: 'var(--theme-text-primary)',
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '0 8px',
    },
    toolBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      borderRadius: '8px',
      background: 'transparent',
      border: '1px  solid var(--theme-border)',
      color: 'var(--theme-text-secondary)',
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={onBack} style={styles.backButton}>
        <ArrowLeft size={14} />
        Back to Activities
      </button>

      <div style={styles.headerCard}>
        <div style={styles.topRow}>
          <div style={styles.titleSection}>
            <div style={styles.iconBox}>
              {getTypeIcon(activity.type, 28)}
            </div>
            <div>
              <div style={styles.statusBadge}>
                {isPublished ? <Globe size={10} /> : <Lock size={10} />}
                {isPublished ? 'Published' : 'Draft'}
              </div>
              <h1 style={styles.activityTitle}>{activity.title}</h1>
              <p style={styles.activityDesc}>{activity.description}</p>
            </div>
          </div>

          <div style={styles.mainActions}>
            <button onClick={onViewSubmissions} style={styles.primaryBtn}>
              <Eye size={16} />
              View Submissions
            </button>
            {activity.type === 'workspace' && (
              <button onClick={onWorkspace} style={styles.secondaryBtn}>
                <Layout size={16} />
                Workspace
              </button>
            )}
          </div>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={16} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div>
              <div style={styles.statLabel}>Reward</div>
              <div style={styles.statValue}>{activity.points || 0} XP</div>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)`, alignSelf: 'center' }} />

          <div style={styles.statItem}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'color-mix(in srgb, var(--theme-secondary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: 'var(--theme-secondary)' }} />
            </div>
            <div>
              <div style={styles.statLabel}>Time</div>
              <div style={styles.statValue}>{activity.estimatedTime || 'N/A'}</div>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)`, alignSelf: 'center' }} />

          <div style={styles.statItem}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'color-mix(in srgb, var(--theme-success) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListChecks size={16} style={{ color: 'var(--theme-success)' }} />
            </div>
            <div>
              <div style={styles.statLabel}>Content</div>
              <div style={styles.statValue}>{getQuestionCount()}</div>
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: `color-mix(in srgb, var(--theme-text-primary) ${0.06 * 100}%, transparent)`, alignSelf: 'center' }} />

          <div style={styles.statItem}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div>
              <div style={styles.statLabel}>Answers</div>
              <div style={styles.statValue}>{(activity as any).showAnswers ? 'Visible' : 'Hidden'}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <button onClick={onEdit} style={styles.toolBtn}>
          <Edit2 size={14} /> Edit Activity
        </button>
        <button onClick={onDuplicate} style={styles.toolBtn}>
          <Copy size={14} /> Duplicate
        </button>
        <button onClick={onPublishToggle} style={styles.toolBtn}>
          {isPublished ? <Lock size={14} /> : <Globe size={14} />}
          {isPublished ? 'Unpublish' : 'Publish Activity'}
        </button>
        
        <div style={{ flex: 1 }} />
        
        <button 
          onClick={onDelete} 
          style={{ ...styles.toolBtn, color: 'var(--theme-error)', borderColor: 'color-mix(in srgb, var(--theme-error) 20%, transparent)', background: 'color-mix(in srgb, var(--theme-error) 3%, transparent)' }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  );
};
