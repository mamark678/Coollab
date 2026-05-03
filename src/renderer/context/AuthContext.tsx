import React, { createContext, useReducer, useEffect, useContext } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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

  useEffect(() => {
    const auth = FirebaseService.getInstance().auth;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          // CASE C fallback: If user is anonymous but NOT on a guest route, 
          // we treat them as unauthenticated to force redirect to login.
          if (user.isAnonymous) {
            const isGuestRoute = window.location.hash.includes('/share/') || 
                                 window.location.hash.includes('/guest/');
            if (!isGuestRoute) {
              dispatch({ type: 'SET_USER', payload: null });
              return;
            }
          }

          // Update profile in Firestore users collection for discovery
          const name = user.displayName || (user.isAnonymous ? 'Guest' : user.email?.split('@')[0]) || 'Unknown';
          FirebaseService.getInstance().saveUserProfile(user.uid, {
            name,
            email: user.email ?? null,
            photoURL: user.photoURL ?? null,
            updatedAt: Date.now()
          }).catch(e => console.error('[AuthContext] Profile save error:', e));

          dispatch({ type: 'SET_USER', payload: user });
        } else {
          // CASE B: User explicitly logged out OR has never logged in
          // CASE C: User is a guest via a shared project link
          
          const wasExplicitlyLoggedOut = sessionStorage.getItem('explicitly_logged_out') === 'true';
          const isGuestRoute = window.location.hash.includes('/share/') || 
                               window.location.hash.includes('/guest/');

          if (!wasExplicitlyLoggedOut && isGuestRoute) {
            try {
              // Auto-sign in anonymously ONLY if on a guest/share route
              await FirebaseService.getInstance().signInAnonymously();
            } catch (err) {
              console.error('[AuthContext] Anonymous sign-in error:', err);
              dispatch({ type: 'SET_USER', payload: null });
            }
          } else {
            dispatch({ type: 'SET_USER', payload: null });
          }
        }
      },
      (error) => {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    );

    return () => unsubscribe();
  }, []);

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
