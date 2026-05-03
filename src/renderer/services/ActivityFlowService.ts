import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { Activity } from './activity';
import { FirebaseService } from './firebase';

export class ActivityFlowService {
  private currentActivity: Activity | null = null;
  private activities: Activity[] = [];
  private unsubscribeActivities: (() => void) | null = null;
  private unsubscribeCompletions: (() => void) | null = null;
  private timerInterval: any = null;
  private isStopped = false;

  constructor(public projectId: string, public userId: string) {
    this.setupEventListeners();
  }

  public start() {
    console.log(`[ActivityFlowService] Initializing for project ${this.projectId}...`);
    this.startListening();
  }

  private setupEventListeners() {
    window.addEventListener('start-current-activity', () => {
      this.startActivity();
    });

    window.addEventListener('complete-current-activity', () => {
      this.completeActivity();
    });
  }

  private async startListening() {
    if (!this.projectId || !this.userId) return;

    const db = FirebaseService.getInstance().db;
    const activitiesRef = collection(db, `notes/${this.projectId}/activities`);
    const q = query(activitiesRef, orderBy('sequenceNumber', 'asc'));

    // Listen for activities
    this.unsubscribeActivities = onSnapshot(q, (snapshot) => {
      this.activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      this.updateCurrentActivity();
    });
  }

  private async updateCurrentActivity() {
    if (!this.projectId || !this.userId || this.isStopped) return;

    if (this.unsubscribeCompletions) {
      this.unsubscribeCompletions();
      this.unsubscribeCompletions = null;
    }

    if (this.activities.length === 0) {
      this.currentActivity = null;
      this.stopTimer();
      window.dispatchEvent(new CustomEvent('current-activity-changed', { detail: null }));
      return;
    }

    const db = FirebaseService.getInstance().db;

    // Find the first incomplete activity with a one-time read
    let firstIncomplete: Activity | null = null;
    for (const activity of this.activities) {
      const completionRef = doc(db, `notes/${this.projectId}/activities/${activity.id}/completions/${this.userId}`);
      const compSnap = await getDoc(completionRef);
      const status = compSnap.exists() ? compSnap.data().status : 'pending';
      if (status !== 'completed' && status !== 'timed_out') {
        firstIncomplete = activity;
        break;
      }
    }

    if (!firstIncomplete) {
      // All done
      this.currentActivity = null;
      this.stopTimer();
      window.dispatchEvent(new CustomEvent('current-activity-changed', { detail: null }));
      return;
    }

    // Now attach onSnapshot ONLY to the correct activity
    const completionRef = doc(db, `notes/${this.projectId}/activities/${firstIncomplete.id}/completions/${this.userId}`);
    this.unsubscribeCompletions = onSnapshot(completionRef, (compSnap) => {
      if (this.isStopped) return;

      const status = compSnap.exists() ? compSnap.data().status || 'pending' : 'pending';
      const startedAt = compSnap.exists() ? compSnap.data().startedAt || null : null;

      if (status === 'completed' || status === 'timed_out') {
        // This activity is done — re-run to find the next one
        this.updateCurrentActivity();
        return;
      }

      // Still active
      this.currentActivity = firstIncomplete;
      if (status === 'pending') {
        this.stopTimer();
      } else if (status === 'in_progress' && startedAt) {
        this.startTimer(firstIncomplete, startedAt);
      }

      window.dispatchEvent(new CustomEvent('current-activity-changed', {
        detail: { activity: firstIncomplete, status, startedAt }
      }));
    });
  }

  private async checkNextActivity() {
    if (!this.projectId || !this.userId || this.isStopped) return;
    const db = FirebaseService.getInstance().db;

    for (const activity of this.activities) {
      const completionRef = doc(db, `notes/${this.projectId}/activities/${activity.id}/completions/${this.userId}`);
      const compSnap = await getDoc(completionRef);
      let status = 'pending';
      if (compSnap.exists()) {
        status = compSnap.data().status || 'pending';
      }
      if (status !== 'completed' && status !== 'timed_out') {
        this.updateCurrentActivity();
        return;
      }
    }

    // All done
    this.currentActivity = null;
    this.stopTimer();
    window.dispatchEvent(new CustomEvent('current-activity-changed', { detail: null }));
  }

  public async startActivity() {
    if (!this.currentActivity || !this.projectId || !this.userId) return;
    const db = FirebaseService.getInstance().db;
    const completionRef = doc(db, `notes/${this.projectId}/activities/${this.currentActivity.id}/completions/${this.userId}`);
    const startedAt = Date.now();

    await setDoc(completionRef, {
      userId: this.userId,
      projectId: this.projectId,
      activityId: this.currentActivity.id,
      status: 'in_progress',
      startedAt,
      pointsEarned: 0,
      timeTaken: 0,
      completedAt: null
    }, { merge: true });
  }

  public async completeActivity() {
    if (!this.currentActivity || !this.projectId || !this.userId) return;

    const activityId = this.currentActivity.id;
    const points = this.currentActivity.points || 10;

    const db = FirebaseService.getInstance().db;
    const completionRef = doc(db, `notes/${this.projectId}/activities/${activityId}/completions/${this.userId}`);
    const compSnap = await getDoc(completionRef);
    const startedAt = compSnap.exists() ? compSnap.data().startedAt : null;
    const timeTaken = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

    let pointsEarned = points;
    const config = this.currentActivity.timer_config;
    let isLate = false;

    if (config && config.duration_seconds > 0 && timeTaken > config.duration_seconds) {
      isLate = true;
      const penalty = config.late_penalty !== undefined ? config.late_penalty : points;
      pointsEarned = Math.max(0, points - penalty);
    }

    await setDoc(completionRef, {
      userId: this.userId,
      projectId: this.projectId,
      activityId,
      status: 'completed',
      completedAt: Date.now(),
      pointsEarned: pointsEarned,
      timeTaken
    }, { merge: true });

    // Toast
    window.dispatchEvent(new CustomEvent('activity-completed', {
      detail: { title: this.currentActivity.title, points: pointsEarned, isLate }
    }));

    this.stopTimer();
  }

  private startTimer(activity: Activity, firestoreStartedAt?: number | null) {
    this.stopTimer();
    const config = activity.timer_config;
    if (!config || config.duration_seconds <= 0) return;

    let startTime = firestoreStartedAt || Date.now();

    const checkTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, config.duration_seconds - elapsed);

      window.dispatchEvent(new CustomEvent('activity-timer-tick', {
        detail: { remaining, total: config.duration_seconds, isLate: remaining === 0 }
      }));
    };

    checkTimer();
    this.timerInterval = setInterval(checkTimer, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public stop() {
    this.isStopped = true;
    this.stopTimer();
    if (this.unsubscribeActivities) this.unsubscribeActivities();
    if (this.unsubscribeCompletions) this.unsubscribeCompletions();
    this.currentActivity = null;
    this.activities = [];
  }
}
