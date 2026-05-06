import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { GoogleAuthProvider, createUserWithEmailAndPassword, getRedirectResult, sendEmailVerification, signInWithCredential, signInWithRedirect, updateProfile } from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Lock, Mail, User, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AntiGravityLogo } from '../components/auth/AntiGravityLogo';
import { AuthButton } from '../components/auth/AuthButton';
import { AuthInput } from '../components/auth/AuthInput';
import { ErrorBanner } from '../components/auth/ErrorBanner';
import { GlassCard } from '../components/auth/GlassCard';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { PasswordStrengthMeter, getStrength } from '../components/auth/PasswordStrengthMeter';
import { FirebaseService } from '../services/firebase';
import { mapAuthError } from '../utils/auth.helpers';

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWeakPasswordModal, setShowWeakPasswordModal] = useState(false);
  // Debug panel — shows raw error info on screen without needing DevTools
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Password Strength Check
  const strength = getStrength(password);
  const isPasswordTooShort = password.length > 0 && password.length < 6;
  const isWeakOrFair = strength.label === 'Weak' || strength.label === 'Fair';

  // Display Name validation (Section 3)
  const isNameValid = fullName.trim().length >= 2 && fullName.trim().length <= 50 && /^[a-zA-Z\s\-']+$/.test(fullName.trim());

  const isFormValid = isNameValid && email.trim() !== '' && password.length >= 6 && passwordsMatch && termsAgreed;

  const executeSignup = async () => {
    setShowWeakPasswordModal(false);
    setLoading(true);
    setError(null);
    try {
      const auth = FirebaseService.getInstance().auth;
      const cleanEmail = email.trim();
      const cleanFullName = fullName.trim();

      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(credential.user, { displayName: cleanFullName });

      // Section 4: Email Verification
      await sendEmailVerification(credential.user);

      await auth.currentUser?.reload();
      navigate('/');
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (isWeakOrFair) {
      setShowWeakPasswordModal(true);
    } else {
      await executeSignup();
    }
  };

  React.useEffect(() => {
    const isMobile = Capacitor.isNativePlatform();
    const electronAPI = (window as any).electronAPI;

    // IMPORTANT: Never call getRedirectResult on Capacitor/mobile.
    // Even a passive call triggers Firebase's redirect handler in the WebView,
    // causing a blank white screen on Android.
    if (!isMobile && !electronAPI) {
      const handleRedirectResult = async () => {
        try {
          const auth = FirebaseService.getInstance().auth;
          const result = await getRedirectResult(auth);
          if (result) {
            await FirebaseService.getInstance().handleGoogleSignInResult(result.user);
            navigate('/');
          }
        } catch (err: any) {
          if (err.code !== 'auth/popup-closed-by-user') {
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
            navigate('/');
          } catch (err: any) {
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

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError(null);

    const isMobile = Capacitor.isNativePlatform();
    const auth = FirebaseService.getInstance().auth;
    const googleProvider = new GoogleAuthProvider();

    if (isMobile) {
      try {
        console.error('COOLLAB_AUTH: Starting Google Sign-In');
        const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
        
        // Log Client ID format checks
        setDebugLog(prev => [...prev, `ClientID ends with: ...${clientId?.slice(-30)}`]);
        setDebugLog(prev => [...prev, `ClientID valid format: ${clientId?.endsWith('.apps.googleusercontent.com')}`]);
        
        // Check if plugin is available
        console.log('[GOOGLE] Plugin available:', typeof GoogleSignIn);
        setDebugLog(prev => [...prev, `Plugin type: ${typeof GoogleSignIn}`]);

        // Log full initialize result
        const initResult = await GoogleSignIn.initialize({
          clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
        });
        console.log('[GOOGLE] Init result:', JSON.stringify(initResult));
        setDebugLog(prev => [...prev, `Init result: ${JSON.stringify(initResult)}`]);

        setDebugLog(prev => [...prev, 'Calling signIn now...']);
        const result = await GoogleSignIn.signIn({
          nonce: Math.random().toString(36).substring(2)
        });
        console.log('[GOOGLE] SignIn result:', JSON.stringify(result));
        setDebugLog(prev => [...prev, `signIn raw result: ${JSON.stringify(result)}`]);

        if (!result.idToken) {
          throw new Error('No idToken returned from Google Sign-In');
        }

        // Exchange with Firebase
        const credential = GoogleAuthProvider.credential(result.idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await FirebaseService.getInstance().handleGoogleSignInResult(userCredential.user);
        navigate('/');
      } catch (err: any) {
        console.error('COOLLAB_AUTH: ' + JSON.stringify(err));
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
      const electronAPI = (window as any).electronAPI;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full min-h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative z-10"
    >
      <div className="w-full max-w-md flex flex-col items-center">
        <AntiGravityLogo />

        <GlassCard>
          <div className="text-center mb-[28px]">
            <h2 className="text-[26px] font-bold text-[#e8eaf0] tracking-tight mb-1">Create your account</h2>
            <p className="text-[14.5px] text-[#6b6f82]">Join Coollab and start collaborating</p>
          </div>

          <GoogleSignInButton label="Sign up with Google" onClick={handleGoogleSignup} disabled={loading} />

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

          <form onSubmit={handleSignup} className="flex flex-col gap-4 mt-2">
            <AuthInput
              label="Full name"
              icon={User}
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
            />
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

            <div className="flex flex-col w-full">
              <AuthInput
                ref={passwordInputRef}
                label="Password"
                icon={Lock}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <PasswordStrengthMeter password={password} />
              {isPasswordTooShort && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[#e66b7a] text-[11px] mt-1.5 font-medium flex items-center gap-1"
                >
                  <X size={10} /> Password must be at least 6 characters
                </motion.p>
              )}
            </div>

            <div className="relative">
              <AuthInput
                label="Confirm password"
                icon={Lock}
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              {confirmPassword.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute right-10 top-[34px] flex items-center justify-center z-10 pointer-events-none"
                >
                  {passwordsMatch ? (
                    <Check size={16} className="text-[#6dd49e]" />
                  ) : (
                    <X size={16} className="text-[#e66b7a]" />
                  )}
                </motion.div>
              )}
            </div>

            <label className="flex items-start gap-2.5 mt-1 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 w-[15px] h-[15px] shrink-0 rounded border-white/[0.15] bg-white/[0.05] text-[#7c6bf0] focus:ring-[#7c6bf0] outline-none"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                disabled={loading}
              />
              <span className="text-[13px] text-[#a0a4b8] leading-tight group-hover:text-[#e8eaf0] transition-colors">
                I agree to the{' '}
                <button type="button" onClick={() => window.open('https://example.com/terms', '_blank')} className="text-[#7c6bf0] hover:underline font-semibold">Terms of Service</button>
                {' '}and{' '}
                <button type="button" onClick={() => window.open('https://example.com/privacy', '_blank')} className="text-[#7c6bf0] hover:underline font-semibold">Privacy Policy</button>
              </span>
            </label>

            <div className="mt-5 mb-4">
              <AuthButton type="submit" loading={loading} disabled={!isFormValid}>
                Create Account
              </AuthButton>
            </div>
          </form>

          <p className="text-center text-[14px] text-[#a0a4b8]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#7c6bf0] font-bold tracking-wide hover:text-[#9485f5] transition-colors">
              Sign in
            </Link>
          </p>
        </GlassCard>
      </div>

      <AnimatePresence>
        {showWeakPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[6px]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#161720] border border-white/10 rounded-[24px] p-7 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500/50 via-yellow-400/50 to-yellow-500/50" />

              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-5">
                <AlertTriangle className="text-yellow-500" size={24} />
              </div>

              <h3 className="text-[20px] font-bold text-white mb-2">Weak Password</h3>
              <p className="text-[#a0a4b8] text-[14.5px] leading-relaxed mb-8">
                Your password is weak. A weak password makes your account easier to hack. Are you sure you want to continue with this password?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={executeSignup}
                  className="w-full py-3 bg-[#7c6bf0] text-white rounded-[12px] font-bold text-[15px] hover:bg-[#6b5ae0] transition-all active:scale-[0.98] shadow-lg shadow-[#7c6bf0]/20"
                >
                  Yes, continue anyway
                </button>
                <button
                  onClick={() => {
                    setShowWeakPasswordModal(false);
                    setTimeout(() => passwordInputRef.current?.focus(), 100);
                  }}
                  className="w-full py-3 bg-white/[0.03] text-[#e8eaf0] rounded-[12px] font-semibold text-[15px] hover:bg-white/[0.08] transition-all border border-white/5"
                >
                  Let me change it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
