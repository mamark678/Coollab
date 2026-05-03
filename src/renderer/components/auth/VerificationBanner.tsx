import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, X } from 'lucide-react';
import { FirebaseService } from '../../services/firebase';
import { sendEmailVerification } from 'firebase/auth';

interface VerificationBannerProps {
  user: any;
}

export const VerificationBanner: React.FC<VerificationBannerProps> = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Skip if verified or social login (Google already verified) or anonymous
  if (!user || user.emailVerified || user.isAnonymous || dismissed) return null;
  
  // Skip if it's a Google account (Google accounts are already verified)
  const isPasswordProvider = user.providerData.some((p: any) => p.providerId === 'password');
  if (!isPasswordProvider) return null;

  const handleResend = async () => {
    if (loading || sent) return;
    setLoading(true);
    try {
      await sendEmailVerification(user);
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      console.error('[VerificationBanner] Resend error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-[#7c6bf0]/10 border-b border-[#7c6bf0]/20 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#7c6bf0]/20 flex items-center justify-center shrink-0">
              <Mail size={16} className="text-[#7c6bf0]" />
            </div>
            <p className="text-[13.5px] text-[#e8eaf0]">
              Please verify your email address to secure your account.
              {sent && <span className="ml-2 text-[#6dd49e] font-medium">Link sent!</span>}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleResend}
              disabled={loading || sent}
              className="text-[13px] font-semibold text-[#7c6bf0] hover:text-[#9485f5] transition-colors flex items-center gap-1.5"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Resend verification email'}
            </button>
            <button 
              onClick={() => setDismissed(true)}
              className="text-[#6b6f82] hover:text-[#e8eaf0] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
