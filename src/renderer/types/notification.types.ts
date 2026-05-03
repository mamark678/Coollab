export interface NotificationItem {
  id?: string;
  type: 'comment' | 'mention' | 'reply' | 'share' | 'version' | 'resolve';
  fromUser: { uid: string; name: string; avatar?: string; photo?: string };
  projectId?: string;
  documentId?: string;
  documentTitle?: string;
  commentId?: string;
  message: string;
  preview?: string;
  read: boolean;
  createdAt: number;
}
