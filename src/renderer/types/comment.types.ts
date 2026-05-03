export interface CommentReply {
  id?: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  createdAt: number;
}

export interface CommentItem {
  id?: string;
  type: 'inline' | 'general' | 'card';
  anchorText?: string;
  cardId?: string;
  content: string;
  mentions: string[];
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorPhoto?: string;
  createdAt: number;
  resolved: boolean;
  orphaned?: boolean;
  replies: CommentReply[];
}
