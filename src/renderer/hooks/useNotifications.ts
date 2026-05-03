import { useState, useEffect, useCallback } from 'react';
import { FirebaseService } from '../services/firebase';
import type { NotificationItem } from '../types/notification.types';
import { useAuth } from './useAuth';

export function useNotifications() {
  const { state: { user } } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const firebase = FirebaseService.getInstance();
    const unsubscribe = firebase.listenToNotifications(user.uid, (items) => {
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.uid) return;
    const firebase = FirebaseService.getInstance();
    await firebase.markNotificationRead(user.uid, notificationId);
  }, [user?.uid]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.uid || notifications.length === 0) return;
    const firebase = FirebaseService.getInstance();
    await firebase.markAllNotificationsRead(user.uid, notifications);
  }, [user?.uid, notifications]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
