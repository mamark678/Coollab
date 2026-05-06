import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import './index.css'

import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PublicRoute } from './components/auth/PublicRoute'
import { NotificationProvider } from './context/NotificationContext'

const App = React.lazy(() => import('./App'));
const LoginPage = React.lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = React.lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ShareAcceptPage = React.lazy(() => import('./pages/ShareAcceptPage').then(m => ({ default: m.ShareAcceptPage })));
const GuestAppPage = React.lazy(() => import('./pages/GuestAppPage').then(m => ({ default: m.GuestAppPage })));

const PageLoader = () => (
  <div className="w-full h-screen flex items-center justify-center bg-[#0b0b12]">
    <div className="w-10 h-10 border-4 border-white/10 border-t-[#7c6bf0] rounded-full animate-spin"></div>
  </div>
);


// Hack to fix Electron bug on Windows where native dialogs (confirm) steal keyboard focus
const originalConfirm = window.confirm;
window.confirm = function(message?: string): boolean {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const result = originalConfirm.call(window, message);
  setTimeout(() => {
    if (window.electronAPI) {
      window.electronAPI.send('window:focus');
    }
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    } else {
      document.body.focus();
    }
  }, 100);
  return result;
};

const isMobile = window.location.protocol !== 'electron:' && !(window as any).electronAPI;
const AppWrapper = isMobile ? React.Fragment : React.StrictMode;

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[main.tsx] #root element not found in index.html')
}

ReactDOM.createRoot(rootEl).render(
  <AppWrapper>
    <AuthProvider>
      <NotificationProvider>
        <HashRouter>
          <React.Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
              
              {/* Share link acceptance — requires auth or guest */}
              <Route path="/share/:token" element={<ShareAcceptPage />} />
  
              {/* Guest view for unauthenticated access */}
              <Route path="/guest/:projectId" element={<GuestAppPage />} />
  
              {/* Main Application - Protected Route */}
              <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>} />
            </Routes>
          </React.Suspense>
        </HashRouter>
      </NotificationProvider>
    </AuthProvider>
  </AppWrapper>
)
