import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithCredential,
  signInWithRedirect,
  updateProfile
} from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Mail, User, Zap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthButton } from '../components/auth/AuthButton';
import { AuthInput } from '../components/auth/AuthInput';
import { ErrorBanner } from '../components/auth/ErrorBanner';
import { PasswordStrengthMeter, getStrength } from '../components/auth/PasswordStrengthMeter';
import { FirebaseService } from '../services/firebase';
import { mapAuthError } from '../utils/auth.helpers';

const FEATURES = [
  { emoji: '⚡', label: 'AI-powered activity generation' },
  { emoji: '🎯', label: 'Adaptive learning paths' },
  { emoji: '📊', label: 'Real-time evaluation & XP' },
  { emoji: '🤝', label: 'Live collaborative workspaces' },
];

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const isFormValid = fullName.trim().length >= 2 && email.trim() !== '' && password.length >= 6 && termsAgreed;

  const executeSignup = async () => {
    setLoading(true);
    try {
      const auth = FirebaseService.getInstance().auth;
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await FirebaseService.getInstance().saveUserProfile(credential.user.uid, {
        name: fullName.trim(),
        email: email.trim(),
        role: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        uid: credential.user.uid
      });
      await sendEmailVerification(credential.user);
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
    await executeSignup();
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError(null);
    const isMobile = Capacitor.isNativePlatform();
    const auth = FirebaseService.getInstance().auth;
    const googleProvider = new GoogleAuthProvider();

    if (isMobile) {
      try {
        await GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID });
        const result = await GoogleSignIn.signIn({ nonce: Math.random().toString(36).substring(2) });
        if (!result.idToken) throw new Error('No idToken returned');
        const credential = GoogleAuthProvider.credential(result.idToken);
        const uc = await signInWithCredential(auth, credential);
        await FirebaseService.getInstance().handleGoogleSignInResult(uc.user);
        navigate('/');
      } catch (err: any) {
        setError(`${err.code || 'Error'} — ${err.message}`);
        setLoading(false);
      }
    } else {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        electronAPI.send('auth:google-login');
      } else {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (err: any) {
          setError(mapAuthError(err));
          setLoading(false);
        }
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-[100vh] flex items-stretch relative overflow-hidden bg-[var(--theme-background)]"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[800px] h-[800px] rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_10%,transparent)] blur-[160px]" />
        <div className="absolute bottom-[-20%] right-[10%] w-[600px] h-[600px] rounded-full bg-[color-mix(in_srgb,var(--theme-secondary)_5%,transparent)] blur-[140px]" />
      </div>

      {/* Left Side: Branding */}
      <div 
        className="hidden lg:flex flex-col justify-between relative z-10"
        style={{ width: '50%', height: '100vh', padding: '64px' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-secondary)] flex items-center justify-center shadow-lg shadow-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)]">
            <Zap size={26} className="text-[var(--theme-on-primary)] fill-[var(--theme-on-primary)]" />
          </div>
          <span className="text-2xl font-black text-[var(--theme-text-primary)] tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Coollab
          </span>
        </div>

        <div>
          <h1 className="text-[72px] font-black leading-[1.05] tracking-tight text-[var(--theme-text-primary)] mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Start building<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]">smarter</span> today.
          </h1>
          <p className="text-[18px] text-[var(--theme-text-secondary)] leading-relaxed max-w-[480px] mb-12">
            Join thousands of educators and students on the platform built for modern learning.
          </p>

          <ul className="flex flex-col gap-5">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-4 group">
                <div className="w-9 h-9 rounded-lg bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] flex items-center justify-center text-lg group-hover:bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] transition-colors">
                  <span className="grayscale group-hover:grayscale-0 transition-all">{f.emoji}</span>
                </div>
                <span className="text-[15px] font-bold text-[var(--theme-text-secondary)] group-hover:text-[var(--theme-text-primary)] transition-colors">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="text-[12px] text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)] font-medium tracking-wide">
          &copy; 2026 COOLLAB AI. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* Right Side: Signup Form */}
      <div 
        className="shrink-0 flex items-center justify-center relative z-10"
        style={{ width: '50%', height: '100vh' }}
      >
        <div 
          className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[20px] shadow-lg shadow-[rgba(0,0,0,0.25)] overflow-y-auto max-h-[90vh] custom-scrollbar"
          style={{ 
            width: '460px', 
            minWidth: '460px', 
            height: 'auto', 
            boxSizing: 'border-box'
          }}
        >
          <div style={{ padding: '40px 48px', boxSizing: 'border-box' }} className="flex flex-col">
            <div className="mb-6">
               <Link to="/login" className="inline-flex items-center gap-1.5 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors text-[11px] font-black uppercase tracking-widest mb-6 group self-start">
                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                Back
              </Link>
              <h2 className="text-[28px] font-black text-[var(--theme-text-primary)] tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Join the future
              </h2>
              <p className="text-[var(--theme-text-secondary)] text-[15px] font-medium">Create your account to start building</p>
            </div>

            <button 
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 p-[12px] rounded-2xl bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border border-[var(--theme-border)] text-[var(--theme-text-primary)] font-bold text-[14px] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] transition-all mb-5 shadow-md relative"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="absolute left-4">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative flex items-center my-5">
              <div className="flex-1 h-px bg-[var(--theme-border)]" />
              <span className="px-4 text-[11px] font-black uppercase tracking-[0.15em] text-[color-mix(in_srgb,var(--theme-text-primary)_30%,transparent)]">or continue with email</span>
              <div className="flex-1 h-px bg-[var(--theme-border)]" />
            </div>

            <ErrorBanner error={error} />

            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <AuthInput label="Full Name" icon={User} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" required />
              <AuthInput label="Email Address" icon={Mail} value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" required />
              <div className="flex flex-col">
                <AuthInput label="Password" icon={Lock} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                <div className="mt-2">
                  <PasswordStrengthMeter password={password} />
                </div>
              </div>
              
              <label className="flex items-start gap-4 cursor-pointer group pt-2">
                <div className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${termsAgreed ? 'bg-[var(--theme-primary)] border-[var(--theme-primary)]' : 'bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,transparent)] border-[var(--theme-border)]'}`}>
                  <input type="checkbox" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)} className="hidden" />
                  {termsAgreed && <CheckCircle2 size={14} className="text-[var(--theme-on-primary)]" />}
                </div>
                <span className="text-[12px] text-[var(--theme-text-secondary)] leading-relaxed group-hover:text-[var(--theme-text-primary)] transition-colors">
                  I agree to the <span className="text-[var(--theme-text-primary)] font-bold">Terms of Service</span> and <span className="text-[var(--theme-text-primary)] font-bold">Privacy Policy</span>.
                </span>
              </label>

              <div className="pt-4">
                <AuthButton type="submit" loading={loading} disabled={!isFormValid}>
                  Create Free Account
                </AuthButton>
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-[13px] font-medium text-[var(--theme-text-secondary)]">
                Already have an account?{' '}
                <Link to="/login" className="text-[var(--theme-primary)] font-bold hover:text-[var(--theme-secondary)] transition-colors ml-1">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};