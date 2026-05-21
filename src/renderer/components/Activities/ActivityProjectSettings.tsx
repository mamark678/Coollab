import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Settings, Zap, Layout, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FirebaseService, DocumentSchema } from '../../services/firebase';

interface ActivityProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const ActivityProjectSettings: React.FC<ActivityProjectSettingsProps> = ({
  isOpen,
  onClose,
  projectId
}) => {
  const [projectData, setProjectData] = useState<DocumentSchema | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<'individual' | 'group'>('individual');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    setLoading(true);
    FirebaseService.getInstance().getNote(projectId).then(doc => {
      if (doc) {
        setProjectData(doc);
        setName(doc.title || '');
        setDescription(doc.description || '');
        setActivityType(doc.activityType || 'individual');
      }
      setLoading(false);
    });
  }, [isOpen, projectId]);

  const handleSave = async () => {
    if (activityType !== projectData?.activityType) {
      setShowWarning(true);
      return;
    }
    await performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      await FirebaseService.getInstance().saveNote(projectId, {
        title: name,
        description,
        activityType
      });
      onClose();
    } catch (err) {
      console.error('[ActivitySettings] Save failed:', err);
    } finally {
      setSaving(false);
      setShowWarning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[color-mix(in_srgb,var(--theme-background)_90%,transparent)] backdrop-blur-md" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-[540px] bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[40px] p-10 shadow-2xl relative overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Glow Effect */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] blur-[80px] pointer-events-none" />

        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] flex items-center justify-center text-[var(--theme-primary)] shadow-inner shadow-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)]">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--theme-text-primary)] tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>Project Settings</h2>
              <p className="text-[var(--theme-text-secondary)] opacity-55 text-[10px] font-black uppercase tracking-widest mt-1">Configure Environment</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] opacity-60 hover:opacity-100 hover:text-[var(--theme-text-primary)] transition-all">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--theme-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[var(--theme-text-secondary)] opacity-55 text-xs font-bold mt-4 uppercase tracking-widest">Accessing records...</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <label className="text-[11px] font-black text-[var(--theme-text-secondary)] opacity-55 uppercase tracking-widest mb-3 block">Project Identity</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name your workspace..."
                className="w-full bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] rounded-2xl px-5 py-4 text-[var(--theme-text-primary)] text-sm font-bold focus:outline-none focus:border-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)] transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-black text-[var(--theme-text-secondary)] opacity-55 uppercase tracking-widest mb-3 block">Description</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief summary of the learning objective..."
                className="w-full bg-[color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] border border-[var(--theme-border)] rounded-2xl px-5 py-4 text-[var(--theme-text-primary)] text-sm font-medium focus:outline-none focus:border-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)] transition-all min-h-[100px] resize-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-black text-[var(--theme-text-secondary)] opacity-55 uppercase tracking-widest mb-3 block">Collaboration Mode</label>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => setActivityType('individual')}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${activityType === 'individual' ? 'bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] border-[var(--theme-primary)] text-[var(--theme-text-primary)]' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] opacity-60 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_4%,transparent)]'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activityType === 'individual' ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-lg shadow-[var(--theme-primary)]/20' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)]'}`}>
                    <User size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Individual Tracks</div>
                    <div className="text-[11px] opacity-60">Isolated workspaces for every student</div>
                  </div>
                </button>
                <button 
                  onClick={() => setActivityType('group')}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${activityType === 'group' ? 'bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] border-[var(--theme-primary)] text-[var(--theme-text-primary)]' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-secondary)] opacity-60 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_4%,transparent)]'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activityType === 'group' ? 'bg-[var(--theme-primary)] text-[var(--theme-on-primary)] shadow-lg shadow-[var(--theme-primary)]/20' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)]'}`}>
                    <Layout size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Shared Arena</div>
                    <div className="text-[11px] opacity-60">Real-time collaboration in a single space</div>
                  </div>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showWarning && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-5 bg-[color-mix(in_srgb,var(--theme-error)_10%,transparent)] border border-[color-mix(in_srgb,var(--theme-error)_30%,transparent)] rounded-[24px]"
                >
                  <div className="flex gap-4">
                    <AlertTriangle size={24} className="text-[var(--theme-error)] shrink-0" />
                    <div>
                      <h4 className="text-[var(--theme-error)] font-black text-[13px] uppercase tracking-widest mb-1">Structural Change Detected</h4>
                      <p className="text-[var(--theme-text-primary)] opacity-60 text-[12px] leading-relaxed mb-4">
                        Switching collaboration modes after student enrollment may lead to data inconsistencies or lost progress.
                      </p>
                      <div className="flex gap-3">
                        <button className="flex-1 py-2.5 bg-[var(--theme-error)] text-[var(--theme-on-primary)] font-black text-[11px] uppercase rounded-xl" onClick={performSave}>Confirm Change</button>
                        <button className="flex-1 py-2.5 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[var(--theme-text-secondary)] opacity-60 font-black text-[11px] uppercase rounded-xl" onClick={() => setShowWarning(false)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showWarning && (
              <div className="flex gap-3 pt-4">
                <button 
                  className="flex-1 py-4 bg-[var(--theme-text-primary)] text-[var(--theme-background)] font-black text-sm rounded-2xl shadow-xl shadow-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] hover:translate-y-[-2px] transition-all disabled:opacity-50" 
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                >
                  {saving ? 'Updating...' : 'Save Configuration'}
                </button>
                <button 
                  className="px-8 py-4 bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] text-[var(--theme-text-secondary)] opacity-60 font-bold text-sm rounded-2xl hover:opacity-100 hover:text-[var(--theme-text-primary)] transition-all"
                  onClick={onClose}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
