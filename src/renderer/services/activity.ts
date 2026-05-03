import { FirebaseService } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  orderBy, 
  limit, 
  writeBatch,
  updateDoc,
  deleteDoc,
  collectionGroup
} from 'firebase/firestore';

export interface ActivityCompletion {
  userId: string;
  status: 'completed' | 'timed_out' | 'in_progress';
  pointsEarned: number;
  manualPointsOverride: number | null;
  timeTaken: number;
  completedAt: number | null;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  sequenceNumber: number;
  points: number;
  timer_config?: {
    duration_seconds: number;
    grace_period_seconds: number;
    max_retries: number;
    on_timeout: string;
    late_penalty?: number;
  };
  instructions: string[];
  tags?: string[];
}

export class ActivityService {
  private static instance: ActivityService;
  
  private constructor() {}

  public static getInstance(): ActivityService {
    if (!ActivityService.instance) {
      ActivityService.instance = new ActivityService();
    }
    return ActivityService.instance;
  }

  /**
   * Fetches the next activity for a student in a project.
   */
  public async getNextActivity(projectId: string, userId: string): Promise<Activity | null> {
    const db = FirebaseService.getInstance().db;
    const activitiesCol = collection(db, `notes/${projectId}/activities`);
    const q = query(activitiesCol, orderBy('sequenceNumber', 'asc'));
    const snap = await getDocs(q);

    const activities = snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
    
    // 1. Check for any existing in_progress activity
    for (const activity of activities) {
      const completionRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${userId}`);
      const compSnap = await getDoc(completionRef);
      if (compSnap.exists()) {
        const comp = compSnap.data() as ActivityCompletion;
        if (comp.status === 'in_progress') {
          return activity;
        }
      }
    }

    // 2. If no in_progress, take the first one that isn't completed/timed_out
    for (const activity of activities) {
      const completionRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${userId}`);
      const compSnap = await getDoc(completionRef);
      
      if (!compSnap.exists()) {
        // Mark as in_progress when first reached
        await setDoc(completionRef, {
          userId,
          status: 'in_progress',
          pointsEarned: 0,
          manualPointsOverride: null,
          timeTaken: 0,
          completedAt: null,
          startedAt: Date.now()
        });
        return activity;
      }
    }

    return null; // All activities finished
  }

  /**
   * Marks an activity as timed out for a student.
   */
  public async markTimedOut(projectId: string, userId: string, activityId: string, timeTaken: number) {
    const db = FirebaseService.getInstance().db;
    const completionRef = doc(db, `notes/${projectId}/activities/${activityId}/completions/${userId}`);
    
    await setDoc(completionRef, {
      userId,
      status: 'timed_out',
      pointsEarned: 0,
      manualPointsOverride: null,
      timeTaken,
      completedAt: Date.now()
    }, { merge: true });

    window.dispatchEvent(new CustomEvent('activity-transition', { detail: { projectId, userId } }));
  }

  /**
   * Fires an event to check against the student's CURRENT activity.
   */


  /**
   * Reorder activities for an admin.
   */
  public async reorderActivities(projectId: string, orderedIds: string[]) {
    const db = FirebaseService.getInstance().db;
    const batch = writeBatch(db);

    orderedIds.forEach((id, index) => {
      const ref = doc(db, `notes/${projectId}/activities`, id);
      batch.update(ref, { sequenceNumber: index + 1 });
    });

    await batch.commit();
  }

  /**
   * Admin: Override points for a timed out activity.
   */
  public async manualScoreOverride(projectId: string, activityId: string, userId: string, points: number) {
    const db = FirebaseService.getInstance().db;
    const completionRef = doc(db, `notes/${projectId}/activities/${activityId}/completions/${userId}`);
    
    await updateDoc(completionRef, {
      manualPointsOverride: points,
      pointsEarned: points // Usually we set pointsEarned to match override for simplicity in aggregation
    });
  }

  /**
   * Admin: Resets all activities and clears student workspaces.
   */
  public async clearExistingActivitiesAndWorkspaces(projectId: string) {
    const db = FirebaseService.getInstance().db;

    // 1. Get all activities and their completions
    const activitiesSnap = await getDocs(collection(db, `notes/${projectId}/activities`));
    for (const activityDoc of activitiesSnap.docs) {
      // Delete completions subcollection
      await this.clearSubcollection(db, `notes/${projectId}/activities/${activityDoc.id}/completions`);
      // Delete activity document
      await deleteDoc(activityDoc.ref);
    }

    // 2. Get all student workspaces
    const workspacesSnap = await getDocs(collection(db, `notes/${projectId}/studentWorkspaces`));
    for (const wsDoc of workspacesSnap.docs) {
      const userId = wsDoc.id;
      const wsPath = `notes/${projectId}/studentWorkspaces/${userId}`;

      // Delete all subcollections
      await this.clearSubcollection(db, `${wsPath}/documents`);
      await this.clearSubcollection(db, `${wsPath}/folders`);
      await this.clearSubcollection(db, `${wsPath}/canvas`);
      
      // Base subcollections are nested
      const baseSnap = await getDocs(collection(db, `${wsPath}/base`));
      for (const baseDoc of baseSnap.docs) {
        await this.clearSubcollection(db, `${wsPath}/base/${baseDoc.id}/rows`);
        await this.clearSubcollection(db, `${wsPath}/base/${baseDoc.id}/columns`);
        await deleteDoc(baseDoc.ref);
      }

      // Re-initialize with defaults
      const batch = writeBatch(db);
      
      // Default Canvas
      const canvasRef = doc(collection(db, `${wsPath}/canvas`));
      batch.set(canvasRef, {
        title: 'Default Canvas',
        type: 'canvas',
        content: JSON.stringify({ nodes: [], edges: [] }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: userId
      });

      // Default Base
      const baseRef = doc(collection(db, `${wsPath}/base`));
      batch.set(baseRef, {
        title: 'Default Base',
        type: 'base',
        content: JSON.stringify({ views: [] }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: userId
      });

      await batch.commit();
    }
  }

  private async clearSubcollection(db: any, path: string) {
    const snap = await getDocs(collection(db, path));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  public async getAdminDashboardData(projectId: string) {
    const db = FirebaseService.getInstance().db;
    
    // 1. Get all activities
    const activitiesQ = query(collection(db, `notes/${projectId}/activities`), orderBy('sequenceNumber', 'asc'));
    const activitiesSnap = await getDocs(activitiesQ);
    const activities = activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));

    // 2. Get all project members from BOTH collaborators array AND studentWorkspaces subcollection
    const projectDoc = await getDoc(doc(db, 'notes', projectId));
    const ownerId = projectDoc.data()?.ownerId;
    const collaborators: string[] = projectDoc.data()?.collaborators || [];

    // Also discover students from studentWorkspaces subcollection
    // This catches students who have workspaces but may not be in the collaborators array
    try {
      const workspacesSnap = await getDocs(collection(db, `notes/${projectId}/studentWorkspaces`));
      workspacesSnap.docs.forEach(wsDoc => {
        if (!collaborators.includes(wsDoc.id)) {
          collaborators.push(wsDoc.id);
        }
      });
    } catch (e) {
      console.warn('[ActivityService] Could not query studentWorkspaces:', e);
    }

    // Add owner if not already present (for completeness)
    if (ownerId && !collaborators.includes(ownerId)) {
      collaborators.push(ownerId);
    }

    // Filter to only show students (non-owner) in the progress view
    const studentIds = collaborators.filter(uid => uid !== ownerId);

    const profiles = await FirebaseService.getInstance().getUserProfiles(collaborators);

    // 3. Get all completions for all activities — for students only
    const studentData = await Promise.all(studentIds.map(async (uId: string) => {
      const completions: Record<string, ActivityCompletion> = {};
      
      for (const activity of activities) {
        const compRef = doc(db, `notes/${projectId}/activities/${activity.id}/completions/${uId}`);
        const compSnap = await getDoc(compRef);
        if (compSnap.exists()) {
          completions[activity.id] = compSnap.data() as ActivityCompletion;
        }
      }

      return {
        userId: uId,
        name: profiles[uId]?.name || 'Student',
        avatar: profiles[uId]?.photoURL || null,
        completions
      };
    }));

    return { activities, studentData };
  }
}
