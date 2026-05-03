import React, { useCallback, useEffect, useState, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { MessageSquare, Check, Send, Eye, EyeOff, AtSign, Trash2 } from 'lucide-react';
import { FirebaseService } from '../../services/firebase';
import type { CommentItem } from '../../types/comment.types';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../hooks/useAuth';
import { useUserProfile } from '../../hooks/useUserProfile';
import { getUserAvatar } from '../../utils/avatar.utils';
import './CommentsPanel.css';

interface CommentsPanelProps {
  editor: Editor | null;
  username: string;
  userColor: string;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  editor,
  username,
  userColor,
}) => {
  const { currentNoteId, currentProjectId, projectMembers } = useAppStore();
  const { state: { user } } = useAuth();
  const { profile } = useUserProfile(user?.uid);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [showNewComment, setShowNewComment] = useState(false);
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null);
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);
  
  // Refs for scrolling
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState<number | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentNoteId) return;
    const firebase = FirebaseService.getInstance();
    const unsubscribe = firebase.listenToComments(currentNoteId, (items) => {
      setComments(items);
    });
    return () => unsubscribe();
  }, [currentNoteId]);

  useEffect(() => {
    const handleFocusComment = (e: any) => {
      const { commentId } = e.detail;
      setFocusedCommentId(commentId);
      
      // Scroll to the comment card
      setTimeout(() => {
        const element = document.getElementById(`comment-${commentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      // Remove focus after some time
      setTimeout(() => {
        setFocusedCommentId(null);
      }, 3000);
    };

    window.addEventListener('coollab-focus-comment', handleFocusComment);

    const handleActiveComments = async (e: any) => {
      if (!currentNoteId || comments.length === 0) return;
      const { commentIds } = e.detail;
      const activeIds = new Set(commentIds);
      
      const firebase = FirebaseService.getInstance();
      for (const comment of comments) {
        // Only check inline comments that aren't already marked orphaned
        if (comment.type === 'inline' && !comment.orphaned && !activeIds.has(comment.id!)) {
          console.log(`[CommentsPanel] Marking comment ${comment.id} as orphaned`);
          await firebase.updateComment(currentNoteId, comment.id!, { orphaned: true });
        }
      }
    };

    window.addEventListener('coollab-active-comments', handleActiveComments);

    return () => {
      window.removeEventListener('coollab-focus-comment', handleFocusComment);
      window.removeEventListener('coollab-active-comments', handleActiveComments);
    };
  }, [currentNoteId, comments]);

  const notifyMentionedUsers = async (text: string, commentId: string) => {
    if (!currentProjectId || !currentNoteId || !user) return;
    const firebase = FirebaseService.getInstance();
    const mentionRegex = /@(\w+)/g;
    let match;
    const mentionedNames: string[] = [];
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionedNames.push(match[1]);
    }
    
    for (const name of mentionedNames) {
      const member = projectMembers.find(m => m.name.toLowerCase() === name.toLowerCase());
      if (member && member.uid !== user.uid) {
        await firebase.createNotification(member.uid, {
          type: 'mention',
          fromUser: { 
            uid: user.uid, 
            name: username, 
            avatar: userColor,
            photo: getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) || undefined
          },
          projectId: currentProjectId || undefined,
          documentId: currentNoteId,
          commentId,
          message: `${username} mentioned you in a comment`,
          preview: text,
          read: false,
          createdAt: Date.now()
        });
      }
    }
  };

  const notifyDocumentEditors = async (text: string, commentId: string) => {
    if (!currentProjectId || !currentNoteId || !user) return;
    const firebase = FirebaseService.getInstance();
    for (const member of projectMembers) {
      if (member.uid !== user.uid && (member.role === 'Owner' || member.role === 'Can Edit')) {
        await firebase.createNotification(member.uid, {
          type: 'comment',
          fromUser: { 
            uid: user.uid, 
            name: username, 
            avatar: userColor,
            photo: getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) || undefined
          },
          projectId: currentProjectId || undefined,
          documentId: currentNoteId,
          commentId,
          message: `${username} commented on the document`,
          preview: text,
          read: false,
          createdAt: Date.now()
        });
      }
    }
  };

  const notifyReply = async (comment: CommentItem, replyText: string) => {
    if (!currentProjectId || !currentNoteId || !user) return;
    if (comment.authorId === user.uid) return;
    const firebase = FirebaseService.getInstance();
    await firebase.createNotification(comment.authorId, {
      type: 'reply',
      fromUser: { 
        uid: user.uid, 
        name: username, 
        avatar: userColor,
        photo: getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) || undefined
      },
      projectId: currentProjectId || undefined,
      documentId: currentNoteId,
      commentId: comment.id,
      message: `${username} replied to your comment`,
      preview: replyText,
      read: false,
      createdAt: Date.now()
    });
  };

  const addComment = useCallback(async () => {
    if (!newCommentText.trim() || !currentNoteId || !user) return;

    let anchorText = '';
    let type: 'inline' | 'general' = 'general';

    if (editor) {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        anchorText = editor.state.doc.textBetween(from, to, ' ');
        type = 'inline';
      }
    }

    const commentId = Math.random().toString(36).substr(2, 9);

    const comment: CommentItem = {
      type,
      anchorText,
      content: newCommentText.trim(),
      mentions: [],
      authorId: user.uid,
      authorName: username,
      authorAvatar: userColor,
      authorPhoto: getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) || undefined,
      createdAt: Date.now(),
      resolved: false,
      replies: []
    };

    try {
      const firebase = FirebaseService.getInstance();
      await firebase.createComment(currentNoteId, comment);

      // If inline, apply mark
      if (type === 'inline' && editor) {
        editor.chain().focus().setComment(commentId).run();
      }

      await notifyMentionedUsers(newCommentText, commentId);
      await notifyDocumentEditors(newCommentText, commentId);

      setNewCommentText('');
      setShowNewComment(false);
    } catch (err) {
      console.error('[CommentsPanel] Failed to add comment:', err);
      alert('Failed to save comment. Please check your internet connection and permissions.');
    }
  }, [editor, newCommentText, username, userColor, currentNoteId, user, projectMembers]);

  const resolveComment = useCallback((commentId: string) => {
    setConfirmResolveId(commentId);
  }, []);

  const confirmResolve = useCallback(async (comment: CommentItem) => {
    if (!currentNoteId || !comment.id) return;
    setConfirmResolveId(null);
    
    const firebase = FirebaseService.getInstance();
    await firebase.updateComment(currentNoteId, comment.id, { resolved: true });
    
    // Update Editor Mark
    if (editor) {
      // 1. Set to resolved status for CSS transition
      editor.commands.updateCommentStatus(comment.id, 'resolved');
      
      // 2. Wait for transition, then remove mark
      setTimeout(() => {
        editor.commands.removeCommentMark(comment.id!);
      }, 500);
    }
    
    if (user && comment.authorId !== user.uid) {
      await firebase.createNotification(comment.authorId, {
        type: 'resolve',
        fromUser: { 
          uid: user.uid, 
          name: username, 
          avatar: userColor,
          photo: getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) || undefined
        },
        projectId: currentProjectId || undefined,
        documentId: currentNoteId,
        commentId: comment.id,
        message: `${username} resolved your comment`,
        preview: comment.content,
        read: false,
        createdAt: Date.now()
      });
    }
  }, [currentNoteId, currentProjectId, user, username, userColor]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentNoteId) return;
    const firebase = FirebaseService.getInstance();
    await firebase.deleteComment(currentNoteId, commentId);
  }, [currentNoteId]);

  const addReply = useCallback(async (comment: CommentItem) => {
    if (!replyText.trim() || !currentNoteId || !user || !comment.id) return;
    
    const reply = {
      id: Math.random().toString(36).substr(2, 9),
      content: replyText.trim(),
      authorId: user.uid,
      authorName: username,
      authorPhoto: getUserAvatar({ ...profile, providerData: user?.providerData, photoURL: user?.photoURL }) || undefined,
      createdAt: Date.now()
    };

    const firebase = FirebaseService.getInstance();
    await firebase.updateComment(currentNoteId, comment.id, {
      replies: [...comment.replies, reply],
      resolved: false // Re-open on reply
    });

    // Update Editor Mark if it was resolved
    if (editor) {
      editor.commands.updateCommentStatus(comment.id, 'unread');
    }

    await notifyMentionedUsers(replyText, comment.id);
    await notifyReply(comment, replyText);

    setReplyText('');
    setReplyingTo(null);
  }, [replyText, username, user, currentNoteId, projectMembers]);

  const scrollToComment = useCallback(
    (commentId: string) => {
      if (!editor) return;
      const doc = editor.state.doc;
      let pos = -1;
      doc.descendants((node, nodePos) => {
        if (pos >= 0) return false;
        const marks = node.marks;
        for (const mark of marks) {
          if (mark.type.name === 'commentMark' && mark.attrs.commentId === commentId) {
            pos = nodePos;
            return false;
          }
        }
      });
      if (pos >= 0) {
        editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
      }
    },
    [editor]
  );

  const formatTime = (ts: number): string => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffInSeconds = (ts - Date.now()) / 1000;
    
    if (Math.abs(diffInSeconds) < 60) return 'Just now';
    if (Math.abs(diffInSeconds) < 3600) return rtf.format(Math.floor(diffInSeconds / 60), 'minute');
    if (Math.abs(diffInSeconds) < 86400) return rtf.format(Math.floor(diffInSeconds / 3600), 'hour');
    return new Date(ts).toLocaleDateString();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>, isReply: boolean) => {
    const text = e.target.value;
    if (isReply) setReplyText(text);
    else setNewCommentText(text);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = text.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1]);
      setCursorPos(cursorPos);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (memberName: string, isReply: boolean) => {
    const text = isReply ? replyText : newCommentText;
    if (cursorPos === null) return;

    const textBeforeCursor = text.substring(0, cursorPos);
    const textAfterCursor = text.substring(cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const newTextBeforeCursor = textBeforeCursor.substring(0, mentionMatch.index) + `@${memberName} `;
      const newText = newTextBeforeCursor + textAfterCursor;
      
      if (isReply) setReplyText(newText);
      else setNewCommentText(newText);
    }
    
    setShowMentions(false);
    
    // Refocus
    setTimeout(() => {
      if (isReply) replyInputRef.current?.focus();
      else textareaRef.current?.focus();
    }, 10);
  };

  const visibleComments = showResolved ? comments : comments.filter(c => !c.resolved);
  const filteredMembers = projectMembers.filter(m => m.name.toLowerCase().includes(mentionFilter.toLowerCase()));

  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="mention-highlight">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="comments-panel">
      <div className="comments-panel__header">
        <h3 className="comments-panel__title">
          <MessageSquare size={14} />
          Comments ({comments.filter((c) => !c.resolved).length})
        </h3>
        <button
          className="comments-panel__toggle-resolved"
          onClick={() => setShowResolved(!showResolved)}
          title={showResolved ? 'Hide Resolved' : 'Show Resolved'}
          type="button"
        >
          {showResolved ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <div className="comments-panel__new">
        <button
          className="comments-panel__add-btn"
          onClick={() => setShowNewComment(!showNewComment)}
          type="button"
        >
          + Add Comment
        </button>
        {showNewComment && (
          <div className="comments-panel__new-form">
            <div className="comments-panel__input-container">
              <textarea
                ref={textareaRef}
                value={newCommentText}
                onChange={(e) => handleTextChange(e, false)}
                placeholder="Write your comment… Use @ to mention"
                className="comments-panel__textarea"
                rows={3}
              />
              {showMentions && filteredMembers.length > 0 && (
                <div className="mentions-dropdown">
                  {filteredMembers.map((m, i) => (
                    <div 
                      key={m.uid} 
                      className={`mention-item ${i === mentionIndex ? 'active' : ''}`}
                      onClick={() => insertMention(m.name, false)}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="comments-panel__new-actions">
              <button
                className="comments-panel__submit"
                onClick={addComment}
                disabled={!newCommentText.trim()}
                type="button"
              >
                <Send size={12} /> Comment
              </button>
              <button
                className="comments-panel__cancel"
                onClick={() => {
                  setShowNewComment(false);
                  setNewCommentText('');
                  setShowMentions(false);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="comments-panel__list">
        {visibleComments.length === 0 && (
          <p className="comments-panel__empty">
            No comments yet.
          </p>
        )}
        {visibleComments.map((comment) => (
          <div
            key={comment.id}
            id={`comment-${comment.id}`}
            className={`comment-card ${comment.resolved ? 'comment-card--resolved' : ''} ${focusedCommentId === comment.id ? 'comment-card--focused' : ''}`}
            onClick={() => {
               if (comment.id && comment.type === 'inline') scrollToComment(comment.id)
            }}
          >
            <div className="comment-card__header">
              <div
                className="comment-card__avatar"
                style={{ backgroundColor: comment.authorAvatar || '#7c6bf0', overflow: 'hidden' }}
              >
                {comment.authorPhoto ? (
                  <img src={comment.authorPhoto} alt={comment.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  comment.authorName.substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="comment-card__meta">
                <span className="comment-card__author">{comment.authorName}</span>
                <span className="comment-card__time">{formatTime(comment.createdAt)}</span>
              </div>
              
              <div className="comment-card__actions">
                {user && comment.authorId === user.uid && (
                  <button
                    className="comment-card__action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (comment.id) deleteComment(comment.id);
                    }}
                    title="Delete"
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {!comment.resolved && (
                  <button
                    className="comment-card__action-btn"
                    onClick={(e) => { e.stopPropagation(); setConfirmResolveId(comment.id!); }}
                    title="Resolve"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Confirmation Popover */}
            {confirmResolveId === comment.id && (
              <div className="comment-resolve-confirm">
                <p>Are you sure this comment has been resolved?</p>
                <div className="comment-resolve-confirm__actions">
                  <button 
                    className="comment-resolve-confirm__yes"
                    onClick={(e) => { e.stopPropagation(); confirmResolve(comment); }}
                  >
                    Yes, Resolve
                  </button>
                  <button 
                    className="comment-resolve-confirm__no"
                    onClick={(e) => { e.stopPropagation(); setConfirmResolveId(null); }}
                  >
                    No
                  </button>
                </div>
              </div>
            )}

            {comment.type === 'inline' && comment.anchorText && (
              <div className="comment-card__anchor">
                "{comment.anchorText}"
              </div>
            )}
            
            <p className="comment-card__text">{renderTextWithMentions(comment.content)}</p>
            {comment.resolved && (
              <span className="comment-card__resolved-badge">Resolved</span>
            )}
            {comment.orphaned && (
              <span className="comment-card__orphaned-badge">Orphaned (Text Deleted)</span>
            )}

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="comment-card__replies">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="comment-reply">
                    <div className="comment-reply__header">
                      {reply.authorPhoto ? (
                        <img src={reply.authorPhoto} alt={reply.authorName} className="comment-reply__avatar" />
                      ) : (
                        <div className="comment-reply__initials">{reply.authorName.substring(0, 2).toUpperCase()}</div>
                      )}
                      <span className="comment-reply__author">{reply.authorName}</span>
                      <span className="comment-reply__time">
                        {formatTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="comment-reply__text">{renderTextWithMentions(reply.content)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {!comment.resolved && (
              <>
                {replyingTo === comment.id ? (
                  <div className="comment-card__reply-form">
                    <div className="reply-input-wrapper">
                      <input
                        ref={replyInputRef}
                        type="text"
                        value={replyText}
                        onChange={(e) => handleTextChange(e, true)}
                        placeholder="Reply… Use @ to mention"
                        className="comment-card__reply-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addReply(comment);
                          if (e.key === 'Escape') {
                            setReplyingTo(null);
                            setReplyText('');
                            setShowMentions(false);
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                      {showMentions && replyingTo === comment.id && filteredMembers.length > 0 && (
                        <div className="mentions-dropdown reply-mentions">
                          {filteredMembers.map((m, i) => (
                            <div 
                              key={m.uid} 
                              className={`mention-item ${i === mentionIndex ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                insertMention(m.name, true);
                              }}
                            >
                              {m.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="comment-card__reply-send"
                      onClick={(e) => {
                        e.stopPropagation();
                        addReply(comment);
                      }}
                      type="button"
                    >
                      <Send size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="comment-card__reply-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReplyingTo(comment.id || null);
                    }}
                    type="button"
                  >
                    Reply
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
