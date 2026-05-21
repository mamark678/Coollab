import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Mail, KeyRound, MailCheck, ArrowLeft } from 'lucide-react';
import { GlassCard } from '../components/auth/GlassCard';
import { AuthInput } from '../components/auth/AuthInput';
import { AuthButton } from '../components/auth/AuthButton';
import { ErrorBanner } from '../components/auth/ErrorBanner';
import { AntiGravityLogo } from '../components/auth/AntiGravityLogo';
import { FirebaseService } from '../services/firebase';
import { mapAuthError } from '../utils/auth.helpers';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setError(null);
    try {
      const auth = FirebaseService.getInstance().auth;
      await sendPasswordResetEmail(auth, email);
      setIsSuccess(true);
      setCooldown(60);
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const auth = FirebaseService.getInstance().auth;
      await sendPasswordResetEmail(auth, email);
      setCooldown(60);
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full min-h-[100dvh] flex flex-col items-center justify-center px-4 relative z-10"
    >
      <div className="w-full max-w-md flex flex-col items-center">
        <AntiGravityLogo />
        
        <GlassCard>
          <div className="relative">
          {!isSuccess && (
            <button 
              onClick={() => navigate('/login')} 
              className="absolute -top-1 -left-2 p-2 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors rounded-lg hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)]"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.div
                key="input-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-center mb-6 mt-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] to-[color-mix(in_srgb,var(--theme-secondary)_20%,transparent)] border border-[var(--theme-border)] flex items-center justify-center">
                    <KeyRound size={28} className="text-[var(--theme-primary)]" />
                  </div>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-[var(--theme-text-primary)] tracking-tight">Forgot password?</h2>
                  <p className="text-sm text-[var(--theme-text-secondary)] mt-2">No worries. Enter your email and we'll send you a reset link.</p>
                </div>

                <ErrorBanner error={error} />

                <form onSubmit={handleReset} className="flex flex-col gap-6 mt-4">
                  <AuthInput
                    label="Email address"
                    icon={Mail}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />

                  <AuthButton type="submit" loading={loading} disabled={!email || loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </AuthButton>
                </form>

                <p className="text-center text-sm text-[var(--theme-text-secondary)] mt-8">
                  Remembered it?{' '}
                  <Link to="/login" className="text-[var(--theme-primary)] font-medium hover:text-[var(--theme-secondary)] transition-colors">
                    Back to Sign In
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="success-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex flex-col items-center"
              >
                <div className="w-20 h-20 mb-6 rounded-full bg-[color-mix(in_srgb,var(--theme-success)_15%,transparent)] border border-[color-mix(in_srgb,var(--theme-success)_25%,transparent)] flex items-center justify-center shadow-[0_0_30px_color-mix(in_srgb,var(--theme-success)_20%,transparent)]">
                  <MailCheck size={32} className="text-[var(--theme-success)]" />
                </div>
                
                <h2 className="text-2xl font-bold text-[var(--theme-text-primary)] tracking-tight mb-3">Check your inbox</h2>
                <p className="text-center text-[var(--theme-text-secondary)] text-sm leading-relaxed mb-8">
                  We sent a password reset link to <span className="text-[var(--theme-text-primary)] font-medium">{email}</span>. It may take a minute to arrive.
                </p>

                <div className="w-full space-y-4">
                  <button
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                    className="w-full py-3 text-sm font-medium text-[var(--theme-primary)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Didn't receive it? {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                  </button>
                  
                  <Link 
                    to="/login"
                    className="flex w-full justify-center py-3 text-sm font-semibold text-[var(--theme-text-primary)] bg-[color-mix(in_srgb,var(--theme-text-primary)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_15%,transparent)] border border-[var(--theme-border)] rounded-xl transition-all"
                  >
                    Back to login
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
      </div>
    </motion.div>
  );
};
