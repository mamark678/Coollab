import React, { useEffect, useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Lock, 
  PlayCircle, 
  Star, 
  Trophy, 
  X,
  ChevronRight,
  Clock,
  TrendingUp,
  LayoutList,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { Activity, ActivityService, ActivityCompletion } from '../../services/activity';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

interface ActivityPanelProps {
  onClose: () => void;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ onClose }) => {
  const { state: { user } } = useAuth();
  const { currentProjectId, userRole } = useAppStore(useShallow(s => ({ 
    currentProjectId: s.currentProjectId,
    userRole: s.userRole
  })));

  const [activities, setActivities] = useState<(Activity & { completion?: ActivityCompletion })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProjectId || !user?.uid) return;

    const loadActivities = async () => {
      setLoading(true);
      try {
        const data = await ActivityService.getInstance().listActivitiesForStudent(currentProjectId, user.uid);
        setActivities(data);
      } catch (err) {
        console.error('[ActivityPanel] Error loading activities:', err);
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
    const handleRefresh = () => loadActivities();
    window.addEventListener('activity-transition', handleRefresh);
    return () => window.removeEventListener('activity-transition', handleRefresh);
  }, [currentProjectId, user?.uid]);

  const stats = useMemo(() => {
    const completed = activities.filter(a => a.completion?.status === 'completed');
    const totalXP = completed.reduce((sum, a) => sum + (a.completion?.pointsEarned || 0), 0);
    return {
      completedCount: completed.length,
      totalCount: activities.length,
      totalXP
    };
  }, [activities]);

  const getStatus = (activity: Activity & { completion?: ActivityCompletion }, index: number) => {
    if (activity.completion?.status === 'completed') return 'completed';
    const isFirst = index === 0;
    const prevCompleted = index > 0 && activities[index - 1].completion?.status === 'completed';
    if (isFirst || prevCompleted || activity.completion?.status === 'in_progress') return 'available';
    return 'locked';
  };

  if (loading) return (
    <div className="h-full flex flex-col bg-[var(--theme-background)] border-l border-[var(--theme-border)] p-8 items-center justify-center">
      <div className="w-10 h-10 border-4 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_color-mix(in_srgb,var(--theme-primary)_30%,transparent)]" />
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--theme-background)] border-l border-[var(--theme-border)] relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[color-mix(in_srgb,var(--theme-primary)_5%,transparent)] blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="p-8 pb-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
            <LayoutList size={20} />
          </div>
          <div>
            <h2 className="text-[var(--theme-text-primary)] text-lg font-black tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Curriculum</h2>
            <p className="text-[var(--theme-text-secondary)] opacity-40 text-[9px] font-black uppercase tracking-widest mt-0.5">Assigned Modules</p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] transition-all">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 relative z-10">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] shadow-xl">
             <span className="text-[9px] font-black text-[var(--theme-text-secondary)] opacity-55 uppercase tracking-widest mb-1 block">Mastery XP</span>
             <div className="text-lg font-black text-[var(--theme-text-primary)] flex items-center gap-1.5">
               <Star size={14} className="text-[#e6c96e] fill-[#e6c96e]/20" />
               {stats.totalXP}
             </div>
          </div>
          <div className="p-4 rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] shadow-xl">
             <span className="text-[9px] font-black text-[var(--theme-text-secondary)] opacity-55 uppercase tracking-widest mb-1 block">Completion</span>
             <div className="text-lg font-black text-[var(--theme-text-primary)] flex items-center gap-1.5">
               <TrendingUp size={14} className="text-[var(--theme-primary)]" />
               {stats.completedCount}/{stats.totalCount}
             </div>
          </div>
        </div>

        {/* Activity List */}
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const status = getStatus(activity, index);
            const isCompleted = status === 'completed';
            const isLocked = status === 'locked';
            const isAvailable = status === 'available';

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={isAvailable ? { x: 4, scale: 1.01 } : {}}
                className={`group relative p-5 rounded-[24px] border transition-all duration-300 ${
                  isLocked 
                    ? 'bg-[color-mix(in_srgb,var(--theme-text-primary)_1%,transparent)] border-[var(--theme-border)] opacity-30 cursor-not-allowed' 
                    : isCompleted
                    ? 'bg-[color-mix(in_srgb,var(--theme-success)_5%,transparent)] border-[color-mix(in_srgb,var(--theme-success)_15%,transparent)]'
                    : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border-[var(--theme-border)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)] hover:border-[color-mix(in_srgb,var(--theme-primary)_40%,transparent)] cursor-pointer shadow-lg'
                }`}
                onClick={() => {
                  if (isAvailable) {
                    window.dispatchEvent(new CustomEvent('activity-select', { detail: activity.id }));
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-colors shadow-inner shadow-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] ${
                    isLocked 
                      ? 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)]' 
                      : isCompleted
                      ? 'bg-[color-mix(in_srgb,var(--theme-success)_10%,transparent)] text-[var(--theme-success)]'
                      : 'bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] text-[var(--theme-primary)] group-hover:bg-[var(--theme-primary)] group-hover:text-[var(--theme-on-primary)]'
                  }`}>
                    {isLocked ? <Lock size={20} /> : isCompleted ? <CheckCircle2 size={20} /> : <Zap size={20} className="fill-current" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className={`font-black text-[15px] tracking-tight truncate ${isLocked ? 'text-[var(--theme-text-secondary)] opacity-40' : 'text-[var(--theme-text-primary)]'}`}>
                        {activity.title}
                      </h3>
                      {isAvailable && <ChevronRight size={14} className="text-[var(--theme-text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity" />}
                    </div>
                    <div className="flex items-center gap-4">
                       <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${isLocked ? 'text-[var(--theme-text-secondary)] opacity-30' : 'text-[#e6c96e]'}`}>
                         <Star size={10} className="fill-current" />
                         {activity.points} XP
                       </div>
                       {activity.timer_config && (
                         <div className="flex items-center gap-1.5 text-[10px] font-black text-[var(--theme-text-secondary)] opacity-40 uppercase tracking-widest">
                           <Clock size={10} />
                           {Math.floor(activity.timer_config.duration_seconds / 60)}m
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActivityPanel;
