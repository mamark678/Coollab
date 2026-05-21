import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { FirebaseService } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

interface BackgroundContextType {
  dashboardBackground: string | null;
  activeProjectBackground: string | null;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  setDashboardBackground: (base64: string | null) => Promise<void>;
  setProjectBackground: (projectId: string, base64: string | null) => Promise<void>;
  loading: boolean;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export const useBackground = () => {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
};

export const BackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: { user } } = useAuth();
  const [dashboardBackground, setDashboardBackgroundState] = useState<string | null>(null);
  const [activeProjectBackground, setActiveProjectBackground] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen to user profile for dashboard background
  useEffect(() => {
    if (!user) {
      setDashboardBackgroundState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = FirebaseService.getInstance().db;
    const userRef = doc(db, 'users', user.uid);

    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setDashboardBackgroundState(data.dashboardBackground ?? null);
      } else {
        setDashboardBackgroundState(null);
      }
      setLoading(false);
    }, (error) => {
      console.error('[BackgroundContext] Error listening to user profile:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // 2. Listen to active project background
  useEffect(() => {
    if (!activeProjectId) {
      setActiveProjectBackground(null);
      return;
    }

    const db = FirebaseService.getInstance().db;
    const noteRef = doc(db, 'notes', activeProjectId);

    const unsub = onSnapshot(noteRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setActiveProjectBackground(data.projectBackground ?? null);
      } else {
        setActiveProjectBackground(null);
      }
    }, (error) => {
      console.error('[BackgroundContext] Error listening to project:', error);
    });

    return () => unsub();
  }, [activeProjectId]);

  const setDashboardBackground = async (base64: string | null) => {
    if (!user) throw new Error('User not authenticated');
    
    // Safety guard size check (700KB)
    if (base64) {
      const base64SizeKB = (base64.length * 3) / 4 / 1024;
      if (base64SizeKB > 700) {
        throw new Error(`Image is too large (${base64SizeKB.toFixed(1)}KB). Maximum allowed size is 700KB.`);
      }
    }

    await FirebaseService.getInstance().saveDashboardBackground(user.uid, base64);
  };

  const setProjectBackground = async (projectId: string, base64: string | null) => {
    // Safety guard size check (700KB)
    if (base64) {
      const base64SizeKB = (base64.length * 3) / 4 / 1024;
      if (base64SizeKB > 700) {
        throw new Error(`Image is too large (${base64SizeKB.toFixed(1)}KB). Maximum allowed size is 700KB.`);
      }
    }

    await FirebaseService.getInstance().saveProjectBackground(projectId, base64);
  };

  return (
    <BackgroundContext.Provider
      value={{
        dashboardBackground,
        activeProjectBackground,
        activeProjectId,
        setActiveProjectId,
        setDashboardBackground,
        setProjectBackground,
        loading
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
};
