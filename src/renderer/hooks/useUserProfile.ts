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
    const unsub = FirebaseService.getInstance().listenToUserProfile(targetUid, (data) => {
      setProfile(data);
      setLoading(false);
    });

    return () => unsub();
  }, [targetUid]);

  return { profile, loading };
}
