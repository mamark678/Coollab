import { addDoc, collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import * as Y from 'yjs';
import { useAppStore } from '../store/useAppStore';
import { FirebaseService } from './firebase';
import { YjsService } from './yjs';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function decodeBase64Safe(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error('[SyncService] Base64 decode failed', e);
    return null;
  }
}

function encodeBase64(buffer: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(buffer.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

/**
 * Converts a Yjs XmlFragment (TipTap format) to a Quill Delta JSON array.
 * Flutter reads this as deltaContent — keeping both platforms in sync.
 */
function convertYjsToDelta(doc: Y.Doc): any[] {
  const fragment = doc.getXmlFragment('coollab-page-0');
  const ops: any[] = [];

  const processNode = (node: Y.XmlElement | Y.XmlText | Y.AbstractType<any>) => {
    if (node instanceof Y.XmlText) {
      const text = node.toString();
      const attrs = node.getAttributes();
      if (text) {
        const quillAttrs: Record<string, any> = {};
        if (attrs.bold) quillAttrs.bold = true;
        if (attrs.italic) quillAttrs.italic = true;
        if (attrs.underline) quillAttrs.underline = true;
        if (attrs.strike) quillAttrs.strike = true;
        if (attrs.code) quillAttrs.code = true;
        if (attrs.color) quillAttrs.color = attrs.color;
        if (attrs.background) quillAttrs.background = attrs.background;
        if (attrs.link) quillAttrs.link = attrs.link;

        ops.push(Object.keys(quillAttrs).length > 0
          ? { insert: text, attributes: quillAttrs }
          : { insert: text });
      }
    } else if (node instanceof Y.XmlElement) {
      const tag = node.nodeName;
      const attrs = node.getAttributes();

      if (tag === 'paragraph') {
        // Process children first
        for (let i = 0; i < node.length; i++) {
          processNode(node.get(i) as any);
        }
        ops.push({ insert: '\n' });
      } else if (tag === 'heading') {
        const level = parseInt(attrs.level || '1', 10);
        for (let i = 0; i < node.length; i++) {
          processNode(node.get(i) as any);
        }
        ops.push({ insert: '\n', attributes: { header: level } });
      } else if (tag === 'bulletList' || tag === 'orderedList') {
        const listType = tag === 'bulletList' ? 'bullet' : 'ordered';
        for (let i = 0; i < node.length; i++) {
          const child = node.get(i) as any;
          if (child instanceof Y.XmlElement && child.nodeName === 'listItem') {
            for (let j = 0; j < child.length; j++) {
              processNode(child.get(j) as any);
            }
            ops.push({ insert: '\n', attributes: { list: listType } });
          }
        }
      } else if (tag === 'codeBlock') {
        for (let i = 0; i < node.length; i++) {
          processNode(node.get(i) as any);
        }
        ops.push({ insert: '\n', attributes: { 'code-block': true } });
      } else if (tag === 'blockquote') {
        for (let i = 0; i < node.length; i++) {
          processNode(node.get(i) as any);
        }
        ops.push({ insert: '\n', attributes: { blockquote: true } });
      } else {
        // Unknown element — recurse into children
        for (let i = 0; i < node.length; i++) {
          processNode(node.get(i) as any);
        }
      }
    }
  };

  for (let i = 0; i < fragment.length; i++) {
    processNode(fragment.get(i) as any);
  }

  // Ensure document always ends with a newline (Quill requirement)
  if (ops.length === 0 || (ops[ops.length - 1] as any).insert !== '\n') {
    ops.push({ insert: '\n' });
  }

  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// SyncService
// ─────────────────────────────────────────────────────────────────────────────

export class SyncService {
  private static instance: SyncService;

  private unsubscribeOps: (() => void) | null = null;
  private onUpdateCallback: ((update: Uint8Array, origin: any) => void) | null = null;

  private currentRoom: string | null = null;
  private currentProjectId: string | null = null;
  private currentUserId: string | null = null;
  private currentDocType: string | null = null;

  private opCount = 0;

  // Save queue — ensures we never drop an update even if a save is in progress
  private saveInProgress = false;
  private needsSaveAgain = false;
  private pendingDoc: Y.Doc | null = null;

  private constructor() { }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOOT
  // ─────────────────────────────────────────────────────────────────────────

  public async bootSync(
    roomName: string,
    projectId?: string,
    userId?: string,
    type?: string
  ): Promise<void> {
    if (this.currentRoom === roomName) return;
    this.destroy();

    this.currentRoom = roomName;
    this.currentProjectId = projectId || null;
    this.currentUserId = userId || null;
    this.currentDocType = type || null;

    const firebase = FirebaseService.getInstance();
    const doc = YjsService.getInstance().getDoc();

    useAppStore.getState().setSyncStatus('syncing');

    try {
      // 1. Load checkpoint from main document
      const noteData = await firebase.getNote(
        roomName,
        this.currentProjectId || undefined,
        this.currentUserId || undefined,
        this.currentDocType || undefined
      );

      let checkpointTime = new Date(0);

      if (noteData?.checkpoint) {
        const checkpoint = decodeBase64Safe(noteData.checkpoint);
        if (checkpoint) {
          Y.applyUpdate(doc, checkpoint, 'initial');
          checkpointTime = noteData.updatedAt
            ? new Date(noteData.updatedAt)
            : new Date(0);
        }
      } else if (noteData?.content && typeof noteData.content === 'string') {
        // Legacy: load old Base64 Yjs state if no checkpoint yet
        const legacyState = decodeBase64Safe(noteData.content);
        if (legacyState) Y.applyUpdate(doc, legacyState, 'initial');
      }

      // 2. Listen to updates subcollection (real-time cross-platform)
      const user = firebase.auth.currentUser;
      const updatesCol = collection(firebase.db, `notes/${roomName}/updates`);
      const updatesQuery = query(
        updatesCol,
        where('timestamp', '>', Timestamp.fromDate(checkpointTime)),
        orderBy('timestamp', 'asc')
      );

      this.unsubscribeOps = onSnapshot(updatesQuery, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data();

          // Skip our own updates
          if (data.authorId === user?.uid) return;

          // Try Yjs binary first (from Electron)
          if (data.data) {
            const binaryUpdate = decodeBase64Safe(data.data);
            if (binaryUpdate) {
              Y.applyUpdate(doc, binaryUpdate, 'remote-sync');
              return;
            }
          }

          // 2. Handle Flutter update (deltaContent + searchText)
          if (data.deltaContent && !data.data) {
            const text = data.searchText || (data.deltaContent as any[]).reduce((acc, op) => {
              return acc + (typeof op.insert === 'string' ? op.insert : '');
            }, '');

            const fragment = doc.getXmlFragment('coollab-page-0');
            doc.transact(() => {
              // Clear existing and replace with plain text from Flutter
              // This ensures TipTap/Electron sees the latest state from mobile instantly
              if (fragment.length > 0) fragment.delete(0, fragment.length);
              const paragraph = new Y.XmlElement('paragraph');
              paragraph.insert(0, [new Y.XmlText(text)]);
              fragment.insert(0, [paragraph]);
            }, 'remote-sync');
          }
        });
      });

      useAppStore.getState().setSyncStatus('synced');
    } catch (err) {
      console.error('[SyncService] Bootstrap error:', err);
      useAppStore.getState().setSyncStatus('offline');
    }

    // 3. Publish local Yjs updates to Firestore
    this.onUpdateCallback = (update: Uint8Array, origin: any) => {
      if (origin === 'remote-sync' || origin === 'initial' || origin === this) return;

      useAppStore.getState().setSyncStatus('syncing');
      this.pendingDoc = doc;
      this.scheduleSave(roomName, doc);
    };

    doc.on('update', this.onUpdateCallback);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE WITH QUEUE (no dropped updates)
  // ─────────────────────────────────────────────────────────────────────────

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleSave(roomName: string, doc: Y.Doc): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.executeSave(roomName, doc);
    }, 400);
  }

  private async executeSave(roomName: string, doc: Y.Doc): Promise<void> {
    if (this.saveInProgress) {
      this.needsSaveAgain = true;
      return;
    }

    this.saveInProgress = true;
    this.needsSaveAgain = false;

    try {
      const firebase = FirebaseService.getInstance();
      const user = firebase.auth.currentUser;
      if (!user) return;

      // 1. Encode the full Yjs state as a binary update
      const fullUpdate = Y.encodeStateAsUpdate(doc);
      const base64Update = encodeBase64(fullUpdate);

      // 2. Convert Yjs to Quill Delta for Flutter
      const deltaContent = convertYjsToDelta(doc);

      // 3. Extract plaintext
      const fragment = doc.getXmlFragment('coollab-page-0');
      const searchText = fragment.toString().replace(/<[^>]*>/gm, '').trim();

      // 4. Publish to updates subcollection (Flutter listens here)
      await addDoc(
        collection(firebase.db, `notes/${roomName}/updates`),
        {
          data: base64Update,           // Yjs binary for Electron peers
          deltaContent: deltaContent,    // Quill Delta for Flutter
          searchText: searchText,        // Plaintext fallback
          authorId: user.uid,
          platform: 'electron',
          timestamp: new Date(),         // Will be converted server-side
        }
      );

      const yjsDoc = YjsService.getInstance().getDoc();
      const titleText = yjsDoc.getText('title').toString();

      await firebase.saveNote(roomName, {
        deltaContent: deltaContent,
        searchText: searchText,
        title: titleText || undefined,
        lastUpdatedByPlatform: 'electron',
        type: (this.currentDocType as any) || 'document',
        updatedAt: Date.now(),
      }, this.currentProjectId || undefined, this.currentUserId || undefined);

      this.opCount++;

      // 6. Checkpoint every 100 ops
      if (this.opCount >= 100) {
        const checkpoint = encodeBase64(fullUpdate);
        await firebase.saveNote(roomName, {
          checkpoint: checkpoint,
          updatedAt: Date.now(),
        }, this.currentProjectId || undefined, this.currentUserId || undefined);
        this.opCount = 0;
        console.log('[SyncService] Checkpoint written');
      }

      useAppStore.getState().setSyncStatus('synced');
    } catch (err) {
      console.error('[SyncService] Save error:', err);
      useAppStore.getState().setSyncStatus('offline');
    } finally {
      this.saveInProgress = false;
      // If another update came in while we were saving, save again immediately
      if (this.needsSaveAgain && this.pendingDoc) {
        this.executeSave(roomName, this.pendingDoc);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESTROY
  // ─────────────────────────────────────────────────────────────────────────

  public destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.unsubscribeOps?.();
    this.unsubscribeOps = null;

    try {
      const doc = YjsService.getInstance().getDoc();
      if (this.onUpdateCallback) doc.off('update', this.onUpdateCallback);
    } catch (e) { }

    this.currentRoom = null;
    this.opCount = 0;
    this.saveInProgress = false;
    this.needsSaveAgain = false;
    this.pendingDoc = null;
  }
}