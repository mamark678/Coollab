import { FirebaseService } from '../services/firebase';

/**
 * Creates a default "My Workspace" project for a student user.
 * Uses a deterministic ID based on userId to prevent duplicates.
 * Safe to call multiple times — will skip if workspace already exists.
 */
export async function createDefaultWorkspace(userId: string): Promise<void> {
  const firebase = FirebaseService.getInstance();
  const workspaceId = `workspace-${userId}`;

  // Check if it already exists
  const existing = await firebase.getNote(workspaceId);
  if (existing) return; // Already exists, skip

  await firebase.createNote(workspaceId, {
    id: workspaceId,
    title: 'My Workspace',
    content: null,
    ownerId: userId,
    collaborators: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    type: 'document',
    isProject: true,
    projectId: null,
    isFolder: false,
    parentId: null,
  });

  console.log(`[Workspace] Created default workspace for student: ${userId}`);
}
