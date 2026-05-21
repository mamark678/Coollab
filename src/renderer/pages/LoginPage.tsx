import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithRedirect,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, GraduationCap, Shield, Zap, ArrowLeft, Mail, Lock } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ErrorBanner } from '../components/auth/ErrorBanner';
import { AuthButton } from '../components/auth/AuthButton';
import { AuthInput } from '../components/auth/AuthInput';
import { FirebaseService } from '../services/firebase';
import { mapAuthError } from '../utils/auth.helpers';
import { useAppStore } from '../store/useAppStore';

const AVATARS = [
  { color: 'var(--theme-primary)', letter: 'A' },
  { color: 'var(--theme-secondary)', letter: 'S' },
  { color: 'var(--theme-success)', letter: 'D' },
  { color: 'var(--theme-text-secondary)', letter: 'M' },
];

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  loading?: boolean;
}

const RoleCard: React.FC<RoleCardProps> = ({ title, description, icon: Icon, onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full group relative flex items-center gap-5 p-[16px_20px] rounded-[12px] bg-[var(--theme-surface)] border border-[var(--theme-border)] hover:bg-[color-mix(in_srgb,var(--theme-text-primary)_5%,var(--theme-surface))] hover:border-l-[3px] hover:border-l-[var(--theme-primary)] transition-all duration-200 text-left"
  >
    <div className="w-11 h-11 shrink-0 rounded-xl bg-[color-mix(in_srgb,var(--theme-primary)_15%,transparent)] flex items-center justify-center text-[var(--theme-primary)] group-hover:bg-[var(--theme-primary)] group-hover:text-[var(--theme-on-primary)] transition-all duration-200">
      <Icon size={22} />
    </div>
    <div className="flex-1 pr-2">
      <h3 className="text-[15px] font-bold text-[var(--theme-text-primary)] mb-0.5 transition-colors">{title}</h3>
      <p className="text-[12px] text-[var(--theme-text-secondary)] leading-relaxed">{description}</p>
    </div>
    <ChevronRight size={18} className="text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)] group-hover:text-[var(--theme-text-primary)] transition-all" />
  </button>
);

export const LoginPage: React.FC = () => {
  const [step, setStep] = useState<'role' | 'login'>('role');
  const [selectedRole, setSelectedRole] = useState<'instructor' | 'student' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { pendingRole, setPendingRole } = useAppStore();

  useEffect(() => {
    sessionStorage.removeItem('explicitly_logged_out');
    const isMobile = Capacitor.isNativePlatform();
    const electronAPI = window.electronAPI;

    if (!isMobile && !electronAPI) {
      (async () => {
        try {
          const auth = FirebaseService.getInstance().auth;
          const result = await getRedirectResult(auth);
          if (result) {
            await handleSuccessfulAuth(result.user);
          }
        } catch (err: any) {
          setError(mapAuthError(err));
        }
      })();
    }

    if (!electronAPI) return;
    const cleanup = electronAPI.on('auth:google-result', async (_event: any, { idToken, accessToken, error: oauthError }: any) => {
      if (oauthError) { setError(oauthError); setLoading(false); return; }
      if (idToken || accessToken) {
        try {
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          const auth = FirebaseService.getInstance().auth;
          const result = await signInWithCredential(auth, credential);
          await handleSuccessfulAuth(result.user);
        } catch (err: any) {
          setError(mapAuthError(err));
        } finally {
          setLoading(false);
        }
      }
    });
    return () => cleanup();
  }, [navigate]);

  const handleSuccessfulAuth = async (user: any) => {
    const firebase = FirebaseService.getInstance();
    setLoading(true);
    
    try {
      // 1. Ensure user profile exists (or update basic info)
      await firebase.handleGoogleSignInResult(user);
      
      // 2. Fetch the latest profile to check the role
      const profile = await firebase.getUserProfile(user.uid);
      const storedRole = profile?.role?.toLowerCase().trim();
      
      // Retrieve selected role from Zustand store (normalize for comparison)
      const selectedRoleStr = (selectedRole || pendingRole)?.toLowerCase().trim();
      
      if (!storedRole) {
        // Case: New user or legacy account with no role yet set -> Persist selected role
        if (selectedRoleStr) {
          await firebase.saveUserProfile(user.uid, { role: selectedRoleStr });
        }
        setPendingRole(null);
        navigate('/');
      } else {
        // Case: Existing user -> Validate against selected role if one was picked
        if (selectedRoleStr && storedRole !== selectedRoleStr) {
          const roleName = storedRole === 'student' ? 'Student' : 'Instructor';
          setError(`This account is registered as a ${roleName}. Please go back and select ${roleName} Access.`);
          
          // Sign out to prevent partial session access
          await firebase.auth.signOut();
          setLoading(false);
          return;
        }
        
        // Success
        setPendingRole(null);
        navigate('/');
      }
    } catch (err: any) {
      setError(mapAuthError(err));
      setLoading(false);
    }
  };

  const onRoleCardClick = (role: 'student' | 'instructor') => {
    setSelectedRole(role);
    setPendingRole(role);
    setStep('login');
  };

  const handleGoogleLogin = async () => {
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
        await handleSuccessfulAuth(uc.user);
      } catch (err: any) {
        setError(`${err.code || 'Error'} — ${err.message}`);
        setLoading(false);
      }
    } else {
      const electronAPI = window.electronAPI;
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const auth = FirebaseService.getInstance().auth;
      const result = await signInWithEmailAndPassword(auth, email, password);
      await handleSuccessfulAuth(result.user);
    } catch (err: any) {
      setError(mapAuthError(err));
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
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
            Design.<br />
            Collaborate.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-secondary)]">Master UI.</span>
          </h1>
          <p className="text-[18px] text-[var(--theme-text-secondary)] leading-relaxed max-w-[480px] mb-12">
            The world's first AI-powered instructional design platform for higher education. 
            Build better learning experiences, faster.
          </p>

          <div className="flex items-center gap-5">
            <div className="flex -space-x-3">
              {AVATARS.map((a, i) => (
                <div key={i} className="w-11 h-11 rounded-full border-[3px] border-[var(--theme-background)] flex items-center justify-center text-[14px] font-extrabold text-[var(--theme-on-primary)]" style={{ backgroundColor: a.color, zIndex: AVATARS.length - i }}>
                  {a.letter}
                </div>
              ))}
            </div>
            <div className="h-8 w-px bg-[var(--theme-border)]" />
            <p className="text-[15px] text-[var(--theme-text-secondary)]">
              <span className="text-[var(--theme-text-primary)] font-bold">50k+</span> educators and students<br />
              already building together.
            </p>
          </div>
        </div>
        
        <div className="text-[12px] text-[color-mix(in_srgb,var(--theme-text-primary)_20%,transparent)] font-medium tracking-wide">
          &copy; 2026 COOLLAB AI. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* Right Side: Auth Container */}
      <div 
        className="shrink-0 flex items-center justify-center relative z-10"
        style={{ width: '50%', height: '100vh' }}
      >
        <div 
          className="bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-[20px] shadow-lg shadow-[rgba(0,0,0,0.25)]"
          style={{ 
            width: '460px', 
            minWidth: '460px', 
            height: 'auto', 
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          <AnimatePresence mode="wait">
            {step === 'role' ? (
              <motion.div
                key="role-selection"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                style={{ padding: '40px 48px', boxSizing: 'border-box' }}
                className="flex flex-col"
              >
                <div className="text-center mb-10">
                  <h2 className="text-[28px] font-black text-[var(--theme-text-primary)] tracking-tight mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Welcome back
                  </h2>
                  <p className="text-[var(--theme-text-secondary)] text-[15px] font-medium">Choose your perspective to continue</p>
                </div>

                <ErrorBanner error={error} />

                <div className="flex flex-col gap-4">
                  <RoleCard 
                    title="Instructor Access"
                    description="Build activity sets and manage your class with AI assistance"
                    icon={Shield}
                    onClick={() => onRoleCardClick('instructor')}
                    loading={loading}
                  />
                  <RoleCard 
                    title="Student Access"
                    description="Explore modules, earn XP, and master UI through interactive play"
                    icon={GraduationCap}
                    onClick={() => onRoleCardClick('student')}
                    loading={loading}
                  />
                </div>

                <div className="mt-5 pt-5 text-center">
                  <p className="text-[11px] text-[color-mix(in_srgb,var(--theme-text-primary)_30%,transparent)] uppercase font-black tracking-[0.25em]">
                    Single Sign-On (SSO) powered by AcademicID
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                style={{ padding: '40px 48px', boxSizing: 'border-box' }}
                className="flex flex-col"
              >
                <button 
                  onClick={() => setStep('role')}
                  className="flex items-center gap-1.5 text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] transition-colors text-[11px] font-black uppercase tracking-widest mb-6 self-start group"
                >
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  Back
                </button>

                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_20%,transparent)] border border-[color-mix(in_srgb,var(--theme-primary)_30%,transparent)] mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--theme-secondary)]" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-[var(--theme-secondary)]">
                      Signing in as {selectedRole}
                    </span>
                  </div>
                  <h2 className="text-[28px] font-black text-[var(--theme-text-primary)] tracking-tight mb-0" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    Sign in to Coollab
                  </h2>
                </div>

                <ErrorBanner error={error} />

                {/* Google Login */}
                <button 
                  onClick={handleGoogleLogin}
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

                {/* Divider */}
                <div className="relative flex items-center my-5">
                  <div className="flex-1 h-px bg-[var(--theme-border)]" />
                  <span className="px-4 text-[11px] font-black uppercase tracking-[0.15em] text-[color-mix(in_srgb,var(--theme-text-primary)_30%,transparent)]">or continue with email</span>
                  <div className="flex-1 h-px bg-[var(--theme-border)]" />
                </div>

                {/* Email Form */}
                <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
                  <AuthInput 
                    label="Email address"
                    type="email"
                    placeholder="Email address"
                    icon={Mail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  
                  <div className="flex flex-col">
                    <AuthInput 
                      label="Password"
                      type="password"
                      placeholder="Password"
                      icon={Lock}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <div className="flex justify-end mt-2">
                      <Link to="/forgot-password" className="text-[12px] font-bold text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4">
                    <AuthButton type="submit" loading={loading}>
                      Sign In
                    </AuthButton>
                  </div>
                </form>

                {/* Footer */}
                <div className="mt-5 text-center">
                  <p className="text-[13px] font-medium text-[var(--theme-text-secondary)]">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-[var(--theme-primary)] font-bold hover:text-[var(--theme-secondary)] transition-colors ml-1">
                      Sign up
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};