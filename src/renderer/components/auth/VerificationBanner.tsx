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
  const [showVerifyBanner, setShowVerifyBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    sessionStorage.getItem('verifyBannerDismissed') === 'true'
  );

  React.useEffect(() => {
    if (!user?.emailVerified && !bannerDismissed) {
      // Delay showing the banner by 60 seconds after login
      const timer = setTimeout(() => setShowVerifyBanner(true), 60000);
      return () => clearTimeout(timer);
    }
  }, [user, bannerDismissed]);

  // Skip if verified or social login (Google already verified) or anonymous or dismissed
  if (!user || user.emailVerified || user.isAnonymous || bannerDismissed || !showVerifyBanner) return null;
  
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
      {showVerifyBanner && !user?.emailVerified && !bannerDismissed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
            background: `color-mix(in srgb, var(--theme-primary) ${0.15 * 100}%, transparent)`,
            borderBottom: '1px solid rgba(124,58,237,0.3)',
            padding: '10px 20px',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              background: `color-mix(in srgb, var(--theme-primary) ${0.2 * 100}%, transparent)`, display: 'flex', 
              alignItems: 'center', justifyContent: 'center' 
            }}>
              <Mail size={16} style={{ color: 'var(--theme-secondary)' }} />
            </div>
            <span style={{ fontSize: '13px', color: 'var(--theme-text-primary)' }}>
              Please verify your email to secure your account.
              {sent && <span style={{ marginLeft: '8px', color: '#6dd49e', fontWeight: 600 }}>Link sent!</span>}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleResend}
              disabled={loading || sent}
              style={{
                fontSize: '13px', color: 'var(--theme-secondary)', background: 'none',
                border: 'none', cursor: loading || sent ? 'default' : 'pointer', 
                textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : 'Resend verification email'}
            </button>
            <button
              onClick={() => {
                setShowVerifyBanner(false);
                setBannerDismissed(true);
                sessionStorage.setItem('verifyBannerDismissed', 'true');
              }}
              style={{
                width: '24px', height: '24px', borderRadius: '6px',
                background: `color-mix(in srgb, var(--theme-text-primary) ${0.08 * 100}%, transparent)`, border: 'none',
                color: 'var(--theme-text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
