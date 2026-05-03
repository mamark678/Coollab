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
              className="absolute -top-1 -left-2 p-2 text-[#6b6f82] hover:text-white transition-colors rounded-lg hover:bg-white/5"
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
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c6bf0]/20 to-[#4ea1f7]/20 border border-white/10 flex items-center justify-center">
                    <KeyRound size={28} className="text-[#7c6bf0]" />
                  </div>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-[#e8eaf0] tracking-tight">Forgot password?</h2>
                  <p className="text-sm text-[#6b6f82] mt-2">No worries. Enter your email and we'll send you a reset link.</p>
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

                <p className="text-center text-sm text-[#6b6f82] mt-8">
                  Remembered it?{' '}
                  <Link to="/login" className="text-[#7c6bf0] font-medium hover:text-[#9485f5] transition-colors">
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
                <div className="w-20 h-20 mb-6 rounded-full bg-[#6dd49e]/15 border border-[#6dd49e]/25 flex items-center justify-center shadow-[0_0_30px_rgba(109,212,158,0.2)]">
                  <MailCheck size={32} className="text-[#6dd49e]" />
                </div>
                
                <h2 className="text-2xl font-bold text-[#e8eaf0] tracking-tight mb-3">Check your inbox</h2>
                <p className="text-center text-[#a0a4b8] text-sm leading-relaxed mb-8">
                  We sent a password reset link to <span className="text-[#e8eaf0] font-medium">{email}</span>. It may take a minute to arrive.
                </p>

                <div className="w-full space-y-4">
                  <button
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                    className="w-full py-3 text-sm font-medium text-[#7c6bf0] hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Didn't receive it? {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                  </button>
                  
                  <Link 
                    to="/login"
                    className="flex w-full justify-center py-3 text-sm font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all"
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
