import React from 'react';
import { Bell, MessageSquare, AtSign, CornerDownRight, Share2, History, Check } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAppStore } from '../../store/useAppStore';
import './Notifications.css';

export const NotificationsDropdown: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { setCurrentNoteId, setSidebarSelectionId, setActiveDocTitle } = useAppStore();

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare size={16} />;
      case 'mention': return <AtSign size={16} />;
      case 'reply': return <CornerDownRight size={16} />;
      case 'share': return <Share2 size={16} />;
      case 'version': return <History size={16} />;
      case 'resolve': return <Check size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.documentId) {
      setCurrentNoteId(notification.documentId);
      setSidebarSelectionId(notification.documentId);
      if (notification.documentTitle) {
        setActiveDocTitle(notification.documentTitle);
      }
    }
    setIsOpen(false);
  };

  const formatTime = (ts: number) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffInSeconds = (ts - Date.now()) / 1000;
    
    if (Math.abs(diffInSeconds) < 60) return 'Just now';
    if (Math.abs(diffInSeconds) < 3600) return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
    if (Math.abs(diffInSeconds) < 86400) return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
    return rtf.format(Math.floor(diffInSeconds / 86400), 'day');
  };

  return (
    <div className="notifications-wrapper" ref={dropdownRef}>
      <button 
        className="notifications-trigger app-top-bar__panel-btn" 
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{ position: 'relative' }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notifications-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notifications-empty">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`notification-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notification-user">
                    {n.fromUser.photo ? (
                      <img src={n.fromUser.photo} alt={n.fromUser.name} className="notification-user-avatar" />
                    ) : (
                      <div 
                        className="notification-user-initials" 
                        style={{ backgroundColor: n.fromUser.avatar || 'var(--theme-primary)' }}
                      >
                        {n.fromUser.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="notification-type-icon">
                      {getIcon(n.type)}
                    </div>
                  </div>
                  <div className="notification-content">
                    <div className="notification-message">{n.message}</div>
                    {n.preview && <div className="notification-preview">"{n.preview.substring(0, 50)}{n.preview.length > 50 ? '...' : ''}"</div>}
                    <div className="notification-time">{formatTime(n.createdAt)}</div>
                  </div>
                  {!n.read && <div className="notification-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
