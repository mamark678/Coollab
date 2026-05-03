import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackgroundOrbs } from './BackgroundOrbs';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: { user, loading } } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-[#0a0a0f] text-white">
        <BackgroundOrbs />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#94a3b8] text-sm font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
