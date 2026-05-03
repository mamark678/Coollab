import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import './index.css'

import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PublicRoute } from './components/auth/PublicRoute'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ShareAcceptPage } from './pages/ShareAcceptPage'
import { GuestAppPage } from './pages/GuestAppPage'

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

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[main.tsx] #root element not found in index.html')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AuthProvider>
      <HashRouter>
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
      </HashRouter>
    </AuthProvider>
  </React.StrictMode>
)
