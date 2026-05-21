// ─── Graph Data Hook ───────────────────────────────────────────────────────
// Builds node/edge data from Firebase Realtime Database for the graph view.

import { collection, onSnapshot, query, where, type Query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService, type DocumentSchema } from '../../services/firebase';
import { useAppStore } from '../../store/useAppStore';
import type { GraphData, GraphEdge, GraphNode } from './GraphView.types';

// Regex to find [[WikiLink]] references in content strings
const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

function extractWikiLinks(content: string | null): string[] {
  if (!content) return [];
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(WIKI_LINK_REGEX.source, 'g');
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

function extractTags(content: string | null): string[] {
  if (!content) return [];
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1]);
  }
  return [...new Set(tags)];
}

function calcRadius(linkCount: number, baseSize: number): number {
  return Math.min(24, baseSize + linkCount * 1.5);
}

// Valid document types that should appear in the graph
const VALID_DOC_TYPES = new Set(['document', 'canvas', 'base']);

/** Filter out orphaned / invalid documents and deduplicate by ID */
function sanitizeDocs(rawDocs: DocumentSchema[]): DocumentSchema[] {
  // Deduplicate by document ID and keep anything that isn't a project container
  const unique = Array.from(new Map(rawDocs.map((d) => [d.id, d])).values());
  return unique.filter(d => d.id && d.title);
}

export function useGraphData(
  activeDocId: string | null,
  nodeSize: number = 6
): GraphData & { loading: boolean; error: string | null; retry: () => void } {
  const [docs, setDocs] = useState<DocumentSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { state: { user } } = useAuth();
  const { currentProjectId, activityType, viewingStudentId } = useAppStore();

  // Track the active unsubscribe function so we never run two subscriptions
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setError(null);
    setLoading(true);
  }, []);

  // ── Live Firestore listener ───────────────────────────────────────────
  useEffect(() => {
    // ── Cleanup any previous subscription immediately ──────────────────
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // isActive prevents a stale callback (from React Strict Mode double-invoke
    // or a rapid dependency change) from writing to state after cleanup.
    let isActive = true;

    const timer = setTimeout(() => {
      if (!isActive) return;
      try {
        if (!user) return;
        const firebase = FirebaseService.getInstance();

        if (currentProjectId) {
          const targetUserId = activityType === 'individual' ? (viewingStudentId || user.uid) : undefined;
          const unsub = firebase.listenToProjectNotes(
            currentProjectId,
            (projectDocs) => {
              if (!isActive) return; // guard stale callback
              startTransition(() => {
                setDocs(sanitizeDocs(projectDocs));
                setLoading(false);
                setError(null);
              });
            },
            targetUserId
          );
          unsubscribeRef.current = unsub;
        } else {
          const notesCol = collection(firebase.db, 'notes');
          const q = query(notesCol, where('ownerId', '==', user.uid));
          const unsub = onSnapshot(
            q,
            (snapshot) => {
              if (!isActive) return; // guard stale callback
              startTransition(() => {
                if (snapshot.empty) {
                  setDocs([]);
                  setLoading(false);
                  return;
                }
                const docList: DocumentSchema[] = [];
                snapshot.forEach((docSnap) => {
                  docList.push({ ...(docSnap.data() as DocumentSchema), id: docSnap.id });
                });
                setDocs(sanitizeDocs(docList));
                setLoading(false);
                setError(null);
              });
            },
            (err) => {
              if (!isActive) return;
              console.error('[useGraphData] Firestore listener error:', err);
              setError(err.message);
              setLoading(false);
            }
          );
          unsubscribeRef.current = unsub;
        }
      } catch (err: any) {
        if (!isActive) return;
        console.error('[useGraphData] Fallback error:', err);
        setError(err.message);
        setLoading(false);
      }
    }, 300); // Defer heavy listener

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [retryCount, user, currentProjectId, activityType, viewingStudentId]);

  // ── Build nodes/edges — split into two memos ──────────────────────────
  // `baseGraph` only recomputes when Firestore docs change (expensive).
  // `graph` recomputes when activeDocId changes (cheap — just flips isActive/color).
  // This means sidebar clicks instantly highlight the correct node.

  const baseGraph = useMemo(() => {
    const linkCounts = new Map<string, number>();
    const edgeList: GraphEdge[] = [];

    // ── Build Document Lookup ────────────────────────────────────────
    const titleToId = new Map<string, string>();
    const docNodes: DocumentSchema[] = [];

    for (const doc of docs) {
      const isContainer = 
        doc.isFolder === true || 
        doc.isProject === true ||
        doc.type === 'folder' || 
        doc.type === 'project';
      
      // Projects and Folders should not be nodes in the knowledge graph
      if (!isContainer) {
        docNodes.push(doc);
        titleToId.set((doc.title || '').toLowerCase().trim(), doc.id);
      }
    }

    // ── 2. Content Linking (WikiLinks & Tags) ──────────────────────────
    const edgesAdded = new Set<string>();
    
    for (const doc of docNodes) {
      // Use searchText (plaintext) instead of content (binary)
      const contentForScanning = doc.searchText || '';
      
      // Extract WikiLinks [[Title]]
      const linkedTitles = extractWikiLinks(contentForScanning);
      // Ensure unique links so we don't draw multiple edges to the same target from one note
      const uniqueLinkedTitles = [...new Set(linkedTitles)];
      
      for (const linkedTitle of uniqueLinkedTitles) {
        const targetId = titleToId.get(linkedTitle.toLowerCase());
        
        if (targetId && targetId !== doc.id) {
          const edgeKey1 = `${doc.id}→${targetId}`;
          const edgeKey2 = `${targetId}→${doc.id}`;
          
          // Deduplicate edges — if the same two notes link to each other, only one line should appear
          if (!edgesAdded.has(edgeKey1) && !edgesAdded.has(edgeKey2)) {
            edgeList.push({ source: doc.id, target: targetId, weight: 1.5 });
            edgesAdded.add(edgeKey1);
            linkCounts.set(doc.id, (linkCounts.get(doc.id) || 0) + 1);
            linkCounts.set(targetId, (linkCounts.get(targetId) || 0) + 1);
          }
        }
        // If the linked note doesn't exist, we ignore it (no dangling edges)
      }
    }

    // ── 3. Build Node List ───────────────────────────────────────────
    const nodeList: GraphNode[] = [];
    
    for (const doc of docNodes) {
      const count = linkCounts.get(doc.id) || 0;
      const tags = extractTags(doc.searchText || '');
      
      let nodeColor = 'default';
      if (count === 0) {
        nodeColor = 'orphan'; // Dimmer for orphan nodes
      } else if (tags.length > 0) {
        nodeColor = 'tagged';
      }

      nodeList.push({
        id: doc.id,
        label: doc.title || 'Untitled Document',
        x: Math.random() * 400 - 200,
        y: Math.random() * 400 - 200,
        vx: 0,
        vy: 0,
        radius: calcRadius(count, nodeSize),
        color: nodeColor,
        linkCount: count,
        isResolved: true,
        isActive: false,
        tags,
      });
    }

    // Final edge deduplication by source+target pair
    const uniqueEdges = Array.from(
      new Map(edgeList.map(e => [`${e.source}-${e.target}`, e])).values()
    );

    return { nodes: nodeList, edges: uniqueEdges };
  }, [docs, nodeSize]);

  // ── Apply activeDocId reactively — cheap O(n) pass ────────────────────
  // Runs whenever the sidebar selection changes without rebuilding the graph.
  const nodes = useMemo<GraphNode[]>(() => {
    return baseGraph.nodes.map((node) => {
      const isActive = node.id === activeDocId;
      return {
        ...node,
        isActive,
        color: isActive
          ? 'active'
          : node.linkCount === 0
            ? 'orphan'
            : node.tags.length > 0
              ? 'tagged'
              : 'default',
      };
    });
  }, [baseGraph.nodes, activeDocId]);

  return {
    nodes,
    edges: baseGraph.edges,
    loading,
    error,
    retry,
  };
}