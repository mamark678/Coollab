import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Firestore,
  addDoc,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  enableIndexedDbPersistence,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  Auth, 
  signInAnonymously,
  deleteUser,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  AuthCredential
} from 'firebase/auth';
import type { NotificationItem } from '../types/notification.types';
import type { VersionItem } from '../types/version.types';
import type { CommentItem } from '../types/comment.types';

export type PropertyType = 'text' | 'number' | 'date' | 'checkbox' | 'multi-select' | 'url';

export interface DocumentProperty {
  type: PropertyType;
  value: any;
}

export interface DocumentProperties {
  [key: string]: DocumentProperty;
}

export interface DocumentSchema {
  id: string;
  title: string;
  content: string | null; // Raw Yjs state vector Base64 encoded for DB persistence
  deltaContent?: any[];   // Rich text Delta for mobile clients
  searchText?: string;    // Plaintext version for search and graph indexing
  ownerId: string;
  collaborators: string[];
  createdAt: number;
  updatedAt: number;
  lastUpdatedByPlatform?: 'electron' | 'flutter';
  type?: 'document' | 'folder' | 'project' | 'activity' | 'canvas' | 'base';
  isProject?: boolean;
  projectId?: string | null;
  description?: string;
  activityType?: 'individual' | 'group';
  studentInviteCode?: string;
  adminInviteCode?: string;
  isFolder?: boolean;
  parentId?: string | null;
  order?: number;
  properties?: DocumentProperties;
  checkpoint?: string;
}

export class FirebaseService {
  private static instance: FirebaseService;
  public app: FirebaseApp;
  public db: Firestore;
  public auth: Auth;

  private constructor() {
    // Basic setup. In a real environment, replace these with actual env variables.
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy"
    };

    this.app = initializeApp(firebaseConfig);
    this.db = getFirestore(this.app);
    this.auth = getAuth(this.app);

    // Enable offline persistence (Section 1)
    enableIndexedDbPersistence(this.db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('[FirebaseService] Persistence failed: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('[FirebaseService] Persistence failed: browser not supported');
      }
    });

    // Set persistence to LOCAL so users stay logged in (Section 2)
    setPersistence(this.auth, browserLocalPersistence).catch(err => {
      console.error('[FirebaseService] Persistence error:', err);
    });
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Signs in a user anonymously if they don't want to create an account.
   */
  public async signInAnonymously(): Promise<void> {
    await signInAnonymously(this.auth);
  }

  /**
   * Fetches the document from Firestore.
   */
  public async getNote(id: string, projectId?: string, userId?: string, type?: string): Promise<DocumentSchema | null> {
    let docRef;
    if (projectId && userId) {
      if (type) {
        const colName = type === 'folder' ? 'folders' : type === 'canvas' ? 'canvas' : type === 'base' ? 'base' : 'documents';
        const ref = doc(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`, id);
        const snap = await getDoc(ref);
        if (snap.exists()) return { ...(snap.data() as DocumentSchema), id: snap.id };
        return null;
      }

      // We need to find which subcollection it's in. 
      // Since we don't know the type, we might need to check all or require the type.
      // For now, let's try the common ones or assume documents if not found.
      const collections = ['documents', 'folders', 'canvas', 'base'];
      for (const col of collections) {
        const ref = doc(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${col}`, id);
        const snap = await getDoc(ref);
        if (snap.exists()) return { ...(snap.data() as DocumentSchema), id: snap.id };
      }
      return null;
    } else {
      docRef = doc(this.db, 'notes', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...(docSnap.data() as DocumentSchema), id: docSnap.id };
      }
    }
    return null;
  }

  /**
   * Lists all notes belonging to a specific project.
   * If userId is provided, it fetches from the student's individual workspace.
   */
  public async listProjectNotes(projectId: string, userId?: string): Promise<DocumentSchema[]> {
    try {
      if (userId) {
        // Individual workspace - requires fetching from multiple subcollections
        const collections = ['documents', 'folders', 'canvas', 'base'];
        const allDocs: DocumentSchema[] = [];
        
        for (const colName of collections) {
          const colRef = collection(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`);
          const snap = await getDocs(colRef);
          snap.forEach(d => allDocs.push({ ...d.data(), id: d.id } as DocumentSchema));
        }
        
        return allDocs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }

      const notesCol = collection(this.db, 'notes');
      const q = query(notesCol, where("projectId", "==", projectId));
      const snap = await getDocs(q);
      
      const docs: DocumentSchema[] = [];
      snap.forEach(docSnap => {
        docs.push({ ...(docSnap.data() as DocumentSchema), id: docSnap.id });
      });
      
      return docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
      console.error('[FirebaseService] listProjectNotes error:', err);
      return [];
    }
  }

  /**
   * Fetches the most recently modified document in a project for preview.
   */
  public async getLatestDocumentPreview(projectId: string): Promise<DocumentSchema | null> {
    try {
      const db = this.db;
      const notesCol = collection(db, 'notes');
      
      // Bug 2: Use ONLY a single where() filter to avoid composite index requirements
      const q = query(
        notesCol,
        where('parentId', '==', projectId)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Map data first
        const docs = snap.docs.map(docSnap => ({ ...(docSnap.data() as DocumentSchema), id: docSnap.id }));
        
        // Filter by type in JavaScript
        const filtered = docs.filter(doc => doc.type === 'document' || !doc.type);
        
        // Sort by updatedAt in JavaScript
        filtered.sort((a, b) => {
          const timeA = a.updatedAt || 0;
          const timeB = b.updatedAt || 0;
          return timeB - timeA;
        });
        
        return filtered.length > 0 ? filtered[0] : null;
      }
      return null;
    } catch (err) {
      console.error('[FirebaseService] getLatestDocumentPreview error:', err);
      return null;
    }
  }

  /**
   * Lists all notes owned by a specific user, sorted by most recently updated.
   */
  public async listUserNotes(userId: string): Promise<DocumentSchema[]> {
    try {
      const notesCol = collection(this.db, 'notes');
      
      // Query 1: Where the user is the direct owner
      const ownedQuery = query(notesCol, where("ownerId", "==", userId));
      // Query 2: Where the user is listed inside the collaborators array
      const collabQuery = query(notesCol, where("collaborators", "array-contains", userId));
      
      const [ownedSnap, collabSnap] = await Promise.all([
        getDocs(ownedQuery),
        getDocs(collabQuery)
      ]);
      
      const userNotesMap = new Map<string, DocumentSchema>();

      ownedSnap.forEach(docSnap => {
        userNotesMap.set(docSnap.id, { ...(docSnap.data() as DocumentSchema), id: docSnap.id });
      });
      
      collabSnap.forEach(docSnap => {
        userNotesMap.set(docSnap.id, { ...(docSnap.data() as DocumentSchema), id: docSnap.id });
      });

      const userNotes = Array.from(userNotesMap.values());

      // Sort by updatedAt descending (most recent first)
      userNotes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      return userNotes;
    } catch (err) {
      console.error('[FirebaseService] Failed to list user notes:', err);
      return [];
    }
  }



  /**
   * Subscribes to all notes in a specific project.
   */
  public listenToProjectNotes(projectId: string, callback: (docs: DocumentSchema[]) => void, userId?: string): () => void {
    // Bug 1: If userId is present, we are in an individual workspace. Use studentWorkspaces path exclusively.
    if (userId) {
      // Individual workspace listener - combines docs from all isolated subcollections
      const collections = ['documents', 'folders', 'canvas', 'base'];
      const unsubscribers: (() => void)[] = [];
      const allData: Record<string, DocumentSchema[]> = {};

      collections.forEach(colName => {
        const q = query(collection(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`));
        const unsub = onSnapshot(
          q, 
          (snap) => {
            allData[colName] = snap.docs.map(d => ({ ...d.data(), id: d.id } as DocumentSchema));
            const combined = Object.values(allData).flat();
            callback(combined);
          },
          (error) => console.error(`[FirebaseService] Error listening to ${colName}:`, error)
        );
        unsubscribers.push(unsub);
      });

      return () => unsubscribers.forEach(u => u());
    }

    // Otherwise, use the global notes path as normal
    const q = query(
      collection(this.db, 'notes'),
      where('projectId', '==', projectId)
    );
    return onSnapshot(
      q, 
      (snap) => {
        const docs: DocumentSchema[] = [];
        snap.forEach((docSnap) => {
          docs.push({ ...(docSnap.data() as DocumentSchema), id: docSnap.id });
        });
        callback(docs);
      },
      (error) => console.error('[FirebaseService] Error listening to global notes:', error)
    );
  }

  /**
   * Silently initializes an individual workspace for a student.
   */
  public async initializeIndividualWorkspace(projectId: string, userId: string): Promise<void> {
    const workspaceRef = doc(this.db, `notes/${projectId}/studentWorkspaces`, userId);
    const snap = await getDoc(workspaceRef);
    
    if (!snap.exists()) {
      // First time initialization
      const now = Date.now();
      await setDoc(workspaceRef, { initializedAt: now, userId });
    }
  }

  /**
   * Saves a note in either global or individual workspace.
   */
  public async saveNote(id: string, updateData: Partial<DocumentSchema>, projectId?: string, userId?: string): Promise<void> {
    const now = Date.now();
    let docRef;

    if (projectId && userId) {
      // Determine subcollection based on type
      const type = updateData.type || 'document';
      const colName = type === 'folder' ? 'folders' : type === 'canvas' ? 'canvas' : type === 'base' ? 'base' : 'documents';
      docRef = doc(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`, id);
    } else {
      docRef = doc(this.db, 'notes', id);
    }
    
    const batch = writeBatch(this.db);
    batch.set(docRef, { ...updateData, updatedAt: now }, { merge: true });
    await batch.commit();
  }

  /**
   * Creates a note in either global or individual workspace.
   */
  public async createNote(id: string, data: DocumentSchema, projectId?: string, userId?: string): Promise<void> {
    const db = this.db;
    const type = data.type || 'document';
    const isFolder = data.isFolder;
    const colName = isFolder ? 'folders' : type === 'canvas' ? 'canvas' : type === 'base' ? 'base' : 'documents';
    
    let colRef;
    if (projectId && userId) {
      colRef = collection(db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`);
    } else {
      colRef = collection(db, 'notes');
    }

    // Duplicate check removed to allow multiple documents with same name (e.g. "New Document")
    // and to prevent race conditions where valid creations are skipped.

    const docRef = doc(colRef, id);
    await setDoc(docRef, data);

    // Triggers are now handled by dispatchEvent in UI components
  }

  /**
   * Deletes a note from either global or individual workspace.
   * For projects, also deletes all associated subcollections.
   */
  public async deleteNote(id: string, projectId?: string, userId?: string, type?: string, isFolder?: boolean): Promise<void> {
    const authUser = this.auth.currentUser;
    if (!authUser) throw new Error('Not authenticated');

    let docRef;
    if (projectId && userId) {
      const colName = isFolder ? 'folders' : type === 'canvas' ? 'canvas' : type === 'base' ? 'base' : 'documents';
      docRef = doc(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`, id);
    } else {
      docRef = doc(this.db, 'notes', id);
    }
    
    try {
      // 1. Fetch document to check ownership and type
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const data = snap.data() as DocumentSchema;

      // 2. Security Check: Only owner can delete
      if (data.ownerId !== authUser.uid) {
        throw new Error('Only the project owner can delete this project');
      }

      const isProject = data.isProject;
      const projectType = data.type;

      if (!projectId || !userId) {
        const batch = writeBatch(this.db);

        // Helper to delete a subcollection
        const deleteSubcollection = async (path: string) => {
          const colRef = collection(this.db, path);
          const snapshot = await getDocs(colRef);
          snapshot.docs.forEach(d => batch.delete(d.ref));
        };

        if (isProject) {
          // A. Common Project Subcollections
          await deleteSubcollection(`notes/${id}/comments`);
          await deleteSubcollection(`notes/${id}/versions`);

          if (projectType === 'activity') {
            // B. Activity Project Subcollections
            await deleteSubcollection(`notes/${id}/instructions`);
            
            // Delete activities and their completions
            const activitiesCol = collection(this.db, `notes/${id}/activities`);
            const activitiesSnap = await getDocs(activitiesCol);
            for (const actDoc of activitiesSnap.docs) {
              await deleteSubcollection(`notes/${id}/activities/${actDoc.id}/completions`);
              batch.delete(actDoc.ref);
            }

            // Delete all student workspaces
            const workspacesCol = collection(this.db, `notes/${id}/studentWorkspaces`);
            const workspacesSnap = await getDocs(workspacesCol);
            for (const wsDoc of workspacesSnap.docs) {
              // Note: For deep subcollections like documents/folders inside workspace, 
              // we'd need to recursive delete or handle them if they exist.
              // For now, following the specific list provided.
              batch.delete(wsDoc.ref);
            }
          }
        } else {
          // Regular note deletion (just comments/versions)
          await deleteSubcollection(`notes/${id}/comments`);
          await deleteSubcollection(`notes/${id}/versions`);
        }

        batch.delete(docRef);
        await batch.commit();
      } else {
        // Individual notes in student workspace
        await deleteDoc(docRef);
      }
    } catch (err) {
      console.error('[FirebaseService] deleteNote error:', err);
      throw err;
    }
  }

  /**
   * Listen to a specific note in either global or individual workspace.
   */
  public listenToNote(id: string, callback: (data: DocumentSchema, hasPendingWrites: boolean) => void, projectId?: string, userId?: string, type?: string, isFolder?: boolean): () => void {
    let docRef;
    if (projectId && userId) {
      const colName = isFolder ? 'folders' : type === 'canvas' ? 'canvas' : type === 'base' ? 'base' : 'documents';
      docRef = doc(this.db, `notes/${projectId}/studentWorkspaces/${userId}/${colName}`, id);
    } else {
      docRef = doc(this.db, 'notes', id);
    }

    return onSnapshot(
      docRef, 
      { includeMetadataChanges: true }, 
      (snap) => {
        if (snap.exists()) {
          callback({ ...(snap.data() as DocumentSchema), id: snap.id }, snap.metadata.hasPendingWrites);
        }
      },
      (error) => console.error(`[FirebaseService] Error listening to note ${id}:`, error)
    );
  }

  public async saveYjsUpdate(noteId: string, update: Uint8Array, authorId: string): Promise<void> {
    const base64Update = Buffer.from(update).toString('base64');
    const updatesCol = collection(this.db, `notes/${noteId}/updates`);
    await addDoc(updatesCol, {
      data: base64Update,
      authorId,
      timestamp: serverTimestamp()
    });
  }

  public listenToYjsUpdates(noteId: string, since: Date, callback: (ops: any[]) => void): () => void {
    const q = query(
      collection(this.db, `notes/${noteId}/updates`), 
      where('timestamp', '>', since),
      orderBy('timestamp')
    );
    return onSnapshot(
      q, 
      (snap) => {
        const ops = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(ops);
      },
      (error) => console.error(`[FirebaseService] Error listening to Yjs updates for ${noteId}:`, error)
    );
  }

  public async updateCheckpoint(noteId: string, fullState: Uint8Array): Promise<void> {
    const base64State = Buffer.from(fullState).toString('base64');
    const docRef = doc(this.db, 'notes', noteId);
    
    await updateDoc(docRef, {
      checkpoint: base64State,
      updatedAt: serverTimestamp()
    });

    // Cleanup: Delete old updates (simpler in Node)
    const updatesCol = collection(this.db, `notes/${noteId}/updates`);
    const q = query(updatesCol, where('timestamp', '<', new Date(Date.now() - 10000)));
    const snap = await getDocs(q);
    const batch = writeBatch(this.db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  /**
   * Users Management
   */
  public async saveUserProfile(uid: string, data: { 
    name: string; 
    email?: string | null; 
    photoURL?: string | null; 
    photoBase64?: string | null;
    lastNameChange?: number | null;
    createdAt?: number;
    updatedAt?: number;
    uid?: string;
  }): Promise<void> {
    const userRef = doc(this.db, 'users', uid);
    await setDoc(userRef, { updatedAt: Date.now(), ...data }, { merge: true });
  }

  public async handleGoogleSignInResult(user: any): Promise<void> {
    const userRef = doc(this.db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const newProfile = {
        uid: user.uid,
        name: user.displayName || 'User',
        email: user.email,
        photoURL: user.photoURL ?? null,
        photoBase64: null,
        lastNameChange: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await setDoc(userRef, newProfile);
    }
  }

  public async getUserProfile(uid: string): Promise<{ name: string; email?: string; photoURL?: string; photoBase64?: string; lastNameChange?: number; createdAt?: number } | null> {
    const userRef = doc(this.db, 'users', uid);
    const snap = await getDoc(userRef);
    return snap.exists() ? snap.data() as any : null;
  }

  public listenToUserProfile(uid: string, callback: (data: any) => void): () => void {
    const userRef = doc(this.db, 'users', uid);
    return onSnapshot(
      userRef, 
      (snap) => {
        if (snap.exists()) {
          callback({ ...snap.data(), uid: snap.id });
        }
      },
      (error) => console.error(`[FirebaseService] Error listening to user profile ${uid}:`, error)
    );
  }

  public async getUserProfiles(uids: string[]): Promise<Record<string, { name: string, photoBase64?: string | null, photoURL?: string | null }>> {
    if (uids.length === 0) return {};
    
    // Firestore 'in' query is limited to 30 items
    const userCol = collection(this.db, 'users');
    const q = query(userCol, where('__name__', 'in', uids.slice(0, 30)));
    const snap = await getDocs(q);
    
    const profiles: Record<string, { name: string }> = {};
    snap.forEach(d => {
      profiles[d.id] = d.data() as any;
    });
    return profiles;
  }

  /**
   * Collaborators Management
   */
  public async removeCollaborator(projectId: string, userId: string): Promise<void> {
    const { updateDoc, arrayRemove } = await import('firebase/firestore');
    const projectRef = doc(this.db, 'notes', projectId);
    
    await updateDoc(projectRef, { 
      collaborators: arrayRemove(userId),
      updatedAt: Date.now() 
    });
  }

  /**
   * Notifications
   */
  public listenToNotifications(userId: string, callback: (notifications: NotificationItem[]) => void): () => void {
    const q = query(
      collection(this.db, `notifications/${userId}/items`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(
      q, 
      (snap) => {
        const items: NotificationItem[] = [];
        snap.forEach((d) => items.push({ ...(d.data() as NotificationItem), id: d.id }));
        callback(items);
      },
      (error) => console.error(`[FirebaseService] Error listening to notifications for ${userId}:`, error)
    );
  }

  public async markNotificationRead(userId: string, notificationId: string): Promise<void> {
    const docRef = doc(this.db, `notifications/${userId}/items`, notificationId);
    await setDoc(docRef, { read: true }, { merge: true });
  }

  public async markAllNotificationsRead(userId: string, notifications: NotificationItem[]): Promise<void> {
    const batch = writeBatch(this.db);
    notifications.forEach((n) => {
      if (!n.read && n.id) {
        const docRef = doc(this.db, `notifications/${userId}/items`, n.id);
        batch.update(docRef, { read: true });
      }
    });
    await batch.commit();
  }

  public async createNotification(userId: string, notification: NotificationItem): Promise<void> {
    const colRef = collection(this.db, `notifications/${userId}/items`);
    await addDoc(colRef, notification);
  }

  /**
   * Comments
   */
  public listenToComments(noteId: string, callback: (comments: CommentItem[]) => void): () => void {
    const q = query(
      collection(this.db, `notes/${noteId}/comments`),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(
      q, 
      (snap) => {
        const items: CommentItem[] = [];
        snap.forEach((d) => items.push({ ...(d.data() as CommentItem), id: d.id }));
        callback(items);
      },
      (error) => console.error(`[FirebaseService] Error listening to comments for ${noteId}:`, error)
    );
  }

  public async createComment(noteId: string, comment: CommentItem): Promise<void> {
    const colRef = collection(this.db, `notes/${noteId}/comments`);
    await addDoc(colRef, comment);
  }

  public async updateComment(noteId: string, commentId: string, updates: Partial<CommentItem>): Promise<void> {
    const docRef = doc(this.db, `notes/${noteId}/comments`, commentId);
    await setDoc(docRef, updates, { merge: true });
  }

  public async deleteComment(noteId: string, commentId: string): Promise<void> {
    const docRef = doc(this.db, `notes/${noteId}/comments`, commentId);
    await deleteDoc(docRef);
  }

  /**
   * Version History
   */
  public listenToVersions(noteId: string, callback: (versions: VersionItem[]) => void): () => void {
    const q = query(
      collection(this.db, `notes/${noteId}/versions`),
      orderBy('createdAt', 'desc')
    ); // Use createdAt if available, else savedAt
    return onSnapshot(
      q, 
      (snap) => {
        const items: VersionItem[] = [];
        snap.forEach((d) => items.push({ ...(d.data() as VersionItem), id: d.id }));
        callback(items.sort((a, b) => b.savedAt - a.savedAt));
      },
      (error) => console.error(`[FirebaseService] Error listening to versions for ${noteId}:`, error)
    );
  }

  public async saveVersion(noteId: string, version: VersionItem): Promise<void> {
    const colRef = collection(this.db, `notes/${noteId}/versions`);
    await addDoc(colRef, version);
    
    // Prune old versions if > 50
    const q = query(colRef, orderBy('savedAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.size > 50) {
      const docs = snap.docs;
      const batch = writeBatch(this.db);
      for (let i = 50; i < docs.length; i++) {
        batch.delete(docs[i].ref);
      }
      await batch.commit();
    }
  }

  /**
   * Account Deletion
   */
  public async deleteUserAccount(uid: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || user.uid !== uid) throw new Error('Not authenticated or UID mismatch');

    // Re-authenticate if necessary (Firebase requirement for sensitive operations)
    // In this app, we'll assume the caller handles re-auth or we trigger it if needed.
    // For now, let's implement the data cleanup.

    const batch = writeBatch(this.db);

    // 1. Delete user profile
    batch.delete(doc(this.db, 'users', uid));

    // 2. Find and delete owned projects
    const notesCol = collection(this.db, 'notes');
    const ownedQuery = query(notesCol, where("ownerId", "==", uid));
    const ownedSnap = await getDocs(ownedQuery);
    ownedSnap.forEach(d => batch.delete(d.ref));

    // 3. Remove from collaborations
    const { arrayRemove } = await import('firebase/firestore');
    const collabQuery = query(notesCol, where("collaborators", "array-contains", uid));
    const collabSnap = await getDocs(collabQuery);
    collabSnap.forEach(d => {
      batch.update(d.ref, { collaborators: arrayRemove(uid) });
    });

    // 4. Delete notifications
    // Note: Deleting a collection is tricky in client-side JS. 
    // We'll delete the items we can see.
    const notificationsCol = collection(this.db, `notifications/${uid}/items`);
    const notifSnap = await getDocs(notificationsCol);
    notifSnap.forEach(d => batch.delete(d.ref));

    // Commit batch
    await batch.commit();

    // 5. Delete Firebase Auth user
    await deleteUser(user);
  }

  public async reauthenticate(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('No user to reauthenticate');
    const provider = new GoogleAuthProvider();
    await reauthenticateWithPopup(user, provider);
  }

  /**
   * Presence & Awareness (Cross-platform)
   */
  public async updatePresence(noteId: string, userId: string, status: any): Promise<void> {
    const presenceRef = doc(this.db, `notes/${noteId}/presence`, userId);
    await setDoc(presenceRef, {
      ...status,
      lastSeen: Date.now(), // Use local timestamp for cross-platform simplicity or serverTimestamp
    }, { merge: true });
  }

  public listenToPresence(noteId: string, callback: (users: any[]) => void): () => void {
    const presenceCol = collection(this.db, `notes/${noteId}/presence`);
    return onSnapshot(
      presenceCol, 
      (snap) => {
        const users = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
        callback(users);
      },
      (error) => console.error(`[FirebaseService] Error listening to presence for ${noteId}:`, error)
    );
  }
}
