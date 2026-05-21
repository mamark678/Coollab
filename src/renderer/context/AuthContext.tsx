import React, { createContext, useReducer, useEffect, useContext, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { AuthState, AuthAction, AuthContextType } from '../types/auth.types';
import { FirebaseService } from '../services/firebase';
import { useAppStore } from '../store/useAppStore';

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const authStateCallback = useCallback(async (user: any) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    if (user) {
      if (user.isAnonymous) {
        const isGuestRoute = window.location.hash.includes('/share/') || 
                             window.location.hash.includes('/guest/');
        if (!isGuestRoute) {
          dispatch({ type: 'SET_USER', payload: null });
          return;
        }
      }

      const name = user.displayName || (user.isAnonymous ? 'Guest' : user.email?.split('@')[0]) || 'Unknown';
      
      // Fetch user profile to get role
      const firebase = FirebaseService.getInstance();
      const userRef = doc(firebase.db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const profileData = userSnap.exists() ? userSnap.data() : null;
      
      if (profileData?.role) {
        useAppStore.getState().setUserRole(profileData.role);
      } else {
        useAppStore.getState().setUserRole(null);
      }

      firebase.saveUserProfile(user.uid, {
        name,
        email: user.email ?? null,
        photoURL: user.photoURL ?? null,
        updatedAt: Date.now()
      }).catch(e => console.error('[AuthContext] Profile save error:', e));

      dispatch({ type: 'SET_USER', payload: user });
    } else {
      const wasExplicitlyLoggedOut = sessionStorage.getItem('explicitly_logged_out') === 'true';
      const isGuestRoute = window.location.hash.includes('/share/') || 
                           window.location.hash.includes('/guest/');

      if (!wasExplicitlyLoggedOut && isGuestRoute) {
        try {
          await FirebaseService.getInstance().signInAnonymously();
        } catch (err) {
          console.error('[AuthContext] Anonymous sign-in error:', err);
          dispatch({ type: 'SET_USER', payload: null });
        }
      } else {
        dispatch({ type: 'SET_USER', payload: null });
      }
    }
  }, []);

  useEffect(() => {
    const auth = FirebaseService.getInstance().auth;
    const unsubscribe = onAuthStateChanged(
      auth,
      authStateCallback,
      (error) => {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    );

    return () => unsubscribe();
  }, [authStateCallback]);

  const logout = async () => {
    try {
      const auth = FirebaseService.getInstance().auth;
      await signOut(auth);
      
      // Reset Zustand store (Section 5)
      useAppStore.getState().reset();
      
      // Clear Yjs IndexedDB (Section 5)
      const dbs = await window.indexedDB.databases();
      dbs.forEach(db => {
        if (db.name && (db.name.includes('y-indexeddb') || db.name.includes('collab-notes') || db.name.includes('coollab'))) {
          window.indexedDB.deleteDatabase(db.name);
        }
      });
      
      sessionStorage.clear();
      sessionStorage.setItem('explicitly_logged_out', 'true');
      
      // Navigate to login with replace: true (Section 5)
      window.location.hash = '#/login';
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    }
  };

  const contextValue: AuthContextType = { state, dispatch, logout };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
