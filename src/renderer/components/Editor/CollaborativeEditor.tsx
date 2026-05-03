import type { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import SubscriptExt from '@tiptap/extension-subscript';
import SuperscriptExt from '@tiptap/extension-superscript';
import TableExt from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useCallback, useEffect, useRef, useState } from 'react'; // ← useRef added here
import type { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { CommentMark } from '../../extensions/CommentMark';
import { FontSize } from '../../extensions/FontSize';
import { ResizableImage } from '../../extensions/ResizableImage/ResizableImageNode.tsx';
import { Tag } from '../../extensions/Tag';
import { WikiLink } from '../../extensions/WikiLink';
import { FirebaseService } from '../../services/firebase';
import { SyncService } from '../../services/sync';
import { YjsService } from '../../services/yjs';

import './ContinuousEditor.css';

export interface CollaborativeEditorProps {
  roomName: string;
  projectId?: string | null;
  username: string;
  userId?: string;
  color: string;
  onContentUpdate?: (text: string) => void;
  readOnly?: boolean;
  title?: string;
  onTitleChange?: (title: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared TipTap extension set
// ─────────────────────────────────────────────────────────────────────────────
function getBaseExtensions() {
  return [
    StarterKit.configure({
      history: false,
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontFamily,
    FontSize,
    SubscriptExt,
    SuperscriptExt,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    LinkExt.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class: 'editor-link',
        rel: 'noopener noreferrer',
      },
    }),
    ResizableImage.configure({ inline: false, allowBase64: true }),
    TableExt.configure({ resizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableCell,
    TableHeader,
    CommentMark,
    WikiLink.configure({
      onNavigate: (docId: string) => {
        window.dispatchEvent(
          new CustomEvent('coollab-navigate', { detail: { docId } })
        );
      },
      onSearch: async () => [],
      onCreate: (title: string) => {
        window.dispatchEvent(
          new CustomEvent('coollab-create-doc', { detail: { title } })
        );
      },
    }),
    Tag.configure({
      onTagClick: (tag: string) => {
        console.log('[Tag] Clicked:', tag);
      },
    }),
  ];
}

interface ContinuousEditorInnerProps {
  provider: WebrtcProvider;
  username: string;
  userId?: string;
  color: string;
  title?: string;
  noteId?: string;
  onTitleChange?: (title: string) => void;
  onContentUpdate?: (text: string) => void;
  onEditorReady?: (editor: Editor) => void;
  readOnly?: boolean;
}

const ContinuousEditorInner: React.FC<ContinuousEditorInnerProps> = ({
  provider,
  username,
  userId,
  color,
  title = '',
  noteId,
  onTitleChange,
  onContentUpdate,
  onEditorReady,
  readOnly = false,
}) => {
  const yjsService = YjsService.getInstance();
  const yjsDoc = yjsService.getDoc();
  const sharedTitle = yjsDoc.getText('title');

  // ← FIXED: bridgeClocksRef is now at the top of the component, not inside useEffect
  const bridgeClocksRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const handleYTitleUpdate = (event: any) => {
      if (event.transaction.origin === 'title-sync') return;
      const currentYTitle = sharedTitle.toString();
      if (currentYTitle !== title && currentYTitle.length > 0) {
        onTitleChange?.(currentYTitle);
      }
    };

    sharedTitle.observe(handleYTitleUpdate);

    const currentY = sharedTitle.toString();
    if (currentY && !title) {
      onTitleChange?.(currentY);
    }

    return () => sharedTitle.unobserve(handleYTitleUpdate);
  }, [sharedTitle, onTitleChange]);

  useEffect(() => {
    const currentY = sharedTitle.toString();
    if (title !== undefined && title !== currentY) {
      yjsDoc.transact(() => {
        if (sharedTitle.length > 0) {
          sharedTitle.delete(0, sharedTitle.length);
        }
        sharedTitle.insert(0, title);
      }, 'title-sync');
    }
  }, [title, sharedTitle, yjsDoc]);

  const handleTitleChangeLocal = (newTitle: string) => {
    onTitleChange?.(newTitle);
  };

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      ...getBaseExtensions(),
      Collaboration.configure({
        document: yjsDoc,
        field: 'coollab-page-0',
      }),
      CollaborationCursor.configure({
        provider,
        user: { id: userId, name: username, color },
        render(user) {
          const cursor = document.createElement('span');
          cursor.classList.add('collaboration-cursor__caret');
          cursor.setAttribute('style', `border-color: ${user.color}`);

          const label = document.createElement('div');
          label.classList.add('collaboration-cursor__label');
          label.setAttribute('style', `background-color: ${user.color}`);
          label.textContent = user.name;

          cursor.appendChild(label);
          return cursor;
        },
      }),
      Placeholder.configure({ placeholder: 'Start typing, or press / for commands…' }),
    ],
    editorProps: {
      attributes: {
        class: 'coollab-continuous-editor',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      if (onContentUpdate) {
        onContentUpdate(editor.getText());
      }

      const currentCommentIds = new Set<string>();
      editor.state.doc.descendants((node) => {
        node.marks.forEach(mark => {
          if (mark.type.name === 'commentMark') {
            currentCommentIds.add(mark.attrs.commentId);
          }
        });
      });

      window.dispatchEvent(new CustomEvent('coollab-active-comments', {
        detail: { commentIds: Array.from(currentCommentIds) }
      }));

      const text = editor.getText();
      const wikiLinkRegex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = wikiLinkRegex.exec(text)) !== null) {
        const linkedDocTitle = match[1].trim();
        if (linkedDocTitle) {
          window.dispatchEvent(new CustomEvent('workspace-action', {
            detail: {
              type: 'graph_link_created',
              source: title,
              target: linkedDocTitle
            }
          }));
        }
      }
    },
  });

  // ── Auto-save Version Logic ──────────────────────────────────────────────
  useEffect(() => {
    if (!editor || !noteId || readOnly || !userId) return;

    let lastSavedContent = editor.getHTML();

    const saveVersion = async (label: string) => {
      const currentContent = editor.getHTML();
      if (currentContent === lastSavedContent) return;

      const firebase = FirebaseService.getInstance();

      const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
      const q = query(collection(firebase.db, `notes/${noteId}/versions`), orderBy('savedAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      const nextNumber = snap.empty ? 1 : (snap.docs[0].data().versionNumber || 0) + 1;

      await firebase.saveVersion(noteId, {
        content: currentContent,
        savedBy: { uid: userId, name: username },
        savedAt: Date.now(),
        label,
        versionNumber: nextNumber
      });

      lastSavedContent = currentContent;
    };

    const interval = setInterval(() => {
      saveVersion(`Auto-save ${new Date().toLocaleString()}`);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      saveVersion(`Auto-save on leave ${new Date().toLocaleString()}`);
    };
  }, [editor, noteId, readOnly, userId, username]);

  // ── Remote Cursor Sync (Firestore -> Awareness Bridge) ────────────────
  useEffect(() => {
    if (!provider || !noteId) return;

    const firebase = FirebaseService.getInstance();
    const unsubscribe = firebase.listenToPresence(noteId, (users) => {
      const now = Date.now();
      const awareness = provider.awareness;
      const currentAwarenessStates = awareness.getStates();

      const added: number[] = [];
      const updated: number[] = [];
      const removed: number[] = [];

      const activeBridgeClientIDs = new Set<number>();

      users.forEach(u => {
        // Only bridge Flutter users — Electron users use native WebRTC awareness
        if (u.platform !== 'flutter') return;

        // Skip self
        if (u.uid === userId) return;
        console.log('[Bridge] Flutter user data:', JSON.stringify(u));
        console.log('[Bridge] cursorIndex:', u.cursorIndex, 'selectionBase:', u.selectionBase, 'selectionExtent:', u.selectionExtent);
        // Skip stale users
        const lastSeenMs = (u.lastSeen && typeof u.lastSeen === 'object' && 'seconds' in u.lastSeen)
          ? u.lastSeen.seconds * 1000
          : (typeof u.lastSeen === 'number' ? u.lastSeen : 0);

        if ((now - lastSeenMs) > 60000) return;

        const clientID = hashString(u.uid);
        activeBridgeClientIDs.add(clientID);

        if (u.cursorIndex !== undefined) {
          const currentClock = (bridgeClocksRef.current.get(clientID) ?? 0) + 1;
          bridgeClocksRef.current.set(clientID, currentClock);

          const fragment = yjsDoc.getXmlFragment('coollab-page-0');

          // XmlFragment index 0 is the only valid anchor when fragment has 1 item
          // We store the raw character offset in the state and let the cursor
          // render via a custom render function instead of relative positions
          const newState = {
            clock: currentClock,
            user: {
              name: u.name || 'Collaborator',
              color: u.color || '#7c6bf0',
              id: u.uid,
            },
            // Don't use relative positions — store absolute index directly
            cursor: null,
            anchor: null,
            head: null,
            // Custom fields for our bridge renderer
            cursorIndex: u.cursorIndex,
            selectionBase: u.selectionBase ?? u.cursorIndex,
            selectionExtent: u.selectionExtent ?? u.cursorIndex,
            lastUpdated: now,
          };

          const oldState = currentAwarenessStates.get(clientID);
          awareness.states.set(clientID, newState);

          if (!oldState) {
            added.push(clientID);
          } else {
            updated.push(clientID);
          }
        }
      });

      // Cleanup offline bridged users
      currentAwarenessStates.forEach((state: any, clientID) => {
        if (state?.user?.id && !activeBridgeClientIDs.has(clientID)) {
          if (state.lastUpdated) {
            awareness.states.delete(clientID);
            removed.push(clientID);
          }
        }
      });

      if (added.length > 0 || updated.length > 0 || removed.length > 0) {
        awareness.emit('change', [{ added, updated, removed }, 'local']);
      }
    });

    return () => unsubscribe();
  }, [provider, noteId, userId]);

  // ── Awareness -> Firestore Bridge (Electron -> Flutter) ────────────────
  useEffect(() => {
    if (!provider || !noteId || !userId) return;

    const awareness = provider.awareness;
    const firebase = FirebaseService.getInstance();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPosKey = '';

    const handleAwarenessChange = () => {
      const localState = awareness.getLocalState();
      const anchor = localState?.cursor?.anchor ?? localState?.anchor;
      const head = localState?.cursor?.head ?? localState?.head;

      if (!anchor || !head) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const yjsDoc = YjsService.getInstance().getDoc();

        const anchorAbs = Y.createAbsolutePositionFromRelativePosition(anchor, yjsDoc);
        const headAbs = Y.createAbsolutePositionFromRelativePosition(head, yjsDoc);

        if (anchorAbs === null || headAbs === null) return;

        const posKey = `${anchorAbs.index}-${headAbs.index}`;
        if (lastPosKey === posKey) return;
        lastPosKey = posKey;

        firebase.updatePresence(noteId, userId, {
          cursorIndex: headAbs.index,
          selectionBase: anchorAbs.index,
          selectionExtent: headAbs.index,
          platform: 'electron',
        });
      }, 2000);
    };

    awareness.on('change', handleAwarenessChange);

    return () => {
      awareness.off('change', handleAwarenessChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [provider, noteId, userId]);

  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // ── Flutter Cursor Overlay (DOM-based, bypasses CollaborationCursor) ────
  useEffect(() => {
    if (!editor || !provider) return;

    const awareness = provider.awareness;
    const overlayId = 'flutter-cursor-overlay';

    const getOrCreateOverlay = () => {
      let overlay = document.getElementById(overlayId);
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:10;';
        const editorEl = document.querySelector('.coollab-continuous-editor');
        if (editorEl?.parentElement) {
          editorEl.parentElement.style.position = 'relative';
          editorEl.parentElement.appendChild(overlay);
        }
      }
      return overlay;
    };

    const renderFlutterCursors = () => {
      const overlay = getOrCreateOverlay();
      if (!overlay) return;

      overlay.innerHTML = '';

      const view = editor.view;
      if (!view || !view.dom) return;

      awareness.getStates().forEach((state: any) => {
        if (!state?.user || state.cursorIndex === undefined) return;
        if (state.anchor !== null || state.head !== null) return; // skip native Yjs cursors

        const index = state.cursorIndex as number;
        const userName = state.user.name as string;
        const userColor = state.user.color as string || '#7c6bf0';

        try {
          const docLength = view.state.doc.content.size;
          const safeIndex = Math.min(index, docLength - 1);
          if (safeIndex < 0) return;

          const coords = view.coordsAtPos(safeIndex);
          const editorRect = view.dom.getBoundingClientRect();
          const overlayRect = overlay.getBoundingClientRect();

          const x = coords.left - overlayRect.left;
          const y = coords.top - overlayRect.top;
          const height = coords.bottom - coords.top;

          // Cursor line
          const cursorEl = document.createElement('div');
          cursorEl.style.cssText = `
          position:absolute;
          left:${x}px;
          top:${y}px;
          width:2px;
          height:${height || 20}px;
          background:${userColor};
          pointer-events:none;
        `;

          // Name label
          const labelEl = document.createElement('div');
          labelEl.textContent = userName;
          labelEl.style.cssText = `
          position:absolute;
          left:${x}px;
          top:${y - 20}px;
          background:${userColor};
          color:white;
          font-size:10px;
          font-weight:600;
          padding:1px 6px;
          border-radius:4px 4px 4px 0;
          white-space:nowrap;
          pointer-events:none;
          font-family:Inter,-apple-system,sans-serif;
        `;

          overlay.appendChild(cursorEl);
          overlay.appendChild(labelEl);
        } catch (e) {
          // Position out of bounds — skip silently
        }
      });
    };

    const handleAwarenessChange = () => renderFlutterCursors();
    awareness.on('change', handleAwarenessChange);

    // Also re-render on editor updates (document changes shift cursor positions)
    editor.on('update', renderFlutterCursors);

    return () => {
      awareness.off('change', handleAwarenessChange);
      editor.off('update', renderFlutterCursors);
      const overlay = document.getElementById(overlayId);
      overlay?.remove();
    };
  }, [editor, provider]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return <div className="editor-loading">Preparing document…</div>;
  }

  return (
    <div className="continuous-editor-wrapper">
      <div className="continuous-editor-canvas">
        <textarea
          className="editor-title-input"
          placeholder="Untitled Document"
          value={title}
          disabled={readOnly}
          onChange={(e) => handleTitleChangeLocal(e.target.value)}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '32px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            padding: '20px 0 10px',
            resize: 'none',
            overflow: 'hidden',
            lineHeight: '1.2',
            marginBottom: '10px',
            fontFamily: 'inherit',
          }}
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  roomName,
  projectId,
  username,
  userId,
  color,
  onContentUpdate,
  onEditorReady,
  readOnly,
  title,
  onTitleChange
}) => {
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isKicked, setIsKicked] = useState(false);

  // ── Access Control Listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !userId) return;

    const checkAccess = async () => {
      const { doc, onSnapshot, getFirestore } = await import('firebase/firestore');
      const db = getFirestore();
      const projectRef = doc(db, 'notes', projectId);

      const unsubscribe = onSnapshot(projectRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const collaborators = data.collaborators || [];
        const isOwner = data.ownerId === userId;
        const isCollaborator = collaborators.includes(userId);

        if (!isOwner && !isCollaborator) {
          console.warn('[CollaborativeEditor] Access revoked for user:', userId);
          setIsKicked(true);
        } else {
          setIsKicked(false);
        }
      });

      return unsubscribe;
    };

    let unsub: (() => void) | undefined;
    checkAccess().then(u => unsub = u);

    return () => unsub?.();
  }, [projectId, userId]);

  const handleEditorReadyInner = useCallback(
    (editorInstance: Editor) => {
      onEditorReady?.(editorInstance);
    },
    [onEditorReady]
  );

  useEffect(() => {
    setProvider(null);
    const yjsService = YjsService.getInstance();
    const syncService = SyncService.getInstance();

    yjsService
      .init({ roomName })
      .then(async () => {
        console.log(`[CollaborativeEditor] [DEBUG] Yjs initialized for room: "${roomName}"`);
        await syncService.bootSync(
          roomName,
          projectId ?? undefined,
          userId || username,
          'document'
        );
        setProvider(yjsService.getProvider());
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown Yjs init error';
        setError(message);
        console.error('[CollaborativeEditor] Yjs init failed:', err);
      });

    return () => {
      syncService.destroy();
      yjsService.destroy();
    };
  }, [roomName, username]);

  if (error) {
    return (
      <div className="editor-error">
        <strong>⚠ Editor failed to load</strong>
        <pre>{error}</pre>
      </div>
    );
  }

  if (isKicked) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-base)',
        color: 'var(--text-primary)',
        textAlign: 'center',
        padding: '40px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚫</div>
        <h2 style={{ fontSize: '24px', marginBottom: '12px', fontWeight: 700 }}>Access Revoked</h2>
        <p style={{ color: 'var(--text-faint)', maxWidth: '400px', lineHeight: 1.6 }}>
          You are no longer a member of this project. Please contact the owner if you believe this is a mistake.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '24px',
            padding: '10px 20px',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Return Home
        </button>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="editor-loading">
        <span className="loading-spinner" />
        Connecting to collaboration room…
      </div>
    );
  }

  return (
    <ContinuousEditorInner
      key={roomName}
      provider={provider}
      username={username}
      userId={userId}
      color={color}
      title={title}
      noteId={roomName}
      onTitleChange={onTitleChange}
      onContentUpdate={onContentUpdate}
      onEditorReady={handleEditorReadyInner}
      readOnly={readOnly}
    />
  );
};

export default CollaborativeEditor;