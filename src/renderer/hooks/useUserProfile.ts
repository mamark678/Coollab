import { useState, useEffect } from 'react';
import { FirebaseService } from '../services/firebase';
import { useAuth } from './useAuth';

export function useUserProfile(uid?: string) {
  const { state: { user } } = useAuth();
  const targetUid = uid || user?.uid;
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = FirebaseService.getInstance().listenToUserProfile(targetUid, (data) => {
        setProfile(data);
        setLoading(false);
      });
    } catch (err) {
      console.error('[useUserProfile] Failed to set up listener:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [targetUid]);

  return { profile, loading };
}
