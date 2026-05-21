import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoleSelection } from './RoleSelection';
import { AuthButton } from './AuthButton';
import { FirebaseService } from '../../services/firebase';
import { useAppStore } from '../../store/useAppStore';

interface RoleSelectionModalProps {
  uid: string;
  onConfirm: (role: 'student' | 'instructor') => void;
}

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({ uid, onConfirm }) => {
  const [selectedRole, setSelectedRole] = useState<'student' | 'instructor' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!selectedRole) return;
    setLoading(true);
    const now = Date.now();
    try {
      await FirebaseService.getInstance().saveUserProfile(uid, {
        role: selectedRole,
        updatedAt: now
      });

      if (selectedRole === 'student') {
        await FirebaseService.getInstance().createStudentDefaultWorkspace(uid);
      }

      useAppStore.getState().setUserRole(selectedRole);
      onConfirm(selectedRole);
    } catch (err) {
      console.error('[RoleSelectionModal] Error saving role:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-[#161720] border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#7c6bf0]/10 blur-[80px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#6dd49e]/10 blur-[80px] rounded-full" />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-[24px] font-bold text-white mb-3">One quick thing</h2>
            <p className="text-[#a0a4b8] text-[15px] leading-relaxed">
              You haven't confirmed your role yet.
            </p>
          </div>

          <RoleSelection selectedRole={selectedRole} onSelect={setSelectedRole} />

          <div className="mt-10">
            <AuthButton
              onClick={handleConfirm}
              loading={loading}
              disabled={!selectedRole}
            >
              Confirm role
            </AuthButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
