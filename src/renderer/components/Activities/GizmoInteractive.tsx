import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  X, 
  Check, 
  MousePointer2, 
  Move,
  RotateCcw,
  Star,
  Zap,
  Info,
  ChevronRight
} from 'lucide-react';
import { Activity } from '../../services/activity';

interface GizmoInteractiveProps {
  activity: Activity;
  onComplete: (score: number) => void;
  onClose: () => void;
}

export const GizmoInteractive: React.FC<GizmoInteractiveProps> = ({ activity, onComplete, onClose }) => {
  const gizmoData = activity.gizmoData;
  const [items, setItems] = useState<any[]>(gizmoData?.items || []);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState(0);

  // For simplicity, let's assume it's a "Timeline/Ordering" gizmo for now
  // We can expand types later based on activity.gizmoData.gizmoType

  const checkOrder = () => {
    const isOrdered = items.every((item, idx) => item.correctOrder === idx);
    setIsCorrect(isOrdered);
    setAttempts(a => a + 1);
    
    if (isOrdered) {
      setTimeout(() => {
        onComplete(activity.points);
      }, 2000);
    }
  };

  const handleReset = () => {
    setItems([...(gizmoData?.items || [])].sort(() => Math.random() - 0.5));
    setIsCorrect(null);
  };

  useEffect(() => {
    // Shuffle initial items
    setItems([...(gizmoData?.items || [])].sort(() => Math.random() - 0.5));
  }, [gizmoData]);

  return (
    <div className="fixed inset-0 z-[10000] bg-[var(--theme-background)] flex flex-col text-[var(--theme-text-primary)]">
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-full transition-colors">
            <X size={24} className="text-[var(--theme-text-secondary)]" />
          </button>
          <div>
            <h2 className="text-xl font-black">{activity.title}</h2>
            <div className="flex items-center gap-2 text-[var(--theme-text-secondary)] text-xs font-bold uppercase tracking-wider">
              <MousePointer2 size={12} /> Interactive Gizmo
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] rounded-full border border-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)]">
            <Star size={16} className="text-[var(--theme-primary)]" />
            <span className="text-sm font-black text-[var(--theme-primary)]">{activity.points} XP</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <p className="text-[var(--theme-text-secondary)] text-lg leading-relaxed">
              {activity.description}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-xl border border-[var(--theme-border)]">
               <Info size={16} className="text-[var(--theme-primary)]" />
               <span className="text-sm text-[var(--theme-text-secondary)]">Drag the items into the correct chronological order</span>
            </div>
          </div>

          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-3">
            {items.map((item) => (
              <Reorder.Item 
                key={item.id} 
                value={item}
                className="group relative bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:border-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)] p-5 rounded-[20px] cursor-grab active:cursor-grabbing transition-all flex items-center gap-4 shadow-lg"
              >
                <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] flex items-center justify-center text-[var(--theme-primary)]">
                  <Move size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold">{item.text}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--theme-text-secondary)]">Drag to move</div>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <div className="mt-12 flex flex-col items-center gap-6">
            <AnimatePresence>
              {isCorrect !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black ${
                    isCorrect 
                    ? 'bg-[color-mix(in_srgb,var(--theme-success)_10%,transparent)] text-[var(--theme-success)] border border-[color-mix(in_srgb,var(--theme-success)_30%,transparent)]' 
                    : 'bg-[color-mix(in_srgb,var(--theme-error)_10%,transparent)] text-[var(--theme-error)] border border-[color-mix(in_srgb,var(--theme-error)_30%,transparent)]'
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <Check size={20} /> Correct! Well done.
                    </>
                  ) : (
                    <>
                      <RotateCcw size={20} /> Not quite right. Try again!
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className="px-8 py-4 rounded-[16px] bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[var(--theme-text-secondary)] font-black hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] transition-all border border-[var(--theme-border)] flex items-center gap-2"
              >
                <RotateCcw size={18} /> Reset
              </button>
              <button
                onClick={checkOrder}
                className="px-12 py-4 rounded-[16px] bg-[var(--theme-primary)] text-[var(--theme-on-primary)] font-black shadow-[0_8px_32px_color-mix(in_srgb,var(--theme-primary)_30%,transparent)] hover:translate-y-[-2px] transition-all"
              >
                Verify Sequence
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
