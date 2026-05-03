import { FirebaseService } from './firebase';
import { evaluateStudentWork } from './groq';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';

export interface EvaluationResult {
  instructions: { status: 'met' | 'not_met'; reason: string }[];
  verdict: 'completed' | 'partially_completed' | 'not_completed';
  instructionTexts: string[];
}

export class StudentEvaluationService {
  /**
   * Evaluates a student's work using AI vision and workspace analysis.
   */
  public static async evaluateWork(
    projectId: string,
    studentId: string,
    currentNoteId?: string | null
  ): Promise<EvaluationResult> {
    const firebase = FirebaseService.getInstance();
    
    // 1. Capture Screenshot via IPC
    console.log('[EvaluationService] Capturing screenshot...');
    const { filePath, base64 } = await (window as any).electronAPI.invoke('screen:capture');

    try {
      // 2. Fetch Instructions for the current activity
      console.log('[EvaluationService] Fetching active activity instructions...');
      const activitiesRef = collection(firebase.db, `notes/${projectId}/activities`);
      const q = query(activitiesRef, orderBy('sequenceNumber', 'asc'));
      const activitiesSnap = await getDocs(q);
      
      let instructions: string[] = [];

      for (const d of activitiesSnap.docs) {
        const activity = { id: d.id, ...d.data() } as any;
        const completionRef = doc(firebase.db, `notes/${projectId}/activities/${activity.id}/completions/${studentId}`);
        const compSnap = await getDoc(completionRef);
        const status = compSnap.exists() ? compSnap.data().status : 'pending';

        if (status !== 'completed' && status !== 'timed_out') {
          instructions = activity.instructions || [];
          break;
        }
      }

      if (instructions.length === 0 && activitiesSnap.size > 0) {
        const lastActivity = activitiesSnap.docs[activitiesSnap.docs.length - 1].data() as any;
        instructions = lastActivity.instructions || [];
      }

      // 3. Collect Detailed Workspace Structure & Document Text
      console.log('[EvaluationService] Collecting detailed workspace structure...');
      const workspaceDocs = await firebase.listProjectNotes(projectId, studentId);
      
      // Build a text-based tree structure for the AI
      const buildTree = (parentId: string | null, depth = 0): string => {
        return workspaceDocs
          .filter(d => (d.parentId || null) === parentId)
          .map(d => {
            const indent = '  '.repeat(depth);
            const typeLabel = d.isFolder ? '[FOLDER]' : d.type ? `[${d.type.toUpperCase()}]` : '[DOCUMENT]';
            const line = `${indent}- ${typeLabel} ${d.title}`;
            const children = buildTree(d.id, depth + 1);
            return children ? `${line}\n${children}` : line;
          })
          .join('\n');
      };
      
      const structureString = buildTree(null);

      // 4. Get currently open document text
      let currentDocText = '';
      if (currentNoteId) {
        const activeDoc = workspaceDocs.find(d => d.id === currentNoteId);
        if (activeDoc) {
          currentDocText = activeDoc.searchText || '';
        }
      }

      // 5. Call Groq for evaluation
      console.log('[EvaluationService] Calling Groq evaluation...');
      const result = await evaluateStudentWork(base64, structureString, instructions, currentDocText);

      return {
        ...result,
        instructionTexts: instructions
      };
    } finally {
      // 6. Cleanup temp file
      console.log('[EvaluationService] Cleaning up temp file...');
      await (window as any).electronAPI.invoke('fs:delete-temp-file', filePath);
    }
  }
}
