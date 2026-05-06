import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import {
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithRedirect
} from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Lock, Mail } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AntiGravityLogo } from '../components/auth/AntiGravityLogo';
import { AuthButton } from '../components/auth/AuthButton';
import { AuthInput } from '../components/auth/AuthInput';
import { ErrorBanner } from '../components/auth/ErrorBanner';
import { GlassCard } from '../components/auth/GlassCard';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { FirebaseService } from '../services/firebase';
import { mapAuthError } from '../utils/auth.helpers';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  // Debug panel — shows raw error info on screen without needing DevTools
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Rate Limiting (Section 3)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTime > 0) {
      timer = setInterval(() => {
        setLockoutTime((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTime]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resetCooldown > 0) {
      timer = setInterval(() => {
        setResetCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resetCooldown]);

  const isFormValid = email.trim() !== '' && password.length > 0 && lockoutTime === 0;

  React.useEffect(() => {
    sessionStorage.removeItem('explicitly_logged_out');

    const isMobile = Capacitor.isNativePlatform();
    const electronAPI = window.electronAPI;

    // IMPORTANT: Never call getRedirectResult on Capacitor/mobile.
    // Even a passive call to getRedirectResult triggers the Firebase redirect
    // handler in the WebView, which causes a blank white screen on Android.
    if (!isMobile && !electronAPI) {
      // Handle redirect result for non-native web browsers only
      const handleRedirectResult = async () => {
        try {
          const auth = FirebaseService.getInstance().auth;
          const result = await getRedirectResult(auth);
          if (result) {
            await FirebaseService.getInstance().handleGoogleSignInResult(result.user);
            setFailedAttempts(0);
            navigate('/');
          }
        } catch (err: any) {
          if (err.code === 'auth/account-exists-with-different-credential') {
            setError('An account with this email already exists. Please sign in with your email and password first to link these accounts.');
          } else {
            setError(mapAuthError(err));
          }
        }
      };
      handleRedirectResult();
    }

    if (!electronAPI) return;

    const cleanup = electronAPI.on('auth:google-result', async (_event: any, { idToken, accessToken, error: oauthError }: any) => {
      if (oauthError) {
        setError(oauthError);
        setLoading(false);
        return;
      }

      if (idToken || accessToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const auth = FirebaseService.getInstance().auth;

          try {
            const result = await signInWithCredential(auth, credential);
            await FirebaseService.getInstance().handleGoogleSignInResult(result.user);
            setFailedAttempts(0);
            navigate('/');
          } catch (err: any) {
            // Section 1: Account Conflict Prevention
            if (err.code === 'auth/account-exists-with-different-credential') {
              setError('An account with this email already exists. Please sign in with your email and password first to link these accounts.');
            } else {
              setError(mapAuthError(err));
            }
          }
        } catch (err: any) {
          setError(mapAuthError(err));
        } finally {
          setLoading(false);
        }
      }
    });

    return () => cleanup();
  }, [navigate]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || lockoutTime > 0) return;
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim();

    try {
      const auth = FirebaseService.getInstance().auth;
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      setFailedAttempts(0);
      navigate('/');
    } catch (err: any) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 5) {
        setError('Too many failed attempts. Consider resetting your password.');
      } else if (newAttempts >= 3) {
        setLockoutTime(30);
        setError('Too many failed attempts. Login disabled for 30 seconds.');
      } else {
        setError(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (lockoutTime > 0) return;
    setLoading(true);
    setError(null);

    const isMobile = Capacitor.isNativePlatform();
    const auth = FirebaseService.getInstance().auth;
    const googleProvider = new GoogleAuthProvider();

    if (isMobile) {
      try {
        const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
        setDebugLog(prev => [...prev, `ClientID: ${clientId?.substring(0, 20)}...`]);

        await GoogleSignIn.initialize({
          clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
        });
        console.log('[GOOGLE] Initialize success');
        setDebugLog(prev => [...prev, 'Initialize: OK']);

        const result = await GoogleSignIn.signIn({
          nonce: Math.random().toString(36).substring(2)
        });
        console.log('[GOOGLE] SignIn result:', JSON.stringify(result));
        setDebugLog(prev => [...prev, `SignIn result: ${JSON.stringify(result)}`]);

        if (!result.idToken) {
          throw new Error('No idToken returned from Google Sign-In');
        }

        // Exchange with Firebase
        const credential = GoogleAuthProvider.credential(result.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await FirebaseService.getInstance().handleGoogleSignInResult(userCredential.user);
        setFailedAttempts(0);
        navigate('/');
      } catch (err: any) {
        console.error('[GOOGLE] Full error:', JSON.stringify(err));
        console.error('[GOOGLE] Error code:', err.code);
        console.error('[GOOGLE] Error message:', err.message);
        console.error('[GOOGLE] Error stack:', err.stack);
        setDebugLog(prev => [...prev, `ERROR code: ${err.code}`]);
        setDebugLog(prev => [...prev, `ERROR msg: ${err.message}`]);
        setDebugLog(prev => [...prev, `ERROR stack: ${err.stack}`]);
        setDebugLog(prev => [...prev, `FULL: ${JSON.stringify(err)}`]);
        setError(`${err.code || 'Error'} — ${err.message}`);
        setLoading(false);
      }
    } else {
      // Electron desktop flow - keep unchanged
      const electronAPI = window.electronAPI;
      if (electronAPI) {
        console.log('[AUTH] Using Electron IPC auth flow');
        electronAPI.send('auth:google-login');
      } else {
        console.log('[AUTH] Starting signInWithRedirect (web browser)...');
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (err: any) {
          console.error('[AUTH] signInWithRedirect error:', err);
          setError(mapAuthError(err));
          setLoading(false);
        }
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || resetCooldown > 0) return;
    setResetLoading(true);
    try {
      const auth = FirebaseService.getInstance().auth;
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setResetCooldown(60);
    } catch (err) {
      // Always show success message to hide email existence (Section 4)
      setResetSent(true);
      setResetCooldown(60);
    } finally {
      setResetLoading(false);
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
          <div className="text-center mb-[28px]">
            <h2 className="text-[26px] font-bold text-[#e8eaf0] tracking-tight mb-1">Welcome back</h2>
            <p className="text-[14.5px] text-[#6b6f82]">Sign in to continue to Coollab</p>
          </div>

          <GoogleSignInButton
            label="Continue with Google"
            onClick={handleGoogleSignIn}
            disabled={loading || lockoutTime > 0}
          />

          {/* ── Debug panel: visible on phone without DevTools ── */}
          {debugLog.length > 0 && (
            <div style={{
              marginTop: 12,
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid #ef4444',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#f87171',
              lineHeight: 1.6,
              wordBreak: 'break-all',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4, color: '#fca5a5' }}>🔍 Auth Debug Log</div>
              {debugLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 my-[22px]">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]"></div>
            <span className="text-[11px] text-[#64748b] uppercase tracking-widest font-bold">OR</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]"></div>
          </div>

          <ErrorBanner error={error} />

          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4 mt-2">
            <AuthInput
              label="Email address"
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || lockoutTime > 0}
            />
            <AuthInput
              label="Password"
              icon={Lock}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || lockoutTime > 0}
            />

            <div className="flex items-center justify-between mt-1 mb-2">
              <div className="text-[13.5px] text-[#a0a4b8]">
                {lockoutTime > 0 && (
                  <span className="text-[#e66b7a] font-medium animate-pulse">
                    Try again in {lockoutTime}s
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[13.5px] text-[#7c6bf0] font-semibold hover:text-[#9485f5] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <div className="mt-6 mb-4">
              <AuthButton type="submit" loading={loading} disabled={!isFormValid}>
                {lockoutTime > 0 ? `Locked (${lockoutTime}s)` : 'Sign In'}
              </AuthButton>
            </div>
          </form>

          <p className="text-center text-[14px] text-[#a0a4b8]">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#7c6bf0] font-bold tracking-wide hover:text-[#9485f5] transition-colors">
              Create one
            </Link>
          </p>
        </GlassCard>
      </div>

      {/* Forgot Password Modal (Section 4) */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0b0b12]/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm"
            >
              <GlassCard>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-[#e8eaf0]">Reset Password</h3>
                  <button onClick={() => { setShowForgotModal(false); setResetSent(false); }} className="text-[#6b6f82] hover:text-[#e8eaf0]">
                    <X size={20} />
                  </button>
                </div>

                {resetSent ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-[#6dd49e]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="text-[#6dd49e]" size={24} />
                    </div>
                    <p className="text-[#e8eaf0] font-medium mb-2">Check your email</p>
                    <p className="text-[14px] text-[#6b6f82]">If this email exists, a reset link has been sent.</p>
                    <div className="mt-6">
                      <AuthButton onClick={() => { setShowForgotModal(false); setResetSent(false); }}>
                        Back to login
                      </AuthButton>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleResetPassword}>
                    <p className="text-[14px] text-[#6b6f82] mb-6">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                    <AuthInput
                      label="Email address"
                      icon={Mail}
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <div className="mt-8">
                      <AuthButton
                        type="submit"
                        loading={resetLoading}
                        disabled={!email || resetCooldown > 0}
                      >
                        {resetCooldown > 0 ? `Resend in ${resetCooldown}s` : 'Send reset link'}
                      </AuthButton>
                    </div>
                  </form>
                )}
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Internal X icon for convenience
const X: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
