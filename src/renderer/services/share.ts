import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { FirebaseService } from './firebase';

export type SharePermission = 'editor' | 'viewer' | 'admin' | 'student';

export interface ShareLink {
  id: string;              // Firestore doc id (the token)
  token: string;           // Same as id — the unique invite token
  projectId: string;       // Project being shared
  permission: SharePermission;
  createdBy: string;       // UID of the user who created the link
  createdByName: string;   // Display name of creator
  createdAt: number;
  expiresAt: number | null; // null = never expires
  isActive: boolean;
}

export class ShareService {
  private static instance: ShareService;

  private constructor() {}

  public static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }

  /** Generate a short, 6-character code (e.g. "2zf34e") */
  public generateToken(): string {
    // Excluded confusing characters like l, 1, I, O, 0 for better typing experience
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    const array = new Uint8Array(6);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  }

  /**
   * Create a new share link for a project.
   */
  public async createShareLink(
    projectId: string,
    permission: SharePermission,
    createdBy: string,
    createdByName: string,
  ): Promise<ShareLink> {
    const db = FirebaseService.getInstance().db;
    const token = this.generateToken();
    const now = Date.now();

    const shareLink: ShareLink = {
      id: token,
      token,
      projectId,
      permission,
      createdBy,
      createdByName,
      createdAt: now,
      expiresAt: null,
      isActive: true,
    };

    const docRef = doc(db, 'shareLinks', token);
    await setDoc(docRef, shareLink);

    return shareLink;
  }

  /**
   * Get all share links for a specific project.
   */
  public async getShareLinks(projectId: string): Promise<ShareLink[]> {
    const db = FirebaseService.getInstance().db;
    const q = query(
      collection(db, 'shareLinks'),
      where('projectId', '==', projectId),
      where('isActive', '==', true),
    );
    const snap = await getDocs(q);
    const links: ShareLink[] = [];
    snap.forEach((docSnap) => {
      links.push(docSnap.data() as ShareLink);
    });
    links.sort((a, b) => b.createdAt - a.createdAt);
    return links;
  }

  /**
   * Get a share link by its token.
   */
  public async getShareLink(token: string): Promise<ShareLink | null> {
    const db = FirebaseService.getInstance().db;
    const docRef = doc(db, 'shareLinks', token);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as ShareLink;
  }

  /**
   * Revoke (deactivate) a share link.
   */
  public async revokeShareLink(token: string): Promise<void> {
    const db = FirebaseService.getInstance().db;
    const docRef = doc(db, 'shareLinks', token);
    await updateDoc(docRef, { isActive: false });
  }

  /**
   * Delete a share link permanently.
   */
  public async deleteShareLink(token: string): Promise<void> {
    const db = FirebaseService.getInstance().db;
    const docRef = doc(db, 'shareLinks', token);
    await deleteDoc(docRef);
  }

  /**
   * Accept a share link — adds the user to the project's collaborators
   * and stores viewer/editor/admin/student role in a sub-field.
   * Returns the projectId on success.
   */
  public async acceptShareLink(
    token: string,
    userId: string,
  ): Promise<{ projectId: string; permission: SharePermission } | null> {
    const db = FirebaseService.getInstance().db;
    
    // 1. Try to find an activity project that matches this token
    const notesCol = collection(db, 'notes');
    const studentQuery = query(notesCol, where('studentInviteCode', '==', token));
    const adminQuery = query(notesCol, where('adminInviteCode', '==', token));
    
    const [studentSnap, adminSnap] = await Promise.all([getDocs(studentQuery), getDocs(adminQuery)]);
    
    let activityProjectId = null;
    let activityPermission: SharePermission | null = null;
    
    if (!studentSnap.empty) {
      activityProjectId = studentSnap.docs[0].id;
      activityPermission = 'student';
    } else if (!adminSnap.empty) {
      activityProjectId = adminSnap.docs[0].id;
      activityPermission = 'admin';
    }

    if (activityProjectId && activityPermission) {
      // Add user to the project's collaborators array
      const projectRef = doc(db, 'notes', activityProjectId);
      await updateDoc(projectRef, {
        collaborators: arrayUnion(userId),
      });

      // Store the user's role for this project
      const permRef = doc(db, 'projectPermissions', `${activityProjectId}_${userId}`);
      await setDoc(permRef, {
        projectId: activityProjectId,
        userId,
        role: activityPermission,
        grantedAt: Date.now(),
        grantedByToken: token,
      });

      return { projectId: activityProjectId, permission: activityPermission };
    }

    // 2. If not an activity code, fallback to regular share links
    const link = await this.getShareLink(token);
    if (!link || !link.isActive) return null;

    // Check expiry
    if (link.expiresAt && Date.now() > link.expiresAt) return null;

    // Add user to the project's collaborators array
    const projectRef = doc(db, 'notes', link.projectId);
    await updateDoc(projectRef, {
      collaborators: arrayUnion(userId),
    });

    // Store the user's permission for this project
    const permRef = doc(db, 'projectPermissions', `${link.projectId}_${userId}`);
    await setDoc(permRef, {
      projectId: link.projectId,
      userId,
      permission: link.permission,
      grantedAt: Date.now(),
      grantedByToken: token,
    });

    return { projectId: link.projectId, permission: link.permission };
  }

  /**
   * Get the current user's permission for a project.
   * Returns 'owner' if the user owns it, otherwise 'editor' | 'viewer' | 'admin' | 'student' | null.
   */
  public async getUserPermission(
    projectId: string,
    userId: string,
  ): Promise<'owner' | SharePermission | null> {
    // Check if user is owner
    const project = await FirebaseService.getInstance().getNote(projectId);
    if (!project) return null;
    if (project.ownerId === userId) return 'owner';

    // Check permission record
    const db = FirebaseService.getInstance().db;
    const permRef = doc(db, 'projectPermissions', `${projectId}_${userId}`);
    const snap = await getDoc(permRef);
    if (!snap.exists()) {
      // Check if they're in collaborators array without explicit permission (legacy)
      if (project.collaborators?.includes(userId)) return 'editor';
      return null;
    }
    const data = snap.data();
    return (data.role || data.permission) as SharePermission;
  }

  /**
   * Build a shareable URL from a token.
   * Since this is an Electron app using HashRouter, the URL is a deep link.
   */
  public buildShareUrl(token: string): string {
    // For Electron + HashRouter, use the app's protocol or just the hash route
    return `#/share/${token}`;
  }
}
